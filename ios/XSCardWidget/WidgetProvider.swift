import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    typealias Entry = SimpleEntry
    
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), cardData: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let cardData = loadCardData()
        let entry = SimpleEntry(date: Date(), cardData: cardData)
        print("📸 WidgetProvider: getSnapshot - cardData \(cardData != nil ? "found" : "missing")")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let currentDate = Date()
        let cardData = loadCardData()
        let entry = SimpleEntry(date: currentDate, cardData: cardData)
        
        print("📅 WidgetProvider: getTimeline - cardData \(cardData != nil ? "found" : "missing")")
        
        // Update every hour, or sooner if data is missing (check again in 1 minute)
        let nextUpdate: Date
        if cardData == nil {
            // If no data, check again in 1 minute
            nextUpdate = Calendar.current.date(byAdding: .minute, value: 1, to: currentDate) ?? currentDate
        } else {
            // If data exists, update every hour
            nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate) ?? currentDate
        }
        
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    func loadCardData() -> CardWidgetData? {
        // Load data from App Group shared storage
        guard let sharedDefaults = UserDefaults(suiteName: "group.com.p.zzles.xscard") else {
            print("❌ WidgetProvider: Failed to access App Group 'group.com.p.zzles.xscard'")
            return nil
        }
        
        guard let jsonString = sharedDefaults.string(forKey: "widgetData") else {
            print("⚠️ WidgetProvider: No widgetData found in App Group")
            return nil
        }
        
        // Debug: log raw JSON to verify qrCodeData
        print("📦 WidgetProvider: Raw widgetData JSON = \(jsonString)")
        
        guard let jsonData = jsonString.data(using: .utf8) else {
            print("❌ WidgetProvider: Failed to convert JSON string to data")
            return nil
        }
        
        do {
            let cardData = try JSONDecoder().decode(CardWidgetData.self, from: jsonData)
            print("✅ WidgetProvider: Loaded widget data for \(cardData.name) \(cardData.surname)")
            print("🔍 WidgetProvider: qrCodeData = \(cardData.qrCodeData ?? "nil")")
            return cardData
        } catch {
            print("❌ WidgetProvider: Failed to decode widget data: \(error.localizedDescription)")
            // Print raw JSON for debugging
            print("Raw JSON: \(jsonString)")
            return nil
        }
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let cardData: CardWidgetData?
}

struct CardWidgetData: Codable {
    let name: String
    let surname: String
    let company: String
    let occupation: String
    let email: String
    let phone: String
    let colorScheme: String
    let qrCodeData: String?
}
