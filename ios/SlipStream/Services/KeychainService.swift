//
//  KeychainService.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Foundation
import Security

/// Secure token storage using iOS Keychain.
///
/// Uses kSecAttrAccessibleAfterFirstUnlock to support background token refresh
/// when the device is locked.
final class KeychainService {
    // MARK: - Constants

    private let service = "com.slipstream.auth"

    /// Account identifiers for different token types
    enum Account {
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
    }

    // MARK: - Public Methods

    /// Save a token to the Keychain.
    ///
    /// - Parameters:
    ///   - token: The token string to store
    ///   - account: The account identifier (use Account constants)
    /// - Returns: true if save succeeded, false otherwise
    @discardableResult
    func saveToken(_ token: String, account: String) -> Bool {
        guard let tokenData = token.data(using: .utf8) else {
            return false
        }

        // Build the query for deletion and addition
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        // Delete any existing item first (per Keychain best practice)
        SecItemDelete(query as CFDictionary)

        // Add the new item with secure accessibility
        var addQuery = query
        addQuery[kSecValueData as String] = tokenData
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Retrieve a token from the Keychain.
    ///
    /// - Parameter account: The account identifier (use Account constants)
    /// - Returns: The token string if found, nil otherwise
    func retrieveToken(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }

        return token
    }

    /// Delete a specific token from the Keychain.
    ///
    /// - Parameter account: The account identifier (use Account constants)
    func deleteToken(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        SecItemDelete(query as CFDictionary)
    }

    /// Delete all tokens from the Keychain (for logout).
    func deleteAllTokens() {
        deleteToken(account: Account.accessToken)
        deleteToken(account: Account.refreshToken)
    }

    /// Check if an access token exists in the Keychain.
    var hasStoredTokens: Bool {
        retrieveToken(account: Account.accessToken) != nil
    }
}
