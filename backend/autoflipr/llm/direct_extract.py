"""
Direct HTML parsers for AutoTrader and Gumtree listings.
No LLM required — all fields come from structured data embedded in the page.
Falls back gracefully (returns None) if parsing fails, so the caller can
queue the listing for LLM extraction instead.
"""
import json
import logging
import re
from typing import Optional
from urllib.parse import unquote

log = logging.getLogger(__name__)

# Known AutoTrader standard colours used in the <title> tag.
# Used to separate colour from make/model in the title string.
_AT_COLOURS = {
    "white", "black", "grey", "gray", "silver", "blue", "red", "green",
    "orange", "yellow", "purple", "brown", "beige", "gold", "bronze",
    "pink", "cream", "multicolour", "multicolor", "maroon", "navy", "teal",
    "turquoise", "burgundy", "champagne",
}


def _clean_int(s: Optional[str]) -> Optional[int]:
    if not s:
        return None
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else None


def _html_strip(html: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# ── AutoTrader ────────────────────────────────────────────────────────────────

def _at_spec(text: str, label: str) -> Optional[str]:
    """Extract a spec value from AutoTrader's 'Label Label Value' rendered pairs."""
    escaped = re.escape(label)
    m = re.search(
        rf"{escaped}\s+{escaped}\s+([^\n]+?)(?=\s+[A-Z][a-z]|\s+Body colour|\s+Emission|\s*$)",
        text,
    )
    if m:
        return m.group(1).strip()
    return None


def extract_autotrader(html: str) -> Optional[dict]:
    try:
        title_m = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE)
        if not title_m:
            return None
        title = title_m.group(1).strip()

        # "2020 Audi e-tron for sale for £20,809 in GUILDFORD, SURREY"
        # "2014 Grey Mazda Mazda6 for sale for £995 in READING, BERKSHIRE"
        title_pat = re.match(
            r"(\d{4})\s+(.*?)\s+for sale for\s+£([\d,]+)\s+in\s+(.+?)(?:\s*\|.*)?$",
            title,
        )
        if not title_pat:
            return None

        year = int(title_pat.group(1))
        make_model_raw = title_pat.group(2).strip()
        price_gbp = _clean_int(title_pat.group(3))
        location_raw = title_pat.group(4).strip().title()

        # Split "Grey Mazda Mazda6" or "Audi e-tron" into colour + make + model
        words = make_model_raw.split()
        colour: Optional[str] = None
        if words and words[0].lower() in _AT_COLOURS:
            colour = words[0].title()
            words = words[1:]
        make = words[0] if words else None
        model = " ".join(words[1:]) if len(words) > 1 else None

        text = _html_strip(html)

        # Spec key-value pairs (AutoTrader renders "Label Label Value")
        mileage_raw = _at_spec(text, "Mileage")
        mileage = _clean_int(mileage_raw) if mileage_raw else None

        fuel = _at_spec(text, "Fuel type")
        body_type = _at_spec(text, "Body type")
        gearbox = _at_spec(text, "Gearbox")
        colour_spec = _at_spec(text, "Body colour")
        if colour_spec and colour_spec.lower() not in ("none", ""):
            colour = colour_spec

        # Registration: "2014 (14 reg)" — we only get year, not the full plate
        reg_raw = _at_spec(text, "Registration")
        # AutoTrader doesn't expose the actual registration plate on the page

        # Seller name — "From {Name} {rating} More seller"
        seller_m = re.search(r"From\s+(.+?)\s+(?:\d+\.?\d*\s+)?(?:More seller|stars)", text)
        seller_name = seller_m.group(1).strip() if seller_m else None

        # Seller type — AutoTrader shows "Trade seller" or "Private seller" in the text
        if re.search(r"\bPrivate\s+seller\b", text, re.IGNORECASE):
            seller_type = "private"
        elif re.search(r"\bTrade\s+seller\b|\bDealer\b", text, re.IGNORECASE) or (seller_name and re.search(r"\b(Ltd|Limited|Cars|Motors|Garage|Group|Auto|Centre)\b", seller_name, re.IGNORECASE)):
            seller_type = "trade"
        else:
            seller_type = None

        # Variant — between reserve block and price in visible text
        variant_m = re.search(
            rf"(?:reserve|online)\s+{year}\s+{re.escape(make or '')}\s+{re.escape(model or '')}\s+(.+?)\s+£[\d,]+",
            text,
            re.IGNORECASE,
        )
        variant = variant_m.group(1).strip() if variant_m else None

        # Urgency tags from description text
        desc_m = re.search(r"Description\s+(.*?)(?:Running costs|Insurance|Meet the seller)", text, re.IGNORECASE | re.DOTALL)
        desc = desc_m.group(1).strip() if desc_m else ""
        urgency_tags = []
        for tag, patterns in [
            ("spares_or_repairs", [r"\bspare[s]?\s+or\s+repair[s]?\b", r"\bspare or repair\b"]),
            ("needs_work",        [r"\bneeds\s+(?:work|attention|repair)\b"]),
            ("no_mot",            [r"\bno\s+mot\b", r"\bfailed\s+mot\b"]),
            ("salvage",           [r"\bsalvage\b", r"\bcat\s+[a-n]\b"]),
            ("eml_on",            [r"\beml\s+on\b", r"\bengine\s+(?:management|warning)\s+light\b"]),
            ("smoking",           [r"\bsmok(?:ing|es)\b"]),
        ]:
            if any(re.search(p, desc, re.IGNORECASE) for p in patterns):
                urgency_tags.append(tag)

        if not make or not price_gbp:
            return None

        return {
            "make": make,
            "model": model,
            "variant": variant,
            "year": year,
            "mileage": mileage,
            "price_gbp": price_gbp,
            "registration": None,  # not exposed on page
            "transmission": gearbox,
            "fuel": fuel,
            "seller_type": seller_type,
            "seller_name": seller_name,
            "body_type": body_type,
            "colour": colour,
            "urgency_tags": urgency_tags or [],
            "location_text": location_raw,
        }
    except Exception:
        log.debug("AutoTrader direct extract failed", exc_info=True)
        return None


