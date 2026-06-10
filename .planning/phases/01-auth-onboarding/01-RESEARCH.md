# Phase 1: Auth & Onboarding - Research

**Researched:** 2026-06-10
**Domain:** iOS Authentication (Sign in with Apple), SwiftUI Onboarding Flows, Vehicle Data APIs
**Confidence:** HIGH

## Summary

This phase implements the complete authentication and onboarding experience for new SlipStream users. The technical approach leverages Apple's native `AuthenticationServices` framework for Sign in with Apple, iOS Keychain for secure token persistence, and NHTSA's free vPIC API for vehicle year/make/model data. The onboarding wizard follows a horizontal ScrollView pattern (iOS 18+ recommended) with programmatic navigation for forward-only progression with back button support.

The backend already has most required endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`, `/cars`, `/users/me`) but needs a new `/auth/apple` endpoint for Apple identity token exchange. The iOS client needs: (1) a sign-in view with the native Apple button, (2) a Keychain service for JWT storage, (3) a multi-step onboarding wizard, and (4) an API client for backend communication.

**Primary recommendation:** Use Apple's native `SignInWithAppleButton` SwiftUI component with the `AuthenticationServices` framework. Store tokens in Keychain using `kSecClassGenericPassword` with `kSecAttrAccessibleAfterFirstUnlock` for background refresh support. Build the onboarding wizard using a horizontal ScrollView with disabled user interaction and programmatic navigation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Multi-step wizard with one screen per step (username -> photo -> car) and progress indicator with back navigation
- **D-02:** Profile photo is optional -- can be skipped and added later from Profile settings
- **D-03:** Username and car are required -- user cannot access app without completing these
- **D-04:** Use NHTSA vPIC API for year/make/model cascading pickers -- free, zero maintenance, good US coverage
- **D-05:** Include "Other / Custom" option at end of any picker for cars not in database (JDM imports, kit cars, rare specs)
- **D-06:** Add a display name field for how the car appears on map/profile (e.g., "R32 GT-R", "Panda AE86") -- decouples database identity from enthusiast identity
- **D-07:** Future car verification system noted as deferred idea to prevent false claims
- **D-08:** Stay signed in indefinitely until explicit sign-out or token expiry (30 days per backend config)
- **D-09:** Silent token refresh when app resumes -- show map immediately, no loading state. Handle auth failures only if refresh actually fails.
- **D-10:** Inline username validation -- check availability as user types (debounced), show green checkmark or red X before Continue
- **D-11:** Auth failures (network, cancel, outage) show toast message + stay on sign-in screen for immediate retry
- **D-12:** Photo upload failures show both retry option and "Skip for now" button so user isn't stuck

### Claude's Discretion
- Onboarding step transitions (slide vs crossfade) -- pick appropriate SwiftUI transitions based on platform conventions
- Car photo requirement -- decide based on "< 2 minutes" onboarding goal from PRD

### Deferred Ideas (OUT OF SCOPE)
- **Car verification system** -- Prevent false claims (e.g., display name "Bugatti" on a Sentra). Flag mismatches between structured data and display name. Future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign in with Apple (native AuthenticationServices) | SignInWithAppleButton SwiftUI component, ASAuthorizationAppleIDCredential handling documented |
| AUTH-02 | App exchanges Apple identity token for backend JWT (access + refresh) | Backend needs POST /auth/apple endpoint; identity token is JWT, validation via Apple JWKS |
| AUTH-03 | App stores tokens securely in Keychain and refreshes automatically | Keychain Services with kSecClassGenericPassword, background-compatible accessibility |
| ONBOARD-01 | New user creates username (unique handle) | Debounced validation pattern, backend username uniqueness check via GET /users/search |
| ONBOARD-02 | New user uploads profile photo (camera or library) | PhotosPicker (library) + UIImagePickerController (camera) pattern; photo is optional per D-02 |
| ONBOARD-03 | New user adds first car (year, make, model, trim, color, photo) | NHTSA vPIC API endpoints documented, cascading picker pattern, display name field |
| ONBOARD-04 | User cannot access app until at least one car exists in garage | Backend POST /cars auto-activates first car; app state guards map access |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sign in with Apple UI | Browser/Client (iOS) | -- | Native OS-level authentication flow |
| Apple token validation | API/Backend | -- | Server-side JWT verification against Apple JWKS |
| JWT token storage | Browser/Client (iOS) | -- | Keychain is device-local secure storage |
| Token refresh logic | API/Backend | Browser/Client (iOS) | Backend issues tokens; client manages refresh timing |
| Username availability check | API/Backend | -- | Database query requires server |
| Vehicle data (NHTSA) | Browser/Client (iOS) | -- | Direct API calls from client; no backend proxy needed |
| Profile photo upload | CDN/Static (R2) | API/Backend | Presigned URL from backend, direct upload to R2 |
| Onboarding UI | Browser/Client (iOS) | -- | Pure client-side view layer |
| User/Car creation | API/Backend | Database/Storage | RESTful endpoints with Postgres persistence |

## Standard Stack

### Core (Native Apple Frameworks)
| Framework | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| AuthenticationServices | iOS 17+ | Sign in with Apple authentication flow | Apple's official framework, required for Apple auth |
| Security (Keychain Services) | iOS 17+ | Secure token storage | OS-level encrypted storage, only secure option for credentials |
| PhotosUI | iOS 17+ | Photo library picker | Native PhotosPicker component, no third-party needed |
| UIKit (UIImagePickerController) | iOS 17+ | Camera capture | PhotosPicker doesn't support camera; UIKit bridge required |
| Combine | iOS 17+ | Debounced input validation | Built-in reactive framework for async validation |

### Supporting (External APIs)
| API | Endpoint Base | Purpose | When to Use |
|-----|---------------|---------|-------------|
| NHTSA vPIC | https://vpic.nhtsa.dot.gov/api/ | Vehicle year/make/model data | Car entry in onboarding and garage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keychain Services | UserDefaults | UserDefaults is NOT secure -- never store tokens there |
| Combine debounce | AsyncAlgorithms debounce | AsyncAlgorithms requires package dependency; Combine is built-in |
| NHTSA vPIC | CarQuery API | CarQuery has reliability issues and less US coverage |

**Installation:** No external packages required. All frameworks are part of iOS SDK.

**Version verification:** All frameworks verified as part of iOS 17+ SDK (minimum iOS version for this project). [VERIFIED: iOS SDK documentation]

## Package Legitimacy Audit

> This phase uses only Apple's native iOS frameworks (AuthenticationServices, Security, PhotosUI, Combine). No external npm/pip/cargo packages are installed.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | -- | -- | -- | -- | -- | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No external packages to verify. All code uses Apple's first-party frameworks.*

## Architecture Patterns

### System Architecture Diagram

```
                                 iOS App (SwiftUI)
                                        |
        +---------------+---------------+---------------+
        |               |               |               |
   [Sign In]      [Onboarding]    [API Client]    [Keychain]
        |               |               |               |
        v               v               v               v
