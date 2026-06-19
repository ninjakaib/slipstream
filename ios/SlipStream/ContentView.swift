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
                OnboardingContainerView()

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
