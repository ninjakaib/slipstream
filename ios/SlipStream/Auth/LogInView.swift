//
//  LogInView.swift
//  SlipStream
//
//  Created by Claude on 6/11/26.
//

import SwiftUI

/// Username/password login form.
///
/// Presented as a sheet from WelcomeView. On success, AuthState transitions
/// to `.authenticated`, which dismisses this sheet automatically.
struct LogInView: View {
    @EnvironmentObject private var authState: AuthState
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var password = ""
    @State private var isSubmitting = false

    private var canSubmit: Bool {
        !username.isEmpty && !password.isEmpty && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SlipStreamStyle.panel
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Log In")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(.white)

                            Text("Sign in with your username and password.")
                                .font(.system(size: 14, weight: .regular))
                                .foregroundStyle(SlipStreamStyle.muted)
                        }
                        .padding(.top, 16)

                        labeledField("Username") {
                            TextField("username", text: $username)
                                .textFieldStyle(SlipStreamTextFieldStyle())
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        labeledField("Password") {
                            SecureField("password", text: $password)
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
                                title: "Log In",
                                systemImage: "arrow.right.circle"
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
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SlipStreamStyle.faint)

            content()
        }
    }

    private func submit() {
        isSubmitting = true
        Task {
            await authState.login(username: username, password: password)
            isSubmitting = false
        }
    }
}

// MARK: - Preview

#Preview {
    LogInView()
        .environmentObject(AuthState())
}
