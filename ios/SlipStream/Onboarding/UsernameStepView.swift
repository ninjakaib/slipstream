//
//  UsernameStepView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Combine
import SwiftUI

/// Search result model matching backend UserSearchResult
private struct UserSearchResult: Decodable {
    let id: String
    let username: String
    let display_name: String?
    let avatar_url: String?
}

/// View model for debounced username validation.
///
/// Uses Combine to debounce input and check availability via API.
/// Per D-10: 500ms debounce, show checkmark/X indicator.
@MainActor
final class UsernameValidator: ObservableObject {
    @Published var username = ""
    @Published var isAvailable: Bool? = nil
    @Published var isChecking = false
    @Published var errorMessage: String? = nil

    private var cancellables = Set<AnyCancellable>()
    private let apiClient: APIClient

    init(apiClient: APIClient = APIClient()) {
        self.apiClient = apiClient
        setupValidation()
    }

    private func setupValidation() {
        $username
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] username in
                guard let self = self else { return }
                // Reset state for empty or short usernames
                if username.count < 3 {
                    self.isAvailable = nil
                    self.isChecking = false
                    self.errorMessage = nil
                    return
                }
                // Validate format first
                if !self.isValidFormat(username) {
                    self.isAvailable = false
                    self.errorMessage = "Only letters, numbers, and underscores"
                    return
                }
                // Check availability
                Task { await self.checkAvailability(username) }
            }
            .store(in: &cancellables)
    }

    /// Check if username matches required format: 3-20 chars, alphanumeric + underscore
    func isValidFormat(_ username: String) -> Bool {
        let pattern = "^[a-zA-Z0-9_]+$"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(username.startIndex..., in: username)
        return username.count >= 3 && username.count <= 20 &&
            regex?.firstMatch(in: username, range: range) != nil
    }

    /// Check username availability via backend API.
    func checkAvailability(_ username: String) async {
        isChecking = true
        errorMessage = nil

        do {
            // Call GET /users/search?q={username}
            let results: [UserSearchResult] = try await apiClient.request(
                "/users/search?q=\(username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? username)",
                method: "GET",
                body: nil as String?,
                authenticated: true
            )

            // If exact match found (case-insensitive), username is taken
            let isTaken = results.contains { $0.username.lowercased() == username.lowercased() }
            isAvailable = !isTaken
            errorMessage = isTaken ? "This username is taken" : nil
        } catch {
            // On network error, allow user to proceed but show warning
            isAvailable = nil
            errorMessage = "Could not check availability"
        }

        isChecking = false
    }
}

/// Username entry step in onboarding wizard.
///
/// Per D-03: Username is required, cannot proceed without valid available username.
/// Per D-10: Inline validation with debounced API check.
struct UsernameStepView: View {
    @Binding var username: String
    var onNext: () -> Void
    var onBack: (() -> Void)?

    @StateObject private var validator = UsernameValidator()
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Headline
            Text("Choose a username")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(.white)

            // Subheadline
            Text("This is how other drivers will find you")
                .font(.system(size: 16))
                .foregroundStyle(SlipStreamStyle.muted)

            // Username input field
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("@")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(SlipStreamStyle.muted)

                    TextField("username", text: $validator.username)
                        .font(.system(size: 18))
                        .foregroundStyle(.white)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($isFocused)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(SlipStreamStyle.panelRaised)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(borderColor, lineWidth: 1)
                )

                // Validation feedback
                validationIndicator
            }
            .padding(.horizontal, 24)
            .onChange(of: validator.username) { _, newValue in
                username = newValue
            }
            .onChange(of: validator.isAvailable) { _, _ in
                // Sync with parent when availability changes
                username = validator.username
            }

            Spacer()

            // Continue button
            VStack(spacing: 16) {
                if let onBack = onBack {
                    Button("Back") {
                        onBack()
                    }
                    .foregroundStyle(SlipStreamStyle.muted)
                }

                Button {
                    onNext()
                } label: {
                    Text("Continue")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            validator.isAvailable == true
                                ? SlipStreamStyle.accent
                                : SlipStreamStyle.faint
                        )
                        .cornerRadius(8)
                }
                .disabled(validator.isAvailable != true)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            // Pre-populate validator if username already set
            if !username.isEmpty {
                validator.username = username
            }
            isFocused = true
        }
    }

    // MARK: - Computed Properties

    private var borderColor: Color {
        if validator.isChecking {
            return SlipStreamStyle.line
        }
        if let isAvailable = validator.isAvailable {
            return isAvailable ? .green : .red
        }
        return SlipStreamStyle.line
    }

    @ViewBuilder
    private var validationIndicator: some View {
        HStack(spacing: 6) {
            if validator.username.isEmpty {
                // Empty state - nothing
                EmptyView()
            } else if validator.username.count < 3 {
                // Too short
                Text("At least 3 characters")
                    .font(.system(size: 13))
                    .foregroundStyle(SlipStreamStyle.muted)
            } else if validator.isChecking {
                // Checking
                ProgressView()
                    .scaleEffect(0.8)
                Text("Checking availability...")
                    .font(.system(size: 13))
                    .foregroundStyle(SlipStreamStyle.muted)
            } else if let errorMessage = validator.errorMessage {
                // Error (taken or invalid)
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.red)
                Text(errorMessage)
                    .font(.system(size: 13))
                    .foregroundStyle(.red)
            } else if validator.isAvailable == true {
                // Available
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Text("Username available")
                    .font(.system(size: 13))
                    .foregroundStyle(.green)
            }
        }
        .frame(height: 20)
        .animation(.easeInOut(duration: 0.15), value: validator.isAvailable)
        .animation(.easeInOut(duration: 0.15), value: validator.isChecking)
    }
}

#Preview {
    @Previewable @State var username = ""

    UsernameStepView(
        username: $username,
        onNext: { print("Next tapped, username: \(username)") },
        onBack: nil
    )
    .background(SlipStreamStyle.panel)
}
