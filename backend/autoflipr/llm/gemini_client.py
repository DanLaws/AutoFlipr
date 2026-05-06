import json
import logging
import time
from typing import Any, Optional

from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

from autoflipr.config import settings

log = logging.getLogger(__name__)

# TTL cache for scam context so we don't open a new DB session on every
# analyse_vehicle call.  Tuple of (context_string, expiry_unix_timestamp).
_scam_context_cache: tuple[str, float] | None = None
_SCAM_CONTEXT_TTL = 300  # 5 minutes

# Ordered list of models to try. Primary is settings.gemini_model; the rest
# are fallbacks tried automatically when a model is unavailable or quota-exhausted.
# Stable GA models come first — preview models are fast but less reliable.
_FALLBACK_MODELS = [
    "gemini-2.5-flash",            # stable GA — best reasoning/price balance; primary for analysis
    "gemini-2.5-flash-lite",       # stable GA — separate daily quota, fast cheap fallback
    "gemini-2.5-pro",              # stable GA — highest quality, separate daily quota
    "gemini-3.1-flash-lite-preview",  # preview frontier — last resort
    "gemini-3.1-pro-preview",        # preview frontier — last resort
]

# How long (seconds) to suppress a model after a 429 quota hit or 503 overload.
# Using the same TTL for both: 10 minutes is short enough that an RPM-throttled
# model recovers quickly, while an RPD-exhausted model just gets re-suppressed
# when it's tried again — no permanent blacklisting.
_EXHAUSTED_TTL = 600   # 10 minutes — 429 quota-hit
_UNAVAILABLE_TTL = 600  # 10 minutes — 503 overloaded

# Per-key exhausted models: index into _clients → {model_name: expiry_timestamp}.
# A model is considered exhausted only while time.time() < expiry.
_exhausted_models: list[dict[str, float]] = []

# Per-key unavailable models: same TTL-dict structure.
_unavailable_models: list[dict[str, float]] = []

_clients: list[genai.Client] = []


def _init_clients() -> None:
    keys = settings.gemini_key_list
    if not keys:
        raise RuntimeError("No Gemini API keys configured (GEMINI_API_KEYS is empty)")
    for key in keys:
        _clients.append(genai.Client(api_key=key))
        _exhausted_models.append({})
        _unavailable_models.append({})
    log.info("Gemini key rotation: %d key(s) loaded", len(_clients))


_init_clients()


def _model_list(key_idx: int) -> list[str]:
    """Return primary model + fallbacks for a given key, skipping exhausted/unavailable ones.

    Models are suppressed only while their TTL has not expired.  Stale entries
    are evicted in-place so they don't accumulate over long worker lifetimes.
    """
    now = time.time()
    primary = settings.gemini_model
    candidates = [primary] + [m for m in _FALLBACK_MODELS if m != primary]

    # Evict expired entries from both dicts for this key.
    for store in (_exhausted_models[key_idx], _unavailable_models[key_idx]):
        expired = [m for m, exp in store.items() if now >= exp]
        for m in expired:
            del store[m]

    skip = set(_exhausted_models[key_idx]) | set(_unavailable_models[key_idx])
    return [m for m in candidates if m not in skip]

_EXTRACTION_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "make": types.Schema(type=types.Type.STRING),
        "model": types.Schema(type=types.Type.STRING),
        "variant": types.Schema(type=types.Type.STRING),
        "year": types.Schema(type=types.Type.INTEGER),
        "mileage": types.Schema(type=types.Type.INTEGER),
        "price_gbp": types.Schema(type=types.Type.INTEGER),
        "registration": types.Schema(type=types.Type.STRING),
        "transmission": types.Schema(
            type=types.Type.STRING, enum=["manual", "automatic"]
        ),
        "fuel": types.Schema(type=types.Type.STRING),
        "owners": types.Schema(type=types.Type.INTEGER),
        "seller_type": types.Schema(
            type=types.Type.STRING, enum=["private", "trade"]
        ),
        "urgency_tags": types.Schema(
            type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)
        ),
        "location_text": types.Schema(type=types.Type.STRING),
        "body_type": types.Schema(type=types.Type.STRING),
        "colour": types.Schema(type=types.Type.STRING),
        "seller_name": types.Schema(type=types.Type.STRING),
    },
    required=["make", "model", "year", "price_gbp"],
)

