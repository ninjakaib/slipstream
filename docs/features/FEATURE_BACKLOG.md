# SlipStream Feature Backlog

> Living index of explored-but-not-yet-built feature ideas. Each entry links to a per-area doc with concept, hard problems, candidate approaches, and open questions. **Nothing here is implemented or committed to a schedule** — this is for tracking and prioritization.
>
> Last updated: 2026-07-01

---

## Status Legend

- **Idea** — captured, not yet designed in detail
- **Explored** — concept + problems + candidate approaches documented (this pass)
- **Designed** — a concrete spec/plan exists
- **In progress** — being built
- **Done** — shipped

---

## Backlog

| Feature | Doc | Status | Priority | Primary surface | Depends on |
|---------|-----|--------|----------|-----------------|------------|
| Groups / Clubs | [GROUPS_AND_CLUBS.md](./GROUPS_AND_CLUBS.md) | Explored | High | Backend + FE | Visibility (precedence); spatial channels for nationwide presence |
| Visibility Controls (who sees me) | [VISIBILITY_CONTROLS.md](./VISIBILITY_CONTROLS.md) | Explored | High | Backend (spatial) | — (Phase 1 stands alone); Groups for group scope |
| Map View Filtering (what I see) | [MAP_VIEW_FILTERING.md](./MAP_VIEW_FILTERING.md) | Explored | High | FE + Backend | Enrichment path; Groups for group filter; LOD |
| Clustering & Zoom/LOD | [CLUSTERING_AND_LOD.md](./CLUSTERING_AND_LOD.md) | Explored | High | FE (now) + Backend (later) | Filtering + Visibility (culling order); Markers |
| Convoys — Party UX & Routes | [CONVOYS.md](./CONVOYS.md) | Explored | High | Backend (solid base) + FE (stubbed) | Directions/places API; pin-drop; stream enrichment |
| Driver Marker Redesign + Clipping | [DRIVER_MARKERS.md](./DRIVER_MARKERS.md) | Explored | Medium | FE | Enrichment path; Clustering/LOD |
| Standalone Navigation (search/routing) | [STANDALONE_NAVIGATION.md](./STANDALONE_NAVIGATION.md) | Explored | High | FE + provider | Provider decision (Mapbox?) |

Related existing doc: [`../NAVIGATION_FEATURES.md`](../NAVIGATION_FEATURES.md) — advanced driving layer (fun roads, rally callouts, corner-speed line, G-force). Builds on top of Standalone Navigation.

---

## Cross-Cutting Threads

Several features are entangled through a few shared pieces. Solve these once, not per-feature:

### 1. The spatial store is the pressure point
Today `spatial/store.py` fans out **purely by H3 cell overlap** — no notion of who may see whom, no filtering, no importance ranking, and it deliberately keeps **no DB on the hot path**. Four separate features all want to change this:
- **Visibility** wants per-viewer permission checks at fan-out.
- **Filtering** wants server-side filter predicates (and possibly group channels).
- **Groups** wants non-geographic **group channels** for nationwide presence.
- **Clustering/LOD** wants importance-gated publishing across resolution tiers.

These must be designed **together** as one evolution of the spatial layer, or they'll conflict. Rough evaluation order for any driver→viewer decision: **visibility (allowed to see?) → filtering (want to see?) → LOD (important enough at this zoom?)**, with convoy/friend/filtered-in as "always-promote" overrides.

### 2. Stream enrichment (shared by Markers + Filtering + Convoys)
The live stream carries only `{user_id, lat, lng, heading, speed, status}`. Richer markers (avatar, name, car), client-side filters (make, group), and convoy grouping all need more data. Decide the enrichment strategy **once**: extend payload vs. client profile-fetch+cache vs. **hybrid** (stream small/dynamic bits inline: status, convoy id; fetch static bits once: avatar, name, car). Recommended: hybrid.

### 3. Directions / places provider (shared by Convoys + Navigation)
Convoy routes, Quick Meet (POI search), and standalone nav all need a directions/places provider. Pick one (leaning **Mapbox** for stack cohesion) behind a small internal interface so search vs routing can be swapped independently.

### 4. Map pin-drop interaction (shared by Convoys + Navigation)
Press-and-hold + tap-to-place pin dropping in `live-map.tsx` serves both convoy route-setting and destination selection. Build once.

### 5. Declutter == Clustering (shared by Markers + LOD)
The ugly zoomed-out stacking and the crowding-at-city-scale problem are the same issue. The marker declutter fix (zoom interpolation + collision handling + clustering) is the first, low-risk slice of the LOD work.

---

## Suggested Sequencing (draft, not committed)

A pragmatic order that ships value early and defers the risky spatial rewrite until the UX is validated:

1. **Quick wins / low-risk, high-visibility:**
   - Marker declutter fix (zoom interpolation + clustering) — fixes the ugly map now.
   - Convoy frontend: wire the stubbed invite + real destination (needs pin-drop + a geocoder).
2. **Foundational providers/paths:**
   - Directions/places provider + standalone nav Phase 1 (search + route preview) — also unblocks convoy destinations.
   - Stream enrichment (hybrid) — unblocks rich markers + client-side filters.
3. **Enforce & filter (client-side first):**
   - Visibility Phase 1 (make ghost/friends-only actually work in fan-out).
   - Client-side cheap filters (status/make/friends).
4. **Communities & the spatial evolution:**
   - Groups MVP (private/invite + chat + highlight-among-nearby).
   - Server-side spatial changes: group channels, server filtering, LOD gating, per-group visibility — designed as one coordinated change.
5. **Polish & advanced:**
   - Full marker redesign (avatars/rings/badges/labels), Quick Meet, turn-by-turn (Nav SDK), then the advanced driving layer in `NAVIGATION_FEATURES.md`.

This is a starting point for prioritization discussion, not a plan.

---

## How to Use This

- When picking up a feature, open its doc, resolve the **Open Questions** (that's where the real decisions live), then run it through the brainstorming → writing-plans flow for a concrete spec.
- Update the **Status** column here as features move Idea → Explored → Designed → In progress → Done.
- Keep cross-cutting decisions (spatial evolution, enrichment, provider) recorded here so per-feature work stays consistent.
