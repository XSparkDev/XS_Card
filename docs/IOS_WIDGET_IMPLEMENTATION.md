# iOS Widget Implementation Guide

## Overview

iOS widget implementation uses WidgetKit (iOS 14+) with SwiftUI. The widget extension runs separately from the main app and uses App Groups for data sharing.

## Widget Extension Structure

### 1. Create Widget Extension Target
In Xcode:
1. File > New > Target
2. Select "Widget Extension"
3. Name: "XSCardWidget"
4. Language: Swift
5. Include Configuration Intent: No (for now)

### 2. XSCardWidget.swift (Main Entry Point)
**Location**: `ios/XSCardWidget/XSCardWidget.swift`

```swift
import WidgetKit
import SwiftUI

@main
struct XSCardWidget: Widget {
    let kind: String = "XSCardWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            XSCardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("XS Card")
        .description("Your digital business card on your home screen")
        .supportedFamilies([.systemSmall, .systemLarge])
    }
}
```

### 3. WidgetProvider.swift (Timeline Provider)
**Location**: `ios/XSCardWidget/WidgetProvider.swift`

```swift
import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), cardData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), cardData: loadCardData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let currentDate = Date()
        let entry = SimpleEntry(date: currentDate, cardData: loadCardData())
        
        // Update every hour
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        
        completion(timeline)
    }
    
    func loadCardData() -> CardWidgetData? {
        // Load data from App Group shared storage
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.p.zzles.xscard") else {
            return nil
        }
        
        guard let jsonString = sharedDefaults.string(forKey: "widgetData"),
              let jsonData = jsonString.data(using: .utf8) else {
            return nil
        }
        
        return try? JSONDecoder().decode(CardWidgetData.self, from: jsonData)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let cardData: CardWidgetData?
}

struct CardWidgetData: Codable {
    let name: String
    let company: String
    let occupation: String
    let email: String
    let phone: String
    let colorScheme: String
    let qrCodeData: String?
}
```

### 4. WidgetView.swift (SwiftUI Views)
**Location**: `ios/XSCardWidget/WidgetView.swift`

```swift
import WidgetKit
import SwiftUI

struct XSCardWidgetEntryView : View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(cardData: entry.cardData)
        case .systemLarge:
            LargeWidgetView(cardData: entry.cardData)
        default:
            EmptyView()
        }
    }
}

struct SmallWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        if let data = cardData {
            ZStack {
                Color(hex: data.colorScheme)
                
                VStack {
                    // QR Code placeholder
                    Image(systemName: "qrcode")
                        .resizeMode(.fit)
                        .frame(width: 100, height: 100)
                        .foregroundColor(.white)
                    
                    Text(data.name)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                .padding()
            }
        } else {
            ZStack {
                Color(.systemBlue)
                Text("No Data")
                    .foregroundColor(.white)
            }
        }
    }
}

struct LargeWidgetView: View {
    let cardData: CardWidgetData?
    
    var body: some View {
        if let data = cardData {
            ZStack {
                Color(hex: data.colorScheme)
                
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .frame(width: 50, height: 50)
                            .foregroundColor(.white)
                        
                        VStack(alignment: .leading) {
                            Text(data.name)
                                .font(.headline)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            Text(data.occupation)
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.9))
                            Text(data.company)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.8))
                        }
                        Spacer()
                    }
                    
                    Spacer()
                    
                    // QR Code placeholder
                    Image(systemName: "qrcode")
                        .resizable()
                        .frame(width: 120, height: 120)
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.white.opacity(0.2))
                        .cornerRadius(12)
                    
                    Spacer()
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("📧 \\(data.email)")
                            .font(.caption)
                            .foregroundColor(.white)
                        Text("📱 \\(data.phone)")
                            .font(.caption)
                            .foregroundColor(.white)
                    }
                }
                .padding()
            }
        } else {
            ZStack {
                Color(.systemBlue)
                VStack {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.white)
                    Text("No widget data")
                        .foregroundColor(.white)
                }
            }
        }
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
```

### 5. WidgetBridge.swift (React Native Bridge)
**Location**: `ios/XSCard/WidgetBridge.swift`

```swift
import Foundation

@objc(WidgetBridge)
class WidgetBridge: NSObject {
    
    @objc
    func createWidget(
        _ cardIndex: NSNumber,
        cardData: NSDictionary,
        config: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        // Save widget data to App Group
        saveWidgetData(cardData: cardData)
        
        // Generate widget ID
        let widgetId = "widget_\\(cardIndex)_\\(Date().timeIntervalSince1970)"
        
        // Reload widget timelines
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        let result: [String: Any] = ["widgetId": widgetId]
        resolve(result)
    }
    
    @objc
    func updateWidget(
        _ widgetId: String,
        data: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        // Update widget data in App Group
        saveWidgetData(cardData: data)
        
        // Reload widget timelines
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        resolve(true)
    }
    
    @objc
    func deleteWidget(
        _ widgetId: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        // Clear widget data from App Group
        clearWidgetData()
        
        // Reload widget timelines
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        resolve(true)
    }
    
    @objc
    func getActiveWidgets(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        // Return empty array for now (implementation needed)
        resolve([])
    }
    
    private func saveWidgetData(cardData: NSDictionary) {
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.p.zzles.xscard") else {
            return
        }
        
        let widgetData: [String: Any] = [
            "name": cardData["name"] as? String ?? "",
            "company": cardData["company"] as? String ?? "",
            "occupation": cardData["occupation"] as? String ?? "",
            "email": cardData["email"] as? String ?? "",
            "phone": cardData["phone"] as? String ?? "",
            "colorScheme": cardData["colorScheme"] as? String ?? "#1B2B5B",
            "qrCodeData": cardData["qrCodeData"] as? String ?? ""
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: widgetData),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            sharedDefaults.set(jsonString, forKey: "widgetData")
        }
    }
    
    private func clearWidgetData() {
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.p.zzles.xscard") else {
            return
        }
        sharedDefaults.removeObject(forKey: "widgetData")
    }
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
```

### 6. WidgetBridge.m (Objective-C Bridge)
**Location**: `ios/XSCard/WidgetBridge.m`

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetBridge, NSObject)

RCT_EXTERN_METHOD(createWidget:(nonnull NSNumber *)cardIndex
                  cardData:(NSDictionary *)cardData
                  config:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateWidget:(NSString *)widgetId
                  data:(NSDictionary *)data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deleteWidget:(NSString *)widgetId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getActiveWidgets:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

### 7. Configure App Groups

1. In Xcode, select the main app target
2. Go to "Signing & Capabilities"
3. Add "App Groups" capability
4. Create group: `group.com.p.zzles.xscard`
5. Repeat for the widget extension target

### 8. Info.plist for Widget Extension
**Location**: `ios/XSCardWidget/Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>XSCardWidget</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
</dict>
</plist>
```

## Setup Instructions

1. Create Widget Extension target in Xcode
2. Add all Swift files to the widget extension
3. Add WidgetBridge.swift and .m to main app target
4. Configure App Groups for both targets
5. Build and run on device (widgets don't work in simulator well)

## Testing

- Add widget from home screen widget gallery
- Verify data loads from App Group
- Test small and large widget sizes
- Update card data and verify widget refreshes
- Test timeline updates

## Notes

- Widgets require iOS 14+
- QR code generation needs implementation
- Image loading from shared container needs setup
- Widget refresh uses WidgetCenter API
- All widget code ready for plug-and-play when iOS device is available





