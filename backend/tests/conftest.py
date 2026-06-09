"""Pytest configuration and fixtures for backend integration tests.

Run with:
    cd backend
    uv run pytest tests/ -v
"""

import asyncio
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from backend.auth import create_access_token, hash_password
from backend.database import get_db
from backend.main import app
from backend.models import Base, User, Car, Friendship, FriendshipStatus


# Use in-memory SQLite for tests (fast, no external deps)
# NOTE: SQLite lacks PostGIS, so spatial queries won't work in unit tests.
# For those, use the Docker Compose stack with the integration test script.
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for all tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create a fresh test database engine for each test."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for tests."""
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    """HTTP test client with database override and mocked Redis."""
    Session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    # Mock Redis to avoid needing a real Redis instance
    mock_redis = AsyncMock()
    mock_redis.geoadd = AsyncMock(return_value=1)
    mock_redis.hset = AsyncMock(return_value=1)
    mock_redis.expire = AsyncMock(return_value=True)
    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.publish = AsyncMock(return_value=1)
    mock_redis.pipeline = AsyncMock()

    with patch("backend.redis.get_redis", return_value=mock_redis):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user in the database."""
    user = User(
        username="testdriver",
        password_hash=hash_password("testpass123"),
        display_name="Test Driver",
        email="test@slipstream.app",
        visibility="on",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_token(test_user: User) -> str:
    """Create an access token for the test user."""
    return create_access_token(test_user.id, test_user.username)


@pytest_asyncio.fixture
async def second_user(db_session: AsyncSession) -> User:
    """Create a second test user."""
    user = User(
        username="seconddriver",
        password_hash=hash_password("testpass123"),
        display_name="Second Driver",
        email="second@slipstream.app",
        visibility="on",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def second_user_token(second_user: User) -> str:
    """Create an access token for the second user."""
    return create_access_token(second_user.id, second_user.username)


@pytest_asyncio.fixture
async def friends(db_session: AsyncSession, test_user: User, second_user: User) -> Friendship:
    """Create an accepted friendship between the two test users."""
    friendship = Friendship(
        requester_id=test_user.id,
        addressee_id=second_user.id,
        status=FriendshipStatus.ACCEPTED,
    )
    db_session.add(friendship)
    await db_session.commit()
    await db_session.refresh(friendship)
    return friendship
