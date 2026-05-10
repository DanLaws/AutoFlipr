"""
Integration tests for POST /api/billing/webhook.

Strategy: use an in-memory SQLite database and a real FastAPI TestClient so the
full route → dependency injection → ORM flow is exercised.  The only thing we
mock is stripe.Webhook.construct_event so we don't need real Stripe keys.
"""
import json
import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from autoflipr.db.models import User
from autoflipr.db.session import get_db
from autoflipr.main import app

# ---------------------------------------------------------------------------
# In-memory DB fixtures
# Only create the User table — other models use PostgreSQL-specific types
# (e.g. ARRAY) that SQLite can't render.
# ---------------------------------------------------------------------------

@pytest.fixture()
def engine():
    # StaticPool forces a single connection so create_table and the session share the same in-memory DB
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    SessionLocal = sessionmaker(bind=engine)
    session: Session = SessionLocal()
    yield session
    session.rollback()
    session.close()


@pytest.fixture()
def client(db):
    """TestClient wired to the in-memory DB session."""
    def override_get_db():
        try:
            yield db
        finally:
            pass  # lifecycle managed by the fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_WEBHOOK_SECRET = "whsec_test"
FAKE_STRIPE_SECRET  = "sk_test_fake"
PRICE_PRO_MONTHLY   = "price_pro_monthly_test"
PRICE_BASIC_MONTHLY = "price_basic_monthly_test"


def _patch_settings(monkeypatch):
    """Patch stripe config values on the billing module's settings reference."""
    from autoflipr.api.routes import billing
    monkeypatch.setattr(billing.settings, "stripe_secret_key",    FAKE_STRIPE_SECRET)
    monkeypatch.setattr(billing.settings, "stripe_webhook_secret", FAKE_WEBHOOK_SECRET)
    # _PLANS is built at import time from settings, so patch it directly with test price IDs
    monkeypatch.setattr(billing, "_PLANS", {
        "basic": {"monthly": PRICE_BASIC_MONTHLY, "annual": ""},
        "pro":   {"monthly": PRICE_PRO_MONTHLY,   "annual": ""},
    })
    # Clear the lazy cache so it repopulates from the patched _PLANS
    billing._PRICE_TO_PLAN.clear()


def _make_subscription_event(event_type: str, customer_id: str, price_id: str,
                               sub_status: str = "active", sub_id: str = "sub_123") -> dict:
    return {
        "type": event_type,
        "data": {
            "object": {
                "id": sub_id,
                "customer": customer_id,
                "status": sub_status,
                "items": {"data": [{"price": {"id": price_id}}]},
            }
        },
    }


def _make_deleted_event(customer_id: str) -> dict:
    return {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_123",
                "customer": customer_id,
                "status": "canceled",
                "items": {"data": []},
            }
        },
    }


def _post_webhook(client, event: dict):
    payload = json.dumps(event).encode()
    with patch("stripe.Webhook.construct_event", return_value=event):
        return client.post(
            "/api/billing/webhook",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": "t=1,v1=fake",
            },
        )


# ---------------------------------------------------------------------------
# Tests: signature verification
# ---------------------------------------------------------------------------

