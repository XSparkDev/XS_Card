import SwiftUI
import WidgetKit

struct XSCardWidgetEntryView: View {
    var entry: XSCardWidgetProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeSquareWidgetView(entry: entry)
        case .accessoryRectangular:
            LockScreenWidgetView(entry: entry)
        @unknown default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Small Widget (Pure QR Code)
struct SmallWidgetView: View {
    var entry: XSCardWidgetProvider.Entry
    
    var body: some View {
        ZStack {
            // White background
            Color.white
            
            // QR Code centered
            if let qrCodeData = entry.qrCodeData {
                QRCodeView(data: qrCodeData, size: 100)
                    .padding(12)
            } else {
                // Fallback
                VStack(spacing: 8) {
                    Image(systemName: "qrcode")
                        .font(.title2)
                        .foregroundColor(.gray.opacity(0.5))
                    Text("XS Card")
                        .font(.caption2)
                        .foregroundColor(.gray.opacity(0.7))
                }
            }
        }
    }
}

// MARK: - Medium Widget (QR Code + Label)
struct MediumWidgetView: View {
    var entry: XSCardWidgetProvider.Entry
    
    var body: some View {
        ZStack {
            // White background
            Color.white
            
            VStack(spacing: 8) {
                Spacer()
                
                // QR Code
                if let qrCodeData = entry.qrCodeData {
                    QRCodeView(data: qrCodeData, size: 120)
                } else {
                    Image(systemName: "qrcode")
                        .font(.system(size: 60))
                        .foregroundColor(.gray.opacity(0.5))
                }
                
                Spacer()
                
                // XS Card label
                Text("XS Card")
                    .font(.system(size: 13, weight: .regular))
                    .foregroundColor(Color(hex: "#333333").opacity(0.7))
                    .padding(.bottom, 8)
            }
            .padding(16)
        }
    }
}

// MARK: - Large Square Widget (Large QR + Branding)
struct LargeSquareWidgetView: View {
    var entry: XSCardWidgetProvider.Entry
    
    var body: some View {
        ZStack {
            // Pure white background
            Color.white
            
            VStack(spacing: 12) {
                Spacer()
                
                // Large QR Code
                if let qrCodeData = entry.qrCodeData {
                    QRCodeView(data: qrCodeData, size: 240)
                        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
                } else {
                    Image(systemName: "qrcode")
                        .font(.system(size: 120))
                        .foregroundColor(.gray.opacity(0.4))
                }
                
                Spacer()
                
                // XS Card Branding
                Text("XS Card")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundColor(Color(hex: "#333333").opacity(0.7))
                    .tracking(0.5)
                    .padding(.bottom, 12)
            }
            .padding(20)
        }
    }
}

// MARK: - Medium Info Card (QR + User Info)
struct MediumInfoCardView: View {
    var entry: XSCardWidgetProvider.Entry
    
    var body: some View {
        ZStack {
            // White/light background
            Color(hex: "#F8F8F8")
            
            HStack(spacing: 16) {
                // Left: QR Code (40%)
                if let qrCodeData = entry.qrCodeData {
                    QRCodeView(data: qrCodeData, size: 100)
                        .frame(width: 100, height: 100)
                        .background(Color.white)
                        .cornerRadius(8)
                        .shadow(color: .black.opacity(0.08), radius: 4, x: 0, y: 2)
                } else {
                    Rectangle()
                        .fill(Color.white)
                        .frame(width: 100, height: 100)
                        .cornerRadius(8)
                        .overlay(
                            Image(systemName: "qrcode")
                                .foregroundColor(.gray.opacity(0.4))
                        )
                }
                
                // Right: User Info (60%)
                VStack(alignment: .leading, spacing: 4) {
                    // Full Name
                    if let cardData = entry.cardData {
                        Text("\(cardData.name) \(cardData.surname)")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color(hex: "#1A1A1A"))
                            .lineLimit(2)
                        
                        // Job Title (if available)
                        if let jobTitle = cardData.jobTitle, !jobTitle.isEmpty {
                            Text(jobTitle)
                                .font(.system(size: 13, weight: .regular))
                                .foregroundColor(Color(hex: "#666666"))
                                .lineLimit(1)
                        }
                        
                        // Company
                        Text(cardData.company)
                            .font(.system(size: 13, weight: .regular))
                            .foregroundColor(Color(hex: "#666666"))
                            .lineLimit(1)
                    } else {
                        Text("XS Card")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color(hex: "#1A1A1A"))
                        Text("Digital Business Card")
                            .font(.system(size: 13, weight: .regular))
                            .foregroundColor(Color(hex: "#666666"))
                    }
                    
                    Spacer()
                }
                
                Spacer()
            }
            .padding(16)
        }
    }
}

// MARK: - Lock Screen Widget (Compact Info Card)
struct LockScreenWidgetView: View {
    var entry: XSCardWidgetProvider.Entry
    
    var body: some View {
        HStack(spacing: 12) {
            // QR Code
            if let qrCodeData = entry.qrCodeData {
                QRCodeView(data: qrCodeData, size: 48)
                    .frame(width: 48, height: 48)
            } else {
                Image(systemName: "qrcode")
                    .font(.title3)
                    .frame(width: 48, height: 48)
            }
            
            // User Info
            VStack(alignment: .leading, spacing: 2) {
                if let cardData = entry.cardData {
                    Text("\(cardData.name) \(cardData.surname)")
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                    
                    if let jobTitle = cardData.jobTitle, !jobTitle.isEmpty {
                        Text(jobTitle)
                            .font(.system(size: 11, weight: .regular))
                            .opacity(0.8)
                            .lineLimit(1)
                    }
                    
                    Text(cardData.company)
                        .font(.system(size: 11, weight: .regular))
                        .opacity(0.8)
                        .lineLimit(1)
                } else {
                    Text("XS Card")
                        .font(.system(size: 14, weight: .semibold))
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

// MARK: - QR Code View
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
            filter.setValue("H", forKey: "inputCorrectionLevel") // High error correction
            
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

// MARK: - Color Extension
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
            (a, r, g, b) = (255, 255, 255, 255)
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
