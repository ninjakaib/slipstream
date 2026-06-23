# Navigation & Driving Experience Features

> Feature exploration and feasibility analysis for SlipStream's driving-focused navigation capabilities.

---

## Table of Contents

1. [Fun Roads Map Layer](#1-fun-roads-map-layer)
2. [Drive Recording & Custom Routes](#2-drive-recording--custom-routes)
3. [Recommendation System & AI-Drive](#3-recommendation-system--ai-drive)
4. [Rally-Style Navigation Callouts](#4-rally-style-navigation-callouts)
5. [Color-Coded Route Line (Corner Speed)](#5-color-coded-route-line-corner-speed)
6. [Braking Zone Visualization](#6-braking-zone-visualization)
7. [Live G-Force Meter](#7-live-g-force-meter)
8. [Implementation Priority](#8-implementation-priority)

---

## 1. Fun Roads Map Layer

### Concept

A custom map layer that highlights roads based on how "fun" they are to drive. Instead of the standard map hierarchy (freeways shown first, then smaller roads as you zoom), this layer uses an **inverted hierarchy** — the most fun roads appear at the highest zoom levels, and progressively more "boring" roads appear as you zoom in.

Roads are scored based on curviness, elevation change, surface quality, and traffic density. Higher-scored roads are rendered more prominently (color, width, opacity).

### Feasibility: High

The data pipeline is the hardest part. Rendering is well-supported by Mapbox.

### Data Sources & Signals

| Signal | Data Source | Availability | Difficulty |
|--------|-------------|--------------|------------|
| Curviness (sinuosity) | OpenStreetMap geometry — ratio of path length to straight-line distance | Excellent — free, global | Low |
| Elevation change | USGS SRTM (30m), Mapbox Terrain-RGB tiles | Good — free globally | Medium |
| Surface smoothness | OSM `surface=*` and `smoothness=*` tags | Spotty — good in EU, decent in US for major roads | Medium (gap-filling needed) |
| Traffic density | Mapbox Traffic API, TomTom, HERE | Good — but expensive at scale | Low technically, high cost |
| Road width / lanes | OSM `lanes=*`, `width=*` | Moderate coverage | Low |

### Existing Projects & Datasets

#### curvature.py (Adam Franco)

**Repo:** `github.com/adamfranco/curvature`

The most directly relevant open-source project:
- Processes OSM data to calculate road curvature/sinuosity
- Outputs scored road segments with a "curvature" value
- Generates KML/GeoJSON files for visualization
- Has **pre-generated datasets** for many US states and European countries
- Specifically built for the "find fun motorcycle/driving roads" use case

**Algorithm:**
- Joins OSM ways into logical road segments
- Calculates deflection angle at each node
- Sums curvature per segment (total degrees of turning per km)
- Filters out low-speed roads (residential) and highways
- Outputs with color coding by curvature score

**Limitations:** Only considers curvature — no elevation, surface, or traffic.

#### osmnx (Geoff Boeing)

**Repo:** `github.com/gboeing/osmnx`

Academic-quality Python library for street network analysis:
- Download road networks as NetworkX graphs
- Compute grade (elevation change) per edge using SRTM/Google Elevation
- Calculate edge bearings, sinuosity, straightness
- Built-in elevation module for adding grade data to every edge
- Best bet for feature engineering code

#### Community / Curated Datasets (for validation/training)

| Source | Coverage | Notes |
|--------|----------|-------|
| motorcycleroads.com | US | User-rated roads with lat/lng, scrapeable |
| dangerousroads.org | Worldwide | Scenic/challenging roads, curated |
| passopencheck.ch | Europe (Alps) | Alpine passes with elevation profiles |
| Porsche Roads (formerly roads.porsche.com) | Global | Closest commercial equivalent — community-rated segments |
| Calimoto | Global | Motorcycle nav app that routes for curviness |

#### Academic References

Search terms for Google Scholar:
- "road sinuosity index GIS"
- "motorcycle route planning scenic"
- "road geometry extraction OpenStreetMap"
- "driving enjoyment road characteristics"
- "scenic route planning crowd-sourced data"

### Technical Approach

#### Phase 1: Core Scoring Pipeline

1. **Extract** road segments from OSM using `osmnx` or raw `.osm.pbf` extracts (from Geofabrik)
2. **Compute features** per segment:
   - Sinuosity index (path length / straight-line distance)
   - Total degrees of turning per km
   - Elevation gain/loss per km (from SRTM)
   - Surface quality score (from OSM tags)
3. **Score** each segment: `fun_score = w1*curvature + w2*elevation + w3*surface - w4*traffic`
4. **Store** as PostGIS table with geometry + `fun_score` column
5. **Tile** with Tippecanoe — use `fun_score` to control `minzoom` per feature (highest scored roads retained at lowest zoom levels)

#### Phase 2: Enrichment

- Add traffic data (Mapbox Traffic tiles or HERE API)
- Incorporate surface/smoothness OSM tags where available
- Use curated community data (motorcycle road sites) as validation ground truth
- User-recorded drives as engagement signal

#### Phase 3: ML Scoring (once user data exists)

- Train on user engagement signals (roads people drive repeatedly, high ratings)
- Feature vector: curvature, grade, surface, width, scenery proxy, traffic
- Model: Gradient-boosted trees (interpretable, fast inference)
- Retrain periodically as more user data comes in

### Rendering

The inverted-hierarchy tiling is well-supported by Tippecanoe:
- Use `-Z` / `-z` per feature based on score
- Highest-scored roads: visible from z5-6
- Medium-scored: appear at z8-10
- Lower-scored: appear at z12-14
- All roads visible by z15+

Color the line layer using a data-driven expression on `fun_score`:

```json
{
  "id": "fun-roads",
  "type": "line",
  "source": "fun-roads-tileset",
  "paint": {
    "line-color": [
      "interpolate", ["linear"], ["get", "fun_score"],
      0, "#888888",
      0.25, "#FFD700",
      0.5, "#FF8C00",
      0.75, "#FF4500",
      1.0, "#FF0000"
    ],
    "line-width": [
      "interpolate", ["linear"], ["get", "fun_score"],
      0, 1,
      0.5, 2,
      1.0, 4
    ],
    "line-opacity": [
      "interpolate", ["linear"], ["get", "fun_score"],
      0, 0.4,
      0.5, 0.7,
      1.0, 1.0
    ]
  }
}
```

### Serving Options

| Option | Pros | Cons |
|--------|------|------|
| Upload to Mapbox as custom tileset | Managed hosting, CDN, integrates with Studio | Storage limits on free tier, update latency |
| Self-host with `martin` (PostGIS → MVT) | Real-time updates, full control | Infra to manage |
| Pre-generate `.mbtiles` + static hosting | Simple, cheap (S3/R2) | Stale until regenerated |

---

## 2. Drive Recording & Custom Routes

### Concept

Users can record their drives (GPS traces with metadata), save routes for later, and share them with the community.

### Feasibility: High

Leverages existing WebSocket location-streaming infrastructure.

### Technical Approach

#### Recording

- Client sends GPS updates via existing WebSocket connection
- Backend persists the stream as a PostGIS `LineStringZ` (with elevation from device GPS)
- Attach metadata: timestamp, duration, car used, weather conditions
- Compute post-hoc analytics: max speed, avg speed, elevation profile, total curvature

#### Storage Schema

```sql
CREATE TABLE drive_recordings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    car_id UUID REFERENCES cars(id),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    geometry GEOMETRY(LineStringZ, 4326) NOT NULL,
    distance_km FLOAT,
    elevation_gain_m FLOAT,
    duration_seconds INTEGER,
    fun_score FLOAT,  -- computed from road segments traversed
    is_public BOOLEAN DEFAULT false,
    metadata JSONB
);

CREATE INDEX idx_recordings_geometry ON drive_recordings USING GIST(geometry);
CREATE INDEX idx_recordings_user ON drive_recordings(user_id);
```

#### Custom Routes

- CRUD endpoints for saved routes (GeoJSON LineString + ordered waypoints)
- Use Mapbox Directions API to snap freeform traces to roads
- Allow users to create routes by dropping waypoints on the map
- Export/share as links or GPX files

---

## 3. Recommendation System & AI-Drive

### Concept

**Recommendations:** Surface interesting roads and routes to users based on their driving history and preferences.

**AI-Drive:** User presses a button, specifies a time budget, and the system generates a fun driving route from their current location.

### Feasibility: Medium-High (Recommendations), Medium (AI-Drive)

### Recommendation System

#### Cold Start Solution
- Content-based: recommend roads with similar characteristics to ones the user has driven
- Popular roads: surface roads that many users drive repeatedly (non-commute patterns)
- Geographic: fun roads near the user they haven't driven yet

#### With User Data
- Collaborative filtering: users who enjoyed road X also enjoyed road Y
- Implicit signals: repeat drives, time spent on road, speed patterns suggesting enjoyment
- Hybrid model combining content features + collaborative signals

### AI-Drive Algorithm

The core problem: **generate a loop route from current location that maximizes cumulative fun_score within a time/distance budget.**

#### Approach

1. Build a road graph with edges weighted by `fun_score` (from Feature #1)
2. User inputs: time budget (30 min / 1 hr / 2 hr), optional direction preference
3. Algorithm:
   - Modified Dijkstra/A* with inverted weights (high fun_score = low cost)
   - Constraint: total distance ≈ budget × average_speed
   - Prefer loop routes (return to start)
   - Penalize repeated edges (no backtracking)
   - Bonus for variety (mix of curves, elevation, straights)
4. Output waypoints → feed to Mapbox Directions API for turn-by-turn route
5. Present route with estimated time, fun_score, and elevation profile

#### Optimizations
- Precompute "fun corridors" (connected subgraphs of high-scoring roads)
- Cache popular starting points
- Allow user preferences: "more curvy" vs "more scenic elevation" vs "balanced"
- Avoid roads the user has driven recently (discovery mode)

---

## 4. Rally-Style Navigation Callouts

### Concept

When driving on back roads or canyons, provide rally co-driver style pace notes through voice: upcoming turn direction, severity (radius), distance to next call, and hazards. Goes beyond standard "turn left in 200 meters" navigation.

### Feasibility: Medium-High

### Corner Detection & Classification

From route geometry (available via Mapbox Directions):

1. Compute curvature at each point along the route
2. Classify turns by radius:
   - **1 (Hairpin):** < 15m radius
   - **2 (Very Tight):** 15-25m
   - **3 (Tight):** 25-45m
   - **4 (Medium):** 45-75m
   - **5 (Fast):** 75-150m
   - **6 (Flat/Slight):** > 150m
3. Detect modifiers:
   - "tightens" — radius decreases through the turn
   - "opens" — radius increases
   - "over crest" — elevation peak mid-corner
   - "don't cut" — inside of turn has hazard/cliff
   - "long" — sustained curve
4. Detect sequences: "Left 3 into Right 5, 100"

All computable from GeoJSON route geometry + elevation data.

### Voice Delivery Options

| Option | Quality | Latency | Offline | Cost |
|--------|---------|---------|---------|------|
| Pre-recorded concatenative clips | High — natural, consistent | Near-zero | Yes | Recording session upfront |
| Apple AVSpeechSynthesizer | Okay — robotic | Near-zero | Yes | Free |
| On-device ML TTS (custom model) | Good-to-great | Low | Yes | Dev time |
| Cloud TTS (ElevenLabs, etc.) | Excellent | 200-500ms | No | Per-character |

### Recommended: Hybrid Concatenative System

Record a voice actor saying all atomic components:
- Numbers: "1" through "6"
- Directions: "left", "right"
- Modifiers: "tightens", "opens", "long", "short", "over crest", "don't cut", "keep in"
- Distances: "50", "100", "150", "200", "and" (for sequences)
- Connectors: "into", "then"

**Total clips needed:** ~50-80 recordings

**Benefits:**
- Zero latency playback
- Fully offline capable
- Natural sound (real human voice)
- Brand identity — the co-driver voice becomes part of the app's character
- Rally games (DiRT, WRC, EA Sports WRC) use exactly this approach

### Timing Logic

Call timing based on current speed + distance to next feature:
- At 60 mph (~100 km/h): calls ~4-5 seconds before corner entry (~120m)
- At 30 mph (~50 km/h): calls ~3 seconds before (~40m)
- Adaptive: if corners come in rapid succession, queue and compress calls

### Settings

- Enable/disable per drive
- Adjustable callout distance (early vs. late)
- Volume independent of music/media
- Sensitivity threshold (only call corners tighter than X)
- Voice selection (future: multiple co-driver personalities)

---

## 5. Color-Coded Route Line (Corner Speed)

### Concept

Replace the standard blue navigation route line with a color-gradient line that indicates the maximum safe cornering speed for each segment. The color scale is arbitrary (no numerical speeds shown) to avoid encouraging dangerous driving, but provides intuitive visual feedback about the road character ahead.

### Feasibility: High

### Physics Model

Maximum cornering speed: `v = sqrt(mu * g * r)`

Where:
- `mu` = tire grip coefficient (0.7-1.2 depending on tire/surface)
- `g` = gravitational acceleration (9.81 m/s^2)
- `r` = turn radius in meters

Additional factors:
- Road grade (banking helps, off-camber hurts)
- Surface condition (wet multiplier ~0.6-0.7)
- Elevation (air density affects downforce at high speed — negligible for street cars)

### Per-User Calibration

Pull from the user's car profile:
- Tire type: Summer (mu ~1.0), All-Season (mu ~0.85), Winter (mu ~0.75)
- Car weight: Affects transient response but not steady-state grip
- Suspension: Sport vs comfort (affects weight transfer, minor effect)

Default conservative values if no car profile set.

### Rendering with Mapbox

Use `line-gradient` with `line-progress`:

```json
{
  "id": "route-speed-gradient",
  "type": "line",
  "source": "route",
  "paint": {
    "line-width": 8,
    "line-gradient": [
      "interpolate", ["linear"], ["line-progress"],
      0.0, "#4CAF50",
      0.25, "#CDDC39",
      0.5, "#FFC107",
      0.75, "#FF5722",
      1.0, "#D50000"
    ]
  },
  "layout": {
    "line-cap": "round",
    "line-join": "round"
  }
}
```

The actual gradient values are computed per-route on the backend/client, mapping each segment's computed max speed to a 0.0-1.0 normalized value.

### Visual Language

- Green: High speed possible (straights, gentle curves)
- Yellow/Amber: Moderate speed reduction needed
- Red: Significant speed reduction (tight corners)

**Important:** No numerical values shown to the user. The color is presented as a "road character" indicator, not a speed advisory.

### Legal / Safety

- Disclaimer: "Color indicates road geometry characteristics only. Always drive within speed limits and conditions."
- No numbers, no explicit speed references in UI copy
- Frame as "road character visualization" not "speed guidance"

---

## 6. Braking Zone Visualization

### Concept

Extend the color-coded route line to show where braking should begin before corners. Displayed as a distinct color zone on the route line before corner entry points.

### Feasibility: Medium-High

### Physics Model

Braking distance: `d = (v1^2 - v2^2) / (2 * mu * g)`

Where:
- `v1` = entry speed (speed on preceding straight/corner)
- `v2` = target corner speed (from Feature #5 calculation)
- `mu` = braking grip coefficient (slightly higher than cornering grip due to longitudinal vs lateral)
- `g` = gravitational acceleration

Adjusted for:
- Road grade (downhill increases braking distance)
- Surface condition (wet/dry multiplier)

### Per-User Calibration

From car profile:
- Vehicle weight (heavier = longer braking)
- Brake type: Stock, upgraded, ceramic (affects fade, not peak grip much)
- Tire compound (same as cornering)
- Weight distribution (affects front/rear brake balance)

### Visual Pattern

Route line reads as: `Green (straight) → Red/Orange (braking zone) → Yellow (corner) → Green (exit acceleration)`

This creates an intuitive rhythm that maps to actual driving phases.

### Implementation

1. For each corner on the route, calculate:
   - Corner target speed (from Feature #5)
   - Approach speed (from preceding segment)
   - Required braking distance
2. Mark the braking zone on the route line starting `d` meters before corner entry
3. Render as a distinct color (e.g., deep red/purple) distinguishable from corner-speed colors

---

## 7. Live G-Force Meter

### Concept

A real-time display showing lateral and longitudinal G-forces during driving. Color-coded based on safe limits for the user's specific car and tire setup.

### Feasibility: High

Pure client-side feature using Core Motion. No backend required.

### Implementation

#### Sensor Access

```swift
import CoreMotion

let motionManager = CMMotionManager()
motionManager.deviceMotionUpdateInterval = 0.05 // 20Hz

motionManager.startDeviceMotionUpdates(to: .main) { motion, error in
    guard let motion = motion else { return }
    let lateralG = motion.userAcceleration.x   // Cornering
    let longitudinalG = motion.userAcceleration.y  // Braking/acceleration
    // userAcceleration already has gravity subtracted
}
```

**Key:** Use `CMDeviceMotion.userAcceleration` (gravity-subtracted) rather than raw accelerometer data.

#### Calibration Considerations

- Phone mount orientation matters — need initial calibration or use device orientation quaternion to transform axes
- Low-pass filter to smooth jitter (Butterworth or simple exponential moving average)
- Compensate for road grade (a hill reads as longitudinal G if not accounted for)

#### Color Scale

| G-Force | Color | Meaning |
|---------|-------|---------|
| < 0.3g | Green | Normal driving |
| 0.3 - 0.6g | Yellow | Spirited driving |
| 0.6 - 0.9g | Orange | Hard cornering/braking |
| 0.9 - 1.0g | Red | Near limit |
| > 1.0g | Flashing Red | Exceeding typical street tire grip |

Thresholds adjust based on car profile:
- Summer performance tires: limits shift up (~1.0-1.2g max)
- All-season tires: limits shift down (~0.8-0.9g max)
- SUV/truck (high CoG): limits shift down (~0.6-0.7g max)

#### UI Options

- **G-ball (friction circle):** 2D dot showing combined lateral + longitudinal G on a circular gauge
- **Dual bar:** Separate lateral and longitudinal bars
- **Minimal:** Single number with color background
- **Driving mode integration:** Glanceable, large, high contrast

#### Data Logging

- Store G-force trace alongside GPS trace during drive recording
- Post-drive analytics: max lateral G, max braking G, smoothness score
- Overlay G-data on map replay (color the recorded trace by G-force)

---

## 8. Implementation Priority

| Phase | Feature | Rationale |
|-------|---------|-----------|
| **1** | G-Force Meter | Pure client-side, instant wow factor, zero backend work, builds brand identity |
| **2** | Drive Recording | Leverages existing WebSocket infra, builds the dataset needed for everything else |
| **3** | Fun Roads Scoring Pipeline | Foundation for AI-Drive, recommendations, and the hero map layer |
| **4** | Color-Coded Route Line + Braking Zones | Uses scoring data, high visual impact, differentiator |
| **5** | Rally Callouts | Depends on route geometry processing being solid, voice recording logistics |
| **6** | AI-Drive + Recommendations | Needs recorded drives data + fun road scores to be meaningful |

### Dependencies

```
G-Force Meter ──────────────────────────────────────┐
                                                     ├── Post-drive analytics
Drive Recording ────────────────────────────────────┘
       │
       ├── Fun Roads Pipeline (user data improves scoring)
       │          │
       │          ├── Color-Coded Route Line
       │          │         │
       │          │         └── Braking Zone Visualization
       │          │
       │          ├── AI-Drive (needs road graph + scores)
       │          │
       │          └── Recommendations (needs user drive history + road scores)
       │
       └── Rally Callouts (needs route geometry processing)
```

---

## Research & Reference Links

### Open Source Projects
- `github.com/adamfranco/curvature` — Road curvature scoring from OSM
- `github.com/gboeing/osmnx` — Street network analysis in Python
- Tippecanoe (`github.com/felt/tippecanoe`) — Vector tile generation with attribute-based zoom filtering

### Data Sources
- Geofabrik (`download.geofabrik.de`) — Daily OSM extracts by region
- USGS SRTM — 30m global elevation data
- Mapbox Terrain-RGB — Elevation tiles (already have access)
- OpenStreetMap `surface=*` / `smoothness=*` tags

### Competitor/Inspiration
- Porsche Roads — Community-rated road segments, scoring system
- Calimoto — Motorcycle nav that routes for curviness
- ABRP (A Better Route Planner) — Multi-criteria route optimization (EV-focused but similar concept)
- DiRT Rally / EA Sports WRC — Concatenative co-driver voice system reference

### Academic Search Terms
- "road sinuosity index GIS"
- "motorcycle route planning scenic"
- "road geometry extraction OpenStreetMap"
- "scenic route planning crowd-sourced data"
- "driving enjoyment road characteristics"

---

## Open Questions

- [ ] What's the right balance of curvature vs elevation vs surface in the fun score?
- [ ] How do we handle roads with no OSM surface tags? Default assumption or exclude?
- [ ] Should AI-Drive prefer loops or out-and-back routes?
- [ ] Voice actor for rally callouts — one voice or multiple "co-driver personalities"?
- [ ] How to handle the color-coded line legally in different jurisdictions?
- [ ] G-force calibration — require user to set phone mount angle, or auto-detect?
- [ ] Should fun_score update in real-time based on user drives, or batch-process periodically?
- [ ] How much should user skill level affect braking zone calculations?
