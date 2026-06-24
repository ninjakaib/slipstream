"""Spatial pub/sub system for real-time position tracking.

This module implements an in-memory spatial index and event-driven dispatch
system. Drivers publish their position (with H3 cells computed client-side),
and viewers subscribe to cells covering their map viewport. Updates are
dispatched directly in-process — no external message broker on the hot path.

Architecture:
    - SpatialStore: In-memory state (positions, cell membership, cell watchers)
    - Handlers: Process incoming WebSocket messages and dispatch events
    - Router: WebSocket endpoint with auth and connection lifecycle

Data Flow:
    1. Client sends location_update with H3 cells for their coordinates
    2. Store updates position + cell membership, returns cell transitions
    3. Handler dispatches driver_entered/driver_moved/driver_exited to watchers
    4. Client sends viewport_update with H3 cells covering their viewport
    5. Store registers watcher, handler sends snapshot of current cell members
"""

from slipstream.spatial.store import SpatialStore, spatial_store, INDEX_RESOLUTIONS
from slipstream.spatial.router import router as spatial_router

__all__ = ["SpatialStore", "spatial_store", "spatial_router", "INDEX_RESOLUTIONS"]
