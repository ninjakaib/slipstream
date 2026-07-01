# Clustering & Zoom-Based Behavior (Level of Detail)

> Status: **Idea / exploration.** No implementation. Captures the concept, the two architectures (server-side channel gating vs client-side clustering), candidate approaches, and open questions.

---

## Concept

The app's intended behavior is "show everyone to everyone." At the **city level and above**, that gets extremely crowded. We need **clustering and/or level-of-detail (LOD) behavior** so the zoomed-out map stays legible and performant, while zoomed-in stays complete.

A compelling twist: as you zoom out, don't just cluster into count-bubbles — selectively surface the **most interesting** drivers (most influential/popular users, coolest/most expensive cars, etc.). Zoom-out becomes a curated highlight reel, not just density blobs.

---

## Current State

- **No clustering, no LOD at all.** `live-map.tsx` uses a `ShapeSource` with no `cluster` prop; every driver draws a fixed 16px circle + arrow at every zoom.
- Because radius/icon size are constant pixels and `iconAllowOverlap`/`iconIgnorePlacement` are `true`, drivers **pile on top of each other** when zoomed out — this is also the [Driver Markers](./DRIVER_MARKERS.md) "clipping/stacking" complaint. Clustering/LOD and marker declutter are the same underlying problem viewed two ways.
- Client already maps zoom → H3 resolution (`spatial.ts` `zoomToResolution`: z≥13→r5 … else r1) and subscribes to cells at that resolution, capped at `MAX_VIEWPORT_CELLS = 64`. The *subscription* is already zoom-aware; the *rendering* and *fan-out volume* are not.
- Server indexes every driver at **all** resolutions 1–5 simultaneously (`INDEX_RESOLUTIONS`), so a driver is currently present in every resolution's cell regardless of zoom.

---

## The Two Architectures

### Approach 1 — Server-side channel gating (the "publish up the pyramid" idea)
When a client sends a location update, the server publishes it to the **highest-resolution** cell channel by default (most zoomed in), and then applies **gating logic** deciding whether that driver *also* gets published to the next resolution up (coarser / more zoomed out). Zooming out subscribes to coarser channels, which contain progressively fewer, "more important" drivers.

- **How importance works:** each coarser tier admits a subset — e.g. top-N by an "influence/coolness" score per coarse cell, or a probability gate. So r5 has everyone; r3 has the notable ones; r1 has only the standouts.
- **Pros:** Bandwidth scales with what's shown — you never stream thousands of drivers to a zoomed-out client. Naturally enables the "highlight reel" (coolest cars survive to the top). Solves crowding at the source. Reuses the existing resolution/subscription mechanic.
- **Cons:** Requires a scoring/gating function and per-cell selection logic in the hot path. Must interact cleanly with [Map View Filtering](./MAP_VIEW_FILTERING.md) — a driver a user explicitly filtered *in* (e.g. a friend, or a member of a selected group) must not be gated out at coarse zoom. That means gating can't be purely global; it has to be viewer-aware or have "always-promote" overrides. Also complicates counts ("+40 more here") since coarse tiers intentionally omit drivers.
- **Currently** the server indexes everyone at all resolutions with no selection — so this is net-new gating logic, not just a config flip.

### Approach 2 — Client-side clustering (backend sends everything nearby, client aggregates)
Enable Mapbox `ShapeSource` clustering (or a custom clustering pass) and render count-bubbles that expand on zoom.

- **Pros:** Well-supported by Mapbox out of the box (`cluster`, `clusterRadius`, `clusterMaxZoom`, cluster-count symbol layers). No backend change. Fast to ship. Good declutter.
- **Cons:** Doesn't reduce what's streamed — at city scale you still receive *everyone* in the viewport cells, which is the exact scalability worry ("really really crowded at even just the city level"). Pure count-bubbles don't give the "highlight the coolest cars" behavior without extra ranking logic client-side. Doesn't compose with server-side visibility/filtering savings.

### Hybrid (likely answer)
- **Client-side clustering for legibility now** (cheap, immediate declutter, fixes the ugly stacking).
- **Server-side gating for scalability later**, so zoomed-out clients don't receive thousands of positions — with viewer-aware "always-promote" overrides for filtered-in / friend / group / convoy drivers.

Recommendation: ship Approach 2 first (immediate, low-risk), design Approach 1 as the scalability track once real density exists.

---

## Interaction With Other Features (must design together)

- **[Map View Filtering](./MAP_VIEW_FILTERING.md):** gating must respect filters — a filtered-in driver survives LOD culling; a filtered-out driver is gone regardless of tier.
- **[Visibility Controls](./VISIBILITY_CONTROLS.md):** LOD is layered *on top of* visibility — you can only ever be gated among drivers you're already allowed to see. Order: visibility filter → LOD/importance gate.
- **[Groups](./GROUPS_AND_CLUBS.md):** group channels are a different subscription axis than resolution cells; a "show my group" view might bypass LOD entirely (show all group members) or apply its own LOD.
- **[Driver Markers](./DRIVER_MARKERS.md):** cluster bubble styling, and how an individual marker (avatar + ring + label) collapses into a cluster, is a shared design.

---

## The "Importance / Coolness" Score

If we do curated zoom-out (either architecture), we need a ranking signal. Candidate inputs: follower/friend count, popularity/engagement, car value or rarity, whether actively driving, convoy leader, verified/notable status. This overlaps with future stats/social systems that don't exist yet. Keep the score pluggable; start with something trivial (e.g. actively-driving + friend-of-viewer) and evolve.

---

## Open Questions

- [ ] Server-side gating, client-side clustering, or hybrid — and in what order? (Leaning: client clustering now, server gating later.)
- [ ] How is "importance" scored, and is it global or viewer-relative? (Viewer-relative is more useful but more expensive.)
- [ ] How do filtered-in / friend / convoy drivers bypass LOD culling? (Need an "always-promote" rule.)
- [ ] At coarse zoom, do we show cluster **counts** (which requires knowing the true count even of gated-out drivers) or just the highlighted individuals? Mixed?
- [ ] Does the client need cluster expansion on tap (zoom into a cluster), and how does that reconcile with cell re-subscription?
- [ ] What are the real density numbers we're designing for? (Need a target: e.g. "legible + smooth with 5k drivers in-viewport at city zoom.")
- [ ] Should the simulator (`backend/tools/simulator/`) be extended to generate high-density scenarios to test LOD? (It already seeds real drivers.)
