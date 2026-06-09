# SlipStream — Backend Architecture Document

> **Version**: 1.0 (Draft)
> **Last Updated**: June 2025
> **Status**: MVP Architecture Definition

---

## 1. Overview

The SlipStream backend is a Python FastAPI server backed by Postgres (with PostGIS) for persistent data and Redis for ephemeral real-time state. There is no BaaS dependency — the server owns all business logic, auth, real-time communication, and data access.

### Design Principles

- **Keep it simple.** One server process handles REST, WebSocket, and background tasks. No microservices for MVP.
- **Own the hot path.** Real-time location streaming runs through our WebSocket handler with full control over protocol, batching, and fanout.
- **Postgres is the source of truth.** All durable data lives in Postgres. Redis is a cache and ephemeral state store — if Redis is flushed, the system recovers.
- **Stateless server, stateful connections.** The FastAPI server itself is stateless (can be horizontally scaled). WebSocket connections are the only stateful element, managed via Redis pub/sub for multi-instance fanout.

---

## 2. Infrastructure

```
┌──────────────────────────────────────────────────┐
│                  iOS App (Swift)                   │
│                                                    │
│  • Sign in with Apple (AuthenticationServices)     │
│  • REST client (URLSession / async-await)          │
│  • WebSocket client (URLSessionWebSocketTask)      │
└────────────────┬──────────────────┬───────────────┘
                 │ HTTPS            │ WSS
                 ▼                  ▼
┌──────────────────────────────────────────────────┐
│               FastAPI Server                      │
│          (Railway / Fly.io / Render)              │
│                                                    │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │  REST API  │ │ WebSocket  │ │  Background  │  │
│  │  Routes    │ │  Handler   │ │  Tasks       │  │
│  └────────────┘ └────────────┘ └──────────────┘  │
└────────────────┬──────────────────┬───────────────┘
                 │                  │
       ┌─────────┘                  └──────────┐
       ▼                                       ▼
┌──────────────────────┐          ┌──────────────────────┐
│   Neon (Postgres)    │          │   Upstash (Redis)    │
│                      │          │                      │
│  • PostGIS extension │          │  • GEO sets (live    │
│  • Users, Cars       │          │    positions)        │
│  • Convoys, Members  │          │  • Pub/Sub (location │
│  • Friendships       │          │    fanout, events)   │
│  • Chat messages     │          │  • Session store     │
│  • Routes            │          │  • Presence TTLs     │
│  • Friend requests   │          │                      │
└──────────────────────┘          └──────────────────────┘
```

### Services & Estimated Cost (MVP Scale)

| Service | Provider | Tier | Cost |
|---------|----------|------|------|
| API Server | Railway or Fly.io | Hobby | ~$5–7/mo |
| Postgres + PostGIS | Neon | Free tier (0.5 GB) | $0 |
| Redis | Upstash | Free tier (10k commands/day) | $0 |
| File Storage | Cloudflare R2 (or skip for MVP) | Free tier (10 GB) | $0 |
| Domain + TLS | Cloudflare | Free | $0 |

**Total MVP cost: ~$5–7/month**

---

## 3. Authentication

### Strategy

**Sign in with Apple** is the only auth method for MVP. This is the simplest path because:
- Native SwiftUI support (`SignInWithAppleButton`) — no third-party SDK
- Apple handles all UI, biometrics, credential storage
- We just validate their token server-side
- iOS-only app means 100% of users have an Apple ID

### Flow

```
┌─────────┐                    ┌─────────┐                  ┌─────────┐
│  User   │                    │ iOS App │                  │ FastAPI │
└────┬────┘                    └────┬────┘                  └────┬────┘
     │                              │                            │
     │  Tap "Sign in with Apple"    │                            │
     │─────────────────────────────▶│                            │
     │                              │                            │
     │  Apple auth UI (Face ID,     │                            │
     │  password, biometric)        │                            │
     │◀─────────────────────────────│                            │
     │                              │                            │
     │  Approve                     │                            │
     │─────────────────────────────▶│                            │
     │                              │                            │
     │                              │  POST /auth/apple          │
     │                              │  { identity_token,         │
     │                              │    full_name (first login) │
     │                              │    email (first login) }   │
     │                              │───────────────────────────▶│
     │                              │                            │
     │                              │        Validate token      │
     │                              │        against Apple JWKS  │
     │                              │        Create/find user    │
     │                              │        Issue our JWT       │
     │                              │                            │
     │                              │  { access_token,           │
     │                              │    refresh_token,          │
     │                              │    user, is_new_user }     │
     │                              │◀───────────────────────────│
     │                              │                            │
     │  If new user → onboarding    │                            │
     │  If existing → map           │                            │
     │◀─────────────────────────────│                            │
```

