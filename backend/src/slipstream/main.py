"""SlipStream FastAPI application."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.routing import APIRoute

from slipstream.config import settings
from slipstream.logging import setup_logging, get_logger, RequestLoggingMiddleware
from slipstream.routers.auth import router as auth_router
from slipstream.routers.users import router as users_router
from slipstream.routers.cars import router as cars_router
from slipstream.routers.friends import router as friends_router
from slipstream.routers.convoys import router as convoys_router
from slipstream.spatial import spatial_router

# Configure structured logging (must happen before any logger is used)
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown logic."""
    # Startup
    logger.info("Starting up SlipStream...")
    logger.info("SlipStream ready.")

    yield

    # Shutdown
    logger.info("Shutting down SlipStream...")

    from slipstream.database import engine

    await engine.dispose()

    logger.info("SlipStream shut down.")


def _generate_unique_id(route: APIRoute) -> str:
    """Generate operation IDs as 'tag-function_name' for clean SDK method names."""
    if route.tags:
        return f"{route.tags[0]}-{route.name}"
    return route.name


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Real-time social driving network for car enthusiasts.",
    generate_unique_id_function=_generate_unique_id,
    # lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware (outermost first — request logging wraps everything)
# ---------------------------------------------------------------------------

app.add_middleware(RequestLoggingMiddleware)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(cars_router)
app.include_router(friends_router)
app.include_router(convoys_router)
app.include_router(spatial_router)


# ---------------------------------------------------------------------------
# Health check (unprotected)
# ---------------------------------------------------------------------------


@app.get("/health", tags=["system"])
async def health_check() -> dict:
    """Basic health check endpoint."""
    from slipstream.spatial.store import spatial_store

    return {
        "status": "ok",
        "service": settings.app_name,
        "spatial": spatial_store.stats(),
    }
