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

