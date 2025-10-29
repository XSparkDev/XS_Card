/**
 * Wallet Pass Templates
 * 
 * Defines templates for Apple Wallet (.pkpass) and Google Wallet passes
 * Supports RBAC - different templates for different user plans
 */

const templates = {
    // Basic template - available to all users (free and premium)
    basic: {
        id: 'basic',
        name: 'Basic Business Card',
        description: 'Clean and professional business card design',
        requiredPlan: 'free', // Available to free users
        apple: {
            // Apple Wallet pass structure
            passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.xscard.businesscard',
            teamIdentifier: process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID',
            organizationName: 'XS Card',
            description: 'Digital Business Card',
            logoText: 'XS Card',
            foregroundColor: 'rgb(255, 255, 255)',
            backgroundColor: 'rgb(27, 43, 91)', // XS Card brand color
            labelColor: 'rgb(255, 255, 255)',
            // Fields structure
            fields: {
                headerFields: [
                    {
                        key: 'company',
                        label: 'Company',
                        value: '{{company}}'
                    }
                ],
                primaryFields: [
                    {
                        key: 'name',
                        label: 'Name',
                        value: '{{name}} {{surname}}'
                    },
                    {
                        key: 'position',
                        label: 'Position',
                        value: '{{occupation}}'
                    }
                ],
                secondaryFields: [
                    {
                        key: 'email',
                        label: 'Email',
                        value: '{{email}}'
                    },
                    {
                        key: 'phone',
                        label: 'Phone',
                        value: '{{phone}}'
                    }
                ]
            },
            // Barcode configuration
            barcode: {
                message: '{{saveContactUrl}}',
                format: 'PKBarcodeFormatQR',
                messageEncoding: 'iso-8859-1'
            }
        },
        google: {
            // Google Wallet pass structure
            classId: process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card_v1',
            issuerName: 'XS Card',
            // Card layout
            cardTitle: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{name}} {{surname}}'
                }
            },
            subheader: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{occupation}}'
                }
            },
            header: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{company}}'
                }
            },
            // Text modules
            textModulesData: [
                {
                    id: 'email',
                    header: 'Email',
                    body: '{{email}}'
                },
                {
                    id: 'phone',
                    header: 'Phone',
                    body: '{{phone}}'
                }
            ],
            // Barcode
            barcode: {
                type: 'QR_CODE',
                value: '{{saveContactUrl}}'
            },
            // Colors
            hexBackgroundColor: '#1B2B5B' // XS Card brand color
        }
    },

    // Premium template - available to premium users only
    premium: {
        id: 'premium',
        name: 'Premium Business Card',
        description: 'Enhanced design with custom colors and layout',
        requiredPlan: 'premium', // Requires premium subscription
        apple: {
            // Enhanced Apple Wallet pass structure
            passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.xscard.businesscard',
            teamIdentifier: process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID',
            organizationName: 'XS Card',
            description: 'Premium Digital Business Card',
            logoText: 'XS Card',
            foregroundColor: 'rgb(255, 255, 255)',
            backgroundColor: 'rgb(0, 0, 0)', // Premium black background
            labelColor: 'rgb(255, 215, 0)', // Gold labels
            // Enhanced fields with more customization
            fields: {
                headerFields: [
                    {
                        key: 'company',
                        label: 'Company',
                        value: '{{company}}',
                        textAlignment: 'PKTextAlignmentCenter'
                    }
                ],
                primaryFields: [
                    {
                        key: 'name',
                        label: 'Name',
                        value: '{{name}} {{surname}}',
                        textAlignment: 'PKTextAlignmentCenter'
                    },
                    {
                        key: 'position',
                        label: 'Position',
                        value: '{{occupation}}',
                        textAlignment: 'PKTextAlignmentCenter'
                    }
                ],
                secondaryFields: [
                    {
                        key: 'email',
                        label: 'Email',
                        value: '{{email}}'
                    },
                    {
                        key: 'phone',
                        label: 'Phone',
                        value: '{{phone}}'
                    }
                ]
            },
            barcode: {
                message: '{{saveContactUrl}}',
                format: 'PKBarcodeFormatQR',
                messageEncoding: 'iso-8859-1',
                altText: 'Scan to save contact'
            }
        },
        google: {
            // Enhanced Google Wallet pass structure
            classId: process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card_v1',
            issuerName: 'XS Card',
            cardTitle: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{name}} {{surname}}'
                }
            },
            subheader: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{occupation}}'
                }
            },
            header: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{company}}'
                }
            },
            textModulesData: [
                {
                    id: 'email',
                    header: 'Email',
                    body: '{{email}}'
                },
                {
                    id: 'phone',
                    header: 'Phone',
                    body: '{{phone}}'
                }
            ],
            barcode: {
                type: 'QR_CODE',
                value: '{{saveContactUrl}}',
                alternateText: 'Scan to save contact'
            },
            hexBackgroundColor: '#000000' // Premium black background
        }
    },

    // Corporate template - for enterprise users
    corporate: {
        id: 'corporate',
        name: 'Corporate Business Card',
        description: 'Professional corporate design with company branding',
        requiredPlan: 'premium', // Requires premium subscription
        apple: {
            passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.xscard.businesscard',
            teamIdentifier: process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID',
            organizationName: 'XS Card',
            description: 'Corporate Digital Business Card',
            logoText: 'XS Card',
            foregroundColor: 'rgb(255, 255, 255)',
            backgroundColor: 'rgb(64, 64, 64)', // Corporate gray
            labelColor: 'rgb(200, 200, 200)',
            fields: {
                headerFields: [
                    {
                        key: 'company',
                        label: 'Company',
                        value: '{{company}}'
                    }
                ],
                primaryFields: [
                    {
                        key: 'name',
                        label: 'Name',
                        value: '{{name}} {{surname}}'
                    },
                    {
                        key: 'position',
                        label: 'Position',
                        value: '{{occupation}}'
                    }
                ],
                secondaryFields: [
                    {
                        key: 'email',
                        label: 'Email',
                        value: '{{email}}'
                    },
                    {
                        key: 'phone',
                        label: 'Phone',
                        value: '{{phone}}'
                    }
                ]
            },
            barcode: {
                message: '{{saveContactUrl}}',
                format: 'PKBarcodeFormatQR',
                messageEncoding: 'iso-8859-1'
            }
        },
        google: {
            classId: process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card_v1',
            issuerName: 'XS Card',
            cardTitle: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{name}} {{surname}}'
                }
            },
            subheader: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{occupation}}'
                }
            },
            header: {
                defaultValue: {
                    language: 'en-US',
                    value: '{{company}}'
                }
            },
            textModulesData: [
                {
                    id: 'email',
                    header: 'Email',
                    body: '{{email}}'
                },
                {
                    id: 'phone',
                    header: 'Phone',
                    body: '{{phone}}'
                }
            ],
            barcode: {
                type: 'QR_CODE',
                value: '{{saveContactUrl}}'
            },
            hexBackgroundColor: '#404040' // Corporate gray background
        }
    }
};

