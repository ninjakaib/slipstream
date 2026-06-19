//
//  MapSelectionSheet.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

struct MapSelectionSheet: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    var selection: MapSelection
    var onClose: () -> Void
    var onOpenConvoy: (Convoy) -> Void

    var body: some View {
        VStack(spacing: 14) {
            Capsule()
                .fill(Color.white.opacity(0.22))
                .frame(width: 42, height: 4)

            switch selection {
            case .driver(let driver):
                driverContent(driver)
            case .convoy(let convoy):
                convoyContent(convoy)
            case .meetup(let meetup):
                meetupContent(meetup)
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(SlipStreamStyle.line, lineWidth: 1)
        )
    }

    private func driverContent(_ driver: Driver) -> some View {
        VStack(spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VehicleAvatar(vehicle: driver.vehicle, initials: driver.avatarInitials, size: 58)

                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        Text(driver.username)
                            .font(.system(size: 22, weight: .black))
                        Spacer()
                        Button(action: onClose) {
                            Image(systemName: "xmark")
                                .font(.system(size: 13, weight: .black))
                                .foregroundStyle(.white.opacity(0.74))
                                .frame(width: 30, height: 30)
                                .background(Color.white.opacity(0.12), in: Circle())
                        }
                        .buttonStyle(.plain)
                    }

                    Text(driver.vehicle.displayName + " " + driver.vehicle.trim)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)

                    HStack {
                        StatusPill(status: driver.status)
                        Text(driver.distanceDescription)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(SlipStreamStyle.muted)
                    }
                }
            }

            HStack(spacing: 8) {
                ForEach(driver.interests, id: \.self) { interest in
                    Text(interest)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 7)
                        .background(Color.white.opacity(0.1), in: Capsule())
                }
                Spacer()
            }

            HStack(spacing: 10) {
                SecondaryActionButton(title: "Message", systemImage: "message.fill") {}
                PrimaryActionButton(title: "Invite", systemImage: "plus") {}
            }
        }
    }

    private func convoyContent(_ convoy: Convoy) -> some View {
        VStack(spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(convoy.name)
                        .font(.system(size: 22, weight: .black))
                    Text("\(convoy.vibe.rawValue)  |  \(convoy.etaDescription)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(SlipStreamStyle.accent)
                    Text("\(convoy.meetingPoint) to \(convoy.destination)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(.white.opacity(0.74))
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 10) {
                metric("\(convoy.memberIDs.count)", "Drivers")
                metric(convoy.isPublic ? "Open" : "Invite", "Access")
                metric("Text", "Comms")
            }

            HStack(spacing: 10) {
                SecondaryActionButton(title: "Details", systemImage: "list.bullet") {
                    onOpenConvoy(convoy)
                }
                PrimaryActionButton(title: convoy.id == viewModel.joinedConvoyID ? "Open Lobby" : "Join Convoy", systemImage: "point.3.connected.trianglepath.dotted") {
                    if convoy.id != viewModel.joinedConvoyID {
                        viewModel.join(convoy)
                    }
                    onOpenConvoy(convoy)
                }
            }
        }
    }

    private func meetupContent(_ meetup: MeetupSpot) -> some View {
        VStack(spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(meetup.name)
                        .font(.system(size: 22, weight: .black))
                    Text(meetup.subtitle)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(.white.opacity(0.74))
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 10) {
                metric("\(meetup.activeCount)", "Active")
                metric("Now", "Status")
                metric("Public", "Access")
            }

            HStack(spacing: 10) {
                SecondaryActionButton(title: "Message", systemImage: "message.fill") {}
                PrimaryActionButton(title: "Navigate", systemImage: "location.fill") {}
            }
        }
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.system(size: 17, weight: .black))
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(SlipStreamStyle.faint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
