"""Convoys router — create, join, manage, chat, routes."""

import uuid
from datetime import UTC, datetime

from geoalchemy2.functions import ST_X, ST_Y
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import (
    Car,
    Convoy,
    ConvoyJoinRequest,
    ConvoyMember,
    ConvoyMemberRole,
    ConvoyMessage,
    ConvoyRoute,
    ConvoyStatus,
    ConvoyVisibility,
    Friendship,
    FriendshipStatus,
    JoinRequestStatus,
    MessageType,
    User,
)
from backend.realtime.events import (
    publish_convoy_chat,
    publish_convoy_event,
    publish_notification,
)

router = APIRouter(prefix="/convoys", tags=["convoys"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateConvoyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50, default="Open Cruise")
    visibility: ConvoyVisibility = ConvoyVisibility.PUBLIC
    destination_name: str | None = None
    destination_lat: float | None = Field(default=None, ge=-90, le=90)
    destination_lng: float | None = Field(default=None, ge=-180, le=180)


class UpdateConvoyRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    visibility: ConvoyVisibility | None = None


class ConvoyMemberOut(BaseModel):
    user_id: str
    username: str
    display_name: str | None = None
    avatar_url: str | None = None
    role: ConvoyMemberRole
    car_year: int | None = None
    car_make: str | None = None
    car_model: str | None = None
    car_color: str | None = None
    joined_at: str


class ConvoyResponse(BaseModel):
    id: str
    name: str
    leader_id: str
    visibility: ConvoyVisibility
    status: ConvoyStatus
    destination_name: str | None = None
    member_count: int
    members: list[ConvoyMemberOut] | None = None
    created_at: str


class ConvoyListItem(BaseModel):
    id: str
    name: str
    leader_username: str
    visibility: ConvoyVisibility
    status: ConvoyStatus
    destination_name: str | None = None
    member_count: int
    created_at: str


class InviteRequest(BaseModel):
    user_id: uuid.UUID


class KickRequest(BaseModel):
    user_id: uuid.UUID


class Waypoint(BaseModel):
    """A single waypoint along a route."""

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    name: str | None = None
    order: int | None = None


class SetRouteRequest(BaseModel):
    destination_name: str = Field(min_length=1, max_length=200)
    destination_lat: float = Field(ge=-90, le=90)
    destination_lng: float = Field(ge=-180, le=180)
    waypoints: list[Waypoint] | None = None


class RouteResponse(BaseModel):
    id: str
    destination_name: str
    destination_lat: float
    destination_lng: float
    set_by_username: str
    waypoints: list[Waypoint] | None = None
    is_active: bool
    created_at: str


class ConvoyMessageOut(BaseModel):
    id: str
    sender_id: str | None = None
    sender_username: str | None = None
    content: str
    message_type: MessageType
    created_at: str


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class QuickActionRequest(BaseModel):
    action: str = Field(pattern=r"^(pull_over|gas_stop|slow_down|regrouping)$")


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_convoy_or_404(convoy_id: uuid.UUID, db: AsyncSession) -> Convoy:
    """Fetch a convoy or raise 404."""
    result = await db.execute(select(Convoy).where(Convoy.id == convoy_id))
    convoy = result.scalar_one_or_none()
    if convoy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convoy not found",
        )
    return convoy


