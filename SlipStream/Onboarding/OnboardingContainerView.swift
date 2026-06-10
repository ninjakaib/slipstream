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
            // Placeholder for photo step (implemented in Plan 03)
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "person.crop.circle.badge.plus")
                    .font(.system(size: 64))
                    .foregroundStyle(SlipStreamStyle.muted)
                Text("Photo Step")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Coming in Plan 03")
                    .foregroundStyle(SlipStreamStyle.muted)
                Spacer()

                // Navigation buttons
                HStack(spacing: 16) {
                    Button("Back") {
                        goToPage(.username)
                    }
                    .foregroundStyle(SlipStreamStyle.muted)

                    Button("Skip") {
                        goToPage(.car)
                    }
                    .foregroundStyle(SlipStreamStyle.accent)
                }
                .padding(.bottom, 32)
            }
            .frame(maxWidth: .infinity)

        case .car:
            // Placeholder for car step (implemented in Plan 03)
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "car.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(SlipStreamStyle.muted)
                Text("Car Step")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Coming in Plan 03")
                    .foregroundStyle(SlipStreamStyle.muted)
                Spacer()

                // Navigation buttons
                HStack(spacing: 16) {
                    Button("Back") {
                        goToPage(.photo)
                    }
                    .foregroundStyle(SlipStreamStyle.muted)

                    Button("Complete") {
                        completeOnboarding()
                    }
                    .foregroundStyle(SlipStreamStyle.accent)
                }
                .padding(.bottom, 32)
            }
            .frame(maxWidth: .infinity)
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

    /// Complete onboarding and transition to authenticated state.
    func completeOnboarding() {
        authState.completeOnboarding()
    }
}

#Preview {
    OnboardingContainerView()
        .environmentObject(AuthState())
}
