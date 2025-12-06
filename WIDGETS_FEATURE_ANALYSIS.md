# Widgets Feature Analysis

## Overview
This document analyzes the widgets feature implementation found in the codebase. The widgets feature allows users to create home screen widgets for their digital business cards.

## Current Implementation Status

### Core Architecture

The widgets feature consists of several key components:

1. **WidgetTypes.ts** - Type definitions and enums
2. **WidgetManager.ts** - Main widget management system
3. **WidgetConfig.ts** - Configuration management
4. **widgetUtils.ts** - Utility functions for widget operations

## Key Components

### 1. Widget Types & Enums (`src/widgets/WidgetTypes.ts`)

#### Widget Sizes
- `SMALL` - 2x2 grid
- `MEDIUM` - 4x2 grid
- `LARGE` - 4x4 grid
- `EXTRA_LARGE` - 6x4 grid

#### Display Modes
- `QR_CODE` - Show QR code prominently
- `CARD_INFO` - Show card details
- `HYBRID` - Show both QR code and card info
- `MINIMAL` - Show minimal info with QR code

#### Themes
- `LIGHT` - Light theme
- `DARK` - Dark theme
- `AUTO` - Follow system theme
- `CUSTOM` - Use card's color scheme

#### Update Frequencies
- `NEVER` - Never update automatically
- `HOURLY` - Update every hour
- `DAILY` - Update daily
- `WEEKLY` - Update weekly
- `ON_CHANGE` - Update when card data changes

### 2. Data Structures

#### WidgetData
Contains all card information needed for widget display:
- Card identification (cardIndex, cardId)
- Basic info (name, surname, email, phone, company, occupation)
- Visual elements (profileImage, companyLogo, colorScheme, logoZoomLevel)
- Social links
- QR code data
- Metadata (createdAt, lastUpdated)

#### WidgetConfig
Configuration for widget customization:
- Display settings (size, displayMode, theme)
- Update settings (updateFrequency, lastUpdate)
- Visual customization (showProfileImage, showCompanyLogo, showSocialLinks, showQRCode)
- Layout preferences (backgroundColor, textColor, borderColor, borderRadius)
- Interaction settings (tapToShare, longPressToEdit)
- Metadata (id, cardIndex, createdAt, updatedAt, isActive)

#### WidgetPreferences
User-level preferences:
- Global settings (globalEnabled, defaultSize, defaultTheme, defaultDisplayMode)
- Per-card widget settings
- Update preferences
- Privacy settings

#### WidgetState
Runtime state management:
- Widget identification
- Current state (isVisible, isUpdating, lastError)
- Data and config references
- Performance metrics

### 3. WidgetManager (`src/widgets/WidgetManager.ts`)

Singleton class that manages all widget operations:

**Key Methods:**
- `initialize()` - Initialize the widget manager
- `createWidget(cardIndex, cardData)` - Create a new widget for a card
- `getWidgetData(cardIndex)` - Get widget data for a specific card
- `updateWidgetData(cardIndex, updates)` - Update widget data
- `deleteWidget(cardIndex)` - Delete widget for a card
- `getAllWidgetData()` - Get all widget data
- `getWidgetState(widgetId)` - Get widget state
- `updateWidgetState(widgetId, updates)` - Update widget state
- `subscribeToUpdates(cardIndex, callback)` - Subscribe to widget updates
- `getWidgetAnalytics(widgetId)` - Get widget analytics
- `updateAnalytics(widgetId, updates)` - Update analytics
- `recordInteraction(widgetId, interactionType)` - Record user interactions
- `exportWidgetData()` - Export all widget data
- `importWidgetData(importData)` - Import widget data
- `getWidgetPreferences()` - Get widget preferences
- `updateWidgetPreferences(updates)` - Update preferences

**Storage:**
- Uses AsyncStorage for persistence
- Storage keys:
  - `widgetData_{cardIndex}` - Widget data per card
  - `widgetStates` - Widget states
  - `widgetAnalytics` - Analytics data
  - `widgetErrors` - Error logs

### 4. WidgetConfigManager (`src/widgets/WidgetConfig.ts`)

Manages widget configurations:

**Key Methods:**
- `initialize()` - Initialize the config manager
- `createWidgetConfig(cardIndex, overrides)` - Create new config
- `getWidgetConfig(cardIndex)` - Get config for a card
- `updateWidgetConfig(cardIndex, updates)` - Update config
- `deleteWidgetConfig(cardIndex)` - Delete config
- `getAllWidgetConfigs()` - Get all configs
- `resetWidgetConfig(cardIndex)` - Reset to defaults
- `cloneConfig(sourceCardIndex, targetCardIndex)` - Clone config
- `exportConfigs()` - Export configurations
- `importConfigs(importData)` - Import configurations

