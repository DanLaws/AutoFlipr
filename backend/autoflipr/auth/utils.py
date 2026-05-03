"""
JWT + password utilities.

Uses bcrypt directly (passlib has a known compat issue with bcrypt>=4.x).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from autoflipr.config import settings

_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60        # 1 hour
_REFRESH_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(
    user_id: int,
    email: str,
    plan: str,
    is_admin: bool = False,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "plan": plan,
        "is_admin": is_admin,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def create_admin_token(username: str) -> str:
    """Short-lived token for admin panel sessions (8 hours)."""
    expire = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {"sub": username, "type": "admin", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
