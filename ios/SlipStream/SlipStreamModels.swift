//
//  SlipStreamModels.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import CoreLocation
import SwiftUI

enum DriverStatus: String, CaseIterable, Identifiable {
    case driving = "Driving"
    case available = "Available"
    case meetup = "At Meetup"
    case convoy = "In Convoy"
    case offline = "Hidden"

    var id: String { rawValue }

    var iconName: String {
        switch self {
        case .driving: "steeringwheel"
        case .available: "sparkles"
        case .meetup: "mappin.and.ellipse"
        case .convoy: "point.3.connected.trianglepath.dotted"
        case .offline: "eye.slash"
        }
    }

    var tint: Color {
        switch self {
        case .driving: .cyan
        case .available: .green
        case .meetup: .orange
        case .convoy: .blue
        case .offline: .gray
        }
    }
}

enum VisibilityMode: String, CaseIterable, Identifiable {
    case exact = "Exact"
    case approximate = "Approximate"
    case convoyOnly = "Convoy Only"
    case hidden = "Hidden"

    var id: String { rawValue }
}

enum ConvoyVibe: String, CaseIterable, Identifiable {
    case canyon = "Canyon Run"
    case cruise = "Cruise"
    case carsAndCoffee = "Cars & Coffee"
    case night = "Night Loop"

    var id: String { rawValue }
}

struct Vehicle: Identifiable {
    let id = UUID()
    var year: Int
    var make: String
    var model: String
    var trim: String
    var mods: [String]
    var color: Color

    var displayName: String {
        "\(year) \(make) \(model)"
    }
}

struct Driver: Identifiable {
    var id = UUID()
    var username: String
    var avatarInitials: String
    var vehicle: Vehicle
    var status: DriverStatus
    var coordinate: CLLocationCoordinate2D
    var distanceDescription: String
    var interests: [String]
    var isFriend: Bool
}

struct Convoy: Identifiable, Hashable {
    var id = UUID()
    var name: String
    var destination: String
    var meetingPoint: String
    var vibe: ConvoyVibe
    var coordinate: CLLocationCoordinate2D
    var memberIDs: [Driver.ID]
    var isPublic: Bool
    var etaDescription: String
}

extension Convoy {
    static func == (lhs: Convoy, rhs: Convoy) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

struct MeetupSpot: Identifiable {
    var id = UUID()
    var name: String
    var subtitle: String
    var coordinate: CLLocationCoordinate2D
    var activeCount: Int
}

struct ChatMessage: Identifiable {
    var id = UUID()
    var sender: String
    var text: String
    var timestamp: String
    var isSystem: Bool = false
}

enum MapSelection: Identifiable, Equatable {
    case driver(Driver)
    case convoy(Convoy)
    case meetup(MeetupSpot)

    var id: String {
        switch self {
        case .driver(let driver): "driver-\(driver.id)"
        case .convoy(let convoy): "convoy-\(convoy.id)"
        case .meetup(let meetup): "meetup-\(meetup.id)"
        }
    }
}

extension MapSelection {
    static func == (lhs: MapSelection, rhs: MapSelection) -> Bool {
        lhs.id == rhs.id
    }
}
