/**
 * Pricing Configuration
 * 
 * Centralized pricing for different currencies
 * USD is the default (bigger market)
 * ZAR for South African users
 */

export interface PricingConfig {
  monthly: number;
  annual: number;
  currency: string;
  symbol: string;
}

export const PRICING: Record<string, PricingConfig> = {
  USD: {
    monthly: 12,
    annual: 120,
    currency: 'USD',
    symbol: '$'
  },
  ZAR: {
    monthly: 159.99,
    annual: 1800,
    currency: 'ZAR',
    symbol: 'R'
  }
};

// Default to USD (bigger market)
export const DEFAULT_CURRENCY = 'USD';

/**
 * Get user's preferred currency based on device locale
 * Defaults to USD for international users
 */
export const getUserCurrency = (): string => {
  try {
    // Get device locale (e.g., 'en-ZA', 'en-US', 'af-ZA')
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    
    // Check if user is in South Africa
    if (locale.includes('ZA') || locale.includes('af')) {
      return 'ZAR';
    }
    
    // Default to USD for rest of world
    return 'USD';
  } catch (error) {
    console.log('Error detecting currency, defaulting to USD:', error);
    return 'USD';
  }
};

/**
 * Get pricing for a specific currency
 */
export const getPricing = (currency: string): PricingConfig => {
  return PRICING[currency] || PRICING[DEFAULT_CURRENCY];
};

/**
 * Get all available currencies
 */
export const getAvailableCurrencies = (): string[] => {
  return Object.keys(PRICING);
};
