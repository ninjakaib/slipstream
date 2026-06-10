//
//  ContentView.swift
//  SlipStream
//
//  Created by Kai Breese on 5/28/26.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = SlipStreamViewModel()
    @StateObject private var authState = AuthState()

    var body: some View {
        Group {
            switch authState.state {
            case .loading:
                // Loading state with dark background
                ZStack {
                    SlipStreamStyle.panel
                        .ignoresSafeArea()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(1.2)
                }

            case .unauthenticated:
                WelcomeView()

            case .onboarding:
                // Placeholder for onboarding (implemented in next plan)
                ZStack {
                    SlipStreamStyle.panel
                        .ignoresSafeArea()
                    VStack(spacing: 16) {
                        Text("Welcome to SlipStream!")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("Onboarding coming soon...")
                            .foregroundStyle(SlipStreamStyle.muted)

                        // Temporary skip button for testing
                        Button("Skip to App") {
                            authState.completeOnboarding()
                        }
                        .foregroundStyle(SlipStreamStyle.accent)
                        .padding(.top, 24)
                    }
                }

            case .authenticated:
                AppRootView()
            }
        }
        .environmentObject(viewModel)
        .environmentObject(authState)
    }
}

#Preview {
    ContentView()
}
