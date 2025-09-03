package com.p.zzles.xscard.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.widget.RemoteViews;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.p.zzles.xscard.MainActivity;
import com.p.zzles.xscard.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

public class XSCardWidgetProvider extends AppWidgetProvider {
    
    private static final String WIDGET_PREFS = "XSCardWidgetPrefs";
    private static final String ACTION_WIDGET_CLICK = "com.p.zzles.xscard.WIDGET_CLICK";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        
        if (ACTION_WIDGET_CLICK.equals(intent.getAction())) {
            // Open main app when widget is clicked
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launchIntent);
        } else if ("com.p.zzles.xscard.UPDATE_WIDGET".equals(intent.getAction())) {
            // Update all widgets when data changes
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, XSCardWidgetProvider.class));
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        WidgetData widgetData = loadWidgetData(context);
        
        // Determine widget size
        int widgetWidth = getWidgetWidth(context, appWidgetManager, appWidgetId);
        boolean isSmallWidget = widgetWidth < 200; // Approximate threshold
        
        RemoteViews views;
        if (isSmallWidget) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_small);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_medium);
        }

        if (widgetData != null && widgetData.qrCodeData != null) {
            // Generate QR code bitmap
            Bitmap qrBitmap = generateQRCodeBitmap(widgetData.qrCodeData, 200);
            if (qrBitmap != null) {
                views.setImageViewBitmap(R.id.widget_qr_code, qrBitmap);
            }
            
            // Set background color
            try {
                int color = Color.parseColor(widgetData.colorScheme);
                views.setInt(R.id.widget_background, "setBackgroundColor", color);
            } catch (IllegalArgumentException e) {
                views.setInt(R.id.widget_background, "setBackgroundColor", Color.parseColor("#4CAF50"));
            }
            
            // Set card name for medium widgets
            if (!isSmallWidget && widgetData.name != null) {
                views.setTextViewText(R.id.widget_card_name, widgetData.name);
                views.setViewVisibility(R.id.widget_card_name, android.view.View.VISIBLE);
            }
        } else {
            // Fallback UI
            views.setImageViewResource(R.id.widget_qr_code, R.drawable.ic_qr_code_placeholder);
            views.setInt(R.id.widget_background, "setBackgroundColor", Color.parseColor("#4CAF50"));
            
            if (!isSmallWidget) {
                views.setTextViewText(R.id.widget_card_name, "XSCard");
                views.setViewVisibility(R.id.widget_card_name, android.view.View.VISIBLE);
            }
        }

        // Set click intent
        Intent clickIntent = new Intent(context, XSCardWidgetProvider.class);
        clickIntent.setAction(ACTION_WIDGET_CLICK);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 0, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static WidgetData loadWidgetData(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE);
        String widgetDataJson = prefs.getString("widgetData", null);
        
        if (widgetDataJson != null) {
            try {
                JSONObject json = new JSONObject(widgetDataJson);
                JSONArray enabledCards = json.optJSONArray("enabledCards");
                
                if (enabledCards != null && enabledCards.length() > 0) {
                    JSONObject firstCard = enabledCards.getJSONObject(0);
                    String userId = json.optString("userId", "user123");
                    int cardIndex = firstCard.optInt("index", 0);
                    
                    WidgetData data = new WidgetData();
                    data.name = firstCard.optString("name", "");
                    data.company = firstCard.optString("company", "");
                    data.colorScheme = firstCard.optString("colorScheme", "#4CAF50");
                    data.cardIndex = cardIndex;
                    data.qrCodeData = "https://xscard-app-8ign.onrender.com/saveContact?userId=" + userId + "&cardIndex=" + cardIndex;
                    
                    return data;
                }
            } catch (JSONException e) {
                e.printStackTrace();
            }
        }
        
        return null;
    }

    private static Bitmap generateQRCodeBitmap(String data, int size) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.MARGIN, 1);
            
            BitMatrix bitMatrix = writer.encode(data, BarcodeFormat.QR_CODE, size, size, hints);
            int width = bitMatrix.getWidth();
            int height = bitMatrix.getHeight();
            
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565);
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    bitmap.setPixel(x, y, bitMatrix.get(x, y) ? Color.BLACK : Color.WHITE);
                }
            }
            return bitmap;
        } catch (WriterException e) {
            e.printStackTrace();
            return null;
        }
    }

    private static int getWidgetWidth(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN) {
            android.os.Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            return options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        }
        return 150; // Default fallback
    }

    public static void updateAllWidgets(Context context) {
        Intent intent = new Intent(context, XSCardWidgetProvider.class);
        intent.setAction("com.p.zzles.xscard.UPDATE_WIDGET");
        context.sendBroadcast(intent);
    }

    private static class WidgetData {
        String name;
        String company;
        String colorScheme;
        int cardIndex;
        String qrCodeData;
    }
}

