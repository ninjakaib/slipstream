"""Handlers for incoming WebSocket messages.

Each handler corresponds to a message `type` the client can send:
- location_update: Report current position
- heartbeat: Keep presence alive
- status_change: Update driving status
- subscribe_area: Set geographic subscription area
- convoy_message: Send a chat message to convoy
- quick_action: Send a quick action to convoy
"""

import json
import logging
import time
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import (
    ConvoyMember,
    ConvoyMessage,
    ConvoyStatus,
    Convoy,
    Friendship,
    FriendshipStatus,
    MessageType,
    User,
    VisibilityMode,
)
from backend.realtime.manager import ConnectionManager, UserConnection
from backend.redis import get_redis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Location
# ---------------------------------------------------------------------------


async def handle_location_update(
    conn: UserConnection, payload: dict, mgr: ConnectionManager
) -> None:
    """Process a location update from a client.

    1. Validate coordinates
    2. Update Redis GEO set + position hash
    3. Publish to location:{user_id} channel for fanout
    """
    lat = payload.get("lat")
    lng = payload.get("lng")
    if lat is None or lng is None:
        return
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return

    heading = payload.get("heading", 0)
    speed = min(payload.get("speed", 0), 200)  # Cap at 200
    status = payload.get("status", "driving")
    road_name = payload.get("road_name", "")

    r = get_redis()
    user_id_str = str(conn.user_id)
    now = int(time.time())

    # Determine visibility from the connection's cached user state.
    # This ensures visibility is always present in the hash, even if the
    # hash was recreated after TTL expiry.
    visibility = getattr(conn, "_visibility", "on")

    # Pipeline for atomic updates (no transaction needed — these are independent)
    async with r.pipeline(transaction=False) as pipe:
        # 1. Update GEO set (Redis GEO uses lng, lat order)
        pipe.geoadd("positions:live", (lng, lat, user_id_str))

        # 2. Update position metadata hash (includes visibility so it
        #    survives hash recreation after TTL expiry)
        pipe.hset(
            f"pos:{user_id_str}",
            mapping={
                "lat": str(lat),
                "lng": str(lng),
                "heading": str(heading),
                "speed": str(speed),
                "status": status,
                "road_name": road_name,
                "visibility": visibility,
                "updated_at": str(now),
            },
        )

        # 3. Refresh TTL on position hash (120s — auto-expire if updates stop)
        pipe.expire(f"pos:{user_id_str}", 120)

        # 4. Refresh presence (so actively-updating users stay visible even
        #    if heartbeat messages are delayed or lost)
        pipe.set(f"presence:{user_id_str}", "online", ex=30)

        # 5. Publish to this user's location channel for subscriber fanout
        pipe.publish(
            f"location:{user_id_str}",
            json.dumps(
                {
                    "type": "driver_location",
                    "payload": {
                        "user_id": user_id_str,
                        "lat": lat,
                        "lng": lng,
                        "heading": heading,
                        "speed": speed,
                        "status": status,
                        "road_name": road_name,
                    },
                    "ts": now,
                }
            ),
        )

        await pipe.execute()


# ---------------------------------------------------------------------------
# Presence
# ---------------------------------------------------------------------------


async def handle_heartbeat(conn: UserConnection) -> None:
    """Refresh presence TTL in Redis. Called every ~15s by client."""
    r = get_redis()
    await r.set(f"presence:{str(conn.user_id)}", "online", ex=30)


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

VALID_STATUSES = {"driving", "parked", "en_route", "in_convoy", "offline"}


async def handle_status_change(conn: UserConnection, payload: dict) -> None:
    """Update user's status in their Redis position hash."""
    status = payload.get("status")
    if status not in VALID_STATUSES:
        return

    r = get_redis()
    user_id_str = str(conn.user_id)

    # Update status in position hash
    await r.hset(f"pos:{user_id_str}", "status", status)

    # If going offline/ghost, remove from GEO set
    if status == "offline":
        await r.zrem("positions:live", user_id_str)


# ---------------------------------------------------------------------------
# Area Subscription
# ---------------------------------------------------------------------------


