//
//  CameraView.swift
//  SlipStream
//
//  Created by Claude on 6/10/26.
//

import SwiftUI
import UIKit

/// UIViewControllerRepresentable wrapper for UIImagePickerController camera capture.
///
/// Used when PhotosPicker is insufficient (PhotosPicker doesn't support camera).
/// This provides direct camera access for profile and car photos.
struct CameraView: UIViewControllerRepresentable {
    /// Binding to receive the captured image.
    @Binding var image: UIImage?

    /// Environment dismiss action.
    @Environment(\.dismiss) var dismiss

    // MARK: - UIViewControllerRepresentable

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {
        // No updates needed
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView

        init(_ parent: CameraView) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
