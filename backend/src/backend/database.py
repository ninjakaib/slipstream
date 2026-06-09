"""SQLAlchemy async engine and session factory."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session.

    Uses begin() to manage the transaction explicitly:
    - Commits automatically on successful exit.
    - Rolls back on exception.

    This avoids issuing unnecessary COMMIT on read-only requests
    while still being safe for write operations.
    """
    async with async_session_factory() as session:
        async with session.begin():
            yield session
