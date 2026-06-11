//
//  SlipStreamMapView.swift
//  SlipStream
//
//  Unified map view using Mapbox Navigation SDK's NavigationMapView for both
//  explorer and driving modes. A single map surface provides seamless camera
//  transitions between birds-eye browsing and immersive driving.
//

import Combine
import CoreLocation
import MapboxMaps
import MapboxNavigationCore
import SwiftUI
import UIKit

// MARK: - Camera Mode

/// Defines how the map camera behaves
enum MapCameraMode: Equatable {
    /// Free-roaming explorer view (user can pan/zoom)
    case explorer(center: CLLocationCoordinate2D, zoom: Double, bearing: Double, pitch: Double)
    /// Locked driving view following the user's heading
    case driving

    static func == (lhs: MapCameraMode, rhs: MapCameraMode) -> Bool {
        switch (lhs, rhs) {
        case (.driving, .driving):
            return true
        case (.explorer(let c1, let z1, let b1, let p1), .explorer(let c2, let z2, let b2, let p2)):
            return c1.latitude == c2.latitude
                && c1.longitude == c2.longitude
                && z1 == z2 && b1 == b2 && p1 == p2
        default:
            return false
        }
    }
}

// MARK: - SlipStreamMapView

struct SlipStreamMapView: UIViewRepresentable {
    // MARK: State inputs from SwiftUI

    /// Current camera mode — explorer or driving
    var cameraMode: MapCameraMode

    /// All drivers to display on the map
    var drivers: [Driver]

    /// All convoys to display
    var convoys: [Convoy]

    /// All meetup spots to display
    var meetups: [MeetupSpot]

    /// Which filter is active (controls annotation visibility)
    var mapFilter: MapFilter

    /// ID of convoy the user has joined (for styling)
    var joinedConvoyID: Convoy.ID?

    /// Whether we're in driving mode (controls annotation density + free-drive)
    var isDrivingMode: Bool

    // MARK: Callbacks to SwiftUI

