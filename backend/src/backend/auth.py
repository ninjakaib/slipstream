"""Authentication utilities — password hashing and JWT management."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from backend.config import settings


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Refresh token generation & hashing
# ---------------------------------------------------------------------------


def generate_refresh_token() -> str:
    """Generate a cryptographically secure random refresh token."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token using SHA-256 for fast indexed lookup.

    Refresh tokens are already high-entropy (64 bytes from secrets.token_urlsafe),
    so they don't need slow hashing like passwords — they need fast, deterministic
    hashing for direct database lookup.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def verify_refresh_token(token: str, hashed: str) -> bool:
    """Verify a refresh token against its stored SHA-256 hash."""
    return hashlib.sha256(token.encode()).hexdigest() == hashed


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------


def create_access_token(user_id: uuid.UUID, username: str) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token.

    Raises jwt.InvalidTokenError on failure.
    """
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload
