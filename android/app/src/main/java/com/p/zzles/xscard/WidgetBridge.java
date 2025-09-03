package com.p.zzles.xscard;

import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.p.zzles.xscard.widget.XSCardWidgetProvider;

import org.json.JSONException;
import org.json.JSONObject;

public class WidgetBridge extends ReactContextBaseJavaModule {
    
    private static final String MODULE_NAME = "WidgetBridge";
    private static final String WIDGET_PREFS = "XSCardWidgetPrefs";
    
    public WidgetBridge(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return MODULE_NAME;
    }
    
    @ReactMethod
    public void updateWidgetData(ReadableMap widgetData, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
            
            // Convert ReadableMap to JSON string
            JSONObject jsonObject = convertReadableMapToJson(widgetData);
            String jsonString = jsonObject.toString();
            
            // Save to SharedPreferences
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("widgetData", jsonString);
            editor.apply();
            
            // Trigger widget update
            XSCardWidgetProvider.updateAllWidgets(context);
            
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("WIDGET_UPDATE_ERROR", "Failed to update widget data", e);
        }
    }
    
    @ReactMethod
    public void refreshAllWidgets(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            XSCardWidgetProvider.updateAllWidgets(context);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("WIDGET_REFRESH_ERROR", "Failed to refresh widgets", e);
        }
    }
    
    @ReactMethod
    public void isWidgetSupported(Promise promise) {
        promise.resolve(true);
    }
    
    private JSONObject convertReadableMapToJson(ReadableMap readableMap) throws JSONException {
        JSONObject jsonObject = new JSONObject();
        
        if (readableMap.hasKey("userId")) {
            jsonObject.put("userId", readableMap.getString("userId"));
        }
        
        if (readableMap.hasKey("enabledCards")) {
            // This would need more complex conversion for arrays
            // For now, we'll handle it as a string representation
            jsonObject.put("enabledCards", readableMap.getArray("enabledCards").toString());
        }
        
        return jsonObject;
    }
}

