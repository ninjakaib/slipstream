# Technology Stack

**Analysis Date:** 2026-06-10

## Languages

**Primary:**
- Python 3.13 - Backend API (`backend/`)
- Swift - iOS app (`SlipStream/`)

**Secondary:**
- SQL - Database migrations (`backend/alembic/versions/`)

## Runtime

**Backend Environment:**
- Python 3.13
- uvicorn 0.49.0 - ASGI server

**iOS Environment:**
- SwiftUI - UI framework
- Xcode 26.3

**Package Manager (Backend):**
- uv 0.7.12 - Python package manager
- Lockfile: `backend/uv.lock` (present)

**Package Manager (iOS):**
- Swift Package Manager
- Dependencies managed via Xcode project

## Frameworks

**Backend Core:**
- FastAPI 0.136.3 - Web framework
- SQLAlchemy 2.0.50 - ORM with async support
- Pydantic Settings 2.14.1 - Configuration management

**Backend Testing:**
- pytest 8.0.0 - Test framework
- pytest-asyncio 0.24.0 - Async test support
- httpx 0.27.0 - HTTP client for tests

**Backend Database:**
- asyncpg 0.31.0 - PostgreSQL async driver
- Alembic 1.18.4 - Database migrations
- GeoAlchemy2 0.20.0 - PostGIS spatial extensions

**Backend Real-time:**
- redis[asyncio] 8.0.0 - Redis async client
- websockets 13.0 - WebSocket protocol

**iOS Core:**
- MapboxMaps 11.0.0+ - Map SDK
- MapboxNavigationCore - Navigation features
- SwiftUI - Declarative UI
- Combine - Reactive framework

**Build/Dev:**
- Docker Compose - Local development orchestration
- uv 0.7.12 - Fast Python package installer
- Docker BuildKit - Container builds

## Key Dependencies

**Critical (Backend):**
- `fastapi>=0.136.3` - HTTP request routing, dependency injection
- `sqlalchemy[asyncio]>=2.0.50` - Database ORM, relationships, migrations
- `redis>=8.0.0` - Live location storage, pub/sub for real-time events
- `asyncpg>=0.31.0` - PostgreSQL connection driver
- `geoalchemy2>=0.20.0` - Spatial queries (PostGIS)
- `pyjwt>=2.13.0` - JWT access token generation/validation
- `bcrypt>=5.0.0` - Password hashing

**Critical (iOS):**
- `MapboxMaps` - Map rendering, annotations, camera control
- `MapboxNavigationCore` - Turn-by-turn navigation, location tracking

**Infrastructure (Backend):**
- `uvicorn>=0.49.0` - ASGI server hosting FastAPI
- `pydantic-settings>=2.14.1` - Environment variable loading

## Configuration

**Environment (Backend):**
- Configuration via environment variables
- Settings class: `backend/src/backend/config.py`
- Local development: `backend/.env` file (gitignored)
- Docker: Environment variables in `backend/docker-compose.yml`

**Required environment variables:**
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db
REDIS_URL=redis://host:port/db
JWT_SECRET_KEY=<secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
DEBUG=true|false
APP_NAME=SlipStream
```

**Build (Backend):**
- `backend/pyproject.toml` - Python project metadata, dependencies
- `backend/uv.lock` - Pinned dependency versions
- `backend/Dockerfile` - Multi-stage build (build, runtime-base, api, api-dev)
- `backend/docker-compose.yml` - Service orchestration
- `backend/alembic.ini` - Database migration configuration

**Build (iOS):**
- `SlipStream.xcodeproj/project.pbxproj` - Xcode project configuration
- `SlipStream/Info.plist` - App metadata

## Platform Requirements

**Development:**
- Docker & Docker Compose - Backend services
- Python 3.13 - Backend development
- Xcode 26.3+ - iOS development
- macOS - iOS app development

**Production (Backend):**
- PostgreSQL 17+ with PostGIS 3.5+ extension
- Redis 7+
- Docker runtime

**Production (iOS):**
- iOS deployment target: Not specified in project files (requires Xcode inspection)

---

*Stack analysis: 2026-06-10*
