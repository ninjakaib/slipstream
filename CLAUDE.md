# SlipStream

## Project

A real-time social driving app for car enthusiasts — "Forza Horizon online lobby, but in real life." Users open the app, see who's out driving nearby, and join a drive in minutes.

**Core Value:** The discovery-to-drive loop must feel instant and alive. If it doesn't, nothing else matters.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│           React Native (Expo) — ./slipstream             │
│                                                          │
│  • Expo SDK 56, Expo Router (file-based)                 │
│  • Mapbox (@rnmapbox/maps) for live map                  │
│  • H3 cell-based viewport subscriptions                  │
│  • WebSocket for real-time position streaming            │
│  • REST client (auto-generated from OpenAPI)             │
│  • expo-secure-store for auth tokens                     │
└─────────────────┬────────────────────┬───────────────────┘
                  │ HTTPS              │ WSS
                  ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Server — ./backend                   │
│                                                          │
│  ┌──────────────┐  ┌───────────────────────────────┐    │
│  │  REST API    │  │  Spatial WebSocket (/ws/live)  │    │
│  │  (routers/)  │  │  (spatial/ subpackage)         │    │
│  └──────────────┘  └───────────────────────────────┘    │
│                                                          │
│  In-memory H3 spatial store — no external broker         │
│  on the hot path. Positions, cells, watchers all         │
│  in-process dicts/sets.                                  │
└─────────────────────────────┬────────────────────────────┘
                              │
                              ▼
                ┌───────────────────────┐
                │  PostgreSQL + PostGIS  │
                │  (persistent data)    │
                └───────────────────────┘
```

## Directory Layout

| Path | Purpose |
|------|---------|
| `./slipstream/` | React Native (Expo) mobile app |
| `./backend/` | Python FastAPI server |
| `./demo/` | React web demo (Mapbox visualizer, not part of core project) |
| `./ios/` | **DEPRECATED** — old SwiftUI implementation, ignore entirely |
| `./docs/` | Product requirements, architecture docs |
| `./.planning/` | Roadmap, phases, state tracking (partially outdated) |

## Technology Stack

### Frontend (./slipstream)
- **Runtime:** React Native 0.85 via Expo SDK 56
- **Router:** Expo Router (file-based routing)
- **Map:** @rnmapbox/maps with Mapbox Standard style
- **Spatial:** h3-js for viewport cell computation
- **Auth storage:** expo-secure-store (Keychain/Keystore)
- **API client:** Auto-generated TypeScript SDK via @hey-api/openapi-ts
- **UI:** expo-symbols (SF Symbols), expo-glass-effect

### Backend (./backend)
- **Framework:** FastAPI (Python 3.13)
- **Database:** PostgreSQL 17 + PostGIS 3.5 (via SQLAlchemy async + GeoAlchemy2)
- **Migrations:** Alembic
- **Auth:** JWT (access + refresh tokens), Sign in with Apple, username/password
- **Spatial:** In-memory H3 cell-based pub/sub (no external broker)
- **Package manager:** uv
- **Containerization:** Docker Compose (Postgres + API with hot reload)

### Key: No Redis
Redis was removed. The real-time location system uses an **in-memory spatial store** (`backend/src/slipstream/spatial/`). All position tracking, cell membership, viewport subscriptions, and event dispatch happen in-process. This is the MVP approach — single-server, no external message broker needed.

## Backend Structure

```
backend/src/slipstream/
├── main.py              # FastAPI app, router registration
├── config.py            # Settings from env vars
├── database.py          # Async SQLAlchemy engine + session
├── models.py            # ORM models (User, Car, Convoy, Friendship, etc.)
├── auth.py              # JWT creation/validation, password hashing, Apple JWKS
├── dependencies.py      # get_current_user dependency
├── routers/
│   ├── auth.py          # /auth — register, login, apple, refresh, logout
│   ├── users.py         # /users — profile CRUD, search
│   ├── cars.py          # /cars — garage management
│   ├── friends.py       # /friends — requests, accept/decline, list
│   └── convoys.py       # /convoys — create, join, leave, chat, routes
└── spatial/
    ├── store.py         # SpatialStore — in-memory H3 index (singleton)
    ├── handlers.py      # WebSocket message handlers (location, viewport)
    ├── router.py        # /ws/live endpoint + /spatial/config REST
    └── types.py         # PositionState, ConnectionState, CellTransition
