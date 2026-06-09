"""Discovery router — find nearby drivers and convoys."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import (
    Car,
    Convoy,
    ConvoyMember,
    ConvoyStatus,
    ConvoyVisibility,
    Friendship,
    FriendshipStatus,
    User,
    VisibilityMode,
)

router = APIRouter(prefix="/discovery", tags=["discovery"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class DiscoveryCarInfo(BaseModel):
    year: int
    make: str
    model: str
    trim: str | None = None
    color: str


class NearbyDriverOut(BaseModel):
    user_id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    active_car: DiscoveryCarInfo | None = None
    is_friend: bool
    # Position will come from Redis in the real implementation.
    # For now, this endpoint returns the list of visible users
    # and the WebSocket handles live positions.


class NearbyConvoyOut(BaseModel):
    id: str
    name: str
    leader_username: str
    visibility: ConvoyVisibility
    status: ConvoyStatus
    destination_name: str | None = None
    member_count: int
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_friend_ids(user_id: uuid.UUID, db: AsyncSession) -> set[uuid.UUID]:
    """Get all friend user IDs for a user."""
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            or_(
                Friendship.requester_id == user_id,
                Friendship.addressee_id == user_id,
            ),
        )
    )
    friendships = result.scalars().all()

    friend_ids: set[uuid.UUID] = set()
    for f in friendships:
        if f.requester_id == user_id:
            friend_ids.add(f.addressee_id)
        else:
            friend_ids.add(f.requester_id)

    return friend_ids


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/nearby", response_model=list[NearbyDriverOut])
async def get_nearby_drivers(
    status_filter: str | None = Query(default=None, alias="status"),
    make_filter: str | None = Query(default=None, alias="make"),
    friends_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NearbyDriverOut]:
    """Get nearby visible drivers.

    In the full implementation, this will use Redis GEO to find users
    within the caller's discovery radius. For now, it returns all users
    that would be visible based on visibility/friendship rules.

    Live positions are delivered via WebSocket, not this endpoint.
    This endpoint provides the user metadata for rendering markers.
    """
    friend_ids = await _get_friend_ids(current_user.id, db)

    # Base query: all users except self
    query = (
        select(User)
        .where(User.id != current_user.id)
        .options(selectinload(User.cars))
    )

    # Apply friends_only filter
    if friends_only:
        if not friend_ids:
            return []
        query = query.where(User.id.in_(friend_ids))

    result = await db.execute(query.limit(limit))
    users = result.scalars().all()

    # Filter by visibility rules
    visible_drivers: list[NearbyDriverOut] = []
    for user in users:
        # Visibility check
        if user.visibility == VisibilityMode.GHOST:
            continue
        if user.visibility == VisibilityMode.FRIENDS_ONLY:
            if user.id not in friend_ids:
                continue

        # Get active car
        active_car = next((c for c in user.cars if c.is_active), None)
        car_info: DiscoveryCarInfo | None = None
        if active_car:
            car_info = DiscoveryCarInfo(
                year=active_car.year,
                make=active_car.make,
                model=active_car.model,
                trim=active_car.trim,
                color=active_car.color,
            )

        # Apply make filter
        if make_filter and car_info:
            if car_info.make.lower() != make_filter.lower():
                continue
        elif make_filter and not car_info:
            continue

        visible_drivers.append(
            NearbyDriverOut(
                user_id=str(user.id),
                username=user.username,
                display_name=user.display_name,
                avatar_url=user.avatar_url,
                active_car=car_info,
                is_friend=user.id in friend_ids,
            )
        )

    return visible_drivers


@router.get("/convoys", response_model=list[NearbyConvoyOut])
async def get_nearby_convoys(
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NearbyConvoyOut]:
    """Get active/forming public convoys nearby.

    In the full implementation, this will use spatial queries
    based on convoy member positions from Redis.
    For now, returns all non-ended public convoys.
    """
    result = await db.execute(
        select(Convoy)
        .where(
            Convoy.status.in_([ConvoyStatus.FORMING, ConvoyStatus.ACTIVE]),
            Convoy.visibility == ConvoyVisibility.PUBLIC,
        )
        .options(selectinload(Convoy.leader))
        .order_by(Convoy.created_at.desc())
        .limit(limit)
    )
    convoys = result.scalars().all()

    # Get member counts
    out: list[NearbyConvoyOut] = []
    for convoy in convoys:
        member_result = await db.execute(
            select(ConvoyMember).where(ConvoyMember.convoy_id == convoy.id)
        )
        member_count = len(member_result.scalars().all())

        out.append(
            NearbyConvoyOut(
                id=str(convoy.id),
                name=convoy.name,
                leader_username=convoy.leader.username,
                visibility=convoy.visibility,
                status=convoy.status,
                destination_name=convoy.destination_name,
                member_count=member_count,
                created_at=convoy.created_at.isoformat(),
            )
        )

    return out
