//
//  ToastView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import SwiftUI

// MARK: - Toast Style

/// Visual style for toast notifications.
enum ToastStyle {
    case error
    case success
    case info

    /// Color associated with the style.
    var color: Color {
        switch self {
        case .error: return .red
        case .success: return .green
        case .info: return SlipStreamStyle.accent
        }
    }

    /// SF Symbol name for the style.
    var iconName: String {
        switch self {
        case .error: return "exclamationmark.circle"
        case .success: return "checkmark.circle"
        case .info: return "info.circle"
        }
    }
}

// MARK: - Toast View

/// Notification overlay component for error/success/info messages.
///
/// Per D-11: Auth failures show toast message + stay on sign-in screen.
/// Per D-12: Photo upload failures show retry + skip (toast is the notification part).
struct ToastView: View {
    // MARK: - Properties

    /// Message to display.
    let message: String

    /// Visual style of the toast.
    let style: ToastStyle

    /// Optional callback when dismiss button is tapped.
    var onDismiss: (() -> Void)? = nil

    // MARK: - Body

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: style.iconName)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(style.color)

            // Message
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            Spacer()

            // Dismiss button (if callback provided)
            if onDismiss != nil {
                Button {
                    onDismiss?()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.muted)
                        .frame(width: 24, height: 24)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(style.color.opacity(0.15))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(style.color.opacity(0.3), lineWidth: 1)
        )
        .frame(maxWidth: 340)
    }
}

// MARK: - Toast Modifier

/// ViewModifier for displaying toast notifications.
///
/// Displays a toast at the top of the screen with animation.
/// Per UI-SPEC: 250ms spring animation in, 200ms easeIn fade out.
/// Auto-dismisses after duration (default 3 seconds).
struct ToastModifier: ViewModifier {
    // MARK: - Properties

    /// Whether the toast is presented.
    @Binding var isPresented: Bool

    /// Message to display.
    let message: String

    /// Visual style of the toast.
    let style: ToastStyle

    /// Duration before auto-dismiss (seconds).
    let duration: Double

    // MARK: - State

    /// Timer for auto-dismiss.
    @State private var dismissTask: Task<Void, Never>? = nil

    // MARK: - Body

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if isPresented {
                    ToastView(
                        message: message,
                        style: style,
                        onDismiss: {
                            dismissToast()
                        }
                    )
                    .padding(.top, 60) // Below status bar
                    .padding(.horizontal, 16)
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .opacity
                    ))
                    .onTapGesture {
                        dismissToast()
                    }
                    .onAppear {
                        scheduleAutoDismiss()
                    }
                    .onDisappear {
                        cancelAutoDismiss()
                    }
                }
            }
            .animation(.spring(duration: 0.25), value: isPresented)
    }

    // MARK: - Private Methods

    private func dismissToast() {
        withAnimation(.easeIn(duration: 0.2)) {
            isPresented = false
        }
    }

    private func scheduleAutoDismiss() {
        cancelAutoDismiss()
        dismissTask = Task {
            try? await Task.sleep(for: .seconds(duration))
            if !Task.isCancelled {
                await MainActor.run {
                    dismissToast()
                }
            }
        }
    }

    private func cancelAutoDismiss() {
        dismissTask?.cancel()
        dismissTask = nil
    }
}

// MARK: - View Extension

extension View {
    /// Display a toast notification overlay.
    ///
    /// - Parameters:
    ///   - isPresented: Binding to control toast visibility
    ///   - message: The message to display
    ///   - style: Visual style of the toast (error, success, info)
    ///   - duration: Auto-dismiss duration in seconds (default 3.0)
    /// - Returns: Modified view with toast capability
    func toast(
        isPresented: Binding<Bool>,
        message: String,
        style: ToastStyle,
        duration: Double = 3.0
    ) -> some View {
        modifier(ToastModifier(
            isPresented: isPresented,
            message: message,
            style: style,
            duration: duration
        ))
    }
}

// MARK: - Preview

#Preview("Error Toast") {
    VStack {
        Text("Content")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(SlipStreamStyle.panel)
    .toast(
        isPresented: .constant(true),
        message: "Apple sign-in was interrupted. Tap to try again.",
        style: .error
    )
}

#Preview("Success Toast") {
    VStack {
        Text("Content")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(SlipStreamStyle.panel)
    .toast(
        isPresented: .constant(true),
        message: "Profile saved successfully!",
        style: .success
    )
}

#Preview("Info Toast") {
    VStack {
        Text("Content")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(SlipStreamStyle.panel)
    .toast(
        isPresented: .constant(true),
        message: "Photo upload is optional. You can add one later.",
        style: .info
    )
}
