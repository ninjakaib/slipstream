# SlipStream

## What This Is

A real-time social driving app for car enthusiasts that combines live location sharing, convoy coordination, and turn-by-turn navigation — "Forza Horizon online lobby, but in real life." iOS-native SwiftUI client backed by a Python FastAPI server with PostgreSQL and Redis for real-time state.

## Core Value

**Users can open the app, see who's out driving nearby, and join a drive in minutes.** If this loop doesn't feel instant and alive, nothing else matters.

## Requirements

### Validated

- Backend API architecture (FastAPI + PostgreSQL + Redis)
- Database schema (users, cars, convoys, friendships, messages)
- WebSocket protocol for real-time location streaming
- Redis GEO for proximity queries
- Convoy lifecycle (create, join, leave, end, chat, quick actions)
- Friend system (request, accept, list)
- Discovery endpoints with visibility/filtering

### Active

**iOS Frontend Rebuild** (current focus):

- [ ] **AUTH-01**: Sign in with Apple authentication flow
- [ ] **AUTH-02**: JWT token management (access + refresh)
- [ ] **ONBOARD-01**: Profile creation (username, avatar)
- [ ] **ONBOARD-02**: First car setup (required before app access)
- [ ] **PERM-01**: Location permission request flow
- [ ] **PERM-02**: Background location updates
- [ ] **MAP-01**: Real-time map with live driver positions via WebSocket
- [ ] **MAP-02**: Driver markers with status colors (Driving/Parked/InConvoy/EnRoute)
- [ ] **MAP-03**: Tap marker → driver info card
- [ ] **MAP-04**: Discovery radius filtering (user preference)
- [ ] **MAP-05**: Explorer mode camera (tilted, interactive)
- [ ] **NAV-01**: Driving mode camera (forward-looking, bearing-locked)
- [ ] **NAV-02**: Driving HUD (speed, speed limit, road name)
- [ ] **NAV-03**: Turn-by-turn navigation integration
- [ ] **NAV-04**: Route planning with waypoints
- [ ] **CONVOY-01**: Create convoy (name, visibility)
- [ ] **CONVOY-02**: Join convoy (invite, request, friend's convoy)
- [ ] **CONVOY-03**: Convoy lobby view (members, status, route)
- [ ] **CONVOY-04**: Convoy group chat (ephemeral, real-time)
- [ ] **CONVOY-05**: Quick actions (pull over, gas stop, slow down, regroup)
- [ ] **CONVOY-06**: Group route sharing
- [ ] **SOCIAL-01**: Friends list with status
- [ ] **SOCIAL-02**: Friend search and requests
- [ ] **SOCIAL-03**: Nearby drivers list view
- [ ] **PROFILE-01**: Profile view with active car
- [ ] **PROFILE-02**: Garage management (add, edit, swap active car)
- [ ] **SETTINGS-01**: Visibility toggle (On/Friends Only/Ghost)
- [ ] **SETTINGS-02**: Discovery radius preference
- [ ] **SETTINGS-03**: Units preference (mph/kph)
- [ ] **NOTIF-01**: Push notification registration
- [ ] **NOTIF-02**: In-app notification banners

### Out of Scope

- Android app — iOS only for MVP
- 3D car models on map — too complex, deferred to post-MVP
- Voice chat in convoys — requires additional infrastructure
- DMs / direct messaging — convoys + friend requests are sufficient for MVP
- Route saving/sharing — build route planning first
- Gamification (badges, points) — not core value
- Event scheduling — focus on spontaneous drives

## Context

**Backend is ready.** The FastAPI server has all endpoints and WebSocket handlers implemented for the MVP feature set. The iOS app needs to:
1. Replace demo data with real API integration
2. Implement WebSocket client for real-time updates
3. Build proper auth and onboarding flows
4. Polish driving mode and navigation
5. Complete convoy and social features

**Design language:** Dark-first, cyan accent (`rgb(51, 209, 240)`), bold typography, car-culture-native. Map is dark-styled, full-bleed. Everything should feel live and fast.

**Navigation model:** Snapchat-inspired — map is home, swipe/tab to Social, Chats, Profile. Explorer mode (interactive) vs Driving mode (HUD-focused).

**Mapbox dependencies:** MapboxMaps 11.0+, MapboxNavigationCore for turn-by-turn.

## Constraints

- **Platform**: iOS-only (SwiftUI, minimum iOS 17)
- **Backend**: Existing FastAPI server — don't modify unless iOS needs new endpoints
- **Maps**: Mapbox SDK already integrated — build on it, don't switch
- **Auth**: Sign in with Apple required (only auth method for MVP)
- **Battery**: Location updates must be battery-efficient (adaptive rate per PRD)
- **Safety**: Driving mode must be glanceable, minimal interaction required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| iOS-only for MVP | Faster iteration, native SwiftUI, car enthusiast audience skews iOS | — Pending |
| Sign in with Apple only | Simplest auth, no third-party SDK, 100% iOS users have Apple ID | — Pending |
| Mapbox over Apple Maps | Better customization, dark styling, navigation SDK, route planning | — Pending |
| No BaaS (Supabase/Firebase) | Full control over real-time logic, already built FastAPI backend | — Pending |
| Ephemeral convoy chat | Convoys are temporary — chat dies when convoy ends, keeps it lightweight | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-10 after initialization*
