"""Auth router — registration, login, token refresh, logout."""

from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import (
    create_access_token,
    fetch_apple_public_keys,
    generate_refresh_token,
    get_apple_public_key,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from backend.config import settings
from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import RefreshToken, User

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)
    email: str | None = None
    display_name: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class MessageResponse(BaseModel):
    message: str


class FullName(BaseModel):
    """Name components from Apple Sign In."""

    given_name: str | None = None
    family_name: str | None = None


class AppleAuthRequest(BaseModel):
    """Request body for Apple Sign In."""

    identity_token: str
    full_name: FullName | None = None
    email: str | None = None


class AppleAuthResponse(BaseModel):
    """Response for Apple Sign In, extends TokenResponse with is_new_user flag."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    is_new_user: bool


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    body: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Create a new user account and return tokens."""
    # Check if username is taken
    existing = await db.execute(
        select(User).where(User.username == body.username.lower())
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    # Create user
    user = User(
        username=body.username.lower(),
        password_hash=hash_password(body.password),
        email=body.email,
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()  # Assigns user.id

    # Generate tokens
    access_token = create_access_token(user.id, user.username)
    raw_refresh_token = generate_refresh_token()

    # Store refresh token hash
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_record)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        user_id=str(user.id),
        username=user.username,
    )


@router.post("/apple", response_model=AppleAuthResponse)
async def auth_with_apple(
    body: AppleAuthRequest, db: AsyncSession = Depends(get_db)
) -> AppleAuthResponse:
    """Exchange Apple identity token for SlipStream tokens.

    This endpoint:
    1. Fetches Apple's JWKS (cached for 1 hour)
    2. Validates the identity token signature and claims
    3. Finds or creates a user by apple_id
    4. Issues access and refresh tokens
    5. Returns is_new_user=true for first-time users
    """
    try:
        # Decode JWT header to get kid (key ID) without verification first
        unverified_header = jwt.get_unverified_header(body.identity_token)
        kid = unverified_header.get("kid")

        if not kid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Identity token missing key ID (kid)",
            )

        # Fetch Apple's public keys
        jwks = await fetch_apple_public_keys()

        # Get the public key matching the kid
        try:
            public_key = get_apple_public_key(kid, jwks)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
            )

        # Verify and decode the identity token
        payload = jwt.decode(
            body.identity_token,
            public_key,
            algorithms=["RS256"],
            audience=settings.apple_bundle_id,
            issuer="https://appleid.apple.com",
        )

        # Extract Apple user ID (sub claim)
        apple_user_id = payload.get("sub")
        if not apple_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Identity token missing subject (sub)",
            )

        # Check if user already exists with this apple_id
        result = await db.execute(
            select(User).where(User.apple_id == apple_user_id)
        )
        user = result.scalar_one_or_none()
        is_new_user = user is None

        if is_new_user:
            # Create new user
            # Generate a temporary username from apple_id (user will set their own in onboarding)
            temp_username = f"user_{apple_user_id[:8].lower()}"

            # Ensure username is unique by appending random suffix if needed
            existing = await db.execute(
                select(User).where(User.username == temp_username)
            )
            if existing.scalar_one_or_none() is not None:
                import secrets

                temp_username = f"user_{secrets.token_hex(4)}"

            # Build display name from full_name if provided
            display_name = None
            if body.full_name:
                name_parts = []
                if body.full_name.given_name:
                    name_parts.append(body.full_name.given_name)
                if body.full_name.family_name:
                    name_parts.append(body.full_name.family_name)
                if name_parts:
                    display_name = " ".join(name_parts)

            # Use email from request body (Apple only provides on first sign-in)
            # or fall back to email from token payload
            email = body.email or payload.get("email")

            user = User(
                apple_id=apple_user_id,
                username=temp_username,
                email=email,
                display_name=display_name,
                password_hash=None,  # Apple auth users don't have passwords
            )
            db.add(user)
            await db.flush()  # Assigns user.id

        # Generate tokens
        access_token = create_access_token(user.id, user.username)
        raw_refresh_token = generate_refresh_token()

        # Store refresh token hash
        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.refresh_token_expire_days),
        )
        db.add(refresh_record)

        return AppleAuthResponse(
            access_token=access_token,
            refresh_token=raw_refresh_token,
            user_id=str(user.id),
            username=user.username,
            is_new_user=is_new_user,
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identity token has expired",
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identity token audience does not match",
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identity token issuer is invalid",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid identity token: {str(e)}",
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Authenticate with username and password, return tokens."""
    result = await db.execute(
        select(User).where(User.username == body.username.lower())
    )
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Generate tokens
    access_token = create_access_token(user.id, user.username)
    raw_refresh_token = generate_refresh_token()

    # Store refresh token hash
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_record)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        user_id=str(user.id),
        username=user.username,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Exchange a valid refresh token for new access + refresh tokens.

    This implements token rotation — the old refresh token is revoked
    and a new one is issued.
    """
    # Direct lookup by SHA-256 hash — O(1) indexed query
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(UTC),
        )
    )
    matched_token = result.scalar_one_or_none()

    if matched_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Revoke old token (rotation)
    matched_token.revoked = True

    # Load the user
    result = await db.execute(select(User).where(User.id == matched_token.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Issue new tokens
    access_token = create_access_token(user.id, user.username)
    raw_refresh_token = generate_refresh_token()

    new_refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(new_refresh_record)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        user_id=str(user.id),
        username=user.username,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    """Revoke the provided refresh token (sign out)."""
    # Direct lookup by hash — O(1) instead of iterating all user tokens
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
        )
    )
    token_record = result.scalar_one_or_none()

    if token_record is not None:
        token_record.revoked = True

    return MessageResponse(message="Logged out successfully")
