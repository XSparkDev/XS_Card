/**
 * Stub for card template when creating employee cards (Group 2).
 * Other server uses getEffectiveTemplateForCardCreation(enterpriseId, departmentId).
 * Returns default values until full template system is integrated.
 *
 * @param {string} enterpriseId - Enterprise ID (unused in stub)
 * @param {string} departmentId - Department ID (unused in stub)
 * @returns {Promise<{ colorScheme: string, companyLogo: string|null, templateId: string, templateName: string, source: string }>}
 */
async function getEffectiveTemplateForCardCreation(enterpriseId, departmentId) {
  return {
    colorScheme: '#1B2B5B',
    companyLogo: null,
    templateId: 'default',
    templateName: 'Default',
    source: 'default'
  };
}

module.exports = {
  getEffectiveTemplateForCardCreation
};
