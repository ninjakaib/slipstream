# Convoys — Party UX & Group Routes

> Status: **Idea / exploration** (backend has a strong foundation; frontend is largely stubbed). Captures the target experience, current gaps, candidate approaches, and open questions.

---

## Concept

Convoys should feel like a **multiplayer game party** — think Xbox Live party or a Fortnite squad. The whole loop must be **seamless**:

- Tap a driver on the map → **instantly** invite them to your convoy, or **join** theirs.
- If no convoy exists yet, **create one on the fly** (if their settings allow).
- Join/request-to-join is one tap: a **Join** or **Request to Join** button depending on the convoy's visibility/settings.
- Once in a convoy, **setting a group route is trivial** and the route becomes **instantly visible to everyone** in the convoy.

**Group routes are the most important part.** Secondary: quick "meet up" routing.

---

## Target Interactions

### 1. Tap-to-party
From the driver sheet (tap a marker), the primary action is convoy-centric:
- If you have no convoy and they have none → **"Start convoy with @user"** (create + invite in one step).
- If they're in a public convoy → **"Join convoy"** or **"Request to join"** per its visibility.
- If you have a convoy → **"Invite to convoy"**.
The button label/action is computed from both users' convoy state + settings.

### 2. Setting a group route
- Any member can set the active route; it instantly shows for everyone.
- **Drop a pin as a route destination:**
  - Apple-Maps-style **press-and-hold** on the map to drop a pin, or
  - A **"drop pin" button** that enters a mode where a tap places the destination.
- Setting the pin as the group route is one tap → route computed and shared.

### 3. "Quick Meet" (nice-to-have)
A button that computes a route to a location **nearest to everyone** in the convoy — routing the whole group together as fast as possible (e.g. the gas station / parking lot central to all members). A "regroup here, fast" primitive.

---

## Current State

### Backend — strong foundation already exists (`routers/convoys.py`, models)
- Full lifecycle: create, get, update (name/visibility), end, join, request-to-join, accept/decline, leave, invite, kick.
- Roles: **leader / member**. Leader-only: settings, end, accept/decline, kick. Any member: invite, chat, quick actions, set route.
- Visibility: **public** (request → leader approves) vs **private** (invite-only). Friends-of-members can **direct-join** (bypass approval).
- **Invite = a pre-accepted join request** (`ConvoyJoinRequest` with status accepted).
- Chat: list (cursor paginated) + send; **quick actions** (`pull_over | gas_stop | slow_down | regrouping`) stored as chat messages. Chat is **ephemeral** (deleted when convoy ends).
- Routes: `POST /{id}/route` (any member) sets a single **active** route (deactivates prior); `GET /{id}/route` reads it. Route = `destination_name` + `destination_point` + `waypoints` (JSONB). Setting a route flips convoy FORMING → ACTIVE.

### Backend — gaps
- **No browse/list-convoys endpoint** (a `ConvoyListItem` schema exists but is unused) — so "public convoys appear on map/nearby" isn't wired.
- `ConvoyRoute.route_geometry` (LINESTRING) column exists but is **never populated** — only the destination point + waypoints are stored. No actual road-snapped route line is computed server-side.
- Convoy affiliation is **not in the live position stream** (stream carries no convoy id), so the map can't natively tell who's in which convoy without extra data.
- No "settings that allow on-the-fly creation/join" concept beyond public/private — the "if their settings allow" nuance (auto-accept, open-to-join) may need new fields.
- No **Quick Meet** / centroid routing logic.

### Frontend — largely stubbed
- Driver sheet **"Invite to Convoy" is a stub** — `handleInvite` only `console.log`s with `// TODO: implement convoy invite` (`driver-sheet.tsx`).
- `convoy-page.tsx` "Set Destination" **hardcodes lat/lng to `0, 0`** — there's a text field but **no geocoder and no map pin picker**.
- **The route is never drawn on the map** — no route LineLayer exists anywhere.
- No convoy lobby/party UI beyond the basic page; no real-time member position display tied to convoy membership.

---

## Candidate Approaches

### Route rendering & computation
- **Client computes route via directions API** (Mapbox/Google/Apple), draws a `line-gradient`/LineLayer, and sends geometry to backend for sharing. Fast; couples to the [Standalone Navigation](./STANDALONE_NAVIGATION.md) directions choice.
- **Backend computes & stores `route_geometry`** (populate the existing LINESTRING column) so all members render identical geometry from one source of truth. More consistent; adds a backend directions dependency.
- Recommendation: backend stores the shared geometry (single source of truth for "everyone sees the same line"), client renders it; reuse whatever directions provider [Standalone Navigation](./STANDALONE_NAVIGATION.md) selects.

### Real-time route/convoy propagation
- Convoy route changes need to reach members in ~real time. Options: piggyback on the spatial WebSocket (add convoy event types), or a dedicated convoy WS/subscription, or poll `GET /{id}/route`. Leaning: reuse the existing WS with convoy-scoped events (route_updated, member_joined, quick_action) rather than polling.

### Convoy presence on the map
- Add convoy id to the enriched stream (see enrichment note in [Map View Filtering](./MAP_VIEW_FILTERING.md) / [Driver Markers](./DRIVER_MARKERS.md)) so convoy members get a distinct ring/badge and the map can group them. Convoy members likely bypass [Visibility Controls](./VISIBILITY_CONTROLS.md) and [LOD culling](./CLUSTERING_AND_LOD.md).

### Quick Meet (centroid routing)
- Compute a candidate meeting point near the geometric centroid (or travel-time-weighted center) of members, snap to a POI (gas station/parking lot) via a places API, then set that as the group route. Depends on places search from [Standalone Navigation](./STANDALONE_NAVIGATION.md). Start simple (centroid → nearest POI), refine to travel-time-balanced later.

---

## Dependencies

- **Directions / places API** decision — shared with [Standalone Navigation](./STANDALONE_NAVIGATION.md). Quick Meet specifically needs **places/POI search**.
- **Map pin-drop interaction** — new gesture/mode in `live-map.tsx` (press-and-hold + tap-to-place).
- **Stream enrichment** — convoy id in positions for on-map convoy grouping/badges.
- **Driver-sheet redesign** — make convoy actions the primary, one-tap CTA (replacing the stub).

---

## Open Questions

- [ ] What settings gate "create/join on the fly"? New fields (auto-accept, open-to-join, who-can-invite) beyond public/private?
- [ ] Route geometry: computed client-side and uploaded, or computed/stored server-side? (Leaning server-stored for consistency.)
- [ ] How do convoy events reach members in real time — reuse spatial WS, dedicated channel, or poll? (Leaning: reuse WS.)
- [ ] Do convoy members always see each other (override ghost / friends-only / LOD)? (Leaning: yes.)
- [ ] Multiple pins/waypoints per route (the model supports `waypoints[]`) — expose multi-stop now or later?
- [ ] Quick Meet centering: geometric centroid vs travel-time-balanced vs "toward the destination"? POI category (gas/parking/coffee)?
- [ ] Do public convoys show on the map for nearby non-members (needs the missing browse endpoint + stream affiliation)?
- [ ] Voice/party chat (actual Xbox-party analogy) — in scope ever, or text + quick-actions only?
