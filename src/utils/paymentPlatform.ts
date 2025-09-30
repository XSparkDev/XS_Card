import { Platform } from 'react-native';

/**
 * Payment Platform Detection Utility
 * 
 * Following golden rules:
 * - Reuse existing Platform.OS patterns
 * - Additive changes only
 * - No assumptions without clarification
 */

export type PaymentPlatform = 'ios_revenuecat' | 'android_paystack' | 'web_paystack';

/**
 * Determine which payment platform to use based on current platform
 * Following existing Platform.OS pattern from api.ts
 */
export const getPaymentPlatform = (): PaymentPlatform => {
  switch (Platform.OS) {
    case 'ios':
      return 'ios_revenuecat';
    case 'android':
      // For now, keep Android on Paystack (as requested - Paystack disabled but keeping structure)
      return 'android_paystack';
    default:
      return 'web_paystack';
  }
};

/**
 * Check if current platform should use RevenueCat
 */
export const shouldUseRevenueCat = (): boolean => {
  return Platform.OS === 'ios';
};

/**
 * Check if current platform should use Paystack
 * Note: Currently disabled as requested, but structure maintained
 */
export const shouldUsePaystack = (): boolean => {
  // Keeping structure for future Android implementation
  return Platform.OS === 'android' && false; // Explicitly disabled
};

/**
 * Get platform-specific configuration
 */
export const getPlatformConfig = () => {
  const platform = getPaymentPlatform();
  
  return {
    platform,
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    useRevenueCat: shouldUseRevenueCat(),
    usePaystack: shouldUsePaystack(),
    // Add platform field for Firebase schema extension
    platformField: Platform.OS
  };
};

/**
 * Platform-specific subscription status fields for Firebase
 * Following existing Firebase patterns
 */
export const getPlatformSubscriptionFields = () => {
  const config = getPlatformConfig();
  
  if (config.useRevenueCat) {
    return {
      subscriptionPlatform: 'ios_revenuecat',
      revenuecatCustomerId: null, // Will be populated on first purchase
      revenuecatOriginalAppUserId: null,
      appleOriginalTransactionId: null,
    };
  }
  
  // Keep Paystack structure for future use
  return {
    subscriptionPlatform: 'paystack',
    paystackCustomerId: null,
    paystackSubscriptionId: null,
  };
};