# ── Gumtree ───────────────────────────────────────────────────────────────────

def extract_gumtree(html: str) -> Optional[dict]:
    try:
        m = re.search(r"window\.dataLayer\s*=.*?const initialDataLayer\s*=\s*(\{.*?\})\s*;", html, re.DOTALL)
        if not m:
            return None
        data = json.loads(m.group(1))
        attr = data.get("a", {}).get("attr", {})
        if not attr:
            return None

        prc = data.get("a", {}).get("prc", {})
        price_gbp = int(prc.get("amt", 0)) // 100 if prc.get("amt") else None

        make = attr.get("vehicle_make") or None
        model = attr.get("vehicle_model") or None
        year_str = attr.get("vehicle_registration_year")
        year = int(year_str) if year_str and year_str.isdigit() else None

        mileage_str = attr.get("vehicle_estimated_mileage") or attr.get("vehicle_mileage")
        mileage = int(mileage_str) if mileage_str and mileage_str.isdigit() else None

        transmission = attr.get("vehicle_transmission")
        fuel = attr.get("vehicle_fuel_type")
        body_type = attr.get("vehicle_body_type")
        colour = attr.get("vehicle_colour")
        seller_type_raw = attr.get("seller_type", "")
        seller_type = "trade" if seller_type_raw.lower() == "trade" else "private" if seller_type_raw.lower() in ("private", "private seller") else None
        derivative = attr.get("vehicle_derivative")

        # Location — Gumtree embeds it as a plain "location" field in the JSON
        # and also provides lat/lng directly in the tracking object.
        tracking = data.get("l", {})

        # Try several known keys for the human-readable location string
        location_raw = (
            data.get("a", {}).get("attr", {}).get("location")
            or tracking.get("locName")
            or tracking.get("locality")
            or tracking.get("area")
        )
        # Fallback: scan the raw HTML for the "location" JSON field
        if not location_raw:
            loc_m = re.search(r'"location"\s*:\s*"([^"]+)"', html)
            if loc_m:
                location_raw = loc_m.group(1).strip()

        # Extract lat/lng directly from the tracking ltlng field (e.g. "54.418;-6.446")
        # so we can skip geocoding entirely for Gumtree listings.
        lat: Optional[float] = None
        lng: Optional[float] = None
        ltlng = tracking.get("ltlng", "")
        if ltlng and ";" in ltlng:
            try:
                lat_str, lng_str = ltlng.split(";", 1)
                lat = float(lat_str)
                lng = float(lng_str)
            except (ValueError, TypeError):
                pass

        if not make or not price_gbp:
            return None

        return {
            "make": make,
            "model": model,
            "variant": derivative,
            "year": year,
            "mileage": mileage,
            "price_gbp": price_gbp,
            "registration": None,  # encrypted by Gumtree
            "transmission": transmission,
            "fuel": fuel,
            "seller_type": seller_type,
            "seller_name": None,
            "body_type": body_type,
            "colour": colour,
            "urgency_tags": [],
            "location_text": location_raw,
            # Pre-computed coords — bypass geocoding when present
            "_lat": lat,
            "_lng": lng,
        }
    except Exception:
        log.debug("Gumtree direct extract failed", exc_info=True)
        return None


# ── Dispatcher ────────────────────────────────────────────────────────────────

def direct_extract(source: str, html: str) -> Optional[dict]:
    if source == "autotrader":
        return extract_autotrader(html)
    if source == "gumtree":
        return extract_gumtree(html)
    return None
