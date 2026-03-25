/**
 * Apple Wallet Service
 *
 * Uses passkit-generator. Pass assets must be real PNGs; JPEG/WebP URLs (common from Firebase)
 * are converted with sharp — invalid images are a frequent cause of Safari "can't download".
 *
 * Required env vars:
 * - APPLE_PASS_TYPE_ID, APPLE_TEAM_ID
 * - Certificates: file paths or APPLE_PASS_*_PEM (see README in repo / .env)
 */

const { PKPass } = require('passkit-generator');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');

class AppleWalletService {
  constructor() {
    this.passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.com.xscard.businesscard';
    this.teamId = process.env.APPLE_TEAM_ID;
    this.certPath = process.env.APPLE_PASS_CERT_PATH;
    this.keyPath = process.env.APPLE_PASS_KEY_PATH;
    this.wwdrPath = process.env.APPLE_WWDR_CERT_PATH;

    this.certPem = process.env.APPLE_PASS_CERT_PEM;
    this.keyPem = process.env.APPLE_PASS_KEY_PEM;
    this.wwdrPem = process.env.APPLE_WWDR_CERT_PEM;
  }

  normalizePem(pem) {
    if (!pem) return pem;
    return pem.replace(/\\n/g, '\n');
  }

  /**
   * @param {Object} cardData - Card from Firestore
   * @param {string} saveContactUrl - QR target URL
   */
  async generatePass(cardData, userId, cardIndex, saveContactUrl) {
    if (!this.validateCertificates()) {
      throw new Error('Apple Wallet certificates not properly configured. Please check certificate paths in environment variables.');
    }

    try {
      const serialNumber = `${userId}_${cardIndex}_${Date.now()}`;
      const fullName = `${cardData.name || ''} ${cardData.surname || ''}`.trim() || 'Card';

      const pass = new PKPass(
        {},
        undefined,
        {
          passTypeIdentifier: this.passTypeId,
          teamIdentifier: this.teamId,
          organizationName: 'XS Card',
          description: 'Digital Business Card',
          logoText: fullName.slice(0, 40),
          serialNumber,
        }
      );

      // Generic pass fits a business card; avoid eventTicket-specific behaviour.
      pass.type = 'generic';

      pass.primaryFields.push({
        key: 'name',
        label: 'Name',
        value: fullName,
      });

      if (cardData.company) {
        pass.secondaryFields.push({
          key: 'company',
          label: 'Company',
          value: String(cardData.company),
        });
      }

      if (cardData.occupation) {
        pass.secondaryFields.push({
          key: 'title',
          label: 'Title',
          value: String(cardData.occupation),
        });
      }

      if (cardData.email) {
        pass.auxiliaryFields.push({
          key: 'email',
          label: 'Email',
          value: String(cardData.email),
        });
      }

      if (cardData.phone) {
        pass.auxiliaryFields.push({
          key: 'phone',
          label: 'Phone',
          value: String(cardData.phone),
        });
      }

      pass.setBarcodes({
        message: saveContactUrl,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to save contact',
      });

      await this.addPassImages(pass, cardData);
      await this.loadCertificates(pass);

      return pass.getAsBuffer();
    } catch (error) {
      console.error('Error generating Apple Wallet pass:', error);
      throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
    }
  }

  /**
   * Decode any raster to PNG; Wallet rejects non-PNG data named .png.
   */
  async toPng(buffer) {
    if (!buffer || !buffer.length) return null;
    try {
      return await sharp(buffer).png().toBuffer();
    } catch (e) {
      console.warn('Wallet: could not decode image:', e.message);
      return null;
    }
  }

  async grayPlaceholderPng(size) {
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .png()
      .toBuffer();
  }

  /**
   * Required: icon.png / icon@2x.png (PNG). Optional: logo*, thumbnail*.
   */
  async addPassImages(pass, cardData) {
    const logoRaw = await this.downloadImage(cardData.companyLogo);
    const profileRaw = await this.downloadImage(cardData.profileImage);

    const logoPng = await this.toPng(logoRaw);
    const profilePng = await this.toPng(profileRaw);

    let iconSource = logoPng || profilePng;
    if (!iconSource) {
      iconSource = await this.grayPlaceholderPng(29);
    }

    const icon29 = await sharp(iconSource)
      .resize(29, 29, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();
    const icon58 = await sharp(iconSource)
      .resize(58, 58, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();

    pass.addBuffer('icon.png', icon29);
    pass.addBuffer('icon@2x.png', icon58);

    if (logoPng) {
      const logo1 = await sharp(logoPng)
        .resize(160, 50, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      const logo2 = await sharp(logoPng)
        .resize(320, 100, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      pass.addBuffer('logo.png', logo1);
      pass.addBuffer('logo@2x.png', logo2);
    }

    if (profilePng) {
      const t1 = await sharp(profilePng)
        .resize(90, 90, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      const t2 = await sharp(profilePng)
        .resize(180, 180, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      pass.addBuffer('thumbnail.png', t1);
      pass.addBuffer('thumbnail@2x.png', t2);
    }
  }

  async downloadImage(imageUrl) {
    try {
      if (!imageUrl) return null;
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 15 * 1024 * 1024,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.warn(`Wallet: failed to download image:`, error.message);
      return null;
    }
  }

  async loadCertificates(pass) {
    try {
      const usingPem = !!(this.certPem && this.keyPem && this.wwdrPem);

      let certBuffer;
      let keyBuffer;
      let wwdrBuffer;

      if (usingPem) {
        certBuffer = Buffer.from(this.normalizePem(this.certPem));
        keyBuffer = Buffer.from(this.normalizePem(this.keyPem));
        wwdrBuffer = Buffer.from(this.normalizePem(this.wwdrPem));
      } else {
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

      pass.certificates = {
        wwdr: wwdrBuffer,
        signerCert: certBuffer,
        signerKey: keyBuffer,
        signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE,
      };
    } catch (error) {
      console.error('Error loading Apple Wallet certificates:', error);
      throw new Error(`Failed to load Apple Wallet certificates: ${error.message}`);
    }
  }

  validateCertificates() {
    if (!this.passTypeId || !this.teamId) {
      console.error('Missing Apple Wallet configuration: APPLE_PASS_TYPE_ID or APPLE_TEAM_ID not set');
      return false;
    }

    const usingPem = !!(this.certPem && this.keyPem && this.wwdrPem);
    if (usingPem) return true;

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

  validateServiceAccount() {
    return this.validateCertificates();
  }
}

module.exports = AppleWalletService;
