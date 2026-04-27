"""
JWT + password utilities.

Uses bcrypt directly (passlib has a known compat issue with bcrypt>=4.x).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from carflip.config import settings

_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days


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
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
