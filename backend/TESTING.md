# Testing the SlipStream Backend

You have **3 levels of testing** available, from quickest to most realistic:

---

## 1. Unit/Integration Tests (pytest) — No external services needed

Uses an in-memory SQLite database. Fast, runs in CI.

```bash
cd backend

# Install dev dependencies
uv sync --extra dev

# Run all tests
uv run pytest tests/ -v

# Run specific test file
uv run pytest tests/test_auth.py -v

# Run with output
uv run pytest tests/ -v -s
```

**What this tests:** Auth flows, CRUD operations, permission checks, input validation, business logic.

**What this doesn't test:** PostGIS spatial queries, WebSocket real-time behavior.

---

## 2. Interactive API Testing (curl / HTTPie / Bruno) — Docker Compose required

Start your full stack locally and hit endpoints manually.

```bash
# Start Postgres + API
docker compose up --watch

# Run migrations
docker compose exec api alembic upgrade head

# Seed test data (creates 10 users, cars, friendships, a convoy)
uv run python scripts/seed.py

# Now interact with the API
curl http://localhost:8000/health

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "apexkai", "password": "testpass123"}'

# Use the returned access_token for subsequent requests
TOKEN="<paste token here>"

curl http://localhost:8000/users/me -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/friends -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/cars -H "Authorization: Bearer $TOKEN"
```

**Tip:** Use [Bruno](https://www.usebruno.com/) (free Postman alternative) to save a collection of requests.

---

## 3. WebSocket Testing (spatial live system)

Connect to the spatial WebSocket at `/ws/live?token=<JWT>` to test real-time position streaming.

The spatial system uses an in-memory H3 cell-based store — no external dependencies beyond Postgres (for auth).

**Message types (client → server):**
- `location_update`: `{lat, lng, heading, speed, status}`
- `viewport_update`: `{cells: ["h3_cell_id", ...]}`
- `heartbeat`: `{}`

**Message types (server → client):**
- `viewport_snapshot`: Initial drivers in newly-subscribed cells
- `driver_moved`: Position update for a driver in your viewport
- `driver_exited`: Driver left your viewport or disconnected
- `heartbeat_ack`: Keepalive response

---

## 4. Quick Testing Cheat Sheet

| What to test | How |
|---|---|
| Auth works | `pytest tests/test_auth.py` |
| Full CRUD | `pytest tests/` |
| API response shapes | curl after seeding |
| WebSocket connects | Connect to `/ws/live?token=<JWT>` |
| Location fanout | Two WebSocket clients, overlapping viewports |
| Visibility filtering | Login as ghost user, verify they don't appear |

---

## Test Credentials (after seeding)

All passwords: `testpass123`

| Username | Visibility | Friends with |
|---|---|---|
| apexkai | on | boostedmia, rallynoah, driftqueen, canyoncarver |
| boostedmia | on | apexkai, rallynoah, driftqueen, turbotim |
| rallynoah | on | apexkai, boostedmia, canyoncarver, turbotim |
| driftqueen | friends_only | apexkai, boostedmia, flatsixter |
| canyoncarver | on | apexkai, rallynoah, turbotim, rotaryray |
| turbotim | on | boostedmia, rallynoah, canyoncarver |
| rotaryray | ghost | canyoncarver |
| vtecliz | on | flatsixter, evowrex |
| flatsixter | friends_only | driftqueen, vtecliz |
| evowrex | on | vtecliz |

---

## Resetting Test Data

```bash
# Nuclear reset (drop everything)
docker compose exec postgres psql -U postgres -d slipstream \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migrations
docker compose exec api alembic upgrade head

# Re-seed
uv run python scripts/seed.py
```
