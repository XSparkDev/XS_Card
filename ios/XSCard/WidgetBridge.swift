import Foundation
import React
import WidgetKit

@objc(WidgetBridge)
class WidgetBridge: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func updateWidgetData(_ widgetData: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    do {
      try saveWidgetDataToSharedContainer(widgetData)
      refreshWidgets()
      resolver(nil)
    } catch {
      rejecter("WIDGET_UPDATE_ERROR", "Failed to update widget data", error)
    }
  }
  
  @objc
  func refreshAllWidgets(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    refreshWidgets()
    resolver(nil)
  }
  
  @objc
  func isWidgetSupported(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    resolver(true)
  }
  
  private func saveWidgetDataToSharedContainer(_ widgetData: NSDictionary) throws {
    guard let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.xscard.widgets") else {
      throw NSError(domain: "WidgetBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to access shared container"])
    }
    
    let widgetDataURL = sharedContainer.appendingPathComponent("widgetData.json")
    
    do {
      let jsonData = try JSONSerialization.data(withJSONObject: widgetData, options: [])
      try jsonData.write(to: widgetDataURL)
    } catch {
      throw NSError(domain: "WidgetBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to save widget data: \(error.localizedDescription)"])
    }
  }
  
  private func refreshWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

// Bridge module registration
@objc(WidgetBridgeBridge)
class WidgetBridgeBridge: NSObject {
  
  @objc
  static func moduleName() -> String! {
    return "WidgetBridge"
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
