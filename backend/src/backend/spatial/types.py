"""Data types for the spatial pub/sub system."""

import time
import uuid
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class PositionState:
    """A driver's current position and metadata.

    Stored in the SpatialStore for every connected user who has sent
    at least one location update.
    """

    user_id: uuid.UUID
    lat: float
    lng: float
    heading: float = 0.0
    speed: float = 0.0
    status: str = "driving"
    cells: set[str] = field(default_factory=set)
    updated_at: float = field(default_factory=time.time)

    def to_broadcast_dict(self) -> dict:
        """Serialize for sending to other clients."""
        return {
            "user_id": str(self.user_id),
            "lat": self.lat,
            "lng": self.lng,
            "heading": self.heading,
            "speed": self.speed,
            "status": self.status,
        }


@dataclass
class ConnectionState:
    """Per-connection state for a WebSocket client.

    Tracks the user's identity, their WebSocket reference, the cells
    they are currently viewing (viewport), and the cells their own
    position occupies.
    """

    user_id: uuid.UUID
    username: str
    websocket: WebSocket
    viewport_cells: set[str] = field(default_factory=set)
    active_resolution: int = 7

    async def send(self, message: dict) -> bool:
        """Send a JSON message. Returns False if the connection is dead."""
        try:
            await self.websocket.send_json(message)
            return True
        except Exception:
            return False


@dataclass
class CellTransition:
    """Result of a position update — describes which cells changed.

    Used by the handler to determine which watchers need to be notified
    about enter/exit/move events.
    """

    entered: set[str] = field(default_factory=set)
    exited: set[str] = field(default_factory=set)
    stayed: set[str] = field(default_factory=set)


@dataclass
class ViewportTransition:
    """Result of a viewport update — describes which watched cells changed.

    Used by the handler to send snapshots for newly visible cells.
    """

    added: set[str] = field(default_factory=set)
    removed: set[str] = field(default_factory=set)