async def handle_subscribe_area(
    conn: UserConnection, payload: dict, mgr: ConnectionManager, db: AsyncSession
) -> None:
    """Update the user's subscription area and refresh their nearby subscriptions.

    This triggers:
    - GEOSEARCH to find nearby users
    - Visibility filtering (ghost/friends-only checks)
    - Subscribe to new location channels
    - Unsubscribe from stale location channels
    - Send driver_entered / driver_exited messages
    """
    lat = payload.get("lat")
    lng = payload.get("lng")
    radius_miles = payload.get("radius_miles", 15)

    if lat is None or lng is None:
        return
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return

    conn.subscribe_lat = lat
    conn.subscribe_lng = lng
    conn.subscribe_radius_miles = radius_miles

    await refresh_subscriptions(conn, mgr, db)


async def refresh_subscriptions(
    conn: UserConnection, mgr: ConnectionManager, db: AsyncSession
) -> None:
    """Refresh a connection's location channel subscriptions.

    Called when:
    - Client sends subscribe_area
    - Periodic background refresh (every ~30s)
    """
    if conn.subscribe_lat is None or conn.subscribe_lng is None:
        return

    r = get_redis()
    user_id_str = str(conn.user_id)

    # GEOSEARCH for nearby users
    try:
        results = await r.geosearch(
            "positions:live",
            longitude=conn.subscribe_lng,
            latitude=conn.subscribe_lat,
            radius=conn.subscribe_radius_miles,
            unit="mi",
            sort="ASC",
            count=200,
        )
    except Exception as e:
        logger.error(f"GEOSEARCH failed: {e}")
        return

    # Exclude self
    nearby_user_ids: list[str] = [uid for uid in results if uid != user_id_str]

    if not nearby_user_ids:
        # No one nearby — unsubscribe from all location channels
        current_location_channels = {
            ch for ch in conn.subscribed_channels if ch.startswith("location:")
        }
        for channel in current_location_channels:
            mgr.unsubscribe(conn.user_id, channel)
            target_uid = channel.removeprefix("location:")
            await mgr.send_to_user(
                conn.user_id,
                {"type": "driver_exited", "payload": {"user_id": target_uid}},
            )
        return

    # Batch fetch presence and position data via pipeline (avoid N+1 round-trips)
    async with r.pipeline(transaction=False) as pipe:
        for uid_str in nearby_user_ids:
            pipe.exists(f"presence:{uid_str}")
            pipe.hgetall(f"pos:{uid_str}")
        pipeline_results = await pipe.execute()

    # Apply visibility filtering using batched results
    visible_user_ids: set[str] = set()
    for i, uid_str in enumerate(nearby_user_ids):
        presence = pipeline_results[i * 2]
        pos_data = pipeline_results[i * 2 + 1]

        if not presence or not pos_data:
            continue

        visibility = pos_data.get("visibility", "on")

        if visibility == "ghost":
            continue
        elif visibility == "friends_only":
            # Check if they're our friend
            try:
                target_uuid = uuid.UUID(uid_str)
            except ValueError:
                continue
            if target_uuid not in conn.friend_ids:
                continue

        visible_user_ids.add(uid_str)

    # Determine desired location channels
    desired_channels = {f"location:{uid}" for uid in visible_user_ids}

    # Current location channels (exclude convoy channels)
    current_location_channels = {
        ch for ch in conn.subscribed_channels if ch.startswith("location:")
    }

    # New channels to subscribe
    new_channels = desired_channels - current_location_channels
    # Old channels to unsubscribe
    old_channels = current_location_channels - desired_channels

    # Subscribe to new
    for channel in new_channels:
        mgr.subscribe(conn.user_id, channel)

    # Unsubscribe from old
    for channel in old_channels:
        mgr.unsubscribe(conn.user_id, channel)

    # Send driver_entered for newly visible users
    for channel in new_channels:
        target_uid = channel.removeprefix("location:")
        pos_data = await r.hgetall(f"pos:{target_uid}")
        if pos_data:
            await mgr.send_to_user(
                conn.user_id,
                {
                    "type": "driver_entered",
                    "payload": {
                        "user_id": target_uid,
                        "lat": float(pos_data.get("lat", 0)),
                        "lng": float(pos_data.get("lng", 0)),
                        "heading": float(pos_data.get("heading", 0)),
                        "speed": float(pos_data.get("speed", 0)),
                        "status": pos_data.get("status", "driving"),
                        "road_name": pos_data.get("road_name", ""),
                    },
                },
            )

    # Send driver_exited for users no longer visible
    for channel in old_channels:
        target_uid = channel.removeprefix("location:")
        await mgr.send_to_user(
            conn.user_id,
            {
                "type": "driver_exited",
                "payload": {"user_id": target_uid},
            },
        )


