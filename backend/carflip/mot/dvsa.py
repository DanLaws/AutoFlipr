import logging
from datetime import date
from typing import Optional

import httpx

from carflip.config import settings

log = logging.getLogger(__name__)

_TOKEN_URL = "https://login.microsoftonline.com/a455b827-244d-4b47-b0b1-f9f93c46f071/oauth2/v2.0/token"
_MOT_SCOPE = "https://tapi.dvsa.gov.uk/.default"

_token_cache: dict = {}


def _get_access_token() -> str:
    import time

    now = time.time()
    if _token_cache.get("expires_at", 0) > now + 60:
        return _token_cache["access_token"]

    resp = httpx.post(
        _TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": settings.dvsa_client_id,
            "client_secret": settings.dvsa_client_secret,
            "scope": _MOT_SCOPE,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_in", 3600)
    return _token_cache["access_token"]


def fetch_mot_history(registration: str) -> list[dict]:
    """
    Fetch MOT history from DVSA API.
    Returns list of test records sorted most-recent-first.
    Raises httpx.HTTPStatusError on API errors.
    """
    reg = registration.upper().replace(" ", "")
    token = _get_access_token()

    resp = httpx.get(
        f"{settings.dvsa_api_url}/v1/trade/vehicles/registration/{reg}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json+v6",
        },
        timeout=15,
    )

    if resp.status_code == 404:
        return []  # no history on record
    resp.raise_for_status()

    data = resp.json()
    records = []

    for test in data.get("motTests", []):
        records.append({
            "test_date": test.get("completedDate", "")[:10],
            "test_result": test.get("testResult"),
            "odometer": _parse_odometer(test),
            "odometer_unit": test.get("odometerUnit", "mi"),
            "expiry_date": test.get("expiryDate", "")[:10] or None,
            "advisories": [
                item["text"]
                for item in test.get("rfrAndComments", [])
                if item.get("type") == "ADVISORY"
            ],
            "failures": [
                item["text"]
                for item in test.get("rfrAndComments", [])
                if item.get("type") in ("FAIL", "PRS")
            ],
        })

    records.sort(key=lambda r: r["test_date"], reverse=True)
    return records


def _parse_odometer(test: dict) -> Optional[int]:
    val = test.get("odometerValue")
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None
