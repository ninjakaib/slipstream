//
//  AppRootView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct AppRootView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @State private var showingProfile = false
    @State private var showingCreateConvoy = false
    @State private var showingPresence = false
    @State private var selectedConvoy: Convoy?

    var body: some View {
        NavigationStack {
            MapHomeView(
                showingProfile: $showingProfile,
                showingCreateConvoy: $showingCreateConvoy,
                showingPresence: $showingPresence,
                selectedConvoy: $selectedConvoy
            )
            .navigationDestination(item: $selectedConvoy) { convoy in
                ConvoyDetailView(convoy: convoy)
            }
            .sheet(isPresented: $showingProfile) {
                ProfileView()
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingCreateConvoy) {
                CreateConvoyView()
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingPresence) {
                PresenceSettingsView()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
        }
        .tint(SlipStreamStyle.accent)
        .preferredColorScheme(.dark)
    }
}
