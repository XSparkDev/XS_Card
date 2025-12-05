import Foundation
import CoreImage
import SwiftUI

// MARK: - QR Code Generator Utility
struct QRCodeGenerator {
    /// Generate a QR code image from string data
    static func generateQRCode(from string: String, size: CGSize) -> UIImage? {
        guard !string.isEmpty else { return nil }
        
        let data = string.data(using: String.Encoding.utf8)
        
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
            return nil
        }
        
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel") // Medium error correction
        
        guard let qrCodeImage = filter.outputImage else {
            return nil
        }
        
        // Scale the image to the desired size
        let scaleX = size.width / qrCodeImage.extent.size.width
        let scaleY = size.height / qrCodeImage.extent.size.height
        let transformedImage = qrCodeImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
        
        // Convert to UIImage
        let context = CIContext()
        guard let cgImage = context.createCGImage(transformedImage, from: transformedImage.extent) else {
            return nil
        }
        
        return UIImage(cgImage: cgImage)
    }
    
    /// Generate QR code image with specified size and colors
    static func generateQRCode(
        from string: String,
        size: CGFloat,
        foregroundColor: UIColor = .black,
        backgroundColor: UIColor = .white
    ) -> UIImage? {
        guard !string.isEmpty else { return nil }
        
        let data = string.data(using: String.Encoding.utf8)
        
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
            return nil
        }
        
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        
        guard let qrCodeImage = filter.outputImage else {
            return nil
        }
        
        // Apply color filters
        let colorFilter = CIFilter(name: "CIFalseColor")
        colorFilter?.setValue(qrCodeImage, forKey: "inputImage")
        colorFilter?.setValue(CIColor(color: foregroundColor), forKey: "inputColor0") // QR code color
        colorFilter?.setValue(CIColor(color: backgroundColor), forKey: "inputColor1") // Background color
        
        guard let coloredImage = colorFilter?.outputImage else {
            // Fallback: return uncolored QR code
            let scale = size / qrCodeImage.extent.size.width
            let scaledImage = qrCodeImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
            let context = CIContext()
            guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
                return nil
            }
            return UIImage(cgImage: cgImage)
        }
        
        // Scale to desired size - ensure valid dimensions
        let extentWidth = coloredImage.extent.size.width
        guard extentWidth > 0 else { return nil }
        
        let scale = size / extentWidth
        guard scale > 0 && scale.isFinite else { return nil }
        
        let scaledImage = coloredImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        
        // Convert to UIImage
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }
        
        return UIImage(cgImage: cgImage)
    }
}

// MARK: - Image Extension for SwiftUI
extension UIImage {
    /// Convert UIImage to SwiftUI Image
    var asImage: Image {
        Image(uiImage: self)
    }
}
