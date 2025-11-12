import AsyncStorage from '@react-native-async-storage/async-storage';
import { WidgetPreferences as NewWidgetPreferences } from '../widgets';

// Storage key for widget preferences
const WIDGET_PREFERENCES_KEY = 'widgetPreferences';

// Legacy interface for backward compatibility
export interface WidgetPreferences {
  [cardIndex: number]: boolean; // cardIndex -> enabled/disabled
}

// Interface for card data needed for widgets
export interface CardWidgetData {
  index: number;
  name: string;
  surname: string;
  company: string;
  colorScheme: string;
  qrCodeUrl?: string;
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

/**
 * Get card data for widget creation
 */
export const getCardWidgetData = async (cardIndex: number): Promise<CardWidgetData | null> => {
  try {
    // Get user cards from AsyncStorage
    const cardsJson = await AsyncStorage.getItem('userCards');
    if (!cardsJson) {
      console.log('No user cards found in storage');
      return null;
    }

    const cards = JSON.parse(cardsJson);
    if (!cards || !Array.isArray(cards) || cards.length <= cardIndex) {
      console.log(`Card index ${cardIndex} not found in cards array`);
      return null;
    }

    const card = cards[cardIndex];
    return {
      index: cardIndex,
      name: card.name || '',
      surname: card.surname || '',
      company: card.company || '',
      colorScheme: card.colorScheme || '#1B2B5B',
      qrCodeUrl: undefined // Will be fetched separately
    };
  } catch (error) {
    console.error('Error getting card widget data:', error);
    return null;
  }
};
