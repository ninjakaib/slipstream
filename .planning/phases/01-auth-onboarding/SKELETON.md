# Walking Skeleton — Phase 1: Auth & Onboarding

**Created:** 2026-06-10
**Purpose:** Establish the thinnest end-to-end stack for authentication and onboarding flows.

## What This Skeleton Proves

When complete, a user can:
1. Tap "Sign in with Apple" on the welcome screen
2. Complete Apple authentication (Face ID / password)
3. Receive JWT tokens from backend and have them stored in Keychain
4. Be routed to onboarding (if new) or map (if returning)
5. Complete onboarding steps (username, optional photo, car)
6. Have their profile and car persisted in the database
7. See the map screen (even if empty for now)

## Technology Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **iOS Auth** | AuthenticationServices (native) | Apple's required framework for Sign in with Apple |
| **Token Storage** | Keychain Services | Hardware-backed encryption, required for credentials |
| **Token Format** | JWT (access + refresh) | Already implemented in backend |
| **API Client** | URLSession async/await | No third-party needed, native Swift concurrency |
| **State Management** | @EnvironmentObject + AuthState | Consistent with existing SlipStreamViewModel pattern |
| **Onboarding UI** | Horizontal ScrollView | iOS 18+ pattern, programmatic navigation |
| **Vehicle Data** | NHTSA vPIC API | Free, no maintenance, good US coverage |
| **Photo Picker** | PhotosUI + UIImagePickerController | Native components, no library needed |

## Directory Structure

```
SlipStream/
├── Services/
│   ├── AuthService.swift           # Sign in with Apple + token exchange
│   ├── KeychainService.swift       # Secure token storage
│   ├── APIClient.swift             # Backend HTTP client
│   └── VehicleDataService.swift    # NHTSA vPIC API client
├── Auth/
│   ├── AuthState.swift             # Observable auth state
│   └── WelcomeView.swift           # Sign in with Apple UI
├── Onboarding/
│   ├── OnboardingContainerView.swift  # Horizontal ScrollView wizard
│   ├── OnboardingProgressView.swift   # Progress indicator
│   ├── UsernameStepView.swift         # Username entry + validation
│   ├── PhotoStepView.swift            # Profile photo (optional)
│   └── CarStepView.swift              # Vehicle entry with NHTSA pickers
├── Models/
│   └── AuthModels.swift            # Token, credential, API response models
├── Components/
│   ├── ToastView.swift             # Error/success notifications
│   └── CameraView.swift            # UIImagePickerController wrapper
└── (existing files...)
```

## API Contract

### Backend Endpoint: POST /auth/apple

**Request:**
```json
{
  "identity_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "full_name": {
    "given_name": "Kai",
    "family_name": "Breese"
  },
  "email": "kai@example.com"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "abc123...",
  "token_type": "bearer",
  "user_id": "uuid",
  "username": "kaibreese",
  "is_new_user": true
}
```

### Existing Endpoints Used

- `POST /auth/refresh` — Token refresh
- `GET /users/me` — Get current profile
- `PATCH /users/me` — Update profile (username)
- `GET /users/search?q=` — Username availability check
- `POST /cars` — Create car (auto-activates first car)

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           iOS App Launch                                  │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                              Check Keychain for tokens
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
              Has Tokens                          No Tokens
                    │                                   │
                    v                                   v
         ┌──────────────────┐              ┌──────────────────┐
         │ Validate/Refresh │              │   WelcomeView    │
         │      Token       │              │ (Sign in w Apple)│
         └────────┬─────────┘              └────────┬─────────┘
                  │                                 │
            Valid / Invalid                   User taps Sign In
                  │                                 │
         ┌────────┴────────┐                       v
         │                 │           ┌────────────────────────┐
       Valid           Invalid        │   Apple Auth Sheet     │
         │                 │           │   (Face ID/Password)   │
         v                 v           └───────────┬────────────┘
   ┌──────────┐    ┌──────────────┐               │
   │   Map    │    │ WelcomeView  │         Success / Cancel
   │  Screen  │    │  (re-auth)   │               │
   └──────────┘    └──────────────┘    ┌──────────┴──────────┐
                                       │                      │
                                   Success                 Cancel
                                       │                      │
                                       v                      v
                          ┌────────────────────┐     ┌────────────────┐
                          │ POST /auth/apple   │     │ Toast + Stay   │
                          │ (exchange token)   │     │ on WelcomeView │
                          └─────────┬──────────┘     └────────────────┘
                                    │
                              is_new_user?
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                       true                  false
                         │                     │
                         v                     v
              ┌──────────────────┐      ┌──────────┐
              │ OnboardingFlow   │      │   Map    │
              │ Username→Photo→Car│      │  Screen  │
              └────────┬─────────┘      └──────────┘
                       │
               Complete flow
                       │
                       v
              ┌──────────────────┐
              │ POST /cars       │
              │ (create first car)│
              └────────┬─────────┘
                       │
                       v
              ┌──────────────────┐
              │      Map         │
              │     Screen       │
              └──────────────────┘
```

## Routing Logic

```swift
// ContentView.swift (modified)
struct ContentView: View {
    @StateObject private var viewModel = SlipStreamViewModel()
    @StateObject private var authState = AuthState()
    
    var body: some View {
        Group {
            switch authState.state {
            case .loading:
                // Splash or skeleton
                ProgressView()
            case .unauthenticated:
                WelcomeView()
            case .onboarding:
                OnboardingContainerView()
            case .authenticated:
                AppRootView()
            }
        }
        .environmentObject(viewModel)
        .environmentObject(authState)
    }
}
```

## Security Boundaries

| Boundary | Trust Level | Mitigation |
|----------|-------------|------------|
| iOS App → Apple Auth | Trusted (OS-level) | Native framework, no custom code |
| iOS App → Backend API | Untrusted | HTTPS only, JWT validation |
| Keychain | Hardware-secured | kSecAttrAccessibleAfterFirstUnlock |
| Apple identity token | Signed by Apple | Server-side JWKS validation |
| Backend JWT | Signed by us | 15-min expiry, refresh rotation |

## Verification Path

After skeleton is complete, verify with:

1. **Fresh install test:** Delete app, reinstall, sign in with Apple → should show onboarding
2. **Keychain persistence:** Kill app, reopen → should go directly to map (no sign-in)
3. **Token refresh:** Wait 16 minutes (access token expires), make API call → should auto-refresh
4. **New user flag:** Backend returns is_new_user=true for first-time users
5. **Onboarding gate:** Cannot skip steps; car creation required before map access

## What This Skeleton Does NOT Include

These are explicitly deferred to later phases or later plans:

- Profile photo upload to R2 (optional photo, local preview only for now)
- Car photo upload
- Push notification registration
- WebSocket connection
- Map markers / live location
- Any UI polish or animations

---

*Skeleton established: 2026-06-10*
