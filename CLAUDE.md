<!-- GSD:project-start source:PROJECT.md -->
## Project

**SlipStream**

A real-time social driving app for car enthusiasts that combines live location sharing, convoy coordination, and turn-by-turn navigation — "Forza Horizon online lobby, but in real life." iOS-native SwiftUI client backed by a Python FastAPI server with PostgreSQL and Redis for real-time state.

**Core Value:** **Users can open the app, see who's out driving nearby, and join a drive in minutes.** If this loop doesn't feel instant and alive, nothing else matters.

### Constraints

- **Platform**: iOS-only (SwiftUI, minimum iOS 17)
- **Backend**: Existing FastAPI server — don't modify unless iOS needs new endpoints
- **Maps**: Mapbox SDK already integrated — build on it, don't switch
- **Auth**: Sign in with Apple required (only auth method for MVP)
- **Battery**: Location updates must be battery-efficient (adaptive rate per PRD)
- **Safety**: Driving mode must be glanceable, minimal interaction required
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.13 - Backend API (`backend/`)
- Swift - iOS app (`SlipStream/`)
- SQL - Database migrations (`backend/alembic/versions/`)
## Runtime
- Python 3.13
- uvicorn 0.49.0 - ASGI server
- SwiftUI - UI framework
- Xcode 26.3
- uv 0.7.12 - Python package manager
- Lockfile: `backend/uv.lock` (present)
- Swift Package Manager
- Dependencies managed via Xcode project
## Frameworks
- FastAPI 0.136.3 - Web framework
- SQLAlchemy 2.0.50 - ORM with async support
- Pydantic Settings 2.14.1 - Configuration management
- pytest 8.0.0 - Test framework
- pytest-asyncio 0.24.0 - Async test support
- httpx 0.27.0 - HTTP client for tests
- asyncpg 0.31.0 - PostgreSQL async driver
- Alembic 1.18.4 - Database migrations
- GeoAlchemy2 0.20.0 - PostGIS spatial extensions
- redis[asyncio] 8.0.0 - Redis async client
- websockets 13.0 - WebSocket protocol
- MapboxMaps 11.0.0+ - Map SDK
- MapboxNavigationCore - Navigation features
- SwiftUI - Declarative UI
- Combine - Reactive framework
- Docker Compose - Local development orchestration
- uv 0.7.12 - Fast Python package installer
- Docker BuildKit - Container builds
## Key Dependencies
- `fastapi>=0.136.3` - HTTP request routing, dependency injection
- `sqlalchemy[asyncio]>=2.0.50` - Database ORM, relationships, migrations
- `redis>=8.0.0` - Live location storage, pub/sub for real-time events
- `asyncpg>=0.31.0` - PostgreSQL connection driver
- `geoalchemy2>=0.20.0` - Spatial queries (PostGIS)
- `pyjwt>=2.13.0` - JWT access token generation/validation
- `bcrypt>=5.0.0` - Password hashing
- `MapboxMaps` - Map rendering, annotations, camera control
- `MapboxNavigationCore` - Turn-by-turn navigation, location tracking
- `uvicorn>=0.49.0` - ASGI server hosting FastAPI
- `pydantic-settings>=2.14.1` - Environment variable loading
## Configuration
- Configuration via environment variables
- Settings class: `backend/src/backend/config.py`
- Local development: `backend/.env` file (gitignored)
- Docker: Environment variables in `backend/docker-compose.yml`
- `backend/pyproject.toml` - Python project metadata, dependencies
- `backend/uv.lock` - Pinned dependency versions
- `backend/Dockerfile` - Multi-stage build (build, runtime-base, api, api-dev)
- `backend/docker-compose.yml` - Service orchestration
- `backend/alembic.ini` - Database migration configuration
- `SlipStream.xcodeproj/project.pbxproj` - Xcode project configuration
- `SlipStream/Info.plist` - App metadata
## Platform Requirements
- Docker & Docker Compose - Backend services
- Python 3.13 - Backend development
- Xcode 26.3+ - iOS development
- macOS - iOS app development
- PostgreSQL 17+ with PostGIS 3.5+ extension
- Redis 7+
- Docker runtime
- iOS deployment target: Not specified in project files (requires Xcode inspection)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- snake_case: `auth.py`, `models.py`, `dependencies.py`
- Router modules: `routers/auth.py`, `routers/users.py`, `routers/friends.py`
- Test files: `test_auth.py`, `test_cars.py`, `test_friends.py`
- PascalCase with descriptive suffixes: `SlipStreamApp.swift`, `SlipStreamViewModel.swift`
- View suffix for SwiftUI views: `ContentView.swift`, `ProfileView.swift`, `MapHomeView.swift`
- Model files: `SlipStreamModels.swift`
- Style files: `SlipStreamStyle.swift`
- snake_case: `hash_password()`, `verify_password()`, `create_access_token()`
- Private helpers prefixed with underscore: `_escape_like()`, `_get_active_car()`, `_enum_values()`
- Async functions use `async def`: `async def get_current_user()`, `async def get_db()`
- Route handlers are async and descriptive: `async def register()`, `async def update_my_profile()`
- PascalCase for classes: `User`, `Car`, `Friendship`, `Convoy`
- Enum classes use PascalCase with StrEnum: `VisibilityMode`, `SpeedUnit`, `FriendshipStatus`
- Pydantic models use PascalCase with descriptive suffixes: `RegisterRequest`, `TokenResponse`, `UserProfile`
- Request/Response suffixes: `UpdateProfileRequest`, `MessageResponse`, `CarResponse`
- PascalCase for structs/classes: `Driver`, `Vehicle`, `Convoy`, `MeetupSpot`
- Enums use PascalCase: `DriverStatus`, `VisibilityMode`, `ConvoyVibe`, `MapFilter`
- View model suffix: `SlipStreamViewModel`
- snake_case: `user_id`, `access_token`, `refresh_token`, `convoy_id`
- Constants in SCREAMING_SNAKE_CASE: `TEST_DATABASE_URL`
- camelCase: `myCoordinate`, `joinedConvoyID`, `isDrivingMode`, `currentSpeed`
- Published properties: `@Published var drivers: [Driver]`
- Boolean prefixes: `is`/`has` - `isDrivingMode`, `isActive`, `isFriend`, `isPublic`
## Code Style
- No explicit formatter configured (no .prettierrc, .ruff.toml, or black config)
- Indentation: 4 spaces (standard Python)
- Line length: Generally kept under 88-100 characters
- String quotes: Double quotes preferred for strings
- Docstrings: Triple double-quotes with description
- No explicit linter config files detected
- Type hints used throughout: `def hash_password(password: str) -> str`
- SQLAlchemy type hints: `Mapped[str]`, `Mapped[uuid.UUID]`
- Optional types: `str | None`, `list[str] | None`
- Indentation: 4 spaces
- Brace style: Opening brace on same line
- Line length: Generally kept reasonable (~80-120 characters)
## Import Organization
- Absolute imports from `backend` package root
- No relative imports observed
## Error Handling
- FastAPI HTTPException for API errors: `raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="...")`
- Status codes from `fastapi.status` module: `status.HTTP_404_NOT_FOUND`, `status.HTTP_409_CONFLICT`
- JWT-specific exceptions: `except jwt.ExpiredSignatureError:`, `except jwt.InvalidTokenError:`
- Specific exception handling over broad catches: `except ValueError:`, `except asyncio.CancelledError:`
- Broad exceptions logged: `except Exception as e: logger.error(...)`
- User-facing detail field in HTTPException: `detail="Username already taken"`
- Include WWW-Authenticate header for auth failures: `headers={"WWW-Authenticate": "Bearer"}`
- No explicit error handling observed in current views (demo data only)
## Logging
- Centralized in `main.py`:
- Application lifecycle events (startup, shutdown)
- Error conditions
- Important state changes
## Comments
- Module docstrings at file top: `"""Auth router — registration, login, token refresh, logout."""`
- Function docstrings for non-obvious behavior
- Inline comments for complex logic or gotchas
- Type clarification: `# Direct lookup by SHA-256 hash — O(1) indexed query`
- File headers with creation date and author
- MARK comments for section organization: `// MARK: - Camera Mode`
- Inline comments for complex SwiftUI view logic
## Function Design
- Route handlers: 20-60 lines typical
- Helper functions: 5-20 lines
- Complex operations broken into helpers
- FastAPI dependency injection via `Depends()`: `db: AsyncSession = Depends(get_db)`
- Pydantic models for request bodies: `body: RegisterRequest`
- Type hints required: `user_id: uuid.UUID`, `current_user: User`
- Pydantic response models: `-> TokenResponse`, `-> UserProfile`
- Type hints for all functions: `-> str`, `-> dict`, `-> bool`
- Async functions return coroutines: `async def` returns awaitable
- Closures for callbacks: `onDriverSelected: (Driver) -> Void`
- Default values for optional params
- Labels for clarity at call site
## Module Design
- No explicit `__all__` declarations
- Public API is everything not prefixed with underscore
- Private helpers prefixed: `def _escape_like(value: str) -> str`
- Routers in `backend/routers/` with APIRouter instances
- Models centralized in `backend/models.py`
- Utilities in dedicated modules: `backend/auth.py`, `backend/dependencies.py`
- Configuration in `backend/config.py`
- `backend/routers/__init__.py` - empty
- `backend/realtime/__init__.py` - exports key components:
- No explicit module declarations (single app target)
- Related functionality grouped in files
- Extensions for conformance at bottom of files
## Async Patterns
- All database operations are async: `await db.execute()`, `await db.commit()`
- Redis operations are async: `await r.publish()`, `await r.hset()`
- Route handlers are async: `async def register(...)`
- Context managers: `async with Session() as session:`
- Async generators: `AsyncGenerator[AsyncSession, None]`
- Coroutines use `async def`
- `@MainActor` for view models: `@MainActor final class SlipStreamViewModel: ObservableObject`
- Combine publishers for reactive updates
## Database Patterns
- Declarative models inherit from `Base`
- Type hints with `Mapped[]`: `Mapped[str]`, `Mapped[uuid.UUID]`
- Relationships defined: `relationship(back_populates="...")`
- Enums stored as strings: `Enum(VisibilityMode, name="...", values_callable=_enum_values)`
- Injected via dependency: `db: AsyncSession = Depends(get_db)`
- Auto-commit on successful request (FastAPI middleware pattern)
- Explicit flush for intermediate operations: `await db.flush()`
## Pydantic Configuration
## API Design
- Prefix and tags: `APIRouter(prefix="/auth", tags=["auth"])`
- Status code specification: `@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)`
- Response models enforce output schema
- RESTful conventions: GET `/users/{user_id}`, PATCH `/users/me`, DELETE `/friends/{user_id}`
- Current user endpoints use `/me`: `/users/me`, `/cars`
- Nested resources: `/convoys/{convoy_id}/members`, `/convoys/{convoy_id}/messages`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI App | HTTP routing, WebSocket endpoint, lifecycle management | `backend/src/backend/main.py` |
| Routers | REST endpoints for auth, users, cars, friends, convoys, discovery | `backend/src/backend/routers/*.py` |
| Realtime Module | WebSocket connection management, message dispatch, subscription refresh | `backend/src/backend/realtime/` |
| Models | SQLAlchemy ORM definitions for PostgreSQL schema | `backend/src/backend/models.py` |
| Redis Module | Connection pool, pub/sub listener task, real-time state | `backend/src/backend/redis.py` |
| Dependencies | Auth middleware, current user injection | `backend/src/backend/dependencies.py` |
| SwiftUI ViewModel | App state, demo data, convoy/driver management | `SlipStream/SlipStreamViewModel.swift` |
| SwiftUI Views | UI layer, map integration, navigation | `SlipStream/*.swift` |
## Pattern Overview
- HTTP REST API for CRUD operations (users, cars, convoys, friendships)
- WebSocket for real-time location updates and pub/sub messaging
- Redis GEO for geographic proximity queries (nearby drivers)
- Redis pub/sub for cross-instance message fanout (location:*, convoy:* channels)
- PostgreSQL for persistent relational data
- FastAPI dependency injection for auth and database sessions
- SwiftUI MVVM pattern on iOS client
## Layers
- Purpose: SwiftUI views and user interaction
- Location: `SlipStream/`
- Contains: View structs, navigation, sheet presentations, map integration
- Depends on: SlipStreamViewModel (state), MapBox Navigation SDK
- Used by: End users
- Purpose: Observable app state and business logic
- Location: `SlipStream/SlipStreamViewModel.swift`
- Contains: @Published properties, convoy/driver state, demo data
- Depends on: SwiftUI Combine, CoreLocation
- Used by: All SwiftUI views via @EnvironmentObject
- Purpose: HTTP REST endpoints for resource operations
- Location: `backend/src/backend/routers/`
- Contains: Auth, users, cars, friends, convoys, discovery endpoints
- Depends on: FastAPI, database sessions, current user dependency
- Used by: iOS client (HTTP), WebSocket handlers (internal)
- Purpose: WebSocket connections, location streaming, pub/sub dispatch
- Location: `backend/src/backend/realtime/`
- Contains: WebSocket router, connection manager, message handlers, event publishers
- Depends on: Redis, database sessions, FastAPI WebSocket
- Used by: iOS client (WebSocket)
- Purpose: Database ORM and session management
- Location: `backend/src/backend/models.py`, `backend/src/backend/database.py`
- Contains: SQLAlchemy models, async session factory
- Depends on: SQLAlchemy, asyncpg, GeoAlchemy2
- Used by: All routers and handlers
- Purpose: Real-time position storage, pub/sub fanout, presence tracking
- Location: `backend/src/backend/redis.py`
- Contains: Redis connection pool, pub/sub listener background task
- Depends on: Redis server
- Used by: Realtime handlers, routers (discovery)
## Data Flow
### Primary Request Path (HTTP CRUD)
### Real-Time Location Update Path
### Convoy Chat Flow
- Ephemeral state: Redis (positions, presence, TTL-based expiry)
- Persistent state: PostgreSQL (users, cars, friendships, convoys, messages)
- Client state: SlipStreamViewModel (SwiftUI @Published properties)
## Key Abstractions
- Purpose: Represents an active WebSocket connection
- Examples: `backend/src/backend/realtime/manager.py:16`
- Pattern: Dataclass with subscribed channels, friend IDs, convoy ID, geographic subscription area
- Purpose: Singleton managing all WebSocket connections and channel subscriptions
- Examples: `backend/src/backend/realtime/manager.py:39`
- Pattern: In-memory registry with user_id → connection mapping, channel → subscribers mapping
- Purpose: Background task subscribed to Redis patterns, dispatches to local WebSocket connections
- Examples: `backend/src/backend/redis.py:95`
- Pattern: Asyncio task with automatic reconnect and exponential backoff
- Purpose: Type-safe database entities with relationships
- Examples: `backend/src/backend/models.py` (User, Car, Convoy, Friendship, etc.)
- Pattern: Declarative base with mapped columns, enums, indexes
- Purpose: Reusable auth and database session providers
- Examples: `get_current_user` (`backend/src/backend/dependencies.py:19`), `get_db` (`backend/src/backend/database.py:22`)
- Pattern: Async generators yielding resources (auto-cleanup on exit)
## Entry Points
- Location: `backend/src/backend/main.py`
- Triggers: uvicorn ASGI server
- Responsibilities: Register routers, initialize Redis, start pub/sub listener, health check endpoint
- Location: `SlipStream/SlipStreamApp.swift`
- Triggers: iOS app launch
- Responsibilities: Bootstrap SwiftUI WindowGroup with ContentView
- Location: `SlipStream/ContentView.swift`
- Triggers: WindowGroup body
- Responsibilities: Initialize SlipStreamViewModel, provide via @EnvironmentObject to AppRootView
- Location: `backend/src/backend/realtime/router.py:52`
- Triggers: WebSocket client connection with JWT token query param
- Responsibilities: Authenticate, establish connection, start message loop, handle graceful disconnect
## Architectural Constraints
- **Threading:** Single-threaded async event loop (asyncio) on backend; all I/O is async. SwiftUI main actor for UI updates.
- **Global state:** 
- **Circular imports:** None detected. Backend uses absolute imports from `backend.*`. iOS uses simple file-based modules.
- **WebSocket limitations:** One active WebSocket per user. New connection from same user disconnects old one.
- **Redis TTL constraints:** Position data expires after 120s, presence after 30s. Clients must send heartbeats/location updates to stay visible.
- **Rate limits:** Location updates rate-limited to 1/second per connection (`backend/src/backend/realtime/router.py:49`)
## Anti-Patterns
### Blocking I/O in Async Context
### Storing Secrets in Code
### Missing Database Indexes on Foreign Keys
## Error Handling
- HTTP: Raise `HTTPException` with appropriate status codes (401, 404, 409, etc.)
- WebSocket: Catch exceptions per message, send error response, continue (`backend/src/backend/realtime/router.py:222`)
- Database: SQLAlchemy exceptions (IntegrityError, NoResultFound) caught and translated to HTTP errors
- Redis: Pub/sub listener auto-reconnects with exponential backoff (`backend/src/backend/redis.py:110`)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| mapbox-ios-patterns | Official integration patterns for Mapbox Maps SDK on iOS. Covers installation, adding markers, user location, custom data, styles, camera control, and featureset interactions. Based on official Mapbox documentation. | `.claude/skills/mapbox-ios-patterns/SKILL.md` |
| mapbox-mcp-devkit-patterns | Integration patterns for Mapbox MCP DevKit Server in AI coding assistants. Covers setup, style management, token management, validation workflows, and documentation access through MCP. Use when building Mapbox applications with AI coding assistance. | `.claude/skills/mapbox-mcp-devkit-patterns/SKILL.md` |
| mapbox-style-patterns | Common style patterns, layer configurations, and recipes for typical mapping scenarios including restaurant finders, real estate, data visualization, navigation, delivery/logistics, and more. Use when implementing specific map use cases or looking for proven style patterns. | `.claude/skills/mapbox-style-patterns/SKILL.md` |
| swiftui-design-principles | Design principles for building polished, native-feeling SwiftUI apps and widgets. Use this skill when creating or modifying SwiftUI views, iOS widgets (WidgetKit), or any native Apple UI. Ensures proper spacing, typography, colors, and widget implementations that look and feel like quality apps rather than AI-generated slop. | `.claude/skills/swiftui-design-principles/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
