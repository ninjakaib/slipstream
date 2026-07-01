# Groups / Clubs

> Status: **Idea / exploration.** No implementation. Captures the concept, sub-decisions, hard problems, candidate approaches, and open questions.

---

## Concept

User-created communities ("groups" or "clubs") that other users can join — functionally similar to Facebook Groups, but oriented around driving. Membership scopes discovery and social features to a focused community.

**Why:** The app's default behavior is "show everyone to everyone," which becomes noisy and impersonal at scale. Groups promote **focused discovery** and let communities stay **private and specific**.

**Motivating examples:**
- Nationwide Porsche group
- San Diego trucks group
- UCLA students group

**What membership unlocks:**
- See the **locations** of other members (subject to each member's per-group visibility — see [Visibility Controls](./VISIBILITY_CONTROLS.md))
- **Chat** with the group
- See **group-specific events** (future — events are not yet a concept in the app)
- Act as a **map filter layer** — "show me only this group" (see [Map View Filtering](./MAP_VIEW_FILTERING.md))

---

## Admin-Controlled Settings

The group admin (creator, plus possibly delegated roles) should control:

| Setting | Options (draft) | Notes |
|---------|-----------------|-------|
| **Visibility / discoverability** | Public (anyone can discover & see it exists) / Unlisted (join by link/invite, not in search) / Private (invite-only, not discoverable) | Distinct from *membership* approval below. |
| **Join policy** | Open (join instantly) / Request + approval / Invite-only | Who can become a member and how. |
| **Who can invite** | Admins only / Any member / Nobody (link only) | Controls invite fan-out. |
| **Who can post/chat** | All members / Admins only (announcement style) | |
| **Location sharing default** | Whether new members share location to the group by default | Interacts hard with per-user visibility — see precedence discussion in [Visibility Controls](./VISIBILITY_CONTROLS.md). |
| **Member cap / geography** | Optional max size; optional geo-scoping (e.g. "San Diego") | Geo-scoping is a nice-to-have; unclear if enforced or descriptive. |

---

## Roles (draft)

At minimum: **Owner / Admin / Member.** Possibly **Moderator** for chat.

Open question: reuse a pattern similar to convoys (leader + member) or introduce a richer role/permission table? Groups are longer-lived and larger than convoys, so they likely need more granular roles and an explicit permission set rather than hardcoded leader-only checks.

---

## Data Model Sketch

None of this exists yet. New tables (mirroring the existing SQLAlchemy 2.0 `Mapped[]` style in `backend/src/slipstream/models.py`):

- `Group` — `id, name, slug/handle?, description, avatar, owner_id, visibility (public/unlisted/private), join_policy (open/request/invite), invite_permission (admins/members/link), post_permission, created_at`
- `GroupMember` — `id, group_id, user_id, role (owner/admin/moderator/member), joined_at`, unique `(group_id, user_id)`
- `GroupJoinRequest` — `id, group_id, user_id, status (pending/accepted/declined), created_at` (mirror `ConvoyJoinRequest`)
- `GroupInvite` — invite tokens / targeted invites (may be modeled as pre-accepted requests like convoys do, or as first-class invite links)
- Later: `GroupEvent`, `GroupMessage` (group chat — see reuse note below)
- Per-member per-group visibility override — see [Visibility Controls](./VISIBILITY_CONTROLS.md); likely `GroupMember.location_visible: bool` or a richer per-group visibility enum.

**Reuse opportunity:** The convoy system (`routers/convoys.py`, `ConvoyMessage`, `ConvoyJoinRequest`, quick-action-as-message) already implements membership, roles, join-requests-as-invites, and ephemeral chat. Group chat and join flows can borrow these patterns heavily. Decide whether to generalize a shared "membership + chat" core or duplicate deliberately.

---

## The Hard Problems

### 1. Group membership ⇄ location visibility (the big one)
Membership implies "can see member locations," but each user must retain per-group control over *their own* visibility. A member can be **in** a group (visible in the roster, profile viewable) while **hiding their live location** from that group specifically. This is the core of the precedence problem documented in [Visibility Controls](./VISIBILITY_CONTROLS.md). Groups cannot be designed independently of that doc.

### 2. Location fan-out to group members
Today the spatial layer (`spatial/store.py`) fans out purely by **H3 cell overlap** — there is no notion of "who is allowed to see whom." A nationwide group means members are scattered across the country and would **never** share cells, so cell-overlap alone can't deliver "see everyone in my Porsche group nationwide."

This forces a real architectural question:
- **Option A — Social/group channels alongside cells:** Extend the spatial store so a group is its own subscription channel (like a cell, but keyed by `group:<id>`). Members publish to their group channel; group viewers subscribe to it regardless of geography. Powerful but a significant change to the current cell-only model and must interact with LOD/filtering.
- **Option B — Keep spatial geographic; deliver group presence via a separate path:** The map's live stream stays cell-based for "nearby"; group-wide presence (esp. non-nearby members) comes from a lower-frequency REST/WS "group roster with last-known positions" feed. Simpler, but two code paths and staleness for far members.
- **Option C — Client-side filter only:** Backend streams everything nearby; client filters to group. Fails the nationwide case entirely (far members never stream). Rejected for group-wide discovery, but fine for "highlight my group among nearby drivers."

Cross-reference: [Map View Filtering](./MAP_VIEW_FILTERING.md) (server-vs-client filtering) and [Clustering & Zoom Behavior](./CLUSTERING_AND_LOD.md) — group channels and LOD gating must be designed together.

### 3. Discoverability & search
Public groups need a browse/search surface (by name, tag, geography, car make). Requires a group listing/search endpoint and a discovery UI. Currently no group concept and no such endpoint.

### 4. Scale & abuse
Open public groups invite spam, impersonation, and moderation load. Need reporting, kick/ban, and possibly admin approval for group *creation* at some threshold. Out of MVP scope but note it.

---

## Candidate Approaches (phasing)

- **MVP-first:** Private/invite-only groups + group chat + "highlight this group among nearby drivers" (client-side filter of the existing nearby stream). No nationwide presence yet. Proves the social loop with minimal spatial changes.
- **Presence-complete:** Add group channels to the spatial store (Option A) so group-wide, cross-geography presence works. Bigger lift; unlocks the flagship "nationwide Porsche group" experience.
- **Discovery-complete:** Public discoverable groups + search/browse + moderation tooling.

Recommended sequencing: MVP-first → Presence-complete → Discovery-complete, so the risky spatial change lands only after the social UX is validated.

---

## Open Questions

- [ ] Do groups need a unique handle/slug (e.g. `@socal-porsche`) for sharing/deep links?
- [ ] Is geography a hard constraint (enforced membership boundary) or just descriptive metadata?
- [ ] One membership model shared with convoys, or separate? How much to generalize vs duplicate?
- [ ] How does a user's global visibility mode (ghost/friends-only) interact with group membership? (See precedence in [Visibility Controls](./VISIBILITY_CONTROLS.md).)
- [ ] Do group-wide (non-nearby) members appear on the map at all, or only in a roster/list view until they're nearby?
- [ ] Group events — separate feature doc later? What's the minimal version (a pinned destination + time)?
- [ ] Max group size? Does a huge group reintroduce the exact crowding problem groups were meant to solve (pushing work onto [Clustering & LOD](./CLUSTERING_AND_LOD.md))?
- [ ] Invite links: single-use vs reusable, expiring vs permanent, admin-revocable?
