import SwiftUI
import WidgetKit

struct XSCardWidgetEntryView: View {
    var entry: XSCardWidgetProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(hex: entry.cardData?.colorScheme ?? "#4CAF50"),
                    Color(hex: entry.cardData?.colorScheme ?? "#4CAF50").opacity(0.8)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Widget content
            VStack {
                if let qrCodeData = entry.qrCodeData {
                    QRCodeView(data: qrCodeData, size: qrCodeSize)
                        .background(Color.white)
                        .cornerRadius(8)
                        .shadow(radius: 2)
                    
                    // Show name only for medium widgets
                    if family == .systemMedium, let cardData = entry.cardData {
                        Text(cardData.name)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .padding(.top, 4)
                    }
                } else {
                    // Fallback UI when no data is available
                    VStack {
                        Image(systemName: "qrcode")
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.7))
                        Text("XSCard")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
            }
            .padding()
        }
    }
    
    private var qrCodeSize: CGFloat {
        switch family {
        case .systemSmall:
            return 80
        case .systemMedium:
            return 100
        default:
            return 80
        }
    }
}

struct QRCodeView: View {
    let data: String
    let size: CGFloat
    
    var body: some View {
        if let qrImage = generateQRCode(from: data) {
            Image(uiImage: qrImage)
                .interpolation(.none)
                .resizable()
                .frame(width: size, height: size)
        } else {
            Rectangle()
                .fill(Color.gray.opacity(0.3))
                .frame(width: size, height: size)
                .overlay(
                    Text("QR")
                        .font(.caption)
                        .foregroundColor(.gray)
                )
        }
    }
    
    private func generateQRCode(from string: String) -> UIImage? {
        let data = Data(string.utf8)
        
        if let filter = CIFilter(name: "CIQRCodeGenerator") {
            filter.setValue(data, forKey: "inputMessage")
            let transform = CGAffineTransform(scaleX: 10, y: 10)
            
            if let output = filter.outputImage?.transformed(by: transform) {
                let context = CIContext()
                if let cgImage = context.createCGImage(output, from: output.extent) {
                    return UIImage(cgImage: cgImage)
                }
            }
        }
        
        return nil
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

