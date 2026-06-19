//
//  CreateAccountView.swift
//  SlipStream
//
//  Created by Claude on 6/11/26.
//

import SwiftUI

/// Username/password account creation form.
///
/// Presented as a sheet from WelcomeView. On success, AuthState transitions
/// to `.onboarding`, which dismisses this sheet automatically.
struct CreateAccountView: View {
    @EnvironmentObject private var authState: AuthState
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var password = ""
    @State private var email = ""
    @State private var displayName = ""
    @State private var isSubmitting = false

    private var canSubmit: Bool {
        username.count >= 3 && password.count >= 8 && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SlipStreamStyle.panel
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Create Account")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(.white)

                            Text("Pick a username and password to get started.")
                                .font(.system(size: 14, weight: .regular))
                                .foregroundStyle(SlipStreamStyle.muted)
                        }
                        .padding(.top, 16)

                        labeledField("Username", hint: "3-20 characters, letters/numbers/underscore") {
                            TextField("username", text: $username)
                                .textFieldStyle(SlipStreamTextFieldStyle())
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        labeledField("Password", hint: "At least 8 characters") {
                            SecureField("password", text: $password)
                                .textFieldStyle(SlipStreamTextFieldStyle())
                        }

                        labeledField("Email", hint: "Optional") {
                            TextField("email", text: $email)
                                .textFieldStyle(SlipStreamTextFieldStyle())
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.emailAddress)
                        }

                        labeledField("Display Name", hint: "Optional") {
                            TextField("display name", text: $displayName)
                                .textFieldStyle(SlipStreamTextFieldStyle())
                        }

                        if let errorMessage = authState.errorMessage {
                            Text(errorMessage)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.orange)
                        }

                        if isSubmitting {
                            HStack {
                                Spacer()
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                Spacer()
                            }
                            .padding(.vertical, 14)
                        } else {
                            PrimaryActionButton(
                                title: "Create Account",
                                systemImage: "person.badge.plus"
                            ) {
                                submit()
                            }
                            .disabled(!canSubmit)
                            .opacity(canSubmit ? 1 : 0.5)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 32)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        authState.dismissError()
                        dismiss()
                    }
                    .foregroundStyle(.white)
                }
            }
            .toolbarBackground(SlipStreamStyle.panel, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private func labeledField<Content: View>(
        _ title: String,
        hint: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SlipStreamStyle.faint)

            content()

            Text(hint)
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(SlipStreamStyle.faint)
        }
    }

    private func submit() {
        isSubmitting = true
        Task {
            await authState.register(
                username: username,
                password: password,
                email: email.isEmpty ? nil : email,
                displayName: displayName.isEmpty ? nil : displayName
            )
            isSubmitting = false
        }
    }
}

// MARK: - Preview

#Preview {
    CreateAccountView()
        .environmentObject(AuthState())
}
