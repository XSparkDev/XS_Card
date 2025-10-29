/**
 * Mock Wallet Service
 * 
 * Generates unsigned wallet passes for testing without certificates
 * Allows full testing of pass structure, data, and images before production
 */

const archiver = require('archiver');
const crypto = require('crypto');
const axios = require('axios');
const { Readable } = require('stream');

class MockWalletService {
    constructor() {
        this.mockMode = true;
    }

    /**
     * Generate mock Apple Wallet pass (.pkpass without signature)
     * @param {Object} cardData - Card data
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {Object} template - Template configuration
     * @param {string} saveContactUrl - Save contact URL
     * @returns {Promise<Buffer>} Unsigned .pkpass file
     */
    async generateApplePass(cardData, userId, cardIndex, template, saveContactUrl) {
        try {
            console.log('[Mock Mode] Generating unsigned Apple Wallet pass');

            // Create pass.json structure
            const passJson = await this.createPassJson(cardData, template, saveContactUrl);

            // Download images
            const images = await this.downloadImages(cardData);

            // Create manifest (without signing)
            const manifest = await this.createManifest(passJson, images);

            // Create .pkpass ZIP file
            const pkpassBuffer = await this.createPkpassZip(passJson, manifest, images);

            console.log('[Mock Mode] Unsigned .pkpass generated successfully');
            return pkpassBuffer;

        } catch (error) {
            console.error('[Mock Mode] Error generating Apple pass:', error);
            throw error;
        }
    }

