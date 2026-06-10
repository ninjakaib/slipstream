//
//  AuthService.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Foundation

/// Service for authentication operations.
///
/// Handles Sign in with Apple, token refresh, and logout.
/// Uses APIClient for network requests and KeychainService for secure token storage.
@MainActor
final class AuthService: ObservableObject {
    // MARK: - Dependencies

    private let apiClient: APIClient
    private let keychainService: KeychainService

    // MARK: - Initialization

    init(apiClient: APIClient? = nil, keychainService: KeychainService = KeychainService()) {
        self.keychainService = keychainService
        self.apiClient = apiClient ?? APIClient(keychainService: keychainService)
    }

    // MARK: - Public Methods

    /// Sign in with Apple by exchanging the identity token for SlipStream tokens.
    ///
    /// - Parameters:
    ///   - identityToken: JWT identity token from Apple Sign In
    ///   - fullName: Optional name components (only provided on first sign-in)
    ///   - email: Optional email (only provided on first sign-in)
    /// - Returns: AppleAuthResponse with tokens and is_new_user flag
    func signInWithApple(
        identityToken: String,
        fullName: PersonNameComponents?,
        email: String?
    ) async throws -> AppleAuthResponse {
        // Convert PersonNameComponents to FullName
        var apiFullName: FullName? = nil
        if let fullName = fullName {
            apiFullName = FullName(
                givenName: fullName.givenName,
                familyName: fullName.familyName
            )
        }

        let request = AppleAuthRequest(
            identityToken: identityToken,
            fullName: apiFullName,
            email: email
        )

        let response: AppleAuthResponse = try await apiClient.request(
            "/auth/apple",
            method: "POST",
            body: request,
            authenticated: false
        )

        // Store tokens in Keychain
        keychainService.saveToken(response.accessToken, account: KeychainService.Account.accessToken)
        keychainService.saveToken(response.refreshToken, account: KeychainService.Account.refreshToken)

        return response
    }

    /// Refresh authentication tokens.
    ///
    /// Called silently when app resumes from background (per D-09).
    func refreshTokens() async throws {
        try await apiClient.refreshTokenIfNeeded()
    }

    /// Log out by clearing stored tokens.
    func logout() {
        keychainService.deleteAllTokens()
    }

    /// Check if tokens are stored in Keychain.
    ///
    /// - Returns: true if access token exists, false otherwise
    func loadStoredTokens() -> Bool {
        keychainService.hasStoredTokens
    }

    /// Validate stored tokens by making a request to /users/me.
    ///
    /// - Returns: UserProfile if tokens are valid, nil if invalid
    func validateTokens() async -> UserProfile? {
        do {
            let profile: UserProfile = try await apiClient.request(
                "/users/me",
                method: "GET",
                authenticated: true
            )
            return profile
        } catch {
            return nil
        }
    }
}

// MARK: - Foundation PersonNameComponents Extension

extension PersonNameComponents {
    /// Convert to API FullName model.
    var asFullName: FullName {
        FullName(givenName: givenName, familyName: familyName)
    }
}
