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
 * 
 * Updated: Android now uses RevenueCat (Google Play billing)
 */
export const getPaymentPlatform = (): PaymentPlatform => {
  switch (Platform.OS) {
    case 'ios':
      return 'ios_revenuecat';
    case 'android':
      // Android now uses RevenueCat for Google Play billing
      return 'ios_revenuecat'; // Same path as iOS, just different store
    default:
      return 'web_paystack';
  }
};

/**
 * Check if current platform should use RevenueCat
 * Updated to support both iOS and Android
 */
export const shouldUseRevenueCat = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
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
    useRevenueCat: shouldUseRevenueCat(),
    usePaystack: shouldUsePaystack(),
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    isWeb: Platform.OS === 'web'
  };
};

/**
 * Get platform-specific payment method name for display
 */
export const getPaymentMethodName = (): string => {
  const platform = getPaymentPlatform();
  
  switch (platform) {
    case 'ios_revenuecat':
      return 'App Store';
    case 'android_paystack':
      return 'Paystack';
    case 'web_paystack':
      return 'Paystack';
    default:
      return 'Payment';
  }
};

/**
 * Get platform-specific payment instructions
 */
export const getPaymentInstructions = (): string => {
  switch (Platform.OS) {
    case 'ios':
      return 'Purchase through the App Store using your Apple ID';
    case 'android':
      return 'Purchase through Google Play using your Google account';
    case 'web':
      return 'Complete payment through Paystack';
    default:
      return 'Complete your payment';
  }
};