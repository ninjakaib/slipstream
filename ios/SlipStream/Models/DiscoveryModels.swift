import CoreLocation
import Foundation
import SwiftUI

struct DiscoveryCarResponse: Codable {
    let year: Int
    let make: String
    let model: String
    let trim: String?
    let color: String
}

struct NearbyDriverResponse: Codable, Identifiable {
    let userId: String
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let activeCar: DiscoveryCarResponse?
    let isFriend: Bool
    let lat: Double?
    let lng: Double?
    let heading: Double?
    let speed: Double?
    let status: String?
    let roadName: String?
    let distanceMiles: Double?

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case activeCar = "active_car"
        case isFriend = "is_friend"
        case lat, lng, heading, speed, status
        case roadName = "road_name"
        case distanceMiles = "distance_miles"
    }
}

struct NearbyConvoyResponse: Codable, Identifiable {
    let id: String
    let name: String
    let leaderUsername: String
    let visibility: String
    let status: String
    let destinationName: String?
    let memberCount: Int
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case leaderUsername = "leader_username"
        case visibility, status
        case destinationName = "destination_name"
        case memberCount = "member_count"
        case createdAt = "created_at"
    }
}

extension NearbyDriverResponse {
    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    func toDriver() -> Driver {
        let driverStatus: DriverStatus = switch status {
        case "driving": .driving
        case "parked", "available": .available
        case "in_convoy": .convoy
        default: .available
        }

        let vehicle: Vehicle
        if let car = activeCar {
            vehicle = Vehicle(
                year: car.year,
                make: car.make,
                model: car.model,
                trim: car.trim ?? "",
                mods: [],
                color: colorFromString(car.color)
            )
        } else {
            vehicle = Vehicle(year: 0, make: "Unknown", model: "", trim: "", mods: [], color: .gray)
        }

        let initials = String(username.prefix(2)).uppercased()

        let dist: String
        if let distanceMiles {
            dist = String(format: "%.1f mi", distanceMiles)
        } else {
            dist = ""
        }

        return Driver(
            id: UUID(uuidString: userId) ?? UUID(),
            username: username,
            avatarInitials: initials,
            vehicle: vehicle,
            status: driverStatus,
            coordinate: coordinate ?? CLLocationCoordinate2D(latitude: 0, longitude: 0),
            distanceDescription: dist,
            interests: [],
            isFriend: isFriend
        )
    }
}

private func colorFromString(_ string: String) -> SwiftUI.Color {
    switch string.lowercased() {
    case "red": return .red
    case "blue": return .blue
    case "green": return .green
    case "black": return .primary
    case "white": return .white
    case "silver", "gray", "grey": return .gray
    case "orange": return .orange
    case "yellow": return .yellow
    case "purple": return .purple
    case "cyan": return .cyan
    default: return .gray
    }
}
