<!-- refreshed: 2026-06-10 -->
# Architecture

**Analysis Date:** 2026-06-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    iOS SwiftUI Client                        │
│                   `SlipStream/`                              │
│   Views → ViewModel → (WebSocket + HTTP to backend)         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                      │
│               `backend/src/backend/`                         │
├──────────────────┬──────────────────┬───────────────────────┤
│  HTTP REST API   │  WebSocket Layer │   Redis Pub/Sub       │
│  `routers/`      │  `realtime/`     │   `redis.py`          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  PostgreSQL DB   │  │   Redis Store    │  │  Redis Pub/Sub  │
│  `models.py`     │  │  (geo + state)   │  │  (fanout)       │
└──────────────────┘  └──────────────────┘  └─────────────────┘
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

**Overall:** Hybrid REST + WebSocket architecture with Redis-backed real-time state

**Key Characteristics:**
- HTTP REST API for CRUD operations (users, cars, convoys, friendships)
- WebSocket for real-time location updates and pub/sub messaging
- Redis GEO for geographic proximity queries (nearby drivers)
- Redis pub/sub for cross-instance message fanout (location:*, convoy:* channels)
- PostgreSQL for persistent relational data
- FastAPI dependency injection for auth and database sessions
- SwiftUI MVVM pattern on iOS client

## Layers

**Presentation Layer (iOS):**
- Purpose: SwiftUI views and user interaction
- Location: `SlipStream/`
- Contains: View structs, navigation, sheet presentations, map integration
- Depends on: SlipStreamViewModel (state), MapBox Navigation SDK
- Used by: End users

**State Management (iOS):**
- Purpose: Observable app state and business logic
- Location: `SlipStream/SlipStreamViewModel.swift`
- Contains: @Published properties, convoy/driver state, demo data
- Depends on: SwiftUI Combine, CoreLocation
- Used by: All SwiftUI views via @EnvironmentObject

**API Layer (Backend):**
- Purpose: HTTP REST endpoints for resource operations
- Location: `backend/src/backend/routers/`
- Contains: Auth, users, cars, friends, convoys, discovery endpoints
- Depends on: FastAPI, database sessions, current user dependency
- Used by: iOS client (HTTP), WebSocket handlers (internal)

**Real-Time Layer (Backend):**
- Purpose: WebSocket connections, location streaming, pub/sub dispatch
- Location: `backend/src/backend/realtime/`
- Contains: WebSocket router, connection manager, message handlers, event publishers
- Depends on: Redis, database sessions, FastAPI WebSocket
- Used by: iOS client (WebSocket)

**Data Access Layer (Backend):**
- Purpose: Database ORM and session management
- Location: `backend/src/backend/models.py`, `backend/src/backend/database.py`
- Contains: SQLAlchemy models, async session factory
- Depends on: SQLAlchemy, asyncpg, GeoAlchemy2
- Used by: All routers and handlers

**Caching/State Layer (Backend):**
- Purpose: Real-time position storage, pub/sub fanout, presence tracking
- Location: `backend/src/backend/redis.py`
- Contains: Redis connection pool, pub/sub listener background task
- Depends on: Redis server
- Used by: Realtime handlers, routers (discovery)

## Data Flow

### Primary Request Path (HTTP CRUD)

1. iOS client → HTTP request to FastAPI endpoint (`backend/src/backend/routers/*.py`)
2. `get_current_user` dependency extracts JWT and loads User from database (`backend/src/backend/dependencies.py:19`)
3. Route handler performs database operations via async session (`backend/src/backend/database.py:22`)
4. Response returned as Pydantic model

### Real-Time Location Update Path

1. iOS client → WebSocket message `location_update` (`backend/src/backend/realtime/router.py:52`)
2. `handle_location_update` validates coordinates (`backend/src/backend/realtime/handlers.py:42`)
3. Update Redis GEO set and position hash (`backend/src/backend/realtime/handlers.py:75`)
4. Publish to `location:{user_id}` channel (`backend/src/backend/realtime/handlers.py:100`)
5. Pub/sub listener receives message (`backend/src/backend/redis.py:120`)
6. Dispatch to locally-connected subscribers (`backend/src/backend/redis.py:131`)

### Convoy Chat Flow

1. iOS client → WebSocket message `convoy_message` (`backend/src/backend/realtime/router.py:202`)
2. `handle_convoy_message` validates convoy membership (`backend/src/backend/realtime/handlers.py`)
3. Insert ConvoyMessage into database
4. `publish_convoy_chat` publishes to `convoy:{convoy_id}` channel (`backend/src/backend/realtime/events.py`)
5. All convoy members receive message via pub/sub fanout

**State Management:**
- Ephemeral state: Redis (positions, presence, TTL-based expiry)
- Persistent state: PostgreSQL (users, cars, friendships, convoys, messages)
- Client state: SlipStreamViewModel (SwiftUI @Published properties)

## Key Abstractions

**UserConnection:**
- Purpose: Represents an active WebSocket connection
- Examples: `backend/src/backend/realtime/manager.py:16`
- Pattern: Dataclass with subscribed channels, friend IDs, convoy ID, geographic subscription area

**ConnectionManager:**
- Purpose: Singleton managing all WebSocket connections and channel subscriptions
- Examples: `backend/src/backend/realtime/manager.py:39`
- Pattern: In-memory registry with user_id → connection mapping, channel → subscribers mapping

