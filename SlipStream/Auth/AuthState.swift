//
//  AuthState.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Combine
import Foundation

/// Authentication states for the app.
enum AuthenticationState: Equatable {
    /// Initial state while checking for stored tokens
    case loading
    /// No valid tokens found, show sign-in screen
    case unauthenticated
    /// New user, show onboarding wizard
    case onboarding
    /// Authenticated user, show main app
    case authenticated
}

/// Simple user representation for auth state.
struct CurrentUser: Equatable {
    let id: String
    let username: String
    let displayName: String?
    let email: String?
}

/// Observable auth state manager.
///
/// Manages the authentication lifecycle:
/// - Checks for stored tokens on init
/// - Handles Sign in with Apple flow
/// - Routes users to onboarding (new) or map (returning)
/// - Per D-09: Shows map immediately if tokens exist
/// - Per D-11: Shows error toast on auth failure
@MainActor
final class AuthState: ObservableObject {
    // MARK: - Published State

    /// Current authentication state
    @Published var state: AuthenticationState = .loading

    /// Current authenticated user
    @Published var currentUser: CurrentUser?

    /// Error message to display (per D-11)
    @Published var errorMessage: String?

    // MARK: - Dependencies

    private let authService: AuthService

    // MARK: - Initialization

    init(authService: AuthService? = nil) {
        // Construct the default AuthService inside the init body — a default
        // argument expression runs in a nonisolated context and can't call
        // AuthService's @MainActor initializer.
        self.authService = authService ?? AuthService()
        Task {
            await checkAuthStatus()
        }
    }

    // MARK: - Public Methods

    /// Check authentication status on app launch.
    ///
    /// Per D-09: Shows map immediately if tokens exist.
    /// Only shows loading if validation/refresh actually fails.
    func checkAuthStatus() async {
        // Check if tokens exist
        guard authService.loadStoredTokens() else {
            state = .unauthenticated
            return
        }

        // Tokens exist - show map immediately (optimistic)
        // Try to validate/refresh in background
        do {
            try await authService.refreshTokens()

            // Validate and get user profile
            if let profile = await authService.validateTokens() {
                currentUser = CurrentUser(
                    id: profile.id,
                    username: profile.username,
                    displayName: profile.displayName,
                    email: profile.email
                )
                state = .authenticated
            } else {
                // Token validation failed
                state = .unauthenticated
            }
        } catch {
            // Refresh failed - tokens are invalid
            state = .unauthenticated
        }
    }

    /// Sign in with Apple using the identity token.
    ///
    /// - Parameters:
    ///   - identityToken: JWT from Apple Sign In
    ///   - fullName: Name components (only on first sign-in)
    ///   - email: Email (only on first sign-in)
    func signInWithApple(
        identityToken: String,
        fullName: PersonNameComponents?,
        email: String?
    ) async {
        // Clear any previous error
        errorMessage = nil

        do {
            let response = try await authService.signInWithApple(
                identityToken: identityToken,
                fullName: fullName,
                email: email
            )

            // Set current user
            currentUser = CurrentUser(
                id: response.userId,
                username: response.username,
                displayName: nil,
                email: email
            )

            // Route based on whether this is a new user
            if response.isNewUser {
                state = .onboarding
            } else {
                state = .authenticated
            }
        } catch {
            // Per D-11: Show error message, stay on sign-in screen
            errorMessage = "Apple sign-in was interrupted. Tap to try again, or check your Apple ID settings if the problem persists."
            state = .unauthenticated
        }
    }

    /// Register a new account with username and password.
    ///
    /// New accounts always go through onboarding.
    func register(
        username: String,
        password: String,
        email: String?,
        displayName: String?
    ) async {
        errorMessage = nil

        do {
            let response = try await authService.register(
                username: username,
                password: password,
                email: email,
                displayName: displayName
            )

            currentUser = CurrentUser(
                id: response.userId,
                username: response.username,
                displayName: displayName,
                email: email
            )
            state = .onboarding
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Log in with username and password.
    func login(username: String, password: String) async {
        errorMessage = nil

        do {
            let response = try await authService.login(username: username, password: password)

            if let profile = await authService.validateTokens() {
                currentUser = CurrentUser(
                    id: profile.id,
                    username: profile.username,
                    displayName: profile.displayName,
                    email: profile.email
                )
            } else {
                currentUser = CurrentUser(
                    id: response.userId,
                    username: response.username,
                    displayName: nil,
                    email: nil
                )
            }
            state = .authenticated
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Complete onboarding and transition to authenticated state.
    func completeOnboarding() {
        state = .authenticated
    }

    /// Log out and return to sign-in screen.
    func logout() {
        authService.logout()
        currentUser = nil
        state = .unauthenticated
    }

    /// Dismiss the current error message.
    func dismissError() {
        errorMessage = nil
    }
}
