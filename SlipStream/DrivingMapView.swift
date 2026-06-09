//
//  DrivingMapView.swift
//  SlipStream
//
//  UIViewRepresentable bridge for Mapbox Navigation SDK's NavigationMapView.
//  Provides free-drive mode with road-snapped location, heading-following camera,
//  and real-time telemetry (speed, road name, speed limit) pushed back to SwiftUI.
//

import Combine
import CoreLocation
import MapboxMaps
import MapboxNavigationCore
import SwiftUI
import UIKit

// MARK: - DrivingMapView

struct DrivingMapView: UIViewRepresentable {
    /// Convoy members to show as annotations during driving
    var convoyDrivers: [Driver]

    /// Callbacks to push telemetry data back to SwiftUI ViewModel
    var onSpeedUpdate: (Int) -> Void
    var onRoadNameUpdate: (String) -> Void
    var onSpeedLimitUpdate: (Int?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> NavigationMapView {
        // Initialize NavigationMapView for free-drive
        let navigationMapView = NavigationMapView(
            location: context.coordinator.navigationProvider.navigation().locationMatching.map(\.location).eraseToAnyPublisher(),
            routeProgress: context.coordinator.navigationProvider.navigation().routeProgress.map(\.?.routeProgress).eraseToAnyPublisher(),
            predictiveCacheManager: nil
        )

        // Configure map style
        navigationMapView.mapView.mapboxMap.loadStyle(.standardSatellite)

        // Configure location puck for driving — use a 3D model-style puck
        navigationMapView.mapView.location.options.puckType = .puck2D(
            Puck2DConfiguration(
                topImage: UIImage(systemName: "location.north.fill")?
                    .withTintColor(.white, renderingMode: .alwaysOriginal),
                bearingImage: nil,
                shadowImage: nil,
                scale: .constant(1.6),
                showsAccuracyRing: false
            )
        )
        navigationMapView.mapView.location.options.puckBearingEnabled = true
        navigationMapView.mapView.location.options.puckBearing = .heading

        // Start the navigation camera in following mode
        navigationMapView.navigationCamera.update(cameraState: .following)

        // Customize camera options for an immersive driving feel
        navigationMapView.navigationCamera.viewportDataSource.options.followingCameraOptions.defaultPitch = 70
        navigationMapView.navigationCamera.viewportDataSource.options.followingCameraOptions.zoomRange = 15.5...17.0

        // Start free-drive session
        context.coordinator.startFreeDrive()

        // Subscribe to location matching for road name + speed
        context.coordinator.subscribeToLocationMatching()

        // Store reference for updates
        context.coordinator.navigationMapView = navigationMapView

        return navigationMapView
    }

    func updateUIView(_ navigationMapView: NavigationMapView, context: Context) {
        // Update convoy member annotations when they change
        context.coordinator.updateConvoyAnnotations(on: navigationMapView, drivers: convoyDrivers)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject {
        var parent: DrivingMapView
        var navigationMapView: NavigationMapView?
        var cancellables = Set<AnyCancellable>()

        /// The core navigation provider that manages free-drive and active guidance sessions
        let navigationProvider: MapboxNavigationProvider

        /// Annotation manager for convoy member markers
        var convoyAnnotationManager: CircleAnnotationManager?

        /// View annotations for convoy member labels
        private var currentConvoyViewAnnotations: [String: UIView] = [:]

        init(parent: DrivingMapView) {
            self.parent = parent

            // Configure navigation provider
            let config = CoreConfig(
                locationSource: .live // Use real device GPS
            )
            self.navigationProvider = MapboxNavigationProvider(coreConfig: config)

            super.init()
        }

        func startFreeDrive() {
            navigationProvider.navigation().startFreeDrive()
        }

        func subscribeToLocationMatching() {
            // Subscribe to map-matched location updates for telemetry
            navigationProvider.navigation().locationMatching
                .receive(on: DispatchQueue.main)
                .sink { [weak self] state in
                    guard let self else { return }

                    // Current speed (m/s → mph)
                    if let speed = state.location.speed, speed >= 0 {
                        let mph = Int(speed * 2.23694)
                        self.parent.onSpeedUpdate(mph)
                    }

                    // Road name
                    if let roadName = state.roadName, !roadName.isEmpty {
                        self.parent.onRoadNameUpdate(roadName)
                    }

                    // Speed limit
                    if let speedLimit = state.speedLimit?.value {
                        switch speedLimit {
                        case .speed(let measurement):
                            let mph = Int(measurement.converted(to: .milesPerHour).value)
                            self.parent.onSpeedLimitUpdate(mph)
                        case .unknown:
                            self.parent.onSpeedLimitUpdate(nil)
                        }
                    }
                }
                .store(in: &cancellables)
        }

        func updateConvoyAnnotations(on navigationMapView: NavigationMapView, drivers: [Driver]) {
            let mapView = navigationMapView.mapView

            // Remove existing convoy view annotations
            for (_, view) in currentConvoyViewAnnotations {
                view.removeFromSuperview()
            }
            currentConvoyViewAnnotations.removeAll()

            // Create circle annotation manager if needed
            if convoyAnnotationManager == nil {
                convoyAnnotationManager = mapView.annotations.makeCircleAnnotationManager()
            }

            // Add circle annotations for convoy members
            var circles: [CircleAnnotation] = []
            for driver in drivers {
                var circle = CircleAnnotation(
                    centerCoordinate: driver.coordinate
                )
                circle.circleRadius = 8
                circle.circleColor = StyleColor(UIColor(driver.vehicle.color))
                circle.circleStrokeColor = StyleColor(.white)
                circle.circleStrokeWidth = 2.5
                circle.circleOpacity = 0.9
                circles.append(circle)
            }
            convoyAnnotationManager?.annotations = circles

            // Add floating name labels via view annotations
            for driver in drivers {
                let options = ViewAnnotationOptions(
                    geometry: Point(driver.coordinate),
                    allowOverlap: true,
                    anchor: .bottom,
                    offsetY: -20
                )

                let label = ConvoyMemberLabel(username: driver.username, vehicle: driver.vehicle)
                let hostingController = UIHostingController(rootView: label)
                hostingController.view.backgroundColor = .clear
                hostingController.view.frame = CGRect(x: 0, y: 0, width: 120, height: 36)

                try? mapView.viewAnnotations.add(hostingController.view, options: options)
                currentConvoyViewAnnotations[driver.id.uuidString] = hostingController.view
            }
        }
    }
}

// MARK: - Convoy Member Label (displayed above dots on driving map)

private struct ConvoyMemberLabel: View {
    var username: String
    var vehicle: Vehicle

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(vehicle.color)
                .frame(width: 10, height: 10)
            Text(username)
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(.black.opacity(0.78), in: Capsule())
    }
}