_MOT_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "summary": types.Schema(type=types.Type.STRING),
        "risk_tags": types.Schema(
            type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)
        ),
        "mileage_consistent": types.Schema(type=types.Type.BOOLEAN),
        "notable_advisories": types.Schema(
            type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)
        ),
    },
    required=["summary"],
)

_EXTRACTION_SYSTEM = (
    "You are a data extraction assistant. Extract structured vehicle listing data "
    "from the provided HTML. Return only JSON matching the schema. "
    "If a field cannot be determined, omit it."
)

_MOT_SYSTEM = (
    "You are a factual automotive data analyst. Summarise the MOT history provided. "
    "Be concise and factual. Do NOT comment on the vehicle's price, value, or deal quality. "
    "Do NOT make recommendations to buy or avoid the vehicle."
)

_ANALYSIS_SYSTEM = (
    "You are a vehicle listing quality analyst. Assess the listing based solely on what is "
    "written in the text — do NOT comment on price, market value, or deal quality. "
    "red_flags: listing quality issues (e.g. no photos, very sparse description, vague condition, "
    "unusually pushy language, missing key details). "
    "condition_notes: factual claims the seller makes about condition, service, or history. "
    "positives: genuine positive attributes stated in the listing (full service history, one owner, "
    "recent MOT, fresh tyres, etc.). "
    "risk_score: 0–100 where 0=highly detailed and transparent listing, 100=very sparse/suspicious. "
    "confidence_pct: 0–100 reflecting how much usable information the listing provides for your analysis. "
    "narrative: 2–3 sentence plain-English summary of the listing quality and key attributes."
)

_ANALYSIS_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "risk_score": types.Schema(type=types.Type.INTEGER),
        "red_flags": types.Schema(
            type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)
        ),
        "condition_notes": types.Schema(
            type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)
        ),
        "positives": types.Schema(
            type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)
        ),
        "narrative": types.Schema(type=types.Type.STRING),
        "confidence_pct": types.Schema(type=types.Type.INTEGER),
    },
    required=["risk_score", "narrative", "confidence_pct"],
)


def _parse_json_text(text: str) -> Optional[dict]:
    """Extract JSON from a response that may be wrapped in markdown code fences."""
    import re
    # Strip ```json ... ``` or ``` ... ``` wrappers
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text.strip())
    try:
        return json.loads(text.strip())
    except (json.JSONDecodeError, ValueError):
        # Try to find first {...} block
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except (json.JSONDecodeError, ValueError):
                pass
    return None


def _call_gemini(
    system: str,
    user_content: str,
    response_schema: types.Schema,
    max_output_tokens: int = 1024,
) -> tuple[Optional[dict[str, Any]], int, int]:
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0,
        response_mime_type="application/json",
        response_schema=response_schema,
        max_output_tokens=max_output_tokens,
    )

    any_key_has_models = any(_model_list(i) for i in range(len(_clients)))
    if not any_key_has_models:
        raise RuntimeError("All Gemini models have exhausted their daily quota")

    last_exc: Exception = RuntimeError("No models available")

    for key_idx, client in enumerate(_clients):
        models = _model_list(key_idx)
        if not models:
            log.debug("Key %d: all models exhausted, skipping", key_idx)
            continue

        for model_name in models:
            for attempt in range(2):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=user_content,
                        config=config,
                    )
                    input_tokens = response.usage_metadata.prompt_token_count or 0
                    output_tokens = response.usage_metadata.candidates_token_count or 0
                    try:
                        data = json.loads(response.text)
                    except (json.JSONDecodeError, ValueError) as exc:
                        log.warning("Gemini response not valid JSON (key=%d model=%s): %s", key_idx, model_name, exc)
                        data = _parse_json_text(response.text)
                    log.info("Gemini call succeeded (key=%d model=%s)", key_idx, model_name)
                    return data, input_tokens, output_tokens

                except ClientError as exc:
                    exc_code = getattr(exc, "code", 0) or 0
                    if exc_code == 429:
                        last_exc = exc
                        if attempt == 0:
                            log.warning("Gemini 429 on key=%d %s attempt 1 — waiting 15s", key_idx, model_name)
                            time.sleep(15)
                        else:
                            log.warning("Gemini 429 on key=%d %s attempt 2 — suppressing for %ds", key_idx, model_name, _EXHAUSTED_TTL)
                            _exhausted_models[key_idx][model_name] = time.time() + _EXHAUSTED_TTL
                            break
                    else:
                        raise

                except ServerError as exc:
                    exc_code = getattr(exc, "code", 0) or 0
                    if exc_code == 503:
                        last_exc = exc
                        log.warning("Gemini 503 on key=%d %s — suppressing for %ds", key_idx, model_name, _UNAVAILABLE_TTL)
                        _unavailable_models[key_idx][model_name] = time.time() + _UNAVAILABLE_TTL
                        break
                    else:
                        raise

    raise last_exc  # all keys × models exhausted or unavailable


