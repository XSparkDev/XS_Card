import WidgetKit
import SwiftUI

struct XSCardWidgetEntry: TimelineEntry {
    let date: Date
    let cardData: WidgetCardData?
    let qrCodeData: String?
    
    static let placeholder = XSCardWidgetEntry(
        date: Date(),
        cardData: WidgetCardData(
            name: "John Doe",
            company: "Tech Corp",
            colorScheme: "#4CAF50",
            cardIndex: 0
        ),
        qrCodeData: "https://xscard-app-8ign.onrender.com/saveContact?userId=sample&cardIndex=0"
    )
}

struct WidgetCardData {
    let name: String
    let company: String
    let colorScheme: String
    let cardIndex: Int
}

struct XSCardWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> XSCardWidgetEntry {
        XSCardWidgetEntry.placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (XSCardWidgetEntry) -> ()) {
        let entry = XSCardWidgetEntry.placeholder
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [XSCardWidgetEntry] = []

        // Get widget data from shared container
        let widgetData = loadWidgetData()
        
        // Create entry for current time
        let currentDate = Date()
        let entry = XSCardWidgetEntry(
            date: currentDate,
            cardData: widgetData.cardData,
            qrCodeData: widgetData.qrCodeData
        )
        entries.append(entry)

        // Create timeline that updates every hour
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate)!
        let timeline = Timeline(entries: entries, policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private func loadWidgetData() -> (cardData: WidgetCardData?, qrCodeData: String?) {
        // Access shared container using App Groups
        guard let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.xscard.widgets") else {
            return (nil, nil)
        }
        
        let widgetDataURL = sharedContainer.appendingPathComponent("widgetData.json")
        
        do {
            let data = try Data(contentsOf: widgetDataURL)
            let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
            
            // Get the first enabled widget card
            if let enabledCards = json?["enabledCards"] as? [[String: Any]],
               let firstCard = enabledCards.first {
                
                let cardData = WidgetCardData(
                    name: firstCard["name"] as? String ?? "",
                    company: firstCard["company"] as? String ?? "",
                    colorScheme: firstCard["colorScheme"] as? String ?? "#4CAF50",
                    cardIndex: firstCard["index"] as? Int ?? 0
                )
                
                let userId = json?["userId"] as? String ?? "user123"
                let qrCodeData = "https://xscard-app-8ign.onrender.com/saveContact?userId=\(userId)&cardIndex=\(cardData.cardIndex)"
                
                return (cardData, qrCodeData)
            }
        } catch {
            print("Failed to load widget data: \(error)")
        }
        
        return (nil, nil)
    }
}
