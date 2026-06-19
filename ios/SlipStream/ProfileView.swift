//
//  ProfileView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    vehiclePanel
                    interestsPanel
                    privacyPanel
                }
                .padding(16)
            }
            .background(SlipStreamStyle.panel.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            VehicleAvatar(vehicle: viewModel.myVehicle, initials: "KB", size: 76)

            VStack(alignment: .leading, spacing: 7) {
                Text("kaibreese")
                    .font(.system(size: 30, weight: .black))
                StatusPill(status: viewModel.myStatus)
            }

            Spacer()
        }
    }

    private var vehiclePanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Garage", value: "Primary")

            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(viewModel.myVehicle.color.gradient)
                    .frame(width: 92, height: 68)
                    .overlay {
                        Image(systemName: "car.side.fill")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundStyle(.white)
                    }

                VStack(alignment: .leading, spacing: 4) {
                    Text(viewModel.myVehicle.displayName)
                        .font(.system(size: 19, weight: .black))
                    Text(viewModel.myVehicle.trim)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }

                Spacer()
            }

            Divider().overlay(SlipStreamStyle.line)

            VStack(alignment: .leading, spacing: 9) {
                Text("MODS")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(SlipStreamStyle.faint)

                FlowLayout(items: viewModel.myVehicle.mods)
            }
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private var interestsPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Driving Interests")
            FlowLayout(items: ["Canyons", "Cars & Coffee", "Night cruises", "Track days"])
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private var privacyPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Map Privacy")
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(viewModel.visibility.rawValue)
                        .font(.system(size: 17, weight: .black))
                    Text("This is mocked for the frontend MVP, but the control belongs here.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }
                Spacer()
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(SlipStreamStyle.accent)
            }
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct FlowLayout: View {
    var items: [String]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 108), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
    }
}
