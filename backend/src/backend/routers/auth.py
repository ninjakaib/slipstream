"""Auth router — registration, login, token refresh, logout."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_refresh_token,
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
    # Find all non-revoked, non-expired refresh tokens
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(UTC),
        )
    )
    tokens = result.scalars().all()

    # Find matching token by verifying against stored hashes
    matched_token: RefreshToken | None = None
    for token_record in tokens:
        if verify_refresh_token(body.refresh_token, token_record.token_hash):
            matched_token = token_record
            break

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
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked.is_(False),
        )
    )
    tokens = result.scalars().all()

    for token_record in tokens:
        if verify_refresh_token(body.refresh_token, token_record.token_hash):
            token_record.revoked = True
            break

    return MessageResponse(message="Logged out successfully")
