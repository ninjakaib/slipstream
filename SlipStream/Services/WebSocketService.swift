import Combine
import CoreLocation
import Foundation

@MainActor
final class WebSocketService: ObservableObject {
    enum ConnectionState {
        case disconnected
        case connecting
        case connected
    }

    @Published var connectionState: ConnectionState = .disconnected
    @Published var nearbyDrivers: [String: DriverLocationUpdate] = [:]
    @Published var exitedDriverId: String?

    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var heartbeatTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private let keychainService = KeychainService()

    private let baseURL: URL

    init() {
        if let urlString = ProcessInfo.processInfo.environment["SLIPSTREAM_API_URL"],
           let url = URL(string: urlString) {
            self.baseURL = url
        } else {
            self.baseURL = URL(string: "https://api.slipstream.app")!
        }
    }

    func connect() {
        guard connectionState == .disconnected else { return }
        guard let token = keychainService.retrieveToken(account: KeychainService.Account.accessToken) else { return }

        connectionState = .connecting

        let wsScheme = baseURL.scheme == "https" ? "wss" : "ws"
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return }
        components.scheme = wsScheme
        components.path = "/ws"
        components.queryItems = [URLQueryItem(name: "token", value: token)]

        guard let wsURL = components.url else { return }

        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        session = URLSession(configuration: config)
        webSocket = session?.webSocketTask(with: wsURL)
        webSocket?.resume()

        connectionState = .connected
        reconnectAttempts = 0
        startHeartbeat()
        receiveMessage()
    }

    func disconnect() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        session?.invalidateAndCancel()
        session = nil
        connectionState = .disconnected
        reconnectAttempts = 0
    }

    func sendLocationUpdate(location: CLLocation, heading: Double, status: String, roadName: String) {
        let payload: [String: Any] = [
            "type": "location_update",
            "payload": [
                "lat": location.coordinate.latitude,
                "lng": location.coordinate.longitude,
                "heading": heading,
                "speed": max(0, location.speed * 2.23694),
                "status": status,
                "road_name": roadName
            ]
        ]
        send(payload)
    }

    func sendSubscribeArea(lat: Double, lng: Double, radiusMiles: Double = 15) {
        let payload: [String: Any] = [
            "type": "subscribe_area",
            "payload": [
                "lat": lat,
                "lng": lng,
                "radius_miles": radiusMiles
            ]
        ]
        send(payload)
    }

    func sendStatusChange(status: String) {
        let payload: [String: Any] = [
            "type": "status_change",
            "payload": ["status": status]
        ]
        send(payload)
    }

    // MARK: - Private

    private func send(_ message: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let text = String(data: data, encoding: .utf8) else { return }
        webSocket?.send(.string(text)) { _ in }
    }

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            guard let self else { return }
            let msg: [String: Any] = ["type": "heartbeat", "payload": [:] as [String: Any]]
            Task { @MainActor in
                self.send(msg)
            }
        }
    }

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }

                switch result {
                case .success(let message):
                    switch message {
                    case .string(let text):
                        self.handleMessage(text)
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            self.handleMessage(text)
                        }
                    @unknown default:
                        break
                    }
                    self.receiveMessage()

                case .failure:
                    self.connectionState = .disconnected
                    self.attemptReconnect()
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String,
              let payload = json["payload"] as? [String: Any] else { return }

        switch type {
        case "driver_location":
            handleDriverLocation(payload)
        case "driver_entered":
            handleDriverEntered(payload)
        case "driver_exited":
            handleDriverExited(payload)
        case "heartbeat_ack":
            break
        default:
            break
        }
    }

    private func handleDriverLocation(_ payload: [String: Any]) {
        guard let userId = payload["user_id"] as? String,
              let lat = payload["lat"] as? Double,
              let lng = payload["lng"] as? Double else { return }

        let heading = payload["heading"] as? Double ?? 0
        let speed = payload["speed"] as? Double ?? 0
        let status = payload["status"] as? String ?? "driving"
        let roadName = payload["road_name"] as? String ?? ""

        if var existing = nearbyDrivers[userId] {
            existing.lat = lat
            existing.lng = lng
            existing.heading = heading
            existing.speed = speed
            existing.status = status
            existing.roadName = roadName
            nearbyDrivers[userId] = existing
        } else {
            nearbyDrivers[userId] = DriverLocationUpdate(
                userId: userId, lat: lat, lng: lng,
                heading: heading, speed: speed,
                status: status, roadName: roadName
            )
        }
    }

    private func handleDriverEntered(_ payload: [String: Any]) {
        guard let userId = payload["user_id"] as? String,
              let lat = payload["lat"] as? Double,
              let lng = payload["lng"] as? Double else { return }

        let heading = payload["heading"] as? Double ?? 0
        let speed = payload["speed"] as? Double ?? 0
        let status = payload["status"] as? String ?? "driving"
        let roadName = payload["road_name"] as? String ?? ""

        nearbyDrivers[userId] = DriverLocationUpdate(
            userId: userId, lat: lat, lng: lng,
            heading: heading, speed: speed,
            status: status, roadName: roadName
        )
    }

    private func handleDriverExited(_ payload: [String: Any]) {
        guard let userId = payload["user_id"] as? String else { return }
        nearbyDrivers.removeValue(forKey: userId)
        exitedDriverId = userId
    }

    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else { return }
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            await self?.connect()
        }
    }
}

struct DriverLocationUpdate {
    let userId: String
    var lat: Double
    var lng: Double
    var heading: Double
    var speed: Double
    var status: String
    var roadName: String
}
