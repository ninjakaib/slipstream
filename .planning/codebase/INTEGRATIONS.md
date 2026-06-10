# External Integrations

**Analysis Date:** 2026-06-10

## APIs & External Services

**Mapping:**
- Mapbox Maps SDK - iOS map rendering, vector tiles, camera control
  - SDK/Client: MapboxMaps (Swift Package)
  - Implementation: `SlipStream/SlipStreamMapView.swift`
  - Auth: Mapbox token (iOS Info.plist or SDK config)
- Mapbox Navigation Core - Turn-by-turn navigation, route calculation
  - SDK/Client: MapboxNavigationCore (Swift Package)
  - Implementation: `SlipStream/SlipStreamMapView.swift`
  - Auth: Mapbox token (shared with Maps SDK)

**Authentication:**
- No third-party auth services detected
- Custom JWT implementation: `backend/src/backend/auth.py`

**Push Notifications:**
- Infrastructure present but not implemented
  - Model exists: `backend/src/backend/models.py::PushToken`
  - No active push service integration (APNs, FCM, etc.)

## Data Storage

**Databases:**
- PostgreSQL 17 with PostGIS 3.5
  - Connection: `DATABASE_URL` environment variable
  - Client: asyncpg 0.31.0
  - ORM: SQLAlchemy 2.0.50 with GeoAlchemy2 0.20.0
  - Location: `backend/src/backend/database.py`
  - Spatial features: Geography types for coordinates, spatial queries

**Cache/Ephemeral State:**
- Redis 7
  - Connection: `REDIS_URL` environment variable
  - Client: redis[asyncio] 8.0.0
  - Location: `backend/src/backend/redis.py`
  - Use cases:
    - Live location storage (GEOADD for spatial queries)
    - User presence tracking (HSET for metadata)
    - Real-time event pub/sub (location:*, convoy:* channels)

**File Storage:**
- Not implemented
- Avatar/photo URLs stored as strings in database
  - `User.avatar_url` field in `backend/src/backend/models.py`
  - `Car.photo_url` field in `backend/src/backend/models.py`
  - No file upload endpoints detected

## Authentication & Identity

**Auth Provider:**
- Custom implementation
  - JWT access tokens (15 minute expiry)
  - SHA-256 hashed refresh tokens (30 day expiry)
  - bcrypt password hashing
  - Implementation: `backend/src/backend/auth.py`

**Apple Sign-In:**
- Infrastructure present but not implemented
  - `User.apple_id` field exists in `backend/src/backend/models.py`
  - No Apple SDK integration detected in iOS app

**Token Management:**
- Access tokens: JWT with HS256 signing
- Refresh tokens: Stored in `refresh_tokens` table
- Configuration: `backend/src/backend/config.py`
  - `JWT_SECRET_KEY` - Signing key
  - `JWT_ALGORITHM` - HS256
  - `ACCESS_TOKEN_EXPIRE_MINUTES` - 15
  - `REFRESH_TOKEN_EXPIRE_DAYS` - 30

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Python logging module
- Configuration: `backend/src/backend/main.py`
- Format: `"%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"`
- Level: DEBUG if settings.debug else INFO

**Metrics:**
- None

**Health Checks:**
- Endpoint: `GET /health`
- Implementation: `backend/src/backend/main.py`
- Returns: Service status, active WebSocket connection count

## CI/CD & Deployment

**Hosting:**
- Not configured
- Docker images prepared for deployment
- Multi-stage Dockerfile: `backend/Dockerfile`

**CI Pipeline:**
- None

**Container Registry:**
- None configured

## Environment Configuration

**Required env vars (Backend):**
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# Redis
REDIS_URL=redis://host:port/db

# Authentication
JWT_SECRET_KEY=<secret-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# Application
APP_NAME=SlipStream
DEBUG=true|false
```

**Optional env vars (Backend):**
```bash
# Docker Compose overrides
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=slipstream
POSTGRES_PORT=5432
REDIS_PORT=6379
API_PORT=8000
```

**Secrets location:**
- Development: `backend/.env` (gitignored)
- Production: Not configured

**iOS Configuration:**
- Mapbox token location: Not specified (likely Info.plist or SDK initialization)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Real-time Communication

**WebSocket Server:**
- Framework: FastAPI WebSocket support
- Implementation: `backend/src/backend/realtime/router.py`
- Manager: `backend/src/backend/realtime/manager.py`
- Endpoint: `ws://host/ws`

**Pub/Sub Pattern:**
- Redis pub/sub for cross-instance message distribution
- Channels:
  - `location:*` - User location updates
  - `convoy:*` - Convoy events
- Implementation: `backend/src/backend/redis.py::_pubsub_loop`
- Auto-reconnect with exponential backoff (1s to 60s max)

**Event Types:**
- Location updates: Broadcast to nearby users/convoy members
- Convoy events: Member join/leave, route changes, messages
- Handler: `backend/src/backend/realtime/handlers.py`

## Development Services

**Docker Compose Stack:**
- PostgreSQL + PostGIS: `postgis/postgis:17-3.5-alpine`
- Redis: `redis:7-alpine`
- API: Custom build from `backend/Dockerfile`

**Service Dependencies:**
- API requires healthy postgres and redis
- Health checks configured for all services
- Network: `slipstream_network` bridge

**Development Features:**
- Hot reload: Docker watch syncs `backend/src/` on changes
- Editable install: `UV_NO_EDITABLE=0` for api-dev target
- Debug mode: `DEBUG=true` enables SQL echo and verbose logging

---

*Integration audit: 2026-06-10*
