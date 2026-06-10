"""Authentication utilities — password hashing and JWT management."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import httpx
import jwt
from jwt import PyJWKClient

from backend.config import settings


# ---------------------------------------------------------------------------
# Apple Sign In - JWKS handling
# ---------------------------------------------------------------------------

# Cache for Apple public keys (simple in-memory cache with TTL)
_apple_jwks_cache: dict[str, Any] = {"keys": None, "expires_at": None}
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_JWKS_CACHE_DURATION = timedelta(hours=1)


async def fetch_apple_public_keys() -> dict[str, Any]:
    """Fetch and cache Apple's JWKS (JSON Web Key Set).

    Keys are cached for 1 hour to avoid repeated network requests.
    Returns the JWKS dict with 'keys' array.
    """
    now = datetime.now(UTC)

    # Return cached keys if still valid
    if (
        _apple_jwks_cache["keys"] is not None
        and _apple_jwks_cache["expires_at"] is not None
        and now < _apple_jwks_cache["expires_at"]
    ):
        return _apple_jwks_cache["keys"]

    # Fetch fresh keys from Apple
    async with httpx.AsyncClient() as client:
        response = await client.get(APPLE_JWKS_URL)
        response.raise_for_status()
        jwks = response.json()

    # Update cache
    _apple_jwks_cache["keys"] = jwks
    _apple_jwks_cache["expires_at"] = now + APPLE_JWKS_CACHE_DURATION

    return jwks


def get_apple_public_key(kid: str, jwks: dict[str, Any]) -> Any:
    """Get the public key from Apple's JWKS by key ID.

    Args:
        kid: The key ID from the JWT header
        jwks: The JWKS dict from fetch_apple_public_keys()

    Returns:
        The public key for signature verification

    Raises:
        ValueError: If the key ID is not found in the JWKS
    """
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            # Use PyJWKClient to construct the key
            jwk_client = PyJWKClient(APPLE_JWKS_URL)
            # Manually construct the key from the JWK dict
            from jwt import algorithms

            return algorithms.RSAAlgorithm.from_jwk(key)

    raise ValueError(f"Key with kid '{kid}' not found in Apple JWKS")


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
