import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for widget preferences
const WIDGET_PREFERENCES_KEY = 'widgetPreferences';

// Interface for widget preferences
export interface WidgetPreferences {
  [cardIndex: number]: boolean; // cardIndex -> enabled/disabled
}

/**
 * Get all widget preferences
 */
export const getWidgetPreferences = async (): Promise<WidgetPreferences> => {
  try {
    const preferencesJson = await AsyncStorage.getItem(WIDGET_PREFERENCES_KEY);
    if (preferencesJson) {
      return JSON.parse(preferencesJson);
    }
    return {};
  } catch (error) {
    console.error('Error getting widget preferences:', error);
    return {};
  }
};

/**
 * Set widget preference for a specific card
 */
export const setWidgetPreference = async (cardIndex: number, enabled: boolean): Promise<void> => {
  try {
    const preferences = await getWidgetPreferences();
    preferences[cardIndex] = enabled;
    await AsyncStorage.setItem(WIDGET_PREFERENCES_KEY, JSON.stringify(preferences));
    console.log(`Widget preference set for card ${cardIndex}: ${enabled}`);
  } catch (error) {
    console.error('Error setting widget preference:', error);
    throw new Error('Failed to save widget preference');
  }
};

/**
 * Get widget preference for a specific card
 */
export const getWidgetPreference = async (cardIndex: number): Promise<boolean> => {
  try {
    const preferences = await getWidgetPreferences();
    return preferences[cardIndex] || false;
  } catch (error) {
    console.error('Error getting widget preference:', error);
    return false;
  }
};

/**
 * Toggle widget preference for a specific card
 */
export const toggleWidgetPreference = async (cardIndex: number): Promise<boolean> => {
  try {
    const currentPreference = await getWidgetPreference(cardIndex);
    const newPreference = !currentPreference;
    await setWidgetPreference(cardIndex, newPreference);
    return newPreference;
  } catch (error) {
    console.error('Error toggling widget preference:', error);
    throw new Error('Failed to toggle widget preference');
  }
};

/**
 * Get all enabled widget card indices
 */
export const getEnabledWidgetCards = async (): Promise<number[]> => {
  try {
    const preferences = await getWidgetPreferences();
    return Object.entries(preferences)
      .filter(([_, enabled]) => enabled)
      .map(([cardIndex]) => parseInt(cardIndex));
  } catch (error) {
    console.error('Error getting enabled widget cards:', error);
    return [];
  }
};

/**
 * Clear all widget preferences
 */
export const clearWidgetPreferences = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(WIDGET_PREFERENCES_KEY);
    console.log('All widget preferences cleared');
  } catch (error) {
    console.error('Error clearing widget preferences:', error);
    throw new Error('Failed to clear widget preferences');
  }
};
