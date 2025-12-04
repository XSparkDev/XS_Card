import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  WidgetData, 
  WidgetConfig, 
  WidgetPreferences, 
  WidgetState, 
  WidgetUpdatePayload,
  WidgetError,
  WidgetAnalytics,
  WidgetExportData,
  WidgetSize,
  isWidgetData,
  isWidgetConfig
} from './WidgetTypes';
import WidgetConfigManager from './WidgetConfig';
import { getUserId } from '../utils/api';
import { WidgetPlatformAdapter } from './WidgetPlatformAdapter';

/**
 * Storage keys for widget management
 */
const STORAGE_KEYS = {
  WIDGET_DATA: 'widgetData',
  WIDGET_STATES: 'widgetStates',
  WIDGET_ANALYTICS: 'widgetAnalytics',
  WIDGET_ERRORS: 'widgetErrors'
};

/**
 * Main widget manager for the entire system
 */
export class WidgetManager {
  private static instance: WidgetManager;
  private configManager: WidgetConfigManager;
  private widgetData: Map<number, WidgetData> = new Map();
  private widgetStates: Map<string, WidgetState> = new Map();
  private analytics: Map<string, WidgetAnalytics> = new Map();
  private errors: WidgetError[] = [];
  private isInitialized = false;
  private updateCallbacks: Map<string, Function[]> = new Map();

