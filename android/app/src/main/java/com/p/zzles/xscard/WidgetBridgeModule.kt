package com.p.zzles.xscard

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.p.zzles.xscard.widget.XSCardWidgetProvider
import org.json.JSONArray
import org.json.JSONObject

class WidgetBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val MODULE_NAME = "WidgetBridge"
        private const val WIDGET_PREFS = "XSCardWidgetPrefs"
    }
    
    override fun getName(): String = MODULE_NAME
    
    @ReactMethod
    fun updateWidgetData(widgetData: ReadableMap, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
            
            // Convert ReadableMap to JSON
            val jsonObject = convertReadableMapToJson(widgetData)
            val jsonString = jsonObject.toString()
            
            // Save to SharedPreferences
            prefs.edit().apply {
                putString("widgetData", jsonString)
                apply()
            }
            
            // Trigger widget update
            XSCardWidgetProvider.updateAllWidgets(context)
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_UPDATE_ERROR", "Failed to update widget data", e)
        }
    }
    
    @ReactMethod
    fun refreshAllWidgets(promise: Promise) {
        try {
            val context = reactApplicationContext
            XSCardWidgetProvider.updateAllWidgets(context)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_REFRESH_ERROR", "Failed to refresh widgets", e)
        }
    }
    
    @ReactMethod
    fun isWidgetSupported(promise: Promise) {
        promise.resolve(true)
    }
    
    private fun convertReadableMapToJson(readableMap: ReadableMap): JSONObject {
        val jsonObject = JSONObject()
        
        if (readableMap.hasKey("userId")) {
            jsonObject.put("userId", readableMap.getString("userId"))
        }
        
        if (readableMap.hasKey("enabledCards")) {
            val enabledCardsArray = readableMap.getArray("enabledCards")
            val jsonArray = JSONArray()
            
            enabledCardsArray?.let { array ->
                for (i in 0 until array.size()) {
                    val cardMap = array.getMap(i)
                    val cardJson = JSONObject()
                    
                    cardMap?.let { card ->
                        if (card.hasKey("index")) cardJson.put("index", card.getInt("index"))
                        if (card.hasKey("name")) cardJson.put("name", card.getString("name"))
                        if (card.hasKey("surname")) cardJson.put("surname", card.getString("surname"))
                        if (card.hasKey("company")) cardJson.put("company", card.getString("company"))
                        if (card.hasKey("colorScheme")) cardJson.put("colorScheme", card.getString("colorScheme"))
                        if (card.hasKey("jobTitle")) cardJson.put("jobTitle", card.getString("jobTitle"))
                    }
                    
                    jsonArray.put(cardJson)
                }
            }
            
            jsonObject.put("enabledCards", jsonArray)
        }
        
        return jsonObject
    }
}

