//
//  ConvoyDetailView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct ConvoyDetailView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    var convoy: Convoy

    private var members: [Driver] {
        viewModel.drivers.filter { convoy.memberIDs.contains($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                routePanel
                membersPanel
                ConvoyChatView(convoy: convoy)
            }
            .padding(16)
        }
        .background(SlipStreamStyle.panel.ignoresSafeArea())
        .navigationTitle("Convoy")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if convoy.id == viewModel.joinedConvoyID {
                    Button("Leave") {
                        viewModel.leaveCurrentConvoy()
                    }
                    .foregroundStyle(.red)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(convoy.name)
                        .font(.system(size: 31, weight: .black))
                    Text(convoy.vibe.rawValue)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(SlipStreamStyle.accent)
                }
                Spacer()
                Text(convoy.isPublic ? "OPEN" : "INVITE")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(convoy.isPublic ? .green : .orange)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background((convoy.isPublic ? Color.green : Color.orange).opacity(0.14), in: Capsule())
            }

            HStack(spacing: 10) {
                if convoy.id == viewModel.joinedConvoyID {
                    SecondaryActionButton(title: "Joined", systemImage: "checkmark") {}
                } else {
                    PrimaryActionButton(title: "Join Convoy", systemImage: "point.3.connected.trianglepath.dotted") {
                        viewModel.join(convoy)
                    }
                }
                SecondaryActionButton(title: "Share", systemImage: "square.and.arrow.up") {}
            }
        }
    }

    private var routePanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Route", value: convoy.etaDescription)

            VStack(spacing: 10) {
                routeRow(icon: "mappin.circle.fill", title: "Meet", value: convoy.meetingPoint, color: .orange)
                Divider().overlay(SlipStreamStyle.line)
                routeRow(icon: "flag.checkered.circle.fill", title: "Destination", value: convoy.destination, color: SlipStreamStyle.accent)
            }
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private var membersPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Drivers", value: "\(members.count) live")

            ForEach(members) { driver in
                HStack(spacing: 12) {
                    VehicleAvatar(vehicle: driver.vehicle, initials: driver.avatarInitials, size: 42)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(driver.username)
                            .font(.system(size: 15, weight: .bold))
                        Text(driver.vehicle.displayName)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(SlipStreamStyle.muted)
                    }
                    Spacer()
                    StatusPill(status: driver.status)
                }
            }
        }
        .padding(14)
        .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func routeRow(icon: String, title: String, value: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(color)
                .frame(width: 34, height: 34)
                .background(color.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(SlipStreamStyle.faint)
                Text(value)
                    .font(.system(size: 15, weight: .bold))
            }
            Spacer()
        }
    }
}