```

## Spatial System (Real-Time)

The spatial system replaces all previous Redis-based location features:

**How it works:**
1. Client connects via WebSocket at `/ws/live?token=<JWT>`
2. Client sends `location_update` → server computes H3 cells, indexes position, fans out `driver_moved` to watchers
3. Client sends `viewport_update` with H3 cells → server registers watcher, sends `viewport_snapshot` of current drivers in those cells
4. When a driver moves between cells, `driver_exited` events are sent to watchers of the old cells

**H3 Resolutions:** Server indexes at resolutions [1, 2, 3, 4, 5]. Client picks resolution based on zoom level and sends the cells covering their viewport.

**No prediction/extrapolation** on the server — positions are raw updates. Smooth animation (buffer interpolation) is a client-side concern.

## Frontend Structure

```
slipstream/src/
├── app/
│   ├── _layout.tsx      # Root layout (AuthProvider, theme)
│   ├── index.tsx        # Home tab (placeholder)
│   ├── map.tsx          # Map tab (live drivers, driving mode)
│   └── explore.tsx      # Explore tab (placeholder)
├── features/
│   ├── auth/login-screen.tsx
│   ├── map/live-map.tsx         # Mapbox map with driver markers
│   ├── map/driver-sheet.tsx     # Bottom sheet on marker tap
│   └── profile/profile-screen.tsx
├── hooks/
│   ├── use-websocket.ts         # WS connection, driver state
│   ├── use-location.ts          # expo-location tracking
│   └── use-viewport-cells.ts   # H3 cell computation on camera change
├── lib/
│   ├── auth.ts          # Token storage, refresh, client config
│   ├── spatial.ts       # zoomToResolution, getViewportCells
│   └── api/             # Auto-generated OpenAPI SDK
├── contexts/
│   └── auth-context.tsx # Auth state provider
└── constants/
    └── theme.ts         # Colors, spacing
```

## What's Implemented

### Backend (complete for MVP)
- Auth: register, login, Apple Sign In, token refresh, logout
- Users: profile CRUD, search by username
- Cars: full garage CRUD, active car toggle
- Friends: request, accept, decline, remove, list
- Convoys: create, join, leave, end, invite, kick, chat, quick actions, routes
- Spatial: WebSocket-based live position streaming with H3 viewport subscriptions

### Frontend (partially implemented)
- Auth flow (username/password login & register, token storage, auto-refresh)
- Live map with real-time driver markers via WebSocket
- H3 viewport cell subscriptions (auto-computed from camera bounds)
- Location tracking (foreground, adaptive interval)
- Driving mode camera (follow-with-course, high pitch, close zoom)
- Profile screen (fetches from API, shows settings + garage)
- Driver info sheet (tap marker → profile + add friend/invite actions)
- Tab navigation (Home, Map, Explore)

### Frontend (not yet implemented)
- Apple Sign In (backend ready, mobile flow not wired)
- Onboarding (username setup, car entry for new users)
- Convoy UI (create, join, lobby, chat, quick actions)
- Social page (friends list, nearby drivers list, friend search)
- Notifications (push registration, in-app banners)
- Marker enrichment (status colors, car info, smooth animation)
- Driving HUD (speed, speed limit, road name)
- Navigation / route planning

## Development

### Backend
```bash
cd backend
docker compose up --watch          # Postgres + API with hot reload
docker compose exec api alembic upgrade head  # Run migrations
uv run python scripts/seed.py      # Seed test data
```

### Frontend
```bash
cd slipstream
npm install
npx expo start                     # Dev server
npx expo run:ios                   # Native iOS build
```

### API SDK Regeneration
When backend endpoints change:
```bash
cd backend && uv run python -c "from backend.main import app; import json; print(json.dumps(app.openapi()))" > ../openapi.json
cd ../slipstream && npx openapi-ts
```

## Conventions

### Python (Backend)
- Async everywhere: `async def`, `await db.execute()`
- Pydantic for all request/response schemas
- SQLAlchemy 2.0 style with `Mapped[]` type hints
- Router modules in `routers/` with `APIRouter(prefix=..., tags=[...])`
- Private helpers prefixed with `_`
- HTTPException for all error responses with specific status codes

### TypeScript (Frontend)
- Functional components with hooks
- Feature-based directory structure (`features/auth/`, `features/map/`)
- Custom hooks in `hooks/` for reusable logic
- Context providers for global state (auth)
- StyleSheet.create for all styles (no inline objects)
- expo-symbols for iconography (SF Symbols)

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/slipstream
JWT_SECRET_KEY=<secret>
APPLE_BUNDLE_ID=com.slipstream.app
DEBUG=true
```

### Frontend (.env)
```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=<mapbox token>
EXPO_PUBLIC_API_URL=http://<your-ip>:8000
EXPO_PUBLIC_WS_URL=ws://<your-ip>:8000
```
