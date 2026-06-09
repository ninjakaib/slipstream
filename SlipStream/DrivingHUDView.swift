//
//  DrivingHUDView.swift
//  SlipStream
//
//  Minimal, non-distracting overlay for driving mode.
//  Shows speed, road name, convoy members, and exit control.
//

import SwiftUI

struct DrivingHUDView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @Binding var selectedConvoy: Convoy?

    var body: some View {
        VStack(spacing: 0) {
            topBar
            Spacer()
            bottomBar
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 16)
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack(alignment: .top, spacing: 12) {
            // Road name + status indicator
            VStack(alignment: .leading, spacing: 4) {
                if !viewModel.currentRoadName.isEmpty {
                    Text(viewModel.currentRoadName)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.black.opacity(0.7), in: Capsule())
                }

                if let convoy = viewModel.joinedConvoy {
                    HStack(spacing: 6) {
                        Image(systemName: "point.3.connected.trianglepath.dotted")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(SlipStreamStyle.accent)
                        Text(convoy.name)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                        Text("\(viewModel.convoyDrivers.count) cars")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(SlipStreamStyle.muted)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.black.opacity(0.6), in: Capsule())
                }
            }

            Spacer()

            // Exit driving mode button
            Button {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    viewModel.exitDrivingMode()
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(.black.opacity(0.6), in: Circle())
                    .overlay(Circle().stroke(.white.opacity(0.2), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Speed display
            speedGauge

            Spacer()

            // Right side controls
            VStack(spacing: 10) {
                if viewModel.joinedConvoy != nil {
                    Button {
                        selectedConvoy = viewModel.joinedConvoy
                    } label: {
                        Image(systemName: "message.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.black)
                            .frame(width: 44, height: 44)
                            .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                // Recenter camera button
                Button {
                    // This would recenter the NavigationCamera to .following
                    // Handled via the DrivingMapView coordinator
                } label: {
                    Image(systemName: "location.fill")
                        .font(.system(size: 15, weight: .bold))
                }
                .buttonStyle(HUDButtonStyle())
            }
        }
    }

    // MARK: - Speed Gauge

    private var speedGauge: some View {
        VStack(spacing: 2) {
            Text("\(viewModel.currentSpeed)")
                .font(.system(size: 64, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.3), value: viewModel.currentSpeed)

            Text("MPH")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(SlipStreamStyle.muted)

            if let limit = viewModel.currentSpeedLimit {
                speedLimitBadge(limit: limit)
                    .padding(.top, 6)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(speedBorderColor, lineWidth: 2)
        )
    }

    private func speedLimitBadge(limit: Int) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "gauge.with.dots.needle.33percent")
                .font(.system(size: 10, weight: .bold))
            Text("LIMIT \(limit)")
                .font(.system(size: 10, weight: .black))
        }
        .foregroundStyle(viewModel.currentSpeed > limit ? .red : SlipStreamStyle.muted)
    }

    private var speedBorderColor: Color {
        guard let limit = viewModel.currentSpeedLimit else {
            return .white.opacity(0.15)
        }
        if viewModel.currentSpeed > limit + 10 {
            return .red.opacity(0.8)
        } else if viewModel.currentSpeed > limit {
            return .orange.opacity(0.6)
        }
        return .white.opacity(0.15)
    }
}

// MARK: - Convoy Member Strip (shown above speed when in convoy)

struct ConvoyMemberStrip: View {
    var drivers: [Driver]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: -8) {
                ForEach(drivers) { driver in
                    VehicleAvatar(vehicle: driver.vehicle, initials: driver.avatarInitials, size: 34)
                        .overlay(
                            Circle()
                                .stroke(.black, lineWidth: 2)
                        )
                }
            }
        }
    }
}
