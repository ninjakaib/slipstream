//
//  WelcomeView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import AuthenticationServices
import SwiftUI

/// Welcome screen with Sign in with Apple button.
///
/// Follows SlipStream design language:
/// - Dark background (SlipStreamStyle.panel)
/// - App name centered in upper portion
/// - Tagline in muted color
/// - Sign in with Apple button in lower third
/// - Error toast per D-11
struct WelcomeView: View {
    @EnvironmentObject private var authState: AuthState

    @State private var showingCreateAccount = false
    @State private var showingLogIn = false

    var body: some View {
        ZStack {
            // Dark background
            SlipStreamStyle.panel
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // App branding
                VStack(spacing: 12) {
                    Text("SlipStream")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(.white)

                    Text("Find your people. Drive together.")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(SlipStreamStyle.muted)
                }

                Spacer()

                // Sign in with Apple button
                SignInWithAppleButton(.signIn) { request in
                    // Request name and email (only provided on first sign-in)
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    handleSignInResult(result)
                }
                .signInWithAppleButtonStyle(.white)
                .frame(height: 50)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)

                // Username/password account options
                VStack(spacing: 12) {
                    SecondaryActionButton(
                        title: "Create Account",
                        systemImage: "person.badge.plus"
                    ) {
                        authState.dismissError()
                        showingCreateAccount = true
                    }

                    SecondaryActionButton(
                        title: "Log In",
                        systemImage: "arrow.right.circle"
                    ) {
                        authState.dismissError()
                        showingLogIn = true
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }

            // Error toast overlay (per D-11)
            if let errorMessage = authState.errorMessage {
                VStack {
                    Spacer()

                    ErrorToast(message: errorMessage) {
                        authState.dismissError()
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 120)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .animation(.easeInOut(duration: 0.3), value: authState.errorMessage)
            }
        }
        .sheet(isPresented: $showingCreateAccount) {
            CreateAccountView()
        }
        .sheet(isPresented: $showingLogIn) {
            LogInView()
        }
    }

    // MARK: - Private Methods

    private func handleSignInResult(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            handleAuthorization(authorization)
        case .failure:
            // Per D-11: Show error message on auth failure
            authState.errorMessage = "Apple sign-in was interrupted. Tap to try again, or check your Apple ID settings if the problem persists."
        }
    }

    private func handleAuthorization(_ authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            authState.errorMessage = "Could not retrieve Apple ID credentials. Please try again."
            return
        }

        // CRITICAL: Apple only provides fullName and email on FIRST sign-in
        // Must capture and send to backend immediately
        let fullName = credential.fullName
        let email = credential.email

        Task {
            await authState.signInWithApple(
                identityToken: identityToken,
                fullName: fullName,
                email: email
            )
        }
    }
}

// MARK: - Error Toast Component

/// Toast banner for displaying auth errors (per D-11).
private struct ErrorToast: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 20))
                .foregroundStyle(.orange)

            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 8)

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(SlipStreamStyle.muted)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(SlipStreamStyle.panelRaised)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.orange.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Preview

#Preview {
    WelcomeView()
        .environmentObject(AuthState())
}
