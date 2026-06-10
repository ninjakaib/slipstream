# Testing Patterns

**Analysis Date:** 2026-06-10

## Test Framework

**Runner:**
- pytest 8.0.0+
- Config: `backend/pyproject.toml`

**Assertion Library:**
- pytest built-in assertions
- Pattern: `assert resp.status_code == 200`, `assert data["username"] == "testdriver"`

**Additional Plugins:**
- pytest-asyncio 0.24.0+ (async test support)
- httpx 0.27.0+ (async HTTP client for API testing)

**Run Commands:**
```bash
cd backend
uv run pytest tests/ -v          # Run all tests with verbose output
uv run pytest tests/test_auth.py # Run specific test file
uv run pytest -k test_login      # Run tests matching pattern
```

## Test File Organization

**Location:**
- Backend tests: `backend/tests/`
- Co-located pattern (not separate from source)

**Naming:**
- Test files: `test_<module>.py` - `test_auth.py`, `test_cars.py`, `test_friends.py`
- Configuration: `conftest.py` - shared fixtures and test setup

**Structure:**
```
backend/
├── src/backend/          # Application code
│   ├── routers/
│   │   ├── auth.py
│   │   ├── users.py
│   │   └── friends.py
│   └── models.py
└── tests/                # Test suite
    ├── conftest.py       # Shared fixtures
    ├── test_auth.py      # Auth endpoint tests
    ├── test_cars.py      # Car endpoint tests
    └── test_friends.py   # Friend endpoint tests
```

## Test Structure

**Suite Organization:**
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "username": "newuser",
            "password": "securepass123",
        })
        assert resp.status_code == 201
        assert "access_token" in resp.json()

    async def test_register_duplicate_username(self, client: AsyncClient, test_user: User):
        resp = await client.post("/auth/register", json={
            "username": test_user.username,
            "password": "securepass123",
        })
        assert resp.status_code == 409
```

**Patterns:**
- Test classes group related tests: `TestRegister`, `TestLogin`, `TestRefresh`
- All async tests decorated with `@pytest.mark.asyncio`
- Test methods prefixed with `test_`
- Descriptive names: `test_register_success`, `test_login_wrong_password`, `test_cannot_delete_only_car`

**Setup Pattern:**
- Fixtures handle setup (no explicit setup/teardown methods in test classes)
- Function-scoped fixtures for isolation: `@pytest_asyncio.fixture(scope="function")`

**Teardown Pattern:**
- Database teardown in fixture:
```python
@pytest_asyncio.fixture(scope="function")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, ...)
    # Setup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    # Teardown
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
```

**Assertion Pattern:**
- Direct assertions on response attributes
- Status code checks first: `assert resp.status_code == 200`
- Data validation: `assert data["username"] == "testdriver"`
- Membership checks: `assert "access_token" in data`
- Flexible status codes for implementation variations: `assert resp.status_code in (400, 409)`

## Mocking

**Framework:** unittest.mock (standard library)

**Patterns:**
```python
from unittest.mock import AsyncMock, patch

# Mock Redis to avoid external dependency
mock_redis = AsyncMock()
mock_redis.geoadd = AsyncMock(return_value=1)
mock_redis.hset = AsyncMock(return_value=1)
mock_redis.publish = AsyncMock(return_value=1)

with patch("backend.redis.get_redis", return_value=mock_redis):
    # Test code that uses Redis
    ...
```

**What to Mock:**
- External services: Redis mocked in all tests
- Expensive operations: Real-time features, pub/sub
- Network calls to third-party APIs (when added)

**What NOT to Mock:**
- Database operations - use SQLite in-memory test database instead
- FastAPI application logic
- Authentication/authorization logic
- Business logic and domain models

**Test Database Strategy:**
- In-memory SQLite for fast unit tests: `sqlite+aiosqlite:///./test.db`
- StaticPool for concurrent access: `poolclass=StaticPool`
- Full schema created per test: `Base.metadata.create_all()`
- Limitation documented: PostGIS spatial queries don't work in SQLite tests

## Fixtures and Factories

**Fixture Location:**
- `backend/tests/conftest.py` - shared fixtures for all tests

**Event Loop Fixture:**
```python
@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for all tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
```

**Database Fixtures:**
```python
@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create a fresh test database engine for each test."""
    # Returns configured engine

@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for tests."""
    # Returns session for direct DB manipulation
```

