"""In-memory spatial store for position tracking and cell-based dispatch.

The SpatialStore is the core data structure — four dictionaries that together
form a spatial pub/sub system:

    positions:     user_id → PositionState (where everyone is)
    cell_members:  cell_id → set of user_ids (who is in each cell)
    cell_watchers: cell_id → set of user_ids (who is watching each cell)
    connections:   user_id → ConnectionState (WebSocket references)

All operations are synchronous dict/set manipulations. Since the server runs
on a single asyncio event loop, no locking is needed — mutations happen between
await points.
"""

import logging
import time
import uuid

import h3

from backend.spatial.types import (
    CellTransition,
    ConnectionState,
    PositionState,
    ViewportTransition,
)

logger = logging.getLogger(__name__)

# Maximum cells a client can subscribe to in their viewport.
MAX_VIEWPORT_CELLS = 64

# Resolutions at which every driver is indexed.
# Each location update produces one cell per resolution.
# Viewers subscribe at whichever resolution matches their zoom level.
INDEX_RESOLUTIONS: tuple[int, ...] = (4, 5, 6, 7)


class SpatialStore:
    """In-memory spatial index and routing table.

    Thread-safe under asyncio (single-threaded event loop). All public
    methods perform synchronous state mutations with no intermediate
    await points.
    """

    def __init__(self) -> None:
        self._positions: dict[uuid.UUID, PositionState] = {}
        self._cell_members: dict[str, set[uuid.UUID]] = {}
        self._cell_watchers: dict[str, set[uuid.UUID]] = {}
        self._connections: dict[uuid.UUID, ConnectionState] = {}

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    @property
    def tracked_positions(self) -> int:
        return len(self._positions)

    # ------------------------------------------------------------------
    # Connection Lifecycle
    # ------------------------------------------------------------------

    def connect(
        self,
        user_id: uuid.UUID,
        username: str,
        websocket,
    ) -> ConnectionState:
        """Register a new WebSocket connection.

        If the user already has a connection, the old one is cleaned up first.
        Returns the new ConnectionState.
        """
        if user_id in self._connections:
            self.disconnect(user_id)

        conn = ConnectionState(
            user_id=user_id,
            username=username,
            websocket=websocket,
        )
        self._connections[user_id] = conn
        logger.debug(f"Connected: {username} ({user_id})")
        return conn

    def disconnect(self, user_id: uuid.UUID) -> None:
        """Remove a user's connection and clean up all state.

        Removes them from:
        - connections dict
        - cell_watchers (their viewport subscriptions)
        - cell_members (their position in cells)
        - positions dict
        """
        conn = self._connections.pop(user_id, None)
        if conn is None:
            return

        # Remove from all watched cells
        for cell in conn.viewport_cells:
            watchers = self._cell_watchers.get(cell)
            if watchers:
                watchers.discard(user_id)
                if not watchers:
                    del self._cell_watchers[cell]

        # Remove from cell membership
        pos = self._positions.pop(user_id, None)
        if pos:
            for cell in pos.cells:
                members = self._cell_members.get(cell)
                if members:
                    members.discard(user_id)
                    if not members:
                        del self._cell_members[cell]

        logger.debug(f"Disconnected: {user_id}")

    def get_connection(self, user_id: uuid.UUID) -> ConnectionState | None:
        """Get a connection by user_id, or None if not connected."""
        return self._connections.get(user_id)

    # ------------------------------------------------------------------
    # Position Updates
    # ------------------------------------------------------------------

    def update_position(
        self,
        user_id: uuid.UUID,
        lat: float,
        lng: float,
        heading: float,
        speed: float,
        status: str,
    ) -> CellTransition:
        """Update a user's position and cell membership.

        Computes the H3 cells for the given coordinates at all supported
        resolutions, updates the spatial index, and returns the cell
        transition for event dispatch.

        Args:
            user_id: The user whose position is being updated.
            lat, lng: Coordinates.
            heading: Direction of travel in degrees.
            speed: Current speed.
            status: Driving status string.

        Returns:
            CellTransition describing which cells were entered/exited/stayed.
        """
        # Server computes H3 cells — authoritative, no client trust needed
        new_cells = {h3.latlng_to_cell(lat, lng, res) for res in INDEX_RESOLUTIONS}

        # Get previous state
        old_pos = self._positions.get(user_id)
        old_cells = old_pos.cells if old_pos else set()

        # Compute transition
        transition = CellTransition(
            entered=new_cells - old_cells,
            exited=old_cells - new_cells,
            stayed=new_cells & old_cells,
        )

        # Update position
        self._positions[user_id] = PositionState(
            user_id=user_id,
            lat=lat,
            lng=lng,
            heading=heading,
            speed=speed,
            status=status,
            cells=new_cells,
            updated_at=time.time(),
        )

        # Update cell_members index
        for cell in transition.entered:
            self._cell_members.setdefault(cell, set()).add(user_id)

        for cell in transition.exited:
            members = self._cell_members.get(cell)
            if members:
                members.discard(user_id)
                if not members:
                    del self._cell_members[cell]

        return transition

    def get_position(self, user_id: uuid.UUID) -> PositionState | None:
        """Get a user's current position, or None if not tracked."""
        return self._positions.get(user_id)

    # ------------------------------------------------------------------
    # Viewport / Watcher Management
    # ------------------------------------------------------------------

    def update_viewport(
        self,
        user_id: uuid.UUID,
        cells: set[str],
    ) -> ViewportTransition:
        """Update which cells a user is watching (their viewport).

        Args:
            user_id: The user updating their viewport.
            cells: New set of H3 cells covering their viewport.

        Returns:
            ViewportTransition describing which watched cells were added/removed.
        """
        conn = self._connections.get(user_id)
        if conn is None:
            return ViewportTransition()

        # Validate and cap
        valid_cells = self._validate_viewport_cells(cells)

        old_viewport = conn.viewport_cells
        transition = ViewportTransition(
            added=valid_cells - old_viewport,
            removed=old_viewport - valid_cells,
        )

        # Update watcher registrations
        for cell in transition.added:
            self._cell_watchers.setdefault(cell, set()).add(user_id)

        for cell in transition.removed:
            watchers = self._cell_watchers.get(cell)
            if watchers:
                watchers.discard(user_id)
                if not watchers:
                    del self._cell_watchers[cell]

        conn.viewport_cells = valid_cells
        return transition

    # ------------------------------------------------------------------
    # Query Methods
    # ------------------------------------------------------------------

    def get_watchers_for_cells(
        self,
        cells: set[str],
        exclude: uuid.UUID | None = None,
    ) -> set[uuid.UUID]:
        """Get all unique user_ids watching any of the given cells.

        Used to determine who should receive a position update.
        The set union naturally deduplicates users watching multiple
        resolutions of the same area.
        """
        watchers: set[uuid.UUID] = set()
        for cell in cells:
            cell_watchers = self._cell_watchers.get(cell)
            if cell_watchers:
                watchers.update(cell_watchers)

        if exclude is not None:
            watchers.discard(exclude)

        return watchers

    def get_watchers_for_cell(
        self,
        cell: str,
        exclude: uuid.UUID | None = None,
    ) -> set[uuid.UUID]:
        """Get user_ids watching a specific cell."""
        watchers = self._cell_watchers.get(cell, set()).copy()
        if exclude is not None:
            watchers.discard(exclude)
        return watchers

    def get_cell_members(self, cell: str) -> set[uuid.UUID]:
        """Get all user_ids whose position is in a given cell."""
        return self._cell_members.get(cell, set()).copy()

    def get_snapshot_for_cells(
        self,
        cells: set[str],
        exclude: uuid.UUID | None = None,
    ) -> list[PositionState]:
        """Get current positions of all drivers in the given cells.

        Used to send a viewport snapshot when a client subscribes to new cells.
        Deduplicates drivers that appear in multiple cells (multi-resolution).
        """
        driver_ids: set[uuid.UUID] = set()
        for cell in cells:
            driver_ids.update(self._cell_members.get(cell, set()))

        if exclude is not None:
            driver_ids.discard(exclude)

        positions: list[PositionState] = []
        for uid in driver_ids:
            pos = self._positions.get(uid)
            if pos is not None:
                positions.append(pos)

        return positions

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------

    def stats(self) -> dict:
        """Return diagnostic stats about the store's current state."""
        return {
            "connections": len(self._connections),
            "positions": len(self._positions),
            "cells_with_members": len(self._cell_members),
            "cells_being_watched": len(self._cell_watchers),
            "total_watcher_registrations": sum(
                len(w) for w in self._cell_watchers.values()
            ),
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _validate_viewport_cells(self, cells: set[str]) -> set[str]:
        """Validate H3 cell strings from a viewport update.

        Returns only valid H3 cell indexes at supported resolutions,
        limited to MAX_VIEWPORT_CELLS.
        """
        valid: set[str] = set()
        for cell in cells:
            if len(valid) >= MAX_VIEWPORT_CELLS:
                break
            if h3.is_valid_cell(cell) and h3.get_resolution(cell) in INDEX_RESOLUTIONS:
                valid.add(cell)
        return valid


# ---------------------------------------------------------------------------
# Singleton instance — shared across the application
# ---------------------------------------------------------------------------

spatial_store = SpatialStore()