  private constructor() {
    this.configManager = WidgetConfigManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WidgetManager {
    if (!WidgetManager.instance) {
      WidgetManager.instance = new WidgetManager();
    }
    return WidgetManager.instance;
  }

  /**
   * Initialize the widget manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('WidgetManager already initialized');
      return;
    }

    try {
      // Initialize configuration manager
      await this.configManager.initialize();
      
      // Load existing data
      await this.loadWidgetData();
      await this.loadWidgetStates();
      await this.loadAnalytics();
      await this.loadErrors();
      
      this.isInitialized = true;
      console.log('WidgetManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WidgetManager:', error);
      throw error;
    }
  }

  /**
   * Create a new widget for a card
   */
  public async createWidget(cardIndex: number, cardData: any): Promise<WidgetData> {
    try {
      // Validate card data
      if (!this.validateCardData(cardData)) {
        throw new Error('Invalid card data provided');
      }

      // Create widget data
      const widgetData: WidgetData = {
        cardIndex,
        cardId: cardData.id || `card_${cardIndex}`,
        name: cardData.name || '',
        surname: cardData.surname || '',
        email: cardData.email || '',
        phone: cardData.phone || '',
        company: cardData.company || '',
        occupation: cardData.occupation || '',
        profileImage: cardData.profileImage || undefined,
        companyLogo: cardData.companyLogo || undefined,
        colorScheme: cardData.colorScheme || '#1B2B5B',
        logoZoomLevel: cardData.logoZoomLevel || 1,
        socials: cardData.socials || {},
        // Prefer explicit QR data from caller (EditCard) if provided
        qrCodeUrl: cardData.qrCodeUrl || undefined,
        qrCodeData: cardData.qrCodeData || cardData.qrCodeUrl || undefined,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0' // Schema version for migration support
      };

      // Create widget configuration
      const config = await this.configManager.createWidgetConfig(cardIndex, {
        ...this.configManager.getDefaultConfigForCard(cardIndex, widgetData.colorScheme)
      });

      // Create native widget through platform adapter
      const platformResult = await WidgetPlatformAdapter.createWidget(cardIndex, widgetData, config);
      
      if (!platformResult.success) {
        console.warn('Native widget creation failed, continuing with data storage:', platformResult.error);
      }

      // Save widget data
      await this.saveWidgetData(cardIndex, widgetData);
      
      // Initialize widget state
      await this.initializeWidgetState(widgetData, config);
      
      // Initialize analytics
      await this.initializeAnalytics(widgetData, config);

      console.log(`Created widget for card ${cardIndex}:`, widgetData);
      return widgetData;
    } catch (error) {
      console.error(`Error creating widget for card ${cardIndex}:`, error);
      throw error;
    }
  }

  /**
   * Get widget data for a specific card
   */
  public async getWidgetData(cardIndex: number): Promise<WidgetData | null> {
    // Check local cache first
    if (this.widgetData.has(cardIndex)) {
      return this.widgetData.get(cardIndex)!;
    }

    // Load from storage
    try {
      const dataJson = await AsyncStorage.getItem(`${STORAGE_KEYS.WIDGET_DATA}_${cardIndex}`);
      if (dataJson) {
        const data = JSON.parse(dataJson);
        if (isWidgetData(data)) {
          // Ensure version is set for backward compatibility
          if (!data.version) {
            data.version = '1.0.0';
          }
          this.widgetData.set(cardIndex, data);
          return data;
        }
      }
    } catch (error) {
      console.error('Error loading widget data:', error);
    }

    return null;
  }

  /**
   * Update widget data
   */
  public async updateWidgetData(cardIndex: number, updates: Partial<WidgetData>): Promise<WidgetData> {
    const existingData = await this.getWidgetData(cardIndex);
    if (!existingData) {
      throw new Error(`No widget data found for card ${cardIndex}`);
    }

    const updatedData: WidgetData = {
      ...existingData,
      ...updates,
      lastUpdated: new Date().toISOString(),
      version: updates.version || existingData.version || '1.0.0' // Preserve or set version
    };

    // Validate updated data
    if (!this.validateWidgetData(updatedData)) {
      throw new Error('Invalid widget data');
    }

    // Save updated data
    await this.saveWidgetData(cardIndex, updatedData);
    
    // Update local cache
    this.widgetData.set(cardIndex, updatedData);
    
    // Notify subscribers
    this.notifyUpdate(cardIndex, updatedData);
    
    // Update native widget if it exists
    try {
      const config = await this.configManager.getWidgetConfig(cardIndex);
      if (config?.id) {
        // Prepare data for native bridge (iOS expects specific format)
        const nativeData: any = {
          name: updatedData.name || '',
          surname: updatedData.surname || '',
          company: updatedData.company || '',
          occupation: updatedData.occupation || '',
          email: updatedData.email || '',
          phone: updatedData.phone || '',
          colorScheme: updatedData.colorScheme || '#1B2B5B',
          qrCodeData: updatedData.qrCodeData || '',
        };
        
        const platformResult = await WidgetPlatformAdapter.updateWidget(config.id, nativeData);
        if (!platformResult.success) {
          console.warn('Native widget update failed:', platformResult.error);
        } else {
          console.log('Native widget updated successfully');
        }
      }
    } catch (error) {
      console.error('Error updating native widget:', error);
      // Don't fail the whole operation if native update fails
    }
    
    console.log(`Updated widget data for card ${cardIndex}:`, updatedData);
    return updatedData;
  }

  /**
   * Delete widget for a card
   */
  public async deleteWidget(cardIndex: number): Promise<boolean> {
    try {
      // Generate widget ID for deletion
      const widgetId = this.generateWidgetId(cardIndex);
      
      // Delete native widget through platform adapter
      const platformResult = await WidgetPlatformAdapter.deleteWidget(widgetId);
      
      if (!platformResult.success) {
        console.warn('Native widget deletion failed, continuing with data cleanup:', platformResult.error);
      }

      // Remove from local cache
      this.widgetData.delete(cardIndex);
      
      // Remove configuration
      await this.configManager.deleteWidgetConfig(cardIndex);
      
      // Remove from storage
      await AsyncStorage.removeItem(`${STORAGE_KEYS.WIDGET_DATA}_${cardIndex}`);
      
      // Remove widget state
      this.widgetStates.delete(widgetId);
      
      // Remove analytics
      this.analytics.delete(widgetId);
      
      console.log(`Deleted widget for card ${cardIndex}`);
      return true;
    } catch (error) {
      console.error(`Error deleting widget for card ${cardIndex}:`, error);
      return false;
    }
  }

  /**
   * Get all widget data
   */
  public async getAllWidgetData(): Promise<WidgetData[]> {
    const allData: WidgetData[] = [];
    
    for (const [cardIndex, data] of this.widgetData) {
      allData.push(data);
    }
    
    return allData;
  }

  /**
   * Get widget configurations for a specific card
   */
  public async getWidgetsByCardIndex(cardIndex: number): Promise<WidgetConfig[]> {
    const allConfigs = await this.configManager.getAllWidgetConfigs();
    return allConfigs.filter(config => config.cardIndex === cardIndex);
  }

  /**
   * Update widget configuration
   */
  public async updateWidgetConfig(cardIndex: number, updates: Partial<WidgetConfig>): Promise<WidgetConfig> {
    return await this.configManager.updateWidgetConfig(cardIndex, updates);
  }

  /**
   * Get widget state
   */
  public async getWidgetState(widgetId: string): Promise<WidgetState | null> {
    if (this.widgetStates.has(widgetId)) {
      return this.widgetStates.get(widgetId)!;
    }
    return null;
  }

  /**
   * Update widget state
   */
  public async updateWidgetState(widgetId: string, updates: Partial<WidgetState>): Promise<WidgetState> {
    const existingState = await this.getWidgetState(widgetId);
    if (!existingState) {
      throw new Error(`No widget state found for ${widgetId}`);
    }

    const updatedState: WidgetState = {
      ...existingState,
      ...updates,
      lastRenderTime: new Date().toISOString()
    };

    this.widgetStates.set(widgetId, updatedState);
    await this.saveWidgetStates();
    
    return updatedState;
  }

  /**
   * Subscribe to widget updates
   */
  public subscribeToUpdates(cardIndex: number, callback: Function): () => void {
    const key = cardIndex.toString();
    if (!this.updateCallbacks.has(key)) {
      this.updateCallbacks.set(key, []);
    }
    
    this.updateCallbacks.get(key)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.updateCallbacks.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get widget analytics
   */
  public async getWidgetAnalytics(widgetId: string): Promise<WidgetAnalytics | null> {
    if (this.analytics.has(widgetId)) {
      return this.analytics.get(widgetId)!;
    }
    return null;
  }

  /**
   * Update widget analytics
   */
  public async updateAnalytics(widgetId: string, updates: Partial<WidgetAnalytics>): Promise<void> {
    const existing = await this.getWidgetAnalytics(widgetId);
    if (existing) {
      const updated: WidgetAnalytics = {
        ...existing,
        ...updates,
        lastSeen: new Date().toISOString()
      };
      this.analytics.set(widgetId, updated);
    }
  }

  /**
   * Record widget interaction
   */
  public async recordInteraction(widgetId: string, interactionType: 'view' | 'tap' | 'share'): Promise<void> {
    const analytics = await this.getWidgetAnalytics(widgetId);
    if (analytics) {
      const updates: Partial<WidgetAnalytics> = {
        lastInteraction: new Date().toISOString()
      };

      switch (interactionType) {
        case 'view':
          updates.viewCount = (analytics.viewCount || 0) + 1;
          break;
        case 'tap':
          updates.tapCount = (analytics.tapCount || 0) + 1;
          break;
        case 'share':
          updates.shareCount = (analytics.shareCount || 0) + 1;
          break;
      }

      await this.updateAnalytics(widgetId, updates);
    }
  }

  /**
   * Export all widget data
   */
  public async exportWidgetData(): Promise<string> {
    try {
      const configs = await this.configManager.getAllWidgetConfigs();
      const allData = await this.getAllWidgetData();
      const allAnalytics = Array.from(this.analytics.values());
      
      const exportData: WidgetExportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        preferences: await this.getWidgetPreferences(),
        configs,
        analytics: allAnalytics
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting widget data:', error);
      throw error;
    }
  }

  /**
   * Import widget data
   */
  public async importWidgetData(importData: string): Promise<number> {
    try {
      const data = JSON.parse(importData);
      if (!data.configs || !Array.isArray(data.configs)) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;
      
      // Import configurations
      for (const config of data.configs) {
        if (isWidgetConfig(config)) {
          await this.configManager.importConfigs(JSON.stringify({ configs: [config] }));
          importedCount++;
        }
      }

      console.log(`Imported ${importedCount} widget configurations`);
      return importedCount;
    } catch (error) {
      console.error('Error importing widget data:', error);
      throw error;
    }
  }

  /**
   * Get widget preferences
   */
  public async getWidgetPreferences(): Promise<WidgetPreferences> {
    try {
      const preferencesJson = await AsyncStorage.getItem('widgetPreferences');
      if (preferencesJson) {
        return JSON.parse(preferencesJson);
      }
    } catch (error) {
      console.error('Error loading widget preferences:', error);
    }
    
    // Return default preferences
    return {
      globalEnabled: true,
      defaultSize: WidgetSize.LARGE,
      defaultTheme: 'custom' as any,
      defaultDisplayMode: 'hybrid' as any,
      cardWidgets: {},
      updateFrequency: 'daily' as any,
      allowBackgroundUpdates: true,
      showPersonalInfo: true,
      showContactDetails: true,
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Update widget preferences
   */
  public async updateWidgetPreferences(updates: Partial<WidgetPreferences>): Promise<WidgetPreferences> {
    const existing = await this.getWidgetPreferences();
    const updated: WidgetPreferences = {
      ...existing,
      ...updates,
      lastModified: new Date().toISOString()
    };

    await AsyncStorage.setItem('widgetPreferences', JSON.stringify(updated));
    return updated;
  }

  /**
   * Validate card data
   */
  private validateCardData(cardData: any): boolean {
    return cardData && 
           typeof cardData.name === 'string' &&
           typeof cardData.surname === 'string' &&
           typeof cardData.email === 'string' &&
           typeof cardData.phone === 'string' &&
           typeof cardData.company === 'string' &&
           typeof cardData.occupation === 'string';
  }

  /**
   * Validate widget data
   */
  private validateWidgetData(data: WidgetData): boolean {
    return isWidgetData(data);
  }

  /**
   * Save widget data to storage
   */
  private async saveWidgetData(cardIndex: number, data: WidgetData): Promise<void> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEYS.WIDGET_DATA}_${cardIndex}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving widget data:', error);
      throw error;
    }
  }

  /**
   * Initialize widget state
   */
  private async initializeWidgetState(widgetData: WidgetData, config: WidgetConfig): Promise<void> {
    const widgetId = config.id;
    const state: WidgetState = {
      widgetId,
      cardIndex: widgetData.cardIndex,
      isVisible: false,
      isUpdating: false,
      data: widgetData,
      config,
      renderCount: 0,
      lastRenderTime: new Date().toISOString(),
      averageRenderTime: 0
    };

    this.widgetStates.set(widgetId, state);
    await this.saveWidgetStates();
  }

  /**
   * Initialize analytics
   */
  private async initializeAnalytics(widgetData: WidgetData, config: WidgetConfig): Promise<void> {
    const widgetId = config.id;
    const analytics: WidgetAnalytics = {
      widgetId,
      cardIndex: widgetData.cardIndex,
      viewCount: 0,
      tapCount: 0,
      shareCount: 0,
      averageLoadTime: 0,
      errorCount: 0,
      lastInteraction: new Date().toISOString(),
      favoriteSize: config.size as any,
      favoriteTheme: config.theme as any,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    this.analytics.set(widgetId, analytics);
    await this.saveAnalytics();
  }

  /**
   * Generate widget ID
   */
  private generateWidgetId(cardIndex: number): string {
    return `widget_${cardIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify subscribers of updates
   */
  private notifyUpdate(cardIndex: number, data: WidgetData): void {
    const key = cardIndex.toString();
    const callbacks = this.updateCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in update callback:', error);
        }
      });
    }
  }

  /**
   * Load widget data from storage
   */
  private async loadWidgetData(): Promise<void> {
    try {
      // This would need to be implemented based on how you want to discover existing widgets
      // For now, we'll start with an empty state
      console.log('Widget data loaded from storage');
    } catch (error) {
      console.error('Error loading widget data:', error);
    }
  }

  /**
   * Load widget states from storage
   */
  private async loadWidgetStates(): Promise<void> {
    try {
      const statesJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_STATES);
      if (statesJson) {
        const states = JSON.parse(statesJson);
        this.widgetStates.clear();
        Object.entries(states).forEach(([id, state]) => {
          this.widgetStates.set(id, state as WidgetState);
        });
      }
    } catch (error) {
      console.error('Error loading widget states:', error);
    }
  }

  /**
   * Save widget states to storage
   */
  private async saveWidgetStates(): Promise<void> {
    try {
      const states: { [key: string]: WidgetState } = {};
      this.widgetStates.forEach((state, id) => {
        states[id] = state;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_STATES, JSON.stringify(states));
    } catch (error) {
      console.error('Error saving widget states:', error);
    }
  }

  /**
   * Load analytics from storage
   */
  private async loadAnalytics(): Promise<void> {
    try {
      const analyticsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_ANALYTICS);
      if (analyticsJson) {
        const analytics = JSON.parse(analyticsJson);
        this.analytics.clear();
        Object.entries(analytics).forEach(([id, data]) => {
          this.analytics.set(id, data as WidgetAnalytics);
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  /**
   * Save analytics to storage
   */
  private async saveAnalytics(): Promise<void> {
    try {
      const analytics: { [key: string]: WidgetAnalytics } = {};
      this.analytics.forEach((data, id) => {
        analytics[id] = data;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_ANALYTICS, JSON.stringify(analytics));
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }

  /**
   * Load errors from storage
   */
  private async loadErrors(): Promise<void> {
    try {
      const errorsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_ERRORS);
      if (errorsJson) {
        this.errors = JSON.parse(errorsJson);
      }
    } catch (error) {
      console.error('Error loading errors:', error);
    }
  }

  /**
   * Save errors to storage
   */
  private async saveErrors(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_ERRORS, JSON.stringify(this.errors));
    } catch (error) {
      console.error('Error saving errors:', error);
    }
  }
}

export default WidgetManager;
