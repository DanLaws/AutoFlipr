import httpx
from fastapi import APIRouter, HTTPException, Query

from autoflipr.api.deps import AdminUser
from autoflipr.config import settings

router = APIRouter()

DVLA_URL = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"


@router.get("/vehicle-lookup")
async def vehicle_lookup(
    _user: AdminUser,
    reg: str = Query(..., description="UK registration number"),
) -> dict:
    if not settings.dvla_api_key:
        raise HTTPException(status_code=503, detail="DVLA_API_KEY not configured")

    clean_reg = reg.replace(" ", "").upper()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            DVLA_URL,
            headers={
                "x-api-key": settings.dvla_api_key,
                "Content-Type": "application/json",
            },
            json={"registrationNumber": clean_reg},
        )

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="DVLA API error")

    data = resp.json()
    return {
        "reg": clean_reg,
        "make": data.get("make"),
        "colour": data.get("colour"),
        "year": data.get("yearOfManufacture"),
        "fuel_type": data.get("fuelType"),
        "engine_capacity": data.get("engineCapacity"),
        "mpg": None,  # DVLA does not provide fuel economy — enter manually
    }
