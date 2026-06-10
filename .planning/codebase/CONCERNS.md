# Codebase Concerns

**Analysis Date:** 2026-06-10

## Tech Debt

**Large File Complexity:**
- Issue: `backend/src/backend/routers/convoys.py` is 1135 lines — handles convoy CRUD, membership, chat, routes, and join requests in a single file
- Files: `backend/src/backend/routers/convoys.py`
- Impact: Hard to navigate, test, and maintain. Mixing of concerns (business logic, routing, validation)
- Fix approach: Extract into separate modules: `convoys/membership.py`, `convoys/chat.py`, `convoys/routes.py`, and service layer for shared business logic

**Demo Data in Production Code:**
- Issue: SwiftUI view model uses hardcoded demo data instead of API integration
- Files: `SlipStream/SlipStreamViewModel.swift` (lines 37-42, 109-237)
- Impact: iOS app is essentially a UI prototype with no real backend communication. Location updates are simulated, not real
- Fix approach: Implement WebSocket client for real-time updates, REST API client for CRUD operations, replace `DemoData` with network service layer

**Missing Test Suite on iOS:**
- Issue: Zero tests found in Swift codebase (`SlipStreamTests/` and `SlipStreamUITests/` exist but appear empty)
- Files: `SlipStreamTests/`, `SlipStreamUITests/`
- Impact: No regression detection for iOS client, difficult to refactor safely
- Fix approach: Add unit tests for view models, integration tests for API client when implemented

**Test Coverage Gaps in Backend:**
- Issue: Tests exist for core features but missing coverage for realtime WebSocket handlers
- Files: `backend/tests/` (no `test_realtime.py` or `test_websocket.py`)
- Impact: Real-time location updates, convoy events, and WebSocket message handling are untested
- Fix approach: Add WebSocket test client, mock Redis pub/sub, test location update flow and subscription refresh logic

**Rate Limiting Not Enforced:**
- Issue: `LOCATION_UPDATE_MIN_INTERVAL = 1.0` defined but never checked in code
- Files: `backend/src/backend/realtime/router.py` (line 48)
- Impact: Clients can spam location updates, causing Redis write amplification and pub/sub storm
- Fix approach: Track last update timestamp per connection, reject updates faster than 1s interval

**SQLite in Tests vs PostgreSQL in Production:**
- Issue: Test suite uses SQLite which lacks PostGIS spatial extensions
- Files: `backend/tests/conftest.py` (line 29)
- Impact: Spatial queries (`ST_X`, `ST_Y`, Geography types) cannot be tested. Real bugs may only surface in production
- Fix approach: Use PostgreSQL + PostGIS for integration tests via Docker Compose, or separate spatial query tests with skip markers

**Python Cache Files Committed:**
- Issue: `__pycache__` directories present in repository
- Files: `backend/tests/__pycache__/`, `backend/alembic/versions/__pycache__/`, `backend/src/backend/__pycache__/`
- Impact: Clutter, merge conflicts, potential for stale bytecode issues across Python versions
- Fix approach: Run `git rm -r backend/**/__pycache__`, verify `.gitignore` includes `__pycache__/` (already present), commit cleanup

**Xcode User Files in Repository:**
- Issue: User-specific Xcode data committed to version control
- Files: `SlipStream.xcodeproj/xcuserdata/kaibreese.xcuserdatad/`
- Impact: Pollutes git history with personal settings, causes conflicts when multiple developers work on project
- Fix approach: Add `*.xcuserdata/` to `.gitignore`, run `git rm -r SlipStream.xcodeproj/xcuserdata/`

**No Error Types Defined:**
- Issue: All errors raised as generic `HTTPException` with hardcoded status codes and messages
- Files: `backend/src/backend/routers/*.py` (pervasive pattern)
- Impact: No centralized error catalog, inconsistent error response format, hard to add i18n or structured error codes later
- Fix approach: Define custom exception classes (`ConvoyNotFoundError`, `UnauthorizedError`, etc.), add FastAPI exception handler to map to consistent JSON responses

