//
//  SlipStreamViewModel.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import Combine
import CoreLocation
import SwiftUI

@MainActor
final class SlipStreamViewModel: ObservableObject {
    @Published var drivers: [Driver]
    @Published var convoys: [Convoy]
    @Published var meetups: [MeetupSpot]
    @Published var messages: [ChatMessage]
    @Published var myStatus: DriverStatus = .available
    @Published var visibility: VisibilityMode = .exact
    @Published var selectedMapFilter: MapFilter = .all
    @Published var joinedConvoyID: Convoy.ID?

    let myCoordinate = CLLocationCoordinate2D(latitude: 34.1341, longitude: -118.3215)
    let myVehicle = Vehicle(
        year: 2023,
        make: "Toyota",
        model: "GR86",
        trim: "Premium",
        mods: ["Coilovers", "Catback", "Michelin PS4S"],
        color: .red
    )

    init() {
        drivers = DemoData.drivers
        convoys = DemoData.convoys
        meetups = DemoData.meetups
        messages = DemoData.messages
    }

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

    func join(_ convoy: Convoy) {
        joinedConvoyID = convoy.id
        myStatus = .convoy
        messages.append(ChatMessage(sender: "SlipStream", text: "You joined \(convoy.name).", timestamp: "Now", isSystem: true))
    }

    func leaveCurrentConvoy() {
        if let joinedConvoy {
            messages.append(ChatMessage(sender: "SlipStream", text: "You left \(joinedConvoy.name).", timestamp: "Now", isSystem: true))
        }
        joinedConvoyID = nil
        myStatus = .available
    }

    func createConvoy(name: String, destination: String, meetingPoint: String, vibe: ConvoyVibe, isPublic: Bool) {
        let convoy = Convoy(
            name: name.isEmpty ? "Open Cruise" : name,
            destination: destination.isEmpty ? "Set on the road" : destination,
            meetingPoint: meetingPoint.isEmpty ? "Current area" : meetingPoint,
            vibe: vibe,
            coordinate: CLLocationCoordinate2D(latitude: myCoordinate.latitude + 0.012, longitude: myCoordinate.longitude - 0.018),
            memberIDs: Array(drivers.prefix(2).map(\.id)),
            isPublic: isPublic,
            etaDescription: "Starting now"
        )

        convoys.insert(convoy, at: 0)
        joinedConvoyID = convoy.id
        myStatus = .convoy
        messages.append(ChatMessage(sender: "SlipStream", text: "\(convoy.name) is live.", timestamp: "Now", isSystem: true))
    }

    func tickDemoLocations() {
        for index in drivers.indices {
            guard drivers[index].status != .offline else { continue }
            let drift = Double(index + 1) * 0.00003
            drivers[index].coordinate.latitude += index.isMultiple(of: 2) ? drift : -drift
            drivers[index].coordinate.longitude += index.isMultiple(of: 2) ? -drift : drift
        }
    }
}

enum MapFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case drivers = "Drivers"
    case convoys = "Convoys"
    case meets = "Meets"

    var id: String { rawValue }
}

private enum DemoData {
    static let drivers: [Driver] = [
        Driver(
            username: "apexkai",
            avatarInitials: "AK",
            vehicle: Vehicle(year: 2020, make: "Toyota", model: "Supra", trim: "3.0", mods: ["Downpipe", "E85 tune", "TE37"], color: .orange),
            status: .driving,
            coordinate: CLLocationCoordinate2D(latitude: 34.1490, longitude: -118.3521),
            distanceDescription: "1.4 mi",
            interests: ["Canyons", "Night runs"],
            isFriend: true
        ),
        Driver(
            username: "boostedmia",
            avatarInitials: "BM",
            vehicle: Vehicle(year: 2018, make: "BMW", model: "M2", trim: "Competition", mods: ["Akrapovic", "KW V3"], color: .blue),
            status: .available,
            coordinate: CLLocationCoordinate2D(latitude: 34.1197, longitude: -118.3003),
            distanceDescription: "2.1 mi",
            interests: ["Track days", "Cruises"],
            isFriend: false
        ),
        Driver(
            username: "canyonbrz",
            avatarInitials: "CB",
            vehicle: Vehicle(year: 2022, make: "Subaru", model: "BRZ", trim: "Limited", mods: ["Headers", "Ohlins", "RPF1"], color: .cyan),
            status: .convoy,
            coordinate: CLLocationCoordinate2D(latitude: 34.1682, longitude: -118.2743),
            distanceDescription: "3.7 mi",
            interests: ["Technical roads", "Photos"],
            isFriend: true
        ),
        Driver(
            username: "v8mason",
            avatarInitials: "VM",
            vehicle: Vehicle(year: 2019, make: "Ford", model: "Mustang", trim: "GT", mods: ["Borla", "PP2 wheels"], color: .purple),
            status: .meetup,
            coordinate: CLLocationCoordinate2D(latitude: 34.1013, longitude: -118.3378),
            distanceDescription: "2.8 mi",
            interests: ["Meets", "Drag nights"],
            isFriend: false
        ),
        Driver(
            username: "rallynoah",
            avatarInitials: "RN",
            vehicle: Vehicle(year: 2006, make: "Mitsubishi", model: "Evo IX", trim: "MR", mods: ["Built 4G63", "Gravel setup"], color: .green),
            status: .driving,
            coordinate: CLLocationCoordinate2D(latitude: 34.1879, longitude: -118.3219),
            distanceDescription: "4.4 mi",
            interests: ["Mountain roads", "Rally"],
            isFriend: false
        )
    ]

    static var convoys: [Convoy] {
        [
            Convoy(
                name: "Angeles Crest Run",
                destination: "Newcomb's Ranch",
                meetingPoint: "Shell La Canada",
                vibe: .canyon,
                coordinate: CLLocationCoordinate2D(latitude: 34.2035, longitude: -118.2008),
                memberIDs: Array(drivers.prefix(3).map(\.id)),
                isPublic: true,
                etaDescription: "Rolling in 12 min"
            ),
            Convoy(
                name: "Late Night Downtown Loop",
                destination: "Arts District",
                meetingPoint: "Griffith lower lot",
                vibe: .night,
                coordinate: CLLocationCoordinate2D(latitude: 34.0942, longitude: -118.2391),
                memberIDs: Array(drivers.suffix(2).map(\.id)),
                isPublic: true,
                etaDescription: "Active now"
            )
        ]
    }

    static let meetups: [MeetupSpot] = [
        MeetupSpot(
            name: "Griffith Pullout",
            subtitle: "Low-key meetup forming",
            coordinate: CLLocationCoordinate2D(latitude: 34.1292, longitude: -118.2946),
            activeCount: 8
        ),
        MeetupSpot(
            name: "Cars & Coffee Lot",
            subtitle: "Saturday regulars nearby",
            coordinate: CLLocationCoordinate2D(latitude: 34.1569, longitude: -118.3902),
            activeCount: 14
        )
    ]

    static let messages: [ChatMessage] = [
        ChatMessage(sender: "SlipStream", text: "Angeles Crest Run lobby opened.", timestamp: "8:41", isSystem: true),
        ChatMessage(sender: "apexkai", text: "Fueling up at the Shell now.", timestamp: "8:43"),
        ChatMessage(sender: "canyonbrz", text: "I can lead once we hit ACH.", timestamp: "8:44"),
        ChatMessage(sender: "boostedmia", text: "Rolling over in 5.", timestamp: "8:46")
    ]
}
