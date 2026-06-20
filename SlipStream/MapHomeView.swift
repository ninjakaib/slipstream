//
//  MapHomeView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import Combine
import CoreLocation
import SwiftUI

struct MapHomeView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @Binding var showingProfile: Bool
    @Binding var showingCreateConvoy: Bool
    @Binding var showingPresence: Bool
    @Binding var selectedConvoy: Convoy?

    @State private var selection: MapSelection?
    @State private var recenterTrigger: Int = 0

    private let defaultCenter = CLLocationCoordinate2D(latitude: 34.1341, longitude: -118.3215)
    private let explorerZoom: Double = 11.4
    private let explorerBearing: Double = -12
    private let explorerPitch: Double = 52

    private let refreshTimer = Timer.publish(every: 15, on: .main, in: .common).autoconnect()

    private var explorerCenter: CLLocationCoordinate2D {
        viewModel.userCoordinate ?? defaultCenter
    }

    private var cameraMode: MapCameraMode {
        if viewModel.isDrivingMode {
            return .driving
        } else {
            return .explorer(
                center: explorerCenter,
                zoom: explorerZoom,
                bearing: explorerBearing,
                pitch: explorerPitch
            )
        }
    }

    var body: some View {
        ZStack {
            // MARK: - Single unified map (always present)
            SlipStreamMapView(
                cameraMode: cameraMode,
                drivers: viewModel.drivers,
                convoys: viewModel.convoys,
                meetups: viewModel.meetups,
                mapFilter: viewModel.selectedMapFilter,
                joinedConvoyID: viewModel.joinedConvoyID,
                isDrivingMode: viewModel.isDrivingMode,
                recenterTrigger: recenterTrigger,
                onDriverSelected: { driver in
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                        selection = .driver(driver)
                    }
                },
                onConvoySelected: { convoy in
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                        selection = .convoy(convoy)
                    }
                },
                onMeetupSelected: { meetup in
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                        selection = .meetup(meetup)
                    }
                },
                onSpeedUpdate: { speed in
                    viewModel.currentSpeed = speed
                },
                onRoadNameUpdate: { name in
                    viewModel.currentRoadName = name
                },
                onSpeedLimitUpdate: { limit in
                    viewModel.currentSpeedLimit = limit
                }
            )
            .ignoresSafeArea()

            // MARK: - HUD overlays (crossfade based on mode)
            if viewModel.isDrivingMode {
                drivingOverlay
                    .transition(.opacity)
            } else {
                explorerOverlay
                    .transition(.opacity)
            }
        }
        .navigationBarHidden(true)
        .onReceive(refreshTimer) { _ in
            Task {
                await viewModel.fetchNearbyDrivers()
            }
        }
        .onAppear {
            viewModel.start()
        }
        .onDisappear {
            viewModel.stop()
        }
    }

    // MARK: - Driving Mode Overlay

    private var drivingOverlay: some View {
        ZStack {
            // Subtle gradient for HUD readability
            LinearGradient(
                colors: [.black.opacity(0.5), .clear, .clear, .black.opacity(0.55)],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
            .ignoresSafeArea()

            DrivingHUDView(selectedConvoy: $selectedConvoy)
        }
    }

    // MARK: - Explorer Mode Overlay

    private var explorerOverlay: some View {
        ZStack {
            // Gradient for explorer HUD
            LinearGradient(
                colors: [.black.opacity(0.72), .clear, .black.opacity(0.66)],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
            .ignoresSafeArea()

            VStack(spacing: 0) {
                topHUD
                Spacer()
                bottomControls
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 12)

            if let selection {
                VStack {
                    Spacer()
                    MapSelectionSheet(
                        selection: selection,
                        onClose: { self.selection = nil },
                        onOpenConvoy: { convoy in
                            self.selection = nil
                            selectedConvoy = convoy
                        }
                    )
                    .padding(.horizontal, 12)
                    .padding(.bottom, 92)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
    }

    // MARK: - Explorer HUD Components

    private var topHUD: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Button {
                    showingProfile = true
                } label: {
                    ZStack {
                        Circle()
                            .fill(SlipStreamStyle.accent.gradient)
                        Circle()
                            .stroke(.white.opacity(0.9), lineWidth: 2)
                        Image(systemName: "person.fill")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.black)
                    }
                    .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 3) {
                    Text("SlipStream")
                        .font(.system(size: 21, weight: .black))
                    Text("\(viewModel.nearbyDriverCount) drivers nearby  |  \(viewModel.activeConvoyCount) convoys live")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                }

                Spacer()

                Button {
                    showingPresence = true
                } label: {
                    Image(systemName: viewModel.myStatus.iconName)
                }
                .buttonStyle(HUDButtonStyle())
            }

            filterBar
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(MapFilter.allCases) { filter in
                    Button {
                        withAnimation(.snappy) {
                            viewModel.selectedMapFilter = filter
                        }
                    } label: {
                        Text(filter.rawValue)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(viewModel.selectedMapFilter == filter ? .black : .white)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 9)
                            .background(
                                viewModel.selectedMapFilter == filter ? SlipStreamStyle.accent : Color.white.opacity(0.12),
                                in: Capsule()
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var bottomControls: some View {
        VStack(spacing: 10) {
            if let joinedConvoy = viewModel.joinedConvoy {
                joinedConvoyBar(joinedConvoy)
            }

            HStack(spacing: 10) {
                Button {
                    recenterTrigger += 1
                } label: {
                    Image(systemName: "location.fill")
                }
                .buttonStyle(HUDButtonStyle())

                Button {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                        viewModel.enterDrivingMode()
                    }
                } label: {
                    Label("Drive", systemImage: "steeringwheel")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.black)
                        .frame(height: 44)
                        .padding(.horizontal, 16)
                        .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    showingCreateConvoy = true
                } label: {
                    Label("Convoy", systemImage: "plus")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    showingPresence = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .buttonStyle(HUDButtonStyle())
            }
        }
    }

    private func joinedConvoyBar(_ convoy: Convoy) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(SlipStreamStyle.accent)
                .frame(width: 34, height: 34)
                .background(SlipStreamStyle.accent.opacity(0.16), in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(convoy.name)
                    .font(.system(size: 14, weight: .bold))
                Text(convoy.destination)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(SlipStreamStyle.muted)
            }

            Spacer()

            Button {
                selectedConvoy = convoy
            } label: {
                Image(systemName: "message.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.black)
                    .frame(width: 36, height: 36)
                    .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(SlipStreamStyle.line, lineWidth: 1)
        )
    }
}
