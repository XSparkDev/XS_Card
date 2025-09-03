import { NativeModules, Platform } from 'react-native';

interface WidgetBridgeInterface {
  updateWidgetData(widgetData: WidgetData): Promise<void>;
  refreshAllWidgets(): Promise<void>;
  isWidgetSupported(): Promise<boolean>;
}

export interface WidgetData {
  userId: string;
  enabledCards: Array<{
    index: number;
    name: string;
    surname: string;
    company: string;
    colorScheme: string;
  }>;
}

// Type assertion for native modules
const WidgetBridgeNative = NativeModules.WidgetBridge as WidgetBridgeInterface;

class WidgetBridge {
  /**
   * Update widget data for both platforms
   */
  async updateWidgetData(widgetData: WidgetData): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await this.updateiOSWidgetData(widgetData);
      } else if (Platform.OS === 'android') {
        await this.updateAndroidWidgetData(widgetData);
      }
    } catch (error) {
      console.error('Failed to update widget data:', error);
      throw error;
    }
  }

  /**
   * Refresh all widgets on the home screen
   */
  async refreshAllWidgets(): Promise<void> {
    try {
      if (WidgetBridgeNative && WidgetBridgeNative.refreshAllWidgets) {
        await WidgetBridgeNative.refreshAllWidgets();
      } else {
        console.warn('Widget refresh not available on this platform');
      }
    } catch (error) {
      console.error('Failed to refresh widgets:', error);
      throw error;
    }
  }

  /**
   * Check if widgets are supported on this platform
   */
  async isWidgetSupported(): Promise<boolean> {
    try {
      if (WidgetBridgeNative && WidgetBridgeNative.isWidgetSupported) {
        return await WidgetBridgeNative.isWidgetSupported();
      }
      return Platform.OS === 'ios' || Platform.OS === 'android';
    } catch (error) {
      console.error('Failed to check widget support:', error);
      return false;
    }
  }

  /**
   * Update iOS widget data using App Groups
   */
  private async updateiOSWidgetData(widgetData: WidgetData): Promise<void> {
    if (WidgetBridgeNative && WidgetBridgeNative.updateWidgetData) {
      await WidgetBridgeNative.updateWidgetData(widgetData);
    } else {
      console.warn('iOS widget bridge not available');
    }
  }

  /**
   * Update Android widget data using SharedPreferences
   */
  private async updateAndroidWidgetData(widgetData: WidgetData): Promise<void> {
    if (WidgetBridgeNative && WidgetBridgeNative.updateWidgetData) {
      await WidgetBridgeNative.updateWidgetData(widgetData);
    } else {
      console.warn('Android widget bridge not available');
    }
  }
}

export default new WidgetBridge();

