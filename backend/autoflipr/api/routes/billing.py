"""
Stripe billing endpoints.

POST /api/billing/checkout  — create a Stripe Checkout session
POST /api/billing/portal    — create a customer portal session
POST /api/billing/webhook   — handle Stripe events (subscription changes)
"""
import stripe
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from urllib.parse import urlparse

from autoflipr.api.deps import CurrentUser, DBSession
from autoflipr.api.limiter import limiter
from autoflipr.config import settings
from autoflipr.db.models import User

router = APIRouter(prefix="/api/billing", tags=["billing"])

# Price IDs map plan → (monthly_price_id, annual_price_id)
_PLANS: dict[str, dict[str, str]] = {
    "basic": {
        "monthly": settings.stripe_price_basic_monthly,
        "annual":  settings.stripe_price_basic_annual,
    },
    "pro": {
        "monthly": settings.stripe_price_pro_monthly,
        "annual":  settings.stripe_price_pro_annual,
    },
}

_PRICE_TO_PLAN: dict[str, str] = {}  # populated lazily from settings


def _price_to_plan_map() -> dict[str, str]:
    if not _PRICE_TO_PLAN:
        for plan, ids in _PLANS.items():
            for price_id in ids.values():
                if price_id:
                    _PRICE_TO_PLAN[price_id] = plan
    return _PRICE_TO_PLAN


def _assert_same_origin(url: str, field: str) -> str:
    """Reject redirect URLs that point outside the app's own origin."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"{field} must use http or https")
    allowed_hosts = {"autoflipr.com", "www.autoflipr.com", "localhost", "127.0.0.1"}
    if parsed.hostname not in allowed_hosts:
        raise ValueError(f"{field} host '{parsed.hostname}' is not an allowed redirect destination")
    return url


class CheckoutRequest(BaseModel):
    plan: str          # "basic" | "pro"
    interval: str = "monthly"  # "monthly" | "annual"
    success_url: str
    cancel_url: str

    @field_validator("success_url", "cancel_url")
    @classmethod
    def validate_redirect_urls(cls, v: str, info) -> str:
        return _assert_same_origin(v, info.field_name)


class CheckoutResponse(BaseModel):
    url: str


class PortalRequest(BaseModel):
    return_url: str


@router.post("/checkout", response_model=CheckoutResponse)
@limiter.limit("10/minute")
def create_checkout(request: Request, body: CheckoutRequest, current_user: CurrentUser, db: DBSession):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    stripe.api_key = settings.stripe_secret_key

    plan_prices = _PLANS.get(body.plan)
    if not plan_prices:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")

    price_id = plan_prices.get(body.interval)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"No price configured for {body.plan}/{body.interval}")

    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create or reuse Stripe customer
    customer_id = user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(email=user.email)
        customer_id = customer.id
        user.stripe_customer_id = customer_id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": str(user.id), "plan": body.plan},
    )

    return CheckoutResponse(url=session.url)


@router.post("/portal", response_model=CheckoutResponse)
def create_portal(body: PortalRequest, current_user: CurrentUser, db: DBSession):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    stripe.api_key = settings.stripe_secret_key

    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user or not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=body.return_url,
    )
    return CheckoutResponse(url=session.url)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: DBSession):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        sub = event["data"]["object"]
        _handle_subscription_change(db, sub)

    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        _downgrade_user(db, sub["customer"])

    return {"status": "ok"}


def _handle_subscription_change(db, subscription: dict):
    """Map Stripe subscription → user plan."""
    customer_id = subscription["customer"]
    status_val = subscription["status"]

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    if status_val not in ("active", "trialing"):
        user.plan = "free"
        db.commit()
        return

    # Determine plan from price ID
    price_id = subscription["items"]["data"][0]["price"]["id"]
    plan = _price_to_plan_map().get(price_id, "free")
    user.plan = plan
    user.stripe_subscription_id = subscription["id"]
    db.commit()


def _downgrade_user(db, customer_id: str):
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.plan = "free"
        db.commit()
