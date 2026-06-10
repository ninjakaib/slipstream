# Codebase Structure

**Analysis Date:** 2026-06-10

## Directory Layout

```
slipstream/
├── backend/                # Python FastAPI backend
│   ├── alembic/            # Database migrations
│   ├── scripts/            # Seed data, test clients
│   ├── src/
│   │   └── backend/        # Main backend package
│   │       ├── routers/    # REST API endpoints
│   │       └── realtime/   # WebSocket handlers
│   └── tests/              # pytest test suite
├── SlipStream/             # iOS SwiftUI app source
│   └── Assets.xcassets/    # App icons, colors
├── SlipStream.xcodeproj/   # Xcode project config
├── SlipStreamTests/        # iOS unit tests
├── SlipStreamUITests/      # iOS UI tests
├── docs/                   # Documentation
├── .claude/                # Claude skills and patterns
└── .planning/              # GSD planning artifacts
    └── codebase/           # Codebase maps (this doc)
```

## Directory Purposes

**backend/**
- Purpose: FastAPI backend server
- Contains: Python source, tests, migrations, Docker config
- Key files: `pyproject.toml` (dependencies), `alembic.ini` (migration config), `docker-compose.yml` (local dev stack)

**backend/src/backend/**
- Purpose: Main Python package with all backend logic
- Contains: FastAPI app, routers, models, auth, database, Redis integration
- Key files: `main.py` (app entry point), `models.py` (ORM), `database.py` (session factory)

**backend/src/backend/routers/**
- Purpose: REST API endpoint modules organized by resource
- Contains: `auth.py`, `users.py`, `cars.py`, `friends.py`, `convoys.py`, `discovery.py`
- Key files: Each router is a FastAPI APIRouter with prefix and tags

**backend/src/backend/realtime/**
- Purpose: WebSocket connection management and message handling
- Contains: `router.py` (WebSocket endpoint), `manager.py` (connection registry), `handlers.py` (message dispatch), `events.py` (pub/sub publishers)
- Key files: `router.py:52` (WebSocket endpoint), `manager.py:165` (singleton manager)

**backend/alembic/**
- Purpose: Database schema migrations
- Contains: Migration scripts, Alembic environment config
- Key files: `alembic/env.py` (migration runner), `alembic/versions/*.py` (migration history)

**backend/tests/**
- Purpose: pytest test suite
- Contains: Test modules per router, test fixtures
- Key files: `conftest.py` (shared fixtures), `test_*.py` (test modules)

**backend/scripts/**
- Purpose: Development and maintenance scripts
- Contains: Database seed script, WebSocket test client
- Key files: `seed.py`, `ws_test_client.py`

**SlipStream/**
- Purpose: iOS app source files (SwiftUI)
- Contains: Views, ViewModel, models, styles
- Key files: `SlipStreamApp.swift` (entry point), `SlipStreamViewModel.swift` (state), `SlipStreamMapView.swift` (MapBox integration)

**SlipStream/Assets.xcassets/**
- Purpose: App icons, accent colors, image assets
- Contains: Asset catalog for iOS bundle
- Key files: `AppIcon.appiconset/`, `AccentColor.colorset/`

**SlipStream.xcodeproj/**
- Purpose: Xcode project and workspace configuration
- Contains: Build settings, schemes, dependency management (SPM)
- Key files: Managed by Xcode, not edited manually

**SlipStreamTests/**
- Purpose: iOS unit tests
- Contains: XCTest test cases
- Key files: `SlipStreamTests.swift`

**SlipStreamUITests/**
- Purpose: iOS UI automation tests
- Contains: XCTest UI test cases
- Key files: `SlipStreamUITests.swift`

**.claude/**
- Purpose: Claude Code skills for domain-specific patterns
- Contains: Mapbox iOS patterns, MapBox MCP devkit patterns, MapBox style patterns, SwiftUI design principles
- Key files: `skills/*/SKILL.md` (skill indexes), `skills/*/references/*.md` (pattern references)

**.planning/**
- Purpose: GSD (Get Stuff Done) command planning artifacts
- Contains: Codebase maps, phase plans, task execution logs
- Key files: `codebase/*.md` (this file and architecture docs)

**docs/**
- Purpose: Project documentation
- Contains: API docs, setup guides, architecture diagrams
- Key files: Not yet populated

## Key File Locations

**Entry Points:**
- `backend/src/backend/main.py`: FastAPI app initialization, router registration, lifespan
- `SlipStream/SlipStreamApp.swift`: iOS app entry point (@main)
- `SlipStream/ContentView.swift`: SwiftUI root view, ViewModel initialization

**Configuration:**
- `backend/pyproject.toml`: Python dependencies, project metadata
- `backend/alembic.ini`: Alembic migration config
- `backend/docker-compose.yml`: Docker services (PostgreSQL, Redis)
- `backend/.env`: Environment variables (NOT committed)
- `backend/src/backend/config.py`: Settings class with defaults

**Core Logic:**
- `backend/src/backend/models.py`: SQLAlchemy ORM models (User, Car, Convoy, Friendship, etc.)
- `backend/src/backend/database.py`: Async database session factory
- `backend/src/backend/auth.py`: JWT token generation/validation, password hashing
- `backend/src/backend/dependencies.py`: FastAPI dependency injection (auth, DB)
- `backend/src/backend/redis.py`: Redis connection pool, pub/sub listener
- `SlipStream/SlipStreamViewModel.swift`: iOS app state and business logic
- `SlipStream/SlipStreamModels.swift`: Swift data models (Driver, Convoy, Vehicle, etc.)

**Testing:**
- `backend/tests/conftest.py`: pytest fixtures (test client, test database)
- `backend/tests/test_*.py`: Test modules per router
- `SlipStreamTests/SlipStreamTests.swift`: iOS unit tests

## Naming Conventions

**Files (Backend):**
- Snake_case: `convoy_messages.py`, `test_auth.py`, `refresh_tokens.py`
- Router files named after resource: `routers/convoys.py`, `routers/users.py`
- Test files prefixed with `test_`: `test_convoys.py`

**Files (iOS):**
- PascalCase: `SlipStreamViewModel.swift`, `MapHomeView.swift`, `DrivingHUDView.swift`
- Suffix indicates type: `*View.swift` (SwiftUI views), `*ViewModel.swift` (state), `*Models.swift` (data)
- Test files suffixed with `Tests.swift`: `SlipStreamTests.swift`

**Directories:**
- Lowercase singular/plural as appropriate: `routers/`, `tests/`, `scripts/`, `realtime/`
- iOS uses PascalCase for targets: `SlipStream/`, `SlipStreamTests/`

**Python Modules:**
- Package names: lowercase, no underscores (`backend`, `routers`, `realtime`)
- Module names: lowercase with underscores (`convoy_messages`, `refresh_tokens`)

**Swift Modules:**
- Types: PascalCase (`SlipStreamViewModel`, `Driver`, `Convoy`)
- Variables/properties: camelCase (`isDrivingMode`, `joinedConvoyID`)

## Where to Add New Code

**New REST Endpoint:**
- Primary code: `backend/src/backend/routers/{resource}.py`
- Request/response schemas: Pydantic BaseModel classes in same file
- Tests: `backend/tests/test_{resource}.py`
- Register router: Add `app.include_router()` call in `backend/src/backend/main.py:60`

**New WebSocket Message Type:**
- Handler: Add `handle_{message_type}` function in `backend/src/backend/realtime/handlers.py`
- Dispatch: Add `elif msg_type == "{message_type}"` case in `backend/src/backend/realtime/router.py:162`
- Event publisher: Add to `backend/src/backend/realtime/events.py` if needed

**New Database Table:**
- Model: Add class to `backend/src/backend/models.py` extending `Base`
- Migration: `cd backend && alembic revision --autogenerate -m "add table"`
- Apply: `alembic upgrade head`

**New iOS View:**
- Implementation: `SlipStream/{ViewName}View.swift`
- Navigation: Add to NavigationStack in `SlipStream/AppRootView.swift` or as sheet presentation
- State access: Use `@EnvironmentObject var viewModel: SlipStreamViewModel`

**New iOS Model:**
- Data structures: Add to `SlipStream/SlipStreamModels.swift`
- Enums should conform to: `String, CaseIterable, Identifiable` (see existing patterns)

**Utilities/Helpers:**
- Backend shared helpers: `backend/src/backend/{module}.py` (e.g., `auth.py` for crypto utils)
- iOS utilities: Add to relevant view file or create `SlipStreamUtilities.swift` if needed

**Background Tasks:**
- Backend: Add to `backend/src/backend/realtime/router.py` subscription refresh loop pattern (line 240)
- iOS: Use `.onReceive(timer)` pattern as in `SlipStream/MapHomeView.swift:92`

## Special Directories

**backend/.venv/**
- Purpose: Python virtual environment
- Generated: Yes (by `uv` or `python -m venv`)
- Committed: No (excluded via `.gitignore`)

**backend/alembic/versions/**
- Purpose: Migration history scripts
- Generated: Yes (by `alembic revision`)
- Committed: Yes (required to reproduce schema)

**SlipStream.xcodeproj/xcuserdata/**
- Purpose: User-specific Xcode settings (breakpoints, window state)
- Generated: Yes (by Xcode)
- Committed: No (user-specific, not portable)

**.planning/codebase/**
- Purpose: Codebase maps for GSD commands
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: Yes (guides future code generation)

**.claude/skills/**
- Purpose: Claude skills for domain patterns (Mapbox, SwiftUI)
- Generated: No (manually created or imported)
- Committed: Yes (project-specific patterns)

---

*Structure analysis: 2026-06-10*
