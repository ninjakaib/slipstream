"""Publish events to Redis channels from REST endpoints.

These functions are called by REST routers when actions happen that need
real-time delivery to connected WebSocket clients (e.g., convoy events,
friend notifications).
"""

import json
import logging
import time
import uuid

from backend.redis import get_redis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Convoy Events
# ---------------------------------------------------------------------------


async def publish_convoy_event(
    convoy_id: uuid.UUID,
    event: str,
    data: dict,
) -> None:
    """Publish a convoy event to the convoy:{id} channel.

    Event types: member_joined, member_left, member_kicked, route_set,
    convoy_ended, quick_action, invite_received, join_request
    """
    r = get_redis()
    now = int(time.time())

    message = {
        "type": "convoy_event",
        "payload": {
            "convoy_id": str(convoy_id),
            "event": event,
            "data": data,
        },
        "ts": now,
    }

    await r.publish(f"convoy:{convoy_id}", json.dumps(message))


async def publish_convoy_chat(
    convoy_id: uuid.UUID,
    message_id: uuid.UUID,
    sender_id: uuid.UUID,
    sender_username: str,
    content: str,
    message_type: str = "text",
) -> None:
    """Publish a chat message to the convoy channel."""
    r = get_redis()
    now = int(time.time())

    message = {
        "type": "convoy_chat",
        "payload": {
            "convoy_id": str(convoy_id),
            "message_id": str(message_id),
            "sender_id": str(sender_id),
            "sender_username": sender_username,
            "content": content,
            "message_type": message_type,
            "ts": now,
        },
    }

    await r.publish(f"convoy:{convoy_id}", json.dumps(message))


# ---------------------------------------------------------------------------
# Notifications (in-app via WebSocket)
# ---------------------------------------------------------------------------


async def publish_notification(
    target_user_id: uuid.UUID,
    notification_type: str,
    from_user: dict,
    message: str,
    extra_data: dict | None = None,
) -> None:
    """Publish a notification to a specific user via their personal channel.

    This is used for events that target a specific user (friend request,
    convoy invite, etc.). The pub/sub listener dispatches it to their
    WebSocket if they're connected.
    """
    from backend.realtime.manager import manager

    now = int(time.time())

    notification = {
        "type": "notification",
        "payload": {
            "notification_type": notification_type,
            "from_user": from_user,
            "message": message,
            **(extra_data or {}),
        },
        "ts": now,
    }

    # Try direct local delivery first (most efficient for single-instance)
    sent = await manager.send_to_user(target_user_id, notification)

    if not sent:
        # User not connected locally. In multi-instance setup, we'd publish
        # to a user-specific Redis channel. For now, this is where push
        # notifications would be triggered (future).
        logger.debug(
            f"User {target_user_id} not connected for notification: {notification_type}"
        )


# ---------------------------------------------------------------------------
# Location Presence
# ---------------------------------------------------------------------------


async def set_user_visibility_in_redis(
    user_id: uuid.UUID, visibility: str
) -> None:
    """Update a user's visibility in their Redis position hash.

    Called when user changes visibility setting via REST.
    """
    r = get_redis()
    user_id_str = str(user_id)

    # Update visibility in position hash
    if await r.exists(f"pos:{user_id_str}"):
        await r.hset(f"pos:{user_id_str}", "visibility", visibility)

    # If ghost mode, remove from GEO set entirely
    if visibility == "ghost":
        await r.zrem("positions:live", user_id_str)


async def remove_user_presence(user_id: uuid.UUID) -> None:
    """Remove all real-time presence data for a user.

    Called on disconnect or account deletion.
    """
    r = get_redis()
    user_id_str = str(user_id)

    async with r.pipeline(transaction=False) as pipe:
        pipe.zrem("positions:live", user_id_str)
        pipe.delete(f"pos:{user_id_str}")
        pipe.delete(f"presence:{user_id_str}")
        await pipe.execute()
