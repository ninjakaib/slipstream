import Combine
import CoreLocation
import SwiftUI

@MainActor
final class SlipStreamViewModel: ObservableObject {
    @Published var drivers: [Driver] = []
    @Published var convoys: [Convoy] = []
    @Published var meetups: [MeetupSpot] = []
    @Published var messages: [ChatMessage] = []
    @Published var myStatus: DriverStatus = .available
    @Published var visibility: VisibilityMode = .exact
    @Published var selectedMapFilter: MapFilter = .all
    @Published var joinedConvoyID: Convoy.ID?
    @Published var isDrivingMode: Bool = false
    @Published var currentSpeed: Int = 0
    @Published var currentRoadName: String = ""
    @Published var currentSpeedLimit: Int? = nil
    @Published var isConnected: Bool = false

    let locationService = LocationService()
    let webSocketService = WebSocketService()
    private let apiClient = APIClient()
    private var cancellables = Set<AnyCancellable>()
    private var locationUpdateTimer: Timer?

    // Placeholder until user profile is loaded from API
    let myVehicle = Vehicle(
        year: 0, make: "—", model: "", trim: "", mods: [], color: .gray
    )

    var userCoordinate: CLLocationCoordinate2D? {
        locationService.coordinate
    }

    init() {
        setupBindings()
    }

    // MARK: - Setup

