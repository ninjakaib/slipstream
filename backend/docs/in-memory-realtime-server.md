# Spatial Pub/Sub System

## Overview

The spatial module implements a real-time position streaming system using an in-memory spatial index with H3 hexagonal cells for event-driven dispatch. Drivers publish their position, viewers subscribe to cells covering their map viewport, and the server dispatches position events directly in-process with no external message broker on the hot path.

This replaces the previous Redis pub/sub + GEOSEARCH approach with a simpler, faster, single-process architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Server Process                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    SpatialStore (in-memory)                 │  │
│  │                                                            │  │
│  │  positions:     user_id → PositionState                    │  │
│  │  cell_members:  cell_id → set[user_id]   (spatial index)   │  │
│  │  cell_watchers: cell_id → set[user_id]   (routing table)   │  │
│  │  connections:   user_id → ConnectionState                  │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │                    Event Handlers                           │  │
│  │                                                            │  │
│  │  location_update → update state → dispatch to watchers     │  │
│  │  viewport_update → update watchers → send snapshot         │  │
│  │  disconnect → cleanup state → notify watchers              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         │
    WebSocket connections (/ws/live)
         │
┌────────▼────────┐
│     Clients      │
│                  │
│  Responsible for:│
│  • Computing H3  │
│    cells for own │
│    position      │
│  • Computing H3  │
│    cells for map │
│    viewport      │
└──────────────────┘
```

## Core Concepts

### H3 Cells

H3 is Uber's hexagonal spatial indexing system. Every point on Earth maps to a cell ID at each resolution level. Higher resolutions mean smaller cells:

| Resolution | Cell Edge Length | Use Case |
|:----------:|:---------------:|----------|
| 4 | ~22 km | Coarse regional grouping |
| 5 | ~8.5 km | City-level |
| 6 | ~3.2 km | Neighborhood-level |
| 7 | ~1.2 km | Street-level (default) |

Clients compute their H3 cell IDs locally and send them to the server. The server validates them but never computes cells itself — this offloads CPU from the server to the many clients.

### Spatial Index (`cell_members`)

Maps each H3 cell to the set of drivers whose position falls within that cell. When a driver sends a location update with their cells, the server adds them to each cell's member set. This is the equivalent of Redis GEOSEARCH but fully in-memory and O(1) per cell lookup.

### Routing Table (`cell_watchers`)

Maps each H3 cell to the set of users who want to receive events about that cell. When a driver moves within a cell, the server looks up all watchers for that cell and sends them the update. This is the dispatch mechanism — no polling, no scanning, just direct set lookups.

### Cell Transitions

When a driver moves, the server computes which cells they entered, exited, and stayed in by diffing their old cell set against their new cell set. This determines what events to send and to whom:

- **Stayed in a cell** → watchers of that cell get `driver_moved`
- **Entered a cell** → watchers of that cell get `driver_moved` (they see a new driver appear)
- **Exited a cell** → watchers of that cell who don't watch any of the driver's *current* cells get `driver_exited`

## Client Responsibilities

The client is responsible for:

1. **Computing H3 cells for its own position** — one cell per resolution level (typically resolutions 4–7, resulting in 4 cell IDs per update).

2. **Computing H3 cells covering its map viewport** — the set of cells at a chosen resolution that tile the visible map area. The resolution should match the zoom level (zoomed in = finer resolution, zoomed out = coarser resolution).

3. **Sending viewport updates when the map moves** — panning, zooming, or rotating the map should trigger a new viewport_update with the recalculated cells.

4. **Managing its own marker state** — the client maintains a local dictionary of drivers. It adds/updates markers from `viewport_snapshot` and `driver_moved` events, and removes markers from `driver_exited` events.

5. **Handling reconnection** — on disconnect, the client reconnects and re-sends its position and viewport. The server's state is reconstructed from client messages within seconds.

## Message Protocol

All messages are JSON over WebSocket.

### Client → Server

| Type | Payload | Purpose |
|------|---------|---------|
| `location_update` | `lat`, `lng`, `heading`, `speed`, `status`, `cells` | Report current position and H3 cells |
| `viewport_update` | `cells` | Report which H3 cells the map viewport covers |
| `heartbeat` | (empty) | Keep-alive ping, sent every ~15s |

### Server → Client

| Type | Payload | Purpose |
|------|---------|---------|
| `viewport_snapshot` | `drivers: [{user_id, lat, lng, heading, speed, status}, ...]` | Full state of all drivers in newly-subscribed cells |
| `driver_moved` | `user_id`, `lat`, `lng`, `heading`, `speed`, `status` | A driver in a watched cell updated their position |
| `driver_exited` | `user_id` | A driver left all watched cells or disconnected |
| `heartbeat_ack` | (empty) | Response to heartbeat |
| `error` | `message` | Invalid message format or unknown type |

### Implicit `driver_entered` Behavior

There is no explicit `driver_entered` message type. A new driver appearing in the viewport is delivered in one of two ways:

- **Via `viewport_snapshot`** — if the driver was already in the cell when the client subscribed to it.
- **Via `driver_moved`** — if the driver entered the cell after the client was already watching it.

The client should treat any `driver_moved` for an unknown `user_id` as a new driver appearing and create a marker for it.

## Data Flow Examples

### Driver Broadcasting

1. Client sends `location_update` with coordinates and H3 cells
2. Server validates and updates `positions` dict
3. Server diffs old cells vs new cells → computes transition
4. Server updates `cell_members` (add to entered, remove from exited)
5. Server collects watchers across all current cells (set union deduplicates)
6. Server sends `driver_moved` to each watcher via their WebSocket

### Viewer Subscribing

1. Client sends `viewport_update` with the H3 cells tiling their visible map
2. Server diffs old viewport vs new viewport → computes transition
3. Server adds client to `cell_watchers` for each new cell
4. Server removes client from `cell_watchers` for each removed cell
5. Server gathers all drivers in the newly-added cells
6. Server sends `viewport_snapshot` with those drivers' current positions

### Driver Disconnecting

1. WebSocket drops (network loss, app backgrounded, etc.)
2. Server retrieves driver's current cells from `positions`
3. Server removes driver from `positions`, `cell_members`, `cell_watchers`, `connections`
4. Server sends `driver_exited` to all watchers of the driver's former cells

## Design Decisions

### Why In-Memory (No Redis on Hot Path)

- **Zero network round-trips** for dispatch — dict lookup + WebSocket send
- **Microsecond latency** for the spatial index operations
- **No serialization overhead** — positions stay as Python objects
- **No external dependency** that can fail, lag, or need monitoring
- **Self-healing** — server state reconstructs from client messages on restart

### Why Client-Side H3 Computation

- **Offloads CPU** from the single server to the many clients
- **Clients already know their coordinates** from GPS
- **Clients already know their viewport** from the map SDK
- **H3 libraries exist for Swift/iOS** — no server round-trip needed

### Why No Persistence for Positions

Positions are ephemeral. If the server restarts:
1. All WebSocket connections drop
2. Clients reconnect within 1–3 seconds
3. Clients re-send their position and viewport
4. The entire spatial state is reconstructed from client messages

No Redis snapshot, no database replay, no state recovery code needed.

### Why `driver_exited` on Disconnect (Live-Only)

When a user disconnects, their position is immediately removed and watchers are notified. There is no "last known location" persistence. This is a privacy-first choice — when you stop sharing, you vanish.

A future "graceful fade" feature could keep the position in memory for a short TTL (e.g., 60 seconds) with a stale status before removing it. This would require a background reaper task.

### Passive Viewers

A user can subscribe to viewport cells without ever sending their own location. They will receive all position events for drivers in those cells. This supports:
- Privacy-conscious users who want to view but not broadcast
- Spectator mode
- Users who are stationary

## Limits and Safety

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Max viewport cells per client | 64 | Prevents subscribing to the entire world |
| Max position cells per client | 8 | One per resolution level, capped |
| Location update rate limit | 500ms minimum interval | Prevents flooding from misbehaving clients |
| Max speed | 300 | Caps obviously invalid values |
| H3 cell validation | `h3.is_valid_cell()` | Rejects garbage strings |

## Scalability

### Memory

| Concurrent Users | Estimated Memory |
|-----------------:|-----------------:|
| 1,000 | ~3 MB |
| 10,000 | ~30 MB |
| 50,000 | ~150 MB |
| 100,000 | ~300 MB |

The dominant cost is `cell_watchers` — each user watching 20+ cells means 20+ set entries across the routing table.

### Throughput

| Active Drivers | Updates/sec | CPU Usage (1 core) |
|---------------:|------------:|-------------------:|
| 500 | 500 | ~2.5% |
| 2,000 | 2,000 | ~10% |
| 5,000 | 5,000 | ~25% |
| 10,000 | 10,000 | ~50% |

The bottleneck is the fan-out: each update must be sent to every watcher of the driver's cells. In dense areas, this can mean 50–200 WebSocket sends per location update.

### Single-Process Limits

This architecture is designed for a single server process. Practical limits:
- ~10,000–15,000 actively-moving drivers (CPU bound on dispatch)
- ~100,000 total connected users (memory bound)
- Beyond this, you'd need to shard by geographic region (each server owns a set of H3 cells)

## Relationship to Existing Modules

The spatial module runs alongside the existing `realtime/` module during migration:

- **Existing `/ws` endpoint** — handles convoy chat, quick actions, Redis pub/sub. Still needed for convoy features.
- **New `/ws/live` endpoint** — handles position streaming only. No Redis, no database on the hot path.

Eventually, convoy events could be integrated into the spatial WebSocket or kept as a separate concern.

## Future Considerations

- **Graceful fade on disconnect** — keep positions briefly with "offline" status, reap after TTL
- **Resolution-aware batching** — throttle updates to coarse-cell watchers (they don't need per-second granularity at city zoom)
- **Fan-out cap in dense cells** — if a cell has 500+ watchers, batch position updates rather than sending individually
- **Redis mirror for REST consumers** — periodically snapshot positions to Redis for the discovery endpoint and admin tools
- **Multi-process sharding** — partition cells across processes if the single-process limit is reached
- **Username/display data in broadcasts** — currently only sends `user_id`; the client needs a way to resolve user metadata (could be added to the broadcast payload or fetched separately)


## Websocket Message Flow Examples

### Scenario A: Driver connects, starts broadcasting, viewer sees them

```
Timeline: Driver "Alice" connects, starts driving. Viewer "Bob" is already watching that area.

