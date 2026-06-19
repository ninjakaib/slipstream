//
//  PresenceSettingsView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct PresenceSettingsView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Presence")
                        .font(.system(size: 32, weight: .black))
                    Text("Control how you appear on the live map.")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("Status")
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(DriverStatus.allCases) { status in
                            Button {
                                viewModel.myStatus = status
                                if status == .offline {
                                    viewModel.visibility = .hidden
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: status.iconName)
                                    Text(status.rawValue)
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.75)
                                }
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(viewModel.myStatus == status ? .black : .white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(viewModel.myStatus == status ? status.tint : Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(14)
                .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("Location Sharing")
                    Picker("Visibility", selection: $viewModel.visibility) {
                        ForEach(VisibilityMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    Text(visibilityCopy)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }
                .padding(14)
                .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                Spacer()

                PrimaryActionButton(title: "Done", systemImage: "checkmark") {
                    dismiss()
                }
            }
            .padding(16)
            .background(SlipStreamStyle.panel.ignoresSafeArea())
        }
        .preferredColorScheme(.dark)
    }

    private var visibilityCopy: String {
        switch viewModel.visibility {
        case .exact: "Your precise position is visible while your status is active."
        case .approximate: "Nearby drivers see your general area, not your exact location."
        case .convoyOnly: "Only members of your active convoy can see your position."
        case .hidden: "You are hidden from the live map."
        }
    }
}
