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
    
    // Widget size thresholds (in dp)
    private static final int SMALL_WIDGET_THRESHOLD = 150;
    private static final int MEDIUM_WIDGET_THRESHOLD = 250;
    private static final int LARGE_WIDGET_THRESHOLD = 300;

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
        
        // Determine widget size and layout
        int widgetWidth = getWidgetWidth(context, appWidgetManager, appWidgetId);
        int widgetHeight = getWidgetHeight(context, appWidgetManager, appWidgetId);
        
        WidgetSize widgetSize = determineWidgetSize(widgetWidth, widgetHeight);
        RemoteViews views = getRemoteViews(context, widgetSize);
        
        if (widgetData != null && widgetData.qrCodeData != null) {
            // Generate high-quality QR code bitmap
            int qrSize = getQRCodeSize(widgetSize);
            Bitmap qrBitmap = generateQRCodeBitmap(widgetData.qrCodeData, qrSize);
            
            if (qrBitmap != null) {
                views.setImageViewBitmap(R.id.widget_qr_code, qrBitmap);
            }
            
            // Set white background for all widgets
            views.setInt(R.id.widget_background, "setBackgroundColor", Color.WHITE);
            
            // Handle different widget layouts
            switch (widgetSize) {
                case SMALL:
                    // Small widget: Just QR code, no text
                    break;
                    
                case MEDIUM:
                    // Medium widget: QR code + "XS Card" label
                    views.setTextViewText(R.id.widget_card_name, "XS Card");
                    views.setViewVisibility(R.id.widget_card_name, android.view.View.VISIBLE);
                    break;
                    
                case LARGE_SQUARE:
                    // Large square widget: QR code + "XS Card" branding
                    views.setTextViewText(R.id.widget_branding, "XS Card");
                    break;
                    
                case MEDIUM_INFO:
                    // Medium info card: QR code + user details
                    String fullName = widgetData.name + 
                        (widgetData.surname != null && !widgetData.surname.isEmpty() ? " " + widgetData.surname : "");
                    views.setTextViewText(R.id.widget_user_name, fullName);
                    
                    // Show job title if available
                    if (widgetData.jobTitle != null && !widgetData.jobTitle.isEmpty()) {
                        views.setTextViewText(R.id.widget_job_title, widgetData.jobTitle);
                        views.setViewVisibility(R.id.widget_job_title, android.view.View.VISIBLE);
                    } else {
                        views.setViewVisibility(R.id.widget_job_title, android.view.View.GONE);
                    }
                    
                    // Show company
                    if (widgetData.company != null && !widgetData.company.isEmpty()) {
                        views.setTextViewText(R.id.widget_company, widgetData.company);
                        views.setViewVisibility(R.id.widget_company, android.view.View.VISIBLE);
                    } else {
                        views.setViewVisibility(R.id.widget_company, android.view.View.GONE);
                    }
                    break;
            }
        } else {
            // Fallback UI - white background
            views.setInt(R.id.widget_background, "setBackgroundColor", Color.WHITE);
            
            // Set placeholder based on widget size
            if (widgetSize == WidgetSize.MEDIUM_INFO) {
                views.setTextViewText(R.id.widget_user_name, "XS Card");
                views.setTextViewText(R.id.widget_company, "Digital Business Card");
                views.setViewVisibility(R.id.widget_job_title, android.view.View.GONE);
            } else if (widgetSize == WidgetSize.MEDIUM || widgetSize == WidgetSize.LARGE_SQUARE) {
                String labelText = "XS Card";
                int labelId = widgetSize == WidgetSize.LARGE_SQUARE ? 
                    R.id.widget_branding : R.id.widget_card_name;
                views.setTextViewText(labelId, labelText);
            }
        }

        // Set click intent
        Intent clickIntent = new Intent(context, XSCardWidgetProvider.class);
        clickIntent.setAction(ACTION_WIDGET_CLICK);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 0, clickIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static WidgetSize determineWidgetSize(int width, int height) {
        // Determine widget size based on dimensions
        boolean isSquare = Math.abs(width - height) < 50; // Roughly square
        boolean isWide = width > height * 1.5; // Wide rectangular
        
        if (width < SMALL_WIDGET_THRESHOLD) {
            return WidgetSize.SMALL;
        } else if (width >= LARGE_WIDGET_THRESHOLD && isSquare) {
            return WidgetSize.LARGE_SQUARE;
        } else if (isWide) {
            return WidgetSize.MEDIUM_INFO;
        } else if (width >= MEDIUM_WIDGET_THRESHOLD) {
            return WidgetSize.MEDIUM;
        } else {
            return WidgetSize.MEDIUM;
        }
    }
    
    private static RemoteViews getRemoteViews(Context context, WidgetSize size) {
        int layoutId;
        switch (size) {
            case SMALL:
                layoutId = R.layout.widget_small;
                break;
            case LARGE_SQUARE:
                layoutId = R.layout.widget_large_square;
                break;
            case MEDIUM_INFO:
                layoutId = R.layout.widget_medium_info;
                break;
            case MEDIUM:
            default:
                layoutId = R.layout.widget_medium;
                break;
        }
        return new RemoteViews(context.getPackageName(), layoutId);
    }
    
    private static int getQRCodeSize(WidgetSize size) {
        switch (size) {
            case SMALL:
                return 150;
            case MEDIUM:
                return 200;
            case LARGE_SQUARE:
                return 300;
            case MEDIUM_INFO:
                return 180;
            default:
                return 200;
        }
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
                    data.surname = firstCard.optString("surname", "");
                    data.company = firstCard.optString("company", "");
                    data.jobTitle = firstCard.optString("jobTitle", "");
                    data.colorScheme = firstCard.optString("colorScheme", "#FFFFFF");
                    data.cardIndex = cardIndex;
                    data.qrCodeData = "https://xscard-app-8ign.onrender.com/saveContact?userId=" + 
                        userId + "&cardIndex=" + cardIndex;
                    
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
            hints.put(EncodeHintType.MARGIN, 2); // Increased margin for better scanning
            hints.put(EncodeHintType.ERROR_CORRECTION, com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.H);
            
            BitMatrix bitMatrix = writer.encode(data, BarcodeFormat.QR_CODE, size, size, hints);
            int width = bitMatrix.getWidth();
            int height = bitMatrix.getHeight();
            
            // Use ARGB_8888 for better quality
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
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
    
    private static int getWidgetHeight(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN) {
            android.os.Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            return options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        }
        return 150; // Default fallback
    }

    public static void updateAllWidgets(Context context) {
        Intent intent = new Intent(context, XSCardWidgetProvider.class);
        intent.setAction("com.p.zzles.xscard.UPDATE_WIDGET");
        context.sendBroadcast(intent);
    }
    
    private enum WidgetSize {
        SMALL,
        MEDIUM,
        LARGE_SQUARE,
        MEDIUM_INFO
    }

    private static class WidgetData {
        String name;
        String surname;
        String company;
        String jobTitle;
        String colorScheme;
        int cardIndex;
        String qrCodeData;
    }
}
