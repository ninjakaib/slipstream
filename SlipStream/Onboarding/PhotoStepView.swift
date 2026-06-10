//
//  PhotoStepView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import PhotosUI
import SwiftUI

/// Onboarding step for adding a profile photo.
///
/// Per D-02: Profile photo is optional -- can be skipped and added later from Profile settings.
/// Per D-12: Photo upload failures show retry option and "Skip for now" button.
///
/// This view stores the photo locally in the profileImage binding.
/// Actual upload to R2 is deferred to a future phase.
struct PhotoStepView: View {
    // MARK: - Properties

    /// Binding to store the selected profile image.
    @Binding var profileImage: UIImage?

    /// Callback when user taps Continue or Skip.
    var onNext: () -> Void

    /// Callback when user taps back button (nil on first step).
    var onBack: (() -> Void)?

    // MARK: - State

    /// Show the action sheet for choosing photo source.
    @State private var showActionSheet = false

    /// Show the PhotosPicker for library selection.
    @State private var showPhotoPicker = false

    /// Show the camera view for taking a photo.
    @State private var showCamera = false

    /// Selected item from PhotosPicker.
    @State private var selectedItem: PhotosPickerItem?

    /// Loading state while loading image from PhotosPicker.
    @State private var isLoading = false

    // MARK: - Body

    var body: some View {
        ZStack {
            // Background
            SlipStreamStyle.panel
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Back button
                if onBack != nil {
                    HStack {
                        Button {
                            onBack?()
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 44, height: 44)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                } else {
                    Spacer()
                        .frame(height: 44)
                }

                Spacer()

                // Headline
                Text("Add a profile photo")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.white)

                // Subheadline
                Text("Let others recognize you on the road")
                    .font(.system(size: 17))
                    .foregroundStyle(SlipStreamStyle.muted)

                // Photo preview area (120x120pt)
                ZStack {
                    if let image = profileImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 120, height: 120)
                            .clipShape(Circle())
                    } else {
                        Circle()
                            .fill(Color(.secondarySystemBackground))
                            .frame(width: 120, height: 120)
                            .overlay(
                                Image(systemName: "person.fill")
                                    .font(.system(size: 48))
                                    .foregroundStyle(SlipStreamStyle.muted)
                            )
                    }

                    // Loading indicator
                    if isLoading {
                        Circle()
                            .fill(.black.opacity(0.5))
                            .frame(width: 120, height: 120)
                            .overlay(
                                ProgressView()
                                    .tint(.white)
                            )
                    }
                }
                .padding(.top, 16)

                // Add/Change Photo button
                Button {
                    showActionSheet = true
                } label: {
                    Text(profileImage != nil ? "Change Photo" : "Add Photo")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(SlipStreamStyle.accent)
                }
                .disabled(isLoading)
                .confirmationDialog("Choose Photo Source", isPresented: $showActionSheet) {
                    Button("Camera") {
                        showCamera = true
                    }
                    Button("Photo Library") {
                        showPhotoPicker = true
                    }
                    Button("Cancel", role: .cancel) {}
                }

                Spacer()

                // Action buttons
                HStack(spacing: 16) {
                    // Skip button (per D-02: photo is optional)
                    Button {
                        onNext()
                    } label: {
                        Text("Skip for now")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(SlipStreamStyle.muted)
                    }

                    Spacer()

                    // Continue button
                    Button {
                        onNext()
                    } label: {
                        HStack(spacing: 8) {
                            Text("Continue")
                            Image(systemName: "arrow.right")
                        }
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 14)
                        .background(SlipStreamStyle.accent, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
        .photosPicker(
            isPresented: $showPhotoPicker,
            selection: $selectedItem,
            matching: .images
        )
        .fullScreenCover(isPresented: $showCamera) {
            CameraView(image: $profileImage)
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                await loadImage(from: newItem)
            }
        }
    }

    // MARK: - Private Methods

    /// Load image data from PhotosPickerItem.
    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item = item else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            if let data = try await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                await MainActor.run {
                    profileImage = uiImage
                }
            }
        } catch {
            // Per D-12: Photo upload failures show retry + skip
            // Since this is just loading locally, we silently fail
            // The user can try again via the "Add Photo" button
            print("Failed to load image: \(error.localizedDescription)")
        }
    }
}

// MARK: - Preview

#Preview {
    PhotoStepView(
        profileImage: .constant(nil),
        onNext: {},
        onBack: {}
    )
}
