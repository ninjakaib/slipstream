# Map View Filtering (What I See)

> Status: **Idea / exploration.** No implementation. Captures the concept, the server-vs-client architecture decision, candidate approaches, and open questions.

---

## Concept

Give users control over **which layers / users appear on their map**. This is the inverse of [Visibility Controls](./VISIBILITY_CONTROLS.md) — that governs who can see *you*; this governs what *you* choose to see.

**Example filters the user might want:**
- Only a specific **group** or set of groups
- **Friends only**
- **Everyone**
- Hide **offline** / idle users
- By **car make** (e.g. only Porsches)
- By **driving stats** (not yet a concept in the app — see note)
- By **status** (driving / parked / in-convoy)

There could be many filter dimensions, so the UI must stay **clean and intuitive** — this is as much a UX problem as a data problem.

---

## Current State

- **No filtering UI exists.** The map (`live-map.tsx`) renders every driver returned for the current viewport. The only filter-like concept is the account-level visibility setting (which is about being seen, not seeing).
- The live stream carries only `{user_id, lat, lng, heading, speed, status}` — so filtering by car make, name, group, or stats is **impossible client-side today** without enriching the payload or fetching profiles.
- `status` values available: `driving | parked | en_route | in_convoy | idle` (backend `VALID_STATUSES`), so status/offline filtering is feasible with existing data.

---

## The Core Architecture Decision: Server-side vs Client-side Filtering

### Option A — Client-side only (backend sends everything potentially visible)
The backend continues to stream all drivers in the viewport's cells; the client decides what to render.

- **Pros:** No backend changes to the streaming model. Instant filter toggling (no round-trip). Simple.
- **Cons:** Wastes bandwidth/CPU streaming drivers that get filtered out. Requires the payload to carry (or the client to fetch) car make, group membership, stats — enrichment problem. Doesn't help the crowding problem (see [Clustering & LOD](./CLUSTERING_AND_LOD.md)) — you still receive everyone. Can't express "show my nationwide group" because far members aren't in your cells at all.

### Option B — Server-side (client tells backend what it wants)
The client sends its active filters; the backend streams only matching drivers.

- **Pros:** Efficient — only relevant data crosses the wire. Enables cross-geography filters (e.g. group presence) that cell-overlap can't. Composes with LOD gating.
- **Cons:** **Tricky given the current H3 cell-subscription model.** Today subscription = "watch these cells." Adding filters means either per-watcher filter predicates applied at fan-out, or new channel types (e.g. `group:<id>`) layered on cells. This is a fundamental change to the spatial store and overlaps heavily with the [Visibility Controls](./VISIBILITY_CONTROLS.md) enforcement work and [Groups](./GROUPS_AND_CLUBS.md) channels. Changing filters may require re-subscription and a fresh snapshot.

### Hybrid (likely answer)
- **Cheap filters run client-side** on data already streamed: status/offline, car make, "friends only" among nearby drivers — as long as the payload is enriched enough (see Enrichment below).
- **Structural filters run server-side** because they change *what data even reaches you*: "only my group nationwide" (needs group channels), and visibility enforcement (must be server-side for privacy anyway).

Recommendation: start client-side for the cheap dimensions (fast to ship, great UX), and treat group/cross-geography filtering as server-side work bundled with the Groups + Visibility spatial changes.

---

## Enrichment Dependency

Most useful filters need data the stream doesn't carry today. Options:
- **Extend the broadcast payload** with lightweight fields (car make, primary group id(s), a coarse "stats tier"). Increases per-message size × fan-out; keep it minimal.
- **Client fetches profiles once per driver id** (already done for the driver sheet via `useUserProfile`) and caches; filter on cached data. Cheaper on the wire, but filters can't apply until the profile loads, and it doesn't help server-side filtering.
- **Hybrid:** stream a tiny enrichment set (make, group ids, status) inline; fetch full profile on demand.

Cross-reference: [Driver Markers](./DRIVER_MARKERS.md) also needs enrichment (avatar, name, status) — solve the enrichment path once for both features.

Note: "driving stats" filtering depends on a stats system that **does not exist yet**. Treat as future/blocked.

---

## UX: Keeping Many Filters Clean

With potentially dozens of filter dimensions, avoid a wall of toggles. Ideas:
- **Layered "lens" model:** a small set of primary lenses (Everyone / Friends / Groups) as segmented control, with an expandable "More filters" sheet for status, car make, etc. (The old roadmap referenced "filter pills All/Drivers/Convoys" — a natural starting point.)
- **Saved filter presets:** e.g. "My Porsche crew, driving now."
- **Filter chips** shown above the map summarizing the active filter, tappable to edit.
- **Sensible defaults:** default to "everyone nearby" so the map is alive out of the box; filtering is opt-in refinement.

---

## Candidate Approaches (phasing)

- **Phase 1 — Client-side cheap filters:** status/offline + friends-only + car make (once payload enriched or profiles cached). Ships fast, big UX win, no spatial rewrite.
- **Phase 2 — Server-side structural filters:** group/cross-geography filtering, bundled with Groups channels + Visibility enforcement (shared spatial changes).
- **Phase 3 — Presets, stats filters (once stats exist), polish.**

---

## Open Questions

- [ ] Which filters are "cheap" (client-side) vs "structural" (server-side)? (Draft: status/make/friends = client; group/nationwide = server.)
- [ ] Do we enrich the stream payload, fetch profiles client-side, or hybrid? (Shared decision with [Driver Markers](./DRIVER_MARKERS.md).)
- [ ] When a server-side filter changes, do we re-subscribe and re-snapshot, or diff? What's the latency budget for a filter toggle?
- [ ] How do "what I see" filters interact with "who can see me" precedence — any surprising combinations? (e.g. I filter to a group, but a member has muted me — they simply don't appear.)
- [ ] Does filtering interact with LOD gating (a filtered-in user should probably survive LOD culling)? See [Clustering & LOD](./CLUSTERING_AND_LOD.md).
- [ ] "Offline" — what defines it? (No update within N seconds? `status == idle`? Disconnected?)
