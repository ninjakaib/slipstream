# Driver Marker Redesign & Clipping Fix

> Status: **Idea / exploration.** No implementation. Captures the concept, the enrichment dependency, the clipping root cause, candidate approaches, and open questions.

---

## Concept

Upgrade driver markers from the current plain blue dot + arrow to something richer and more alive:

1. **Profile pictures** as the marker.
2. **A colored ring / indicator** conveying state: driving, offline, actively using the app, in a convoy, parked, etc.
3. **A label underneath** the marker showing name/username or car name.
4. **Fix the clipping** — when zoomed out, the circle/arrow symbols stack in an ugly, inconsistent way.

The exact state set and how each is indicated (color ring? badge? both?) is **not yet decided** — likely a combination (e.g. ring color for primary state + a small badge for secondary state like convoy).

---

## Current State

From `live-map.tsx`:
- Markers are **Mapbox native layers** on one `ShapeSource id="drivers"`:
  - `CircleLayer` — fixed `circleRadius: 16`, hardcoded `circleColor: "#007AFF"`, 2px white stroke.
  - `SymbolLayer` — `driver-arrow.png`, `iconSize: 0.3`, rotated by `heading`, with `iconAllowOverlap: true` and `iconIgnorePlacement: true`.
- **No avatar, no name/label, no status-driven color.** `status` is carried in feature properties but **not mapped to any style**.
- Per-frame smooth movement is handled by the interpolation loop (`interpolation/use-driver-interpolation.ts`) pushing a FeatureCollection via `setNativeProps` — markers must remain compatible with this imperative update path.
- The stream carries only `{user_id, lat, lng, heading, speed, status}` — **no avatar URL, name, or car** — so richer markers need an enrichment path.

### Root cause of the clipping/stacking
- `circleRadius` and `iconSize` are **constant pixel values** with no zoom interpolation, and `iconAllowOverlap` / `iconIgnorePlacement` are `true`. So at low zoom, drivers who are far apart geographically but close in screen space **draw directly on top of each other** with no collision handling, declutter, or aggregation. This is the same underlying issue as [Clustering & LOD](./CLUSTERING_AND_LOD.md) — decluttering and clustering are two views of one problem.

---

## The Enrichment Dependency (shared problem)

Avatars, names, and car names are **not in the stream**. This is the same enrichment need as [Map View Filtering](./MAP_VIEW_FILTERING.md). Solve it once:

- **Option A — Extend the broadcast payload** with `avatar_url`, `display_name`/`username`, `car_name`, richer `status`, convoy id. Simple to render, but inflates every `driver_moved` × fan-out. Avatars especially shouldn't be re-sent every position update.
- **Option B — Client fetches profile per driver id and caches** (the driver sheet already uses `useUserProfile`). Keeps the stream tiny; markers render a placeholder until the profile resolves. Avatars need image caching.
- **Option C — Hybrid (recommended):** stream only the small, frequently-changing bits (status, convoy id) inline; fetch static bits (avatar, name, car) once per id and cache. Best balance for the hot path.

---

## Rendering Approach: Native layers vs marker views

Rich, per-user avatars with rings and labels are awkward with pure Mapbox `CircleLayer`/`SymbolLayer` (which want pre-registered images/expressions, not arbitrary remote avatars).

- **Keep native layers + registered images:** Use `Images`/`ShapeSource` with per-feature `iconImage` referencing dynamically-added images (register each avatar as a Mapbox image). Best performance and plays well with the existing `setNativeProps` interpolation loop, but avatar registration + ring compositing is fiddly.
- **React Native `MarkerView` / `PointAnnotation` per driver:** Trivial to render arbitrary React (avatar + ring + label). But **does not scale** to hundreds of markers and **breaks the imperative interpolation path** (each marker would re-render). Only viable for small counts (e.g. convoy members, selected driver).
- **Hybrid (recommended):** native layers for the general population (with status ring via expressions + avatar-as-registered-image), and richer RN marker views reserved for special cases (selected driver, convoy members). This also composes with LOD — most drivers become cluster/dot at low zoom, avatars appear when zoomed in.

Labels (name/car under the marker) are well-suited to a `SymbolLayer` `text-field` with `text-anchor: top` and `text-optional: true` so labels drop first under collision — which *also* helps declutter.

---

## State → Visual Mapping (draft, to be decided)

| State | Candidate indicator |
|-------|---------------------|
| Driving | Green ring (or animated pulse) |
| Parked | Gray/blue static ring |
| Actively using app (foreground, not driving) | Distinct ring color / subtle glow |
| Offline / stale | Desaturated / dashed ring / reduced opacity |
| In convoy | Badge (small icon) + possibly shared convoy accent color |

Open: is everything one ring color, or ring (primary) + badge (secondary)? Probably ring = movement state, badge = social state (convoy). Needs design exploration (a good candidate for the visual companion / a Figma pass).

---

## Clipping / Declutter Fix (can ship independently)

Even before the full redesign, the stacking can be improved:
- Add **zoom interpolation** to `circleRadius`/`iconSize` (smaller when zoomed out).
- Enable **collision handling** (turn off `iconAllowOverlap`/`iconIgnorePlacement`, or use `symbol-sort-key`) and/or **clustering** ([Clustering & LOD](./CLUSTERING_AND_LOD.md)).
- Use `text-optional`/`icon-optional` so labels/arrows drop before the core dot under collision.

Recommendation: ship the declutter fix (zoom interpolation + clustering) first — it's low-risk and immediately improves the ugly zoomed-out view — then layer in the avatar/ring/label redesign with the enrichment path.

---

## Dependencies

- **Enrichment path** — shared with [Map View Filtering](./MAP_VIEW_FILTERING.md).
- **Clustering/LOD** — shared declutter mechanics with [Clustering & LOD](./CLUSTERING_AND_LOD.md).
- **Convoy id in stream** — for the convoy badge/accent (see [Convoys](./CONVOYS.md)).
- **Interpolation loop compatibility** — any new marker approach must not break `setNativeProps`-based smooth movement (`interpolation/`, and `docs/SMOOTH_ANIMATION_DESIGN.md`).

---

## Open Questions

- [ ] Ring-only, or ring + badge? What's the full state set and its precedence when multiple apply (e.g. driving *and* in convoy)?
- [ ] Enrichment via extended payload, client fetch, or hybrid? (Leaning hybrid.)
- [ ] How are avatars efficiently rendered as Mapbox images (dynamic registration, caching, fallback placeholder)?
- [ ] At what zoom do avatars appear vs collapse to dots/clusters? (Ties to LOD thresholds.)
- [ ] Label content: username vs display name vs car name — user preference, or context-dependent?
- [ ] Does the arrow (heading) stay, merge into the avatar ring (directional notch), or only show while driving?
- [ ] Do we need a distinct "self" marker treatment vs `LocationPuck` (already present)?
