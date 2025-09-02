import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  WidgetConfig, 
  WidgetSize, 
  WidgetDisplayMode, 
  WidgetTheme, 
  WidgetUpdateFrequency,
  isWidgetConfig,
  isWidgetSize,
  isWidgetDisplayMode,
  isWidgetTheme,
  isWidgetUpdateFrequency
} from './WidgetTypes';

/**
 * Storage keys for widget configurations
 */
const STORAGE_KEYS = {
  WIDGET_CONFIGS: 'widgetConfigs',
  WIDGET_PREFERENCES: 'widgetPreferences',
  WIDGET_DEFAULTS: 'widgetDefaults'
};

/**
 * Default widget configuration values
 */
export const DEFAULT_WIDGET_CONFIG: Omit<WidgetConfig, 'id' | 'cardIndex' | 'createdAt' | 'updatedAt'> = {
  size: WidgetSize.MEDIUM,
  displayMode: WidgetDisplayMode.HYBRID,
  theme: WidgetTheme.CUSTOM,
  updateFrequency: WidgetUpdateFrequency.DAILY,
  showProfileImage: true,
  showCompanyLogo: true,
  showSocialLinks: true,
  showQRCode: true,
  backgroundColor: undefined, // Will use card's color scheme
  textColor: undefined, // Will use system default
  borderColor: undefined, // Will use card's color scheme
  borderRadius: 12,
  tapToShare: true,
  longPressToEdit: true,
  isActive: true
};

/**
 * Widget configuration manager
 */
