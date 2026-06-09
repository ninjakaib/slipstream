"""SlipStream FastAPI application."""

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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — startup and shutdown logic."""
    # Startup
    yield
    # Shutdown
    from backend.database import engine

    await engine.dispose()


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


# ---------------------------------------------------------------------------
# Health check (unprotected)
# ---------------------------------------------------------------------------


@app.get("/health", tags=["system"])
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {"status": "ok", "service": settings.app_name}
