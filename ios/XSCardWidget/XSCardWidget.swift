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
        .description("Your digital business card on your home screen and lock screen")
        .supportedFamilies([
            .systemSmall, 
            .systemMedium, 
            .systemLarge,
            .accessoryRectangular // Lock Screen widget
        ])
        .contentMarginsDisabled() // Prevent extra padding on iOS 17+
    }
}
