/**
 * Stub for Group 3 Contact Aggregation.
 * Group 2 (departments/employees) calls invalidateEnterpriseCache after employee changes.
 * No-op until Group 3 is implemented.
 */

/**
 * No-op: invalidate enterprise contact cache.
 * @param {string} enterpriseId - Enterprise ID (unused in stub)
 * @returns {Promise<void>}
 */
async function invalidateEnterpriseCache(enterpriseId) {
  // Stub: real implementation in Group 3
  if (enterpriseId) {
    // no-op
  }
}

module.exports = {
  invalidateEnterpriseCache
};
