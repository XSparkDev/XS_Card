/**
 * Apple Wallet Service
 *
 * Minimal, iOS-first implementation using passkit-generator.
 * Uses environment variables for certificate paths.
 *
 * Required env vars:
 * - APPLE_PASS_TYPE_ID (e.g., "pass.com.xscard.businesscard")
 * - APPLE_TEAM_ID (your Apple Developer Team ID)
 * - APPLE_PASS_CERT_PATH (path to pass certificate .pem file)
 * - APPLE_PASS_KEY_PATH (path to pass private key .pem file)
 * - APPLE_WWDR_CERT_PATH (path to Apple WWDR certificate .pem file)
 */

const { PKPass } = require('passkit-generator');
const fs = require('fs');
const axios = require('axios');

class AppleWalletService {
  constructor() {
    this.passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.com.xscard.businesscard';
    this.teamId = process.env.APPLE_TEAM_ID;
    this.certPath = process.env.APPLE_PASS_CERT_PATH;
    this.keyPath = process.env.APPLE_PASS_KEY_PATH;
    this.wwdrPath = process.env.APPLE_WWDR_CERT_PATH;
  }

  /**
   * Generate an Apple Wallet pass and return a .pkpass file buffer
   * @param {Object} cardData - Card data from Firestore
   * @param {string} userId - User ID
   * @param {number} cardIndex - Card index
   * @param {string} saveContactUrl - URL used in QR code
   * @returns {Promise<Buffer>} .pkpass file buffer
   */
  async generatePass(cardData, userId, cardIndex, saveContactUrl) {
    // Validate certificates before proceeding
    if (!this.validateCertificates()) {
      throw new Error('Apple Wallet certificates not properly configured. Please check certificate paths in environment variables.');
    }

    try {
      // Create pass instance
      const pass = new PKPass(
        {},
        {
          // Pass type identifier and team identifier
          passTypeIdentifier: this.passTypeId,
          teamIdentifier: this.teamId,
          // Organization details
          organizationName: 'XS Card',
          description: 'Digital Business Card',
          logoText: 'XS Card',
          // Colors (XS Card brand colors)
          foregroundColor: 'rgb(255, 255, 255)',
          backgroundColor: 'rgb(27, 43, 91)', // #1B2B5B
          labelColor: 'rgb(255, 255, 255)',
        }
      );

      // Set serial number (unique identifier)
      pass.serialNumber = `${userId}_${cardIndex}_${Date.now()}`;

      // Primary field: Name
      pass.addPrimaryField({
        key: 'name',
        label: 'Name',
        value: `${cardData.name || ''} ${cardData.surname || ''}`.trim() || 'XS Card',
      });

      // Secondary fields: Company and Occupation
      if (cardData.company) {
        pass.addSecondaryField({
          key: 'company',
          label: 'Company',
          value: cardData.company,
        });
      }

      if (cardData.occupation) {
        pass.addSecondaryField({
          key: 'occupation',
          label: 'Title',
          value: cardData.occupation,
        });
      }

      // Auxiliary fields: Email and Phone
      if (cardData.email) {
        pass.addAuxiliaryField({
          key: 'email',
          label: 'Email',
          value: cardData.email,
        });
      }

      if (cardData.phone) {
        pass.addAuxiliaryField({
          key: 'phone',
          label: 'Phone',
          value: cardData.phone,
        });
      }

      // Add QR code barcode
      pass.addBarcode({
        message: saveContactUrl,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to save contact',
      });

      // Add images if available
      await this.addImages(pass, cardData);

      // Load and set certificates
      await this.loadCertificates(pass);

      // Generate .pkpass file
      const passBuffer = await pass.generate();

      return passBuffer;
    } catch (error) {
      console.error('Error generating Apple Wallet pass:', error);
      throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
    }
  }

  /**
   * Add images to the pass (logo, icon, thumbnail)
   * @param {PKPass} pass - Pass instance
   * @param {Object} cardData - Card data
   */
  async addImages(pass, cardData) {
    try {
      // Add logo (company logo) - required for Apple Wallet
      if (cardData.companyLogo) {
        const logoBuffer = await this.downloadImage(cardData.companyLogo);
        if (logoBuffer) {
          pass.addBuffer('logo.png', logoBuffer);
          pass.addBuffer('logo@2x.png', logoBuffer); // Retina version
        }
      }

      // Add icon (smaller version, typically same as logo)
      if (cardData.companyLogo) {
        const iconBuffer = await this.downloadImage(cardData.companyLogo);
        if (iconBuffer) {
          pass.addBuffer('icon.png', iconBuffer);
          pass.addBuffer('icon@2x.png', iconBuffer); // Retina version
        }
      }

      // Add thumbnail (profile image) - optional but nice to have
      if (cardData.profileImage) {
        const thumbnailBuffer = await this.downloadImage(cardData.profileImage);
        if (thumbnailBuffer) {
          pass.addBuffer('thumbnail.png', thumbnailBuffer);
          pass.addBuffer('thumbnail@2x.png', thumbnailBuffer); // Retina version
        }
      }
    } catch (error) {
      console.warn('Warning: Could not add some images to Apple Wallet pass:', error.message);
      // Continue without images rather than failing completely
      // Apple Wallet will use default icons if images are missing
    }
  }

  /**
   * Download image from URL and return as buffer
   * @param {string} imageUrl - Image URL
   * @returns {Promise<Buffer|null>} Image buffer or null if failed
   */
  async downloadImage(imageUrl) {
    try {
      if (!imageUrl) return null;

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.warn(`Failed to download image from ${imageUrl}:`, error.message);
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
      if (!fs.existsSync(this.certPath)) {
        throw new Error(`Pass certificate not found at: ${this.certPath}`);
      }
      const certBuffer = fs.readFileSync(this.certPath);
      pass.certificate = certBuffer;

      // Load pass private key
      if (!fs.existsSync(this.keyPath)) {
        throw new Error(`Pass private key not found at: ${this.keyPath}`);
      }
      const keyBuffer = fs.readFileSync(this.keyPath);
      pass.privateKey = keyBuffer;

      // Load WWDR (Apple Worldwide Developer Relations) certificate
      if (!fs.existsSync(this.wwdrPath)) {
        throw new Error(`WWDR certificate not found at: ${this.wwdrPath}`);
      }
      const wwdrBuffer = fs.readFileSync(this.wwdrPath);
      pass.wwdr = wwdrBuffer;
    } catch (error) {
      console.error('Error loading Apple Wallet certificates:', error);
      throw new Error(`Failed to load Apple Wallet certificates: ${error.message}`);
    }
  }

  /**
   * Validate that all required certificate files exist
   * @returns {boolean} Whether all required certificates exist
   */
  validateCertificates() {
    if (!this.passTypeId || !this.teamId) {
      console.error('Missing Apple Wallet configuration: APPLE_PASS_TYPE_ID or APPLE_TEAM_ID not set');
      return false;
    }

    const requiredFiles = [this.certPath, this.keyPath, this.wwdrPath];
    const missingFiles = [];

    for (const filePath of requiredFiles) {
      if (!filePath) {
        missingFiles.push('(path not set in environment variable)');
      } else if (!fs.existsSync(filePath)) {
        missingFiles.push(filePath);
      }
    }

    if (missingFiles.length > 0) {
      console.error('Missing Apple Wallet certificate files:', missingFiles.join(', '));
      return false;
    }

    return true;
  }

  /**
   * Quick config validation for feature-flag checks.
   */
  validateServiceAccount() {
    return this.validateCertificates();
  }
}

module.exports = AppleWalletService;

