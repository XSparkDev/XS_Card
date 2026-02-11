/**
 * Enterprise Validation Utilities
 * 
 * Comprehensive input validation for enterprise quote generation.
 * All validation functions return clear error messages.
 */

// Get maximum employees from environment variable (default: 10000)
const MAX_EMPLOYEES = parseInt(process.env.ENTERPRISE_MAX_EMPLOYEES || '10000', 10);

/**
 * Validate company name
 * 
 * Rules:
 * - Required
 * - 1-200 characters
 * - Alphanumeric + spaces, hyphens, underscores, ampersands, periods
 * 
 * @param {string} name - Company name
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateCompanyName(name) {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      error: 'Company name is required'
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    return {
      isValid: false,
      error: 'Company name cannot be empty'
    };
  }

  if (trimmedName.length > 200) {
    return {
      isValid: false,
      error: 'Company name must be 200 characters or less'
    };
  }

  // Allow alphanumeric, spaces, hyphens, underscores, ampersands, periods
  const validPattern = /^[a-zA-Z0-9\s\-_&.]+$/;
  if (!validPattern.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Company name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, ampersands, and periods are allowed'
    };
  }

  return { isValid: true };
}

/**
 * Validate contact name
 * 
 * Rules:
 * - Required
 * - 1-100 characters
 * - Letters + spaces, hyphens, apostrophes
 * 
 * @param {string} name - Contact name
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateContactName(name) {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      error: 'Contact name is required'
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 1) {
    return {
      isValid: false,
      error: 'Contact name cannot be empty'
    };
  }

  if (trimmedName.length > 100) {
    return {
      isValid: false,
      error: 'Contact name must be 100 characters or less'
    };
  }

  // Allow letters, spaces, hyphens, apostrophes
  const validPattern = /^[a-zA-Z\s\-']+$/;
  if (!validPattern.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Contact name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed'
    };
  }

  return { isValid: true };
}

/**
 * Validate email address
 * 
 * Rules:
 * - Required
 * - Valid email format
 * - Max 255 characters
 * 
 * @param {string} email - Email address
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email address is required'
    };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length < 1) {
    return {
      isValid: false,
      error: 'Email address cannot be empty'
    };
  }

  if (trimmedEmail.length > 255) {
    return {
      isValid: false,
      error: 'Email address must be 255 characters or less'
    };
  }

  // Basic email format validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Invalid email format. Please provide a valid email address'
    };
  }

  return { isValid: true };
}

/**
 * Validate number of employees
 *
 * Rules:
 * - Required
 * - EITHER:
 *   - a concrete number (1–{MAX_EMPLOYEES}, integer)
 *   - OR a range string in one of the forms:
 *     - "min-max" (e.g. "201-1000")
 *     - "min+"   (e.g. "1000+")
 *
 * @param {number|string} count - Number of employees or range string
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateNumberOfEmployees(count) {
  if (count === null || count === undefined) {
    return {
      isValid: false,
      error: 'Number of employees is required'
    };
  }

  // Numeric path (existing behaviour)
  if (typeof count === 'number') {
    if (!Number.isInteger(count)) {
      return {
        isValid: false,
        error: 'Number of employees must be an integer'
      };
    }

    if (count < 1) {
      return {
        isValid: false,
        error: 'Number of employees must be at least 1'
      };
    }

    if (count > MAX_EMPLOYEES) {
      return {
        isValid: false,
        error: `Number of employees cannot exceed ${MAX_EMPLOYEES.toLocaleString()}`
      };
    }

    return { isValid: true };
  }

  // Range string path
  if (typeof count === 'string') {
    const trimmed = count.trim();

    // "min-max"
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);

      if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max < min) {
        return {
          isValid: false,
          error: 'Employee range is invalid. Use a format like "201-1000".'
        };
      }

      if (max > MAX_EMPLOYEES) {
        return {
          isValid: false,
          error: `Employee range cannot exceed ${MAX_EMPLOYEES.toLocaleString()} employees.`
        };
      }

      return { isValid: true };
    }

    // "min+"
    const plusMatch = trimmed.match(/^(\d+)\s*\+$/);
    if (plusMatch) {
      const min = parseInt(plusMatch[1], 10);

      if (!Number.isInteger(min) || min <= 0) {
        return {
          isValid: false,
          error: 'Employee open-ended range is invalid. Use a format like "1000+".'
        };
      }

      if (min > MAX_EMPLOYEES) {
        return {
          isValid: false,
          error: `Employee range cannot start above ${MAX_EMPLOYEES.toLocaleString()} employees.`
        };
      }

      return { isValid: true };
    }

    return {
      isValid: false,
      error: 'Number of employees must be a number or range string like "201-1000" or "1000+".'
    };
  }

  return {
    isValid: false,
    error: 'Number of employees must be a number or range string'
  };
}

/**
 * Validate currency
 * 
 * Rules:
 * - Optional (defaults to 'ZAR')
 * - Must be 'ZAR' or 'USD'
 * 
 * @param {string} currency - Currency code
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateCurrency(currency) {
  // Currency is optional, default to ZAR
  if (!currency) {
    return { isValid: true }; // Valid, will use default
  }

  if (typeof currency !== 'string') {
    return {
      isValid: false,
      error: 'Currency must be a string'
    };
  }

  const validCurrencies = ['ZAR', 'USD'];
  const upperCurrency = currency.toUpperCase();

  if (!validCurrencies.includes(upperCurrency)) {
    return {
      isValid: false,
      error: `Currency '${currency}' is not supported. Supported currencies: ${validCurrencies.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Validate billing address
 * 
 * Rules:
 * - Required
 * - Must be an object with required fields
 * 
 * @param {Object} address - Billing address object
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateBillingAddress(address) {
  if (!address || typeof address !== 'object') {
    return {
      isValid: false,
      error: 'Billing address is required'
    };
  }

  const requiredFields = ['street', 'city', 'postalCode', 'country'];
  const missing = requiredFields.filter(field => !address[field] || typeof address[field] !== 'string' || address[field].trim().length === 0);

  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Billing address missing required fields: ${missing.join(', ')}`
    };
  }

  // Validate field lengths
  if (address.street && address.street.trim().length > 200) {
    return {
      isValid: false,
      error: 'Street address must be 200 characters or less'
    };
  }

  if (address.city && address.city.trim().length > 100) {
    return {
      isValid: false,
      error: 'City must be 100 characters or less'
    };
  }

  if (address.postalCode && address.postalCode.trim().length > 20) {
    return {
      isValid: false,
      error: 'Postal code must be 20 characters or less'
    };
  }

  if (address.country && address.country.trim().length > 100) {
    return {
      isValid: false,
      error: 'Country must be 100 characters or less'
    };
  }

  return { isValid: true };
}

/**
 * Validate VAT number
 * 
 * Rules:
 * - Optional
 * - If provided, must be a non-empty string
 * - Max 50 characters
 * 
 * @param {string} vatNumber - VAT number
 * @returns {{isValid: boolean, error?: string}} - Validation result
 */
