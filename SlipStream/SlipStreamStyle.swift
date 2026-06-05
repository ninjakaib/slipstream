//
//  SlipStreamStyle.swift
//  SlipStream
//
//  Created by Codex on 6/4/26.
//

import SwiftUI

enum SlipStreamStyle {
    static let panel = Color(red: 0.05, green: 0.06, blue: 0.08)
    static let panelRaised = Color(red: 0.08, green: 0.09, blue: 0.12)
    static let line = Color.white.opacity(0.12)
    static let muted = Color.white.opacity(0.64)
    static let faint = Color.white.opacity(0.36)
    static let accent = Color(red: 0.2, green: 0.82, blue: 0.94)
}

struct HUDButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 44, height: 44)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(SlipStreamStyle.line, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}

struct PrimaryActionButton: View {
    var title: String
    var systemImage: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct SecondaryActionButton: View {
    var title: String
    var systemImage: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(SlipStreamStyle.line, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

struct StatusPill: View {
    var status: DriverStatus

    var body: some View {
        Label(status.rawValue, systemImage: status.iconName)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(status.tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(status.tint.opacity(0.16), in: Capsule())
            .overlay(Capsule().stroke(status.tint.opacity(0.4), lineWidth: 1))
    }
}

struct SectionLabel: View {
    var title: String
    var value: String?

    init(_ title: String, value: String? = nil) {
        self.title = title
        self.value = value
    }

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(SlipStreamStyle.faint)
            Spacer()
            if let value {
                Text(value)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(SlipStreamStyle.muted)
            }
        }
    }
}

struct VehicleAvatar: View {
    var vehicle: Vehicle
    var initials: String
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            Circle()
                .fill(vehicle.color.gradient)
            Circle()
                .stroke(.white.opacity(0.9), lineWidth: 2)
            Text(initials)
                .font(.system(size: size * 0.32, weight: .black))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .shadow(color: vehicle.color.opacity(0.45), radius: 12, x: 0, y: 6)
    }
}