### Server-Side Token Validation

1. Fetch Apple's public keys from `https://appleid.apple.com/auth/keys` (cache these)
2. Decode the identity token JWT header to get the `kid`
3. Verify signature using the matching Apple public key
4. Validate claims: `iss` = `https://appleid.apple.com`, `aud` = your app's bundle ID, `exp` is not expired
5. Extract `sub` (Apple's stable user identifier) and `email` (if provided)

### Session Management

- **Access token**: Short-lived JWT (15 minutes), sent in `Authorization: Bearer <token>` header
- **Refresh token**: Long-lived opaque token (30 days), stored in Postgres, used to get new access tokens
- **Token refresh endpoint**: `POST /auth/refresh` — client calls when access token expires
- **Revocation**: Refresh tokens can be revoked (logout, security concern)

### JWT Payload (issued by our server)

```json
{
  "sub": "user_uuid",
  "iat": 1719500000,
  "exp": 1719500900,
  "username": "apexkai"
}
```

---

## 4. Database Schema (Postgres + PostGIS)

### Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### Tables

#### users

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key, generated |
| apple_id | TEXT | Apple's `sub` claim, unique, indexed |
| username | TEXT | Unique, indexed, lowercase |
| display_name | TEXT | Nullable (from Apple on first login) |
| email | TEXT | Nullable (Apple may hide it) |
| avatar_url | TEXT | Nullable, URL to profile photo |
| visibility | ENUM | `'on'`, `'friends_only'`, `'ghost'` |
| discovery_radius_miles | INTEGER | Default 15 |
| speed_unit | ENUM | `'mph'`, `'kph'` |
| created_at | TIMESTAMPTZ | Default now() |
| updated_at | TIMESTAMPTZ | Auto-updated |

#### cars

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users, indexed |
| year | INTEGER | |
| make | TEXT | |
| model | TEXT | |
| trim | TEXT | Nullable |
| color | TEXT | Hex or named color |
| photo_url | TEXT | Nullable |
| mods | TEXT[] | Array of mod strings |
| is_active | BOOLEAN | Only one per user should be true |
| created_at | TIMESTAMPTZ | |

Constraint: Only one car per user can have `is_active = true` (enforced via partial unique index or application logic).

#### friendships

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| requester_id | UUID | FK → users |
| addressee_id | UUID | FK → users |
| status | ENUM | `'pending'`, `'accepted'` |
| created_at | TIMESTAMPTZ | |
| accepted_at | TIMESTAMPTZ | Nullable |

Unique constraint on `(requester_id, addressee_id)`. Query for friends = rows where status is `'accepted'` and either column matches the user.

#### convoys

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | |
| leader_id | UUID | FK → users |
| visibility | ENUM | `'public'`, `'private'` |
| status | ENUM | `'forming'`, `'active'`, `'ended'` |
| destination_name | TEXT | Nullable |
| destination_point | GEOGRAPHY(Point, 4326) | Nullable, PostGIS |
| created_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | Nullable |

#### convoy_members

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| convoy_id | UUID | FK → convoys, indexed |
| user_id | UUID | FK → users, indexed |
| role | ENUM | `'leader'`, `'member'` |
| joined_at | TIMESTAMPTZ | |

Unique constraint on `(convoy_id, user_id)`.

#### convoy_join_requests

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| convoy_id | UUID | FK → convoys |
| user_id | UUID | FK → users |
| status | ENUM | `'pending'`, `'accepted'`, `'declined'` |
| created_at | TIMESTAMPTZ | |

#### convoy_messages

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| convoy_id | UUID | FK → convoys, indexed |
| sender_id | UUID | FK → users, nullable (null = system message) |
| content | TEXT | Message text |
| message_type | ENUM | `'text'`, `'system'`, `'quick_action'` |
| created_at | TIMESTAMPTZ | Indexed (for ordering) |

These are ephemeral — deleted when convoy status becomes `'ended'`.

#### convoy_routes

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| convoy_id | UUID | FK → convoys |
| set_by_user_id | UUID | FK → users |
| destination_name | TEXT | |
| destination_point | GEOGRAPHY(Point, 4326) | |
| waypoints | JSONB | Ordered array of {lat, lng, name?} |
| route_geometry | GEOGRAPHY(LineString, 4326) | Full route line, nullable |
| created_at | TIMESTAMPTZ | |

Only one active route per convoy at a time (latest wins, or soft-delete previous).

#### refresh_tokens

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| token_hash | TEXT | bcrypt hash of the refresh token |
| expires_at | TIMESTAMPTZ | |
| revoked | BOOLEAN | Default false |
| created_at | TIMESTAMPTZ | |

#### push_tokens

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| device_token | TEXT | APNs device token |
| created_at | TIMESTAMPTZ | |

---

## 5. Redis Data Structures

Redis handles all **ephemeral, high-frequency, real-time** state. If Redis is flushed, users simply reconnect and re-report their positions.

### Live Positions (GEO Set)

```
Key: positions:live
Type: GEO set
Members: user_id
Coordinates: (longitude, latitude)
```

**Operations:**
- `GEOADD positions:live <lng> <lat> <user_id>` — update position
- `GEOSEARCH positions:live FROMMEMBER <user_id> BYRADIUS <miles> mi ASC` — find nearby users
- `ZREM positions:live <user_id>` — remove when user goes offline/ghost

### Position Metadata (Hash per user)

```
Key: pos:<user_id>
Type: HASH
Fields:
  lat: 34.1341
  lng: -118.3215
  heading: 91.4
  speed: 55
  status: driving
  road: "Angeles Crest Hwy"
  updated_at: 1719500000
TTL: 120 seconds (auto-expire if user stops updating)
```

### Presence / Online Status

```
Key: presence:<user_id>
Type: STRING
Value: "online"
TTL: 30 seconds (refreshed with each WebSocket heartbeat)
```

If the key expires, the user is considered offline. WebSocket clients send heartbeats every 15 seconds to keep presence alive.

### Convoy Active Members (Set per convoy)

```
Key: convoy:<convoy_id>:members
Type: SET
Members: user_id values
```

Used for quick fanout — "who do I need to send this location update to?"

### Pub/Sub Channels

```
Channel: location:<user_id>
Purpose: Fan out position updates for this user to all subscribers

Channel: convoy:<convoy_id>
Purpose: Convoy events (join, leave, quick actions, route changes, chat messages)
```

**Subscription logic:**
- When you load the map, you subscribe to location channels for all users within your radius
- When you join a convoy, you subscribe to that convoy's channel
- The server publishes to these channels; your WebSocket connection receives and forwards to the client

---

## 6. API Endpoints (REST)

All endpoints require `Authorization: Bearer <access_token>` unless noted.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/apple` | Exchange Apple identity token for access + refresh tokens |
| POST | `/auth/refresh` | Exchange refresh token for new access token |
| POST | `/auth/logout` | Revoke refresh token |

### Users / Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Get current user's profile |
| PATCH | `/users/me` | Update profile (username, display_name, avatar_url, visibility, etc.) |
| GET | `/users/{user_id}` | Get another user's public profile |
| GET | `/users/search?q={query}` | Search users by username |
| DELETE | `/users/me` | Delete account |

### Garage (Cars)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cars` | List current user's cars |
| POST | `/cars` | Add a car to garage |
| PATCH | `/cars/{car_id}` | Update car details |
| DELETE | `/cars/{car_id}` | Remove car from garage (must keep at least one) |
| POST | `/cars/{car_id}/activate` | Set this car as active |

### Friends

| Method | Path | Description |
|--------|------|-------------|
| GET | `/friends` | List all friends (accepted) |
| GET | `/friends/requests` | List pending incoming requests |
| POST | `/friends/request` | Send friend request `{ user_id }` |
| POST | `/friends/accept` | Accept friend request `{ request_id }` |
| POST | `/friends/decline` | Decline friend request `{ request_id }` |
| DELETE | `/friends/{user_id}` | Remove friend |

### Convoys

| Method | Path | Description |
|--------|------|-------------|
| POST | `/convoys` | Create convoy `{ name, visibility }` |
| GET | `/convoys/{convoy_id}` | Get convoy details + members |
| PATCH | `/convoys/{convoy_id}` | Update convoy (leader only: name, visibility) |
| POST | `/convoys/{convoy_id}/end` | End convoy (leader only) |
| POST | `/convoys/{convoy_id}/join` | Join directly (if friend's convoy) |
| POST | `/convoys/{convoy_id}/request` | Request to join (public convoys) |
| POST | `/convoys/{convoy_id}/leave` | Leave convoy |
| POST | `/convoys/{convoy_id}/invite` | Invite user `{ user_id }` |
| POST | `/convoys/{convoy_id}/kick` | Remove member (leader only) `{ user_id }` |
| GET | `/convoys/{convoy_id}/messages` | Get recent chat messages (paginated) |
| POST | `/convoys/{convoy_id}/route` | Set group route `{ destination, waypoints }` |

### Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/discovery/nearby` | Get nearby drivers within user's radius. Returns list with position, status, car, distance. Respects visibility settings. |
| GET | `/discovery/convoys` | Get active public convoys within radius |

Query params for filtering: `?status=driving`, `?make=Toyota`, `?friends_only=true`

### Notifications / Push

| Method | Path | Description |
|--------|------|-------------|
| POST | `/push/register` | Register APNs device token |
| DELETE | `/push/unregister` | Remove device token |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | Get user preferences |
| PATCH | `/settings` | Update preferences (radius, units, notification toggles) |

---

## 7. WebSocket Protocol

The WebSocket connection handles all real-time communication. One persistent connection per client session.

### Connection

```
WSS wss://api.slipstream.app/ws?token=<access_token>
```

Token is validated on connection. If invalid/expired, connection is rejected with 4001 close code.

### Message Format

All messages are JSON with a `type` field:

```json
{
  "type": "message_type",
  "payload": { ... },
  "ts": 1719500000
}
```

### Client → Server Messages

#### `location_update`

Sent by client every 1–5 seconds while in driving mode (adaptive based on speed and movement).

```json
{
  "type": "location_update",
  "payload": {
    "lat": 34.1341,
    "lng": -118.3215,
    "heading": 91.4,
    "speed": 55,
    "altitude": 1200,
    "road_name": "Angeles Crest Hwy",
    "status": "driving"
  }
}
```

**Server behavior:**
1. Update Redis GEO set and position hash
2. Publish to `location:<user_id>` channel
3. All subscribers (users who have this user in their radius) receive the update via their WebSocket

#### `heartbeat`

Sent every 15 seconds to maintain presence.

```json
{
  "type": "heartbeat"
}
```

**Server behavior:** Refresh `presence:<user_id>` TTL in Redis.

#### `status_change`

```json
{
  "type": "status_change",
  "payload": {
    "status": "driving"
  }
}
```

Valid statuses: `driving`, `parked`, `en_route`, `in_convoy`, `offline`

#### `convoy_message`

```json
{
  "type": "convoy_message",
  "payload": {
    "convoy_id": "uuid",
    "content": "Pulling up to the Shell now"
  }
}
```

**Server behavior:**
1. Store in `convoy_messages` table
2. Publish to `convoy:<convoy_id>` channel
3. All convoy members receive via WebSocket

#### `quick_action`

```json
{
  "type": "quick_action",
  "payload": {
    "convoy_id": "uuid",
    "action": "gas_stop"
  }
}
```

Valid actions: `pull_over`, `gas_stop`, `slow_down`, `regrouping`

**Server behavior:**
1. Store as system message in `convoy_messages`
2. Publish to convoy channel
3. Trigger push notification to convoy members not on WebSocket

#### `subscribe_area`

Tells the server what geographic area the client cares about (for receiving nearby driver updates).

```json
{
  "type": "subscribe_area",
  "payload": {
    "lat": 34.1341,
    "lng": -118.3215,
    "radius_miles": 15
  }
}
```

**Server behavior:** Update the user's subscription — they'll receive location updates for any visible user within this radius.

### Server → Client Messages

#### `driver_location`

Position update for a nearby driver.

```json
{
  "type": "driver_location",
  "payload": {
    "user_id": "uuid",
    "lat": 34.1490,
    "lng": -118.3521,
    "heading": 180.2,
    "speed": 42,
    "status": "driving",
    "road_name": "Mulholland Dr"
  }
}
```

#### `driver_entered`

A new driver entered your discovery radius (or came online).

```json
{
  "type": "driver_entered",
  "payload": {
    "user_id": "uuid",
    "username": "apexkai",
    "car": {
      "year": 2020,
      "make": "Toyota",
      "model": "Supra",
      "trim": "3.0",
      "color": "#FF6600"
    },
    "lat": 34.1490,
    "lng": -118.3521,
    "status": "driving",
    "is_friend": true
  }
}
```

#### `driver_exited`

A driver left your radius or went offline/ghost.

```json
{
  "type": "driver_exited",
  "payload": {
    "user_id": "uuid"
  }
}
```

#### `convoy_event`

Convoy state change broadcast to members.

```json
{
  "type": "convoy_event",
  "payload": {
    "convoy_id": "uuid",
    "event": "member_joined",
    "data": {
      "user_id": "uuid",
      "username": "boostedmia"
    }
  }
}
```

Event types: `member_joined`, `member_left`, `member_kicked`, `route_set`, `convoy_ended`, `quick_action`, `invite_received`, `join_request`

#### `convoy_chat`

Chat message broadcast to convoy members.

```json
{
  "type": "convoy_chat",
  "payload": {
    "convoy_id": "uuid",
    "message_id": "uuid",
    "sender_id": "uuid",
    "sender_username": "apexkai",
    "content": "Fueling up at the Shell now.",
    "message_type": "text",
    "ts": 1719500000
  }
}
```

#### `notification`

In-app notification (friend request, convoy invite, etc.).

```json
{
  "type": "notification",
  "payload": {
    "notification_type": "friend_request",
    "from_user": {
      "user_id": "uuid",
      "username": "rallynoah"
    },
    "message": "rallynoah wants to be friends"
  }
}
```

---

## 8. Real-Time Location Fanout

This is the most performance-critical path in the system. Here's how it works:

### Update Flow

```
Client sends location_update
        │
        ▼
┌─────────────────────────────┐
│  FastAPI WebSocket Handler  │
│                             │
│  1. Validate user session   │
│  2. Rate limit (max 1/sec)  │
│  3. Update Redis GEO set    │
│  4. Update Redis pos hash   │
│  5. Publish to Redis        │
│     channel: location:<uid> │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Redis Pub/Sub              │
│                             │
│  All server instances       │
│  subscribed to relevant     │
│  location channels          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Server forwards to clients │
│  who have that user in      │
│  their subscription radius  │
└─────────────────────────────┘
```

### Subscription Management

When a client connects or sends `subscribe_area`:
1. Query Redis GEO: `GEOSEARCH positions:live FROMLONLAT <lng> <lat> BYRADIUS <radius> mi`
2. Get all user_ids in range
3. Filter by visibility rules (check if each user allows this viewer to see them)
4. Subscribe the server to `location:<user_id>` Redis channels for all visible users
5. Send initial `driver_entered` messages for each visible user

Periodically (every 30 seconds), re-evaluate subscriptions:
- New users entered radius → subscribe + send `driver_entered`
- Users left radius → unsubscribe + send `driver_exited`

### Visibility Enforcement

Before forwarding any location update to a viewer:

| Driver's visibility | Viewer is friend? | Result |
|--------------------|--------------------|--------|
| `on` | Yes or No | Send location |
| `friends_only` | Yes | Send location |
| `friends_only` | No | Do not send |
| `ghost` | Yes or No | Do not send |

This check happens at subscription time AND at fanout time (in case visibility changed).

### Adaptive Update Rate

The client should adjust how often it sends `location_update`:

| Condition | Update interval |
|-----------|----------------|
| Driving > 10 mph | Every 2 seconds |
| Driving < 10 mph | Every 5 seconds |
| Parked / stationary | Every 30 seconds |
| App backgrounded | Every 30–60 seconds |
| No movement detected | Stop sending (rely on presence heartbeat) |

This saves battery and reduces server load without sacrificing real-time feel.

---

## 9. Convoy State Machine

Convoys are the most complex stateful entity in the system. Here's how state transitions work:

### Lifecycle

```
           create
             │
             ▼
┌─────────────────────┐
│      FORMING        │  (leader created, waiting for members)
│                     │
│  Members can join   │
│  Route can be set   │
│  Chat is active     │
└──────────┬──────────┘
           │ (automatic when first member starts driving,
           │  or leader explicitly starts)
           ▼
┌─────────────────────┐
│      ACTIVE         │  (convoy is live, members driving)
│                     │
│  Location sharing   │
│  Quick actions      │
│  Route navigation   │
│  Chat is active     │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
  Leader      All members
  ends it      leave
     │           │
     └─────┬─────┘
           ▼
┌─────────────────────┐
│       ENDED         │  (convoy dissolved)
│                     │
│  Chat deleted       │
│  Members released   │
│  Removed from map   │
└─────────────────────┘
```

### Join Mechanics

| Convoy Visibility | Viewer Relationship | Join Method |
|-------------------|--------------------| ------------|
| Public | Anyone | Request → leader approves |
| Public | Friend of any member | Join directly |
| Private | Invited | Accept invite → join |
| Private | Not invited | Cannot see or join |

### Convoy Constraints (MVP)

- A user can only be in **one convoy at a time**
- No maximum member count for MVP (revisit if performance issues arise)
- Any member can set a group route (not just leader)
- Quick actions are available to all members
- Only the leader can end the convoy or kick members

---

## 10. Push Notifications

For messages that need to reach users when they're not connected via WebSocket.

### Implementation

- Apple Push Notification Service (APNs) via HTTP/2
- Device tokens registered via `POST /push/register`
- Server sends push when WebSocket delivery fails (user not connected)

### Notification Triggers

| Event | Push? | Condition |
|-------|-------|-----------|
| Friend request received | Yes | Always |
| Friend request accepted | Yes | Always |
| Convoy invite received | Yes | Always |
| Convoy join request (to leader) | Yes | Always |
| Chat message in convoy | Yes | Only if user's WebSocket is disconnected |
| Quick action in convoy | Yes | Only if user's WebSocket is disconnected |

### Payload Format (APNs)

```json
{
  "aps": {
    "alert": {
      "title": "Convoy Invite",
      "body": "apexkai invited you to Angeles Crest Run"
    },
    "sound": "default",
    "badge": 1
  },
  "data": {
    "type": "convoy_invite",
    "convoy_id": "uuid"
  }
}
```

The `data` field lets the iOS app deep-link to the relevant screen when the notification is tapped.

---

## 11. Discovery & Spatial Queries

### "Who's near me?" (Hot path — Redis)

Used for real-time map display. Fast, ephemeral, updated constantly.

```
GEOSEARCH positions:live FROMLONLAT <lng> <lat> BYRADIUS <radius> mi ASC COUNT 100
```

Returns user_ids + distances. Server then:
1. Filters by visibility rules
2. Fetches position metadata from `pos:<user_id>` hashes
3. Returns enriched driver objects

### "Nearby active convoys" (Warm path — Postgres)

Convoys don't move as fast as individual drivers. Query Postgres:

```sql
SELECT c.*, ST_Distance(
  c.destination_point,
  ST_MakePoint(:lng, :lat)::geography
) as distance
FROM convoys c
JOIN convoy_members cm ON cm.convoy_id = c.id
WHERE c.status IN ('forming', 'active')
  AND c.visibility = 'public'
  -- Use leader's live position from Redis for convoy location
ORDER BY distance ASC
LIMIT 20;
```

For convoy map position, use the leader's (or centroid of members') live Redis position rather than a static DB field.

### Advanced Filters

Filters are applied **after** the spatial query:

```sql
-- Filter by car make
SELECT u.* FROM users u
JOIN cars ca ON ca.user_id = u.id AND ca.is_active = true
WHERE u.id = ANY(:nearby_user_ids)
  AND ca.make ILIKE :make_filter;
```

```sql
-- Filter by status
-- Status is in Redis, so filter in application code after GEO query
```

---

## 12. Data Cleanup & Ephemeral Lifecycle

### Convoy Cleanup

When a convoy ends (leader ends or last member leaves):
1. Set `convoys.status = 'ended'`, `convoys.ended_at = now()`
2. Delete all rows from `convoy_messages` for that convoy_id
3. Delete `convoy:<convoy_id>:members` from Redis
4. Unsubscribe all members from convoy pub/sub channel

This can run as a background task to avoid blocking the request.

### Position Expiry

- Redis position hashes (`pos:<user_id>`) have 120-second TTL
- If a user stops sending updates (app killed, lost signal), their position auto-expires
- The GEO set member should also be cleaned up — a periodic background task removes users whose `pos:<user_id>` hash has expired

### Presence Expiry

- `presence:<user_id>` has 30-second TTL, refreshed by heartbeat
- When presence expires → user is considered offline
- Server sends `driver_exited` to anyone who had them in their subscription

---

## 13. Security Considerations

### Rate Limiting

| Endpoint / Action | Limit |
|-------------------|-------|
| Location updates (WebSocket) | Max 1 per second per user |
| REST API calls | 60 requests/minute per user |
| Chat messages | 10 messages/minute per user |
| Friend requests | 20/hour |
| Convoy creation | 5/hour |

### Input Validation

- All coordinates validated: lat ∈ [-90, 90], lng ∈ [-180, 180]
- Speed capped at reasonable max (200 mph) — discard outliers
- Username: alphanumeric + underscores, 3–20 chars
- Chat messages: max 500 chars
- Convoy names: max 50 chars

### Privacy

- Users in ghost mode are **never** included in GEO queries or location fanout
- Friends-only users are filtered at query time — their position exists in Redis but is never sent to non-friends
- When a user deletes their account, all data is purged (positions, friendships, convoy memberships, messages)

---

## 14. File Storage (Car Photos / Avatars)

### MVP Approach

For MVP, use **Cloudflare R2** (S3-compatible, free tier generous):

1. Client requests upload URL: `POST /uploads/presign` → returns presigned PUT URL
2. Client uploads directly to R2 (no file data hits our server)
3. Client sends the resulting URL to our API (e.g., `PATCH /cars/{id}` with `photo_url`)
4. Photos served via Cloudflare CDN (automatic with R2)

### Constraints

- Max file size: 5 MB
- Accepted formats: JPEG, PNG, HEIC
- Images should be resized client-side before upload (max 1200px wide)

### Skip-for-MVP Option

If photos add too much scope, defer them entirely. The app works fine with:
- Colored circles based on car color for map markers
- Car info displayed as text (year/make/model)
- No avatar, or auto-generated avatar from initials

---

## 15. Deployment & Operations

### Server

- **Platform**: Railway (simplest) or Fly.io (if multi-region needed later)
- **Runtime**: Python 3.12, uvicorn with WebSocket support
- **Process**: Single process for MVP (uvicorn handles async REST + WebSocket concurrently)
- **Environment variables**: Database URL, Redis URL, Apple auth keys, JWT secret, APNs credentials

### Database Migrations

- Use **Alembic** for schema migrations
- Migrations tracked in version control
- Applied manually or via deploy hook

### Monitoring (Minimal for MVP)

- Railway/Fly.io built-in logs and metrics
- Structured logging (JSON) from FastAPI
- Upstash Redis dashboard for connection/command metrics
- Neon dashboard for query performance

### Scaling Notes (Post-MVP)

When scale demands it:
- Add more server instances behind a load balancer
- Redis pub/sub ensures location fanout works across instances
- Sticky sessions NOT required (WebSocket state is in Redis, not server memory)
- If Redis GEO becomes a bottleneck: shard by geohash prefix
- If Postgres becomes a bottleneck: read replicas for discovery queries

---

## 16. Development Priorities (Build Order)

This is the recommended order for implementing the backend:

| Phase | Features | Why First |
|-------|----------|-----------|
| 1 | Auth (Apple Sign In) + User CRUD + Car CRUD | Can't do anything without users and identity |
| 2 | WebSocket connection + Location streaming + Redis GEO | Core value prop — see people on the map |
| 3 | Friendships (request/accept/list) | Social layer needed before convoys make sense |
| 4 | Discovery endpoint (nearby drivers with filters) | Completes the "see who's around" loop |
| 5 | Convoys (create/join/leave/end) + Member management | Core social driving feature |
| 6 | Convoy chat (text + quick actions via WebSocket) | Communication within convoys |
| 7 | Convoy routes (set destination, per-member routing) | Group navigation |
| 8 | Push notifications | Reach users when app is backgrounded |
| 9 | File uploads (car photos, avatars) | Polish, not critical for function |

---

*End of document. This describes what the backend must do and how it's structured — implementation details (specific libraries, exact code patterns) will be determined during development.*
