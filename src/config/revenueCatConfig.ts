/**
 * RevenueCat Frontend Configuration
 * 
 * This file contains the public API keys for RevenueCat
 * These are safe to expose in client-side code
 */

export const REVENUECAT_CONFIG = {
  // iOS Public Key (safe for client-side)
  IOS_PUBLIC_KEY: 'appl_wtSPChhISOCRASiRWkuJSHTCVIF',
  
  // Android Public Key (safe for client-side)  
  ANDROID_PUBLIC_KEY: 'goog_ihpOFcAHowZqiJQjlYFeimTNnES',
  
  // Entitlement ID
  ENTITLEMENT_ID: 'premium'
};

/**
 * Get the appropriate API key for the current platform
 */
export const getRevenueCatApiKey = (): string => {
  const { Platform } = require('react-native');

  if (__DEV__) {
    return 'test_HfrWLhYfwFCLigMSxEpwiFqXRfx';
  }
  
  return Platform.OS === 'ios' 
    ? REVENUECAT_CONFIG.IOS_PUBLIC_KEY
    : REVENUECAT_CONFIG.ANDROID_PUBLIC_KEY;
};
