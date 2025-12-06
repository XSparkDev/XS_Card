package com.p.zzles.xscard.widgets

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * Data structure for widget information
 */
data class WidgetData(
    val widgetId: Int,
    val cardIndex: Int,
    val name: String,
    val surname: String = "", // Default empty for backward compatibility
    val company: String,
    val occupation: String,
    val email: String,
    val phone: String,
    val colorScheme: String,
    val size: String,
    val showProfileImage: Boolean,
    val showCompanyLogo: Boolean,
    val showQRCode: Boolean
)

/**
 * Storage manager for widget data
 */
object WidgetDataStore {
    private const val PREFS_NAME = "xs_card_widgets"
    private const val KEY_WIDGET_PREFIX = "widget_"
    private const val KEY_CARD_WIDGETS_PREFIX = "card_widgets_"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Save widget data
     */
    fun saveWidgetData(context: Context, data: WidgetData) {
        val prefs = getPrefs(context)
        val json = JSONObject()
        json.put("widgetId", data.widgetId)
        json.put("cardIndex", data.cardIndex)
        json.put("name", data.name)
        json.put("surname", data.surname)
        json.put("company", data.company)
        json.put("occupation", data.occupation)
        json.put("email", data.email)
        json.put("phone", data.phone)
        json.put("colorScheme", data.colorScheme)
        json.put("size", data.size)
        json.put("showProfileImage", data.showProfileImage)
        json.put("showCompanyLogo", data.showCompanyLogo)
        json.put("showQRCode", data.showQRCode)

        prefs.edit()
            .putString("$KEY_WIDGET_PREFIX${data.widgetId}", json.toString())
            .apply()

        // Also track widgets by card index
        addWidgetToCardIndex(context, data.cardIndex, data.widgetId)
    }

    /**
     * Get widget data
     */
    fun getWidgetData(context: Context, widgetId: Int): WidgetData? {
        val prefs = getPrefs(context)
        val jsonString = prefs.getString("$KEY_WIDGET_PREFIX$widgetId", null) ?: return null

        return try {
            val json = JSONObject(jsonString)
            WidgetData(
                widgetId = json.getInt("widgetId"),
                cardIndex = json.getInt("cardIndex"),
                name = json.getString("name"),
                surname = json.optString("surname", ""), // Backward compatible
                company = json.getString("company"),
                occupation = json.getString("occupation"),
                email = json.getString("email"),
                phone = json.getString("phone"),
                colorScheme = json.getString("colorScheme"),
                size = json.getString("size"),
                showProfileImage = json.getBoolean("showProfileImage"),
                showCompanyLogo = json.getBoolean("showCompanyLogo"),
                showQRCode = json.getBoolean("showQRCode")
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Delete widget data
     */
    fun deleteWidget(context: Context, widgetId: Int) {
        val widgetData = getWidgetData(context, widgetId)
        val prefs = getPrefs(context)
        
        prefs.edit()
            .remove("$KEY_WIDGET_PREFIX$widgetId")
            .apply()

        // Remove from card index tracking
        if (widgetData != null) {
            removeWidgetFromCardIndex(context, widgetData.cardIndex, widgetId)
        }
    }

    /**
     * Get all widget IDs for a card
     */
    fun getWidgetIdsForCard(context: Context, cardIndex: Int): List<Int> {
        val prefs = getPrefs(context)
        val idsString = prefs.getString("$KEY_CARD_WIDGETS_PREFIX$cardIndex", "") ?: ""
        
        return if (idsString.isEmpty()) {
            emptyList()
        } else {
            idsString.split(",").mapNotNull { it.toIntOrNull() }
        }
    }

    private fun addWidgetToCardIndex(context: Context, cardIndex: Int, widgetId: Int) {
        val existingIds = getWidgetIdsForCard(context, cardIndex).toMutableList()
        if (!existingIds.contains(widgetId)) {
            existingIds.add(widgetId)
            saveCardWidgetIds(context, cardIndex, existingIds)
        }
    }

    private fun removeWidgetFromCardIndex(context: Context, cardIndex: Int, widgetId: Int) {
        val existingIds = getWidgetIdsForCard(context, cardIndex).toMutableList()
        if (existingIds.remove(widgetId)) {
            saveCardWidgetIds(context, cardIndex, existingIds)
        }
    }

    private fun saveCardWidgetIds(context: Context, cardIndex: Int, ids: List<Int>) {
        val prefs = getPrefs(context)
        prefs.edit()
            .putString("$KEY_CARD_WIDGETS_PREFIX$cardIndex", ids.joinToString(","))
            .apply()
    }
}