# ---------------------------------------------------------------------------
# Convoy Chat (via WebSocket)
# ---------------------------------------------------------------------------


async def handle_convoy_message(
    conn: UserConnection, payload: dict, db: AsyncSession
) -> None:
    """Handle a chat message sent via WebSocket to a convoy.

    Stores in DB and publishes to convoy channel for real-time delivery.
    """
    convoy_id_str = payload.get("convoy_id")
    content = payload.get("content", "").strip()

    if not convoy_id_str or not content:
        return
    if len(content) > 500:
        content = content[:500]

    try:
        convoy_id = uuid.UUID(convoy_id_str)
    except ValueError:
        return

    # Verify membership
    result = await db.execute(
        select(ConvoyMember).where(
            ConvoyMember.convoy_id == convoy_id,
            ConvoyMember.user_id == conn.user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        return

    # Verify convoy is active
    result = await db.execute(select(Convoy).where(Convoy.id == convoy_id))
    convoy = result.scalar_one_or_none()
    if convoy is None or convoy.status == ConvoyStatus.ENDED:
        return

    # Store message in DB
    msg = ConvoyMessage(
        convoy_id=convoy_id,
        sender_id=conn.user_id,
        content=content,
        message_type=MessageType.TEXT,
    )
    db.add(msg)
    await db.flush()

    # Publish to convoy channel
    r = get_redis()
    now = int(time.time())
    await r.publish(
        f"convoy:{convoy_id_str}",
        json.dumps(
            {
                "type": "convoy_chat",
                "payload": {
                    "convoy_id": convoy_id_str,
                    "message_id": str(msg.id),
                    "sender_id": str(conn.user_id),
                    "sender_username": conn.username,
                    "content": content,
                    "message_type": "text",
                    "ts": now,
                },
            }
        ),
    )


async def handle_quick_action(
    conn: UserConnection, payload: dict, db: AsyncSession
) -> None:
    """Handle a quick action sent via WebSocket.

    Stores as system message and publishes to convoy channel.
    """
    convoy_id_str = payload.get("convoy_id")
    action = payload.get("action")

    valid_actions = {"pull_over", "gas_stop", "slow_down", "regrouping"}
    if not convoy_id_str or action not in valid_actions:
        return

    try:
        convoy_id = uuid.UUID(convoy_id_str)
    except ValueError:
        return

    # Verify membership
    result = await db.execute(
        select(ConvoyMember).where(
            ConvoyMember.convoy_id == convoy_id,
            ConvoyMember.user_id == conn.user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        return

    action_labels = {
        "pull_over": "Pulling Over",
        "gas_stop": "Gas Stop",
        "slow_down": "Slow Down",
        "regrouping": "Regrouping",
    }

    content = f"{conn.username} — {action_labels[action]}"

    # Store as quick_action message
    msg = ConvoyMessage(
        convoy_id=convoy_id,
        sender_id=conn.user_id,
        content=content,
        message_type=MessageType.QUICK_ACTION,
    )
    db.add(msg)
    await db.flush()

    # Publish to convoy channel
    r = get_redis()
    now = int(time.time())
    await r.publish(
        f"convoy:{convoy_id_str}",
        json.dumps(
            {
                "type": "convoy_event",
                "payload": {
                    "convoy_id": convoy_id_str,
                    "event": "quick_action",
                    "data": {
                        "user_id": str(conn.user_id),
                        "username": conn.username,
                        "action": action,
                        "label": action_labels[action],
                        "message_id": str(msg.id),
                    },
                },
                "ts": now,
            }
        ),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def load_friend_ids(user_id: uuid.UUID, db: AsyncSession) -> set[uuid.UUID]:
    """Load all accepted friend IDs for a user from the database."""
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


async def load_active_convoy(user_id: uuid.UUID, db: AsyncSession) -> uuid.UUID | None:
    """Get the user's active convoy ID, if any."""
    result = await db.execute(
        select(ConvoyMember.convoy_id)
        .join(Convoy)
        .where(
            ConvoyMember.user_id == user_id,
            Convoy.status.in_([ConvoyStatus.FORMING, ConvoyStatus.ACTIVE]),
        )
    )
    row = result.first()
    return row[0] if row else None
