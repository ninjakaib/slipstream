"""Users router — profile management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Car, User, VisibilityMode, SpeedUnit
from backend.realtime.events import remove_user_presence, set_user_visibility_in_redis

router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CarSummary(BaseModel):
    id: str
    year: int
    make: str
    model: str
    trim: str | None = None
    color: str
    is_active: bool

    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    visibility: VisibilityMode
    discovery_radius_miles: int
    speed_unit: SpeedUnit
    active_car: CarSummary | None = None

    model_config = {"from_attributes": True}


class PublicUserProfile(BaseModel):
    """Profile visible to other users."""

    id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    active_car: CarSummary | None = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    username: str | None = Field(
        default=None, min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$"
    )
    display_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = None
    visibility: VisibilityMode | None = None
    discovery_radius_miles: int | None = Field(default=None, ge=1, le=100)
    speed_unit: SpeedUnit | None = None


class UserSearchResult(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    active_car: CarSummary | None = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_active_car(user: User) -> CarSummary | None:
    """Extract the active car summary from a loaded user."""
    for car in user.cars:
        if car.is_active:
            return CarSummary(
                id=str(car.id),
                year=car.year,
                make=car.make,
                model=car.model,
                trim=car.trim,
                color=car.color,
                is_active=car.is_active,
            )
    return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserProfile)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """Get the current user's full profile."""
    # Reload with cars eagerly loaded
    result = await db.execute(
        select(User).where(User.id == current_user.id).options(selectinload(User.cars))
    )
    user = result.scalar_one()

    return UserProfile(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        visibility=user.visibility,
        discovery_radius_miles=user.discovery_radius_miles,
        speed_unit=user.speed_unit,
        active_car=_get_active_car(user),
    )


@router.patch("/me", response_model=UserProfile)
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """Update the current user's profile fields."""
    # Check username uniqueness if changing
    if body.username is not None and body.username.lower() != current_user.username:
        existing = await db.execute(
            select(User).where(User.username == body.username.lower())
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )

    # Apply updates
    update_data = body.model_dump(exclude_unset=True)
    if "username" in update_data and update_data["username"] is not None:
        update_data["username"] = update_data["username"].lower()

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.flush()

    # If visibility changed, update Redis
    if "visibility" in update_data:
        await set_user_visibility_in_redis(
            current_user.id, update_data["visibility"].value
        )

    # Reload with cars
    result = await db.execute(
        select(User).where(User.id == current_user.id).options(selectinload(User.cars))
    )
    user = result.scalar_one()

    return UserProfile(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        visibility=user.visibility,
        discovery_radius_miles=user.discovery_radius_miles,
        speed_unit=user.speed_unit,
        active_car=_get_active_car(user),
    )


@router.get("/search", response_model=list[UserSearchResult])
async def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserSearchResult]:
    """Search users by username (prefix match)."""
    if len(q) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query must be at least 2 characters",
        )

    result = await db.execute(
        select(User)
        .where(
            User.username.ilike(f"{q.lower()}%"),
            User.id != current_user.id,
        )
        .options(selectinload(User.cars))
        .limit(20)
    )
    users = result.scalars().all()

    return [
        UserSearchResult(
            id=str(u.id),
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            active_car=_get_active_car(u),
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=PublicUserProfile)
async def get_user_profile(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublicUserProfile:
    """Get another user's public profile."""
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.cars))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return PublicUserProfile(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        active_car=_get_active_car(user),
    )


@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Delete the current user's account and all associated data."""
    # Remove real-time presence data
    await remove_user_presence(current_user.id)

    await db.delete(current_user)
    return MessageResponse(message="Account deleted")
