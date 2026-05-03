from datetime import timedelta, datetime, timezone

import pytest
from jose import JWTError, jwt

from autoflipr.auth import utils as auth_utils

TEST_SECRET = "test-secret-not-used-in-production-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
_ALG = "HS256"


@pytest.fixture(autouse=True)
def patch_secret(monkeypatch):
    monkeypatch.setattr(auth_utils.settings, "jwt_secret", TEST_SECRET)


# ---------------------------------------------------------------------------
# create_access_token — claim structure
# ---------------------------------------------------------------------------

class TestCreateAccessToken:
    def test_returns_decodable_string(self):
        token = auth_utils.create_access_token(1, "a@b.com", "free")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert isinstance(payload, dict)

    def test_sub_is_string_user_id(self):
        token = auth_utils.create_access_token(42, "a@b.com", "free")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["sub"] == "42"

    def test_email_claim_present(self):
        token = auth_utils.create_access_token(1, "user@example.com", "free")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["email"] == "user@example.com"

    def test_plan_claim_present(self):
        token = auth_utils.create_access_token(1, "a@b.com", "pro")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["plan"] == "pro"

    def test_type_is_access(self):
        token = auth_utils.create_access_token(1, "a@b.com", "free")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["type"] == "access"

    def test_is_admin_false_by_default(self):
        token = auth_utils.create_access_token(1, "a@b.com", "free")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["is_admin"] is False

    def test_is_admin_true_when_set(self):
        token = auth_utils.create_access_token(1, "a@b.com", "free", is_admin=True)
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["is_admin"] is True

    def test_default_expiry_is_60_minutes(self):
        before = datetime.now(timezone.utc)
        token = auth_utils.create_access_token(1, "a@b.com", "free")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta = exp - before
        assert timedelta(minutes=59) <= delta <= timedelta(minutes=61)

    def test_custom_expiry_delta_respected(self):
        token = auth_utils.create_access_token(
            1, "a@b.com", "free", expires_delta=timedelta(minutes=5)
        )
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta = exp - datetime.now(timezone.utc)
        assert timedelta(minutes=4) <= delta <= timedelta(minutes=6)


# ---------------------------------------------------------------------------
# create_refresh_token — claim structure and expiry
# ---------------------------------------------------------------------------

class TestCreateRefreshToken:
    def test_type_is_refresh(self):
        token = auth_utils.create_refresh_token(7)
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["type"] == "refresh"

    def test_sub_is_string_user_id(self):
        token = auth_utils.create_refresh_token(7)
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["sub"] == "7"

    def test_expiry_is_30_days(self):
        before = datetime.now(timezone.utc)
        token = auth_utils.create_refresh_token(1)
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta = exp - before
        assert timedelta(days=29, hours=23) <= delta <= timedelta(days=30, hours=1)

    def test_no_email_or_plan_in_refresh(self):
        token = auth_utils.create_refresh_token(1)
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert "email" not in payload
        assert "plan" not in payload


# ---------------------------------------------------------------------------
# create_admin_token — claim structure and expiry
# ---------------------------------------------------------------------------

class TestCreateAdminToken:
    def test_type_is_admin(self):
        token = auth_utils.create_admin_token("alice")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["type"] == "admin"

    def test_sub_is_username(self):
        token = auth_utils.create_admin_token("alice")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        assert payload["sub"] == "alice"

    def test_expiry_is_8_hours(self):
        before = datetime.now(timezone.utc)
        token = auth_utils.create_admin_token("alice")
        payload = jwt.decode(token, TEST_SECRET, algorithms=[_ALG])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta = exp - before
        assert timedelta(hours=7, minutes=59) <= delta <= timedelta(hours=8, minutes=1)


# ---------------------------------------------------------------------------
# decode_token — valid, tampered, expired
# ---------------------------------------------------------------------------

class TestDecodeToken:
    def test_valid_token_decoded(self):
        token = auth_utils.create_access_token(1, "a@b.com", "free")
        payload = auth_utils.decode_token(token)
        assert payload["sub"] == "1"

    def test_tampered_signature_raises_jwterror(self):
        token = auth_utils.create_access_token(1, "a@b.com", "free")
        tampered = token[:-4] + "xxxx"
        with pytest.raises(JWTError):
            auth_utils.decode_token(tampered)

    def test_wrong_secret_raises_jwterror(self):
        token = jwt.encode({"sub": "1", "type": "access"}, "wrong-secret", algorithm=_ALG)
        with pytest.raises(JWTError):
            auth_utils.decode_token(token)

    def test_expired_token_raises_jwterror(self):
        token = auth_utils.create_access_token(
            1, "a@b.com", "free", expires_delta=timedelta(seconds=-1)
        )
        with pytest.raises(JWTError):
            auth_utils.decode_token(token)

    def test_garbage_string_raises_jwterror(self):
        with pytest.raises(JWTError):
            auth_utils.decode_token("not.a.jwt")