    var onDriverSelected: (Driver) -> Void
    var onConvoySelected: (Convoy) -> Void
    var onMeetupSelected: (MeetupSpot) -> Void
    var onSpeedUpdate: (Int) -> Void
    var onRoadNameUpdate: (String) -> Void
    var onSpeedLimitUpdate: (Int?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> NavigationMapView {
        let coordinator = context.coordinator

        // Initialize NavigationMapView
        let navigationMapView = NavigationMapView(
            location: coordinator.navigationProvider.navigation().locationMatching.map(\.location).eraseToAnyPublisher(),
            routeProgress: coordinator.navigationProvider.navigation().routeProgress.map(\.?.routeProgress).eraseToAnyPublisher(),
            predictiveCacheManager: nil
        )

        let mapView = navigationMapView.mapView

        // Configure map style
        mapView.mapboxMap.loadStyle(.standard)

        // Configure location puck
        mapView.location.options.puckType = .puck2D(
            Puck2DConfiguration(
                topImage: UIImage(systemName: "location.north.fill")?
                    .withTintColor(.white, renderingMode: .alwaysOriginal),
                bearingImage: nil,
                shadowImage: nil,
                scale: .constant(1.4),
                showsAccuracyRing: false
            )
        )
        mapView.location.options.puckBearingEnabled = true
        mapView.location.options.puckBearing = .heading

        // Hide default ornaments we don't need
        mapView.ornaments.scaleBarView.isHidden = true
        mapView.ornaments.logoView.isHidden = false
        mapView.ornaments.attributionButton.isHidden = true

        // Configure following camera options for driving mode. The camera's
        // viewportDataSource is exposed as the read-only ViewportDataSource protocol,
        // so cast to the concrete MobileViewportDataSource to mutate its options.
        if let viewportDataSource = navigationMapView.navigationCamera.viewportDataSource as? MobileViewportDataSource {
            viewportDataSource.options.followingCameraOptions.defaultPitch = 70
            viewportDataSource.options.followingCameraOptions.zoomRange = 15.5...17.0
        }

        // Start in explorer mode (idle camera)
        navigationMapView.navigationCamera.update(cameraState: .idle)
        applyExplorerCamera(to: mapView)

        // Start free-drive session (runs in background even in explorer mode
        // so the transition to driving is instant)
        coordinator.startFreeDrive()

        // Subscribe to location matching for telemetry
        coordinator.subscribeToLocationMatching()

        // Store reference
        coordinator.navigationMapView = navigationMapView

        // Initial annotation render
        coordinator.rebuildAnnotations()

        return navigationMapView
    }

    func updateUIView(_ navigationMapView: NavigationMapView, context: Context) {
        let coordinator = context.coordinator
        let previousMode = coordinator.currentCameraMode
        coordinator.parent = self

        // MARK: Camera mode transitions
        if cameraMode != previousMode {
            coordinator.currentCameraMode = cameraMode

            switch cameraMode {
            case .driving:
                // Transition to following — NavigationCamera animates smoothly
                navigationMapView.navigationCamera.update(cameraState: .following)

            case .explorer(let center, let zoom, let bearing, let pitch):
                // Transition back to idle — stop following, ease to explorer position
                navigationMapView.navigationCamera.update(cameraState: .idle)
                navigationMapView.mapView.camera.ease(
                    to: CameraOptions(
                        center: center,
                        zoom: zoom,
                        bearing: bearing,
                        pitch: pitch
                    ),
                    duration: 1.2
                )
            }
        }

        // MARK: Update annotations when data changes
        coordinator.rebuildAnnotations()
    }

    private func applyExplorerCamera(to mapView: MapView) {
        if case .explorer(let center, let zoom, let bearing, let pitch) = cameraMode {
            mapView.mapboxMap.setCamera(to: CameraOptions(
                center: center,
                zoom: zoom,
                bearing: bearing,
                pitch: pitch
            ))
        }
    }

    // MARK: - Coordinator

    class Coordinator: NSObject {
        var parent: SlipStreamMapView
        var navigationMapView: NavigationMapView?
        var cancellables = Set<AnyCancellable>()
        var currentCameraMode: MapCameraMode

        /// The core navigation provider
        let navigationProvider: MapboxNavigationProvider

        /// View annotations currently on the map (keyed by entity ID)
        private var activeAnnotations: [String: UIView] = [:]

        init(parent: SlipStreamMapView) {
            self.parent = parent
            self.currentCameraMode = parent.cameraMode

            let config = CoreConfig(
                locationSource: .live
            )
            self.navigationProvider = MapboxNavigationProvider(coreConfig: config)

            super.init()
        }

        func startFreeDrive() {
            navigationProvider.tripSession().startFreeDrive()
        }

        func subscribeToLocationMatching() {
            navigationProvider.navigation().locationMatching
                .receive(on: DispatchQueue.main)
                .sink { [weak self] state in
                    guard let self else { return }

                    // Speed (m/s to mph) — CLLocation.speed is negative when invalid
                    let speed = state.location.speed
                    if speed >= 0 {
                        let mph = Int(speed * 2.23694)
                        self.parent.onSpeedUpdate(mph)
                    }

                    // Road name
                    if let roadName = state.roadName, !roadName.text.isEmpty {
                        self.parent.onRoadNameUpdate(roadName.text)
                    }

                    // Speed limit — value is nil when the limit is unknown
                    if let speedLimit = state.speedLimit.value {
                        let mph = Int(speedLimit.converted(to: .milesPerHour).value)
                        self.parent.onSpeedLimitUpdate(mph)
                    } else {
                        self.parent.onSpeedLimitUpdate(nil)
                    }
                }
                .store(in: &cancellables)
        }

        // MARK: Annotation Management

        func rebuildAnnotations() {
            guard let navigationMapView else { return }
            let mapView = navigationMapView.mapView

            // Remove all current annotations
            for (_, view) in activeAnnotations {
                view.removeFromSuperview()
            }
            activeAnnotations.removeAll()

            let filter = parent.mapFilter
            let isDriving = parent.isDrivingMode

            // MARK: Driver annotations
            if filter == .all || filter == .drivers {
                for driver in parent.drivers {
                    guard driver.status != .offline else { continue }

                    let markerView: UIView
                    if isDriving {
                        // Compact marker in driving mode
                        markerView = makeHostedView(
                            DrivingDriverMarker(driver: driver)
                        )
                    } else {
                        // Full marker in explorer mode
                        markerView = makeHostedView(
                            ExplorerDriverMarker(
                                driver: driver,
                                onTap: { [weak self] in
                                    self?.parent.onDriverSelected(driver)
                                }
                            )
                        )
                    }

                    let options = ViewAnnotationOptions(
                        geometry: Point(driver.coordinate),
                        allowOverlap: true,
                        anchor: .bottom
                    )

                    try? mapView.viewAnnotations.add(markerView, options: options)
                    activeAnnotations["driver-\(driver.id)"] = markerView
                }
            }

            // MARK: Convoy annotations
            if filter == .all || filter == .convoys {
                for convoy in parent.convoys {
                    let isJoined = convoy.id == parent.joinedConvoyID

                    let markerView: UIView
                    if isDriving {
                        markerView = makeHostedView(
                            DrivingConvoyMarker(convoy: convoy, isJoined: isJoined)
                        )
                    } else {
                        markerView = makeHostedView(
                            ExplorerConvoyMarker(
                                convoy: convoy,
                                isJoined: isJoined,
                                onTap: { [weak self] in
                                    self?.parent.onConvoySelected(convoy)
                                }
                            )
                        )
                    }

                    let options = ViewAnnotationOptions(
                        geometry: Point(convoy.coordinate),
                        allowOverlap: true,
                        anchor: .center
                    )

                    try? mapView.viewAnnotations.add(markerView, options: options)
                    activeAnnotations["convoy-\(convoy.id)"] = markerView
                }
            }

            // MARK: Meetup annotations
            if filter == .all || filter == .meets {
                for meetup in parent.meetups {
                    let markerView: UIView
                    if isDriving {
                        markerView = makeHostedView(
                            DrivingMeetupMarker(meetup: meetup)
                        )
                    } else {
                        markerView = makeHostedView(
                            ExplorerMeetupMarker(
                                meetup: meetup,
                                onTap: { [weak self] in
                                    self?.parent.onMeetupSelected(meetup)
                                }
                            )
                        )
                    }

                    let options = ViewAnnotationOptions(
                        geometry: Point(meetup.coordinate),
                        allowOverlap: true,
                        anchor: .center
                    )

                    try? mapView.viewAnnotations.add(markerView, options: options)
                    activeAnnotations["meetup-\(meetup.id)"] = markerView
                }
            }
        }

        /// Wraps a SwiftUI view in a UIHostingController for use as a view annotation
        private func makeHostedView<V: View>(_ view: V) -> UIView {
            let host = UIHostingController(rootView: view)
            host.view.backgroundColor = .clear
            host.view.sizeToFit()
            return host.view
        }
    }
}

// MARK: - Explorer Mode Annotation Views

private struct ExplorerDriverMarker: View {
    var driver: Driver
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                VehicleAvatar(vehicle: driver.vehicle, initials: driver.avatarInitials, size: 42)
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
        .buttonStyle(.plain)
    }
}