Bob is watching cells: ["872830828ffffff", "862830827ffffff"]
```

**Step 1 — Alice connects:**
```
Alice → Server:  [WebSocket connection to /ws/live?token=<jwt>]
Server → Alice:  [WebSocket accepted]
```

**Step 2 — Alice sends her viewport (she's also viewing the map):**
```json
Alice → Server:
{
  "type": "viewport_update",
  "payload": {
    "cells": ["872830828ffffff", "87283082affffff", "862830827ffffff"]
  }
}

Server → Alice:
{
  "type": "viewport_snapshot",
  "payload": {
    "drivers": [
      {
        "user_id": "bob-uuid",
        "lat": 34.0522,
        "lng": -118.2437,
        "heading": 90.0,
        "speed": 0.0,
        "status": "parked"
      }
    ]
  }
}
```
*Alice can see Bob (if Bob was also broadcasting). If Bob hasn't sent a location_update, this snapshot would be empty.*

**Step 3 — Alice sends her first location update:**
```json
Alice → Server:
{
  "type": "location_update",
  "payload": {
    "lat": 34.0525,
    "lng": -118.2440,
    "heading": 45.0,
    "speed": 35.0,
    "status": "driving",
    "cells": ["872830828ffffff", "862830827ffffff", "852830823ffffff", "842830821ffffff"]
  }
}
```
*No response to Alice. But Bob is watching `"872830828ffffff"`, so...*

```json
Server → Bob:
{
  "type": "driver_moved",
  "payload": {
    "user_id": "alice-uuid",
    "lat": 34.0525,
    "lng": -118.2440,
    "heading": 45.0,
    "speed": 35.0,
    "status": "driving"
  }
}
```

**Step 4 — Alice keeps driving (1 second later):**
```json
Alice → Server:
{
  "type": "location_update",
  "payload": {
    "lat": 34.0530,
    "lng": -118.2435,
    "heading": 48.0,
    "speed": 37.0,
    "status": "driving",
    "cells": ["872830828ffffff", "862830827ffffff", "852830823ffffff", "842830821ffffff"]
  }
}

