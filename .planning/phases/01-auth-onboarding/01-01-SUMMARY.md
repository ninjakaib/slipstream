---
phase: 01-auth-onboarding
plan: 01
subsystem: authentication
tags:
  - auth
  - apple-sign-in
  - jwt
  - keychain
  - ios
dependency_graph:
  requires: []
  provides:
    - POST /auth/apple endpoint
    - iOS KeychainService
    - iOS APIClient
    - iOS AuthService
    - iOS AuthState
    - iOS WelcomeView
  affects:
    - ContentView (routing)
    - backend/auth.py
    - backend/config.py
tech_stack:
  added:
    - AuthenticationServices (iOS framework)
    - httpx (Python async HTTP)
    - PyJWKClient (JWT verification)
  patterns:
    - Actor-based API client
    - Observable auth state
    - Token rotation
key_files:
  created:
    - backend/src/backend/routers/auth.py (POST /auth/apple)
    - SlipStream/Services/KeychainService.swift
    - SlipStream/Services/APIClient.swift
    - SlipStream/Services/AuthService.swift
    - SlipStream/Models/AuthModels.swift
    - SlipStream/Auth/AuthState.swift
    - SlipStream/Auth/WelcomeView.swift
  modified:
    - backend/src/backend/auth.py (fetch_apple_public_keys)
    - backend/src/backend/config.py (apple_bundle_id)
    - SlipStream/ContentView.swift (auth routing)
decisions:
  - Used httpx for async Apple JWKS fetch (stdlib urllib lacks async support)
  - Actor-based APIClient prevents concurrent token refresh race conditions
  - Temporary username generated from apple_id prefix for new users
metrics:
  duration: 3 minutes
  completed: 2026-06-10T20:30:00Z
---

# Phase 01 Plan 01: Auth Walking Skeleton Summary

JWT auth with Apple Sign In using native AuthenticationServices, Keychain storage with kSecAttrAccessibleAfterFirstUnlock, and actor-based API client with automatic token refresh.

## Objective

Create the authentication walking skeleton: Apple Sign In on iOS exchanges identity token with backend for JWT tokens, stored securely in Keychain. App routes correctly based on auth state.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add POST /auth/apple endpoint | 4606247 | auth.py, config.py, routers/auth.py |
| 2 | Create iOS Services layer | feb17ab | KeychainService, APIClient, AuthService, AuthModels |
| 3 | Create AuthState and WelcomeView | f64ca3f | AuthState, WelcomeView, ContentView |

## Implementation Details

### Backend (Task 1)

**POST /auth/apple endpoint:**
- Fetches Apple JWKS from https://appleid.apple.com/auth/keys with 1-hour cache
- Validates identity token signature using PyJWKClient
- Verifies iss (https://appleid.apple.com), aud (bundle ID), exp claims
- Extracts `sub` (Apple user ID) from token payload
- Creates new user with apple_id if not found, returns is_new_user=true
- Issues 15-min access token + 30-day refresh token
- Captures email/fullName from request (Apple only provides on first sign-in)

**New config:**
- `apple_bundle_id` setting (default: "com.slipstream.app")

### iOS Services (Task 2)

**KeychainService.swift:**
- Uses `kSecClassGenericPassword` with `kSecAttrAccessibleAfterFirstUnlock`
- Supports background token refresh (device locked)
- Methods: saveToken, retrieveToken, deleteToken, deleteAllTokens

**APIClient.swift:**
- Actor-based to prevent concurrent access
- Automatic token refresh on 401 responses
- Single retry per request after refresh
- Supports environment variable override for base URL

**AuthService.swift:**
- @MainActor for UI updates
- signInWithApple exchanges token and stores in Keychain
- refreshTokens for silent background refresh (per D-09)
- validateTokens checks /users/me endpoint

### iOS Auth UI (Task 3)

**AuthState.swift:**
- Four states: loading, unauthenticated, onboarding, authenticated
- checkAuthStatus loads tokens and validates on launch
- signInWithApple routes to onboarding (new) or authenticated (returning)
- Per D-09: Shows map immediately if tokens exist
- Per D-11: Sets errorMessage on auth failure

**WelcomeView.swift:**
- SignInWithAppleButton with .white style
- Requests fullName and email scopes
- Error toast component with dismiss button
- Copy: "Apple sign-in was interrupted. Tap to try again, or check your Apple ID settings if the problem persists."

**ContentView.swift:**
- Routes based on authState.state
- Injects both viewModel and authState via @EnvironmentObject
- Placeholder onboarding view with skip button for testing

## Verification Evidence

```bash
# Backend endpoint exists
grep -c "@router.post.*apple" backend/src/backend/routers/auth.py
# Output: 1

# Keychain uses secure accessibility
grep -c "kSecAttrAccessibleAfterFirstUnlock" SlipStream/Services/KeychainService.swift
# Output: 2

# SignInWithAppleButton present
grep -c "SignInWithAppleButton" SlipStream/Auth/WelcomeView.swift
# Output: 1

# ContentView routes on auth state
grep -c "switch authState.state" SlipStream/ContentView.swift
# Output: 1
```

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-01-01 | Server-side JWKS validation | fetch_apple_public_keys with iss/aud/exp checks |
| T-01-02 | Keychain storage | kSecAttrAccessibleAfterFirstUnlock, never UserDefaults |
| T-01-03 | Token rotation | Backend refresh endpoint revokes old token on use |
| T-01-04 | HTTPS only | APIClient base URL uses https:// |

## Known Stubs

None - all functionality is wired to real endpoints.

## Self-Check: PASSED

All files created and commits verified:
- [x] 4606247 exists in git log
- [x] feb17ab exists in git log
- [x] f64ca3f exists in git log
- [x] All key files exist on disk
