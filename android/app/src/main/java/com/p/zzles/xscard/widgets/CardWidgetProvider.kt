package com.p.zzles.xscard.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.p.zzles.xscard.R

/**
 * Card Widget Provider for XS Card
 * Manages widget updates and lifecycle
 */
class CardWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update all widgets
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        // Clean up widget data when widget is removed
        for (appWidgetId in appWidgetIds) {
            WidgetDataStore.deleteWidget(context, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // First widget added
    }

    override fun onDisabled(context: Context) {
        // Last widget removed
    }

    companion object {
        /**
         * Update a specific widget
         */
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val widgetData = WidgetDataStore.getWidgetData(context, appWidgetId)
            
            val views: RemoteViews = if (widgetData?.size == "small") {
                RemoteViews(context.packageName, R.layout.widget_small)
            } else {
                RemoteViews(context.packageName, R.layout.widget_large)
            }

            // Populate widget views with data
            if (widgetData != null) {
                views.setTextViewText(R.id.widget_name, widgetData.name)
                views.setTextViewText(R.id.widget_company, widgetData.company)
                views.setTextViewText(R.id.widget_occupation, widgetData.occupation)
                
                // Set colors
                try {
                    val color = android.graphics.Color.parseColor(widgetData.colorScheme)
                    views.setInt(R.id.widget_container, "setBackgroundColor", color)
                } catch (e: Exception) {
                    // Use default color if parsing fails
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        /**
         * Force update all widgets for a specific card
         */
        fun updateWidgetsForCard(context: Context, cardIndex: Int) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val widgetIds = WidgetDataStore.getWidgetIdsForCard(context, cardIndex)
            
            for (widgetId in widgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }
    }
}