+---------------+ +---------------+ +---------------+ +---------------+
|   Apple ID    | | NHTSA vPIC    | |   FastAPI     | | iOS Keychain  |
|   Servers     | |   API         | |   Backend     | | (Encrypted)   |
+---------------+ +---------------+ +---------------+ +---------------+
        |                               |
        |  identity_token               |  access_token + refresh_token
        +-------------> Backend /auth/apple <------------+
                               |
                               v
                        +---------------+
                        |  PostgreSQL   |
                        |  (users, cars)|
                        +---------------+
```

**Data Flow - Sign In:**
1. User taps "Sign in with Apple" button
2. iOS presents Apple auth sheet (Face ID/password)
3. On success, app receives `ASAuthorizationAppleIDCredential` with identity token
4. App sends identity token to `POST /auth/apple`
5. Backend validates token against Apple JWKS, creates/finds user
6. Backend returns access_token + refresh_token + is_new_user flag
7. App stores tokens in Keychain
8. If is_new_user, app navigates to onboarding; else to map

**Data Flow - Onboarding:**
1. Username step: User types, app debounces 500ms, checks availability via API
2. Photo step: User picks from library (PhotosPicker) or camera (UIImagePickerController)
3. Car step: User selects year -> fetches makes -> selects make -> fetches models -> selects model
4. On complete: App calls `POST /cars` to create car, then navigates to map

### Recommended Project Structure
```
SlipStream/
├── Services/
│   ├── AuthService.swift        # Sign in with Apple + token management
│   ├── KeychainService.swift    # Secure token storage
│   ├── APIClient.swift          # Backend HTTP client
│   └── VehicleDataService.swift # NHTSA vPIC API client
├── Auth/
│   ├── SignInView.swift         # Sign in with Apple UI
│   └── AuthState.swift          # Authentication state management
├── Onboarding/
│   ├── OnboardingContainer.swift # Horizontal ScrollView container
│   ├── UsernameStep.swift       # Username entry + validation
│   ├── PhotoStep.swift          # Profile photo capture
│   └── CarStep.swift            # Vehicle entry with NHTSA pickers
├── Models/
│   └── AuthModels.swift         # Token, credential, API response models
└── (existing files...)
```

### Pattern 1: Sign in with Apple Flow
**What:** Native SwiftUI button that triggers Apple authentication
**When to use:** Initial app launch when user is not authenticated
**Example:**
```swift
// Source: Apple Developer Documentation + createwithswift.com
import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject var authState: AuthState
    
    var body: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                handleAuthorization(authorization)
            case .failure(let error):
                handleError(error)
            }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 50)
    }
    
    private func handleAuthorization(_ authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            return
        }
        
        // CRITICAL: Apple only provides fullName and email on FIRST sign-in
        // Must capture and send to backend immediately
        let fullName = credential.fullName
        let email = credential.email
        
        Task {
            await authState.signInWithApple(
                identityToken: identityToken,
                fullName: fullName,
                email: email
            )
        }
    }
}
```

### Pattern 2: Keychain Token Storage
**What:** Secure storage for JWT access and refresh tokens
**When to use:** After receiving tokens from backend, and when retrieving for API calls
**Example:**
```swift
// Source: Apple Keychain Services documentation
import Security

