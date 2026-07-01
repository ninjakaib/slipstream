# Standalone Navigation (Search, Routing, Directions)

> Status: **Idea / exploration.** No implementation. Captures the concept, the provider decision, candidate approaches, and open questions.

---

## Concept

For people to use SlipStream **consistently**, it must work as a genuine standalone navigation app — good enough to replace opening Apple/Google Maps. That means three pillars:

1. **Destination search** — excellent place/POI/address search (via an API).
2. **Routing** — compute routes to a destination.
3. **Turn-by-turn directions** — guided navigation with maneuvers, ETA, rerouting.

This is foundational: it's also a dependency for [Convoys](./CONVOYS.md) (group routes, Quick Meet) and relates to the deeper driving features already scoped in `docs/NAVIGATION_FEATURES.md` (fun-roads routing, rally callouts, color-coded route lines).

---

## Current State

- **None of this exists.** No geocoding/place search, no directions, no route rendering on the map (no route LineLayer anywhere).
- The only "search" is **people search** (`useUserSearch` → backend `searchUsers`).
- Convoy "Set Destination" is a placeholder that **hardcodes lat/lng to `0,0`** with no geocoder and no map picker.
- The map already uses Mapbox (`@rnmapbox/maps`, Standard style) and a `TrackingState` machine with a `driving` follow mode (course-up, high pitch) — so the *camera* side of a driving/nav experience is partially in place; the *routing/guidance* side is absent.
- The old roadmap (`.planning/ROADMAP.md` Phase 3) always intended search + turn-by-turn + a driving HUD; this doc is the exploration for that.

---

## The Provider Decision (biggest choice)

We need a provider for geocoding/place-search, directions, and ideally turn-by-turn. Candidates:

| Provider | Pros | Cons |
|----------|------|------|
| **Mapbox** (recommended default) | Already our map SDK & token; Search API + Directions API + **Navigation SDK** (turn-by-turn, voice, rerouting) integrate natively with `@rnmapbox/maps`; consistent styling; MCP tooling available in this repo. | Navigation SDK licensing/cost at scale; RN integration of the full Nav SDK is more involved than just drawing a line. |
| **Google** | Best-in-class POI database & search quality; familiar. | Separate SDK/keys; styling mismatch with Mapbox map; cost; mixing map + directions vendors. |
| **Apple (MapKit)** | Free, native on iOS, good data. | iOS-only; doesn't integrate with a Mapbox-rendered map; would fragment the stack. |
| **Others** (HERE, TomTom) | Strong routing/traffic. | Extra vendor; less ecosystem fit. |

**Recommendation:** default to **Mapbox** for cohesion with the existing map, token, and MCP tooling — unless POI **search quality** proves inadequate, in which case a hybrid (Google/Mapbox **search** + Mapbox **routing/rendering**) is a reasonable split. Decouple the *search* provider from the *routing/render* provider behind a small internal interface so we can swap search without touching the map.

---

## Scope Ladder (how far do we go?)

Turn-by-turn navigation is a large surface. Phasing:

- **Phase 1 — Search + route preview:** Place/address search box → geocode → draw a route line + summary (distance, ETA). No guidance yet. Immediately unblocks convoy destinations (replaces the `0,0` stub) and gives a real "set a destination" UX.
- **Phase 2 — Turn-by-turn:** Maneuver list, voice guidance, off-route rerouting, arrival. This is where the Mapbox Navigation SDK (or equivalent) earns its keep vs. hand-rolling on the Directions API.
- **Phase 3 — Driving HUD & enrichments:** Speed, speed limit, road name, maneuver banner (the old Phase 3 HUD), then tie into the specialized driving features in `docs/NAVIGATION_FEATURES.md` (color-coded route line, rally callouts, braking zones).

**Build vs. buy for turn-by-turn:** the Directions API gives geometry + maneuvers, but voice, rerouting, snapping, and lane guidance are a lot to build. Strong lean toward the **Mapbox Navigation SDK** for Phase 2 rather than reimplementing guidance on raw Directions.

---

## Architecture Notes

- **Route as a shared concept:** a route computed here should be reusable by [Convoys](./CONVOYS.md) (the convoy `ConvoyRoute.route_geometry` LINESTRING column already exists but is unpopulated). Decide whether route geometry is computed client-side or server-side and stored (convoys favor server-stored for a single source of truth).
- **Rendering:** a route `LineLayer` (and `line-gradient` for the future color-coded line) on the existing Mapbox map — reuse for solo nav and convoy routes.
- **Search UI:** a search sheet with autocomplete/suggestions, recent destinations, and "drop a pin" fallback (shared with the convoy pin-drop interaction).
- **Offline:** real navigation users expect some offline resilience (cached tiles/routes) — note as future; Mapbox Nav SDK supports offline regions.

---

## Dependencies & Relationships

- **[Convoys](./CONVOYS.md):** group routes and Quick Meet need this (Quick Meet specifically needs **places/POI search** for "nearest gas station/parking lot").
- **`docs/NAVIGATION_FEATURES.md`:** the advanced driving layer (fun roads, rally callouts, corner-speed line) builds on top of having real routing/geometry first.
- **Map pin-drop:** shared interaction with convoy route-setting (press-and-hold / tap-to-place in `live-map.tsx`).

---

## Open Questions

- [ ] One provider (Mapbox) end-to-end, or split search vs routing across providers? (Leaning Mapbox default, split only if search quality is insufficient.)
- [ ] Build turn-by-turn on the Directions API, or adopt the **Mapbox Navigation SDK**? (Leaning Nav SDK for Phase 2.)
- [ ] Is route geometry computed client-side or server-side (and stored on `ConvoyRoute.route_geometry`)? (Leaning server-stored where shared.)
- [ ] How much of the old Phase 3 HUD (speed, speed limit, road name) ships with Phase 1 vs later?
- [ ] Offline navigation — in scope for v1, or later?
- [ ] Cost model — what's the expected request volume, and does Nav SDK licensing fit the budget at scale?
- [ ] How does solo navigation visually differ from a convoy route on the same map (so a driver isn't confused about which route is "theirs")?
