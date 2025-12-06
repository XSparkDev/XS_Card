import { Platform, NativeModules } from 'react-native';
import { WidgetConfig, WidgetData } from './WidgetTypes';

export interface WidgetResult {
  success: boolean;
  widgetId?: string;
  platform: 'android' | 'ios';
  error?: string;
}

/**
 * Platform Abstraction Layer for Widgets
 * Provides a unified interface for both Android and iOS widget implementations
 */
export class WidgetPlatformAdapter {
  /**
   * Check if widgets are supported on the current platform
   */
  static isSupported(): boolean {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }

  /**
   * Get the native widget bridge module
   */
  private static getWidgetBridge() {
    const { WidgetBridge } = NativeModules;
    
    if (!WidgetBridge) {
      console.warn('WidgetBridge native module not found. Make sure native code is compiled.');
      return null;
    }
    
    return WidgetBridge;
  }

  /**
   * Create a new widget for a card
   */
  static async createWidget(
    cardIndex: number,
    cardData: WidgetData,
    config: Partial<WidgetConfig>
  ): Promise<WidgetResult> {
    if (!WidgetPlatformAdapter.isSupported()) {
      return {
        success: false,
        error: 'Widgets are not supported on this platform',
        platform: Platform.OS as 'android' | 'ios',
      };
    }

    try {
      if (Platform.OS === 'android') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          // Fallback for development/testing without native module
          const widgetId = `widget_${cardIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('Android widget created (mock):', { widgetId, cardIndex, config });
          
          return {
            success: true,
            widgetId,
            platform: 'android',
          };
        }

        // Call native Android method
        const result = await bridge.createWidget(cardIndex, cardData, config);
        return {
          success: true,
          widgetId: result.widgetId,
          platform: 'android',
        };
      } else if (Platform.OS === 'ios') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          // Stub for iOS - ready for implementation
          const widgetId = `widget_${cardIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log('iOS widget creation ready for implementation:', { widgetId, cardIndex, config });
          
          return {
            success: true,
            widgetId,
            platform: 'ios',
          };
        }

        // Call native iOS method (to be implemented)
        const result = await bridge.createWidget(cardIndex, cardData, config);
        return {
          success: true,
          widgetId: result.widgetId,
          platform: 'ios',
        };
      }

      return {
        success: false,
        error: 'Unsupported platform',
        platform: Platform.OS as 'android' | 'ios',
      };
    } catch (error) {
      console.error('Error creating widget:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: Platform.OS as 'android' | 'ios',
      };
    }
  }

  /**
   * Update an existing widget's data
   */
  static async updateWidget(widgetId: string, data: Partial<WidgetData>): Promise<WidgetResult> {
    if (!WidgetPlatformAdapter.isSupported()) {
      return {
        success: false,
        error: 'Widgets are not supported on this platform',
        platform: Platform.OS as 'android' | 'ios',
      };
    }

    try {
      if (Platform.OS === 'android') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          console.log('Android widget updated (mock):', { widgetId, data });
          return {
            success: true,
            widgetId,
            platform: 'android',
          };
        }

        await bridge.updateWidget(widgetId, data);
        return {
          success: true,
          widgetId,
          platform: 'android',
        };
      } else if (Platform.OS === 'ios') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          console.log('iOS widget update ready for implementation:', { widgetId, data });
          return {
            success: true,
            widgetId,
            platform: 'ios',
          };
        }

        await bridge.updateWidget(widgetId, data);
        return {
          success: true,
          widgetId,
          platform: 'ios',
        };
      }

      return {
        success: false,
        error: 'Unsupported platform',
        platform: Platform.OS as 'android' | 'ios',
      };
    } catch (error) {
      console.error('Error updating widget:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: Platform.OS as 'android' | 'ios',
      };
    }
  }

  /**
   * Delete a widget
   */
  static async deleteWidget(widgetId: string): Promise<WidgetResult> {
    if (!WidgetPlatformAdapter.isSupported()) {
      return {
        success: false,
        error: 'Widgets are not supported on this platform',
        platform: Platform.OS as 'android' | 'ios',
      };
    }

    try {
      if (Platform.OS === 'android') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          console.log('Android widget deleted (mock):', widgetId);
          return {
            success: true,
            widgetId,
            platform: 'android',
          };
        }

        await bridge.deleteWidget(widgetId);
        return {
          success: true,
          widgetId,
          platform: 'android',
        };
      } else if (Platform.OS === 'ios') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          console.log('iOS widget deletion ready for implementation:', widgetId);
          return {
            success: true,
            widgetId,
            platform: 'ios',
          };
        }

        await bridge.deleteWidget(widgetId);
        return {
          success: true,
          widgetId,
          platform: 'ios',
        };
      }

      return {
        success: false,
        error: 'Unsupported platform',
        platform: Platform.OS as 'android' | 'ios',
      };
    } catch (error) {
      console.error('Error deleting widget:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: Platform.OS as 'android' | 'ios',
      };
    }
  }

  /**
   * Get list of active widgets
   */
  static async getActiveWidgets(): Promise<WidgetConfig[]> {
    if (!WidgetPlatformAdapter.isSupported()) {
      return [];
    }

    try {
      if (Platform.OS === 'android') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          console.log('Android getActiveWidgets (mock) - returning empty array');
          return [];
        }

        const widgets = await bridge.getActiveWidgets();
        return widgets || [];
      } else if (Platform.OS === 'ios') {
        const bridge = WidgetPlatformAdapter.getWidgetBridge();
        
        if (!bridge) {
          console.log('iOS getActiveWidgets ready for implementation - returning empty array');
          return [];
        }

        const widgets = await bridge.getActiveWidgets();
        return widgets || [];
      }

      return [];
    } catch (error) {
      console.error('Error getting active widgets:', error);
      return [];
    }
  }

  /**
   * Refresh all widgets for a specific card
   */
  static async refreshWidgetsForCard(cardIndex: number, data: WidgetData): Promise<void> {
    try {
      const activeWidgets = await WidgetPlatformAdapter.getActiveWidgets();
      const cardWidgets = activeWidgets.filter(w => w.cardIndex === cardIndex);

      for (const widget of cardWidgets) {
        await WidgetPlatformAdapter.updateWidget(widget.id, data);
      }

      console.log(`Refreshed ${cardWidgets.length} widgets for card ${cardIndex}`);
    } catch (error) {
      console.error('Error refreshing widgets for card:', error);
    }
  }
}






