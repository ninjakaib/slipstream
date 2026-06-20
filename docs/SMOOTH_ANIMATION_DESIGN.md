# Smooth Driver Animation Design

This document describes the design for smooth, continuous animation of driver markers on the map between discrete location updates received over WebSocket.

## Problem Statement

The spatial pub/sub system delivers location updates from each connected driver approximately once per second. In the current implementation, the map marker snaps instantly to each new position, creating a visually jarring "jumping" effect. The goal is to make driver movement appear smooth and fluid without sacrificing positional accuracy.

### Why Naïve Extrapolation Fails

A straightforward approach—animating the marker forward based on current speed and heading—fails because it **predicts the future**. For example:

1. At `t=0`, we receive an update: driver is heading north at 10 mph.
2. We animate the marker northward at 10 mph for 1 second.
3. At `t=1`, the next update arrives showing the driver only moved a fraction of that distance (they were braking for a red light).
4. The marker must jump **backwards** to the correct position, which looks worse than no animation at all.

Any prediction-based approach will overshoot or undershoot because the client cannot know what happens between updates.

---

## Solution: Buffer Interpolation (Render the Past Smoothly)

The core insight, borrowed from multiplayer game networking (Valve Source Engine, Overwatch, etc.), is:

> **Don't predict the future. Render the recent past smoothly.**

Instead of extrapolating ahead of the latest known position, we introduce a deliberate **render delay of one update interval (~1 second)**. This guarantees that at any moment, we always have two **known** positions to interpolate between.

### How It Works

1. At time `t=0`, we receive position `P1`. We place the marker there (no animation needed for the first point).
2. At time `t=1`, we receive position `P2`. We **do not** jump the marker to `P2`. Instead, we begin smoothly animating from `P1` → `P2` over the next ~1 second.
3. At time `t=2`, we receive position `P3`. We begin animating from `P2` → `P3`.
4. This continues indefinitely.

The displayed position is always ~1 second behind real-time. This delay is imperceptible to map viewers (you cannot tell a dot on a map is 1 second behind reality), but the motion is perfectly smooth and always accurate—we only ever interpolate between known positions, never extrapolating into the unknown.

---

## Architecture

### Component Overview

| Component | Responsibility |
|-----------|---------------|
| **Position Buffer** | Per-driver ring buffer storing last 2–3 received positions with timestamps |
| **Interpolation Engine** | Each frame, computes the display position between two buffered points |
| **Animation Loop** | `requestAnimationFrame` loop that updates the Mapbox GeoJSON source |
| **Adaptive LOD** | Adjusts frame rate and interpolation complexity based on zoom level |

### Data Flow

```
WebSocket message (driver_moved)
        │
        ▼
┌─────────────────────┐
│   Position Buffer   │  ← Mutable ref / plain object (NOT React state)
│  per-driver ring    │
│  buffer of 2-3      │
│  positions          │
└─────────────────────┘
        │
        ▼  (read by animation loop each frame)
┌─────────────────────┐
│ Interpolation Engine│  ← Computes lerp/spline position for current time
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ source.setData()    │  ← Direct Mapbox API call, bypasses React
└─────────────────────┘
```

### Position Buffer Structure (Per Driver)

Each driver maintains a small ring buffer of received positions:

```js
{
  user_id: "...",
  positions: [
    { lat, lng, heading, speed, status, receivedAt },  // P(n-1)
    { lat, lng, heading, speed, status, receivedAt },  // P(n)
  ],
  interpolationStartTime: <timestamp when we began animating toward P(n)>
}
```

When a new update arrives, shift the buffer: `P(n-1)` is discarded, `P(n)` becomes `P(n-1)`, and the new data becomes `P(n)`.

---

## Interpolation Strategies

### Linear Interpolation (Lerp)

The simplest approach. The marker moves in a straight line from `P1` to `P2` at constant speed over the expected interval duration.

```
displayPosition = P1 + (P2 - P1) * t,  where t ∈ [0, 1]
```

Suitable for medium zoom levels where turns aren't visually obvious.

### Cubic Hermite Spline

Uses heading and speed at both endpoints to construct a smooth curve that respects direction of travel. This makes turns look natural rather than angular.

The four inputs to a Hermite spline:
- `P1` — start position
- `P2` — end position
- `T1` — tangent at P1 (derived from heading and speed at P1)
- `T2` — tangent at P2 (derived from heading and speed at P2)

This produces a curve that departs P1 in the direction of P1's heading and arrives at P2 matching P2's heading. Ideal for street-level zoom where curves in the road are visible.