**Redis Pub/Sub Listener:**
- Purpose: Background task subscribed to Redis patterns, dispatches to local WebSocket connections
- Examples: `backend/src/backend/redis.py:95`
- Pattern: Asyncio task with automatic reconnect and exponential backoff

**SQLAlchemy ORM Models:**
- Purpose: Type-safe database entities with relationships
- Examples: `backend/src/backend/models.py` (User, Car, Convoy, Friendship, etc.)
- Pattern: Declarative base with mapped columns, enums, indexes

**FastAPI Dependency Injection:**
- Purpose: Reusable auth and database session providers
- Examples: `get_current_user` (`backend/src/backend/dependencies.py:19`), `get_db` (`backend/src/backend/database.py:22`)
- Pattern: Async generators yielding resources (auto-cleanup on exit)

## Entry Points

**Backend HTTP/WebSocket:**
- Location: `backend/src/backend/main.py`
- Triggers: uvicorn ASGI server
- Responsibilities: Register routers, initialize Redis, start pub/sub listener, health check endpoint

**iOS App:**
- Location: `SlipStream/SlipStreamApp.swift`
- Triggers: iOS app launch
- Responsibilities: Bootstrap SwiftUI WindowGroup with ContentView

**iOS Root View:**
- Location: `SlipStream/ContentView.swift`
- Triggers: WindowGroup body
- Responsibilities: Initialize SlipStreamViewModel, provide via @EnvironmentObject to AppRootView

**WebSocket Connection:**
- Location: `backend/src/backend/realtime/router.py:52`
- Triggers: WebSocket client connection with JWT token query param
- Responsibilities: Authenticate, establish connection, start message loop, handle graceful disconnect

## Architectural Constraints

- **Threading:** Single-threaded async event loop (asyncio) on backend; all I/O is async. SwiftUI main actor for UI updates.
- **Global state:** 
  - `backend/src/backend/realtime/manager.py:165` — singleton ConnectionManager instance
  - `backend/src/backend/redis.py:19-24` — module-level Redis pool and pub/sub task
  - `backend/src/backend/database.py:9` — module-level SQLAlchemy engine
- **Circular imports:** None detected. Backend uses absolute imports from `backend.*`. iOS uses simple file-based modules.
- **WebSocket limitations:** One active WebSocket per user. New connection from same user disconnects old one.
- **Redis TTL constraints:** Position data expires after 120s, presence after 30s. Clients must send heartbeats/location updates to stay visible.
- **Rate limits:** Location updates rate-limited to 1/second per connection (`backend/src/backend/realtime/router.py:49`)

## Anti-Patterns

### Blocking I/O in Async Context

**What happens:** Using synchronous libraries (e.g., `psycopg2` instead of `asyncpg`) blocks the event loop, degrading real-time performance.
**Why it's wrong:** FastAPI's async routes and WebSocket handlers require non-blocking I/O. Blocking calls freeze all concurrent requests on the same worker.
**Do this instead:** Use async database drivers (`asyncpg`, `aiosqlite`), async Redis client (`redis.asyncio`), async HTTP clients (`httpx`). See `backend/src/backend/database.py:9` for correct async engine setup.

### Storing Secrets in Code

**What happens:** Hardcoded API keys, JWT secrets, database passwords in source files.
**Why it's wrong:** Secrets leak in version control, CI logs, and to anyone with repo access.
**Do this instead:** Use environment variables loaded via `pydantic-settings`. See `backend/src/backend/config.py:6` for the Settings pattern. Never commit `.env` files.

### Missing Database Indexes on Foreign Keys

**What happens:** Queries filtering by `user_id`, `convoy_id`, etc. perform full table scans as tables grow.
**Why it's wrong:** WebSocket handlers query friendships and convoy memberships frequently. Without indexes, response time degrades linearly with data size.
**Do this instead:** Declare `index=True` on all foreign key columns. See `backend/src/backend/models.py:144` (Car.user_id), `backend/src/backend/models.py:180` (Friendship.requester_id).

## Error Handling

**Strategy:** Exceptions propagate to FastAPI exception handlers. WebSocket errors caught per-message to avoid killing connection.

**Patterns:**
- HTTP: Raise `HTTPException` with appropriate status codes (401, 404, 409, etc.)
- WebSocket: Catch exceptions per message, send error response, continue (`backend/src/backend/realtime/router.py:222`)
- Database: SQLAlchemy exceptions (IntegrityError, NoResultFound) caught and translated to HTTP errors
- Redis: Pub/sub listener auto-reconnects with exponential backoff (`backend/src/backend/redis.py:110`)

## Cross-Cutting Concerns

**Logging:** Python `logging` module with structured messages. Log level controlled by `settings.debug`. Logger instances per module (`logger = logging.getLogger(__name__)`).

**Validation:** Pydantic models for all request/response schemas. Field constraints (min_length, pattern, ge/le) enforced at serialization boundaries.

**Authentication:** JWT access tokens (15min TTL) + refresh tokens (30 day TTL) with rotation. `get_current_user` dependency injects authenticated user into protected routes (`backend/src/backend/dependencies.py:19`). WebSocket authenticates via token query param (`backend/src/backend/realtime/router.py:60`).

---

*Architecture analysis: 2026-06-10*
