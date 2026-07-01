# Visibility Controls (Who Can See Me)

> Status: **Idea / exploration.** No implementation. Captures the concept, the precedence problem, candidate approaches, and open questions.

---

## Concept

Give each user granular control over **who can see their live location**. This is about *being seen*, not about *what you see* (that's [Map View Filtering](./MAP_VIEW_FILTERING.md)).

Proposed visibility scopes:

| Scope | Meaning |
|-------|---------|
| **Public** | Anyone can see your live location. |
| **Group** | Per-group control (granular). If disabled for a group, members of that group **cannot see your location** but **can still see you're a member** and view your profile. |
| **Friends only** | Only accepted friends see your live location. |
| **Ghost** | Nobody sees your live location; you're effectively invisible on the map. |

The **group** scope is special: it's not a single toggle but a **per-group setting** on the user, so you can be visible to your Porsche group but hidden from your work group.

---

## Current State (important)

- `User.visibility` already exists as an enum `VisibilityMode` = `on | friends_only | ghost` (`backend/src/slipstream/models.py:103`), plus `discovery_radius_miles` (default 15).
- The frontend already lets users cycle `on → friends_only → ghost` in `settings-page.tsx`.
- **But the real-time spatial fan-out completely ignores it.** `spatial/store.py` / `handlers.py` broadcast a driver to anyone whose watched H3 cell overlaps the driver's cell — no friend check, no ghost check, no radius check. Ghost mode today does *nothing* on the live map.

So this feature is partly "wire up what already exists" and partly "add group-level granularity + enforcement."

---

## The Hard Problem: Precedence

Scopes overlap. A viewer may qualify under several relationships at once, and scopes can conflict. We need deterministic precedence.

**Example conflicts:**
- I'm **friends-only** globally, but I'm in a public group with location sharing **on**. Does a non-friend group member see me?
- I'm **public** globally, but I've disabled location for one specific group. Does a member of *that* group who is *also* a friend see me? (They qualify via friendship and via public, but I explicitly muted the group.)
- I'm in **ghost** mode but in an active **convoy**. Do convoy members still see me? (Almost certainly yes — convoy is opt-in and intimate.)

**Two mental models for resolving this:**

1. **Most-permissive-wins (union):** A viewer sees me if *any* scope that applies to them grants visibility. Simple, but "disable location for group X" can't reliably hide me if I also match another grant (e.g. friendship). Bad for privacy expectations.

2. **Layered precedence with explicit deny (recommended starting point):** Evaluate in a fixed order, where narrower/opt-in contexts and explicit denies override broader grants. Draft order:
   1. **Ghost** → deny everyone (except possibly active convoy — decide).
   2. **Active convoy members** → allow (opt-in, intimate; likely overrides ghost).
   3. **Per-group explicit deny** → if viewer's *only* qualifying relationship is that group, deny.
   4. **Per-group explicit allow** → allow group members.
   5. **Friends** → allow if friends-only or public.
   6. **Public** → allow everyone remaining.

   The tricky case is a viewer who qualifies via *multiple* channels (friend **and** muted-group member). Decision needed: does the group mute only remove the *group* channel (they still see me as a friend), or is a group mute a hard deny? Leaning: **group mute removes only that channel** — you're hiding from the group *as a group*, not from individuals you've separately chosen to share with. This must be stated explicitly in the UI.

**Design principle:** Users must be able to *predict* who sees them. Precedence rules that require a flowchart to understand will erode trust. Whatever model we pick, the settings UI should surface the *effective* result ("People who can see you: friends, SoCal Porsche group").

---

## Exposing This to Users (UI)

The scopes aren't mutually exclusive (global mode + per-group overrides), so a single 3-way toggle (today's UI) is insufficient. Options:

- **Global mode + per-group overrides list:** One primary control (Public / Friends / Ghost) plus a "Groups" section listing each group with a location toggle. Clean mental model; matches the data.
- **"Audience" presets:** Named presets (e.g. "Just my crew", "Everyone", "Invisible") that bundle settings. Friendly but hides the precedence.
- **Effective-visibility preview:** Whatever the controls, show a computed summary of who can currently see you.

Recommendation: global mode + per-group override list + an effective-visibility summary line.

---

## Backend Enforcement — Where & How

This is the crux and ties directly to [Map View Filtering](./MAP_VIEW_FILTERING.md) and [Clustering & LOD](./CLUSTERING_AND_LOD.md). Enforcement cannot be client-side (a hostile client would just render hidden users). Options:

- **Filter at fan-out (server-side, per-watcher):** When building the watcher list for a `driver_moved`, exclude watchers who aren't permitted to see this driver. Requires the spatial store to know each driver's visibility settings and each viewer's relationships (friendship, group membership) — data that currently lives in Postgres and is *not* loaded into the in-memory store. Needs a cache of relationship/visibility state in-process, kept fresh on change.
- **Filter at subscription (snapshot + entry):** Same permission check applied when producing `viewport_snapshot`. Must also handle the case where a relationship changes mid-session (e.g. someone unfriends you) — need an invalidation/exit event.
- **Precompute per-user "visible-to" sets:** Maintain, per driver, the set/predicate of who may see them, and consult it in fan-out. More memory, faster hot path.

**Key architectural tension:** the spatial store was deliberately built with *no DB on the hot path* (per CLAUDE.md, "no external broker on the hot path"). Adding per-viewer permission checks reintroduces relationship data into that path. We need an in-memory relationship/visibility cache with change propagation, or we accept a DB touch on subscription (not per-move).

---

## Candidate Approaches (phasing)

- **Phase 1 — Enforce what exists:** Make ghost/friends-only/public actually work in the spatial fan-out (load a per-user visibility + friend-set cache). No group scope yet. Immediately fixes the "ghost does nothing" gap.
- **Phase 2 — Group scope:** Add per-group visibility overrides once [Groups](./GROUPS_AND_CLUBS.md) exists, with the layered precedence model.
- **Phase 3 — Convoy override + effective-visibility UI:** Formalize convoy-always-visible and ship the effective-visibility summary.

---

## Open Questions

- [ ] Does **ghost** override active-convoy visibility, or do convoy members always see you? (Leaning: convoy wins.)
- [ ] Is a per-group **mute** a hard deny, or does it only remove the group channel (friends still see you)? (Leaning: only the group channel.)
- [ ] Does `discovery_radius_miles` still make sense once visibility is relationship-based, or is it redundant with cell-based nearby streaming?
- [ ] Does "friends only" also hide you in group rosters, or only your live location? (Concept says roster/profile stay visible.)
- [ ] How fast must a visibility change propagate? (e.g. flipping to ghost should hide you within ~1s — needs an immediate `driver_exited` to current watchers.)
- [ ] Do we need a per-user block list (hard deny a specific person regardless of scope)? Likely yes eventually.
- [ ] Should there be a "share precise vs approximate location" option (fuzzing) as a middle ground between visible and hidden?
