# Coding Conventions

**Analysis Date:** 2026-06-10

## Naming Patterns

**Python Files:**
- snake_case: `auth.py`, `models.py`, `dependencies.py`
- Router modules: `routers/auth.py`, `routers/users.py`, `routers/friends.py`
- Test files: `test_auth.py`, `test_cars.py`, `test_friends.py`

**Swift Files:**
- PascalCase with descriptive suffixes: `SlipStreamApp.swift`, `SlipStreamViewModel.swift`
- View suffix for SwiftUI views: `ContentView.swift`, `ProfileView.swift`, `MapHomeView.swift`
- Model files: `SlipStreamModels.swift`
- Style files: `SlipStreamStyle.swift`

**Python Functions:**
- snake_case: `hash_password()`, `verify_password()`, `create_access_token()`
- Private helpers prefixed with underscore: `_escape_like()`, `_get_active_car()`, `_enum_values()`
- Async functions use `async def`: `async def get_current_user()`, `async def get_db()`
- Route handlers are async and descriptive: `async def register()`, `async def update_my_profile()`

**Python Classes:**
- PascalCase for classes: `User`, `Car`, `Friendship`, `Convoy`
- Enum classes use PascalCase with StrEnum: `VisibilityMode`, `SpeedUnit`, `FriendshipStatus`
- Pydantic models use PascalCase with descriptive suffixes: `RegisterRequest`, `TokenResponse`, `UserProfile`
- Request/Response suffixes: `UpdateProfileRequest`, `MessageResponse`, `CarResponse`

**Swift Types:**
- PascalCase for structs/classes: `Driver`, `Vehicle`, `Convoy`, `MeetupSpot`
- Enums use PascalCase: `DriverStatus`, `VisibilityMode`, `ConvoyVibe`, `MapFilter`
- View model suffix: `SlipStreamViewModel`

**Python Variables:**
- snake_case: `user_id`, `access_token`, `refresh_token`, `convoy_id`
- Constants in SCREAMING_SNAKE_CASE: `TEST_DATABASE_URL`

**Swift Properties:**
- camelCase: `myCoordinate`, `joinedConvoyID`, `isDrivingMode`, `currentSpeed`
- Published properties: `@Published var drivers: [Driver]`
- Boolean prefixes: `is`/`has` - `isDrivingMode`, `isActive`, `isFriend`, `isPublic`

## Code Style

**Python Formatting:**
- No explicit formatter configured (no .prettierrc, .ruff.toml, or black config)
- Indentation: 4 spaces (standard Python)
- Line length: Generally kept under 88-100 characters
- String quotes: Double quotes preferred for strings
- Docstrings: Triple double-quotes with description

**Python Linting:**
- No explicit linter config files detected
- Type hints used throughout: `def hash_password(password: str) -> str`
- SQLAlchemy type hints: `Mapped[str]`, `Mapped[uuid.UUID]`
- Optional types: `str | None`, `list[str] | None`

**Swift Formatting:**
- Indentation: 4 spaces
- Brace style: Opening brace on same line
- Line length: Generally kept reasonable (~80-120 characters)

## Import Organization

**Python Order:**
1. Standard library imports
2. Third-party imports (FastAPI, SQLAlchemy, Pydantic, etc.)
3. Local application imports from `backend.*`

**Python Pattern:**
```python
# Standard library
import uuid
from datetime import UTC, datetime, timedelta

# Third-party
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Local
from backend.auth import create_access_token, hash_password
from backend.database import get_db
from backend.models import User, Car
```

**Python Path Style:**
- Absolute imports from `backend` package root
- No relative imports observed

**Swift Order:**
1. SwiftUI/UIKit framework imports
2. Third-party SDKs (MapboxMaps, MapboxNavigationCore)
3. Foundation/Core imports

**Swift Pattern:**
```swift
import SwiftUI
import Combine
import CoreLocation
import MapboxMaps
```

## Error Handling

**Python Patterns:**
- FastAPI HTTPException for API errors: `raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="...")`
- Status codes from `fastapi.status` module: `status.HTTP_404_NOT_FOUND`, `status.HTTP_409_CONFLICT`
- JWT-specific exceptions: `except jwt.ExpiredSignatureError:`, `except jwt.InvalidTokenError:`
- Specific exception handling over broad catches: `except ValueError:`, `except asyncio.CancelledError:`
- Broad exceptions logged: `except Exception as e: logger.error(...)`

**Python Error Messages:**
- User-facing detail field in HTTPException: `detail="Username already taken"`
- Include WWW-Authenticate header for auth failures: `headers={"WWW-Authenticate": "Bearer"}`

**Swift Patterns:**
- No explicit error handling observed in current views (demo data only)

## Logging

**Python Framework:** Standard library `logging` module

**Python Patterns:**
```python
import logging

logger = logging.getLogger(__name__)

# Log levels
logger.info("Starting up SlipStream...")
logger.error(f"Failed to process message: {e}")
logger.debug("Connection established")
```

**Configuration:**
- Centralized in `main.py`:
```python
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
```

