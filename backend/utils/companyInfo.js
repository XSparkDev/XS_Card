/**
 * Company Information Helper
 * 
 * Fetches XSCard company information from environment variables.
 * Used for invoice/receipt generation.
 * 
 * Environment Variables Required:
 * - COMPANY_NAME
 * - COMPANY_STREET
 * - COMPANY_CITY
 * - COMPANY_PROVINCE
 * - COMPANY_POSTAL_CODE
 * - COMPANY_COUNTRY
 * - COMPANY_PHONE
 * - COMPANY_EMAIL
 * - COMPANY_VAT_NUMBER (optional)
 */

/**
 * Get company information from environment variables
 * 
 * @returns {Object} Company information object
 * @throws {Error} If required environment variables are missing
 */
function getCompanyInfo() {
  const required = [
    'COMPANY_NAME',
    'COMPANY_STREET',
    'COMPANY_CITY',
    'COMPANY_POSTAL_CODE',
    'COMPANY_COUNTRY',
    'COMPANY_PHONE',
    'COMPANY_EMAIL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required company information environment variables: ${missing.join(', ')}`
    );
  }

  return {
    name: process.env.COMPANY_NAME,
    address: {
      street: process.env.COMPANY_STREET,
      city: process.env.COMPANY_CITY,
      province: process.env.COMPANY_PROVINCE || '',
      postalCode: process.env.COMPANY_POSTAL_CODE,
      country: process.env.COMPANY_COUNTRY
    },
    phone: process.env.COMPANY_PHONE,
    email: process.env.COMPANY_EMAIL,
    vatNumber: process.env.COMPANY_VAT_NUMBER || null
  };
}

/**
 * Format company address as a single string
 * 
 * @returns {string} Formatted address string
 */
function getFormattedCompanyAddress() {
  const info = getCompanyInfo();
  const parts = [
    info.address.street,
    info.address.city,
    info.address.province,
    info.address.postalCode,
    info.address.country
  ].filter(Boolean);
  
  return parts.join(', ');
}

module.exports = {
  getCompanyInfo,
  getFormattedCompanyAddress
};
