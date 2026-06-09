"""SlipStream FastAPI application."""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI

from backend.config import settings
from backend.routers.auth import router as auth_router
from backend.routers.users import router as users_router
from backend.routers.cars import router as cars_router
from backend.routers.friends import router as friends_router
from backend.routers.convoys import router as convoys_router
from backend.routers.discovery import router as discovery_router
from backend.realtime import ws_router
from backend.redis import init_redis, close_redis, start_pubsub_listener

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown logic."""
    # Startup
    logger.info("Starting up SlipStream...")
    await init_redis()
    await start_pubsub_listener()
    logger.info("SlipStream ready.")

    yield

    # Shutdown
    logger.info("Shutting down SlipStream...")
    await close_redis()

    from backend.database import engine

    await engine.dispose()

    logger.info("SlipStream shut down.")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Real-time social driving network for car enthusiasts.",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(cars_router)
app.include_router(friends_router)
app.include_router(convoys_router)
app.include_router(discovery_router)
app.include_router(ws_router)


# ---------------------------------------------------------------------------
# Health check (unprotected)
# ---------------------------------------------------------------------------


@app.get("/health", tags=["system"])
async def health_check() -> dict:
    """Basic health check endpoint."""
    from backend.realtime.manager import manager

    return {
        "status": "ok",
        "service": settings.app_name,
        "active_connections": manager.connection_count,
    }