private struct ExplorerConvoyMarker: View {
    var convoy: Convoy
    var isJoined: Bool
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
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
        .buttonStyle(.plain)
    }
}

private struct ExplorerMeetupMarker: View {
    var meetup: MeetupSpot
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
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
        .buttonStyle(.plain)
    }
}

// MARK: - Driving Mode Annotation Views (compact, less distracting)

private struct DrivingDriverMarker: View {
    var driver: Driver

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(driver.vehicle.color)
                .frame(width: 10, height: 10)
                .overlay(Circle().stroke(.white, lineWidth: 1.5))
            Text(driver.username)
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(.black.opacity(0.7), in: Capsule())
    }
}

private struct DrivingConvoyMarker: View {
    var convoy: Convoy
    var isJoined: Bool

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 10, weight: .black))
            Text("\(convoy.memberIDs.count)")
                .font(.system(size: 10, weight: .black))
        }
        .foregroundStyle(isJoined ? .black : .white)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(isJoined ? SlipStreamStyle.accent : .blue.opacity(0.75), in: Capsule())
    }
}

private struct DrivingMeetupMarker: View {
    var meetup: MeetupSpot

    var body: some View {
        Circle()
            .fill(.orange.opacity(0.8))
            .frame(width: 14, height: 14)
            .overlay(Circle().stroke(.white, lineWidth: 1.5))
    }
}