final class KeychainService {
    private let service = "com.slipstream.auth"
    
    func saveToken(_ token: String, account: String) -> Bool {
        let tokenData = Data(token.utf8)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: tokenData,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        
        // Delete existing before adding
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func retrieveToken(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        
        return String(data: data, encoding: .utf8)
    }
    
    func deleteToken(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

### Pattern 3: Debounced Username Validation
**What:** Check username availability after user stops typing for 500ms
**When to use:** Username entry step in onboarding
**Example:**
```swift
// Source: devtechie.com Combine validation pattern
import Combine
import SwiftUI

@MainActor
final class UsernameStepViewModel: ObservableObject {
    @Published var username = ""
    @Published var isAvailable: Bool?
    @Published var isChecking = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    private let apiClient: APIClient
    
    init(apiClient: APIClient) {
        self.apiClient = apiClient
        setupValidation()
    }
    
    private func setupValidation() {
        $username
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .removeDuplicates()
            .filter { $0.count >= 3 }
            .sink { [weak self] username in
                Task { await self?.checkAvailability(username) }
            }
            .store(in: &cancellables)
    }
    
    private func checkAvailability(_ username: String) async {
        isChecking = true
        defer { isChecking = false }
        
        do {
            let results = try await apiClient.searchUsers(query: username)
            // If exact match found, username is taken
            isAvailable = !results.contains { $0.username.lowercased() == username.lowercased() }
        } catch {
            errorMessage = "Could not check availability"
            isAvailable = nil
        }
    }
}
```

### Pattern 4: Horizontal ScrollView Onboarding (iOS 18+)
**What:** Multi-step wizard with programmatic navigation
**When to use:** Onboarding flow container
**Example:**
```swift
// Source: riveralabs.com iOS 18+ onboarding pattern
import SwiftUI

enum OnboardingPage: String, Identifiable, CaseIterable {
    case username, photo, car
    var id: String { rawValue }
}

struct OnboardingContainer: View {
    @Binding var isOnboardingVisible: Bool
    @State private var position = ScrollPosition(idType: OnboardingPage.ID.self)
    @State private var currentPage: OnboardingPage = .username
    
    var body: some View {
        VStack(spacing: 0) {
            // Progress indicator
            ProgressIndicator(current: currentPage, pages: OnboardingPage.allCases)
                .padding(.top, 16)
            
            ScrollView(.horizontal) {
                HStack(spacing: 0) {
                    ForEach(OnboardingPage.allCases) { page in
                        pageView(for: page)
                            .containerRelativeFrame([.horizontal, .vertical])
                    }
                }
                .scrollTargetLayout()
            }
            .scrollPosition($position)
            .scrollTargetBehavior(.viewAligned)
            .scrollIndicators(.hidden)
            .scrollDisabled(true) // Programmatic navigation only
        }
        .onAppear {
            position.scrollTo(id: OnboardingPage.username.id)
        }
    }
    
    @ViewBuilder
    private func pageView(for page: OnboardingPage) -> some View {
        switch page {
        case .username:
            UsernameStep(onNext: { goToPage(.photo) }, onBack: nil)
        case .photo:
            PhotoStep(onNext: { goToPage(.car) }, onBack: { goToPage(.username) })
        case .car:
            CarStep(onComplete: completeOnboarding, onBack: { goToPage(.photo) })
        }
    }
    
    private func goToPage(_ page: OnboardingPage) {
        withAnimation(.easeInOut(duration: 0.3)) {
            currentPage = page
            position.scrollTo(id: page.id)
        }
    }
    
    private func completeOnboarding() {
        withAnimation {
            isOnboardingVisible = false
        }
    }
}
```

### Pattern 5: NHTSA vPIC Cascading Pickers
**What:** Year -> Make -> Model cascading selection using NHTSA API
**When to use:** Car entry step
**Example:**
```swift
// Source: NHTSA vPIC API documentation
import Foundation

struct VehicleDataService {
    private let baseURL = "https://vpic.nhtsa.dot.gov/api/vehicles"
    
    // Note: vPIC has no "get all years" endpoint - generate client-side
    func getYears() -> [Int] {
        let currentYear = Calendar.current.component(.year, from: Date())
        return Array((1990...(currentYear + 1)).reversed())
    }
    
    func getMakes(for year: Int) async throws -> [VehicleMake] {
        let url = URL(string: "\(baseURL)/GetMakesForVehicleType/car?format=json")!
        let (data, _) = try await URLSession.shared.data(from: url)
        let response = try JSONDecoder().decode(NHTSAMakesResponse.self, from: data)
        return response.Results.sorted { $0.MakeName < $1.MakeName }
    }
    
    func getModels(make: String, year: Int) async throws -> [VehicleModel] {
        let encodedMake = make.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? make
        let url = URL(string: "\(baseURL)/GetModelsForMakeYear/make/\(encodedMake)/modelyear/\(year)?format=json")!
        let (data, _) = try await URLSession.shared.data(from: url)
        let response = try JSONDecoder().decode(NHTSAModelsResponse.self, from: data)
        return response.Results.sorted { $0.Model_Name < $1.Model_Name }
    }
}

// Response models
struct NHTSAMakesResponse: Codable {
    let Count: Int
    let Results: [VehicleMake]
}

struct VehicleMake: Codable, Identifiable {
    let MakeId: Int
    let MakeName: String
    var id: Int { MakeId }
}

struct NHTSAModelsResponse: Codable {
    let Count: Int
    let Results: [VehicleModel]
}

struct VehicleModel: Codable, Identifiable {
    let Make_ID: Int
    let Make_Name: String
    let Model_ID: Int
    let Model_Name: String
    var id: Int { Model_ID }
}
```

### Anti-Patterns to Avoid
- **Storing tokens in UserDefaults:** UserDefaults is NOT encrypted. Always use Keychain for credentials.
- **Hardcoding Apple private key in app:** Apple Sign In validation must happen server-side.
- **Using TabView for onboarding:** Users can swipe freely, breaking forward-only progression.
- **Not handling "email only on first sign-in":** Apple only provides email/name on first authorization. Must capture immediately.
- **Blocking UI on token refresh:** Use background refresh; show stale data rather than loading spinner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Apple authentication | Custom OAuth flow | AuthenticationServices framework | Apple rejects apps with non-native Apple auth |
| Secure token storage | Encrypted file, UserDefaults | Keychain Services | Hardware-backed encryption, OS-managed |
| Photo picker | Custom PHAsset browser | PhotosUI.PhotosPicker | Native UI, handles permissions, no library access needed |
| Camera capture | AVFoundation custom camera | UIImagePickerController | Simple use case doesn't need custom camera |
| JWT decoding | Manual Base64 parsing | Swift JWT library (if needed) | Edge cases in JWT spec are tricky |

**Key insight:** iOS provides first-party frameworks for all auth and media needs. Third-party libraries add bundle size and security audit burden without benefit.

## Common Pitfalls

### Pitfall 1: Apple Only Provides User Info Once
**What goes wrong:** Email and full name are nil on subsequent sign-ins
**Why it happens:** Apple only sends user info on FIRST authorization, not subsequent ones
**How to avoid:** Capture and send email/name to backend immediately on first sign-in; backend stores them
**Warning signs:** User profile shows no email/name after successful sign-in

### Pitfall 2: Keychain Items Not Found After App Update
**What goes wrong:** Tokens seem to vanish after app update
**Why it happens:** Wrong accessibility attribute or missing entitlements
**How to avoid:** Use `kSecAttrAccessibleAfterFirstUnlock` for background access; verify Keychain Sharing entitlement if needed
**Warning signs:** Token retrieval fails with `errSecItemNotFound` after app reinstall

### Pitfall 3: NHTSA API Returns All Vehicle Types
**What goes wrong:** Picker shows motorcycles, trucks, ATVs mixed with cars
**Why it happens:** GetModelsForMakeYear returns ALL vehicle types for that make/year
**How to avoid:** Either filter client-side by vehicle type, or use GetMakesForVehicleType/car to get car-only makes
**Warning signs:** User sees "Gold Wing" or "CRF450R" when selecting Honda models

### Pitfall 4: Token Refresh Race Condition
**What goes wrong:** Multiple simultaneous API calls each try to refresh token
**Why it happens:** No lock/serialization on refresh operation
**How to avoid:** Use actor-based auth service or AsyncStream to serialize refresh requests
**Warning signs:** User gets logged out randomly; multiple refresh tokens created

### Pitfall 5: Username Validation Shows Stale State
**What goes wrong:** Green checkmark shown for taken username
**Why it happens:** User typed more characters after availability check started
**How to avoid:** Cancel pending check when input changes; verify final username matches checked value before enabling Continue
**Warning signs:** "Username taken" error on submit despite green checkmark

## Code Examples

Verified patterns from official sources:

### Photo Picker with Camera Option
```swift
// Source: Apple PhotosUI documentation + alfredorastello Medium article
import SwiftUI
import PhotosUI

struct PhotoStep: View {
    @State private var showActionSheet = false
    @State private var showPhotoPicker = false
    @State private var showCamera = false
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    
    var onNext: () -> Void
    var onBack: (() -> Void)?
    
    var body: some View {
        VStack(spacing: 24) {
            // Photo preview or placeholder
            if let image = selectedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 120, height: 120)
                    .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color(.secondarySystemBackground))
                    .frame(width: 120, height: 120)
                    .overlay(Image(systemName: "person.fill").font(.largeTitle))
            }
            
            Button("Add Photo") {
                showActionSheet = true
            }
            .confirmationDialog("Choose Photo Source", isPresented: $showActionSheet) {
                Button("Camera") { showCamera = true }
                Button("Photo Library") { showPhotoPicker = true }
                Button("Cancel", role: .cancel) { }
            }
            
            Spacer()
            
            // Skip or Continue
            HStack(spacing: 16) {
                Button("Skip") { onNext() }
                    .foregroundStyle(.secondary)
                Button("Continue") { onNext() }
                    .disabled(false) // Photo is optional
            }
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $selectedItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            CameraView(image: $selectedImage)
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    selectedImage = uiImage
                }
            }
        }
    }
}

// UIViewControllerRepresentable for camera
struct CameraView: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView
        init(_ parent: CameraView) { self.parent = parent }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
```

### Backend Apple Auth Endpoint (Reference)
```python
# Source: Backend architecture document Section 3 + Apple token validation docs
# This endpoint needs to be added to backend/src/backend/routers/auth.py

@router.post("/apple", response_model=AppleAuthResponse)
async def auth_with_apple(
    body: AppleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> AppleAuthResponse:
    """Exchange Apple identity token for SlipStream tokens."""
    # 1. Fetch Apple's public keys
    # 2. Decode and verify identity token JWT
    # 3. Extract 'sub' (Apple user ID), email, name from token
    # 4. Find or create user by apple_id
    # 5. Issue access + refresh tokens
    # 6. Return tokens + is_new_user flag
    pass
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UIKit ASAuthorizationController | SwiftUI SignInWithAppleButton | iOS 14 (2020) | Native SwiftUI component, no UIViewRepresentable needed |
| PHPickerViewController wrapper | PhotosUI.PhotosPicker | iOS 16 (2022) | Pure SwiftUI, no UIKit bridging |
| TabView for onboarding | ScrollView with ScrollPosition | iOS 18 (2024) | Programmatic navigation, disables free swiping |
| UserDefaults for "simple" storage | Keychain for ALL credentials | Always | Security requirement, not preference |

**Deprecated/outdated:**
- `ASAuthorizationAppleIDButton` UIKit wrapper: Use `SignInWithAppleButton` SwiftUI component directly
- `PHPickerViewController` UIViewControllerRepresentable: Use `PhotosPicker` SwiftUI component
- Combine-only async patterns: Can use async/await with Swift concurrency

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this
> section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NHTSA vPIC API has no rate limit that would affect typical app usage | Standard Stack | May need caching/throttling if rate limited |
| A2 | Backend /auth/apple endpoint will follow documented flow from BACKEND_ARCHITECTURE.md | Architecture Patterns | Endpoint may need different contract |
| A3 | Cloudflare R2 presigned URLs will be used for photo upload (per backend docs) | Architecture Patterns | May need different upload strategy |

## Open Questions

1. **Username availability endpoint**
   - What we know: Backend has GET /users/search for prefix matching
   - What's unclear: Should we add a dedicated GET /users/check-username endpoint for exact match?
   - Recommendation: Use existing search endpoint; if exact match found, username is taken

2. **Backend /auth/apple endpoint status**
   - What we know: Endpoint is documented in BACKEND_ARCHITECTURE.md but may not exist yet
   - What's unclear: Is this endpoint implemented?
   - Recommendation: Plan should include backend task to create endpoint if missing

3. **Photo upload during onboarding**
   - What we know: PRD says "< 2 minutes" onboarding goal; backend supports R2 presigned URLs
   - What's unclear: Should car photo be required or optional during onboarding?
   - Recommendation: Make car photo optional during onboarding (can add later in Garage); profile photo already optional per D-02

## Environment Availability

> This phase is iOS development -- external tool availability varies by machine.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Xcode | iOS development | Unknown (dev on Windows) | Requires 26.3+ | Cannot build iOS without Xcode |
| macOS | Xcode requirement | Unknown | -- | Cannot build iOS without macOS |
| iOS Simulator | Testing | Unknown | Bundled with Xcode | Physical device |
| Apple Developer Account | Sign in with Apple | Assumed yes | -- | Cannot test Apple auth without account |

**Missing dependencies with no fallback:**
- Xcode and macOS are required for iOS development. STATE.md notes dev is on Windows laptop.

**Missing dependencies with fallback:**
- None. iOS development requires macOS.

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md apply to this phase:

1. **Platform**: iOS-only (SwiftUI, minimum iOS 17)
2. **Auth**: Sign in with Apple required (only auth method for MVP)
3. **Backend**: Existing FastAPI server -- don't modify unless iOS needs new endpoints (need /auth/apple)
4. **Battery**: Location updates must be battery-efficient (not directly relevant to this phase)
5. **Safety**: Driving mode must be glanceable (not directly relevant to this phase)

Naming conventions:
- PascalCase for structs/classes: `AuthService`, `KeychainService`, `OnboardingContainer`
- camelCase for variables: `isAuthenticated`, `currentUser`, `selectedImage`
- Boolean prefixes: `is`/`has` -- `isAvailable`, `isNewUser`, `hasValidToken`

Existing patterns to follow:
- `@MainActor` for view models
- `@EnvironmentObject` for shared state (SlipStreamViewModel)
- SlipStreamStyle for colors and components

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Sign in with Apple (native framework) |
| V3 Session Management | yes | JWT with refresh token rotation |
| V4 Access Control | no | Not applicable to onboarding |
| V5 Input Validation | yes | Pydantic on backend, client-side validation |
| V6 Cryptography | yes | Keychain (OS-managed), never hand-roll |

### Known Threat Patterns for iOS Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token theft from storage | Information Disclosure | Keychain with kSecAttrAccessibleAfterFirstUnlock |
| Token interception in transit | Information Disclosure | HTTPS only, certificate pinning optional |
| Replay attacks | Spoofing | JWT expiration (15 min access token) |
| Brute force username | Denial of Service | Backend rate limiting |
| Credential stuffing | Spoofing | Apple auth only -- no passwords |

## Sources

### Primary (HIGH confidence)
- Apple Developer Documentation: AuthenticationServices framework, Keychain Services, PhotosUI [CITED: developer.apple.com]
- NHTSA vPIC API documentation [CITED: vpic.nhtsa.dot.gov/api]
- Project BACKEND_ARCHITECTURE.md Section 3 [CITED: docs/BACKEND_ARCHITECTURE.md]
- Existing backend routers: auth.py, users.py, cars.py [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- createwithswift.com Sign in with Apple tutorial [CITED: createwithswift.com]
- Rivera Labs iOS 18 onboarding pattern [CITED: riveralabs.com/blog/swiftui-onboarding]
- Alfredo Rastello camera/gallery pattern [CITED: medium.com/@alfredorastello_12120]
- devtechie.com Combine validation pattern [CITED: devtechie.com]

### Tertiary (LOW confidence)
- None. All claims verified against official documentation or authoritative tutorials.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Apple's native frameworks are well-documented and stable
- Architecture: HIGH - Patterns from official docs and established iOS conventions
- NHTSA API: HIGH - Live API testing confirmed endpoint structures
- Pitfalls: HIGH - Based on known iOS development gotchas and Apple documentation

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days - stable frameworks, unlikely to change)