/**
 * Get a template by ID
 * @param {string} templateId - Template identifier
 * @returns {Object} Template object
 */
const getTemplate = (templateId) => {
    return templates[templateId] || templates.basic;
};

/**
 * Get available templates for a user plan
 * @param {string} userPlan - User's subscription plan ('free', 'premium', etc.)
 * @returns {Array} Array of available templates
 */
const getAvailableTemplates = (userPlan) => {
    return Object.values(templates).filter(template => {
        // Free users can only access free templates
        if (userPlan === 'free') {
            return template.requiredPlan === 'free';
        }
        // Premium users can access all templates
        return true;
    });
};

/**
 * Check if a template is available for a user plan
 * @param {string} templateId - Template identifier
 * @param {string} userPlan - User's subscription plan
 * @returns {boolean} Whether template is available
 */
const isTemplateAvailable = (templateId, userPlan) => {
    const template = getTemplate(templateId);
    
    // Free users can only access free templates
    if (userPlan === 'free') {
        return template.requiredPlan === 'free';
    }
    
    // Premium users can access all templates
    return true;
};

/**
 * Replace template placeholders with actual data
 * @param {Object} template - Template object
 * @param {Object} cardData - Card data
 * @param {string} saveContactUrl - URL for saving contact
 * @returns {Object} Template with replaced placeholders
 */
const populateTemplate = (template, cardData, saveContactUrl) => {
    const populatedTemplate = JSON.parse(JSON.stringify(template)); // Deep clone
    
    // Replace placeholders in Apple template
    if (populatedTemplate.apple) {
        populatedTemplate.apple = replacePlaceholders(populatedTemplate.apple, cardData, saveContactUrl);
    }
    
    // Replace placeholders in Google template
    if (populatedTemplate.google) {
        populatedTemplate.google = replacePlaceholders(populatedTemplate.google, cardData, saveContactUrl);
    }
    
    return populatedTemplate;
};

/**
 * Recursively replace placeholders in an object
 * @param {Object} obj - Object to process
 * @param {Object} cardData - Card data
 * @param {string} saveContactUrl - URL for saving contact
 * @returns {Object} Object with replaced placeholders
 */
const replacePlaceholders = (obj, cardData, saveContactUrl) => {
    if (typeof obj === 'string') {
        return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            if (key === 'saveContactUrl') {
                return saveContactUrl;
            }
            return cardData[key] || match;
        });
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => replacePlaceholders(item, cardData, saveContactUrl));
    }
    
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = replacePlaceholders(value, cardData, saveContactUrl);
        }
        return result;
    }
    
    return obj;
};

module.exports = {
    templates,
    getTemplate,
    getAvailableTemplates,
    isTemplateAvailable,
    populateTemplate
};