**When to Log:**
- Application lifecycle events (startup, shutdown)
- Error conditions
- Important state changes

## Comments

**Python When to Comment:**
- Module docstrings at file top: `"""Auth router — registration, login, token refresh, logout."""`
- Function docstrings for non-obvious behavior
- Inline comments for complex logic or gotchas
- Type clarification: `# Direct lookup by SHA-256 hash — O(1) indexed query`

**Python Docstring Style:**
```python
def verify_refresh_token(token: str, hashed: str) -> bool:
    """Verify a refresh token against its stored SHA-256 hash."""
    return hashlib.sha256(token.encode()).hexdigest() == hashed
```

**Swift When to Comment:**
- File headers with creation date and author
- MARK comments for section organization: `// MARK: - Camera Mode`
- Inline comments for complex SwiftUI view logic

**Swift Comment Style:**
```swift
/// Defines how the map camera behaves
enum MapCameraMode: Equatable {
    /// Free-roaming explorer view (user can pan/zoom)
    case explorer(center: CLLocationCoordinate2D, zoom: Double, bearing: Double, pitch: Double)
    /// Locked driving view following the user's heading
    case driving
}
```

## Function Design

**Python Size:** 
- Route handlers: 20-60 lines typical
- Helper functions: 5-20 lines
- Complex operations broken into helpers

**Python Parameters:**
- FastAPI dependency injection via `Depends()`: `db: AsyncSession = Depends(get_db)`
- Pydantic models for request bodies: `body: RegisterRequest`
- Type hints required: `user_id: uuid.UUID`, `current_user: User`

**Python Return Values:**
- Pydantic response models: `-> TokenResponse`, `-> UserProfile`
- Type hints for all functions: `-> str`, `-> dict`, `-> bool`
- Async functions return coroutines: `async def` returns awaitable

**Swift Parameters:**
- Closures for callbacks: `onDriverSelected: (Driver) -> Void`
- Default values for optional params
- Labels for clarity at call site

## Module Design

**Python Exports:**
- No explicit `__all__` declarations
- Public API is everything not prefixed with underscore
- Private helpers prefixed: `def _escape_like(value: str) -> str`

**Python Module Structure:**
- Routers in `backend/routers/` with APIRouter instances
- Models centralized in `backend/models.py`
- Utilities in dedicated modules: `backend/auth.py`, `backend/dependencies.py`
- Configuration in `backend/config.py`

**Python Barrel Files:**
- `backend/routers/__init__.py` - empty
- `backend/realtime/__init__.py` - exports key components:
```python
from backend.realtime.manager import manager
from backend.realtime.router import router as ws_router
```

**Swift Module Design:**
- No explicit module declarations (single app target)
- Related functionality grouped in files
- Extensions for conformance at bottom of files

## Async Patterns

**Python Async/Await:**
- All database operations are async: `await db.execute()`, `await db.commit()`
- Redis operations are async: `await r.publish()`, `await r.hset()`
- Route handlers are async: `async def register(...)`
- Context managers: `async with Session() as session:`

**Python Type Hints:**
- Async generators: `AsyncGenerator[AsyncSession, None]`
- Coroutines use `async def`

**Swift Async:**
- `@MainActor` for view models: `@MainActor final class SlipStreamViewModel: ObservableObject`
- Combine publishers for reactive updates

## Database Patterns

**SQLAlchemy ORM:**
- Declarative models inherit from `Base`
- Type hints with `Mapped[]`: `Mapped[str]`, `Mapped[uuid.UUID]`
- Relationships defined: `relationship(back_populates="...")`
- Enums stored as strings: `Enum(VisibilityMode, name="...", values_callable=_enum_values)`

**Query Pattern:**
```python
result = await db.execute(
    select(User).where(User.id == user_id).options(selectinload(User.cars))
)
user = result.scalar_one_or_none()
```

**Database Sessions:**
- Injected via dependency: `db: AsyncSession = Depends(get_db)`
- Auto-commit on successful request (FastAPI middleware pattern)
- Explicit flush for intermediate operations: `await db.flush()`

## Pydantic Configuration

**Model Config:**
```python
class UserProfile(BaseModel):
    id: str
    username: str
    
    model_config = {"from_attributes": True}  # Enable ORM mode
```

**Field Validation:**
```python
username: str = Field(min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
password: str = Field(min_length=8, max_length=128)
discovery_radius_miles: int | None = Field(default=None, ge=1, le=100)
```

## API Design

**FastAPI Routers:**
- Prefix and tags: `APIRouter(prefix="/auth", tags=["auth"])`
- Status code specification: `@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)`
- Response models enforce output schema

**Endpoint Patterns:**
- RESTful conventions: GET `/users/{user_id}`, PATCH `/users/me`, DELETE `/friends/{user_id}`
- Current user endpoints use `/me`: `/users/me`, `/cars`
- Nested resources: `/convoys/{convoy_id}/members`, `/convoys/{convoy_id}/messages`

---

*Convention analysis: 2026-06-10*