async def _get_membership(
    convoy_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> ConvoyMember | None:
    """Check if user is a member of the convoy."""
    result = await db.execute(
        select(ConvoyMember).where(
            ConvoyMember.convoy_id == convoy_id,
            ConvoyMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _require_membership(
    convoy_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> ConvoyMember:
    """Require user to be a convoy member or raise 403."""
    member = await _get_membership(convoy_id, user_id, db)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this convoy",
        )
    return member


async def _are_friends(user_a: uuid.UUID, user_b: uuid.UUID, db: AsyncSession) -> bool:
    """Check if two users are friends."""
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            or_(
                (Friendship.requester_id == user_a)
                & (Friendship.addressee_id == user_b),
                (Friendship.requester_id == user_b)
                & (Friendship.addressee_id == user_a),
            ),
        )
    )
    return result.scalar_one_or_none() is not None


async def _add_system_message(
    convoy_id: uuid.UUID,
    content: str,
    db: AsyncSession,
    message_type: MessageType = MessageType.SYSTEM,
) -> None:
    """Insert a system message into the convoy chat."""
    msg = ConvoyMessage(
        convoy_id=convoy_id,
        sender_id=None,
        content=content,
        message_type=message_type,
    )
    db.add(msg)


async def _build_convoy_response(
    convoy: Convoy, db: AsyncSession, include_members: bool = True
) -> ConvoyResponse:
    """Build a full convoy response with member details."""
    result = await db.execute(
        select(ConvoyMember)
        .where(ConvoyMember.convoy_id == convoy.id)
        .options(selectinload(ConvoyMember.user).selectinload(User.cars))
    )
    members = result.scalars().all()

    member_list: list[ConvoyMemberOut] | None = None
    if include_members:
        member_list = []
        for m in members:
            active_car = next((c for c in m.user.cars if c.is_active), None)
            member_list.append(
                ConvoyMemberOut(
                    user_id=str(m.user_id),
                    username=m.user.username,
                    display_name=m.user.display_name,
                    avatar_url=m.user.avatar_url,
                    role=m.role,
                    car_year=active_car.year if active_car else None,
                    car_make=active_car.make if active_car else None,
                    car_model=active_car.model if active_car else None,
                    car_color=active_car.color if active_car else None,
                    joined_at=m.joined_at.isoformat(),
                )
            )

    return ConvoyResponse(
        id=str(convoy.id),
        name=convoy.name,
        leader_id=str(convoy.leader_id),
        visibility=convoy.visibility,
        status=convoy.status,
        destination_name=convoy.destination_name,
        member_count=len(members),
        members=member_list,
        created_at=convoy.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=ConvoyResponse, status_code=status.HTTP_201_CREATED)
async def create_convoy(
    body: CreateConvoyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConvoyResponse:
    """Create a new convoy. The creator becomes the leader."""
    # Check user isn't already in a convoy
    result = await db.execute(
        select(ConvoyMember)
        .join(Convoy)
        .where(
            ConvoyMember.user_id == current_user.id,
            Convoy.status.in_([ConvoyStatus.FORMING, ConvoyStatus.ACTIVE]),
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already in a convoy. Leave it first.",
        )

    # Build destination point if coordinates provided
    destination_point = None
    if body.destination_lat is not None and body.destination_lng is not None:
        destination_point = (
            f"SRID=4326;POINT({body.destination_lng} {body.destination_lat})"
        )

    convoy = Convoy(
        name=body.name,
        leader_id=current_user.id,
        visibility=body.visibility,
        status=ConvoyStatus.FORMING,
        destination_name=body.destination_name,
        destination_point=destination_point,
    )
    db.add(convoy)
    await db.flush()

    # Add creator as leader member
    member = ConvoyMember(
        convoy_id=convoy.id,
        user_id=current_user.id,
        role=ConvoyMemberRole.LEADER,
    )
    db.add(member)

    await _add_system_message(
        convoy.id, f"{current_user.username} created the convoy.", db
    )
    await db.flush()

    # Add creator to Redis convoy member set
    from backend.redis import get_redis

    r = get_redis()
    await r.sadd(f"convoy:{convoy.id}:members", str(current_user.id))

    return await _build_convoy_response(convoy, db)


@router.get("/{convoy_id}", response_model=ConvoyResponse)
async def get_convoy(
    convoy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConvoyResponse:
    """Get convoy details with member list."""
    convoy = await _get_convoy_or_404(convoy_id, db)
    return await _build_convoy_response(convoy, db)


@router.patch("/{convoy_id}", response_model=ConvoyResponse)
async def update_convoy(
    convoy_id: uuid.UUID,
    body: UpdateConvoyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConvoyResponse:
    """Update convoy settings (leader only)."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.leader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the convoy leader can update settings",
        )

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has already ended",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(convoy, field, value)

    await db.flush()
    return await _build_convoy_response(convoy, db)


@router.post("/{convoy_id}/end", response_model=MessageResponse)
async def end_convoy(
    convoy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """End the convoy (leader only). Dissolves it for everyone."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.leader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the convoy leader can end it",
        )

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has already ended",
        )

    convoy.status = ConvoyStatus.ENDED
    convoy.ended_at = datetime.now(UTC)

    # Bulk delete all messages (ephemeral chat) and members
    await db.execute(delete(ConvoyMessage).where(ConvoyMessage.convoy_id == convoy_id))
    await db.execute(delete(ConvoyMember).where(ConvoyMember.convoy_id == convoy_id))

    # Publish convoy_ended event and clean up Redis
    await publish_convoy_event(
        convoy_id, "convoy_ended", {"ended_by": str(current_user.id)}
    )
    from backend.redis import get_redis

    r = get_redis()
    await r.delete(f"convoy:{convoy_id}:members")

    return MessageResponse(message="Convoy ended")


@router.post("/{convoy_id}/join", response_model=ConvoyResponse)
async def join_convoy(
    convoy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConvoyResponse:
    """Join a convoy directly (friend's convoy or accepted invite)."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has ended",
        )

    # Check not already in a convoy
    result = await db.execute(
        select(ConvoyMember)
        .join(Convoy)
        .where(
            ConvoyMember.user_id == current_user.id,
            Convoy.status.in_([ConvoyStatus.FORMING, ConvoyStatus.ACTIVE]),
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already in a convoy. Leave it first.",
        )

    # Check permission: must be friends with a member, or have an accepted invite
    result = await db.execute(
        select(ConvoyMember.user_id).where(ConvoyMember.convoy_id == convoy_id)
    )
    member_ids = [row[0] for row in result.all()]

    has_friend_in_convoy = False
    for member_id in member_ids:
        if await _are_friends(current_user.id, member_id, db):
            has_friend_in_convoy = True
            break

    if not has_friend_in_convoy:
        # Check for accepted invite/join request
        result = await db.execute(
            select(ConvoyJoinRequest).where(
                ConvoyJoinRequest.convoy_id == convoy_id,
                ConvoyJoinRequest.user_id == current_user.id,
                ConvoyJoinRequest.status == JoinRequestStatus.ACCEPTED,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot join directly. Send a join request or be friends with a member.",
            )

    # Add as member
    member = ConvoyMember(
        convoy_id=convoy_id,
        user_id=current_user.id,
        role=ConvoyMemberRole.MEMBER,
    )
    db.add(member)

    await _add_system_message(
        convoy_id, f"{current_user.username} joined the convoy.", db
    )
    await db.flush()

    # Publish member_joined event + update Redis set
    await publish_convoy_event(
        convoy_id,
        "member_joined",
        {"user_id": str(current_user.id), "username": current_user.username},
    )
    from backend.redis import get_redis

    r = get_redis()
    await r.sadd(f"convoy:{convoy_id}:members", str(current_user.id))

    return await _build_convoy_response(convoy, db)


@router.post("/{convoy_id}/request", response_model=MessageResponse)
async def request_to_join(
    convoy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Request to join a public convoy."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has ended",
        )

    if convoy.visibility != ConvoyVisibility.PUBLIC:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This convoy is private. You need an invite.",
        )

    # Check not already a member
    if await _get_membership(convoy_id, current_user.id, db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already a member",
        )

    # Check no pending request
    result = await db.execute(
        select(ConvoyJoinRequest).where(
            ConvoyJoinRequest.convoy_id == convoy_id,
            ConvoyJoinRequest.user_id == current_user.id,
            ConvoyJoinRequest.status == JoinRequestStatus.PENDING,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Join request already pending",
        )

    join_request = ConvoyJoinRequest(
        convoy_id=convoy_id,
        user_id=current_user.id,
        status=JoinRequestStatus.PENDING,
    )
    db.add(join_request)

    # Notify convoy leader of join request
    await publish_notification(
        target_user_id=convoy.leader_id,
        notification_type="join_request",
        from_user={"user_id": str(current_user.id), "username": current_user.username},
        message=f"{current_user.username} wants to join your convoy",
        extra_data={"convoy_id": str(convoy_id)},
    )

    return MessageResponse(message="Join request sent")


@router.post("/{convoy_id}/request/{request_id}/accept", response_model=MessageResponse)
async def accept_join_request(
    convoy_id: uuid.UUID,
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Accept a join request (leader only)."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.leader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the leader can accept join requests",
        )

    result = await db.execute(
        select(ConvoyJoinRequest).where(
            ConvoyJoinRequest.id == request_id,
            ConvoyJoinRequest.convoy_id == convoy_id,
            ConvoyJoinRequest.status == JoinRequestStatus.PENDING,
        )
    )
    join_request = result.scalar_one_or_none()

    if join_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found",
        )

    join_request.status = JoinRequestStatus.ACCEPTED

    # Add user as member
    member = ConvoyMember(
        convoy_id=convoy_id,
        user_id=join_request.user_id,
        role=ConvoyMemberRole.MEMBER,
    )
    db.add(member)

    # Get username for system message
    result = await db.execute(select(User).where(User.id == join_request.user_id))
    joined_user = result.scalar_one()

    await _add_system_message(
        convoy_id, f"{joined_user.username} joined the convoy.", db
    )

    # Publish member_joined event + update Redis set
    await publish_convoy_event(
        convoy_id,
        "member_joined",
        {"user_id": str(join_request.user_id), "username": joined_user.username},
    )
    from backend.redis import get_redis

    r = get_redis()
    await r.sadd(f"convoy:{convoy_id}:members", str(join_request.user_id))

    return MessageResponse(message="Join request accepted")


@router.post(
    "/{convoy_id}/request/{request_id}/decline", response_model=MessageResponse
)
async def decline_join_request(
    convoy_id: uuid.UUID,
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Decline a join request (leader only)."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.leader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the leader can decline join requests",
        )

    result = await db.execute(
        select(ConvoyJoinRequest).where(
            ConvoyJoinRequest.id == request_id,
            ConvoyJoinRequest.convoy_id == convoy_id,
            ConvoyJoinRequest.status == JoinRequestStatus.PENDING,
        )
    )
    join_request = result.scalar_one_or_none()

    if join_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found",
        )

    join_request.status = JoinRequestStatus.DECLINED

    return MessageResponse(message="Join request declined")


@router.post("/{convoy_id}/leave", response_model=MessageResponse)
async def leave_convoy(
    convoy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Leave the convoy."""
    convoy = await _get_convoy_or_404(convoy_id, db)
    member = await _require_membership(convoy_id, current_user.id, db)

    await db.delete(member)
    await _add_system_message(
        convoy_id, f"{current_user.username} left the convoy.", db
    )

    # Update Redis set
    from backend.redis import get_redis

    r = get_redis()
    await r.srem(f"convoy:{convoy_id}:members", str(current_user.id))

    # If leader leaves, end the convoy
    if convoy.leader_id == current_user.id:
        convoy.status = ConvoyStatus.ENDED
        convoy.ended_at = datetime.now(UTC)
        await _add_system_message(convoy_id, "Convoy ended (leader left).", db)
        await publish_convoy_event(
            convoy_id, "convoy_ended", {"ended_by": str(current_user.id)}
        )
        await r.delete(f"convoy:{convoy_id}:members")
    else:
        # Publish member_left event
        await publish_convoy_event(
            convoy_id,
            "member_left",
            {"user_id": str(current_user.id), "username": current_user.username},
        )
        # Check if convoy is now empty
        result = await db.execute(
            select(ConvoyMember).where(ConvoyMember.convoy_id == convoy_id)
        )
        remaining = result.scalars().all()
        if not remaining:
            convoy.status = ConvoyStatus.ENDED
            convoy.ended_at = datetime.now(UTC)
            await publish_convoy_event(
                convoy_id, "convoy_ended", {"ended_by": "system"}
            )
            await r.delete(f"convoy:{convoy_id}:members")

    return MessageResponse(message="Left convoy")


@router.post("/{convoy_id}/invite", response_model=MessageResponse)
async def invite_to_convoy(
    convoy_id: uuid.UUID,
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Invite a user to the convoy (any member can invite)."""
    convoy = await _get_convoy_or_404(convoy_id, db)
    await _require_membership(convoy_id, current_user.id, db)

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has ended",
        )

    target_id = body.user_id

    # Check target exists
    result = await db.execute(select(User).where(User.id == target_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check not already a member
    if await _get_membership(convoy_id, target_id, db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already in this convoy",
        )

    # Create an accepted join request (invite = pre-approved)
    invite = ConvoyJoinRequest(
        convoy_id=convoy_id,
        user_id=target_id,
        status=JoinRequestStatus.ACCEPTED,
    )
    db.add(invite)

    # Notify invited user
    await publish_notification(
        target_user_id=target_id,
        notification_type="convoy_invite",
        from_user={"user_id": str(current_user.id), "username": current_user.username},
        message=f"{current_user.username} invited you to {convoy.name}",
        extra_data={"convoy_id": str(convoy_id), "convoy_name": convoy.name},
    )

    return MessageResponse(message="Invite sent")


@router.post("/{convoy_id}/kick", response_model=MessageResponse)
async def kick_member(
    convoy_id: uuid.UUID,
    body: KickRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Remove a member from the convoy (leader only)."""
    convoy = await _get_convoy_or_404(convoy_id, db)

    if convoy.leader_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the convoy leader can kick members",
        )

    target_id = body.user_id

    if target_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot kick yourself. Use /leave instead.",
        )

    member = await _get_membership(convoy_id, target_id, db)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not in this convoy",
        )

    # Get username for system message
    result = await db.execute(select(User).where(User.id == target_id))
    kicked_user = result.scalar_one()

    await db.delete(member)
    await _add_system_message(
        convoy_id, f"{kicked_user.username} was removed from the convoy.", db
    )

    # Publish member_kicked event + update Redis set
    await publish_convoy_event(
        convoy_id,
        "member_kicked",
        {"user_id": str(target_id), "username": kicked_user.username},
    )
    from backend.redis import get_redis

    r = get_redis()
    await r.srem(f"convoy:{convoy_id}:members", str(target_id))

    # Notify kicked user
    await publish_notification(
        target_user_id=target_id,
        notification_type="convoy_kicked",
        from_user={"user_id": str(current_user.id), "username": current_user.username},
        message=f"You were removed from {convoy.name}",
        extra_data={"convoy_id": str(convoy_id)},
    )

    return MessageResponse(message="Member kicked")


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


@router.get("/{convoy_id}/messages", response_model=list[ConvoyMessageOut])
async def get_messages(
    convoy_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=100),
    before: str | None = Query(
        default=None, description="ISO 8601 timestamp for cursor-based pagination"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConvoyMessageOut]:
    """Get recent messages in the convoy chat (paginated, newest last)."""
    await _get_convoy_or_404(convoy_id, db)
    await _require_membership(convoy_id, current_user.id, db)

    query = (
        select(ConvoyMessage)
        .where(ConvoyMessage.convoy_id == convoy_id)
        .options(selectinload(ConvoyMessage.sender))
        .order_by(ConvoyMessage.created_at.desc())
        .limit(limit)
    )

    if before is not None:
        try:
            before_dt = datetime.fromisoformat(before)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid 'before' timestamp. Use ISO 8601 format.",
            )
        query = query.where(ConvoyMessage.created_at < before_dt)

    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))

    return [
        ConvoyMessageOut(
            id=str(msg.id),
            sender_id=str(msg.sender_id) if msg.sender_id else None,
            sender_username=msg.sender.username if msg.sender else None,
            content=msg.content,
            message_type=msg.message_type,
            created_at=msg.created_at.isoformat(),
        )
        for msg in messages
    ]


