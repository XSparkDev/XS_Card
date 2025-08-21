/**
 * Centralized Test Mode Configuration
 * 
 * This controls whether the app runs in test mode (for Expo Go compatibility)
 * or production mode (with full native functionality).
 * 
 * TEST_MODE = true:  Shows previews, no actual native operations
 * TEST_MODE = false: Full production functionality with native modules
 * 
 * TODO: Remove this entirely once we move to full native builds
 */
export const TEST_MODE = false;

/**
 * Helper function to check if we're in test mode
 */
export const isTestMode = (): boolean => TEST_MODE;

/**
 * Helper function to log test mode status
 */
export const logTestModeStatus = (feature: string): void => {
  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: ${feature} - showing preview only`);
  } else {
    console.log(`🚀 PRODUCTION MODE: ${feature} - full functionality enabled`);
  }
}; 