### Heading Interpolation

For the marker rotation (heading), use shortest-arc linear interpolation to avoid the marker spinning 350° instead of rotating -10°:

```
delta = targetHeading - currentHeading
if delta > 180: delta -= 360
if delta < -180: delta += 360
displayHeading = currentHeading + delta * t
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **First update (no P1)** | Place marker immediately, no animation |
| **Missed/late update** (gap > 1.5× expected interval) | Hold at last known position (marker decelerates to stop). Optionally extrapolate briefly (≤200ms) with speed decay, then hold. |
| **Speed = 0 at P2** | Interpolation still works — marker decelerates smoothly to rest at P2 |
| **Driver disconnects** | Remove marker (fade or immediate) upon receiving `driver_exited` |
| **Reconnection** | Treat the first post-reconnect position as a fresh first update; snap, then resume interpolation from next update |

---

## Adaptive Level of Detail (Zoom-Based)

At different zoom levels, the pixel distance covered by a driver per frame varies enormously. Animating sub-pixel movements is wasted work. We tier the animation quality based on zoom:

### Tier Definitions

| Zoom Tier | H3 Resolution | Frame Rate | Interpolation | Rationale |
|-----------|---------------|------------|---------------|-----------|
| **Coarse** (city/region) | 1–3 | 0 fps (snap on update) | None | Movements are sub-pixel; jumping is invisible |
| **Medium** (neighborhood) | 4 | 10–15 fps | Linear lerp | Movements are a few pixels; smooth enough |
| **Fine** (street level) | 5 | 30 fps | Cubic Hermite | Most visible movement, fewest drivers on screen |

### Per-Driver Pixel Velocity Culling

As an additional optimization, compute each driver's expected pixel velocity at the current zoom level:

```
pixelsPerFrame = (speed_in_degrees_per_second) * (pixels_per_degree_at_zoom) / frameRate
```

If `pixelsPerFrame < 0.5`, skip interpolation for that driver and snap them. This handles stationary or very slow drivers at any zoom level without wasting interpolation cycles.

---

## Rendering: Bypassing React

The animation loop must **not** flow through React state. React's reconciliation cycle at 30fps would be the performance bottleneck, not Mapbox.

### What lives outside React (mutable refs / plain objects):
- Position buffers for all drivers
- The interpolated positions computed each frame
- The `requestAnimationFrame` loop itself
- Direct `source.setData()` calls to Mapbox

### What remains in React state:
- Structural changes: driver appeared, driver exited (add/remove from buffer)
- UI state: zoom tier, hex grid toggle, connection status
- WebSocket lifecycle

This separation ensures the hot path (interpolate → build GeoJSON → setData) never triggers React re-renders.

---

## Network: Individual Messages vs. Batching

The interpolation architecture **decouples message arrival from rendering**. Incoming `driver_moved` messages only populate buffers; the animation loop renders independently. Therefore, batching provides no meaningful benefit and individual messages are preferred:

- **Lower latency** for new driver appearances (no waiting for batch flush)
- **Simpler server code** (no accumulation buffer or flush timer)
- **Natural backpressure** (WebSocket flow control works per-connection)
- **Buffer population is trivial** (~microseconds to parse JSON and insert into ring buffer)

Batching would only become relevant at extreme scale (thousands of simultaneous drivers) where TCP framing overhead or a binary protocol become considerations.

---

## Protocol Considerations

The existing `driver_moved` payload already includes `heading` and `speed`:

```json
{
  "type": "driver_moved",
  "payload": {
    "user_id": "...",
    "lat": 34.0522,
    "lng": -118.2437,
    "heading": 270.0,
    "speed": 12.5,
    "status": "driving"
  }
}
```

This is sufficient for cubic Hermite interpolation. One optional enhancement:

- **Server-side timestamp**: Adding a `timestamp` field to `driver_moved` would let the client know the exact time delta between consecutive samples (rather than assuming ~1 second). This improves interpolation accuracy when updates arrive at slightly irregular intervals.

---

## Summary

The key principles of this design:

1. **Never predict the future** — only interpolate between two known positions
2. **Accept ~1 second of display latency** — imperceptible to viewers, enables perfect smoothness
3. **Decouple network from rendering** — messages populate buffers; animation loop reads buffers
4. **Keep React out of the hot path** — mutable state + direct Mapbox API calls for animation
5. **Adapt quality to zoom** — full interpolation where it matters, no-ops where movements are invisible
6. **Graceful degradation** — missed updates cause smooth stops, not jerky jumps
