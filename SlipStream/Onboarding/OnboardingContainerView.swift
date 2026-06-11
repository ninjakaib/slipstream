//
//  OnboardingContainerView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import SwiftUI

/// Form data for car entry in onboarding
struct CarFormData {
    var year: Int?
    var make: String?
    var model: String?
    var trim: String?
    var color: String?
    var displayName: String?
}

/// Onboarding wizard pages
enum OnboardingPage: String, Identifiable, CaseIterable {
    case username
    case photo
    case car

    var id: String { rawValue }
}

/// Request body for PATCH /users/me endpoint.
struct UpdateProfileRequest: Encodable {
    let username: String?
    let display_name: String?
    let avatar_url: String?

    init(username: String? = nil, displayName: String? = nil, avatarUrl: String? = nil) {
        self.username = username
        self.display_name = displayName
        self.avatar_url = avatarUrl
    }
}

/// Response from /users/me endpoint.
struct UserProfileResponse: Decodable {
    let id: String
    let username: String
    let email: String?
    let display_name: String?
    let avatar_url: String?
    let visibility: String
    let discovery_radius_miles: Int
    let speed_unit: String
}

/// Multi-step onboarding wizard container.
///
/// Uses a horizontal ScrollView with programmatic navigation (per D-01).
/// Progress indicator visible at top, shows 3 steps.
/// User cannot swipe to navigate - only Continue/Back buttons control flow.
struct OnboardingContainerView: View {
    @EnvironmentObject var authState: AuthState

    // MARK: - State

    @State private var position = ScrollPosition(idType: OnboardingPage.ID.self)
    @State private var currentPage: OnboardingPage = .username

    // Collected data
    @State private var username: String = ""
    @State private var profileImage: UIImage? = nil
    @State private var carData: CarFormData? = nil

    // Toast state
    @State private var showToast = false
    @State private var toastMessage = ""
    @State private var toastStyle: ToastStyle = .error

    // Submission state
    @State private var isSubmitting = false

    // API client
    private let apiClient = APIClient()

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Progress indicator at top
            OnboardingProgressView(current: currentPage, pages: OnboardingPage.allCases)
                .padding(.top, 16)

            // Horizontal scrolling pages
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
            .scrollDisabled(true) // Programmatic navigation only per D-01
        }
        .background(SlipStreamStyle.panel)
        .onAppear {
            position.scrollTo(id: OnboardingPage.username.id)
        }
        .toast(isPresented: $showToast, message: toastMessage, style: toastStyle)
    }

    // MARK: - Page Views

    @ViewBuilder
    private func pageView(for page: OnboardingPage) -> some View {
        switch page {
        case .username:
            UsernameStepView(
                username: $username,
                onNext: { goToPage(.photo) },
                onBack: nil
            )

        case .photo:
            PhotoStepView(
                profileImage: $profileImage,
                onNext: { goToPage(.car) },
                onBack: { goToPage(.username) }
            )

        case .car:
            CarStepView(
                onComplete: {
                    Task {
                        await finishOnboarding()
                    }
                },
                onBack: { goToPage(.photo) }
            )
        }
    }

    // MARK: - Navigation

    /// Navigate to a specific page with animation.
    /// Per UI-SPEC: 300ms easeInOut for page transitions.
    func goToPage(_ page: OnboardingPage) {
        withAnimation(.easeInOut(duration: 0.3)) {
            currentPage = page
            position.scrollTo(id: page.id)
        }
    }

    /// Save username to backend via PATCH /users/me.
    ///
    /// Called during onboarding completion to persist username.
    func saveUsername() async throws {
        let request = UpdateProfileRequest(username: username)
        let _: UserProfileResponse = try await apiClient.request(
            "/users/me",
            method: "PATCH",
            body: request,
            authenticated: true
        )
    }

    /// Finish onboarding: save username then transition to authenticated.
    ///
    /// Car creation happens in CarStepView before this is called.
    /// Per D-09: Errors show toast, allow retry.
    func finishOnboarding() async {
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            // Save username to backend
            try await saveUsername()

            // Transition to authenticated state
            await MainActor.run {
                authState.completeOnboarding()
            }
        } catch {
            // Show error toast, stay on screen for retry
            await MainActor.run {
                toastMessage = "Failed to save profile. Please try again."
                toastStyle = .error
                showToast = true
            }
        }
    }
}

#Preview {
    OnboardingContainerView()
        .environmentObject(AuthState())
}
