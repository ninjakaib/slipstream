//
//  CarStepView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import SwiftUI

// MARK: - Car Color

/// Predefined car colors for selection.
enum CarColor: String, CaseIterable, Identifiable {
    case black = "Black"
    case white = "White"
    case silver = "Silver"
    case gray = "Gray"
    case red = "Red"
    case blue = "Blue"
    case green = "Green"
    case yellow = "Yellow"
    case orange = "Orange"
    case purple = "Purple"
    case brown = "Brown"
    case gold = "Gold"

    var id: String { rawValue }

    /// Hex color value for display.
    var hex: String {
        switch self {
        case .black: return "#000000"
        case .white: return "#FFFFFF"
        case .silver: return "#C0C0C0"
        case .gray: return "#808080"
        case .red: return "#FF0000"
        case .blue: return "#0000FF"
        case .green: return "#008000"
        case .yellow: return "#FFFF00"
        case .orange: return "#FFA500"
        case .purple: return "#800080"
        case .brown: return "#8B4513"
        case .gold: return "#FFD700"
        }
    }

    /// SwiftUI Color for display.
    var color: Color {
        switch self {
        case .black: return .black
        case .white: return .white
        case .silver: return Color(red: 0.75, green: 0.75, blue: 0.75)
        case .gray: return .gray
        case .red: return .red
        case .blue: return .blue
        case .green: return .green
        case .yellow: return .yellow
        case .orange: return .orange
        case .purple: return .purple
        case .brown: return .brown
        case .gold: return Color(red: 1.0, green: 0.84, blue: 0.0)
        }
    }
}

// MARK: - Create Car Request

/// Request body for POST /cars endpoint.
struct CreateCarRequest: Encodable {
    let year: Int
    let make: String
    let model: String
    let trim: String?
    let color: String
    let display_name: String?
    let photo_url: String?
    let mods: [String]?
}

/// Response from POST /cars endpoint.
struct CreateCarResponse: Decodable {
    let id: String
    let year: Int
    let make: String
    let model: String
    let trim: String?
    let color: String
    let display_name: String?
    let photo_url: String?
    let mods: [String]?
    let is_active: Bool
    let created_at: String
}

// MARK: - Car Step View

/// Onboarding step for adding the user's first car.
///
/// Per D-03: Car is required -- user cannot proceed without completing this step.
/// Per D-04: Uses NHTSA vPIC API for year/make/model cascading pickers.
/// Per D-05: Includes "Other / Custom" option at end of every picker.
/// Per D-06: Display name field decouples database identity from enthusiast identity.
struct CarStepView: View {
    // MARK: - Properties

    /// Callback when car is successfully created.
    var onComplete: () -> Void

    /// Callback when user taps back button.
    var onBack: (() -> Void)?

    /// Auth state for API client access.
    @EnvironmentObject var authState: AuthState

    // MARK: - State

    /// Selected year.
    @State private var selectedYear: Int?

    /// Selected make from NHTSA API.
    @State private var selectedMake: VehicleMake?

    /// Selected model from NHTSA API.
    @State private var selectedModel: VehicleModel?

    /// Custom make name (when "Other / Custom" selected).
    @State private var customMake: String = ""

    /// Custom model name (when "Other / Custom" selected).
    @State private var customModel: String = ""

    /// Optional trim level.
    @State private var trim: String = ""

    /// Display name for the car (per D-06).
    @State private var displayName: String = ""

    /// Selected color.
    @State private var selectedColor: CarColor?

    /// Loading state for API calls.
    @State private var isLoading = false

    /// Loading state for makes.
    @State private var isLoadingMakes = false

    /// Loading state for models.
    @State private var isLoadingModels = false

    /// Error message to display.
    @State private var errorMessage: String?

    /// Available makes from NHTSA API.
    @State private var makes: [VehicleMake] = []

    /// Available models from NHTSA API.
    @State private var models: [VehicleModel] = []

    /// Vehicle data service.
    private let vehicleDataService = VehicleDataService()

    /// API client for car creation.
    private let apiClient = APIClient()

    // MARK: - Computed Properties

    /// Whether the form is valid and can be submitted.
    private var isFormValid: Bool {
        // Year required
        guard selectedYear != nil else { return false }

        // Make required (either from picker or custom)
        if selectedMake?.MakeId == -1 {
            guard customMake.count >= 2 else { return false }
        } else {
            guard selectedMake != nil else { return false }
        }

        // Model required (either from picker or custom)
        if selectedModel?.Model_ID == -1 {
            guard customModel.count >= 2 else { return false }
        } else {
            guard selectedModel != nil else { return false }
        }

        // Color required
        guard selectedColor != nil else { return false }

        return true
    }