class TestWebhookSignature:
    def test_missing_stripe_secret_returns_503(self, client, db, monkeypatch):
        from autoflipr.api.routes import billing
        monkeypatch.setattr(billing.settings, "stripe_secret_key", "")
        res = client.post("/api/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
        assert res.status_code == 503

    def test_missing_webhook_secret_returns_503(self, client, db, monkeypatch):
        from autoflipr.api.routes import billing
        monkeypatch.setattr(billing.settings, "stripe_secret_key", FAKE_STRIPE_SECRET)
        monkeypatch.setattr(billing.settings, "stripe_webhook_secret", "")
        res = client.post("/api/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
        assert res.status_code == 503

    def test_invalid_signature_returns_400(self, client, db, monkeypatch):
        _patch_settings(monkeypatch)
        import stripe
        with patch("stripe.Webhook.construct_event", side_effect=stripe.error.SignatureVerificationError("bad", "sig")):
            res = client.post(
                "/api/billing/webhook",
                content=b"{}",
                headers={"Content-Type": "application/json", "stripe-signature": "bad"},
            )
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# Tests: subscription.created / updated → upgrade user plan
# ---------------------------------------------------------------------------

class TestSubscriptionCreatedUpdated:
    _uid = 0

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        _patch_settings(monkeypatch)

    def _make_user(self, db, customer_id: str, plan: str = "free") -> User:
        TestSubscriptionCreatedUpdated._uid += 1
        user = User(id=TestSubscriptionCreatedUpdated._uid,
                    email=f"{customer_id}@example.com", password_hash="x",
                    stripe_customer_id=customer_id, plan=plan)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def test_subscription_created_upgrades_to_pro(self, client, db):
        user = self._make_user(db, "cus_pro1")
        event = _make_subscription_event("customer.subscription.created", "cus_pro1", PRICE_PRO_MONTHLY)
        res = _post_webhook(client, event)
        assert res.status_code == 200
        db.refresh(user)
        assert user.plan == "pro"

    def test_subscription_updated_upgrades_to_basic(self, client, db):
        user = self._make_user(db, "cus_basic1")
        event = _make_subscription_event("customer.subscription.updated", "cus_basic1", PRICE_BASIC_MONTHLY)
        res = _post_webhook(client, event)
        assert res.status_code == 200
        db.refresh(user)
        assert user.plan == "basic"

    def test_subscription_id_stored(self, client, db):
        user = self._make_user(db, "cus_subid")
        event = _make_subscription_event("customer.subscription.created", "cus_subid",
                                          PRICE_PRO_MONTHLY, sub_id="sub_abc")
        _post_webhook(client, event)
        db.refresh(user)
        assert user.stripe_subscription_id == "sub_abc"

    def test_inactive_subscription_downgrades_to_free(self, client, db):
        user = self._make_user(db, "cus_past_due", plan="pro")
        event = _make_subscription_event("customer.subscription.updated", "cus_past_due",
                                          PRICE_PRO_MONTHLY, sub_status="past_due")
        res = _post_webhook(client, event)
        assert res.status_code == 200
        db.refresh(user)
        assert user.plan == "free"

    def test_trialing_subscription_grants_plan(self, client, db):
        user = self._make_user(db, "cus_trial")
        event = _make_subscription_event("customer.subscription.created", "cus_trial",
                                          PRICE_PRO_MONTHLY, sub_status="trialing")
        _post_webhook(client, event)
        db.refresh(user)
        assert user.plan == "pro"

    def test_unknown_customer_handled_gracefully(self, client, db):
        event = _make_subscription_event("customer.subscription.created", "cus_unknown_xyz",
                                          PRICE_PRO_MONTHLY)
        res = _post_webhook(client, event)
        # Should not raise — just a no-op
        assert res.status_code == 200

    def test_unknown_price_id_falls_back_to_free(self, client, db):
        user = self._make_user(db, "cus_badprice", plan="pro")
        event = _make_subscription_event("customer.subscription.updated", "cus_badprice",
                                          "price_does_not_exist")
        _post_webhook(client, event)
        db.refresh(user)
        assert user.plan == "free"


# ---------------------------------------------------------------------------
# Tests: subscription.deleted → downgrade
# ---------------------------------------------------------------------------

class TestSubscriptionDeleted:
    _uid = 1000

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        _patch_settings(monkeypatch)

    def _make_pro_user(self, db, customer_id: str) -> User:
        TestSubscriptionDeleted._uid += 1
        user = User(id=TestSubscriptionDeleted._uid,
                    email=f"{customer_id}@example.com", password_hash="x",
                    stripe_customer_id=customer_id, plan="pro",
                    stripe_subscription_id="sub_old")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def test_deletion_downgrades_plan_to_free(self, client, db):
        user = self._make_pro_user(db, "cus_del1")
        res = _post_webhook(client, _make_deleted_event("cus_del1"))
        assert res.status_code == 200
        db.refresh(user)
        assert user.plan == "free"

    def test_deletion_unknown_customer_is_no_op(self, client, db):
        res = _post_webhook(client, _make_deleted_event("cus_ghost_xyz"))
        assert res.status_code == 200

    def test_response_body_is_ok(self, client, db):
        self._make_pro_user(db, "cus_body_check")
        res = _post_webhook(client, _make_deleted_event("cus_body_check"))
        assert res.json() == {"status": "ok"}
