//
//  MapHomeView.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import Combine
import CoreLocation
import SwiftUI
@_spi(Experimental) import MapboxMaps

struct MapHomeView: View {
    @EnvironmentObject private var viewModel: SlipStreamViewModel
    @Binding var showingProfile: Bool
    @Binding var showingCreateConvoy: Bool
    @Binding var showingPresence: Bool
    @Binding var selectedConvoy: Convoy?

    @State private var selection: MapSelection?
    @State private var locationManager = CLLocationManager()
    @State private var viewport: Viewport = .camera(
        center: CLLocationCoordinate2D(latitude: 34.1341, longitude: -118.3215),
        zoom: 11.4,
        bearing: -12,
        pitch: 52
    )

    private let timer = Timer.publish(every: 2.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            liveMap
                .ignoresSafeArea()

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
        .navigationBarHidden(true)
        .onReceive(timer) { _ in
            withAnimation(.linear(duration: 2.5)) {
                viewModel.tickDemoLocations()
            }
        }
        .onAppear {
            if locationManager.authorizationStatus == .notDetermined {
                locationManager.requestWhenInUseAuthorization()
            }
        }
    }

    private var liveMap: some View {
        Map(viewport: $viewport) {
            Puck2D(bearing: .heading)

            if viewModel.selectedMapFilter == .all || viewModel.selectedMapFilter == .drivers {
                ForEvery(viewModel.drivers) { driver in
                    MapViewAnnotation(coordinate: driver.coordinate) {
                        Button {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                                selection = .driver(driver)
                            }
                        } label: {
                            DriverMapMarker(driver: driver, isSelected: selection == .driver(driver))
                        }
                        .buttonStyle(.plain)
                    }
                    .allowOverlap(true)
                }
            }

            if viewModel.selectedMapFilter == .all || viewModel.selectedMapFilter == .convoys {
                ForEvery(viewModel.convoys) { convoy in
                    MapViewAnnotation(coordinate: convoy.coordinate) {
                        Button {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                                selection = .convoy(convoy)
                            }
                        } label: {
                            ConvoyMapMarker(convoy: convoy, isJoined: convoy.id == viewModel.joinedConvoyID)
                        }
                        .buttonStyle(.plain)
                    }
                    .allowOverlap(true)
                }
            }

            if viewModel.selectedMapFilter == .all || viewModel.selectedMapFilter == .meets {
                ForEvery(viewModel.meetups) { meetup in
                    MapViewAnnotation(coordinate: meetup.coordinate) {
                        Button {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                                selection = .meetup(meetup)
                            }
                        } label: {
                            MeetupMapMarker(meetup: meetup)
                        }
                        .buttonStyle(.plain)
                    }
                    .allowOverlap(true)
                }
            }
        }
        .mapStyle(.standard)
        .ornamentOptions(OrnamentOptions(
            scaleBar: .init(visibility: .hidden),
            compass: .init(visibility: .adaptive),
            logo: .init(position: .bottomLeading)
        ))
    }

    private var topHUD: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Button {
                    showingProfile = true
                } label: {
                    VehicleAvatar(vehicle: viewModel.myVehicle, initials: "KB", size: 44)
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
                    withAnimation(.easeInOut) {
                        viewport = .camera(center: viewModel.myCoordinate, zoom: 12.6, bearing: -12, pitch: 54)
                    }
                } label: {
                    Image(systemName: "location.fill")
                }
                .buttonStyle(HUDButtonStyle())

                Button {
                    showingCreateConvoy = true
                } label: {
                    Label("Start Convoy", systemImage: "plus")
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

private struct DriverMapMarker: View {
    var driver: Driver
    var isSelected: Bool

    var body: some View {
        VStack(spacing: 4) {
            VehicleAvatar(vehicle: driver.vehicle, initials: driver.avatarInitials, size: isSelected ? 52 : 42)
                .overlay(alignment: .bottomTrailing) {
                    Circle()
                        .fill(driver.status.tint)
                        .frame(width: 13, height: 13)
                        .overlay(Circle().stroke(.black, lineWidth: 2))
                }

            Text(driver.username)
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(.white)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(.black.opacity(0.72), in: Capsule())
        }
    }
}

private struct ConvoyMapMarker: View {
    var convoy: Convoy
    var isJoined: Bool

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 14, weight: .black))
            VStack(alignment: .leading, spacing: 1) {
                Text(convoy.name)
                    .font(.system(size: 11, weight: .black))
                Text("\(convoy.memberIDs.count) cars")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .foregroundStyle(isJoined ? .black : .white)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(isJoined ? SlipStreamStyle.accent : .blue.opacity(0.88), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .shadow(color: .blue.opacity(0.32), radius: 16, x: 0, y: 6)
    }
}

private struct MeetupMapMarker: View {
    var meetup: MeetupSpot

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 13, weight: .black))
            Text("\(meetup.activeCount)")
                .font(.system(size: 11, weight: .black))
        }
        .foregroundStyle(.black)
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .background(.orange, in: Capsule())
        .shadow(color: .orange.opacity(0.35), radius: 14, x: 0, y: 6)
    }
}
