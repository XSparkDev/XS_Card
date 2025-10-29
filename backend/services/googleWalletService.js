/**
 * Google Wallet Service
 * 
 * Handles Google Wallet pass generation using Google Wallet REST API
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');

class GoogleWalletService {
    constructor() {
        this.issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || '3388000000012345678';
        this.serviceAccountPath = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PATH || './certificates/google-wallet-service-account.json';
        this.classId = process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card_v1';
        this.auth = null;
        this.walletObjects = null;
    }

    /**
     * Initialize Google Wallet API authentication
     */
    async initializeAuth() {
        try {
            if (!fs.existsSync(this.serviceAccountPath)) {
                throw new Error(`Google Wallet service account file not found: ${this.serviceAccountPath}`);
            }

            const serviceAccount = JSON.parse(fs.readFileSync(this.serviceAccountPath, 'utf8'));
            
            this.auth = new google.auth.GoogleAuth({
                credentials: serviceAccount,
                scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
            });

            this.walletObjects = google.walletobjects({ version: 'v1', auth: this.auth });
            
            console.log('Google Wallet API authentication initialized');
        } catch (error) {
            console.error('Error initializing Google Wallet auth:', error);
            throw new Error(`Failed to initialize Google Wallet authentication: ${error.message}`);
        }
    }

    /**
     * Generate Google Wallet pass
     * @param {Object} cardData - Card data from Firestore
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {Object} template - Template configuration
     * @param {string} saveContactUrl - URL for saving contact
     * @returns {Promise<string>} Google Wallet save URL
     */
    async generatePass(cardData, userId, cardIndex, template, saveContactUrl) {
        try {
            console.log('Generating Google Wallet pass for:', { userId, cardIndex });

            // Initialize auth if not already done
            if (!this.auth) {
                await this.initializeAuth();
            }

            // Create or get pass class
            const passClass = await this.createPassClass(template);

            // Create pass object
            const passObject = await this.createPassObject(cardData, userId, cardIndex, template, saveContactUrl);

            // Generate save URL
            const saveUrl = await this.generateSaveUrl(passObject);

            console.log('Google Wallet pass generated successfully');
            return saveUrl;

        } catch (error) {
            console.error('Error generating Google Wallet pass:', error);
            throw new Error(`Failed to generate Google Wallet pass: ${error.message}`);
        }
    }

    /**
     * Create or get pass class
     * @param {Object} template - Template configuration
     * @returns {Promise<Object>} Pass class object
     */
    async createPassClass(template) {
        try {
            const classResource = {
                id: `${this.issuerId}.${this.classId}`,
                classTemplateInfo: {
                    cardTemplateOverride: {
                        cardRowTemplateInfos: [
                            {
                                twoItems: {
                                    startItem: {
                                        firstValue: {
                                            fields: [
                                                {
                                                    fieldPath: 'object.textModulesData["name"]'
                                                }
                                            ]
                                        }
                                    },
                                    endItem: {
                                        firstValue: {
                                            fields: [
                                                {
                                                    fieldPath: 'object.textModulesData["position"]'
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            };

            // Try to get existing class first
            try {
                const existingClass = await this.walletObjects.genericclass.get({
                    resourceId: classResource.id
                });
                console.log('Using existing Google Wallet pass class');
                return existingClass.data;
            } catch (getError) {
                // Class doesn't exist, create it
                console.log('Creating new Google Wallet pass class');
                const newClass = await this.walletObjects.genericclass.insert({
                    resource: classResource
                });
                return newClass.data;
            }

        } catch (error) {
            console.error('Error creating Google Wallet pass class:', error);
            throw error;
        }
    }

    /**
     * Create pass object
     * @param {Object} cardData - Card data
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {Object} template - Template configuration
     * @param {string} saveContactUrl - URL for saving contact
     * @returns {Promise<Object>} Pass object
     */
    async createPassObject(cardData, userId, cardIndex, template, saveContactUrl) {
        try {
            const objectId = `${this.issuerId}.${userId}_${cardIndex}_${Date.now()}`;
            
            const objectResource = {
                id: objectId,
                classId: `${this.issuerId}.${this.classId}`,
                state: 'ACTIVE',
                // Card title
                cardTitle: {
                    defaultValue: {
                        language: 'en-US',
                        value: `${cardData.name} ${cardData.surname}`
                    }
                },
                // Subheader
                subheader: {
                    defaultValue: {
                        language: 'en-US',
                        value: cardData.occupation || 'Business Card'
                    }
                },
                // Header
                header: {
                    defaultValue: {
                        language: 'en-US',
                        value: cardData.company || 'XS Card'
                    }
                },
                // Text modules
                textModulesData: [
                    {
                        id: 'name',
                        header: 'Name',
                        body: `${cardData.name} ${cardData.surname}`
                    },
                    {
                        id: 'position',
                        header: 'Position',
                        body: cardData.occupation || 'N/A'
                    },
                    {
                        id: 'email',
                        header: 'Email',
                        body: cardData.email || 'N/A'
                    },
                    {
                        id: 'phone',
                        header: 'Phone',
                        body: cardData.phone || 'N/A'
                    }
                ],
                // Barcode
                barcode: {
                    type: 'QR_CODE',
                    value: saveContactUrl,
                    alternateText: 'Scan to save contact'
                },
                // Colors from template
                hexBackgroundColor: template.google.hexBackgroundColor || '#1B2B5B'
            };

            // Add images if available
            if (cardData.companyLogo) {
                objectResource.logo = {
                    sourceUri: {
                        uri: cardData.companyLogo
                    }
                };
            }

            if (cardData.profileImage) {
                objectResource.heroImage = {
                    sourceUri: {
                        uri: cardData.profileImage
                    }
                };
            }

            // Create the pass object
            const passObject = await this.walletObjects.genericobject.insert({
                resource: objectResource
            });

            console.log('Google Wallet pass object created:', objectId);
            return passObject.data;

        } catch (error) {
            console.error('Error creating Google Wallet pass object:', error);
            throw error;
        }
    }

    /**
     * Generate save URL for the pass
     * @param {Object} passObject - Pass object
     * @returns {Promise<string>} Save URL
     */
    async generateSaveUrl(passObject) {
        try {
            const saveUrl = `https://pay.google.com/gp/v/save/${passObject.id}`;
            console.log('Google Wallet save URL generated:', saveUrl);
            return saveUrl;

        } catch (error) {
            console.error('Error generating Google Wallet save URL:', error);
            throw error;
        }
    }

    /**
     * Validate service account file exists
     * @returns {boolean} Whether service account file exists
     */
    validateServiceAccount() {
        if (!fs.existsSync(this.serviceAccountPath)) {
            console.error(`Missing Google Wallet service account file: ${this.serviceAccountPath}`);
            return false;
        }
        
        try {
            const serviceAccount = JSON.parse(fs.readFileSync(this.serviceAccountPath, 'utf8'));
            
            // Check required fields
            const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id'];
            for (const field of requiredFields) {
                if (!serviceAccount[field]) {
                    console.error(`Missing required field in service account: ${field}`);
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error validating service account file:', error);
            return false;
        }
    }

    /**
     * Test Google Wallet API connection
     * @returns {Promise<boolean>} Whether connection is successful
     */
    async testConnection() {
        try {
            await this.initializeAuth();
            
            // Try to list pass classes to test connection
            await this.walletObjects.genericclass.list({
                issuerId: this.issuerId
            });
            
            console.log('Google Wallet API connection test successful');
            return true;
        } catch (error) {
            console.error('Google Wallet API connection test failed:', error);
            return false;
        }
    }
}

module.exports = GoogleWalletService;
