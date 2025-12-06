import Foundation
import WidgetKit

@objc(WidgetBridge)
class WidgetBridge: NSObject {
    
    @objc
    func createWidget(
        _ cardIndex: NSNumber,
        cardData: NSDictionary,
        config: NSDictionary,
        resolver resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String, String, Error?) -> Void
    ) {
        // Save widget data to App Group
        saveWidgetData(cardData: cardData)
        
        // Generate widget ID
        let widgetId = "widget_\(cardIndex)_\(Date().timeIntervalSince1970)"
        
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
        resolver resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String, String, Error?) -> Void
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
        resolver resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String, String, Error?) -> Void
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
        _ resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String, String, Error?) -> Void
    ) {
        // Return empty array for now
        resolve([])
    }
    
    private func saveWidgetData(cardData: NSDictionary) {
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.p.zzles.xscard") else {
            print("❌ WidgetBridge: Failed to access App Group")
            return
        }
        
        let widgetData: [String: Any] = [
            "name": cardData["name"] as? String ?? "",
            "surname": cardData["surname"] as? String ?? "",
            "company": cardData["company"] as? String ?? "",
            "occupation": cardData["occupation"] as? String ?? "",
            "email": cardData["email"] as? String ?? "",
            "phone": cardData["phone"] as? String ?? "",
            "colorScheme": cardData["colorScheme"] as? String ?? "#1B2B5B",
            "qrCodeData": cardData["qrCodeData"] as? String ?? ""
        ]
        
        // Debug: log data coming from React Native
        if let qr = widgetData["qrCodeData"] as? String {
            print("🧩 WidgetBridge: Saving widget data with qrCodeData length = \(qr.count)")
        } else {
            print("🧩 WidgetBridge: Saving widget data with NO qrCodeData field")
        }
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: widgetData),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            sharedDefaults.set(jsonString, forKey: "widgetData")
            sharedDefaults.synchronize()
            print("✅ WidgetBridge: Saved widget data to App Group")
        } else {
            print("❌ WidgetBridge: Failed to serialize widget data")
        }
    }
    
    private func clearWidgetData() {
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.p.zzles.xscard") else {
            return
        }
        sharedDefaults.removeObject(forKey: "widgetData")
        sharedDefaults.synchronize()
        print("✅ WidgetBridge: Cleared widget data from App Group")
    }
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}

