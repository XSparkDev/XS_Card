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