    /**
     * Generate mock Google Wallet pass (JSON structure)
     * @param {Object} cardData - Card data
     * @param {string} userId - User ID
     * @param {number} cardIndex - Card index
     * @param {Object} template - Template configuration
     * @param {string} saveContactUrl - Save contact URL
     * @returns {Promise<string>} JSON string of pass structure
     */
    async generateGooglePass(cardData, userId, cardIndex, template, saveContactUrl) {
        try {
            console.log('[Mock Mode] Generating Google Wallet pass JSON');

            const passObject = {
                mockMode: true,
                notice: 'This is a mock pass for testing. It will not work in Google Wallet without proper configuration.',
                passClass: {
                    id: `mock_issuer.${process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card'}`,
                    classTemplateInfo: {
                        cardTemplateOverride: {
                            cardRowTemplateInfos: [
                                {
                                    twoItems: {
                                        startItem: {
                                            firstValue: {
                                                fields: [{ fieldPath: 'object.textModulesData["name"]' }]
                                            }
                                        },
                                        endItem: {
                                            firstValue: {
                                                fields: [{ fieldPath: 'object.textModulesData["position"]' }]
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                passObject: {
                    id: `mock_issuer.${userId}_${cardIndex}_${Date.now()}`,
                    classId: `mock_issuer.${process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card'}`,
                    state: 'ACTIVE',
                    cardTitle: {
                        defaultValue: {
                            language: 'en-US',
                            value: `${cardData.name} ${cardData.surname}`
                        }
                    },
                    subheader: {
                        defaultValue: {
                            language: 'en-US',
                            value: cardData.occupation || 'Business Card'
                        }
                    },
                    header: {
                        defaultValue: {
                            language: 'en-US',
                            value: cardData.company || 'XS Card'
                        }
                    },
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
                    barcode: {
                        type: 'QR_CODE',
                        value: saveContactUrl,
                        alternateText: 'Scan to save contact'
                    },
                    hexBackgroundColor: template.google.hexBackgroundColor || '#1B2B5B'
                }
            };

            if (cardData.companyLogo) {
                passObject.passObject.logo = {
                    sourceUri: { uri: cardData.companyLogo }
                };
            }

            if (cardData.profileImage) {
                passObject.passObject.heroImage = {
                    sourceUri: { uri: cardData.profileImage }
                };
            }

            console.log('[Mock Mode] Google Wallet pass JSON generated');
            return JSON.stringify(passObject, null, 2);

        } catch (error) {
            console.error('[Mock Mode] Error generating Google pass:', error);
            throw error;
        }
    }

    /**
     * Create pass.json structure
     * @param {Object} cardData - Card data
     * @param {Object} template - Template configuration
     * @param {string} saveContactUrl - Save contact URL
     * @returns {Object} pass.json object
     */
    async createPassJson(cardData, template, saveContactUrl) {
        const passJson = {
            formatVersion: 1,
            passTypeIdentifier: template.apple.passTypeIdentifier,
            teamIdentifier: template.apple.teamIdentifier,
            organizationName: template.apple.organizationName,
            serialNumber: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
            description: template.apple.description,
            logoText: template.apple.logoText,
            foregroundColor: template.apple.foregroundColor,
            backgroundColor: template.apple.backgroundColor,
            labelColor: template.apple.labelColor,
            generic: {
                headerFields: [],
                primaryFields: [],
                secondaryFields: [],
                auxiliaryFields: []
            },
            barcode: {
                message: saveContactUrl,
                format: 'PKBarcodeFormatQR',
                messageEncoding: 'iso-8859-1',
                altText: 'Scan to save contact'
            },
            barcodes: [
                {
                    message: saveContactUrl,
                    format: 'PKBarcodeFormatQR',
                    messageEncoding: 'iso-8859-1',
                    altText: 'Scan to save contact'
                }
            ]
        };

        // Add header fields
        if (template.apple.fields.headerFields) {
            template.apple.fields.headerFields.forEach(field => {
                passJson.generic.headerFields.push({
                    key: field.key,
                    label: field.label,
                    value: this.replacePlaceholders(field.value, cardData, saveContactUrl)
                });
            });
        }

        // Add primary fields
        if (template.apple.fields.primaryFields) {
            template.apple.fields.primaryFields.forEach(field => {
                passJson.generic.primaryFields.push({
                    key: field.key,
                    label: field.label,
                    value: this.replacePlaceholders(field.value, cardData, saveContactUrl)
                });
            });
        }

        // Add secondary fields
        if (template.apple.fields.secondaryFields) {
            template.apple.fields.secondaryFields.forEach(field => {
                passJson.generic.secondaryFields.push({
                    key: field.key,
                    label: field.label,
                    value: this.replacePlaceholders(field.value, cardData, saveContactUrl)
                });
            });
        }

        return passJson;
    }

    /**
     * Download images from URLs
     * @param {Object} cardData - Card data
     * @returns {Promise<Object>} Object with image buffers
     */
    async downloadImages(cardData) {
        const images = {};

        try {
            // Download company logo
            if (cardData.companyLogo) {
                const logoBuffer = await this.downloadImage(cardData.companyLogo);
                if (logoBuffer) {
                    images['logo.png'] = logoBuffer;
                    images['logo@2x.png'] = logoBuffer;
                    images['icon.png'] = logoBuffer;
                    images['icon@2x.png'] = logoBuffer;
                }
            }

            // Download profile image
            if (cardData.profileImage) {
                const thumbnailBuffer = await this.downloadImage(cardData.profileImage);
                if (thumbnailBuffer) {
                    images['thumbnail.png'] = thumbnailBuffer;
                    images['thumbnail@2x.png'] = thumbnailBuffer;
                }
            }
        } catch (error) {
            console.warn('[Mock Mode] Error downloading images:', error);
            // Continue without images
        }

        return images;
    }

    /**
     * Download image from URL
     * @param {string} url - Image URL
     * @returns {Promise<Buffer|null>} Image buffer or null
     */
    async downloadImage(url) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            return Buffer.from(response.data);
        } catch (error) {
            console.warn('[Mock Mode] Failed to download image:', url);
            return null;
        }
    }

    /**
     * Create manifest.json (file hashes)
     * @param {Object} passJson - pass.json object
     * @param {Object} images - Image buffers
     * @returns {Object} Manifest object
     */
    async createManifest(passJson, images) {
        const manifest = {};

        // Hash pass.json
        const passJsonString = JSON.stringify(passJson);
        manifest['pass.json'] = crypto.createHash('sha1').update(passJsonString).digest('hex');

        // Hash images
        Object.keys(images).forEach(filename => {
            manifest[filename] = crypto.createHash('sha1').update(images[filename]).digest('hex');
        });

        return manifest;
    }

    /**
     * Create .pkpass ZIP file
     * @param {Object} passJson - pass.json object
     * @param {Object} manifest - Manifest object
     * @param {Object} images - Image buffers
     * @returns {Promise<Buffer>} ZIP file buffer
     */
    async createPkpassZip(passJson, manifest, images) {
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            const buffers = [];

            archive.on('data', (chunk) => {
                buffers.push(chunk);
            });

            archive.on('end', () => {
                const buffer = Buffer.concat(buffers);
                resolve(buffer);
            });

            archive.on('error', (error) => {
                reject(error);
            });

            // Add pass.json
            archive.append(JSON.stringify(passJson, null, 2), { name: 'pass.json' });

            // Add manifest.json
            archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

            // Add images
            Object.keys(images).forEach(filename => {
                archive.append(images[filename], { name: filename });
            });

            // Add a README to explain this is a mock pass
            const readme = `This is a mock (unsigned) Apple Wallet pass for testing purposes.

It contains all the correct data and structure but is NOT signed with Apple certificates.
This pass will NOT open in Apple Wallet.

To inspect this pass:
1. Rename the file from .pkpass to .zip
2. Unzip the file
3. View pass.json for the pass structure
4. View manifest.json for file hashes
5. Check that all images are included

Once you have Apple Developer certificates configured, this same structure
will be signed and will work in Apple Wallet.

Generated by: XS Card Mock Wallet Service
Timestamp: ${new Date().toISOString()}
`;
            archive.append(readme, { name: 'README_MOCK.txt' });

            archive.finalize();
        });
    }

    /**
     * Replace placeholders in a string
     * @param {string} str - String with placeholders
     * @param {Object} cardData - Card data
     * @param {string} saveContactUrl - Save contact URL
     * @returns {string} String with replaced placeholders
     */
    replacePlaceholders(str, cardData, saveContactUrl) {
        if (typeof str !== 'string') return str;

        return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            if (key === 'saveContactUrl') {
                return saveContactUrl;
            }
            return cardData[key] || match;
        });
    }
}

module.exports = MockWalletService;