@router.post(
    "/{convoy_id}/messages",
    response_model=ConvoyMessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    convoy_id: uuid.UUID,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConvoyMessageOut:
    """Send a text message in the convoy chat."""
    convoy = await _get_convoy_or_404(convoy_id, db)
    await _require_membership(convoy_id, current_user.id, db)

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has ended",
        )

    msg = ConvoyMessage(
        convoy_id=convoy_id,
        sender_id=current_user.id,
        content=body.content,
        message_type=MessageType.TEXT,
    )
    db.add(msg)
    await db.flush()

    # Publish to convoy channel for real-time delivery
    await publish_convoy_chat(
        convoy_id=convoy_id,
        message_id=msg.id,
        sender_id=current_user.id,
        sender_username=current_user.username,
        content=body.content,
        message_type="text",
    )

    return ConvoyMessageOut(
        id=str(msg.id),
        sender_id=str(current_user.id),
        sender_username=current_user.username,
        content=msg.content,
        message_type=msg.message_type,
        created_at=msg.created_at.isoformat(),
    )


@router.post(
    "/{convoy_id}/quick-action",
    response_model=ConvoyMessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_quick_action(
    convoy_id: uuid.UUID,
    body: QuickActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConvoyMessageOut:
    """Send a quick action alert to the convoy."""
    convoy = await _get_convoy_or_404(convoy_id, db)
    await _require_membership(convoy_id, current_user.id, db)

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has ended",
        )

    action_labels = {
        "pull_over": "Pulling Over",
        "gas_stop": "Gas Stop",
        "slow_down": "Slow Down",
        "regrouping": "Regrouping",
    }

    content = f"{current_user.username} — {action_labels[body.action]}"

    msg = ConvoyMessage(
        convoy_id=convoy_id,
        sender_id=current_user.id,
        content=content,
        message_type=MessageType.QUICK_ACTION,
    )
    db.add(msg)
    await db.flush()

    # Publish quick action to convoy channel
    await publish_convoy_event(
        convoy_id,
        "quick_action",
        {
            "user_id": str(current_user.id),
            "username": current_user.username,
            "action": body.action,
            "label": action_labels[body.action],
            "message_id": str(msg.id),
        },
    )

    return ConvoyMessageOut(
        id=str(msg.id),
        sender_id=str(current_user.id),
        sender_username=current_user.username,
        content=msg.content,
        message_type=msg.message_type,
        created_at=msg.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Routes (convoy navigation)
# ---------------------------------------------------------------------------


@router.post(
    "/{convoy_id}/route",
    response_model=RouteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def set_route(
    convoy_id: uuid.UUID,
    body: SetRouteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RouteResponse:
    """Set a group route for the convoy (any member can set)."""
    convoy = await _get_convoy_or_404(convoy_id, db)
    await _require_membership(convoy_id, current_user.id, db)

    if convoy.status == ConvoyStatus.ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convoy has ended",
        )

    # Deactivate previous routes
    result = await db.execute(
        select(ConvoyRoute).where(
            ConvoyRoute.convoy_id == convoy_id,
            ConvoyRoute.is_active.is_(True),
        )
    )
    for old_route in result.scalars().all():
        old_route.is_active = False

    # Create new route
    destination_point = (
        f"SRID=4326;POINT({body.destination_lng} {body.destination_lat})"
    )

    route = ConvoyRoute(
        convoy_id=convoy_id,
        set_by_user_id=current_user.id,
        destination_name=body.destination_name,
        destination_point=destination_point,
        waypoints=[wp.model_dump() for wp in body.waypoints]
        if body.waypoints
        else None,
        is_active=True,
    )
    db.add(route)

    # Update convoy destination
    convoy.destination_name = body.destination_name
    convoy.destination_point = destination_point

    # Activate convoy if still forming
    if convoy.status == ConvoyStatus.FORMING:
        convoy.status = ConvoyStatus.ACTIVE

    await _add_system_message(
        convoy_id,
        f"{current_user.username} set a route to {body.destination_name}.",
        db,
    )
    await db.flush()

    # Publish route_set event
    await publish_convoy_event(
        convoy_id,
        "route_set",
        {
            "user_id": str(current_user.id),
            "username": current_user.username,
            "destination_name": body.destination_name,
            "destination_lat": body.destination_lat,
            "destination_lng": body.destination_lng,
        },
    )

    return RouteResponse(
        id=str(route.id),
        destination_name=route.destination_name,
        destination_lat=body.destination_lat,
        destination_lng=body.destination_lng,
        set_by_username=current_user.username,
        waypoints=[Waypoint(**wp) for wp in route.waypoints]
        if route.waypoints
        else None,
        is_active=route.is_active,
        created_at=route.created_at.isoformat(),
    )


@router.get("/{convoy_id}/route", response_model=RouteResponse | None)
async def get_active_route(
    convoy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RouteResponse | None:
    """Get the current active route for the convoy."""
    await _get_convoy_or_404(convoy_id, db)
    await _require_membership(convoy_id, current_user.id, db)

    result = await db.execute(
        select(
            ConvoyRoute,
            ST_Y(ConvoyRoute.destination_point).label("dest_lat"),
            ST_X(ConvoyRoute.destination_point).label("dest_lng"),
        )
        .where(
            ConvoyRoute.convoy_id == convoy_id,
            ConvoyRoute.is_active.is_(True),
        )
        .options(selectinload(ConvoyRoute.set_by))
        .order_by(ConvoyRoute.created_at.desc())
        .limit(1)
    )
    row = result.one_or_none()

    if row is None:
        return None

    route, dest_lat, dest_lng = row

    return RouteResponse(
        id=str(route.id),
        destination_name=route.destination_name,
        destination_lat=dest_lat,
        destination_lng=dest_lng,
        set_by_username=route.set_by.username,
        waypoints=[Waypoint(**wp) for wp in route.waypoints]
        if route.waypoints
        else None,
        is_active=route.is_active,
        created_at=route.created_at.isoformat(),
    )