**Incomplete Migration History:**
- Issue: Only 2 migrations in `backend/alembic/versions/`, both appear to be variants of "initial_schema"
- Files: `backend/alembic/versions/2026_06_09_2144_ac918771e35e_initial_schema.py`, `backend/alembic/versions/2026_06_09_2147_73dedd7af426_initial_schema.py`
- Impact: Suggests migration files were manually recreated instead of incrementally versioning schema. Risk of divergence between local dev DBs
- Fix approach: Delete one duplicate migration, establish migration discipline (never hand-edit, always generate with `alembic revision --autogenerate`)

## Known Bugs

**Empty Return on Redis Failure:**
- Symptoms: Discovery endpoints silently return empty list if Redis GEOSEARCH fails
- Files: `backend/src/backend/routers/discovery.py` (line 140), `backend/src/backend/routers/friends.py` (line 127, 155)
- Trigger: Redis connection timeout, network partition, or Redis crash
- Workaround: None exposed to client. Appears as "no nearby drivers" even when Redis is down
- Fix approach: Return proper HTTP 503 Service Unavailable with error payload when Redis is unreachable

**Silent Failure in Annotation Rebuild:**
- Symptoms: Map annotations fail to render if `try?` in SwiftUI silently swallows errors
- Files: `SlipStream/SlipStreamMapView.swift` (lines 286, 319, 349)
- Trigger: Invalid coordinates, nil geometry, or Mapbox ViewAnnotations API errors
- Workaround: None. Annotations just disappear with no user feedback
- Fix approach: Log annotation errors to console, add fallback annotation style, show toast notification if annotations fail to render

**Empty `pass` Blocks:**
- Symptoms: Exception handlers that silently swallow errors with `pass` statement
- Files: `backend/src/backend/redis.py` (lines 65, 142, 154)
- Trigger: Redis shutdown errors, pub/sub cancellation during cleanup
- Impact: Legitimate errors during shutdown may go unnoticed, making debugging production issues harder
- Fix approach: Log exceptions at WARNING level before suppressing, or re-raise if not expected

## Security Considerations

