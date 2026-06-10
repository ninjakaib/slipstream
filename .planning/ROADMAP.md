# Roadmap: SlipStream iOS

**Created:** 2026-06-10
**Phases:** 5
**Granularity:** Coarse

## Overview

| # | Phase | Goal | Requirements | Est. Effort |
|---|-------|------|--------------|-------------|
| 1 | Auth & Onboarding | Users can sign in and set up their profile + car | 7 | Medium |
| 2 | Live Map | Users can see real-time driver positions on the map | 17 | Large |
| 3 | Driving & Navigation | Users can navigate with turn-by-turn in driving mode | 15 | Large |
| 4 | Convoys | Users can create, join, and coordinate convoy drives | 16 | Large |
| 5 | Social & Polish | Users can manage friends, profile, garage, and settings | 22 | Medium |

---

## Phase Details

### Phase 1: Auth & Onboarding
**Goal:** As a new user, I want to sign in with Apple and set up my profile and car, so that I can start using the app to see nearby drivers.
**Mode:** mvp

**Requirements:** AUTH-01, AUTH-02, AUTH-03, ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04

**Plans:** 4 plans

Plans:
- [ ] 01-01-PLAN.md — Walking skeleton: Apple Sign In + backend token exchange + Keychain storage
- [ ] 01-02-PLAN.md — Onboarding container + username step with debounced validation
- [ ] 01-03-PLAN.md — Photo step (optional) + car step with NHTSA cascading pickers
- [ ] 01-04-PLAN.md — Integration: data persistence + token refresh + toast errors + completion flow

**Success Criteria:**
1. User can tap "Sign in with Apple" and authenticate
2. New user completes username → photo → car flow before seeing map
3. Returning user goes directly to map
4. Tokens stored securely and refresh automatically

**UI hint:** yes

**Canonical refs:**
- `docs/PRODUCT_REQUIREMENTS.md` — Section 4.1 Onboarding & Authentication
- `docs/BACKEND_ARCHITECTURE.md` — Section 3 Authentication

---

### Phase 2: Live Map
**Goal:** Users see a real-time map with nearby drivers, can tap markers for info, and control visibility.
**Mode:** mvp

**Requirements:** PERM-01, PERM-02, PERM-03, PERM-04, NET-01, NET-02, NET-03, NET-04, NET-05, NET-06, MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07, MAP-08, MAP-09, MAP-10, MAP-11

**Success Criteria:**
1. Map loads with dark style and user's location
2. Location permission requested with clear explanation
3. WebSocket connects and receives nearby driver updates
4. Driver markers appear with correct status colors
5. Tap marker shows driver info card with actions
6. Filter pills work (All/Drivers/Convoys)
7. App handles offline gracefully

**UI hint:** yes

**Canonical refs:**
- `docs/PRODUCT_REQUIREMENTS.md` — Section 4.2 Map (Explorer Mode)
- `.claude/skills/mapbox-ios-patterns/SKILL.md` — Map initialization, markers
- `.claude/skills/mapbox-ios-patterns/references/location-tracking.md`

---

### Phase 3: Driving & Navigation
**Goal:** Users can enter driving mode with HUD and navigate with turn-by-turn directions.
**Mode:** mvp

**Requirements:** DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05, DRIVE-06, DRIVE-07, DRIVE-08, DRIVE-09, NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06

**Success Criteria:**
1. Tap "Drive" smoothly transitions camera to driving mode
2. Camera follows user with forward pitch and heading lock
3. Speed gauge displays current speed prominently
4. Speed limit indicator shows with color coding
5. Road name pill shows current road
6. User can search destination and start navigation
7. Turn-by-turn directions appear in HUD
8. Exit returns to explorer mode smoothly

**UI hint:** yes

**Canonical refs:**
- `docs/PRODUCT_REQUIREMENTS.md` — Section 4.3 Driving Mode, Section 4.4 Navigation
- `.claude/skills/mapbox-ios-patterns/references/camera-styles.md`

---

### Phase 4: Convoys
**Goal:** Users can create convoys, invite friends, join public convoys, chat, and use quick actions.
**Mode:** mvp

**Requirements:** CONVOY-01, CONVOY-02, CONVOY-03, CONVOY-04, CONVOY-05, CONVOY-06, CONVOY-07, CONVOY-08, CONVOY-09, CONVOY-10, CONVOY-11, QA-01, QA-02, QA-03, QA-04, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05

**Success Criteria:**
1. User can create convoy (name, visibility) in <10 seconds
2. Public convoys appear on map for nearby users
3. User can request to join or join friend's convoy directly
4. Convoy lobby shows members with real-time positions
5. Quick actions broadcast toast to all members
6. Chat messages appear in real-time
7. Leader can end convoy; chat is deleted

**UI hint:** yes

**Canonical refs:**
- `docs/PRODUCT_REQUIREMENTS.md` — Section 4.5 Convoys, 4.6 Quick Actions, 4.9 Convoy Chat
- `docs/BACKEND_ARCHITECTURE.md` — Section 9 Convoy State Machine

---

### Phase 5: Social & Polish
**Goal:** Users can manage friends, profile, garage, settings, and receive notifications.
**Mode:** mvp

**Requirements:** SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07, SOCIAL-08, SOCIAL-09, PROFILE-01, PROFILE-02, GARAGE-01, GARAGE-02, GARAGE-03, GARAGE-04, GARAGE-05, SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06

**Success Criteria:**
1. Social page shows friends list with status indicators
2. User can search and send friend requests
3. Profile shows active car prominently
4. User can add/edit/delete cars in garage
5. Visibility toggle works (On/Friends Only/Ghost)
6. Push notifications arrive for invites and requests
7. Settings persist across sessions

**UI hint:** yes

**Canonical refs:**
- `docs/PRODUCT_REQUIREMENTS.md` — Section 4.7 Social, 4.8 Profile & Garage, 4.10 Settings, 4.11 Notifications
- `.claude/skills/swiftui-design-principles/SKILL.md`

---

## Dependencies

```
Phase 1 ──► Phase 2 ──► Phase 3
                │
                └──► Phase 4 ──► Phase 5
```

- Phase 2 requires Phase 1 (auth needed for API calls)
- Phase 3 requires Phase 2 (map + network layer needed)
- Phase 4 requires Phase 2 (map + network layer needed)
- Phase 5 requires Phase 4 (convoy membership for chat access)

Phases 3 and 4 can run in parallel after Phase 2.

---
*Roadmap created: 2026-06-10*
*Phase 1 planned: 2026-06-10*