_LISTING_SYSTEM = (
    "You are an expert UK car sales copywriter helping private sellers write compelling classified adverts. "
    "Write honest, friendly descriptions that highlight the car's genuine strengths. "
    "Naturally weave all provided features into the description — do NOT use a bullet list for features inside the description; "
    "write them as flowing sentences. "
    "If MOT advisories are present, mention them honestly but frame them fairly. "
    "For pricing, anchor your strategies to the real market data provided (current AutoTrader asking prices for comparable cars). "
    "UK private buyers always try to barter, so listed prices must be HIGHER than the minimum acceptable (target_price) "
    "to leave room for negotiation — typically 5–10% above target. "
    "quick_sale: priced to sell within 1–7 days — undercut the market median slightly, attractive to the first serious viewer. "
    "balanced: at or just below the market median, likely to sell in 2–4 weeks with a healthy profit margin. "
    "premium: above the market median, patient seller comfortable waiting 4–12 weeks, highest margin. "
    "If no market data is available, use your knowledge of the UK used car market to estimate sensible prices. "
    "estimated_days: provide a plain range string e.g. '1–7 days', '2–4 weeks', '4–12 weeks'. "
    "rationale: one sentence explaining the strategy and how it relates to the market data."
)

_LISTING_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "title": types.Schema(type=types.Type.STRING),
        "description": types.Schema(type=types.Type.STRING),
        "pricing": types.Schema(
            type=types.Type.OBJECT,
            properties={
                "quick_sale": types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "listed_price": types.Schema(type=types.Type.INTEGER),
                        "target_price": types.Schema(type=types.Type.INTEGER),
                        "rationale": types.Schema(type=types.Type.STRING),
                        "estimated_days": types.Schema(type=types.Type.STRING),
                    },
                    required=["listed_price", "target_price", "rationale", "estimated_days"],
                ),
                "balanced": types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "listed_price": types.Schema(type=types.Type.INTEGER),
                        "target_price": types.Schema(type=types.Type.INTEGER),
                        "rationale": types.Schema(type=types.Type.STRING),
                        "estimated_days": types.Schema(type=types.Type.STRING),
                    },
                    required=["listed_price", "target_price", "rationale", "estimated_days"],
                ),
                "premium": types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "listed_price": types.Schema(type=types.Type.INTEGER),
                        "target_price": types.Schema(type=types.Type.INTEGER),
                        "rationale": types.Schema(type=types.Type.STRING),
                        "estimated_days": types.Schema(type=types.Type.STRING),
                    },
                    required=["listed_price", "target_price", "rationale", "estimated_days"],
                ),
            },
            required=["quick_sale", "balanced", "premium"],
        ),
    },
    required=["title", "description", "pricing"],
)


