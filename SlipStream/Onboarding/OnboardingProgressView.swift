//
//  OnboardingProgressView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import SwiftUI

/// Progress indicator showing current step in onboarding wizard.
///
/// Displays 3 dots representing the onboarding steps.
/// Current step is highlighted with accent color.
/// Per UI-SPEC: 200ms spring animation on dot color change.
struct OnboardingProgressView: View {
    let current: OnboardingPage
    let pages: [OnboardingPage]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(pages) { page in
                Circle()
                    .fill(current == page ? SlipStreamStyle.accent : SlipStreamStyle.faint)
                    .frame(width: 8, height: 8)
                    .animation(.spring(duration: 0.2), value: current)
            }
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    VStack(spacing: 32) {
        OnboardingProgressView(
            current: .username,
            pages: OnboardingPage.allCases
        )
        OnboardingProgressView(
            current: .photo,
            pages: OnboardingPage.allCases
        )
        OnboardingProgressView(
            current: .car,
            pages: OnboardingPage.allCases
        )
    }
    .padding()
    .background(SlipStreamStyle.panel)
}