**HTTP Client Fixture:**
```python
@pytest_asyncio.fixture(scope="function")
async def client(db_engine) -> AsyncGenerator[AsyncClient, None]:
    """HTTP test client with database override and mocked Redis."""
    # Override get_db dependency
    app.dependency_overrides[get_db] = override_get_db
    
    # Mock Redis
    with patch("backend.redis.get_redis", return_value=mock_redis):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    
    app.dependency_overrides.clear()
```

**User Fixtures:**
```python
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
```

**Multiple User Fixtures:**
- `test_user` - primary test user
- `second_user` - for testing interactions between users
- `test_user_token` / `second_user_token` - auth tokens for each

**Relationship Fixtures:**
```python
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
```

**Fixture Pattern:**
- Function-scoped for isolation (default)
- Async fixtures use `@pytest_asyncio.fixture`
- Type hints for clarity: `-> User`, `-> str`, `-> Friendship`
- Commit and refresh ORM objects before returning

## Coverage

**Requirements:** No explicit coverage target enforced

**View Coverage:**
```bash
cd backend
uv run pytest tests/ --cov=backend --cov-report=html
```

**Current State:**
- Coverage tooling not in dependencies (would need pytest-cov)
- No CI/CD coverage enforcement

## Test Types

**Unit Tests:**
- Not explicitly separated from integration tests
- Focus on single endpoint behavior
- Example: `test_register_invalid_username_too_short` - validation logic only

**Integration Tests:**
- Primary test type in current suite
- Full HTTP request/response cycle
- Database persistence verified
- Example: `test_accept_friend_request` - multi-step workflow

**E2E Tests:**
- Not implemented
- No WebSocket testing observed
- No full user journey tests

## Common Patterns

**Async Testing:**
```python
@pytest.mark.asyncio
async def test_login_success(self, client: AsyncClient, test_user: User):
    resp = await client.post("/auth/login", json={
        "username": "testdriver",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testdriver"
```

**Error Testing:**
```python
async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
    resp = await client.post("/auth/login", json={
        "username": "testdriver",
        "password": "wrongpass",
    })
    assert resp.status_code == 401

async def test_register_duplicate_username(self, client: AsyncClient, test_user: User):
    resp = await client.post("/auth/register", json={
        "username": test_user.username,
        "password": "securepass123",
    })
    assert resp.status_code == 409
```

**Authentication Testing:**
```python
# With auth token
async def test_valid_token_accepted(self, client: AsyncClient, test_user_token: str):
    resp = await client.get("/users/me", headers={
        "Authorization": f"Bearer {test_user_token}"
    })
    assert resp.status_code == 200

# Without auth token
async def test_no_token_rejected(self, client: AsyncClient):
    resp = await client.get("/users/me")
    assert resp.status_code in (401, 403)
```

**Multi-Step Workflows:**
```python
async def test_accept_friend_request(
    self, client: AsyncClient, test_user_token: str,
    second_user_token: str, test_user: User, second_user: User
):
    # Step 1: Send request
    await client.post("/friends/request", json={
        "user_id": str(second_user.id),
    }, headers={"Authorization": f"Bearer {test_user_token}"})

    # Step 2: Get pending requests
    pending_resp = await client.get("/friends/requests", headers={
        "Authorization": f"Bearer {second_user_token}"
    })
    assert pending_resp.status_code == 200
    requests = pending_resp.json()
    assert len(requests) >= 1

    # Step 3: Accept it
    request_id = requests[0]["id"]
    accept_resp = await client.post("/friends/accept", json={
        "request_id": request_id,
    }, headers={"Authorization": f"Bearer {second_user_token}"})
    assert accept_resp.status_code == 200
```

## pytest Configuration

**pyproject.toml:**
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**Settings:**
- `asyncio_mode = "auto"` - automatic async test detection
- `testpaths = ["tests"]` - pytest searches `backend/tests/` directory

## Test Execution

**Standard Run:**
27 tests collected across 4 modules:
- `test_auth.py` - 13 tests (register, login, refresh, protected endpoints)
- `test_cars.py` - 4+ tests (CRUD operations)
- `test_friends.py` - 5+ tests (friend requests, accept/decline)
- `test_convoys.py` - Additional tests

**Fast Execution:**
- SQLite in-memory database (no Docker required)
- Mocked Redis (no external service)
- StaticPool for concurrency

## Swift Testing

**Current State:**
- No Swift tests observed in `SlipStreamTests/` directory
- No XCTest files found
- SwiftUI preview-based development

**Future Pattern:**
- XCTest for unit tests
- XCUITest for UI tests
- Location: `SlipStreamTests/` and `SlipStreamUITests/` directories present but empty

---

*Testing analysis: 2026-06-10*
