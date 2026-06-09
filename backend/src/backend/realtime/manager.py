"""WebSocket connection manager.

Tracks all active WebSocket connections, their channel subscriptions,
and provides message dispatching to individual users or channel groups.
"""

import logging
import uuid
from dataclasses import dataclass, field

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class UserConnection:
    """An active WebSocket connection for a user."""

    user_id: uuid.UUID
    username: str
    websocket: WebSocket

    # Channels this connection is subscribed to (e.g. "location:uuid", "convoy:uuid")
    subscribed_channels: set[str] = field(default_factory=set)

    # The geographic area this user is watching for nearby drivers
    subscribe_lat: float | None = None
    subscribe_lng: float | None = None
    subscribe_radius_miles: float = 15.0

    # Convoy the user is currently in (for quick lookup)
    convoy_id: uuid.UUID | None = None

    # Cached friend IDs (loaded on connect, refreshed periodically)
    friend_ids: set[uuid.UUID] = field(default_factory=set)


class ConnectionManager:
    """Manages WebSocket connections and message routing.

    This is an in-memory, per-instance structure. In a multi-instance deployment,
    Redis pub/sub handles cross-instance fanout — each instance only manages
    its own local connections.
    """

    def __init__(self) -> None:
        # user_id -> UserConnection
        self._connections: dict[uuid.UUID, UserConnection] = {}
        # channel -> set of user_ids subscribed to it
        self._channel_subscribers: dict[str, set[uuid.UUID]] = {}

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    def connect(
        self, user_id: uuid.UUID, username: str, websocket: WebSocket
    ) -> UserConnection:
        """Register a new WebSocket connection. Replaces any existing connection for this user."""
        # If user already has a connection, disconnect the old one
        if user_id in self._connections:
            self.disconnect(user_id)

        conn = UserConnection(user_id=user_id, username=username, websocket=websocket)
        self._connections[user_id] = conn
        return conn

    def disconnect(self, user_id: uuid.UUID) -> None:
        """Remove a WebSocket connection and clean up all subscriptions."""
        conn = self._connections.pop(user_id, None)
        if conn is None:
            return

        # Remove from all channel subscriber sets
        for channel in conn.subscribed_channels:
            subs = self._channel_subscribers.get(channel)
            if subs:
                subs.discard(user_id)
                if not subs:
                    del self._channel_subscribers[channel]

        logger.debug(f"Disconnected user {user_id}")

    def get_connection(self, user_id: uuid.UUID) -> UserConnection | None:
        """Get a connection by user_id, or None if not connected."""
        return self._connections.get(user_id)

    def is_connected(self, user_id: uuid.UUID) -> bool:
        """Check if a user has an active WebSocket connection."""
        return user_id in self._connections

    def subscribe(self, user_id: uuid.UUID, channel: str) -> None:
        """Subscribe a connection to a pub/sub channel."""
        conn = self._connections.get(user_id)
        if conn is None:
            return

        conn.subscribed_channels.add(channel)
        if channel not in self._channel_subscribers:
            self._channel_subscribers[channel] = set()
        self._channel_subscribers[channel].add(user_id)

    def unsubscribe(self, user_id: uuid.UUID, channel: str) -> None:
        """Unsubscribe a connection from a pub/sub channel."""
        conn = self._connections.get(user_id)
        if conn:
            conn.subscribed_channels.discard(channel)

        subs = self._channel_subscribers.get(channel)
        if subs:
            subs.discard(user_id)
            if not subs:
                del self._channel_subscribers[channel]

    def get_subscribers(self, channel: str) -> set[uuid.UUID]:
        """Get all locally-connected user_ids subscribed to a channel."""
        return self._channel_subscribers.get(channel, set()).copy()

    def get_all_connections(self) -> list[UserConnection]:
        """Get all active connections (for iteration in background tasks)."""
        return list(self._connections.values())

    async def send_to_user(self, user_id: uuid.UUID, message: dict) -> bool:
        """Send a JSON message to a specific user. Returns True if sent successfully."""
        conn = self._connections.get(user_id)
        if conn is None:
            return False

        try:
            await conn.websocket.send_json(message)
            return True
        except Exception:
            # Connection is dead — clean up
            self.disconnect(user_id)
            return False

    async def broadcast_to_channel(
        self,
        channel: str,
        message: dict,
        exclude: uuid.UUID | None = None,
    ) -> None:
        """Send a message to all local subscribers of a channel."""
        subscribers = self.get_subscribers(channel)
        for uid in subscribers:
            if uid == exclude:
                continue
            await self.send_to_user(uid, message)

    async def broadcast_to_users(
        self,
        user_ids: set[uuid.UUID],
        message: dict,
        exclude: uuid.UUID | None = None,
    ) -> None:
        """Send a message to a specific set of users."""
        for uid in user_ids:
            if uid == exclude:
                continue
            await self.send_to_user(uid, message)


# Singleton instance — shared across the application
manager = ConnectionManager()
