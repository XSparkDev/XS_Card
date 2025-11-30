package com.p.zzles.xscard.widgets

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.appwidget.AppWidgetManager

class WidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "WidgetBridge"
    }

    @ReactMethod
    fun createWidget(cardIndex: Int, cardData: ReadableMap, config: ReadableMap, promise: Promise) {
        try {
            // Generate widget ID
            val widgetId = System.currentTimeMillis().toInt()
            
            // Create widget data
            val widgetData = WidgetData(
                widgetId = widgetId,
                cardIndex = cardIndex,
                name = cardData.getString("name") ?: "",
                company = cardData.getString("company") ?: "",
                occupation = cardData.getString("occupation") ?: "",
                email = cardData.getString("email") ?: "",
                phone = cardData.getString("phone") ?: "",
                colorScheme = cardData.getString("colorScheme") ?: "#1B2B5B",
                size = config.getString("size") ?: "large",
                showProfileImage = config.getBoolean("showProfileImage"),
                showCompanyLogo = config.getBoolean("showCompanyLogo"),
                showQRCode = config.getBoolean("showQRCode")
            )
            
            // Save widget data
            WidgetDataStore.saveWidgetData(reactApplicationContext, widgetData)
            
            // Update widget
            CardWidgetProvider.updateAppWidget(
                reactApplicationContext,
                AppWidgetManager.getInstance(reactApplicationContext),
                widgetId
            )
            
            val result = WritableNativeMap()
            result.putInt("widgetId", widgetId)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CREATE_WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateWidget(widgetId: Int, data: ReadableMap, promise: Promise) {
        try {
            // Update widget data and refresh views
            CardWidgetProvider.updateAppWidget(
                reactApplicationContext,
                AppWidgetManager.getInstance(reactApplicationContext),
                widgetId
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun deleteWidget(widgetId: Int, promise: Promise) {
        try {
            WidgetDataStore.deleteWidget(reactApplicationContext, widgetId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DELETE_WIDGET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getActiveWidgets(promise: Promise) {
        try {
            // Return list of active widgets (implementation needed)
            val widgets = WritableNativeArray()
            promise.resolve(widgets)
        } catch (e: Exception) {
            promise.reject("GET_WIDGETS_ERROR", e.message)
        }
    }
}



