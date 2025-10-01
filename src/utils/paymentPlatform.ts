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
  const platform = getPaymentPlatform();
  
  switch (platform) {
    case 'ios_revenuecat':
      return 'Purchase through the App Store using your Apple ID';
    case 'android_paystack':
      return 'Complete payment through Paystack';
    case 'web_paystack':
      return 'Complete payment through Paystack';
    default:
      return 'Complete your payment';
  }
};