Server → Bob:
{
  "type": "driver_moved",
  "payload": {
    "user_id": "alice-uuid",
    "lat": 34.0530,
    "lng": -118.2435,
    "heading": 48.0,
    "speed": 37.0,
    "status": "driving"
  }
}
```
*Same cells → `stayed` transition → just a `driver_moved`, no enter/exit events.*

---

### Scenario B: Driver crosses a cell boundary

```
Alice moves from cell "872830828ffffff" into "87283082affffff".
Bob is watching "872830828ffffff" but NOT "87283082affffff".
Carol is watching "87283082affffff" but NOT "872830828ffffff".
```

```json
Alice → Server:
{
  "type": "location_update",
  "payload": {
    "lat": 34.0580,
    "lng": -118.2390,
    "heading": 50.0,
    "speed": 40.0,
    "status": "driving",
    "cells": ["87283082affffff", "862830827ffffff", "852830823ffffff", "842830821ffffff"]
  }
}
```

The store computes:
- `entered`: `{"87283082affffff"}` (new res-7 cell)
- `exited`: `{"872830828ffffff"}` (old res-7 cell)
- `stayed`: `{"862830827ffffff", "852830823ffffff", "842830821ffffff"}` (coarser cells unchanged)

```json
Server → Carol:
{
  "type": "driver_moved",
  "payload": {
    "user_id": "alice-uuid",
    "lat": 34.0580,
    "lng": -118.2390,
    "heading": 50.0,
    "speed": 40.0,
    "status": "driving"
  }
}
```
*Carol is watching a cell Alice is now in (entered or stayed). She gets `driver_moved`.*

```json
Server → Bob:
{
  "type": "driver_exited",
  "payload": {
    "user_id": "alice-uuid"
  }
}
```
*Bob was watching `"872830828ffffff"` which Alice exited, and he's NOT watching any of Alice's current cells. So he gets `driver_exited`.*

**Important nuance:** If Bob was ALSO watching `"862830827ffffff"` (the coarser cell that Alice stayed in), he'd get `driver_moved` instead — because he's in the `watchers` set for a `stayed` cell. The `driver_exited` only goes to watchers who are EXCLUSIVELY watching exited cells and no current cells.

---

### Scenario C: Viewer pans their map (viewport update)

```
Bob pans his map east, revealing new cells and losing old ones.
```

```json
Bob → Server:
{
  "type": "viewport_update",
  "payload": {
    "cells": ["87283082affffff", "87283082cffffff", "862830827ffffff"]
  }
}
```

Previously Bob watched `["872830828ffffff", "862830827ffffff"]`.
- `added`: `{"87283082affffff", "87283082cffffff"}`
- `removed`: `{"872830828ffffff"}`

Server sends a snapshot of drivers currently in the newly-visible cells:

```json
Server → Bob:
{
  "type": "viewport_snapshot",
  "payload": {
    "drivers": [
      {
        "user_id": "alice-uuid",
        "lat": 34.0580,
        "lng": -118.2390,
        "heading": 50.0,
        "speed": 40.0,
        "status": "driving"
      },
      {
        "user_id": "dave-uuid",
        "lat": 34.0590,
        "lng": -118.2370,
        "heading": 180.0,
        "speed": 25.0,
        "status": "driving"
      }
    ]
  }
}
```

*From this point, Bob receives `driver_moved`/`driver_entered`/`driver_exited` for any changes in his new viewport cells.*

---

### Scenario D: Driver disconnects

```
Alice's app goes to background / loses connection.
```

```
Alice:  [WebSocket disconnects]
```

Server calls `handle_disconnect("alice-uuid")`:

```json
Server → Bob:
{
  "type": "driver_exited",
  "payload": {
    "user_id": "alice-uuid"
  }
}