function validateVATNumber(vatNumber) {
  // VAT number is optional
  if (!vatNumber) {
    return { isValid: true };
  }

  if (typeof vatNumber !== 'string') {
    return {
      isValid: false,
      error: 'VAT number must be a string'
    };
  }

  if (vatNumber.trim().length === 0) {
    return { isValid: true }; // Empty string treated as no VAT number
  }

  if (vatNumber.trim().length > 50) {
    return {
      isValid: false,
      error: 'VAT number must be 50 characters or less'
    };
  }

  return { isValid: true };
}

/**
 * Validate complete enterprise quote data
 * 
 * Validates all fields required for quote generation.
 * 
 * @param {Object} data - Quote data object
 * @param {string} data.companyName - Company name
 * @param {string} data.contactName - Contact person name
 * @param {string} data.contactEmail - Contact email
 * @param {number} data.numberOfEmployees - Number of employees
 * @param {Object} data.billingAddress - Billing address (required)
 * @param {string} [data.vatNumber] - VAT number (optional)
 * @param {string} [data.currency] - Currency code (optional, defaults to 'ZAR')
 * @returns {{isValid: boolean, errors: string[]}} - Validation result with array of errors
 */
function validateEnterpriseQuote(data) {
  const errors = [];

  // Validate company name
  const companyNameResult = validateCompanyName(data.companyName);
  if (!companyNameResult.isValid) {
    errors.push(companyNameResult.error);
  }

  // Validate contact name
  const contactNameResult = validateContactName(data.contactName);
  if (!contactNameResult.isValid) {
    errors.push(contactNameResult.error);
  }

  // Validate email
  const emailResult = validateEmail(data.contactEmail);
  if (!emailResult.isValid) {
    errors.push(emailResult.error);
  }

  // Validate number of employees
  const employeesResult = validateNumberOfEmployees(data.numberOfEmployees);
  if (!employeesResult.isValid) {
    errors.push(employeesResult.error);
  }

  // Validate billing address (required)
  const addressResult = validateBillingAddress(data.billingAddress);
  if (!addressResult.isValid) {
    errors.push(addressResult.error);
  }

  // Validate VAT number (optional)
  const vatResult = validateVATNumber(data.vatNumber);
  if (!vatResult.isValid) {
    errors.push(vatResult.error);
  }

  // Validate currency (optional)
  const currencyResult = validateCurrency(data.currency);
  if (!currencyResult.isValid) {
    errors.push(currencyResult.error);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateCompanyName,
  validateContactName,
  validateEmail,
  validateNumberOfEmployees,
  validateCurrency,
  validateBillingAddress,
  validateVATNumber,
  validateEnterpriseQuote
};

