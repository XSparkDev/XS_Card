/**
 * Apple Wallet Service
 * 
 * Handles Apple Wallet (.pkpass) pass generation using passkit-generator
 */

const { PKPass } = require('passkit-generator');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');

class AppleWalletService {
    constructor() {
        this.passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.com.xscard.businesscard';
        this.teamId = process.env.APPLE_TEAM_ID || 'YOUR_TEAM_ID';
        this.certPath = process.env.APPLE_PASS_CERT_PATH || './certificates/passcert.pem';
        this.keyPath = process.env.APPLE_PASS_KEY_PATH || './certificates/passkey.pem';
        this.wwdrPath = process.env.APPLE_WWDR_CERT_PATH || './certificates/wwdr.pem';
    }

    /**
     * Generate Apple Wallet pass
     * @param {Object} cardData - Card data from Firestore
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {Object} template - Template configuration
     * @param {string} saveContactUrl - URL for saving contact
     * @returns {Promise<Buffer>} .pkpass file buffer
     */
    async generatePass(cardData, userId, cardIndex, template, saveContactUrl) {
        try {
            console.log('Generating Apple Wallet pass for:', { userId, cardIndex });

            // Create pass instance
            const pass = new PKPass();

            // Set pass properties from template
            pass.passTypeIdentifier = template.apple.passTypeIdentifier;
            pass.teamIdentifier = template.apple.teamIdentifier;
            pass.organizationName = template.apple.organizationName;
            pass.description = template.apple.description;
            pass.logoText = template.apple.logoText;
            pass.foregroundColor = template.apple.foregroundColor;
            pass.backgroundColor = template.apple.backgroundColor;
            pass.labelColor = template.apple.labelColor;

            // Set pass fields
            this.setPassFields(pass, template.apple.fields, cardData);

            // Set barcode
            this.setBarcode(pass, template.apple.barcode, saveContactUrl);

            // Add images
            await this.addImages(pass, cardData);

            // Load certificates
            await this.loadCertificates(pass);

            // Generate pass
            const passBuffer = await pass.generate();
            
            console.log('Apple Wallet pass generated successfully');
            return passBuffer;

        } catch (error) {
            console.error('Error generating Apple Wallet pass:', error);
            throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
        }
    }

    /**
     * Set pass fields from template
     * @param {PKPass} pass - Pass instance
     * @param {Object} fields - Fields configuration
     * @param {Object} cardData - Card data
     */
    setPassFields(pass, fields, cardData) {
        // Header fields
        if (fields.headerFields) {
            fields.headerFields.forEach(field => {
                pass.addHeaderField(field.key, this.replacePlaceholders(field.value, cardData), field.label);
            });
        }

        // Primary fields
        if (fields.primaryFields) {
            fields.primaryFields.forEach(field => {
                pass.addPrimaryField(field.key, this.replacePlaceholders(field.value, cardData), field.label);
            });
        }

        // Secondary fields
        if (fields.secondaryFields) {
            fields.secondaryFields.forEach(field => {
                pass.addSecondaryField(field.key, this.replacePlaceholders(field.value, cardData), field.label);
            });
        }
    }

    /**
     * Set barcode for the pass
     * @param {PKPass} pass - Pass instance
     * @param {Object} barcodeConfig - Barcode configuration
     * @param {string} saveContactUrl - URL for saving contact
     */
    setBarcode(pass, barcodeConfig, saveContactUrl) {
        const message = this.replacePlaceholders(barcodeConfig.message, { saveContactUrl });
        
        pass.addBarcode({
            message: message,
            format: barcodeConfig.format,
            messageEncoding: barcodeConfig.messageEncoding,
            altText: barcodeConfig.altText || 'Scan to save contact'
        });
    }

    /**
     * Add images to the pass
     * @param {PKPass} pass - Pass instance
     * @param {Object} cardData - Card data
     */
    async addImages(pass, cardData) {
        try {
            // Add logo (company logo)
            if (cardData.companyLogo) {
                const logoBuffer = await this.downloadImage(cardData.companyLogo);
                if (logoBuffer) {
                    pass.addBuffer('logo.png', logoBuffer);
                    pass.addBuffer('logo@2x.png', logoBuffer);
                }
            }

            // Add icon (smaller version of logo)
            if (cardData.companyLogo) {
                const iconBuffer = await this.downloadImage(cardData.companyLogo);
                if (iconBuffer) {
                    pass.addBuffer('icon.png', iconBuffer);
                    pass.addBuffer('icon@2x.png', iconBuffer);
                }
            }

            // Add thumbnail (profile image)
            if (cardData.profileImage) {
                const thumbnailBuffer = await this.downloadImage(cardData.profileImage);
                if (thumbnailBuffer) {
                    pass.addBuffer('thumbnail.png', thumbnailBuffer);
                    pass.addBuffer('thumbnail@2x.png', thumbnailBuffer);
                }
            }

        } catch (error) {
            console.warn('Error adding images to Apple Wallet pass:', error);
            // Continue without images rather than failing completely
        }
    }

    /**
     * Download image from URL
     * @param {string} imageUrl - Image URL
     * @returns {Promise<Buffer|null>} Image buffer or null if failed
     */
    async downloadImage(imageUrl) {
        try {
            if (!imageUrl) return null;

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 10000 // 10 second timeout
            });

            return Buffer.from(response.data);
        } catch (error) {
            console.warn('Failed to download image:', imageUrl, error.message);
            return null;
        }
    }

    /**
     * Load certificates for pass signing
     * @param {PKPass} pass - Pass instance
     */
    async loadCertificates(pass) {
        try {
            // Load pass certificate
            const certBuffer = fs.readFileSync(this.certPath);
            pass.certificate = certBuffer;

            // Load pass key
            const keyBuffer = fs.readFileSync(this.keyPath);
            pass.privateKey = keyBuffer;

            // Load WWDR certificate
            const wwdrBuffer = fs.readFileSync(this.wwdrPath);
            pass.wwdr = wwdrBuffer;

        } catch (error) {
            console.error('Error loading certificates:', error);
            throw new Error('Failed to load Apple Wallet certificates. Please check certificate paths.');
        }
    }

    /**
     * Replace placeholders in a string
     * @param {string} str - String with placeholders
     * @param {Object} data - Data to replace placeholders with
     * @returns {string} String with replaced placeholders
     */
    replacePlaceholders(str, data) {
        if (typeof str !== 'string') return str;
        
        return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    /**
     * Validate certificate files exist
     * @returns {boolean} Whether all required certificates exist
     */
    validateCertificates() {
        const requiredFiles = [this.certPath, this.keyPath, this.wwdrPath];
        
        for (const filePath of requiredFiles) {
            if (!fs.existsSync(filePath)) {
                console.error(`Missing certificate file: ${filePath}`);
                return false;
            }
        }
        
        return true;
    }
}

module.exports = AppleWalletService;
