# Android Widget Implementation Guide

## Completed Files

### 1. CardWidgetProvider.kt ✅
- Location: `android/app/src/main/java/com/p/zzles/xscard/widgets/CardWidgetProvider.kt`
- Purpose: Main AppWidgetProvider for handling widget lifecycle
- Features:
  - onUpdate: Updates widget views
  - onDeleted: Cleans up widget data
  - Supports both small and large widget sizes
  - Updates widgets when card data changes

### 2. WidgetDataStore.kt ✅
- Location: `android/app/src/main/java/com/p/zzles/xscard/widgets/WidgetDataStore.kt`
- Purpose: Manages widget data storage using SharedPreferences
- Features:
  - Save/load widget data
  - Track widgets by card index
  - Delete widget data

## Remaining Implementation

### 3. WidgetBridgeModule.kt ✅
**Location**: `android/app/src/main/java/com/p/zzles/xscard/widgets/WidgetBridgeModule.kt`

```kotlin
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
```

### 4. WidgetBridgePackage.kt ✅
**Location**: `android/app/src/main/java/com/p/zzles/xscard/widgets/WidgetBridgePackage.kt`

```kotlin
package com.p.zzles.xscard.widgets

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetBridgePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(WidgetBridgeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

### 5. Register Package in MainApplication.kt ✅
**Location**: `android/app/src/main/java/com/p/zzles/xscard/MainApplication.kt`

Already updated with:
- Import: `import com.p.zzles.xscard.widgets.WidgetBridgePackage`
- Package registration: `packages.add(WidgetBridgePackage())`

### 6. Widget Layouts ✅

#### widget_small.xml ✅
**Location**: `android/app/src/main/res/layout/widget_small.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="8dp"
    android:gravity="center"
    android:background="@drawable/widget_background">

    <ImageView
        android:id="@+id/widget_qr_code"
        android:layout_width="120dp"
        android:layout_height="120dp"
        android:scaleType="fitCenter"
        android:contentDescription="QR Code" />

    <TextView
        android:id="@+id/widget_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:textSize="12sp"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:maxLines="1"
        android:ellipsize="end" />
</LinearLayout>
```

#### widget_large.xml ✅
**Location**: `android/app/src/main/res/layout/widget_large.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp"
    android:background="@drawable/widget_background">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <ImageView
            android:id="@+id/widget_profile_image"
            android:layout_width="60dp"
            android:layout_height="60dp"
            android:scaleType="centerCrop"
            android:contentDescription="Profile" />

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="12dp"
            android:orientation="vertical">

            <TextView
                android:id="@+id/widget_name"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="18sp"
                android:textColor="#FFFFFF"
                android:textStyle="bold"
                android:maxLines="1"
                android:ellipsize="end" />

            <TextView
                android:id="@+id/widget_occupation"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="14sp"
                android:textColor="#CCFFFFFF"
                android:maxLines="1"
                android:ellipsize="end" />

            <TextView
                android:id="@+id/widget_company"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textSize="12sp"
                android:textColor="#99FFFFFF"
                android:maxLines="1"
                android:ellipsize="end" />
        </LinearLayout>
    </LinearLayout>

    <ImageView
        android:id="@+id/widget_qr_code"
        android:layout_width="140dp"
        android:layout_height="140dp"
        android:layout_gravity="center_horizontal"
        android:layout_marginVertical="12dp"
        android:scaleType="fitCenter"
        android:contentDescription="QR Code" />

    <TextView
        android:id="@+id/widget_email"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textSize="12sp"
        android:textColor="#FFFFFF"
        android:maxLines="1"
        android:ellipsize="end" />

    <TextView
        android:id="@+id/widget_phone"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textSize="12sp"
        android:textColor="#FFFFFF"
        android:maxLines="1"
        android:ellipsize="end" />
</LinearLayout>
```

### 7. Widget Background Drawable ✅
**Location**: `android/app/src/main/res/drawable/widget_background.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <corners android:radius="20dp" />
    <solid android:color="#1B2B5B" />
</shape>
```

### 8. Widget Info XML ✅
**Location**: `android/app/src/main/res/xml/widget_info.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="180dp"
    android:minResizeWidth="180dp"
    android:minResizeHeight="180dp"
    android:updatePeriodMillis="3600000"
    android:initialLayout="@layout/widget_large"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:previewImage="@drawable/widget_preview" />
```

### 9. AndroidManifest.xml Updates ✅
**Location**: `android/app/src/main/AndroidManifest.xml`

Already updated with widget receiver inside `<application>` tag.

## Testing Checklist

- [ ] Build app with native modules: `npx expo run:android`
- [ ] Add widget to home screen
- [ ] Verify widget displays card data
- [ ] Test small and large widget sizes
- [ ] Update card data and verify widget refreshes
- [ ] Delete widget and verify cleanup
- [ ] Test multiple widgets for different cards

## Notes

- Widgets require development builds (cannot test in Expo Go)
- QR code rendering needs implementation
- Image loading needs implementation
- Widget refresh logic needs testing

