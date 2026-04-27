import json
import logging
import time
from typing import Any, Optional

from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

from carflip.config import settings

log = logging.getLogger(__name__)

_MIN_CALL_INTERVAL = 4.0

# Ordered list of models to try. Primary is settings.gemini_model; the rest
# are fallbacks tried automatically when a model is unavailable or quota-exhausted.
# Stable GA models come first — preview models are fast but less reliable.
_FALLBACK_MODELS = [
    "gemini-2.5-flash-lite",       # stable GA, fast, cheap
    "gemini-2.5-flash",            # stable GA, slightly more capable
    "gemini-2.5-pro",              # stable GA, highest quality
    "gemini-3-flash-preview",      # preview — may be unavailable
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
    "gemma-3-27b-it",
    "gemma-3-12b-it",
    "gemma-3-4b-it",
]

# Models whose daily quota is known-exhausted in this process lifetime.
_exhausted_models: set[str] = set()

# Models that returned 503 in this process lifetime (skip for this run, not permanently).
_unavailable_models: set[str] = set()

_client = genai.Client(
    api_key=settings.gemini_api_key,
)


def _model_list() -> list[str]:
    """Return primary model + fallbacks, skipping quota-exhausted or unavailable ones."""
    primary = settings.gemini_model
    candidates = [primary] + [m for m in _FALLBACK_MODELS if m != primary]
    skip = _exhausted_models | _unavailable_models
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
    # Standard config with JSON schema enforcement (Gemini models)
    gemini_config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0,
        response_mime_type="application/json",
        response_schema=response_schema,
        max_output_tokens=max_output_tokens,
    )
    # Plain config for Gemma models (no JSON schema support)
    gemma_config = types.GenerateContentConfig(
        system_instruction=system + "\n\nRespond with valid JSON only. No markdown, no explanation.",
        temperature=0,
        max_output_tokens=max_output_tokens,
    )

    models = _model_list()
    if not models:
        raise RuntimeError("All Gemini models have exhausted their daily quota")

    last_exc: Exception = RuntimeError("No models available")

    for model_name in models:
        is_gemma = model_name.startswith("gemma")
        config = gemma_config if is_gemma else gemini_config

        for attempt in range(2):
            time.sleep(_MIN_CALL_INTERVAL)
            try:
                response = _client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config=config,
                )
                input_tokens = response.usage_metadata.prompt_token_count or 0
                output_tokens = response.usage_metadata.candidates_token_count or 0
                data = _parse_json_text(response.text) if is_gemma else None
                if not is_gemma:
                    try:
                        data = json.loads(response.text)
                    except (json.JSONDecodeError, ValueError) as exc:
                        log.warning("Gemini response not valid JSON (model=%s): %s", model_name, exc)
                        data = _parse_json_text(response.text)
                log.info("Gemini call succeeded (model=%s)", model_name)
                return data, input_tokens, output_tokens

            except ClientError as exc:
                exc_code = getattr(exc, "code", 0) or 0
                if exc_code == 429:
                    last_exc = exc
                    if attempt == 0:
                        log.warning("Gemini 429 on %s attempt 1 — waiting 15s", model_name)
                        time.sleep(15)
                    else:
                        log.warning("Gemini 429 on %s attempt 2 — marking exhausted, trying next model", model_name)
                        _exhausted_models.add(model_name)
                        break
                else:
                    raise

            except ServerError as exc:
                exc_code = getattr(exc, "code", 0) or 0
                if exc_code == 503:
                    last_exc = exc
                    # 503 = overloaded, not quota. Mark unavailable for this run
                    # and immediately try the next model rather than waiting.
                    log.warning("Gemini 503 on %s — model overloaded, trying next", model_name)
                    _unavailable_models.add(model_name)
                    break
                else:
                    raise

    raise last_exc  # all models exhausted or unavailable


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
    """
    try:
        from carflip.db.session import SessionLocal
        from carflip.db.models import ListingReport, Listing

        db = SessionLocal()
        try:
            rows = (
                db.query(ListingReport, Listing)
                .join(Listing, Listing.id == ListingReport.listing_id)
                .filter(
                    ListingReport.report_type == "scam",
                    Listing.raw_html.isnot(None),
                )
                .order_by(ListingReport.reported_at.desc())
                .limit(5)
                .all()
            )
            if not rows:
                return ""

            examples = []
            for report, listing in rows:
                snippet = _html_to_text(listing.raw_html)[:1500]
                note = f" ({report.notes})" if report.notes else ""
                examples.append(
                    f"KNOWN SCAM LISTING{note}:\n{snippet}\n---"
                )

            return (
                "\n\nFor reference, the following are listings that have been "
                "reported as scams by users. Use these as negative examples when "
                "evaluating red_flags and risk_score:\n\n"
                + "\n\n".join(examples)
            )
        finally:
            db.close()
    except Exception:
        return ""  # never block analysis on scam context failure


def analyse_vehicle(html: str, include_scam_context: bool = True) -> tuple[Optional[dict], int, int]:
    text = _html_to_text(html)
    scam_ctx = _build_scam_context() if include_scam_context else ""
    return _call_gemini(
        system=_ANALYSIS_SYSTEM + scam_ctx,
        user_content=f"Analyse this vehicle listing:\n\n{text}",
        response_schema=_ANALYSIS_RESPONSE_SCHEMA,
        max_output_tokens=512,
    )
