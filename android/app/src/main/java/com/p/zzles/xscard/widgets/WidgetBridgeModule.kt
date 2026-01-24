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
            // Log incoming data for debugging
            android.util.Log.d("WidgetBridge", "=== createWidget called ===")
            android.util.Log.d("WidgetBridge", "cardIndex: $cardIndex")
            
            // Generate widget ID
            val widgetId = System.currentTimeMillis().toInt()
            
            // Helper function to safely get string from ReadableMap
            fun safeGetString(map: ReadableMap, key: String, defaultValue: String): String {
                return try {
                    if (map.hasKey(key)) {
                        when (map.getType(key)) {
                            ReadableType.String -> map.getString(key) ?: defaultValue
                            ReadableType.Number -> {
                                // In React Native, all numbers are doubles
                                // Convert to int if it's a whole number, otherwise keep decimal
                                val doubleValue = map.getDouble(key)
                                if (doubleValue % 1.0 == 0.0) {
                                    doubleValue.toInt().toString()
                                } else {
                                    doubleValue.toString()
                                }
                            }
                            ReadableType.Null -> defaultValue
                            else -> {
                                android.util.Log.w("WidgetBridge", "Unexpected type for key '$key': ${map.getType(key)}")
                                defaultValue
                            }
                        }
                    } else {
                        defaultValue
                    }
                } catch (e: Exception) {
                    android.util.Log.e("WidgetBridge", "Error reading string key '$key': ${e.message}", e)
                    defaultValue
                }
            }
            
            // Helper function to safely get boolean from ReadableMap
            fun safeGetBoolean(map: ReadableMap, key: String, defaultValue: Boolean): Boolean {
                return try {
                    if (map.hasKey(key)) {
                        when (map.getType(key)) {
                            ReadableType.Boolean -> map.getBoolean(key)
                            ReadableType.String -> {
                                val str = map.getString(key)
                                when (str?.lowercase()) {
                                    "true", "1" -> true
                                    "false", "0" -> false
                                    else -> defaultValue
                                }
                            }
                            ReadableType.Number -> {
                                // In React Native, all numbers are doubles
                                map.getDouble(key) != 0.0
                            }
                            ReadableType.Null -> defaultValue
                            else -> defaultValue
                        }
                    } else {
                        defaultValue
                    }
                } catch (e: Exception) {
                    android.util.Log.e("WidgetBridge", "Error reading boolean key '$key': ${e.message}", e)
                    defaultValue
                }
            }
            
            // Safely extract values with defaults
            val name = safeGetString(cardData, "name", "")
            val surname = safeGetString(cardData, "surname", "")
            val company = safeGetString(cardData, "company", "")
            val occupation = safeGetString(cardData, "occupation", "")
            val email = safeGetString(cardData, "email", "")
            val phone = safeGetString(cardData, "phone", "")
            val colorScheme = safeGetString(cardData, "colorScheme", "#1B2B5B")
            val size = safeGetString(config, "size", "large")
            
            val showProfileImage = safeGetBoolean(config, "showProfileImage", true)
            val showCompanyLogo = safeGetBoolean(config, "showCompanyLogo", false)
            val showQRCode = safeGetBoolean(config, "showQRCode", true)
            
            // Create widget data
            val widgetData = WidgetData(
                widgetId = widgetId,
                cardIndex = cardIndex,
                name = name,
                surname = surname,
                company = company,
                occupation = occupation,
                email = email,
                phone = phone,
                colorScheme = colorScheme,
                size = size,
                showProfileImage = showProfileImage,
                showCompanyLogo = showCompanyLogo,
                showQRCode = showQRCode
            )
            
            android.util.Log.d("WidgetBridge", "Widget data created successfully: $widgetData")
            
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
            android.util.Log.e("WidgetBridge", "Error creating widget: ${e.message}", e)
            promise.reject("CREATE_WIDGET_ERROR", e.message ?: "Unknown error", e)
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



