/**
 * Apple Wallet Service
 *
 * Minimal, iOS-first implementation using passkit-generator.
 * Uses environment variables for certificate paths.
 *
 * Required env vars:
 * - APPLE_PASS_TYPE_ID (e.g., "pass.com.xscard.businesscard")
 * - APPLE_TEAM_ID (your Apple Developer Team ID)
 *
 * Certificate source (either option works):
 * - FILE paths:
 *   - APPLE_PASS_CERT_PATH (path to pass certificate .pem file)
 *   - APPLE_PASS_KEY_PATH (path to pass private key .pem file)
 *   - APPLE_WWDR_CERT_PATH (path to Apple WWDR certificate .pem file)
 * - OR PEM contents (recommended for Render):
 *   - APPLE_PASS_CERT_PEM (full PEM string for pass certificate)
 *   - APPLE_PASS_KEY_PEM (full PEM string for pass private key)
 *   - APPLE_WWDR_CERT_PEM (full PEM string for Apple WWDR certificate)
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

    // PEM contents (prefer for container/Render because no file system mount needed)
    this.certPem = process.env.APPLE_PASS_CERT_PEM;
    this.keyPem = process.env.APPLE_PASS_KEY_PEM;
    this.wwdrPem = process.env.APPLE_WWDR_CERT_PEM;
  }

  /**
   * Normalize an env-provided PEM string.
   * Render often requires you to store newlines as literal `\n`.
   */
  normalizePem(pem) {
    if (!pem) return pem;
    return pem.replace(/\\n/g, '\n');
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
      const serialNumber = `${userId}_${cardIndex}_${Date.now()}`;

      // Create pass instance
      // PKPass signature: new PKPass(buffers, certificates, props)
      // We provide pass "props" as the 3rd argument (not the 2nd), then set certificates in loadCertificates().
      const pass = new PKPass(
        {},
        undefined,
        {
          // Pass type identifier and team identifier
          passTypeIdentifier: this.passTypeId,
          teamIdentifier: this.teamId,
          // Organization details
          organizationName: 'XS Card',
          description: 'Digital Business Card',
          logoText: 'XS Card',
          // Colors (iOS pass)
          // Template 1 card preview uses a white background and dark text.
          foregroundColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)',
          labelColor: 'rgb(0, 0, 0)',
          // Note: passkit-generator v3 expects serialNumber to be part of the pass props.
          serialNumber,
        }
      );

      // Fields API is only available after setting a supported pass type.
      // For simplicity we use eventTicket (generic business-card data fits field-wise).
      pass.type = 'eventTicket';

      // Primary field: Name
      pass.primaryFields.push({
        key: 'name',
        // Template 1 shows just the name (no "Name" label).
        label: '',
        value: `${cardData.name || ''} ${cardData.surname || ''}`.trim() || 'XS Card'
      });

      // Secondary fields: Position then Company (Template 1 order)
      if (cardData.occupation) {
        pass.secondaryFields.push({
          key: 'position',
          label: '',
          value: cardData.occupation || ''
        });
      }

      if (cardData.company) {
        pass.secondaryFields.push({
          key: 'company',
          label: '',
          value: cardData.company
        });
      }

      // Auxiliary fields: Email and Phone
      if (cardData.email) {
        pass.auxiliaryFields.push({
          key: 'email',
          label: '',
          value: cardData.email
        });
      }

      if (cardData.phone) {
        pass.auxiliaryFields.push({
          key: 'phone',
          label: '',
          value: cardData.phone
        });
      }

      // Social links (Template 1 shows socials using the card theme color as icons; passkit can't render icons)
      // So we include the social values as additional text rows.
      const socials = cardData.socials && typeof cardData.socials === 'object' ? cardData.socials : {};
      const socialOrder = ['whatsapp', 'x', 'facebook', 'linkedin', 'website', 'tiktok', 'instagram'];
      for (const platformKey of socialOrder) {
        const socialValue = socials[platformKey];
        if (typeof socialValue === 'string' && socialValue.trim()) {
          pass.auxiliaryFields.push({
            key: `social_${platformKey}`,
            label: '',
            value: socialValue.trim()
          });
        }
      }

      // Add QR code barcode
      pass.setBarcodes({
        message: saveContactUrl,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to save contact'
      });

      // Add images if available
      await this.addImages(pass, cardData);

      // Load and set certificates
      await this.loadCertificates(pass);

      // Generate .pkpass file
      return pass.getAsBuffer();
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
      // Option 1: load certs from PEM env vars
      const usingPem =
        !!(this.certPem && this.keyPem && this.wwdrPem);

      let certBuffer;
      let keyBuffer;
      let wwdrBuffer;

      if (usingPem) {
        certBuffer = Buffer.from(this.normalizePem(this.certPem));
        keyBuffer = Buffer.from(this.normalizePem(this.keyPem));
        wwdrBuffer = Buffer.from(this.normalizePem(this.wwdrPem));
      } else {
        // Option 2: load certs from filesystem paths
        if (!this.certPath) throw new Error('(APPLE_PASS_CERT_PATH not set)');
        if (!fs.existsSync(this.certPath)) throw new Error(`Pass certificate not found at: ${this.certPath}`);

        if (!this.keyPath) throw new Error('(APPLE_PASS_KEY_PATH not set)');
        if (!fs.existsSync(this.keyPath)) throw new Error(`Pass private key not found at: ${this.keyPath}`);

        if (!this.wwdrPath) throw new Error('(APPLE_WWDR_CERT_PATH not set)');
        if (!fs.existsSync(this.wwdrPath)) throw new Error(`WWDR certificate not found at: ${this.wwdrPath}`);

        certBuffer = fs.readFileSync(this.certPath);
        keyBuffer = fs.readFileSync(this.keyPath);
        wwdrBuffer = fs.readFileSync(this.wwdrPath);
      }

      // passkit-generator expects a single certificates object:
      // { wwdr, signerCert, signerKey, signerKeyPassphrase? }
      pass.certificates = {
        wwdr: wwdrBuffer,
        signerCert: certBuffer,
        signerKey: keyBuffer,
        // Optional: if your pass private key is encrypted, provide this env var.
        signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE
      };
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

    // Option 1: PEM env vars set
    const usingPem =
      !!(this.certPem && this.keyPem && this.wwdrPem);
    if (usingPem) return true;

    // Option 2: filesystem paths exist
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
      console.error('Or set APPLE_PASS_CERT_PEM / APPLE_PASS_KEY_PEM / APPLE_WWDR_CERT_PEM instead.');
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


