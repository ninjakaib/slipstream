"""WebSocket endpoint and REST helpers for the spatial pub/sub system.

Handles:
    - Connection authentication (JWT from query param)
    - Message dispatch to handlers
    - Graceful disconnect and cleanup

Protocol:
    Client → Server:
        location_update: {lat, lng, heading, speed, status}
        viewport_update: {cells: [...]}
        heartbeat: {}

    Server → Client:
        viewport_snapshot: {drivers: [{user_id, lat, lng, heading, speed, status}, ...]}
        driver_moved: {user_id, lat, lng, heading, speed, status}
        driver_exited: {user_id}
        heartbeat_ack: {}
        error: {message: "..."}
"""

import json
import uuid

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from slipstream.auth import decode_access_token
from slipstream.logging import get_logger
from slipstream.spatial.handlers import (
    handle_disconnect,
    handle_location_update,
    handle_viewport_update,
)
from slipstream.spatial.store import spatial_store, INDEX_RESOLUTIONS

logger = get_logger(__name__)

router = APIRouter(tags=["spatial"])


# ---------------------------------------------------------------------------
# REST: Configuration endpoint for clients
# ---------------------------------------------------------------------------


@router.get("/spatial/config")
async def get_spatial_config() -> dict:
    """Return spatial system configuration for clients.

    Clients use this to know which H3 resolutions are supported
    and should be used for viewport cell computation.
    """
    return {
        "resolutions": list(INDEX_RESOLUTIONS),
        "finest_resolution": max(INDEX_RESOLUTIONS),
        "coarsest_resolution": min(INDEX_RESOLUTIONS),
        "max_viewport_cells": 64,
    }


# ---------------------------------------------------------------------------
# WebSocket: Real-time position streaming
# ---------------------------------------------------------------------------


@router.websocket("/ws/live")
async def spatial_websocket(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time position streaming.

    Authentication: Pass JWT as query parameter `token`.
    Example: ws://host/ws/live?token=<access_token>
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

    # --- Accept Connection ---
    await websocket.accept()
    conn = spatial_store.connect(user_id, username, websocket)

    # Bind user context to a connection-scoped logger
    log = logger.bind(user_id=str(user_id), username=username)
    log.info("websocket.connected")

    # --- Message Loop ---
    last_location_ts: float = 0.0

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await conn.send(
                    {"type": "error", "payload": {"message": "Invalid JSON"}}
                )
                continue

            msg_type = message.get("type")
            msg_payload = message.get("payload", {})

            log.debug("websocket.message_received", msg_type=msg_type)

            try:
                if msg_type == "location_update":
                    last_location_ts = await handle_location_update(
                        conn, msg_payload, spatial_store, last_location_ts
                    )

                elif msg_type == "viewport_update":
                    await handle_viewport_update(conn, msg_payload, spatial_store)

                elif msg_type == "heartbeat":
                    await conn.send({"type": "heartbeat_ack"})

                else:
                    await conn.send(
                        {
                            "type": "error",
                            "payload": {"message": f"Unknown message type: {msg_type}"},
                        }
                    )

            except WebSocketDisconnect:
                raise
            except Exception as e:
                log.warning(
                    "websocket.message_error",
                    msg_type=msg_type,
                    error=str(e),
                    exc_info=True,
                )
                try:
                    await conn.send(
                        {
                            "type": "error",
                            "payload": {"message": "Internal error processing message"},
                        }
                    )
                except Exception:
                    raise WebSocketDisconnect(code=1011)

    except WebSocketDisconnect as exc:
        log.info(
            "websocket.disconnected",
            close_code=exc.code,
            reason=exc.reason or "client initiated",
        )
    except Exception as e:
        log.warning("websocket.error", error=str(e), exc_info=True)
    finally:
        await handle_disconnect(user_id, spatial_store)
        log.info("websocket.cleanup_complete")
