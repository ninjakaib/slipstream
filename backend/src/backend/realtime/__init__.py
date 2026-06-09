"""Real-time WebSocket communication package."""

from backend.realtime.manager import manager
from backend.realtime.router import router as ws_router

__all__ = ["manager", "ws_router"]
