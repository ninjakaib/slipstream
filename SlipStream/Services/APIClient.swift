//
//  APIClient.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Foundation

/// Actor-based HTTP client for backend API communication.
///
/// Handles authentication, automatic token refresh on 401 responses,
/// and JSON encoding/decoding.
actor APIClient {
    // MARK: - Configuration

    /// Base URL for the API. Can be overridden via environment variable.
    let baseURL: URL

    /// Keychain service for token storage
    private let keychainService: KeychainService

    /// Flag to prevent recursive refresh attempts
    private var isRefreshing = false

    // MARK: - Errors

    enum APIClientError: Error, LocalizedError {
        case invalidURL
        case encodingFailed
        case decodingFailed
        case noData
        case unauthorized
        case serverError(statusCode: Int, message: String)
        case networkError(underlying: Error)
        case tokenRefreshFailed

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid API URL"
            case .encodingFailed:
                return "Failed to encode request body"
            case .decodingFailed:
                return "Failed to decode response"
            case .noData:
                return "No data received from server"
            case .unauthorized:
                return "Not authorized"
            case .serverError(let code, let message):
                return "Server error (\(code)): \(message)"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .tokenRefreshFailed:
                return "Failed to refresh authentication token"
            }
        }
    }

    // MARK: - Initialization

    init(keychainService: KeychainService = KeychainService()) {
        // Check for environment override
        if let urlString = ProcessInfo.processInfo.environment["SLIPSTREAM_API_URL"],
           let url = URL(string: urlString) {
            self.baseURL = url
        } else {
            // Default to production URL
            self.baseURL = URL(string: "https://api.slipstream.app")!
        }
        self.keychainService = keychainService
    }

    // MARK: - Public Methods

    /// Make an HTTP request to the API.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint path (e.g., "/auth/apple")
    ///   - method: HTTP method (GET, POST, PATCH, DELETE)
    ///   - body: Optional request body (will be JSON encoded)
    ///   - authenticated: Whether to include Authorization header
    /// - Returns: Decoded response of type T
    func request<T: Decodable>(
        _ endpoint: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        // Build URL
        guard let url = URL(string: endpoint, relativeTo: baseURL) else {
            throw APIClientError.invalidURL
        }

        // Build request
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Add auth header if needed
        if authenticated {
            if let accessToken = keychainService.retrieveToken(account: KeychainService.Account.accessToken) {
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            }
        }

        // Encode body if provided
        if let body = body {
            do {
                let encoder = JSONEncoder()
                request.httpBody = try encoder.encode(body)
            } catch {
                throw APIClientError.encodingFailed
            }
        }

        // Make the request
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIClientError.networkError(underlying: error)
        }

        // Check response status
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.noData
        }

        // Handle 401 - attempt token refresh once
        if httpResponse.statusCode == 401 && authenticated && !isRefreshing {
            do {
                try await refreshTokenIfNeeded()
                // Retry the original request with new token. Use self. to disambiguate
                // from the local `request` URLRequest variable that shadows this method.
                return try await self.request(endpoint, method: method, body: body, authenticated: authenticated)
            } catch {
                throw APIClientError.unauthorized
            }
        }

        // Handle other errors
        if httpResponse.statusCode >= 400 {
            // Try to decode error response
            if let apiError = try? JSONDecoder().decode(APIError.self, from: data) {
                throw APIClientError.serverError(statusCode: httpResponse.statusCode, message: apiError.detail)
            }
            throw APIClientError.serverError(statusCode: httpResponse.statusCode, message: "Unknown error")
        }

        // Decode successful response
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIClientError.decodingFailed
        }
    }

    /// Refresh the access token using the stored refresh token.
    ///
    /// This is called automatically on 401 responses, but can also be called
    /// proactively when the app resumes from background.
    func refreshTokenIfNeeded() async throws {
        // Prevent concurrent refresh attempts
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        // Get stored refresh token
        guard let refreshToken = keychainService.retrieveToken(account: KeychainService.Account.refreshToken) else {
            throw APIClientError.tokenRefreshFailed
        }

        // Build refresh request
        let refreshRequest = TokenRefreshRequest(refreshToken: refreshToken)

        // Make the refresh call (not authenticated - uses refresh token in body)
        let response: TokenRefreshResponse = try await request(
            "/auth/refresh",
            method: "POST",
            body: refreshRequest,
            authenticated: false
        )

        // Store new tokens
        keychainService.saveToken(response.accessToken, account: KeychainService.Account.accessToken)
        keychainService.saveToken(response.refreshToken, account: KeychainService.Account.refreshToken)
    }
}
