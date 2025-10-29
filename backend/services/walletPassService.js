/**
 * Wallet Pass Service
 * 
 * Unified service for generating both Apple Wallet (.pkpass) and Google Wallet passes
 */

const AppleWalletService = require('./appleWalletService');
const GoogleWalletService = require('./googleWalletService');
const MockWalletService = require('./mockWalletService');
const { getTemplate, isTemplateAvailable, populateTemplate } = require('../templates/walletTemplates');

class WalletPassService {
    constructor() {
        this.appleService = new AppleWalletService();
        this.googleService = new GoogleWalletService();
        this.mockService = new MockWalletService();
        this.mockMode = process.env.WALLET_MOCK_MODE === 'true';
        
        if (this.mockMode) {
            console.log('🔧 [Mock Mode] Wallet Pass Service running in MOCK MODE');
            console.log('   Unsigned passes will be generated for testing');
            console.log('   Set WALLET_MOCK_MODE=false for production');
        }
    }

    /**
     * Generate Apple Wallet pass
     * @param {Object} cardData - Card data from Firestore
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {string} userPlan - User's subscription plan
     * @param {string} templateId - Template ID (optional, defaults to 'basic')
     * @param {string} saveContactUrl - URL for saving contact
     * @returns {Promise<Buffer>} .pkpass file buffer
     */
    async generateApplePass(cardData, userId, cardIndex, userPlan = 'free', templateId = 'basic', saveContactUrl) {
        try {
            console.log('Generating Apple Wallet pass:', { userId, cardIndex, userPlan, templateId, mockMode: this.mockMode });

            // Get template
            const template = getTemplate(templateId);

            // Check if template is available for user plan
            if (!isTemplateAvailable(templateId, userPlan)) {
                console.log(`Template ${templateId} not available for plan ${userPlan}, falling back to basic`);
                const basicTemplate = getTemplate('basic');
                return this.generateApplePass(cardData, userId, cardIndex, userPlan, 'basic', saveContactUrl);
            }

            // Populate template with card data
            const populatedTemplate = populateTemplate(template, cardData, saveContactUrl);

            // Use mock service if in mock mode
            if (this.mockMode) {
                console.log('[Mock Mode] Using mock service for Apple Wallet pass');
                const passBuffer = await this.mockService.generateApplePass(
                    cardData,
                    userId,
                    cardIndex,
                    populatedTemplate,
                    saveContactUrl
                );
                return passBuffer;
            }

            // Production mode - validate certificates and use real service
            if (!this.appleService.validateCertificates()) {
                throw new Error('Apple Wallet certificates not properly configured');
            }

            // Generate pass
            const passBuffer = await this.appleService.generatePass(
                cardData, 
                userId, 
                cardIndex, 
                populatedTemplate, 
                saveContactUrl
            );

            return passBuffer;

        } catch (error) {
            console.error('Error in WalletPassService.generateApplePass:', error);
            throw error;
        }
    }

    /**
     * Generate Google Wallet pass
     * @param {Object} cardData - Card data from Firestore
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {string} userPlan - User's subscription plan
     * @param {string} templateId - Template ID (optional, defaults to 'basic')
     * @param {string} saveContactUrl - URL for saving contact
     * @returns {Promise<string>} Google Wallet save URL
     */
    async generateGooglePass(cardData, userId, cardIndex, userPlan = 'free', templateId = 'basic', saveContactUrl) {
        try {
            console.log('Generating Google Wallet pass:', { userId, cardIndex, userPlan, templateId, mockMode: this.mockMode });

            // Get template
            const template = getTemplate(templateId);

            // Check if template is available for user plan
            if (!isTemplateAvailable(templateId, userPlan)) {
                console.log(`Template ${templateId} not available for plan ${userPlan}, falling back to basic`);
                const basicTemplate = getTemplate('basic');
                return this.generateGooglePass(cardData, userId, cardIndex, userPlan, 'basic', saveContactUrl);
            }

            // Populate template with card data
            const populatedTemplate = populateTemplate(template, cardData, saveContactUrl);

            // Use mock service if in mock mode
            if (this.mockMode) {
                console.log('[Mock Mode] Using mock service for Google Wallet pass');
                const mockJson = await this.mockService.generateGooglePass(
                    cardData,
                    userId,
                    cardIndex,
                    populatedTemplate,
                    saveContactUrl
                );
                return mockJson; // Return JSON string instead of URL
            }

            // Production mode - validate service account and use real service
            if (!this.googleService.validateServiceAccount()) {
                throw new Error('Google Wallet service account not properly configured');
            }

            // Generate pass
            const saveUrl = await this.googleService.generatePass(
                cardData, 
                userId, 
                cardIndex, 
                populatedTemplate, 
                saveContactUrl
            );

            return saveUrl;

        } catch (error) {
            console.error('Error in WalletPassService.generateGooglePass:', error);
            throw error;
        }
    }

