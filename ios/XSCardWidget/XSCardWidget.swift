import WidgetKit
import SwiftUI

@main
struct XSCardWidgetBundle: WidgetBundle {
    var body: some Widget {
        XSCardWidget()
        XSCardLockScreenWidget()
    }
}

struct XSCardWidget: Widget {
    let kind: String = "XSCardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: XSCardWidgetProvider()) { entry in
            XSCardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("XS Card")
        .description("Display your digital business card QR code.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct XSCardLockScreenWidget: Widget {
    let kind: String = "XSCardLockScreenWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: XSCardWidgetProvider()) { entry in
            XSCardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("XS Card Lock Screen")
        .description("Quick access to your business card on lock screen.")
        .supportedFamilies([.accessoryRectangular])
    }
}

struct XSCardWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            XSCardWidgetEntryView(entry: XSCardWidgetEntry.placeholder)
                .previewContext(WidgetPreviewContext(family: .systemSmall))
                .previewDisplayName("Small")
            
            XSCardWidgetEntryView(entry: XSCardWidgetEntry.placeholder)
                .previewContext(WidgetPreviewContext(family: .systemMedium))
                .previewDisplayName("Medium")
            
            XSCardWidgetEntryView(entry: XSCardWidgetEntry.placeholder)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
                .previewDisplayName("Large")
            
            XSCardWidgetEntryView(entry: XSCardWidgetEntry.placeholder)
                .previewContext(WidgetPreviewContext(family: .accessoryRectangular))
                .previewDisplayName("Lock Screen")
        }
    }
}
