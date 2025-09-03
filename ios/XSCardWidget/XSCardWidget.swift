import WidgetKit
import SwiftUI

struct XSCardWidget: Widget {
    let kind: String = "XSCardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: XSCardWidgetProvider()) { entry in
            XSCardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("XSCard Widget")
        .description("Display your digital business card QR code on your home screen.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct XSCardWidget_Previews: PreviewProvider {
    static var previews: some View {
        XSCardWidgetEntryView(entry: XSCardWidgetEntry.placeholder)
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
