

/**
 * Widget size options for different home screen layouts
 */
export enum WidgetSize {
  SMALL = 'small',      // 2x2 grid
  MEDIUM = 'medium',    // 4x2 grid  
  LARGE = 'large',      // 4x4 grid
  EXTRA_LARGE = 'xl'    // 6x4 grid
}

/**
 * Widget display modes for different content layouts
 */
export enum WidgetDisplayMode {
  QR_CODE = 'qr_code',           // Show QR code prominently
  CARD_INFO = 'card_info',       // Show card details
  HYBRID = 'hybrid',             // Show both QR code and card info
  MINIMAL = 'minimal'            // Show minimal info with QR code
}

/**
 * Widget theme options for visual customization
 */
export enum WidgetTheme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',                 // Follow system theme
  CUSTOM = 'custom'              // Use card's color scheme
}

/**
 * Widget update frequency for data refresh
 */
export enum WidgetUpdateFrequency {
  NEVER = 'never',               // Never update automatically
  HOURLY = 'hourly',            // Update every hour
  DAILY = 'daily',              // Update daily
  WEEKLY = 'weekly',            // Update weekly
  ON_CHANGE = 'on_change'       // Update when card data changes
}

/**
 * Core widget data structure that matches existing card data
 */
export interface WidgetData {
  // Card identification
  cardIndex: number;
  cardId: string;
  
  // Basic card information
  name: string;
  surname: string;
  email: string;
  phone: string;
  company: string;
  occupation: string;
  
  // Visual elements
  profileImage?: string;
  companyLogo?: string;
  colorScheme: string;
  logoZoomLevel?: number;
  
  // Social links
  socials: {
    [key: string]: string | null;
  };
  
  // QR code data
  qrCodeUrl?: string;
  qrCodeData?: string;
  
  // Metadata
  createdAt: string;
  lastUpdated: string;
}

/**
 * Widget configuration for customization
 */
export interface WidgetConfig {
  // Widget identification
  id: string;
  cardIndex: number;
  
  // Display settings
  size: WidgetSize;
  displayMode: WidgetDisplayMode;
  theme: WidgetTheme;
  
  // Update settings
  updateFrequency: WidgetUpdateFrequency;
  lastUpdate?: string;
  
  // Visual customization
  showProfileImage: boolean;
  showCompanyLogo: boolean;
  showSocialLinks: boolean;
  showQRCode: boolean;
  
  // Layout preferences
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius: number;
  
  // Interaction settings
  tapToShare: boolean;
  longPressToEdit: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/**
 * Widget preferences for user settings
 */
export interface WidgetPreferences {
  // Global widget settings
  globalEnabled: boolean;
  defaultSize: WidgetSize;
  defaultTheme: WidgetTheme;
  defaultDisplayMode: WidgetDisplayMode;
  
  // Per-card widget settings
  cardWidgets: {
    [cardIndex: number]: {
      enabled: boolean;
      config?: WidgetConfig;
    };
  };
  
  // Update preferences
  updateFrequency: WidgetUpdateFrequency;
  allowBackgroundUpdates: boolean;
  
  // Privacy settings
  showPersonalInfo: boolean;
  showContactDetails: boolean;
  
  // Metadata
  lastModified: string;
  version: string;
}

/**
 * Widget state for runtime management
 */
export interface WidgetState {
  // Widget identification
  widgetId: string;
  cardIndex: number;
  
  // Current state
  isVisible: boolean;
  isUpdating: boolean;
  lastError?: string;
  
  // Data state
  data: WidgetData;
  config: WidgetConfig;
  
  // Performance metrics
  renderCount: number;
  lastRenderTime: string;
  averageRenderTime: number;
}

/**
 * Widget update payload for data synchronization
 */
export interface WidgetUpdatePayload {
  widgetId: string;
  cardIndex: number;
  data: Partial<WidgetData>;
  config?: Partial<WidgetConfig>;
  timestamp: string;
  source: 'user' | 'system' | 'background';
}

/**
 * Widget error information for debugging
 */
export interface WidgetError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  widgetId?: string;
  cardIndex?: number;
}

/**
 * Widget analytics for usage tracking
 */
export interface WidgetAnalytics {
  widgetId: string;
  cardIndex: number;
  
  // Usage metrics
  viewCount: number;
  tapCount: number;
  shareCount: number;
  
  // Performance metrics
  averageLoadTime: number;
  errorCount: number;
  
  // User interaction
  lastInteraction: string;
  favoriteSize: WidgetSize;
  favoriteTheme: WidgetTheme;
  
  // Metadata
  firstSeen: string;
  lastSeen: string;
}

/**
 * Widget export/import data for backup/restore
 */
export interface WidgetExportData {
  version: string;
  exportDate: string;
  preferences: WidgetPreferences;
  configs: WidgetConfig[];
  analytics?: WidgetAnalytics[];
}

/**
 * Type guards for runtime type checking
 */
export const isWidgetSize = (value: any): value is WidgetSize => {
  return Object.values(WidgetSize).includes(value);
};

export const isWidgetDisplayMode = (value: any): value is WidgetDisplayMode => {
  return Object.values(WidgetDisplayMode).includes(value);
};

export const isWidgetTheme = (value: any): value is WidgetTheme => {
  return Object.values(WidgetTheme).includes(value);
};

export const isWidgetUpdateFrequency = (value: any): value is WidgetUpdateFrequency => {
  return Object.values(WidgetUpdateFrequency).includes(value);
};

export const isWidgetConfig = (value: any): value is WidgetConfig => {
  return value && 
         typeof value.id === 'string' &&
         typeof value.cardIndex === 'number' &&
         isWidgetSize(value.size) &&
         isWidgetDisplayMode(value.displayMode) &&
         isWidgetTheme(value.theme) &&
         isWidgetUpdateFrequency(value.updateFrequency);
};

export const isWidgetData = (value: any): value is WidgetData => {
  return value &&
         typeof value.cardIndex === 'number' &&
         typeof value.name === 'string' &&
         typeof value.surname === 'string' &&
         typeof value.email === 'string' &&
         typeof value.phone === 'string' &&
         typeof value.company === 'string' &&
         typeof value.occupation === 'string' &&
         typeof value.colorScheme === 'string';
};