**Default Configuration:**
```typescript
{
  size: WidgetSize.MEDIUM,
  displayMode: WidgetDisplayMode.HYBRID,
  theme: WidgetTheme.CUSTOM,
  updateFrequency: WidgetUpdateFrequency.DAILY,
  showProfileImage: true,
  showCompanyLogo: true,
  showSocialLinks: true,
  showQRCode: true,
  borderRadius: 12,
  tapToShare: true,
  longPressToEdit: true,
  isActive: true
}
```

**Utility Functions:**
- `createMinimalConfig()` - Create minimal configuration
- `createFullConfig()` - Create full-featured configuration
- `getRecommendedConfig()` - Get recommended config based on card data

### 5. Widget Utilities (`src/utils/widgetUtils.ts`)

Legacy utility functions for backward compatibility:

**Functions:**
- `getWidgetPreferences()` - Get all widget preferences
- `setWidgetPreference(cardIndex, enabled)` - Set preference for a card
- `getWidgetPreference(cardIndex)` - Get preference for a card
- `toggleWidgetPreference(cardIndex)` - Toggle preference
- `getEnabledWidgetCards()` - Get all enabled widget card indices
- `clearWidgetPreferences()` - Clear all preferences
- `getCardWidgetData(cardIndex)` - Get card data for widget creation

## Features

### 1. Widget Creation
- Automatically creates widget data from card data
- Creates default configuration
- Initializes widget state and analytics

### 2. Widget Customization
- Multiple size options
- Different display modes
- Theme customization
- Show/hide specific elements
- Custom colors and styling
- Border radius customization

### 3. Widget Updates
- Configurable update frequency
- Automatic updates based on card changes
- Background update support
- Manual update capability

### 4. Widget Analytics
- View count tracking
- Tap count tracking
- Share count tracking
- Performance metrics
- User interaction tracking
- Favorite size/theme tracking

### 5. Widget Management
- Export/import functionality
- Configuration cloning
- Reset to defaults
- Delete widgets
- Enable/disable widgets

### 6. Widget State Management
- Runtime state tracking
- Error handling
- Performance monitoring
- Update callbacks/subscriptions

## Integration Points

### Current Integration
- Widget utilities are referenced in `CardsScreen.tsx`
- Widget preferences stored in AsyncStorage
- Card data used for widget creation

### Missing Components
- **UI Components**: No React Native widget UI components found
- **Widget Screens**: No widget configuration/settings screens
- **Native Widget Code**: No native iOS/Android widget implementation
- **Widget Provider**: No widget extension/provider code

## Storage Structure

### AsyncStorage Keys
```
widgetData_{cardIndex} - Widget data per card
widgetStates - All widget states
widgetAnalytics - All analytics data
widgetErrors - Error logs
widgetConfigs - All widget configurations
widgetPreferences - User preferences
```

## Testing

### Demo/Test Files
- `src/widgets/demo.ts` - Test functions for widget system
- `src/widgets/__tests__/WidgetTypes.test.ts` - Type tests
- `src/utils/__tests__/widgetUtils.test.ts` - Utility tests

### Test Functions
- `testWidgetSystem()` - Full system test
- `testWidgetTypes()` - Type validation test
- `runAllTests()` - Run all tests

## Next Steps for Full Implementation

1. **Native Widget Implementation**
   - iOS Widget Extension
   - Android Widget Provider
   - Native bridge for data passing

2. **UI Components**
   - Widget configuration screen
   - Widget preview component
   - Widget settings screen
   - Widget list/management screen

3. **Integration**
   - Connect WidgetManager to card screens
   - Add widget creation buttons
   - Add widget configuration UI
   - Sync widget data with card updates

4. **Backend Integration** (if needed)
   - Store widget configs in backend
   - Sync widget data across devices
   - Widget analytics backend

5. **Platform-Specific Features**
   - iOS 14+ WidgetKit integration
   - Android App Widgets
   - Widget refresh mechanisms
   - Widget deep linking

## Notes

- The current implementation is primarily a data management layer
- No actual native widget rendering code exists
- UI components for widget configuration are missing
- The system is designed to be platform-agnostic but needs platform-specific implementations
- Widget data is currently stored locally (AsyncStorage) - may need backend sync

## Files Summary

### Core Files
- `src/widgets/WidgetTypes.ts` - Type definitions
- `src/widgets/WidgetManager.ts` - Main manager (640 lines)
- `src/widgets/WidgetConfig.ts` - Config manager (452 lines)
- `src/widgets/index.ts` - Exports
- `src/utils/widgetUtils.ts` - Legacy utilities (141 lines)

### Test Files
- `src/widgets/demo.ts` - Demo/test functions
- `src/widgets/__tests__/WidgetTypes.test.ts` - Type tests
- `src/utils/__tests__/widgetUtils.test.ts` - Utility tests

### Total Lines of Code
- Core widget system: ~1,200+ lines
- Test/demo code: ~300+ lines
- **Total: ~1,500+ lines**