Server → Carol:
{
  "type": "driver_exited",
  "payload": {
    "user_id": "alice-uuid"
  }
}
```

*All watchers of cells Alice was in get notified. Bob and Carol remove her marker.*

---

### Scenario E: Heartbeat keep-alive

```json
Alice → Server:
{
  "type": "heartbeat"
}

Server → Alice:
{
  "type": "heartbeat_ack"
}
```

*Simple ping/pong to keep the connection alive through proxies and detect dead sockets.*

---

### Summary of Message Types

| Direction | Type | When |
|-----------|------|------|
| Client → Server | `location_update` | Client moved, sends new position + cells |
| Client → Server | `viewport_update` | Client panned/zoomed map, sends new viewport cells |
| Client → Server | `heartbeat` | Every ~15s to keep connection alive |
| Server → Client | `viewport_snapshot` | After viewport_update, full state of newly-visible cells |
| Server → Client | `driver_moved` | A driver in a watched cell sent a new position |
| Server → Client | `driver_exited` | A driver left all watched cells or disconnected |
| Server → Client | `heartbeat_ack` | Response to heartbeat |
| Server → Client | `error` | Bad message format, unknown type, etc. |

Note that there's no explicit `driver_entered` event in the current implementation — the first time a watcher sees a new driver, it arrives either in a `viewport_snapshot` (if the driver was already there when the viewport was set) or as a `driver_moved` (if the driver moved into the cell after the viewport was set). The client just needs to handle "if I get a `driver_moved` for a user_id I don't have a marker for yet → add it." This simplifies the server logic since we don't need to distinguish between "first move into a watched cell" vs "subsequent move within a watched cell."




---

There are some code changes that aren't yet reflected in the doumentation though.  Here's the summary of what changed:

---

## Summary of Changes

### Design Decision: Split Responsibility

| Path | Who computes H3 cells | Rationale |

|------|:---------------------:|-----------|

| **Location updates** | Server | Authority, no validation needed, trivial CPU cost (~2μs per call × 4 resolutions) |

| **Viewport updates** | Client | Only the client knows its screen geometry, zoom level, and visible map bounds |

### Supported Resolutions: `(4, 5, 6, 7)`

| Res | Edge Length | Role |

|:---:|:-----------:|------|

| 4 | 26 km | City/metro overview (zoomed way out) |

| 5 | 9.8 km | District/highway corridor |

| 6 | 3.7 km | Neighborhood / normal driving zoom |

| 7 | 1.4 km | Street-level / zoomed in tight |

Every driver is indexed in exactly **4 cells** per location update. Viewers pick one resolution for their viewport based on zoom level.

### What Changed in Code

- **`store.py`**: `update_position()` no longer accepts a `cells` parameter — it computes them internally via `h3.latlng_to_cell()` at each `INDEX_RESOLUTIONS` level

- **`store.py`**: `_validate_cells()` renamed to `_validate_viewport_cells()` and now also rejects cells at unsupported resolutions

- **`handlers.py`**: `handle_location_update()` no longer reads or validates a `cells` field from the payload

- **`router.py`**: Added `GET /spatial/config` endpoint so clients can discover supported resolutions at runtime

- **Protocol**: `location_update` payload simplified to just `{lat, lng, heading, speed, status}`

### Updated Protocol

```

Client → Server:

  location_update: {lat, lng, heading, speed, status}     ← no cells

  viewport_update: {cells: ["872830828ffffff", ...]}       ← client computes these

  heartbeat: {}

```

The `/spatial/config` endpoint tells clients which resolutions to use when computing viewport cells, so the client and server always agree without hardcoding.

