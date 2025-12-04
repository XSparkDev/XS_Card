import WidgetKit
import SwiftUI

// MARK: - Backwards Compatible Background Extension
extension View {
    func widgetBackground(backgroundView: some View) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            return containerBackground(for: .widget) {
                backgroundView
            }
        } else {
            return background(backgroundView)
        }
    }
}

struct XSCardWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        // Wrap in error handling to prevent crashes
        Group {
            switch family {
            case .systemSmall:
                SmallWidgetView(cardData: entry.cardData)
            case .systemMedium:
                MediumWidgetView(cardData: entry.cardData)
            case .systemLarge:
                LargeWidgetView(cardData: entry.cardData)
            case .accessoryRectangular:
                LockScreenWidgetView(cardData: entry.cardData)
            default:
                // Fallback for unsupported families
                ErrorPlaceholderView(message: "Unsupported widget size")
            }
        }
        .widgetBackground(backgroundView: family == .accessoryRectangular ? Color.clear : Color.white) // Lock screen widgets are transparent
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
        .widgetBackground(backgroundView: Color.white)
    }
}

// MARK: - Small Widget View
struct SmallWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        GeometryReader { geometry in
            let side = min(geometry.size.width, geometry.size.height) * 0.9
            let borderColor = Color(hex: cardData?.colorScheme ?? "#1B2B5B")
            
            ZStack {
            if let data = cardData {
                    // QR Code with colored outline, scaled to fill most of the widget
                QRCodeView(
                    qrData: data.qrCodeData ?? "",
                        borderColor: borderColor,
                        size: side,
                        showBorder: false // We'll draw the border around the whole widget instead
                )
            } else {
                // Placeholder when no data
                VStack(spacing: 8) {
                    Image(systemName: "qrcode")
                            .font(.system(size: side * 0.5))
                        .foregroundColor(.gray)
                    Text("No Data")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
        }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetBackground(backgroundView: Color.white)
            // Match system widget corner radius and draw a thicker border along it
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(
                RoundedRectangle(cornerRadius: 22)
                    .stroke(borderColor, lineWidth: 10)
            )
        }
    }
}

// MARK: - Medium Widget View
struct MediumWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        GeometryReader { geometry in
        ZStack {
                // Content
            if let data = cardData {
                    HStack(spacing: 12) {
                        // QR Code on Left
                    QRCodeView(
                        qrData: data.qrCodeData ?? "",
                        borderColor: Color(hex: data.colorScheme),
                            size: min(geometry.size.width * 0.35, geometry.size.height * 0.8)
                    )
                    
                    // Text container on Right
                        VStack(alignment: .leading, spacing: 4) {
                        // Name and Surname combined (bold)
                        if !data.name.isEmpty || !data.surname.isEmpty {
                            let fullName = [data.name, data.surname]
                                .filter { !$0.isEmpty }
                                .joined(separator: " ")
                            Text(fullName)
                                    .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.black)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        
                        // Occupation (regular, smaller)
                        if !data.occupation.isEmpty {
                            Text(data.occupation)
                                    .font(.system(size: 12, weight: .regular))
                                .foregroundColor(.black)
                                .lineLimit(1)
                        }
                        
                        // Company (regular, smaller)
                        if !data.company.isEmpty {
                            Text(data.company)
                                    .font(.system(size: 12, weight: .regular))
                                .foregroundColor(.black)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
            } else {
                    // Placeholder when no data
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
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetBackground(backgroundView: Color.white)
        }
    }
}

// MARK: - Large Widget View
struct LargeWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Content
                if let data = cardData {
                    // QR Code with colored outline - scaled to fill widget
                    QRCodeView(
                        qrData: data.qrCodeData ?? "",
                        borderColor: Color(hex: data.colorScheme),
                        size: min(geometry.size.width, geometry.size.height) * 0.9,
                        showBorder: false // Widget border will act as the border
                    )
                } else {
                    // Placeholder when no data
                    VStack(spacing: 8) {
                        Image(systemName: "qrcode")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                        Text("No Data")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
            }
        }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetBackground(backgroundView: Color.white)
            // Match system widget corner radius and draw a thicker border along it
            .clipShape(RoundedRectangle(cornerRadius: 22))
            .overlay(
                RoundedRectangle(cornerRadius: 22)
                    .stroke(cardData != nil ? Color(hex: cardData!.colorScheme) : Color.gray, lineWidth: 10)
            )
        }
    }
}

// MARK: - Lock Screen Widget View
struct LockScreenWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        if let data = cardData {
            HStack(spacing: 8) {
                // Small QR code on left
                if let qrCodeData = data.qrCodeData, !qrCodeData.isEmpty, let qrImage = QRCodeGenerator.generateQRCode(
                    from: qrCodeData,
                    size: 40,
                    foregroundColor: .black,
                    backgroundColor: .white
                ) {
                    qrImage.asImage
                        .resizable()
                        .interpolation(.none)
                        .frame(width: 40, height: 40)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color(hex: data.colorScheme), lineWidth: 2)
                        )
                }
                
                // Name and company on right
                VStack(alignment: .leading, spacing: 2) {
                    if !data.name.isEmpty || !data.surname.isEmpty {
                        let fullName = [data.name, data.surname]
                            .filter { !$0.isEmpty }
                            .joined(separator: " ")
                        Text(fullName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                    }
                    
                    if !data.company.isEmpty {
                        Text(data.company)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            HStack {
                Image(systemName: "qrcode")
                    .font(.system(size: 20))
                    .foregroundColor(.secondary)
                Text("No widget data")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - QR Code View Component
struct QRCodeView: View {
    let qrData: String
    let borderColor: Color
    let size: CGFloat
    var showBorder: Bool = true
    
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
        .padding(showBorder ? 8 : 0) // Padding between QR code and border (for medium widget)
        .overlay(
            Group {
                if showBorder {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(borderColor, lineWidth: 3)
                }
            }
        )
        .background(Color.white)
        .padding(2) // Small outer padding
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
