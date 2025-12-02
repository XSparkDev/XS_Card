import WidgetKit
import SwiftUI

struct XSCardWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        // Wrap in error handling to prevent crashes
        Group {
            switch family {
            case .systemSmall:
                SmallWidgetView(cardData: entry.cardData)
            case .systemLarge:
                LargeWidgetView(cardData: entry.cardData)
            default:
                // Fallback for unsupported families
                ErrorPlaceholderView(message: "Unsupported widget size")
            }
        }
        .background(Color.white) // Always have a background
    }
}

// MARK: - Error Placeholder View
struct ErrorPlaceholderView: View {
    let message: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 24))
                .foregroundColor(.gray)
            Text(message)
                .font(.caption)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
    }
}

// MARK: - Small Widget View
struct SmallWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        ZStack {
            // Transparent background
            Color.clear
            
            if let data = cardData {
                // QR Code with colored outline
                QRCodeView(
                    qrData: data.qrCodeData ?? "",
                    borderColor: Color(hex: data.colorScheme),
                    size: 80
                )
            } else {
                // Placeholder when no data
                VStack(spacing: 8) {
                    Image(systemName: "qrcode")
                        .font(.system(size: 40))
                        .foregroundColor(.gray)
                    Text("No Data")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
        }
    }
}

// MARK: - Large Widget View
struct LargeWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        ZStack {
            // White background
            Color.white
            
            if let data = cardData {
                HStack(spacing: 8) {
                    // QR Code on Left with colored outline
                    QRCodeView(
                        qrData: data.qrCodeData ?? "",
                        borderColor: Color(hex: data.colorScheme),
                        size: 75
                    )
                    
                    // Text container on Right
                    VStack(alignment: .leading, spacing: 3) {
                        // Name and Surname combined (bold)
                        if !data.name.isEmpty || !data.surname.isEmpty {
                            let fullName = [data.name, data.surname]
                                .filter { !$0.isEmpty }
                                .joined(separator: " ")
                            Text(fullName)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.black)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        
                        // Occupation (regular, smaller)
                        if !data.occupation.isEmpty {
                            Text(data.occupation)
                                .font(.system(size: 10, weight: .regular))
                                .foregroundColor(.black)
                                .lineLimit(1)
                        }
                        
                        // Company (regular, smaller)
                        if !data.company.isEmpty {
                            Text(data.company)
                                .font(.system(size: 10, weight: .regular))
                                .foregroundColor(.black)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(8)
            } else {
                // Placeholder when no data - show helpful message
                VStack(spacing: 8) {
                    Image(systemName: "qrcode")
                        .font(.system(size: 40))
                        .foregroundColor(.gray.opacity(0.5))
                    Text("No widget data")
                        .font(.caption)
                        .foregroundColor(.gray)
                    Text("Create widget in app first")
                        .font(.caption2)
                        .foregroundColor(.gray.opacity(0.7))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            }
        }
        .cornerRadius(10)
    }
}

// MARK: - QR Code View Component
struct QRCodeView: View {
    let qrData: String
    let borderColor: Color
    let size: CGFloat
    
    var body: some View {
        VStack(spacing: 0) {
            if !qrData.isEmpty, let qrImage = QRCodeGenerator.generateQRCode(
                from: qrData,
                size: size,
                foregroundColor: .black,
                backgroundColor: .white
            ) {
                // Display generated QR code
                qrImage.asImage
                    .resizable()
                    .interpolation(.none) // Important for QR codes - no smoothing
                    .frame(width: size, height: size)
            } else {
                // Placeholder when QR data is empty or generation fails
                ZStack {
                    Rectangle()
                        .fill(Color.white)
                        .frame(width: size, height: size)
                    
                    Image(systemName: "qrcode")
                        .font(.system(size: size * 0.5))
                        .foregroundColor(.gray)
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 2)
                .stroke(borderColor, lineWidth: 2)
        )
        .background(Color.white)
        .padding(2)
    }
}

// MARK: - Color Extension for Hex Colors
extension Color {
    init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        // Default to blue if invalid
        guard !hexSanitized.isEmpty else {
            self.init(.sRGB, red: 0.106, green: 0.169, blue: 0.357, opacity: 1.0) // Default #1B2B5B
            return
        }
        
        var int: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&int) else {
            // Invalid hex, use default blue
            self.init(.sRGB, red: 0.106, green: 0.169, blue: 0.357, opacity: 1.0)
            return
        }
        
        let a, r, g, b: UInt64
        switch hexSanitized.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            // Invalid length, use default blue
            (a, r, g, b) = (255, 27, 43, 91) // #1B2B5B
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
