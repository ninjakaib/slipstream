//
//  AuthService.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Combine
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

    /// Register a new account with username and password.
    ///
    /// - Parameters:
    ///   - username: Desired username (3-20 chars, alphanumeric/underscore)
    ///   - password: Password (8-128 chars)
    ///   - email: Optional email address
    ///   - displayName: Optional display name
    /// - Returns: TokenResponse with the new account's tokens
    func register(
        username: String,
        password: String,
        email: String?,
        displayName: String?
    ) async throws -> TokenResponse {
        let request = RegisterRequest(
            username: username,
            password: password,
            email: email,
            displayName: displayName
        )

        let response: TokenResponse = try await apiClient.request(
            "/auth/register",
            method: "POST",
            body: request,
            authenticated: false
        )

        keychainService.saveToken(response.accessToken, account: KeychainService.Account.accessToken)
        keychainService.saveToken(response.refreshToken, account: KeychainService.Account.refreshToken)

        return response
    }

    /// Log in with username and password.
    ///
    /// - Parameters:
    ///   - username: Account username
    ///   - password: Account password
    /// - Returns: TokenResponse with the account's tokens
    func login(username: String, password: String) async throws -> TokenResponse {
        let request = LoginRequest(username: username, password: password)

        let response: TokenResponse = try await apiClient.request(
            "/auth/login",
            method: "POST",
            body: request,
            authenticated: false
        )

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
