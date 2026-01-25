/**
 * Enterprise Pricing Configuration
 * 
 * Handles price calculation for enterprise subscriptions based on employee count.
 * Supports ZAR and USD currencies with simple linear pricing model.
 */

const ENTERPRISE_PRICING = {
  ZAR: {
    basePrice: 10000,           // R100.00 base price (in cents)
    pricePerEmployee: 1000,     // R10.00 per employee (in cents)
    minimumEmployees: 1,
    maximumEmployees: 10000,
    currency: 'ZAR'
  },
  USD: {
    basePrice: 500,             // $5.00 base price (in cents)
    pricePerEmployee: 50,       // $0.50 per employee (in cents)
    minimumEmployees: 1,
    maximumEmployees: 10000,
    currency: 'USD'
  }
};

const SUPPORTED_CURRENCIES = ['ZAR', 'USD'];

/**
 * Calculate enterprise price based on employee count and currency
 * 
 * @param {number} numberOfEmployees - Number of employees (must be 1-10000)
 * @param {string} currency - Currency code ('ZAR' or 'USD', default: 'ZAR')
 * @returns {number} - Price in cents (kobo)
 * @throws {Error} - If employee count is invalid or currency is unsupported
 */
function calculateEnterprisePrice(numberOfEmployees, currency = 'ZAR') {
  // Normalize currency to uppercase (handle non-string by converting to string first)
  let upperCaseCurrency;
  if (!currency) {
    upperCaseCurrency = 'ZAR';
  } else if (typeof currency === 'string') {
    upperCaseCurrency = currency.toUpperCase();
  } else {
    // Convert non-string to string for error message
    upperCaseCurrency = String(currency).toUpperCase();
  }
  
  // Validate currency
  if (!SUPPORTED_CURRENCIES.includes(upperCaseCurrency)) {
    throw new Error(
      `Currency '${currency}' is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    );
  }

  // Validate employee count type
  if (typeof numberOfEmployees !== 'number') {
    throw new Error('Number of employees must be a number');
  }

  // Validate employee count is integer
  if (!Number.isInteger(numberOfEmployees)) {
    throw new Error('Number of employees must be an integer');
  }

  // Get pricing configuration for currency
  const pricing = ENTERPRISE_PRICING[upperCaseCurrency];

  // Validate employee count range
  if (numberOfEmployees < pricing.minimumEmployees) {
    throw new Error(
      `Minimum ${pricing.minimumEmployees} employee${pricing.minimumEmployees > 1 ? 's' : ''} required. Got: ${numberOfEmployees}`
    );
  }

  if (numberOfEmployees > pricing.maximumEmployees) {
    throw new Error(
      `Maximum ${pricing.maximumEmployees} employees allowed. Got: ${numberOfEmployees}`
    );
  }

  // Calculate price: basePrice + (numberOfEmployees * pricePerEmployee)
  const totalPrice = pricing.basePrice + (numberOfEmployees * pricing.pricePerEmployee);

  return totalPrice;
}

/**
 * Format price for display
 * 
 * @param {number} priceInCents - Price in cents
 * @param {string} currency - Currency code ('ZAR' or 'USD')
 * @returns {string} - Formatted price string (e.g., "R 600.00" or "$ 30.00")
 */
function formatPrice(priceInCents, currency = 'ZAR') {
  const price = priceInCents / 100; // Convert cents to currency units
  
  const currencySymbols = {
    ZAR: 'R',
    USD: '$'
  };

  const symbol = currencySymbols[currency] || currency;
  
  return `${symbol} ${price.toFixed(2)}`;
}

/**
 * Get pricing configuration for a currency
 * 
 * @param {string} currency - Currency code ('ZAR' or 'USD')
 * @returns {Object} - Pricing configuration object
 * @throws {Error} - If currency is unsupported
 */
function getPricingConfig(currency = 'ZAR') {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error(
      `Currency '${currency}' is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    );
  }

  return ENTERPRISE_PRICING[currency];
}

module.exports = {
  calculateEnterprisePrice,
  formatPrice,
  getPricingConfig,
  SUPPORTED_CURRENCIES,
  ENTERPRISE_PRICING
};

