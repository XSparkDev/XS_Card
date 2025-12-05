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
export const DEFAULT_WIDGET_CONFIG: Omit<WidgetConfig, 'id' | 'cardIndex' | 'createdAt' | 'updatedAt' | 'version'> = {
  size: WidgetSize.LARGE,
  displayMode: WidgetDisplayMode.HYBRID, // Default, not shown in UI
  theme: WidgetTheme.CUSTOM, // Default, not shown in UI
  updateFrequency: WidgetUpdateFrequency.ON_CHANGE,
  showProfileImage: true,
  showCompanyLogo: false, // Not shown in UI
  showSocialLinks: false, // Not shown in UI
  showQRCode: true, // Always shown
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
    
    // Build config ensuring all required fields are present
    const config: WidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG, // Start with all defaults
      ...(overrides || {}), // Apply any overrides
      // These fields must always be set explicitly
      id,
      cardIndex,
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      // Ensure required fields that might be missing from overrides
      displayMode: overrides?.displayMode || DEFAULT_WIDGET_CONFIG.displayMode,
      theme: overrides?.theme || DEFAULT_WIDGET_CONFIG.theme,
      updateFrequency: overrides?.updateFrequency || DEFAULT_WIDGET_CONFIG.updateFrequency,
      size: overrides?.size || DEFAULT_WIDGET_CONFIG.size,
      showProfileImage: overrides?.showProfileImage ?? DEFAULT_WIDGET_CONFIG.showProfileImage,
      showCompanyLogo: overrides?.showCompanyLogo ?? DEFAULT_WIDGET_CONFIG.showCompanyLogo,
      showSocialLinks: overrides?.showSocialLinks ?? DEFAULT_WIDGET_CONFIG.showSocialLinks,
      showQRCode: overrides?.showQRCode ?? DEFAULT_WIDGET_CONFIG.showQRCode,
      borderRadius: overrides?.borderRadius ?? DEFAULT_WIDGET_CONFIG.borderRadius,
      tapToShare: overrides?.tapToShare ?? DEFAULT_WIDGET_CONFIG.tapToShare,
      longPressToEdit: overrides?.longPressToEdit ?? DEFAULT_WIDGET_CONFIG.longPressToEdit,
      isActive: overrides?.isActive ?? DEFAULT_WIDGET_CONFIG.isActive,
    };

    // Validate the configuration
    if (!this.validateConfig(config)) {
      console.error('Widget config validation failed. Full config:', JSON.stringify(config, null, 2));
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
    // First, try to find in local cache by cardIndex
    for (const [id, config] of this.configs) {
      if (config.cardIndex === cardIndex) {
        return config;
      }
    }

    // Load from storage and search by cardIndex
    try {
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      if (configsJson) {
        const configs = JSON.parse(configsJson);
        // Search through all configs to find one with matching cardIndex
        for (const [id, configData] of Object.entries(configs)) {
          if (configData && typeof configData === 'object' && isWidgetConfig(configData as any)) {
            const config = configData as WidgetConfig;
            if (config.cardIndex === cardIndex) {
              // Ensure version is set for backward compatibility
              if (!config.version) {
                config.version = '1.0.0';
              }
              this.configs.set(id, config);
              return config;
            }
          }
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
      updatedAt: new Date().toISOString(),
      version: updates.version || existingConfig.version || '1.0.0', // Preserve or set version
      // Ensure required fields are preserved if not in updates
      displayMode: updates.displayMode || existingConfig.displayMode,
      theme: updates.theme || existingConfig.theme
    };

    // Validate the updated configuration
    if (!this.validateConfig(updatedConfig)) {
      console.error('Widget config update validation failed. Full config:', JSON.stringify(updatedConfig, null, 2));
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
    try {
      // Find ALL widget configs with this cardIndex (in case of duplicates)
      const allConfigs = await this.getAllWidgetConfigs();
      const configsToDelete = allConfigs.filter(config => config.cardIndex === cardIndex);
      
      if (configsToDelete.length === 0) {
        console.log(`No widget config found for card ${cardIndex} to delete`);
        return true; // Already deleted or never existed
      }
      
      // Remove from local cache
      for (const config of configsToDelete) {
        this.configs.delete(config.id);
      }
      
      // Remove from storage
      const configsJson = await AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
      if (configsJson) {
        const configs = JSON.parse(configsJson);
        for (const config of configsToDelete) {
          delete configs[config.id];
        }
        await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, JSON.stringify(configs));
      }
      
      console.log(`Deleted ${configsToDelete.length} widget config(s) for card ${cardIndex}`);
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
      if (!config.id) {
        console.error('Validation failed: missing id');
        return false;
      }
      if (config.cardIndex === undefined || config.cardIndex === null) {
        console.error('Validation failed: missing or invalid cardIndex');
        return false;
      }
      if (!config.createdAt) {
        console.error('Validation failed: missing createdAt');
        return false;
      }
      if (!config.updatedAt) {
        console.error('Validation failed: missing updatedAt');
        return false;
      }

      // Validate enums
      if (!isWidgetSize(config.size)) {
        console.error('Validation failed: invalid size', config.size);
        return false;
      }
      if (!isWidgetDisplayMode(config.displayMode)) {
        console.error('Validation failed: invalid displayMode', config.displayMode);
        return false;
      }
      if (!isWidgetTheme(config.theme)) {
        console.error('Validation failed: invalid theme', config.theme);
        return false;
      }
      if (!isWidgetUpdateFrequency(config.updateFrequency)) {
        console.error('Validation failed: invalid updateFrequency', config.updateFrequency);
        return false;
      }

      // Validate boolean fields
      if (typeof config.showProfileImage !== 'boolean') {
        console.error('Validation failed: showProfileImage must be boolean', typeof config.showProfileImage);
        return false;
      }
      if (typeof config.showCompanyLogo !== 'boolean') {
        console.error('Validation failed: showCompanyLogo must be boolean', typeof config.showCompanyLogo);
        return false;
      }
      if (typeof config.showSocialLinks !== 'boolean') {
        console.error('Validation failed: showSocialLinks must be boolean', typeof config.showSocialLinks);
        return false;
      }
      if (typeof config.showQRCode !== 'boolean') {
        console.error('Validation failed: showQRCode must be boolean', typeof config.showQRCode);
        return false;
      }
      if (typeof config.tapToShare !== 'boolean') {
        console.error('Validation failed: tapToShare must be boolean', typeof config.tapToShare);
        return false;
      }
      if (typeof config.longPressToEdit !== 'boolean') {
        console.error('Validation failed: longPressToEdit must be boolean', typeof config.longPressToEdit);
        return false;
      }
      if (typeof config.isActive !== 'boolean') {
        console.error('Validation failed: isActive must be boolean', typeof config.isActive);
        return false;
      }

      // Validate numeric fields
      if (typeof config.borderRadius !== 'number' || config.borderRadius < 0) {
        console.error('Validation failed: borderRadius must be a non-negative number', config.borderRadius);
        return false;
      }

      // Validate version
      if (!config.version) {
        console.error('Validation failed: missing version');
        return false;
      }

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
            // Ensure version is set for backward compatibility
            if (!config.version) {
              config.version = '1.0.0';
            }
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
      version: '1.0.0',
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
  createMinimalConfig: (cardIndex: number, cardColorScheme?: string): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'> => ({
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
  createFullConfig: (cardIndex: number, cardColorScheme?: string): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'> => ({
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
  getRecommendedConfig: (cardIndex: number, hasProfileImage: boolean, hasCompanyLogo: boolean, hasSocials: boolean): Omit<WidgetConfig, 'id' | 'createdAt' | 'updatedAt' | 'version'> => {
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
