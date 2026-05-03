"""UK postcode geocoding via api.postcodes.io (free, no API key required)."""
import re
from math import radians, sin, cos, sqrt, atan2
from typing import Optional

import httpx

_FULL_PC = re.compile(
    r'\b([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})\b', re.IGNORECASE
)
_OUTCODE = re.compile(r'\b([A-Z]{1,2}[0-9][0-9A-Z]?)\b', re.IGNORECASE)

_BASE = "https://api.postcodes.io"


def _get(url: str) -> Optional[dict]:
    try:
        r = httpx.get(url, timeout=5.0)
        if r.status_code == 200:
            return r.json().get("result")
    except Exception:
        pass
    return None


def geocode_uk_location(text: str) -> Optional[tuple[float, float]]:
    """Return (latitude, longitude) for a UK location string, or None."""
    if not text:
        return None

    # 1. Try full postcode
    m = _FULL_PC.search(text)
    if m:
        pc = m.group(1).upper().replace(" ", "")
        d = _get(f"{_BASE}/postcodes/{pc}")
        if d and d.get("latitude"):
            return float(d["latitude"]), float(d["longitude"])

    # 2. Try outward code (e.g. "SW11", "M1", "EC1A")
    m = _OUTCODE.search(text)
    if m:
        oc = m.group(1).upper()
        d = _get(f"{_BASE}/outcodes/{oc}")
        if d and d.get("latitude"):
            return float(d["latitude"]), float(d["longitude"])

    # 3. Try place name
    clean = text.strip().split(",")[0].strip()
    if clean:
        d = _get(f"{_BASE}/places?q={clean}&limit=1")
        if isinstance(d, list) and d and d[0].get("latitude"):
            return float(d[0]["latitude"]), float(d[0]["longitude"])

    return None


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in miles between two lat/lng points."""
    R = 3958.8
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))
