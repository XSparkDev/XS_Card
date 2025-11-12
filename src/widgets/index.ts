// Export all widget types and interfaces
export * from './WidgetTypes';

// Export widget configuration manager
export { default as WidgetConfigManager } from './WidgetConfig';
export { widgetConfigUtils, DEFAULT_WIDGET_CONFIG } from './WidgetConfig';

// Export widget manager
export { default as WidgetManager } from './WidgetManager';

// Re-export commonly used types for convenience
export type {
  WidgetData,
  WidgetConfig,
  WidgetPreferences,
  WidgetState
} from './WidgetTypes';
