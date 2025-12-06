/**
 * NFC Service - Android Implementation
 * 
 * Optimized NFC read/write service for card-to-phone functionality
 * iOS implementation will be in nfcService.ios.ts (plug & play)
 */

import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import { encodeNDEFUrl, parseNDEFUrl, generateNFCUrl } from '../utils/nfcUtils';
import { NFCWriteResult, NFCReadResult, NFCStatus } from '../types/nfc';

class NFCService {
  private initialized = false;
  
  /**
   * Initialize NFC (Android only for now)
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[NFC Service] iOS not implemented yet');
      return false;
    }
    
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        console.log('[NFC Service] NFC not supported on this device');
        return false;
      }
      
      await NfcManager.start();
      this.initialized = true;
      console.log('[NFC Service] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[NFC Service] Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Check if NFC is available and enabled (Android)
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return false;
      }
      
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          return false;
        }
      }
      
      const enabled = await NfcManager.isEnabled();
      return enabled;
    } catch (error) {
      console.error('[NFC Service] Error checking availability:', error);
      return false;
    }
  }
  
  /**
   * Get NFC status
   */
  async getStatus(): Promise<NFCStatus> {
    if (Platform.OS !== 'android') {
      return {
        available: false,
        enabled: false,
        platform: 'ios',
      };
    }
    
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        return {
          available: false,
          enabled: false,
          platform: 'android',
        };
      }
      
      const enabled = await NfcManager.isEnabled();
      return {
        available: true,
        enabled,
        platform: 'android',
      };
    } catch (error) {
      return {
        available: false,
        enabled: false,
        platform: 'android',
      };
    }
  }
  
  /**
   * OPTIMIZED: Write URL to NFC tag (Android)
   * Target: <1 second
   */
  async writeUrl(userId: string, cardIndex: number): Promise<NFCWriteResult> {
    if (Platform.OS !== 'android') {
      return { 
        success: false, 
        error: 'iOS write not implemented yet. Use nfcService.ios.ts when available.' 
      };
    }
    
    const startTime = Date.now();
    
    try {
      // 1. Pre-generate URL
      const url = generateNFCUrl(userId, cardIndex);
      console.log('[NFC Write] Generated URL:', url);
      
      // 2. Create NDEF record using library helper
      const uriRecord = Ndef.uriRecord(url);
      console.log('[NFC Write] Created URI record:', {
        tnf: uriRecord.tnf,
        type: uriRecord.type,
        payloadLength: uriRecord.payload?.length,
      });
      
      // 3. Request NFC technology
      console.log('[NFC Write] Requesting NFC technology...');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // 4. Encode message to byte array and write
      // writeNdefMessage expects byte array for v3.x
      console.log('[NFC Write] Encoding message to bytes...');
      const bytes = Ndef.encodeMessage([uriRecord]);
      console.log('[NFC Write] Encoded bytes length:', bytes?.length);
      
      // Convert Uint8Array to plain array if needed (some versions expect this)
      const byteArray = bytes instanceof Uint8Array 
        ? Array.from(bytes) 
        : bytes;
      
      console.log('[NFC Write] Writing NDEF message...');
      await NfcManager.ndefHandler.writeNdefMessage(byteArray);
      
      // 5. Close connection
      console.log('[NFC Write] Closing connection...');
      await NfcManager.cancelTechnologyRequest();
      
      const duration = Date.now() - startTime;
      console.log(`[NFC Write] Success! Duration: ${duration}ms`);
      return { success: true, duration };
      
    } catch (error: any) {
      console.error('[NFC Write] Error:', error);
      
      // Fast error handling
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {}
      
      // Return generic error message (will be sanitized by UI layer)
      return { 
        success: false, 
        error: error.message || 'Write failed',
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * OPTIMIZED: Read URL from NFC tag (Android)
   * Target: <0.5 seconds
   */
  async readUrl(): Promise<NFCReadResult> {
    if (Platform.OS !== 'android') {
      return { 
        success: false, 
        error: 'iOS read not implemented yet. Use nfcService.ios.ts when available.' 
      };
    }
    
    const startTime = Date.now();
    
    try {
      // 1. Request NFC technology
      console.log('[NFC Read] Requesting NFC technology...');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      
      // 2. Read NDEF message
      console.log('[NFC Read] Reading tag...');
      const tag = await NfcManager.getTag();
      
      if (!tag || !tag.ndefMessage) {
        await NfcManager.cancelTechnologyRequest();
        return { 
          success: false, 
          error: 'No NDEF message found on tag',
          duration: Date.now() - startTime
        };
      }
      
      // 3. Fast parsing (extract URL only)
      const url = parseNDEFUrl(tag.ndefMessage);
      
      // 4. Close connection
      await NfcManager.cancelTechnologyRequest();
      
      if (!url) {
        return { 
          success: false, 
          error: 'No URL found in tag',
          duration: Date.now() - startTime
        };
      }
      
      const duration = Date.now() - startTime;
      console.log(`[NFC Read] Success! Duration: ${duration}ms, URL: ${url}`);
      
      return { 
        success: true, 
        url,
        duration
      };
      
    } catch (error: any) {
      console.error('[NFC Read] Error:', error);
      
      try {
        await NfcManager.cancelTechnologyRequest();
      } catch {}
      
      return { 
        success: false, 
        error: error.message || 'Read failed',
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Cancel any ongoing NFC operation
   */
  async cancel(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('[NFC Service] Operation cancelled');
    } catch (error) {
      console.log('[NFC Service] No operation to cancel');
    }
  }
}

export default new NFCService();