**Hardcoded JWT Secret:**
- Risk: Default JWT secret key "CHANGE-ME-IN-PRODUCTION" is publicly visible in source
- Files: `backend/src/backend/config.py` (line 18)
- Current mitigation: `.env` file present but not checked (it's in `.gitignore`)
- Recommendations: Document required env vars in `backend/README.md`, add startup check that fails if secret equals default value, use secrets manager in production

**Environment File Exists in Repository:**
- Risk: `.env` file detected in backend directory (excluded from this analysis per security policy)
- Files: `backend/.env` (existence confirmed, contents not read)
- Current mitigation: File is in `.gitignore`, but already committed once (visible in `ls` output)
- Recommendations: Run `git rm --cached backend/.env` to remove from git history, rotate any secrets that were committed, create `backend/.env.example` template

**No Request Validation on WebSocket Messages:**
- Risk: WebSocket handlers accept arbitrary JSON payloads without schema validation
- Files: `backend/src/backend/realtime/handlers.py` (payload parsing happens with dict access, no Pydantic models)
- Current mitigation: Basic type checks like `if lat is None` but no bounds validation, string length limits, or type coercion
- Recommendations: Define Pydantic models for each WebSocket message type, validate before dispatching to handlers, return structured error on validation failure

**No Authentication on Convoy Membership Checks:**
- Risk: Convoy member queries only check membership existence, not whether requester has permission to view
- Files: `backend/src/backend/routers/convoys.py` (membership verification functions)
- Current mitigation: All convoy endpoints require `get_current_user` dependency which validates JWT
- Recommendations: Current approach is acceptable, but consider adding permission layer if future features need admin-only operations

**Apple ID Authentication Not Implemented:**
- Risk: User model has `apple_id` field but no Sign in with Apple flow implemented
- Files: `backend/src/backend/models.py` (line 94), iOS app has no Apple ID authentication code
- Current mitigation: Username/password auth works as fallback
- Recommendations: Implement Apple ID authentication (required for App Store submission), add `POST /auth/apple` endpoint, validate Apple ID tokens server-side

## Performance Bottlenecks

**N+1 Query in Convoy Member Enrichment:**
- Problem: `_build_convoy_response` fetches convoy members with `selectinload` but still does per-member car lookup
- Files: `backend/src/backend/routers/convoys.py` (line 225-254)
- Cause: Active car selection happens in Python loop: `next((c for c in m.user.cars if c.is_active), None)`
- Improvement path: Use single query with `outerjoin` to Cars table filtered by `is_active=True`, or cache active car ID on User model

**Subscription Refresh Overhead:**
- Problem: Every 30 seconds, each WebSocket connection does GEOSEARCH + batch HGETALL for up to 200 users
- Files: `backend/src/backend/realtime/handlers.py` (line 191-236), triggered by `backend/src/backend/realtime/router.py` (line 42)
- Cause: No incremental updates — full subscription list rebuilt every refresh
- Improvement path: Maintain "last seen user set" in connection state, only send enter/exit events for deltas, increase refresh interval to 60s

**Redis Pipeline Not Used for Multi-Key Operations:**
- Problem: Convoy creation does sequential Redis commands instead of pipelining
- Files: `backend/src/backend/routers/convoys.py` (line 328-331)
- Cause: Direct `await r.sadd()` call instead of using pipeline
- Improvement path: Use `async with r.pipeline(transaction=False)` to batch Redis writes during convoy create/join/leave operations

**Full Convoy Message Deletion on End:**
- Problem: `DELETE FROM convoy_messages WHERE convoy_id = ?` scans and deletes all chat history when convoy ends
- Files: `backend/src/backend/routers/convoys.py` (line 402)
- Cause: Ephemeral chat design deletes all messages on convoy end
- Improvement path: If convoys can have hundreds of messages, add index on `convoy_id` (already exists per line 345), or consider soft-delete pattern with TTL cleanup job

## Fragile Areas

**Realtime Pub/Sub Listener:**
- Files: `backend/src/backend/redis.py` (line 95-162)
- Why fragile: Single global task handles all Redis pub/sub messages. If it crashes, all real-time features stop working
- Safe modification: Never call blocking operations in listener loop, always wrap message handling in try/except, test reconnection logic with chaos engineering
- Test coverage: No tests for pub/sub reconnection, exponential backoff, or message dispatch

**WebSocket Connection Manager:**
- Files: `backend/src/backend/realtime/manager.py`
- Why fragile: In-memory connection tracking means all WebSocket state is lost on server restart. No Redis-backed session store
- Safe modification: All connection state access must be synchronized (currently using implicit single-threaded FastAPI assumption), adding locking if moving to multi-threaded runtime
- Test coverage: Manager has no direct tests, only exercised indirectly through WebSocket integration tests

**MapView Coordinator State:**
- Files: `SlipStream/SlipStreamMapView.swift` (Coordinator class, line 183-362)
- Why fragile: Mixes UIKit lifecycle with SwiftUI updates. Strong reference cycles possible via closures capturing `self`
- Safe modification: Always use `[weak self]` in async closures, test memory leaks with Instruments, verify coordinator deallocation when view disappears
- Test coverage: No tests for coordinator lifecycle, annotation rebuilds, or camera transitions

**Convoy Leader Transfer:**
- Files: `backend/src/backend/routers/convoys.py` (line 684-688)
- Why fragile: When leader leaves, convoy immediately ends instead of transferring leadership to another member
- Safe modification: Check member count before ending, elect new leader (oldest member, or highest-role member), publish `leader_changed` event
- Test coverage: Covered by `test_convoys.py` but behavior is intentional for MVP. Document as known limitation

## Scaling Limits

**Single Redis Instance:**
- Current capacity: Supports ~10K concurrent users on single Redis node (based on typical Redis throughput)
- Limit: Redis is single-threaded. Pub/sub + GEO queries + hash operations all compete for same event loop
- Scaling path: Use Redis Cluster for GEO data, separate Redis instance for pub/sub, or switch to Redis Sentinel for HA

**In-Memory WebSocket Manager:**
- Current capacity: Each API instance tracks only its own WebSocket connections
- Limit: Load balancer must use sticky sessions (source IP or cookie-based) to route user to same instance
- Scaling path: Move connection tracking to Redis (store `user_id -> instance_id` mapping), allow any instance to forward messages via pub/sub

**PostgreSQL Connection Pool:**
- Current capacity: Default pool size for asyncpg is typically 10 connections per instance
- Limit: Each convoy operation opens DB transaction. Under load, pool exhaustion causes request queuing
- Scaling path: Tune pool size in `backend/src/backend/database.py` (add `pool_size=20, max_overflow=10` to engine config), add pgBouncer for connection pooling

**Convoy Spatial Queries:**
- Current capacity: Convoy discovery currently returns all public convoys (no spatial filtering)
- Limit: As convoys scale to thousands, returning all is inefficient
- Scaling path: Add spatial queries using PostGIS ST_DWithin on convoy member positions, cache convoy centroids in Redis GEO set, paginate results

## Dependencies at Risk

**Python 3.13 Adoption:**
- Risk: Using cutting-edge Python 3.13 (released October 2024, still stabilizing as of analysis date)
- Impact: Potential compatibility issues with libraries, harder to find hosting/Docker images, fewer Stack Overflow answers
- Migration plan: Pin to Python 3.12 for production stability, or extensively test all async features with current dependency versions

**GeoAlchemy2 Spatial Types:**
- Risk: Only 2 active maintainers on library, last major release 2+ years ago
- Impact: PostGIS version compatibility issues, slow bug fixes, potential abandonment
- Migration plan: Consider migrating spatial queries to raw SQL with `text()` statements, or evaluate PostGIS alternatives like TimescaleDB + pgvector

**Mapbox Navigation SDK:**
- Risk: iOS app tightly coupled to Mapbox Navigation SDK for core map rendering and turn-by-turn
- Impact: License costs scale with MAU, vendor lock-in, breaking API changes in major versions
- Migration plan: Abstract map rendering behind protocol (`MapProvider`), implement alternative providers (Apple MapKit, Google Maps), allow runtime switching

## Missing Critical Features

**No Push Notification System:**
- Problem: PushToken model exists but no APNs integration implemented
- Blocks: Users won't know about convoy invites, friend requests, or messages when app is backgrounded
- Priority: High — core social feature for mobile app

**No Real-time Connection in iOS App:**
- Problem: iOS app uses demo data, no WebSocket client implemented
- Blocks: App is non-functional as a real product, all UI is prototype
- Priority: Critical — must implement before alpha release

**No User Profile Photos:**
- Problem: User model has `avatar_url` field but no image upload endpoint
- Blocks: Generic avatars only, reduces social engagement
- Priority: Medium — affects UX polish but not core functionality

**No Location Permission Handling:**
- Problem: iOS app assumes location access, no permission request flow
- Blocks: App will crash or show blank map if user denies location permission
- Priority: High — required for App Store submission

**No Background Location Updates:**
- Problem: iOS app only updates location in foreground
- Blocks: Users disappear from map when app is backgrounded, convoy members can't track each other on longer drives
- Priority: High — core feature for driving use case

## Test Coverage Gaps

**WebSocket Real-time Handlers:**
- What's not tested: Location update flow, subscription refresh, convoy message handling via WebSocket
- Files: `backend/src/backend/realtime/handlers.py`, `backend/src/backend/realtime/router.py`
- Risk: Silent failures in pub/sub dispatch, memory leaks in connection manager, race conditions in subscription updates
- Priority: High

**Redis Pub/Sub Reconnection:**
- What's not tested: Exponential backoff logic, message loss during reconnect, listener crash recovery
- Files: `backend/src/backend/redis.py` (line 95-162)
- Risk: Production outages if Redis restarts or network partitions occur
- Priority: High

**iOS Map Annotation Rendering:**
- What's not tested: Annotation lifecycle, coordinate updates, filter changes, camera mode transitions
- Files: `SlipStream/SlipStreamMapView.swift`
- Risk: Annotations disappear or duplicate, memory leaks from unreleased annotations
- Priority: Medium

**Spatial Queries:**
- What's not tested: PostGIS geography calculations, GEOSEARCH edge cases (poles, antimeridian), distance accuracy
- Files: All spatial queries in `backend/src/backend/routers/discovery.py`, `backend/src/backend/routers/convoys.py`
- Risk: Users at edge cases (Alaska, New Zealand) may see incorrect distances or missing results
- Priority: Medium

**Convoy Edge Cases:**
- What's not tested: Empty convoy auto-delete, leader leave during active convoy, concurrent join/leave race conditions
- Files: `backend/src/backend/routers/convoys.py`
- Risk: Orphaned convoys, inconsistent member counts, Redis/Postgres state divergence
- Priority: Medium

---

*Concerns audit: 2026-06-10*
