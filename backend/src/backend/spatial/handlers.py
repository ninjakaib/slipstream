"""WebSocket message handlers for the spatial pub/sub system.

Each handler corresponds to an incoming message type:
    - location_update: Driver reports new position + H3 cells
    - viewport_update: Client reports which cells their viewport covers
    - heartbeat: Keep-alive acknowledgment
    - disconnect: Cleanup and notify watchers

Handlers are pure logic — they read/write the SpatialStore and dispatch
outbound messages via ConnectionState.send(). No external I/O (Redis, DB)
is performed on the hot path.
"""

import logging
import time
import uuid

from backend.spatial.store import SpatialStore
from backend.spatial.types import ConnectionState

logger = logging.getLogger(__name__)

# Minimum interval between location updates from a single client (rate limit).
LOCATION_UPDATE_MIN_INTERVAL = 0.5  # seconds

# Valid driving statuses.
VALID_STATUSES = {"driving", "parked", "en_route", "in_convoy", "idle"}


async def handle_location_update(
    conn: ConnectionState,
    payload: dict,
    store: SpatialStore,
    last_update_ts: float,
) -> float:
    """Process a location update from a client.

    Validates the payload, updates the store, and dispatches events to
    watchers of affected cells.

    Args:
        conn: The connection sending the update.
        payload: Message payload with lat, lng, heading, speed, status, cells.
        store: The spatial store instance.
        last_update_ts: Timestamp of the last accepted update (for rate limiting).

    Returns:
        The timestamp of this update (for rate limiting the next one).
    """
    # Rate limit
    now = time.time()
    if (now - last_update_ts) < LOCATION_UPDATE_MIN_INTERVAL:
        return last_update_ts

    # Validate coordinates
    lat = payload.get("lat")
    lng = payload.get("lng")
    if lat is None or lng is None:
        return last_update_ts
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return last_update_ts

    heading = payload.get("heading", 0.0)
    speed = max(0.0, min(payload.get("speed", 0.0), 300.0))
    status = payload.get("status", "driving")
    if status not in VALID_STATUSES:
        status = "driving"

    # H3 cells computed by the client
    raw_cells = payload.get("cells", [])
    if not isinstance(raw_cells, list):
        return last_update_ts
    cells = set(raw_cells)

    # Update store — returns which cells were entered/exited/stayed
    transition = store.update_position(
        user_id=conn.user_id,
        lat=lat,
        lng=lng,
        heading=heading,
        speed=speed,
        status=status,
        cells=cells,
    )

    # Build the position message (reused for all recipients)
    pos_msg = {
        "type": "driver_moved",
        "payload": {
            "user_id": str(conn.user_id),
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "speed": speed,
            "status": status,
        },
    }

    # Dispatch to all watchers of cells this driver is currently in.
    # The set union across all cells deduplicates watchers who subscribe
    # at multiple resolutions.
    all_current_cells = transition.stayed | transition.entered
    watchers = store.get_watchers_for_cells(all_current_cells, exclude=conn.user_id)

    # Send position update to all watchers
    dead_connections: list[uuid.UUID] = []
    for watcher_id in watchers:
        watcher_conn = store.get_connection(watcher_id)
        if watcher_conn is None:
            continue
        success = await watcher_conn.send(pos_msg)
        if not success:
            dead_connections.append(watcher_id)

    # Notify watchers of exited cells that this driver left
    if transition.exited:
        exit_msg = {
            "type": "driver_exited",
            "payload": {"user_id": str(conn.user_id)},
        }
        for cell in transition.exited:
            exit_watchers = store.get_watchers_for_cell(cell, exclude=conn.user_id)
            # Only notify watchers who AREN'T already in the "all watchers" set
            # (they already got the driver_moved, so they know the driver is still around)
            exit_only = exit_watchers - watchers
            for watcher_id in exit_only:
                watcher_conn = store.get_connection(watcher_id)
                if watcher_conn is None:
                    continue
                success = await watcher_conn.send(exit_msg)
                if not success:
                    dead_connections.append(watcher_id)

    # Clean up dead connections
    for uid in dead_connections:
        await handle_disconnect(uid, store)

    return now


async def handle_viewport_update(
    conn: ConnectionState,
    payload: dict,
    store: SpatialStore,
) -> None:
    """Process a viewport update from a client.

    Updates the client's cell subscriptions and sends a snapshot of
    drivers currently in any newly-subscribed cells.

    Args:
        conn: The connection updating its viewport.
        payload: Message payload with cells list and optional resolution.
        store: The spatial store instance.
    """
    raw_cells = payload.get("cells", [])
    if not isinstance(raw_cells, list):
        return

    cells = set(raw_cells)

    # Update viewport in store — returns which cells were added/removed
    transition = store.update_viewport(conn.user_id, cells)

    if transition.added:
        # Send snapshot of all drivers in newly-visible cells
        snapshot_positions = store.get_snapshot_for_cells(
            transition.added, exclude=conn.user_id
        )

        if snapshot_positions:
            snapshot_msg = {
                "type": "viewport_snapshot",
                "payload": {
                    "drivers": [pos.to_broadcast_dict() for pos in snapshot_positions],
                },
            }
            await conn.send(snapshot_msg)


async def handle_disconnect(
    user_id: uuid.UUID,
    store: SpatialStore,
) -> None:
    """Handle user disconnection — clean up state and notify watchers.

    When a driver disconnects, watchers of their cells should be told
    so they can remove the marker.
    """
    # Get the driver's current cells before removing them
    pos = store.get_position(user_id)
    cells = pos.cells if pos else set()

    # Remove from store (cleans up positions, cell_members, cell_watchers, connections)
    store.disconnect(user_id)

    # Notify watchers of the driver's cells that they left
    if cells:
        exit_msg = {
            "type": "driver_exited",
            "payload": {"user_id": str(user_id)},
        }
        watchers = store.get_watchers_for_cells(cells, exclude=user_id)
        for watcher_id in watchers:
            watcher_conn = store.get_connection(watcher_id)
            if watcher_conn is None:
                continue
            await watcher_conn.send(exit_msg)
