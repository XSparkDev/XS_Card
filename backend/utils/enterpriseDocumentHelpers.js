/**
 * Enterprise Document Helper Functions
 *
 * Helper functions for building enterprise document data from quote and account data.
 * Reuses existing quote generation logic (cement) - no duplication.
 */

/**
 * Derive company size from numberOfEmployees and priceRange
 * 
 * Reuses quote generation logic:
 * - If priceRange exists → format as "min-max" or "min+"
 * - If specific number → use number as string
 * 
 * @param {number|string} numberOfEmployees - Number of employees (from quote)
 * @param {object|null} priceRange - Price range object from quote (if range was used)
 * @returns {string} - Company size string (e.g., "500", "201-1000", "1000+")
 */
function deriveCompanySize(numberOfEmployees, priceRange) {
  // If priceRange exists, it means a range was used in quote generation
  if (priceRange && typeof priceRange === 'object') {
    const { minEmployees, maxEmployees } = priceRange;
    
    // Check if it's an open-ended range (maxEmployees would be MAX_EMPLOYEES)
    // For now, format as "min-max" - if it's truly open-ended, the format would be "min+"
    // But since we're reusing quote logic, we'll use the range format from priceRange
    if (minEmployees && maxEmployees) {
      // Check if this is likely an open-ended range (very large max)
      // This is a heuristic - if max is very large (close to MAX_EMPLOYEES), it might be open-ended
      const MAX_EMPLOYEES = parseInt(process.env.ENTERPRISE_MAX_EMPLOYEES || '10000', 10);
      if (maxEmployees >= MAX_EMPLOYEES * 0.9) {
        // Likely open-ended range
        return `${minEmployees}+`;
      }
      // Regular range
      return `${minEmployees}-${maxEmployees}`;
    }
  }
  
  // Specific number - convert to string
  if (typeof numberOfEmployees === 'number') {
    return numberOfEmployees.toString();
  }
  
  // If it's already a string (range format), return as-is
  if (typeof numberOfEmployees === 'string') {
    return numberOfEmployees;
  }
  
  // Fallback: empty string
  return '';
}

/**
 * Build enterprise document data from account and quote data
 * 
 * Creates enterprise document structure matching other server's schema:
 * - name (from companyName)
 * - numberOfEmployees (from quote)
 * - contactEmail (from quote)
 * - contactName (from quote)
 * - companySize (derived)
 * - Optional fields (empty)
 * - Timestamps (from accountData)
 * 
 * @param {object} accountData - Enterprise account data
 * @param {object} quoteData - Quote data from enterprise_quotes collection
 * @returns {object} - Enterprise document data ready for Firestore
 */
function buildEnterpriseDocumentData(accountData, quoteData) {
  // Derive companySize using quote logic
  const companySize = deriveCompanySize(
    quoteData.numberOfEmployees,
    quoteData.priceRange || null
  );
  
  // Build enterprise document structure
  const enterpriseData = {
    name: accountData.companyName || quoteData.companyName || '',
    numberOfEmployees: quoteData.numberOfEmployees || accountData.numberOfEmployees || 0,
    contactEmail: quoteData.contactEmail || accountData.contactEmail || '',
    contactName: quoteData.contactName || accountData.contactName || '',
    companySize: companySize,
    
    // Optional fields - include but leave empty
    description: '',
    industry: '',
    website: '',
    logoUrl: '',
    colorScheme: '',
    address: {},
    
    // Timestamps from accountData (already Firestore Timestamps)
    createdAt: accountData.createdAt || accountData.activatedAt,
    updatedAt: accountData.updatedAt || accountData.createdAt || accountData.activatedAt
  };
  
  return enterpriseData;
}

module.exports = {
  deriveCompanySize,
  buildEnterpriseDocumentData
};