    /**
     * Generate wallet pass based on platform
     * @param {string} platform - Platform ('ios' or 'android')
     * @param {Object} cardData - Card data from Firestore
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {string} userPlan - User's subscription plan
     * @param {string} templateId - Template ID (optional)
     * @param {string} saveContactUrl - URL for saving contact
     * @returns {Promise<Object>} Platform-specific pass data
     */
    async generatePass(platform, cardData, userId, cardIndex, userPlan = 'free', templateId = 'basic', saveContactUrl) {
        try {
            console.log('Generating wallet pass for platform:', platform);

            if (platform === 'ios') {
                const passBuffer = await this.generateApplePass(cardData, userId, cardIndex, userPlan, templateId, saveContactUrl);
                return {
                    platform: 'ios',
                    type: 'pkpass',
                    data: passBuffer,
                    filename: `${cardData.name || 'card'}_${cardIndex}.pkpass`,
                    mimeType: 'application/vnd.apple.pkpass',
                    mockMode: this.mockMode
                };
            } else if (platform === 'android') {
                const result = await this.generateGooglePass(cardData, userId, cardIndex, userPlan, templateId, saveContactUrl);
                
                // In mock mode, result is JSON string, otherwise it's a URL
                if (this.mockMode) {
                    return {
                        platform: 'android',
                        type: 'google_wallet_json',
                        data: result,
                        filename: `${cardData.name || 'card'}_${cardIndex}.json`,
                        mimeType: 'application/json',
                        mockMode: true
                    };
                } else {
                    return {
                        platform: 'android',
                        type: 'google_wallet',
                        data: result,
                        filename: null, // Google Wallet uses URL, not file
                        mimeType: 'text/plain',
                        mockMode: false
                    };
                }
            } else {
                throw new Error(`Unsupported platform: ${platform}`);
            }

        } catch (error) {
            console.error('Error in WalletPassService.generatePass:', error);
            throw error;
        }
    }

    /**
     * Get available templates for a user plan
     * @param {string} userPlan - User's subscription plan
     * @returns {Array} Available templates
     */
    getAvailableTemplates(userPlan) {
        const { getAvailableTemplates } = require('../templates/walletTemplates');
        return getAvailableTemplates(userPlan);
    }

    /**
     * Validate service configuration
     * @returns {Object} Validation results
     */
    validateConfiguration() {
        const results = {
            apple: {
                configured: false,
                errors: []
            },
            google: {
                configured: false,
                errors: []
            }
        };

        // Validate Apple configuration
        try {
            if (this.appleService.validateCertificates()) {
                results.apple.configured = true;
            } else {
                results.apple.errors.push('Apple certificates not found or invalid');
            }
        } catch (error) {
            results.apple.errors.push(`Apple validation error: ${error.message}`);
        }

        // Validate Google configuration
        try {
            if (this.googleService.validateServiceAccount()) {
                results.google.configured = true;
            } else {
                results.google.errors.push('Google service account not found or invalid');
            }
        } catch (error) {
            results.google.errors.push(`Google validation error: ${error.message}`);
        }

        return results;
    }

    /**
     * Test service connections
     * @returns {Promise<Object>} Test results
     */
    async testConnections() {
        const results = {
            apple: false,
            google: false,
            errors: []
        };

        // Test Apple service (basic validation)
        try {
            results.apple = this.appleService.validateCertificates();
        } catch (error) {
            results.errors.push(`Apple test error: ${error.message}`);
        }

        // Test Google service
        try {
            results.google = await this.googleService.testConnection();
        } catch (error) {
            results.errors.push(`Google test error: ${error.message}`);
        }

        return results;
    }

    /**
     * Get service status and configuration info
     * @returns {Object} Service status
     */
    getServiceStatus() {
        const config = this.validateConfiguration();
        
        return {
            apple: {
                enabled: config.apple.configured,
                errors: config.apple.errors,
                passTypeId: process.env.APPLE_PASS_TYPE_ID || 'Not configured',
                teamId: process.env.APPLE_TEAM_ID || 'Not configured'
            },
            google: {
                enabled: config.google.configured,
                errors: config.google.errors,
                issuerId: process.env.GOOGLE_WALLET_ISSUER_ID || 'Not configured',
                classId: process.env.GOOGLE_WALLET_CLASS_ID || 'Not configured'
            },
            templates: {
                available: Object.keys(require('../templates/walletTemplates').templates),
                default: 'basic'
            }
        };
    }
}

module.exports = WalletPassService;
