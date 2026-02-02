/**
 * Enterprise Pricing Configuration
 *
 * Handles price calculation for enterprise subscriptions based on employee count.
 * Supports ZAR and USD currencies with simple linear pricing model.
 *
 * NOTE:
 * - Existing callers can continue to pass a NUMBER of employees and will receive
 *   a single price in cents (backwards compatible).
 * - New callers may pass a RANGE STRING (e.g. "201-1000", "1000+") and will
 *   receive a RANGE OBJECT with min/max prices.
 */

// Get maximum employees from environment variable (default: 10000)
const MAX_EMPLOYEES = parseInt(process.env.ENTERPRISE_MAX_EMPLOYEES || '10000', 10);

const ENTERPRISE_PRICING = {
  ZAR: {
    basePrice: 10000,           // R100.00 base price (in cents)
    pricePerEmployee: 1000,     // R10.00 per employee (in cents)
    minimumEmployees: 1,
    maximumEmployees: MAX_EMPLOYEES,
    currency: 'ZAR'
  },
  USD: {
    basePrice: 500,             // $5.00 base price (in cents)
    pricePerEmployee: 50,       // $0.50 per employee (in cents)
    minimumEmployees: 1,
    maximumEmployees: MAX_EMPLOYEES,
    currency: 'USD'
  }
};

const SUPPORTED_CURRENCIES = ['ZAR', 'USD'];

/**
 * Internal helper: parse employee input which may be either:
 * - a number (exact employees)
 * - a range string "min-max"
 * - an open range string "min+"
 *
 * @param {number|string} input
 * @returns {Object} - One of:
 *   - { kind: 'single', employees: number }
 *   - { kind: 'range', minEmployees: number, maxEmployees: number }
 *   - { kind: 'openRange', minEmployees: number }
 */
function parseEmployeeRange(input) {
  // Legacy / simple path: a concrete number
  if (typeof input === 'number') {
    return { kind: 'single', employees: input };
  }

  if (typeof input !== 'string') {
    throw new Error('Number of employees must be a number or range string');
  }

  const trimmed = input.trim();

  // Explicit "min-max" range, e.g. "201-1000"
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);

    if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max < min) {
      throw new Error(`Invalid employee range: '${trimmed}'`);
    }

    return { kind: 'range', minEmployees: min, maxEmployees: max };
  }

  // Open-ended "min+" range, e.g. "1000+"
  const plusMatch = trimmed.match(/^(\d+)\s*\+$/);
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10);

    if (!Number.isInteger(min) || min <= 0) {
      throw new Error(`Invalid employee range: '${trimmed}'`);
    }

    return { kind: 'openRange', minEmployees: min };
  }

  throw new Error(`Invalid employee range format: '${trimmed}'`);
}

/**
 * Calculate enterprise price based on employee count OR range and currency.
 *
 * Backwards compatible behaviour:
 * - If numberOfEmployeesOrRange is a NUMBER:
 *     -> returns a single price in cents (number).
 *
 * Extended behaviour:
 * - If numberOfEmployeesOrRange is a RANGE STRING:
 *     -> returns an object:
 *        {
 *          kind: 'range',
 *          currency: 'ZAR',
 *          minEmployees,
 *          maxEmployees,
 *          minPrice,
 *          maxPrice,
 *          midEmployees,
 *          midPrice
 *        }
 *
 * @param {number|string} numberOfEmployeesOrRange - employees count or range
 * @param {string} currency - Currency code ('ZAR' or 'USD', default: 'ZAR')
 * @returns {number|Object} - See behaviour above.
 * @throws {Error} - If input or currency is invalid
 */
function calculateEnterprisePrice(numberOfEmployeesOrRange, currency = 'ZAR') {
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

  const pricing = ENTERPRISE_PRICING[upperCaseCurrency];

  // Parse number or range
  const parsed = parseEmployeeRange(numberOfEmployeesOrRange);

  // Legacy path: exact number of employees -> single price
  if (parsed.kind === 'single') {
    const n = parsed.employees;

    if (typeof n !== 'number' || !Number.isInteger(n)) {
      throw new Error('Number of employees must be an integer');
    }

    if (n < pricing.minimumEmployees) {
      throw new Error(
        `Minimum ${pricing.minimumEmployees} employee${pricing.minimumEmployees > 1 ? 's' : ''} required. Got: ${n}`
      );
    }

    if (n > pricing.maximumEmployees) {
      throw new Error(
        `Maximum ${pricing.maximumEmployees} employees allowed. Got: ${n}`
      );
    }

    // Calculate price: basePrice + (n * pricePerEmployee)
    const totalPrice = pricing.basePrice + (n * pricing.pricePerEmployee);
    return totalPrice;
  }

  // Range path: derive min/max employees, clamp to pricing limits
  let minEmployees;
  let maxEmployees;

  if (parsed.kind === 'range') {
    minEmployees = parsed.minEmployees;
    maxEmployees = parsed.maxEmployees;
  } else { // openRange
    minEmployees = parsed.minEmployees;
    maxEmployees = pricing.maximumEmployees;
  }

  // Clamp within supported bounds
  minEmployees = Math.max(pricing.minimumEmployees, minEmployees);
  maxEmployees = Math.min(pricing.maximumEmployees, maxEmployees);

  if (minEmployees > maxEmployees) {
    throw new Error('Employee range is outside supported limits');
  }

  const minPrice = pricing.basePrice + (minEmployees * pricing.pricePerEmployee);
  const maxPrice = pricing.basePrice + (maxEmployees * pricing.pricePerEmployee);

  const midEmployees = Math.round((minEmployees + maxEmployees) / 2);
  const midPrice = pricing.basePrice + (midEmployees * pricing.pricePerEmployee);

  return {
    kind: 'range',
    currency: upperCaseCurrency,
    minEmployees,
    maxEmployees,
    minPrice,
    maxPrice,
    midEmployees,
    midPrice
  };
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

