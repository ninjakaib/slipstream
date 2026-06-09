"""Discovery router — find nearby drivers and convoys."""

import logging
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import (
    Convoy,
    ConvoyMember,
    ConvoyStatus,
    ConvoyVisibility,
    Friendship,
    FriendshipStatus,
    User,
)
from backend.redis import get_redis

logger = logging.getLogger(__name__)

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
    # Live position data from Redis
    lat: float | None = None
    lng: float | None = None
    heading: float | None = None
    speed: float | None = None
    status: str | None = None
    road_name: str | None = None
    distance_miles: float | None = None


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
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    status_filter: str | None = Query(default=None, alias="status"),
    make_filter: str | None = Query(default=None, alias="make"),
    friends_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NearbyDriverOut]:
    """Get nearby visible drivers within the user's discovery radius.

    Uses Redis GEOSEARCH for spatial lookup, then enriches with user
    metadata from Postgres. Applies visibility and friendship filtering.
    """
    friend_ids = await _get_friend_ids(current_user.id, db)
    radius = current_user.discovery_radius_miles

    # Spatial query via Redis GEO
    r = get_redis()
    try:
        # geosearch with withdist=True returns list of [name, distance] pairs
        results = await r.geosearch(
            "positions:live",
            longitude=lng,
            latitude=lat,
            radius=radius,
            unit="mi",
            sort="ASC",
            count=200,
            withdist=True,
        )
    except Exception as e:
        # If Redis is down, fall back to returning empty (graceful degradation)
        logger.warning(f"Redis GEOSEARCH failed in discovery: {e}")
        return []

    # Parse geosearch results into (member_id, distance) pairs.
    # With withdist=True the redis library returns: list of [name, dist_str]
    user_id_str = str(current_user.id)
    nearby_entries: list[tuple[str, float]] = []
    for entry in results:
        try:
            if isinstance(entry, (list, tuple)):
                member_id = str(entry[0])
                dist = float(entry[1])
            else:
                # Fallback: some redis versions return just member names
                member_id = str(entry)
                dist = 0.0
        except (IndexError, ValueError, TypeError):
            continue
        if member_id == user_id_str:
            continue
        nearby_entries.append((member_id, dist))

    if not nearby_entries:
        return []

    # Batch-fetch position metadata via pipeline (avoid N+1 Redis calls)
    async with r.pipeline(transaction=False) as pipe:
        for member_id, _ in nearby_entries:
            pipe.hgetall(f"pos:{member_id}")
        pos_results = await pipe.execute()

    # Apply visibility filtering
    visible_entries: list[tuple[str, float, dict]] = []
    for (member_id, dist), pos_data in zip(nearby_entries, pos_results):
        if not pos_data:
            continue

        # Visibility check
        visibility = pos_data.get("visibility", "on")
        try:
            target_uuid = uuid.UUID(member_id)
        except ValueError:
            continue

        if visibility == "ghost":
            continue
        if visibility == "friends_only" and target_uuid not in friend_ids:
            continue

        # Status filter
        if status_filter and pos_data.get("status") != status_filter:
            continue

        # Friends only filter
        if friends_only and target_uuid not in friend_ids:
            continue

        visible_entries.append((member_id, dist, pos_data))

    if not visible_entries:
        return []

    # Load user profiles from Postgres
    visible_uuids = [uuid.UUID(e[0]) for e in visible_entries]
    result = await db.execute(
        select(User)
        .where(User.id.in_(visible_uuids))
        .options(selectinload(User.cars))
        .limit(limit)
    )
    users_by_id = {u.id: u for u in result.scalars().all()}

    # Build response
    drivers: list[NearbyDriverOut] = []
    for member_id, dist, pos_data in visible_entries:
        target_uuid = uuid.UUID(member_id)
        user = users_by_id.get(target_uuid)
        if user is None:
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
        if make_filter:
            if car_info and car_info.make.lower() != make_filter.lower():
                continue
            elif not car_info:
                continue

        drivers.append(
            NearbyDriverOut(
                user_id=member_id,
                username=user.username,
                display_name=user.display_name,
                avatar_url=user.avatar_url,
                active_car=car_info,
                is_friend=target_uuid in friend_ids,
                lat=float(pos_data.get("lat", 0)),
                lng=float(pos_data.get("lng", 0)),
                heading=float(pos_data.get("heading", 0)),
                speed=float(pos_data.get("speed", 0)),
                status=pos_data.get("status"),
                road_name=pos_data.get("road_name"),
                distance_miles=round(dist, 2),
            )
        )

        if len(drivers) >= limit:
            break

    return drivers


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
    # Use a correlated subquery for member count to avoid N+1 queries
    member_count_subq = (
        select(func.count(ConvoyMember.id))
        .where(ConvoyMember.convoy_id == Convoy.id)
        .correlate(Convoy)
        .scalar_subquery()
        .label("member_count")
    )

    result = await db.execute(
        select(Convoy, member_count_subq)
        .where(
            Convoy.status.in_([ConvoyStatus.FORMING, ConvoyStatus.ACTIVE]),
            Convoy.visibility == ConvoyVisibility.PUBLIC,
        )
        .options(selectinload(Convoy.leader))
        .order_by(Convoy.created_at.desc())
        .limit(limit)
    )
    rows = result.all()

    return [
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
        for convoy, member_count in rows
    ]
