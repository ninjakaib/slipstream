//
//  VehicleDataService.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import Foundation

// MARK: - Response Models

/// NHTSA vPIC API response for vehicle makes.
struct NHTSAMakesResponse: Codable {
    let Count: Int
    let Results: [VehicleMake]
}

/// Vehicle make from NHTSA vPIC API.
struct VehicleMake: Codable, Identifiable, Equatable {
    let MakeId: Int
    let MakeName: String

    var id: Int { MakeId }

    /// Custom option for cars not in database (per D-05).
    static let customOption = VehicleMake(MakeId: -1, MakeName: "Other / Custom")
}

/// NHTSA vPIC API response for vehicle models.
struct NHTSAModelsResponse: Codable {
    let Count: Int
    let Results: [VehicleModel]
}

/// Vehicle model from NHTSA vPIC API.
struct VehicleModel: Codable, Identifiable, Equatable {
    let Make_ID: Int
    let Make_Name: String
    let Model_ID: Int
    let Model_Name: String

    var id: Int { Model_ID }

    /// Custom option for models not in database (per D-05).
    static func customOption(makeName: String) -> VehicleModel {
        VehicleModel(
            Make_ID: -1,
            Make_Name: makeName,
            Model_ID: -1,
            Model_Name: "Other / Custom"
        )
    }
}

// MARK: - Vehicle Data Service

/// Actor-based service for fetching vehicle data from NHTSA vPIC API.
///
/// Provides year, make, and model data for the car entry form.
/// Per D-04: Uses NHTSA vPIC API for year/make/model cascading pickers.
/// Per D-05: Includes "Other / Custom" option at end of every picker.
actor VehicleDataService {
    // MARK: - Configuration

    private let baseURL = "https://vpic.nhtsa.dot.gov/api/vehicles"

    /// Cached makes list (static data, fetched once per session).
    private var makesCache: [VehicleMake]?

    // MARK: - Errors

    enum VehicleDataError: Error, LocalizedError {
        case invalidURL
        case networkError(underlying: Error)
        case decodingFailed

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid API URL"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .decodingFailed:
                return "Failed to decode vehicle data"
            }
        }
    }

    // MARK: - Public Methods

    /// Get available vehicle years.
    ///
    /// Returns years from 1980 to current year + 1 (for next model year).
    /// NHTSA vPIC has no endpoint for years, so we generate client-side.
    /// Marked nonisolated so SwiftUI views can call it synchronously — it
    /// touches no actor-isolated state.
    nonisolated func getYears() -> [Int] {
        let currentYear = Calendar.current.component(.year, from: Date())
        return Array((1980...(currentYear + 1)).reversed())
    }

    /// Fetch vehicle makes from NHTSA vPIC API.
    ///
    /// Results are cached since the makes list is static.
    /// Per D-05: Appends "Other / Custom" option at end.
    ///
    /// - Returns: Array of vehicle makes sorted by name, with custom option at end.
    func getMakes() async throws -> [VehicleMake] {
        // Return cached data if available
        if let cached = makesCache {
            return cached
        }

        // Build URL
        guard let url = URL(string: "\(baseURL)/GetMakesForVehicleType/car?format=json") else {
            throw VehicleDataError.invalidURL
        }

        // Fetch data
        let data: Data
        do {
            let (responseData, _) = try await URLSession.shared.data(from: url)
            data = responseData
        } catch {
            throw VehicleDataError.networkError(underlying: error)
        }

        // Decode response
        let response: NHTSAMakesResponse
        do {
            response = try JSONDecoder().decode(NHTSAMakesResponse.self, from: data)
        } catch {
            throw VehicleDataError.decodingFailed
        }

        // Sort by name and append custom option
        var makes = response.Results.sorted { $0.MakeName < $1.MakeName }
        makes.append(VehicleMake.customOption)

        // Cache the result
        makesCache = makes

        return makes
    }

    /// Fetch vehicle models for a make and year from NHTSA vPIC API.
    ///
    /// Per D-05: Appends "Other / Custom" option at end.
    ///
    /// - Parameters:
    ///   - make: The vehicle make name
    ///   - year: The model year
    /// - Returns: Array of vehicle models sorted by name, with custom option at end.
    func getModels(make: String, year: Int) async throws -> [VehicleModel] {
        // URL encode the make name (handles spaces and special characters)
        guard let encodedMake = make.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            throw VehicleDataError.invalidURL
        }

        // Build URL
        guard let url = URL(string: "\(baseURL)/GetModelsForMakeYear/make/\(encodedMake)/modelyear/\(year)?format=json") else {
            throw VehicleDataError.invalidURL
        }

        // Fetch data
        let data: Data
        do {
            let (responseData, _) = try await URLSession.shared.data(from: url)
            data = responseData
        } catch {
            throw VehicleDataError.networkError(underlying: error)
        }

        // Decode response
        let response: NHTSAModelsResponse
        do {
            response = try JSONDecoder().decode(NHTSAModelsResponse.self, from: data)
        } catch {
            throw VehicleDataError.decodingFailed
        }

        // Sort by model name and append custom option
        var models = response.Results.sorted { $0.Model_Name < $1.Model_Name }
        models.append(VehicleModel.customOption(makeName: make))

        return models
    }

    /// Clear the makes cache (for testing or refresh purposes).
    func clearCache() {
        makesCache = nil
    }
}