export class WidgetConfigManager {
  private static instance: WidgetConfigManager;
  private configs: Map<string, WidgetConfig> = new Map();
  private preferences: any = {};

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): WidgetConfigManager {
    if (!WidgetConfigManager.instance) {
      WidgetConfigManager.instance = new WidgetConfigManager();
    }
    return WidgetConfigManager.instance;
  }

  /**
   * Initialize the configuration manager
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadConfigs();
      await this.loadPreferences();
      console.log('WidgetConfigManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WidgetConfigManager:', error);
    }
  }

  /**
   * Create a new widget configuration for a card
   */
  public async createWidgetConfig(cardIndex: number, overrides?: Partial<WidgetConfig>): Promise<WidgetConfig> {
    const id = this.generateWidgetId(cardIndex);
    const now = new Date().toISOString();
    
    const config: WidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG,
      id,
      cardIndex,
      createdAt: now,
      updatedAt: now,
      ...overrides
    };

    // Validate the configuration
    if (!this.validateConfig(config)) {
      throw new Error('Invalid widget configuration');
    }

    // Save to storage
    await this.saveConfig(config);
    
    // Update local cache
    this.configs.set(id, config);
    
    console.log(`Created widget config for card ${cardIndex}:`, config);
    return config;
  }

  /**
   * Get widget configuration for a specific card
   */
  public async getWidgetConfig(cardIndex: number): Promise<WidgetConfig | null> {
    const id = this.generateWidgetId(cardIndex);
    
    // Check local cache first
    if (this.configs.has(id)) {
      return this.configs.get(id)!;
    }

    // Load from storage
    try {
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      if (configsJson) {
        const configs = JSON.parse(configsJson);
        const config = configs[id];
        if (config && isWidgetConfig(config)) {
          this.configs.set(id, config);
          return config;
        }
      }
    } catch (error) {
      console.error('Error loading widget config:', error);
    }

    return null;
  }

  /**
   * Update widget configuration
   */
  public async updateWidgetConfig(cardIndex: number, updates: Partial<WidgetConfig>): Promise<WidgetConfig> {
    const existingConfig = await this.getWidgetConfig(cardIndex);
    if (!existingConfig) {
      throw new Error(`No widget configuration found for card ${cardIndex}`);
    }

    const updatedConfig: WidgetConfig = {
      ...existingConfig,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Validate the updated configuration
    if (!this.validateConfig(updatedConfig)) {
      throw new Error('Invalid widget configuration');
    }

    // Save to storage
    await this.saveConfig(updatedConfig);
    
    // Update local cache
    this.configs.set(updatedConfig.id, updatedConfig);
    
    console.log(`Updated widget config for card ${cardIndex}:`, updatedConfig);
    return updatedConfig;
  }

  /**
   * Delete widget configuration
   */
  public async deleteWidgetConfig(cardIndex: number): Promise<boolean> {
    const id = this.generateWidgetId(cardIndex);
    
    try {
      // Remove from local cache
      this.configs.delete(id);
      
      // Remove from storage
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      if (configsJson) {
        const configs = JSON.parse(configsJson);
        delete configs[id];
        await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, JSON.stringify(configs));
      }
      
      console.log(`Deleted widget config for card ${cardIndex}`);
      return true;
    } catch (error) {
      console.error('Error deleting widget config:', error);
      return false;
    }
  }

  /**
   * Get all widget configurations
   */
  public async getAllWidgetConfigs(): Promise<WidgetConfig[]> {
    try {
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      if (configsJson) {
        const configs = JSON.parse(configsJson);
        return Object.values(configs).filter(isWidgetConfig);
      }
    } catch (error) {
      console.error('Error loading all widget configs:', error);
    }
    
    return [];
  }

  /**
   * Reset widget configuration to defaults
   */
  public async resetWidgetConfig(cardIndex: number): Promise<WidgetConfig> {
    return this.createWidgetConfig(cardIndex);
  }

  /**
   * Validate widget configuration
   */
  private validateConfig(config: WidgetConfig): boolean {
    try {
      // Check required fields
      if (!config.id || !config.cardIndex || !config.createdAt || !config.updatedAt) {
        return false;
      }

      // Validate enums
      if (!isWidgetSize(config.size)) return false;
      if (!isWidgetDisplayMode(config.displayMode)) return false;
      if (!isWidgetTheme(config.theme)) return false;
      if (!isWidgetUpdateFrequency(config.updateFrequency)) return false;

      // Validate boolean fields
      if (typeof config.showProfileImage !== 'boolean') return false;
      if (typeof config.showCompanyLogo !== 'boolean') return false;
      if (typeof config.showSocialLinks !== 'boolean') return false;
      if (typeof config.showQRCode !== 'boolean') return false;
      if (typeof config.tapToShare !== 'boolean') return false;
      if (typeof config.longPressToEdit !== 'boolean') return false;
      if (typeof config.isActive !== 'boolean') return false;

      // Validate numeric fields
      if (typeof config.borderRadius !== 'number' || config.borderRadius < 0) return false;

      return true;
    } catch (error) {
      console.error('Config validation error:', error);
      return false;
    }
  }

  /**
   * Generate unique widget ID
   */
  private generateWidgetId(cardIndex: number): string {
    return `widget_${cardIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save configuration to storage
   */
  private async saveConfig(config: WidgetConfig): Promise<void> {
    try {
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      const configs = configsJson ? JSON.parse(configsJson) : {};
      
      configs[config.id] = config;
      await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, JSON.stringify(configs));
    } catch (error) {
      console.error('Error saving widget config:', error);
      throw error;
    }
  }

  /**
   * Load configurations from storage
   */
  private async loadConfigs(): Promise<void> {
    try {
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      if (configsJson) {
        const configs = JSON.parse(configsJson);
        this.configs.clear();
        
        Object.values(configs).forEach((config: any) => {
          if (isWidgetConfig(config)) {
            this.configs.set(config.id, config);
          }
        });
      }
    } catch (error) {
      console.error('Error loading widget configs:', error);
    }
  }

  /**
   * Load preferences from storage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const preferencesJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_PREFERENCES);
      if (preferencesJson) {
        this.preferences = JSON.parse(preferencesJson);
      }
    } catch (error) {
      console.error('Error loading widget preferences:', error);
    }
  }

  /**
   * Get default configuration for a specific card
   */
  public getDefaultConfigForCard(cardIndex: number, cardColorScheme?: string): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      ...DEFAULT_WIDGET_CONFIG,
      cardIndex,
      borderColor: cardColorScheme,
      backgroundColor: cardColorScheme ? `${cardColorScheme}20` : undefined
    };
  }

  /**
   * Clone configuration for another card
   */
  public async cloneConfig(sourceCardIndex: number, targetCardIndex: number): Promise<WidgetConfig> {
    const sourceConfig = await this.getWidgetConfig(sourceCardIndex);
    if (!sourceConfig) {
      throw new Error(`No configuration found for source card ${sourceCardIndex}`);
    }

    const clonedConfig = await this.createWidgetConfig(targetCardIndex, {
      size: sourceConfig.size,
      displayMode: sourceConfig.displayMode,
      theme: sourceConfig.theme,
      updateFrequency: sourceConfig.updateFrequency,
      showProfileImage: sourceConfig.showProfileImage,
      showCompanyLogo: sourceConfig.showCompanyLogo,
      showSocialLinks: sourceConfig.showSocialLinks,
      showQRCode: sourceConfig.showQRCode,
      backgroundColor: sourceConfig.backgroundColor,
      textColor: sourceConfig.textColor,
      borderColor: sourceConfig.borderColor,
      borderRadius: sourceConfig.borderRadius,
      tapToShare: sourceConfig.tapToShare,
      longPressToEdit: sourceConfig.longPressToEdit
    });

    return clonedConfig;
  }

  /**
   * Export configurations for backup
   */
  public async exportConfigs(): Promise<string> {
    try {
      const configs = await this.getAllWidgetConfigs();
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        configs
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting configs:', error);
      throw error;
    }
  }

  /**
   * Import configurations from backup
   */
  public async importConfigs(importData: string): Promise<number> {
    try {
      const data = JSON.parse(importData);
      if (!data.configs || !Array.isArray(data.configs)) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;
      for (const config of data.configs) {
        if (isWidgetConfig(config)) {
          await this.saveConfig(config);
          this.configs.set(config.id, config);
          importedCount++;
        }
      }

      console.log(`Imported ${importedCount} widget configurations`);
      return importedCount;
    } catch (error) {
      console.error('Error importing configs:', error);
      throw error;
    }
  }
}

/**
 * Utility functions for widget configuration
 */
export const widgetConfigUtils = {
  /**
   * Create a minimal configuration for quick setup
   */
  createMinimalConfig: (cardIndex: number, cardColorScheme?: string): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt'> => ({
    ...DEFAULT_WIDGET_CONFIG,
    cardIndex,
    size: WidgetSize.SMALL,
    displayMode: WidgetDisplayMode.QR_CODE,
    showProfileImage: false,
    showCompanyLogo: false,
    showSocialLinks: false,
    borderColor: cardColorScheme,
    backgroundColor: cardColorScheme ? `${cardColorScheme}10` : undefined
  }),

  /**
   * Create a full-featured configuration
   */
  createFullConfig: (cardIndex: number, cardColorScheme?: string): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt'> => ({
    ...DEFAULT_WIDGET_CONFIG,
    cardIndex,
    size: WidgetSize.LARGE,
    displayMode: WidgetDisplayMode.HYBRID,
    showProfileImage: true,
    showCompanyLogo: true,
    showSocialLinks: true,
    showQRCode: true,
    borderColor: cardColorScheme,
    backgroundColor: cardColorScheme ? `${cardColorScheme}15` : undefined
  }),

  /**
   * Get recommended configuration based on card data
   */
  getRecommendedConfig: (cardIndex: number, hasProfileImage: boolean, hasCompanyLogo: boolean, hasSocials: boolean): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt'> => {
    const hasVisualElements = hasProfileImage || hasCompanyLogo;
    const hasSocialLinks = hasSocials && Object.values(hasSocials).some(Boolean);
    
    if (hasVisualElements && hasSocialLinks) {
      return widgetConfigUtils.createFullConfig(cardIndex);
    } else if (hasVisualElements || hasSocialLinks) {
      return widgetConfigUtils.createMinimalConfig(cardIndex);
    } else {
      return widgetConfigUtils.createMinimalConfig(cardIndex);
    }
  }
};

export default WidgetConfigManager;
