# Testing the SlipStream Backend

You have **4 levels of testing** available, from quickest to most realistic:

---

## 1. Unit/Integration Tests (pytest) — No external services needed

Uses an in-memory SQLite database and mocked Redis. Fast, runs in CI.

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

**What this doesn't test:** PostGIS spatial queries, real Redis pub/sub, WebSocket real-time behavior.

---

## 2. Interactive API Testing (curl / HTTPie / Bruno) — Docker Compose required

Start your full stack locally and hit endpoints manually.

```bash
# Start Postgres + Redis + API
docker compose up --watch

# Run migrations
docker compose exec api alembic upgrade head

# Seed test data (creates 10 users, cars, friendships, a convoy, live positions)
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

## 3. WebSocket Simulation (drive simulator) — Full real-time testing

Simulates users driving along Angeles Crest Highway, sending real location updates, and receiving nearby driver events.

```bash
# Make sure Docker Compose is up and seeded (step 2 above)

# Install websockets for the test client
uv pip install websockets httpx

# Single user driving simulation
uv run python scripts/ws_test_client.py --username apexkai

# Multi-user simulation (3 cars on the same route)
uv run python scripts/ws_test_client.py --multi

# Custom speed
uv run python scripts/ws_test_client.py --username boostedmia --speed 60
```

**What you'll see:**
- `📤 Position` — your outgoing location updates
- `📍 DRIVER ENTERED` — other seeded users appearing in your radius
- `🚗 LOCATION` — other users' position updates (if another sim is running)
- `💓 Heartbeat` — presence keepalive

**Multi-terminal testing:**
Open 2-3 terminals, run the simulator as different users, and watch them discover each other in real time.

---

## 4. Redis Inspection — See live state directly

While simulators are running, inspect Redis to see what the backend is doing:

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# See all live positions
ZRANGE positions:live 0 -1

# See a specific user's position metadata
HGETALL pos:<user_id>

# Check who's online
KEYS presence:*

# Watch pub/sub messages fly by (real-time!)
PSUBSCRIBE location:* convoy:*

# Find nearby users (within 15 miles of a point)
GEOSEARCH positions:live FROMLONLAT -118.3215 34.1341 BYRADIUS 15 mi ASC
```

---

## 5. Quick Testing Cheat Sheet

| What to test | How |
|---|---|
| Auth works | `pytest tests/test_auth.py` |
| Full CRUD | `pytest tests/` |
| API response shapes | curl after seeding |
| WebSocket connects | `ws_test_client.py` |
| Location fanout | Two terminals, two different users |
| Convoy chat | WebSocket client + convoy message |
| Redis state correct | `redis-cli` inspection |
| Visibility filtering | Login as ghost user, verify they don't appear |
| Discovery endpoint | `curl /discovery/nearby?lat=34.13&lng=-118.32` |

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

# Flush just Redis
docker compose exec redis redis-cli FLUSHALL
```
