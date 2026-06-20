"""WebSocket endpoint for real-time communication.

Handles:
- Connection authentication (JWT from query param)
- Message dispatch to handlers
- Graceful disconnect and cleanup
- Periodic subscription refresh (background task per connection)
"""

import asyncio
import json
import logging
import time
import uuid

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import decode_access_token
from backend.database import async_session_factory
from backend.models import User, VisibilityMode
from backend.realtime.handlers import (
    handle_convoy_message,
    handle_heartbeat,
    handle_location_update,
    handle_quick_action,
    handle_status_change,
    handle_subscribe_area,
    load_active_convoy,
    load_friend_ids,
    refresh_subscriptions,
)
from backend.realtime.manager import UserConnection, manager
from backend.redis import get_redis

logger = logging.getLogger(__name__)

router = APIRouter()

# How often to refresh subscriptions (discover new nearby users, remove stale ones)
SUBSCRIPTION_REFRESH_INTERVAL = 30  # seconds

# How often to refresh friend lists from DB
FRIEND_REFRESH_INTERVAL = 60  # seconds

# Minimum interval between location updates (rate limit)
LOCATION_UPDATE_MIN_INTERVAL = 1.0  # seconds


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Main WebSocket endpoint for real-time communication.

    Authentication: Pass JWT as query parameter `token`.
    e.g., ws://host/ws?token=<access_token>
    """
    # --- Authentication ---
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        await websocket.close(code=4001, reason="Token expired")
        return
    except jwt.InvalidTokenError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id_str = payload.get("sub")
    username = payload.get("username", "")
    if not user_id_str:
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        await websocket.close(code=4001, reason="Invalid user ID in token")
        return

    # Verify user exists in DB
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            await websocket.close(code=4001, reason="User not found")
            return

        # Load initial state
        friend_ids = await load_friend_ids(user_id, db)
        convoy_id = await load_active_convoy(user_id, db)
        visibility = user.visibility
        discovery_radius = user.discovery_radius_miles

    # --- Accept Connection ---
    await websocket.accept()
    conn = manager.connect(user_id, username, websocket)
    conn.friend_ids = friend_ids
    conn.convoy_id = convoy_id
    conn.subscribe_radius_miles = float(discovery_radius)
    conn._visibility = visibility.value  # Cache for location_update handler

    logger.info(
        f"WebSocket connected: {username} ({user_id}) "
        f"[friends={len(friend_ids)}, convoy={convoy_id}]"
    )

    # Set initial presence
    r = get_redis()
    await r.set(f"presence:{user_id_str}", "online", ex=30)

    # If user has visibility set, store it for other users' filtering
    if visibility != VisibilityMode.GHOST:
        # Set visibility in pos hash (will be created/updated on first location_update)
        pos_key = f"pos:{user_id_str}"
        await r.hset(pos_key, "visibility", visibility.value)
        await r.expire(pos_key, 604800)  # 7 days
    else:
        # Ghost mode — ensure they're not in the GEO set
        await r.zrem("positions:live", user_id_str)

    # Subscribe to convoy channel if in one
    if convoy_id:
        manager.subscribe(user_id, f"convoy:{convoy_id}")

    # --- Start Background Tasks ---
    refresh_task = asyncio.create_task(
        _subscription_refresh_loop(conn, discovery_radius)
    )

    # --- Message Loop ---
    try:
        await _message_loop(conn)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {username} ({user_id})")
    except Exception as e:
        logger.error(f"WebSocket error for {username}: {e}", exc_info=True)
    finally:
        # --- Cleanup ---
        refresh_task.cancel()
        try:
            await refresh_task
        except asyncio.CancelledError:
            pass

        # Mark user as offline but preserve position data for "last seen" display.
        r = get_redis()
        await r.delete(f"presence:{user_id_str}")
        pos_key = f"pos:{user_id_str}"
        if await r.exists(pos_key):
            await r.hset(pos_key, "status", "offline")
            await r.expire(pos_key, 604800)  # 7 days

        # Disconnect from manager (cleans up all channel subscriptions)
        manager.disconnect(user_id)

        logger.info(f"WebSocket fully cleaned up: {username} ({user_id})")


async def _message_loop(conn: UserConnection) -> None:
    """Receive and dispatch incoming WebSocket messages."""
    last_location_ts: float = 0.0

    while True:
        raw = await conn.websocket.receive_text()

        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            await conn.websocket.send_json(
                {"type": "error", "payload": {"message": "Invalid JSON"}}
            )
            continue

        msg_type = message.get("type")
        payload = message.get("payload", {})

        try:
            if msg_type == "location_update":
                # Rate limit: max 1 location update per second
                now = time.time()
                if (now - last_location_ts) < LOCATION_UPDATE_MIN_INTERVAL:
                    continue
                last_location_ts = now
                await handle_location_update(conn, payload, manager)

            elif msg_type == "heartbeat":
                await handle_heartbeat(conn)
                # Send heartbeat ack so client knows connection is alive
                await conn.websocket.send_json({"type": "heartbeat_ack"})

            elif msg_type == "status_change":
                await handle_status_change(conn, payload)

            elif msg_type == "subscribe_area":
                # This needs a DB session for visibility/friend checks
                async with async_session_factory() as db:
                    await handle_subscribe_area(conn, payload, manager, db)

            elif msg_type == "convoy_message":
                async with async_session_factory() as db:
                    await handle_convoy_message(conn, payload, db)
                    await db.commit()

            elif msg_type == "quick_action":
                async with async_session_factory() as db:
                    await handle_quick_action(conn, payload, db)
                    await db.commit()

            else:
                await conn.websocket.send_json(
                    {
                        "type": "error",
                        "payload": {"message": f"Unknown message type: {msg_type}"},
                    }
                )

        except WebSocketDisconnect:
            raise  # Let the outer handler catch this
        except Exception as e:
            logger.error(
                f"Error handling '{msg_type}' for {conn.username}: {e}",
                exc_info=True,
            )
            # Inform client but don't kill the connection
            try:
                await conn.websocket.send_json(
                    {
                        "type": "error",
                        "payload": {"message": "Internal error processing message"},
                    }
                )
            except Exception:
                # If we can't even send the error, the connection is dead
                raise WebSocketDisconnect(code=1011)


async def _subscription_refresh_loop(conn, discovery_radius: int) -> None:
    """Periodically refresh a connection's nearby-driver subscriptions.

    Runs as a background task per connection. Handles:
    - Re-running GEOSEARCH to discover new nearby users / remove stale ones
    - Refreshing friend list from DB
    """
    friend_refresh_counter = 0

    while True:
        try:
            await asyncio.sleep(SUBSCRIPTION_REFRESH_INTERVAL)

            # Skip if user hasn't set their area yet
            if conn.subscribe_lat is None:
                continue

            # Periodically refresh friend list (every ~60s)
            friend_refresh_counter += SUBSCRIPTION_REFRESH_INTERVAL
            if friend_refresh_counter >= FRIEND_REFRESH_INTERVAL:
                friend_refresh_counter = 0
                async with async_session_factory() as db:
                    conn.friend_ids = await load_friend_ids(conn.user_id, db)

            # Refresh subscriptions
            async with async_session_factory() as db:
                await refresh_subscriptions(conn, manager, db)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Subscription refresh error: {e}", exc_info=True)
            # Don't crash the loop on transient errors
            await asyncio.sleep(5)