    private func setupBindings() {
        // Send location updates every 3s
        locationService.$currentLocation
            .compactMap { $0 }
            .throttle(for: .seconds(3), scheduler: DispatchQueue.main, latest: true)
            .sink { [weak self] location in
                self?.handleLocationUpdate(location)
            }
            .store(in: &cancellables)

        // On first location, immediately subscribe and fetch
        locationService.$currentLocation
            .compactMap { $0 }
            .first()
            .sink { [weak self] location in
                guard let self else { return }
                self.webSocketService.sendSubscribeArea(
                    lat: location.coordinate.latitude,
                    lng: location.coordinate.longitude
                )
                Task {
                    await self.fetchNearbyDrivers()
                    await self.fetchNearbyConvoys()
                }
            }
            .store(in: &cancellables)

        locationService.$authorizationStatus
            .sink { [weak self] status in
                guard let self else { return }
                if status == .authorizedWhenInUse || status == .authorizedAlways {
                    self.locationService.startUpdating()
                }
            }
            .store(in: &cancellables)

        webSocketService.$nearbyDrivers
            .receive(on: DispatchQueue.main)
            .sink { [weak self] updates in
                self?.applyDriverUpdates(updates)
            }
            .store(in: &cancellables)

        webSocketService.$exitedDriverId
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] userId in
                self?.handleDriverExited(userId)
            }
            .store(in: &cancellables)

        webSocketService.$connectionState
            .receive(on: DispatchQueue.main)
            .map { $0 == .connected }
            .assign(to: &$isConnected)
    }

    // MARK: - Lifecycle

    func start() {
        locationService.requestPermission()
        webSocketService.connect()
    }

    func stop() {
        webSocketService.disconnect()
        locationService.stopUpdating()
        stopLocationUpdates()
    }

    // MARK: - Discovery API

    func fetchNearbyDrivers() async {
        guard let coordinate = userCoordinate else { return }

        do {
            let response: [NearbyDriverResponse] = try await apiClient.request(
                "/discovery/nearby?lat=\(coordinate.latitude)&lng=\(coordinate.longitude)",
                method: "GET"
            )
            drivers = response.compactMap { $0.toDriver() }
        } catch {
            // Keep existing drivers on failure
        }
    }

    func fetchNearbyConvoys() async {
        do {
            let response: [NearbyConvoyResponse] = try await apiClient.request(
                "/discovery/convoys",
                method: "GET"
            )
            convoys = response.map { convoy in
                Convoy(
                    name: convoy.name,
                    destination: convoy.destinationName ?? "",
                    meetingPoint: "",
                    vibe: .cruise,
                    coordinate: userCoordinate ?? CLLocationCoordinate2D(latitude: 0, longitude: 0),
                    memberIDs: [],
                    isPublic: convoy.visibility == "public",
                    etaDescription: convoy.status == "active" ? "Active now" : "Forming"
                )
            }
        } catch {
            // Keep existing convoys on failure
        }
    }

    // MARK: - Location Updates

    private func handleLocationUpdate(_ location: CLLocation) {
        let headingValue = locationService.heading?.trueHeading ?? 0

        let statusString: String = switch myStatus {
        case .driving: "driving"
        case .available: "parked"
        case .convoy: "in_convoy"
        case .meetup: "parked"
        case .offline: "offline"
        }

        webSocketService.sendLocationUpdate(
            location: location,
            heading: headingValue,
            status: statusString,
            roadName: currentRoadName
        )

        webSocketService.sendSubscribeArea(
            lat: location.coordinate.latitude,
            lng: location.coordinate.longitude
        )
    }

    private func applyDriverUpdates(_ updates: [String: DriverLocationUpdate]) {
        for (userId, update) in updates {
            if let index = drivers.firstIndex(where: { $0.id.uuidString.lowercased() == userId.lowercased() }) {
                drivers[index].coordinate = CLLocationCoordinate2D(latitude: update.lat, longitude: update.lng)
                drivers[index].status = driverStatusFromString(update.status)
            } else {
                // New driver from WebSocket — add with minimal info until REST refresh fills metadata
                let driver = Driver(
                    id: UUID(uuidString: userId) ?? UUID(),
                    username: userId.prefix(8).description,
                    avatarInitials: "??",
                    vehicle: Vehicle(year: 0, make: "Unknown", model: "", trim: "", mods: [], color: .gray),
                    status: driverStatusFromString(update.status),
                    coordinate: CLLocationCoordinate2D(latitude: update.lat, longitude: update.lng),
                    distanceDescription: "",
                    interests: [],
                    isFriend: false
                )
                drivers.append(driver)
            }
        }
    }

    private func handleDriverExited(_ userId: String) {
        drivers.removeAll { $0.id.uuidString.lowercased() == userId.lowercased() }
    }

    private func driverStatusFromString(_ status: String) -> DriverStatus {
        switch status {
        case "driving": return .driving
        case "parked", "available": return .available
        case "in_convoy": return .convoy
        default: return .available
        }
    }

    func startLocationUpdates() {
        locationUpdateTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let location = self.locationService.currentLocation else { return }
                self.handleLocationUpdate(location)
            }
        }
    }

    func stopLocationUpdates() {
        locationUpdateTimer?.invalidate()
        locationUpdateTimer = nil
    }

    // MARK: - Computed Properties

    var nearbyDriverCount: Int {
        drivers.filter { $0.status != .offline }.count
    }

    var activeConvoyCount: Int {
        convoys.count
    }

    var joinedConvoy: Convoy? {
        guard let joinedConvoyID else { return nil }
        return convoys.first { $0.id == joinedConvoyID }
    }

    // MARK: - Actions

    func join(_ convoy: Convoy) {
        joinedConvoyID = convoy.id
        myStatus = .convoy
        webSocketService.sendStatusChange(status: "in_convoy")
        messages.append(ChatMessage(sender: "SlipStream", text: "You joined \(convoy.name).", timestamp: "Now", isSystem: true))
    }

    func leaveCurrentConvoy() {
        if let joinedConvoy {
            messages.append(ChatMessage(sender: "SlipStream", text: "You left \(joinedConvoy.name).", timestamp: "Now", isSystem: true))
        }
        joinedConvoyID = nil
        myStatus = .available
        webSocketService.sendStatusChange(status: "parked")
    }

    func createConvoy(name: String, destination: String, meetingPoint: String, vibe: ConvoyVibe, isPublic: Bool) {
        guard let coord = userCoordinate else { return }
        let convoy = Convoy(
            name: name.isEmpty ? "Open Cruise" : name,
            destination: destination.isEmpty ? "Set on the road" : destination,
            meetingPoint: meetingPoint.isEmpty ? "Current area" : meetingPoint,
            vibe: vibe,
            coordinate: coord,
            memberIDs: [],
            isPublic: isPublic,
            etaDescription: "Starting now"
        )

        convoys.insert(convoy, at: 0)
        joinedConvoyID = convoy.id
        myStatus = .convoy
        webSocketService.sendStatusChange(status: "in_convoy")
        messages.append(ChatMessage(sender: "SlipStream", text: "\(convoy.name) is live.", timestamp: "Now", isSystem: true))
    }

    func enterDrivingMode() {
        isDrivingMode = true
        myStatus = .driving
        webSocketService.sendStatusChange(status: "driving")
        startLocationUpdates()
    }

    func exitDrivingMode() {
        isDrivingMode = false
        currentSpeed = 0
        currentRoadName = ""
        currentSpeedLimit = nil
        myStatus = .available
        webSocketService.sendStatusChange(status: "parked")
        stopLocationUpdates()
    }

    var convoyDrivers: [Driver] {
        guard let joinedConvoyID else { return [] }
        guard let convoy = convoys.first(where: { $0.id == joinedConvoyID }) else { return [] }
        return drivers.filter { convoy.memberIDs.contains($0.id) }
    }
}

enum MapFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case drivers = "Drivers"
    case convoys = "Convoys"
    case meets = "Meets"

    var id: String { rawValue }
}