    /// Effective make name for API request.
    private var effectiveMake: String {
        if selectedMake?.MakeId == -1 {
            return customMake
        }
        return selectedMake?.MakeName ?? ""
    }

    /// Effective model name for API request.
    private var effectiveModel: String {
        if selectedModel?.Model_ID == -1 {
            return customModel
        }
        return selectedModel?.Model_Name ?? ""
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            SlipStreamStyle.panel
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header with back button
                HStack {
                    if onBack != nil {
                        Button {
                            onBack?()
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 44, height: 44)
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)

                ScrollView {
                    VStack(spacing: 24) {
                        // Headline
                        VStack(spacing: 8) {
                            Text("Add your car")
                                .font(.system(size: 28, weight: .semibold))
                                .foregroundStyle(.white)

                            Text("Show off what you drive")
                                .font(.system(size: 17))
                                .foregroundStyle(SlipStreamStyle.muted)
                        }
                        .padding(.top, 16)

                        // Form fields
                        VStack(spacing: 16) {
                            // Year picker
                            yearPicker

                            // Make picker
                            makePicker

                            // Model picker
                            modelPicker

                            // Trim field (optional)
                            trimField

                            // Display name field (per D-06)
                            displayNameField

                            // Color picker
                            colorPicker
                        }
                        .padding(.horizontal, 24)

                        // Error message
                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 14))
                                .foregroundStyle(.red)
                                .padding(.horizontal, 24)
                        }

                        Spacer()
                            .frame(height: 32)
                    }
                }

                // Get Started button
                VStack {
                    PrimaryActionButton(
                        title: "Get Started",
                        systemImage: "flag.checkered"
                    ) {
                        Task {
                            await createCar()
                        }
                    }
                    .disabled(!isFormValid || isLoading)
                    .opacity(isFormValid && !isLoading ? 1.0 : 0.5)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }

            // Loading overlay
            if isLoading {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .overlay(
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(1.5)
                    )
            }
        }
        .onAppear {
            loadMakes()
        }
    }

    // MARK: - Form Fields

    private var yearPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Year")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SlipStreamStyle.faint)

            Menu {
                ForEach(vehicleDataService.getYears(), id: \.self) { year in
                    Button(String(year)) {
                        selectedYear = year
                        // Reset downstream selections
                        selectedMake = nil
                        selectedModel = nil
                        models = []
                        customMake = ""
                        customModel = ""
                    }
                }
            } label: {
                HStack {
                    Text(selectedYear.map { String($0) } ?? "Select year")
                        .foregroundStyle(selectedYear != nil ? .white : SlipStreamStyle.muted)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundStyle(SlipStreamStyle.muted)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(SlipStreamStyle.line, lineWidth: 1)
                )
            }
        }
    }

    private var makePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Make")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(SlipStreamStyle.faint)

                if isLoadingMakes {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }

            Menu {
                ForEach(makes) { make in
                    Button(make.MakeName) {
                        selectedMake = make
                        // Reset model selection
                        selectedModel = nil
                        models = []
                        customModel = ""

                        // Load models if not custom
                        if make.MakeId != -1 {
                            loadModels(for: make.MakeName)
                        }
                    }
                }
            } label: {
                HStack {
                    Text(selectedMake?.MakeName ?? "Select make")
                        .foregroundStyle(selectedMake != nil ? .white : SlipStreamStyle.muted)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundStyle(SlipStreamStyle.muted)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(SlipStreamStyle.line, lineWidth: 1)
                )
            }
            .disabled(selectedYear == nil || isLoadingMakes)
            .opacity(selectedYear == nil ? 0.5 : 1.0)

            // Custom make input (when "Other / Custom" selected)
            if selectedMake?.MakeId == -1 {
                TextField("Enter make name", text: $customMake)
                    .textFieldStyle(SlipStreamTextFieldStyle())
            }
        }
    }

    private var modelPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Model")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(SlipStreamStyle.faint)

                if isLoadingModels {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }

            // Show picker or custom field based on make selection
            if selectedMake?.MakeId == -1 {
                // Custom make selected - just show text field for model
                TextField("Enter model name", text: $customModel)
                    .textFieldStyle(SlipStreamTextFieldStyle())
            } else {
                Menu {
                    ForEach(models) { model in
                        Button(model.Model_Name) {
                            selectedModel = model
                        }
                    }
                } label: {
                    HStack {
                        Text(selectedModel?.Model_Name ?? "Select model")
                            .foregroundStyle(selectedModel != nil ? .white : SlipStreamStyle.muted)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .foregroundStyle(SlipStreamStyle.muted)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(SlipStreamStyle.line, lineWidth: 1)
                    )
                }
                .disabled(selectedMake == nil || isLoadingModels)
                .opacity(selectedMake == nil ? 0.5 : 1.0)

                // Custom model input (when "Other / Custom" selected from model picker)
                if selectedModel?.Model_ID == -1 {
                    TextField("Enter model name", text: $customModel)
                        .textFieldStyle(SlipStreamTextFieldStyle())
                }
            }
        }
    }

    private var trimField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Trim (optional)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SlipStreamStyle.faint)

            TextField("e.g., GT, Sport, Limited", text: $trim)
                .textFieldStyle(SlipStreamTextFieldStyle())
        }
    }

    private var displayNameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Display Name (optional)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SlipStreamStyle.faint)

            TextField("e.g., R32 GT-R, Panda AE86", text: $displayName)
                .textFieldStyle(SlipStreamTextFieldStyle())

            Text("How your car appears on the map")
                .font(.system(size: 12))
                .foregroundStyle(SlipStreamStyle.faint)
        }
    }

    private var colorPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Color")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(SlipStreamStyle.faint)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 6), spacing: 12) {
                ForEach(CarColor.allCases) { color in
                    Button {
                        selectedColor = color
                    } label: {
                        ZStack {
                            Circle()
                                .fill(color.color)
                                .frame(width: 40, height: 40)

                            // White border for white color visibility
                            if color == .white {
                                Circle()
                                    .stroke(SlipStreamStyle.line, lineWidth: 1)
                                    .frame(width: 40, height: 40)
                            }

                            // Selection indicator
                            if selectedColor == color {
                                Circle()
                                    .stroke(SlipStreamStyle.accent, lineWidth: 3)
                                    .frame(width: 48, height: 48)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadMakes() {
        Task {
            isLoadingMakes = true
            defer { isLoadingMakes = false }

            do {
                makes = try await vehicleDataService.getMakes()
            } catch {
                errorMessage = "Failed to load vehicle makes. Please try again."
            }
        }
    }

    private func loadModels(for make: String) {
        guard let year = selectedYear else { return }

        Task {
            isLoadingModels = true
            defer { isLoadingModels = false }

            do {
                models = try await vehicleDataService.getModels(make: make, year: year)
            } catch {
                // T-03-03: NHTSA API unavailable - "Other / Custom" fallback allows completion
                errorMessage = "Failed to load models. You can use 'Other / Custom' to enter manually."
            }
        }
    }

    // MARK: - Car Creation

    private func createCar() async {
        guard isFormValid, let year = selectedYear, let color = selectedColor else { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let request = CreateCarRequest(
            year: year,
            make: effectiveMake,
            model: effectiveModel,
            trim: trim.isEmpty ? nil : trim,
            color: color.hex,
            display_name: displayName.isEmpty ? nil : displayName,
            photo_url: nil,
            mods: nil
        )

        do {
            let _: CreateCarResponse = try await apiClient.request(
                "/cars",
                method: "POST",
                body: request,
                authenticated: true
            )

            // Success - complete onboarding
            await MainActor.run {
                onComplete()
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to create car: \(error.localizedDescription)"
            }
        }
    }
}

// MARK: - Custom Text Field Style

/// Custom text field style matching SlipStream design.
struct SlipStreamTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(SlipStreamStyle.panelRaised, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(SlipStreamStyle.line, lineWidth: 1)
            )
            .foregroundStyle(.white)
    }
}

// MARK: - Private Extension for Sync Years

private extension VehicleDataService {
    /// Synchronous version of getYears() for use in SwiftUI views.
    nonisolated func getYears() -> [Int] {
        let currentYear = Calendar.current.component(.year, from: Date())
        return Array((1980...(currentYear + 1)).reversed())
    }
}

// MARK: - Preview

#Preview {
    CarStepView(
        onComplete: {},
        onBack: {}
    )
    .environmentObject(AuthState())
}
