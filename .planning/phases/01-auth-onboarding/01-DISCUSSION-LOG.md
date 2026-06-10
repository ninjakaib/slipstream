# Phase 1: Auth & Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 1-Auth & Onboarding
**Areas discussed:** Onboarding flow structure, Car entry experience, Session persistence, Error and edge cases

---

## Onboarding Flow Structure

### Question: How should the onboarding steps be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard | One screen per step (username → photo → car) with progress indicator and back navigation. Feels polished, easy to focus. (Recommended) | ✓ |
| Single scrolling form | All fields on one long screen, scroll to complete. Faster for power users, but can feel overwhelming. | |
| You decide | Claude picks the best pattern based on SwiftUI conventions and car app vibes | |

**User's choice:** Multi-step wizard

### Question: Should users be able to skip optional steps?

| Option | Description | Selected |
|--------|-------------|----------|
| No skipping | Every step must be completed before unlocking the app. Username, photo, and car are all required. | |
| Photo is optional | Username and car required, but profile photo can be skipped and added later from Profile settings | ✓ |
| You decide | Claude picks based on what feels right for a car culture app | |

**User's choice:** Photo is optional

### Question: What happens visually during transitions?

| Option | Description | Selected |
|--------|-------------|----------|
| Slide left/right | Standard iOS navigation pattern. Steps slide in from right, back slides from left. | |
| Crossfade | Softer transition, each step fades into the next. Feels more premium. | |
| You decide | Claude picks appropriate SwiftUI transitions based on platform conventions | ✓ |

**User's choice:** You decide

---

## Car Entry Experience

### Question: How should users enter their car's year/make/model?

| Option | Description | Selected |
|--------|-------------|----------|
| Cascading pickers | Year picker → Make picker (filtered) → Model picker (filtered) → Trim picker. Guided, no typos, but requires maintaining a car database. | |
| Free text fields | Simple text inputs for year, make, model, trim. Fast to build, but prone to inconsistent data. | |
| Hybrid approach | Autocomplete text fields that suggest from a database but allow freeform entry. (Recommended) | |
| You decide | Claude picks the right balance for MVP | |

**User's choice:** (Free-text response)
**Notes:** User prefers cascading pickers but concerned about enthusiasts with obscure/customized cars, special editions, JDM imports that won't be in standard databases. Wants a display name option for how cars appear. Future verification system to prevent false claims noted.

### Question: For MVP, should we use an external car database API or build a simpler solution?

| Option | Description | Selected |
|--------|-------------|----------|
| NHTSA vPIC API | Free US government API with year/make/model data. Good coverage, no cost, but US-focused. | ✓ |
| Static JSON file | Bundle a curated list of enthusiast-relevant makes/models. Fast, works offline, but manual maintenance. | |
| Freeform for MVP | Start with text fields + display name. Swap to pickers later. Faster to ship. | |

**User's choice:** NHTSA vPIC API (after clarification discussion)
**Notes:** User explicitly did not want to maintain a manual database. Claude recommended NHTSA + "Other/Custom" fallback + display name field. User confirmed "this sounds perfect."

### Question: Should car photo be required during onboarding?

| Option | Description | Selected |
|--------|-------------|----------|
| Required | User must add at least one car photo before completing onboarding. | |
| Optional | Car can be added without a photo initially. User can add photos later from Garage. | |
| You decide | Claude picks based on the "< 2 minutes" onboarding goal from PRD | ✓ |

**User's choice:** You decide

---

## Session Persistence

### Question: How long should users stay signed in?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay signed in indefinitely | User stays logged in until they explicitly sign out or tokens expire (30 days). Standard for social apps. (Recommended) | ✓ |
| Re-auth after 7 days | Force sign-in weekly even if tokens are valid. More secure, but friction for a daily-use app. | |
| Re-auth on sensitive actions | Stay signed in for general use, but require Face ID/Touch ID for sensitive actions. | |

**User's choice:** Stay signed in indefinitely

### Question: When the app returns from background, should it silently refresh tokens or show any loading state?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent refresh | Tokens refresh in background, user sees the map immediately. If refresh fails, then show sign-in. | ✓ |
| Brief loading state | Show a branded splash for 1-2 seconds while checking auth state. | |
| You decide | Claude picks based on the "instant and alive" core value | |

**User's choice:** Silent refresh (after clarification)
**Notes:** User asked what "returns from background" meant. Claude explained iOS app lifecycle. User chose silent refresh to maintain "instant and alive" feeling.

---

## Error and Edge Cases

### Question: When a username is already taken, how should we handle it?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline validation | Check availability as user types (debounced). Show green checkmark or red X before they tap Continue. (Recommended) | ✓ |
| Validate on submit | Check only when user taps Continue. Simpler to build, but user has to retry if taken. | |
| Suggest alternatives | If taken, show suggestions like "apexkai_23". Helpful but can feel impersonal. | |

**User's choice:** Inline validation

### Question: If Sign in with Apple fails, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + stay on screen | Show a brief error message and keep the sign-in button visible. User can retry immediately. | ✓ |
| Alert dialog | Show a modal alert explaining the error with a dismiss button. More prominent, but interrupts flow. | |
| You decide | Claude picks the appropriate error pattern for auth failures | |

**User's choice:** Toast + stay on screen

### Question: If photo upload fails during onboarding, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry with feedback | Show error inline with the photo still selected. User can retry or pick a different photo. | |
| Skip and continue | Offer to skip the photo step and continue. User can add photo later. | |
| Both options | Show retry option, but also offer a "Skip for now" button so user isn't stuck. (Recommended) | ✓ |

**User's choice:** Both options

---

## Claude's Discretion

- Onboarding step transitions (slide vs crossfade)
- Car photo requirement during onboarding

## Deferred Ideas

- **Car verification system** — Future feature to prevent false claims about car ownership (e.g., display name mismatching structured data)

---

*Discussion completed: 2026-06-10*
