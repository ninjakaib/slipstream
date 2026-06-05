//
//  CreateConvoyView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct CreateConvoyView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name = "Sunset Canyon Cruise"
    @State private var destination = "Angeles Crest overlook"
    @State private var meetingPoint = "Griffith lower lot"
    @State private var vibe: ConvoyVibe = .canyon
    @State private var isPublic = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Start Convoy")
                            .font(.system(size: 34, weight: .black))
                        Text("Create a temporary driving lobby that shows up on the live map.")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(SlipStreamStyle.muted)
                    }

                    formPanel

                    PrimaryActionButton(title: "Go Live", systemImage: "point.3.connected.trianglepath.dotted") {
                        viewModel.createConvoy(
                            name: name,
                            destination: destination,
                            meetingPoint: meetingPoint,
                            vibe: vibe,
                            isPublic: isPublic
                        )
                        dismiss()
                    }
                }
                .padding(16)
            }
            .background(SlipStreamStyle.panel.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var formPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            SlipTextField(title: "Name", text: $name, icon: "textformat")
            SlipTextField(title: "Meeting Point", text: $meetingPoint, icon: "mappin.circle.fill")
            SlipTextField(title: "Destination", text: $destination, icon: "flag.checkered.circle.fill")

            VStack(alignment: .leading, spacing: 9) {
                SectionLabel("Vibe")
                Picker("Vibe", selection: $vibe) {
                    ForEach(ConvoyVibe.allCases) { vibe in
                        Text(vibe.rawValue).tag(vibe)
                    }
                }
                .pickerStyle(.segmented)
            }

            Toggle(isOn: $isPublic) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Public convoy")
                        .font(.system(size: 15, weight: .bold))
                    Text(isPublic ? "Anyone nearby can join." : "Only invited drivers can join.")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }
            }
            .tint(SlipStreamStyle.accent)
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct SlipTextField: View {
    var title: String
    @Binding var text: String
    var icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(title)
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .foregroundStyle(SlipStreamStyle.accent)
                    .frame(width: 24)
                TextField(title, text: $text)
                    .font(.system(size: 15, weight: .semibold))
            }
            .padding(.horizontal, 12)
            .frame(height: 48)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }
}
