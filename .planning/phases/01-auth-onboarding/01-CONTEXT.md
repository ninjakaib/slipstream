# Phase 1: Auth & Onboarding - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can sign in with Apple and complete required profile/car setup before accessing the app. This phase delivers the authentication flow and first-time onboarding experience — everything a new user sees before reaching the map.

</domain>

<decisions>
## Implementation Decisions

### Onboarding Flow Structure
- **D-01:** Multi-step wizard with one screen per step (username → photo → car) and progress indicator with back navigation
- **D-02:** Profile photo is optional — can be skipped and added later from Profile settings
- **D-03:** Username and car are required — user cannot access app without completing these

### Car Entry Experience
- **D-04:** Use NHTSA vPIC API for year/make/model cascading pickers — free, zero maintenance, good US coverage
- **D-05:** Include "Other / Custom" option at end of any picker for cars not in database (JDM imports, kit cars, rare specs)
- **D-06:** Add a **display name** field for how the car appears on map/profile (e.g., "R32 GT-R", "Panda AE86") — decouples database identity from enthusiast identity
- **D-07:** Future car verification system noted as deferred idea to prevent false claims

### Session Persistence
- **D-08:** Stay signed in indefinitely until explicit sign-out or token expiry (30 days per backend config)
- **D-09:** Silent token refresh when app resumes — show map immediately, no loading state. Handle auth failures only if refresh actually fails.

### Error Handling
- **D-10:** Inline username validation — check availability as user types (debounced), show green checkmark or red X before Continue
- **D-11:** Auth failures (network, cancel, outage) show toast message + stay on sign-in screen for immediate retry
- **D-12:** Photo upload failures show both retry option and "Skip for now" button so user isn't stuck

### Claude's Discretion
- Onboarding step transitions (slide vs crossfade) — pick appropriate SwiftUI transitions based on platform conventions
- Car photo requirement — decide based on "< 2 minutes" onboarding goal from PRD

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Requirements
- `docs/PRODUCT_REQUIREMENTS.md` §4.1 — Onboarding & Authentication flow, required fields, "<2 minutes" goal
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-03, ONBOARD-01 through ONBOARD-04

### Backend Architecture
- `docs/BACKEND_ARCHITECTURE.md` §3 — Authentication strategy, Sign in with Apple flow, JWT token exchange
- `backend/src/backend/routers/auth.py` — Existing auth endpoints (register, login, refresh, logout)
- `backend/src/backend/auth.py` — JWT generation/validation, token utilities

### External APIs
- NHTSA vPIC API — Vehicle data for year/make/model pickers (https://vpic.nhtsa.dot.gov/api/)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/backend/routers/auth.py` — Auth endpoints ready for iOS integration
- `backend/src/backend/routers/users.py` — User profile CRUD, username uniqueness check
- `backend/src/backend/routers/cars.py` — Car CRUD endpoints ready for garage management
- `SlipStream/SlipStreamStyle.swift` — Existing dark theme, cyan accent color

### Established Patterns
- Backend uses JWT with access + refresh tokens (15min access, 30 day refresh)
- Keychain storage required for secure token persistence on iOS
- Pydantic validation on backend for username format (3-20 chars, alphanumeric + underscore)

### Integration Points
- `SlipStream/ContentView.swift` — Root view, will need auth state check to route to onboarding vs map
- `SlipStream/SlipStreamApp.swift` — App entry point
- `POST /auth/apple` — Backend endpoint for Apple identity token exchange

</code_context>

<specifics>
## Specific Ideas

- Display name is key for enthusiast identity — structured data (year/make/model) is for filtering/matching, display name is what users see
- Onboarding should feel quick and not burdensome per PRD
- "Instant and alive" feel — no loading screens when resuming app

</specifics>

<deferred>
## Deferred Ideas

- **Car verification system** — Prevent false claims (e.g., display name "Bugatti" on a Sentra). Flag mismatches between structured data and display name. Future phase.

</deferred>

---

*Phase: 1-Auth & Onboarding*
*Context gathered: 2026-06-10*