def generate_listing(
    make: str,
    model: str,
    year: int | None,
    mileage: int | None,
    colour: str | None,
    fuel: str | None,
    transmission: str | None,
    total_cost: int,
    features: list[str],
    mot_advisories: str | None,
    market: dict | None = None,
) -> tuple[Optional[dict], int, int]:
    parts = [
        f"Make: {make}",
        f"Model: {model}",
    ]
    if year:
        parts.append(f"Year: {year}")
    if mileage:
        parts.append(f"Mileage: {mileage:,} miles")
    if colour:
        parts.append(f"Colour: {colour}")
    if fuel:
        parts.append(f"Fuel type: {fuel}")
    if transmission:
        parts.append(f"Transmission: {transmission}")
    parts.append(f"Total cost to seller (purchase + extras): £{total_cost:,}")
    if features:
        parts.append(f"Features: {', '.join(features)}")
    else:
        parts.append("Features: None specified")
    parts.append(f"MOT advisories: {mot_advisories.strip() if mot_advisories else 'None'}")

    if market and market.get("count", 0) > 0:
        parts.append("")
        parts.append(
            f"Market data ({market['count']} comparable {make} {model} listings on AutoTrader, last 90 days):"
        )
        parts.append(f"  Asking price range: £{market['min_asking']:,} – £{market['max_asking']:,}")
        parts.append(f"  Median asking price: £{market['median_asking']:,}")
        parts.append(f"  Mileage-adjusted median (to {mileage:,} miles): £{market['adj_median']:,}")
        if market.get("samples"):
            sample_str = ", ".join(
                f"£{s['price']:,} ({s['mileage']:,}mi)"
                for s in market["samples"][:6]
            )
            parts.append(f"  Sample listings: {sample_str}")
    else:
        parts.append("")
        parts.append("Market data: No comparable listings found in database — use your knowledge of the UK used car market.")

    user_content = "Generate a classified car advert for:\n\n" + "\n".join(parts)
    return _call_gemini(
        system=_LISTING_SYSTEM,
        user_content=user_content,
        response_schema=_LISTING_RESPONSE_SCHEMA,
        max_output_tokens=2048,
    )


def _html_to_text(html: str) -> str:
    import re
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:20_000]


def extract_listing(html: str) -> tuple[Optional[dict], int, int]:
    text = _html_to_text(html)
    return _call_gemini(
        system=_EXTRACTION_SYSTEM,
        user_content=f"Extract vehicle data from this listing page text:\n\n{text}",
        response_schema=_EXTRACTION_RESPONSE_SCHEMA,
        max_output_tokens=512,
    )


def analyse_mot(mot_records: list[dict]) -> tuple[Optional[dict], int, int]:
    content = json.dumps(mot_records, default=str)
    return _call_gemini(
        system=_MOT_SYSTEM,
        user_content=f"Summarise this MOT history:\n\n{content}",
        response_schema=_MOT_RESPONSE_SCHEMA,
        max_output_tokens=512,
    )


def _build_scam_context() -> str:
    """
    Fetch up to 5 recently reported scam listings from the DB and return
    them as a few-shot context block for the analysis prompt.
    Returns an empty string if there are no reports yet.

    Result is cached for _SCAM_CONTEXT_TTL seconds to avoid opening a new
    DB session on every analyse_vehicle call.
    """
    global _scam_context_cache
    now = time.time()
    if _scam_context_cache is not None:
        cached_value, expiry = _scam_context_cache
        if now < expiry:
            return cached_value

    try:
        from autoflipr.db.session import SessionLocal
        from autoflipr.db.models import ListingReport, Listing, ReportType

        db = SessionLocal()
        try:
            rows = (
                db.query(ListingReport, Listing)
                .join(Listing, Listing.id == ListingReport.listing_id)
                .filter(
                    ListingReport.report_type == ReportType.SCAM,
                    Listing.raw_html.isnot(None),
                )
                .order_by(ListingReport.reported_at.desc())
                .limit(5)
                .all()
            )
            if not rows:
                result = ""
            else:
                examples = []
                for report, listing in rows:
                    snippet = _html_to_text(listing.raw_html)[:1500]
                    note = f" ({report.notes})" if report.notes else ""
                    examples.append(
                        f"KNOWN SCAM LISTING{note}:\n{snippet}\n---"
                    )
                result = (
                    "\n\nFor reference, the following are listings that have been "
                    "reported as scams by users. Use these as negative examples when "
                    "evaluating red_flags and risk_score:\n\n"
                    + "\n\n".join(examples)
                )
        finally:
            db.close()
    except Exception:
        result = ""  # never block analysis on scam context failure

    _scam_context_cache = (result, now + _SCAM_CONTEXT_TTL)
    return result


def analyse_vehicle(html: str, include_scam_context: bool = True) -> tuple[Optional[dict], int, int]:
    text = _html_to_text(html)
    scam_ctx = _build_scam_context() if include_scam_context else ""
    return _call_gemini(
        system=_ANALYSIS_SYSTEM + scam_ctx,
        user_content=f"Analyse this vehicle listing:\n\n{text}",
        response_schema=_ANALYSIS_RESPONSE_SCHEMA,
        max_output_tokens=512,
    )
