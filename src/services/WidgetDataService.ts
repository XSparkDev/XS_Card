import AsyncStorage from '@react-native-async-storage/async-storage';
import WidgetBridge, { WidgetData } from '../modules/WidgetBridge';
import { getWidgetPreferences } from '../utils/widgetUtils';
import { getUserId } from '../utils/api';

export interface CardData {
  index: number;
  name: string;
  surname: string;
  company: string;
  colorScheme: string;
}

class WidgetDataService {
  private static instance: WidgetDataService;
  
  static getInstance(): WidgetDataService {
    if (!WidgetDataService.instance) {
      WidgetDataService.instance = new WidgetDataService();
    }
    return WidgetDataService.instance;
  }

  /**
   * Update widget data for all enabled widgets
   */
  async updateAllWidgets(): Promise<void> {
    try {
      const widgetData = await this.prepareWidgetData();
      if (widgetData) {
        await WidgetBridge.updateWidgetData(widgetData);
        console.log('Widgets updated successfully');
      } else {
        console.log('No widget data to update');
      }
    } catch (error) {
      console.error('Failed to update widgets:', error);
      throw error;
    }
  }

  /**
   * Refresh all widgets on the home screen
   */
  async refreshAllWidgets(): Promise<void> {
    try {
      await WidgetBridge.refreshAllWidgets();
      console.log('Widgets refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh widgets:', error);
      throw error;
    }
  }

  /**
   * Update widgets when user data changes
   */
  async onUserDataChange(): Promise<void> {
    try {
      await this.updateAllWidgets();
    } catch (error) {
      console.error('Failed to update widgets after user data change:', error);
    }
  }

  /**
   * Update widgets when widget preferences change
   */
  async onWidgetPreferencesChange(): Promise<void> {
    try {
      await this.updateAllWidgets();
    } catch (error) {
      console.error('Failed to update widgets after preferences change:', error);
    }
  }

  /**
   * Check if widgets are supported on this platform
   */
  async isWidgetSupported(): Promise<boolean> {
    try {
      return await WidgetBridge.isWidgetSupported();
    } catch (error) {
      console.error('Failed to check widget support:', error);
      return false;
    }
  }

  /**
   * Prepare widget data from user cards and preferences
   */
  private async prepareWidgetData(): Promise<WidgetData | null> {
    try {
      // Get user ID
      const userId = await getUserId();
      if (!userId) {
        console.warn('No user ID available for widgets');
        return null;
      }

      // Get user cards
      const cardsData = await AsyncStorage.getItem('userCards');
      if (!cardsData) {
        console.warn('No user cards available for widgets');
        return null;
      }

      const allCards: CardData[] = JSON.parse(cardsData);
      
      // Get widget preferences
      const widgetPreferences = await getWidgetPreferences();
      
      // Filter enabled cards
      const enabledCards = allCards
        .filter(card => widgetPreferences[card.index] === true)
        .map(card => ({
          index: card.index,
          name: card.name,
          surname: card.surname,
          company: card.company,
          colorScheme: card.colorScheme
        }));

      if (enabledCards.length === 0) {
        console.warn('No enabled cards for widgets');
        return null;
      }

      return {
        userId,
        enabledCards
      };
    } catch (error) {
      console.error('Failed to prepare widget data:', error);
      return null;
    }
  }

  /**
   * Get widget data for preview purposes
   */
  async getWidgetDataForPreview(): Promise<WidgetData | null> {
    return await this.prepareWidgetData();
  }

  /**
   * Clear all widget data
   */
  async clearWidgetData(): Promise<void> {
    try {
      const emptyWidgetData: WidgetData = {
        userId: '',
        enabledCards: []
      };
      
      await WidgetBridge.updateWidgetData(emptyWidgetData);
      console.log('Widget data cleared successfully');
    } catch (error) {
      console.error('Failed to clear widget data:', error);
      throw error;
    }
  }
}

export default WidgetDataService.getInstance();

