"""Friends router — friend requests, list, removal."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from slipstream.database import get_db
from slipstream.dependencies import get_current_user
from slipstream.models import Friendship, FriendshipStatus, User

router = APIRouter(prefix="/friends", tags=["friends"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class FriendCarSummary(BaseModel):
    id: str
    year: int
    make: str
    model: str
    trim: str | None = None
    color: str

    model_config = {"from_attributes": True}


class FriendProfile(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    active_car: FriendCarSummary | None = None

    model_config = {"from_attributes": True}


class FriendRequestOut(BaseModel):
    request_id: str
    from_user: FriendProfile
    created_at: str

    model_config = {"from_attributes": True}


class FriendRequestCreate(BaseModel):
    user_id: uuid.UUID


class FriendRequestAction(BaseModel):
    request_id: uuid.UUID


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_active_car_summary(user: User) -> FriendCarSummary | None:
    """Get the active car summary for a user (requires cars to be loaded)."""
    for car in user.cars:
        if car.is_active:
            return FriendCarSummary(
                id=str(car.id),
                year=car.year,
                make=car.make,
                model=car.model,
                trim=car.trim,
                color=car.color,
            )
    return None


def _user_to_friend_profile(user: User) -> FriendProfile:
    return FriendProfile(
        id=str(user.id),
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        active_car=_get_active_car_summary(user),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=list[FriendProfile])
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FriendProfile]:
    """List all accepted friends."""
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            ),
        )
    )
    friendships = result.scalars().all()

    # Collect friend user IDs
    friend_ids: list[uuid.UUID] = []
    for f in friendships:
        if f.requester_id == current_user.id:
            friend_ids.append(f.addressee_id)
        else:
            friend_ids.append(f.requester_id)

    if not friend_ids:
        return []

    # Load friend profiles with cars
    result = await db.execute(
        select(User).where(User.id.in_(friend_ids)).options(selectinload(User.cars))
    )
    friends = result.scalars().all()

    return [_user_to_friend_profile(u) for u in friends]


@router.get("/requests", response_model=list[FriendRequestOut])
async def list_friend_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FriendRequestOut]:
    """List pending incoming friend requests."""
    result = await db.execute(
        select(Friendship)
        .where(
            Friendship.addressee_id == current_user.id,
            Friendship.status == FriendshipStatus.PENDING,
        )
        .order_by(Friendship.created_at.desc())
    )
    requests = result.scalars().all()

    if not requests:
        return []

    # Load requester profiles
    requester_ids = [r.requester_id for r in requests]
    result = await db.execute(
        select(User).where(User.id.in_(requester_ids)).options(selectinload(User.cars))
    )
    users_by_id = {u.id: u for u in result.scalars().all()}

    out: list[FriendRequestOut] = []
    for req in requests:
        user = users_by_id.get(req.requester_id)
        if user is None:
            continue
        out.append(
            FriendRequestOut(
                request_id=str(req.id),
                from_user=_user_to_friend_profile(user),
                created_at=req.created_at.isoformat(),
            )
        )

    return out


@router.post(
    "/request", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def send_friend_request(
    body: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Send a friend request to another user."""
    target_id = body.user_id

    if target_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send a friend request to yourself",
        )

    # Check target exists
    result = await db.execute(select(User).where(User.id == target_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if friendship already exists (in either direction)
    result = await db.execute(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == current_user.id)
                & (Friendship.addressee_id == target_id),
                (Friendship.requester_id == target_id)
                & (Friendship.addressee_id == current_user.id),
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        if existing.status == FriendshipStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Already friends",
            )
        if existing.status == FriendshipStatus.PENDING:
            # If they already sent us a request, auto-accept
            if existing.requester_id == target_id:
                existing.status = FriendshipStatus.ACCEPTED
                existing.accepted_at = datetime.now(UTC)
                return MessageResponse(
                    message="Friend request accepted (they already sent you one)"
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Friend request already pending",
            )

    # Create new request
    friendship = Friendship(
        requester_id=current_user.id,
        addressee_id=target_id,
        status=FriendshipStatus.PENDING,
    )
    db.add(friendship)

    # TODO: Send real-time notification when notification system is implemented

    return MessageResponse(message="Friend request sent")


@router.post("/accept", response_model=MessageResponse)
async def accept_friend_request(
    body: FriendRequestAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Accept an incoming friend request."""
    request_id = body.request_id

    result = await db.execute(
        select(Friendship).where(
            Friendship.id == request_id,
            Friendship.addressee_id == current_user.id,
            Friendship.status == FriendshipStatus.PENDING,
        )
    )
    friendship = result.scalar_one_or_none()

    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found",
        )

    friendship.status = FriendshipStatus.ACCEPTED
    friendship.accepted_at = datetime.now(UTC)

    # TODO: Send real-time notification when notification system is implemented

    return MessageResponse(message="Friend request accepted")


@router.post("/decline", response_model=MessageResponse)
async def decline_friend_request(
    body: FriendRequestAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Decline an incoming friend request."""
    request_id = body.request_id

    result = await db.execute(
        select(Friendship).where(
            Friendship.id == request_id,
            Friendship.addressee_id == current_user.id,
            Friendship.status == FriendshipStatus.PENDING,
        )
    )
    friendship = result.scalar_one_or_none()

    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found",
        )

    await db.delete(friendship)

    return MessageResponse(message="Friend request declined")


@router.delete("/{user_id}", response_model=MessageResponse)
async def remove_friend(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Remove a friend (unfriend)."""
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            or_(
                (Friendship.requester_id == current_user.id)
                & (Friendship.addressee_id == user_id),
                (Friendship.requester_id == user_id)
                & (Friendship.addressee_id == current_user.id),
            ),
        )
    )
    friendship = result.scalar_one_or_none()

    if friendship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found",
        )

    await db.delete(friendship)

    return MessageResponse(message="Friend removed")
