//
//  AuthModels.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Foundation

// MARK: - Apple Auth Request/Response

/// Full name components from Apple Sign In.
/// Apple only provides this on the first sign-in, so it must be captured immediately.
struct FullName: Codable {
    let givenName: String?
    let familyName: String?

    enum CodingKeys: String, CodingKey {
        case givenName = "given_name"
        case familyName = "family_name"
    }
}

/// Request body for POST /auth/apple endpoint.
struct AppleAuthRequest: Codable {
    let identityToken: String
    let fullName: FullName?
    let email: String?

    enum CodingKeys: String, CodingKey {
        case identityToken = "identity_token"
        case fullName = "full_name"
        case email
    }
}

/// Response from POST /auth/apple endpoint.
struct AppleAuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let userId: String
    let username: String
    let isNewUser: Bool

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case userId = "user_id"
        case username
        case isNewUser = "is_new_user"
    }
}

// MARK: - Username/Password Auth

/// Request body for POST /auth/register endpoint.
struct RegisterRequest: Codable {
    let username: String
    let password: String
    let email: String?
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case username
        case password
        case email
        case displayName = "display_name"
    }
}

/// Request body for POST /auth/login endpoint.
struct LoginRequest: Codable {
    let username: String
    let password: String
}

/// Response from POST /auth/register and POST /auth/login endpoints.
struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let userId: String
    let username: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case userId = "user_id"
        case username
    }
}

// MARK: - Token Refresh

/// Request body for POST /auth/refresh endpoint.
struct TokenRefreshRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

/// Response from POST /auth/refresh endpoint.
struct TokenRefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let userId: String
    let username: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case userId = "user_id"
        case username
    }
}

// MARK: - User Profile

/// Current user profile from GET /users/me endpoint.
struct UserProfile: Codable {
    let id: String
    let username: String
    let email: String?
    let displayName: String?
    let avatarUrl: String?
    let visibility: String
    let discoveryRadiusMiles: Int
    let speedUnit: String

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case visibility
        case discoveryRadiusMiles = "discovery_radius_miles"
        case speedUnit = "speed_unit"
    }
}

// MARK: - API Error

/// Standard error response from the backend.
struct APIError: Codable, Error, LocalizedError {
    let detail: String

    var errorDescription: String? {
        detail
    }
}
