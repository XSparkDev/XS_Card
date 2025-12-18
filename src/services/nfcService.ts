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
   * 
   * Attempts automatic formatting for unformatted tags.
   * If formatting fails, will retry the operation (some tags need a second attempt).
   * 
   * @param progressCallback Optional callback to report progress/status updates
   */
  async writeUrl(
    userId: string, 
    cardIndex: number, 
    retryCount: number = 0,
    progressCallback?: (status: { attempt: number; message: string; progress?: number }) => void
  ): Promise<NFCWriteResult> {
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
      
      // 3. Request NFC technology - handle both formatted and unformatted tags
      console.log('[NFC Write] Requesting NFC technology...');
      
      let tagFormatted = false;
      let tag: any = null;
      
      // Try NDEF first (for formatted tags - fast path)
      // But if write fails, we'll fall back to formatting
      const attemptNumber = retryCount + 1;
      
      if (progressCallback) {
        progressCallback({
          attempt: attemptNumber,
          message: attemptNumber === 1 ? 'Detecting...' : `Retry ${attemptNumber}...`,
          progress: 20
        });
      }
      
      try {
        // First, try to request NDEF (for formatted tags - fast path)
        await NfcManager.requestTechnology(NfcTech.Ndef);
        tag = await NfcManager.getTag();
        tagFormatted = true;
        console.log('[NFC Write] Tag is already formatted');
        
        // Try writing immediately - if it fails, we'll format
        try {
          const bytes = Ndef.encodeMessage([uriRecord]);
          const byteArray = bytes instanceof Uint8Array 
            ? Array.from(bytes) 
            : bytes;
          
          if (tag.maxSize && tag.maxSize < byteArray.length) {
            throw new Error(`Tag size (${tag.maxSize} bytes) is too small for message (${byteArray.length} bytes)`);
          }
          
          console.log('[NFC Write] Writing NDEF message...');
          await NfcManager.ndefHandler.writeNdefMessage(byteArray);
          await NfcManager.cancelTechnologyRequest();
          
          const duration = Date.now() - startTime;
          console.log(`[NFC Write] Success! Duration: ${duration}ms`);
          return { success: true, duration };
        } catch (writeError: any) {
          const writeErrorMsg = writeError?.message || writeError?.toString() || '';
          console.log('[NFC Write] NDEF write failed:', writeErrorMsg);
          
          // If "unsupported tag api", the tag needs formatting - throw to enter formatting path
          if (writeErrorMsg.includes('unsupported') || writeErrorMsg.includes('Unsupported')) {
            console.log('[NFC Write] Tag detected as NDEF but write failed - attempting to format...');
            
            if (progressCallback) {
              progressCallback({
                attempt: attemptNumber,
                message: 'Configuring tag...',
                progress: 40
              });
            }
            
            await NfcManager.cancelTechnologyRequest();
            await new Promise(resolve => setTimeout(resolve, 300));
            // Throw to enter the formatting catch block
            throw new Error('NDEF_WRITE_FAILED_NEEDS_FORMAT');
          } else {
            // Other error, rethrow
            await NfcManager.cancelTechnologyRequest();
            throw writeError;
          }
        }
      } catch (ndefError: any) {
        // Check if this is a write failure that needs formatting
        const needsFormat = ndefError?.message === 'NDEF_WRITE_FAILED_NEEDS_FORMAT';
        
        if (!needsFormat) {
          // If NDEF fails, the tag is likely unformatted
          const errorMsg = ndefError?.message || ndefError?.toString() || '';
          console.log('[NFC Write] NDEF failed, tag appears unformatted');
          console.log('[NFC Write] NDEF error:', errorMsg);
          
          if (progressCallback) {
            progressCallback({
              attempt: attemptNumber,
              message: 'Initializing...',
              progress: 30
            });
          }
        } else {
          console.log('[NFC Write] NDEF write failed, falling back to formatting...');
          
          if (progressCallback) {
            progressCallback({
              attempt: attemptNumber,
              message: 'First-time setup...',
              progress: 35
            });
          }
        }
        
        // Continue with formatting logic for both cases
        // Cancel any existing request
        try {
          await NfcManager.cancelTechnologyRequest();
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch {}
        
        // Strategy: Establish base connection first (like NFC Tools does)
        // This "wakes up" the tag and makes NdefFormatable work
        // Try NfcA first (most common), then NfcB, NfcF as fallbacks
        const baseTechs = [NfcTech.NfcA, NfcTech.NfcB, NfcTech.NfcF];
        let baseConnectionEstablished = false;
        
        for (const baseTech of baseTechs) {
          try {
            console.log(`[NFC Write] Establishing base connection with ${baseTech}...`);
            
            if (progressCallback) {
              progressCallback({
                attempt: attemptNumber,
                message: `Connecting...`,
                progress: 40
              });
            }
            
            await NfcManager.requestTechnology(baseTech);
            const baseTag = await NfcManager.getTag();
            if (baseTag) {
              console.log(`[NFC Write] Base connection established with ${baseTech}`);
              baseConnectionEstablished = true;
              // Cancel base connection before switching to NdefFormatable
              await NfcManager.cancelTechnologyRequest();
              await new Promise(resolve => setTimeout(resolve, 200));
              break;
            }
          } catch (baseError) {
            console.log(`[NFC Write] ${baseTech} connection failed, trying next...`);
            try {
              await NfcManager.cancelTechnologyRequest();
            } catch {}
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        if (!baseConnectionEstablished) {
          console.log('[NFC Write] Could not establish base connection, trying NdefFormatable directly...');
        }
        
        // Now try NdefFormatable (after base connection if successful)
        try {
          console.log('[NFC Write] Attempting to format tag with NdefFormatable...');
          
          if (progressCallback) {
            progressCallback({
              attempt: attemptNumber,
              message: 'Formatting & writing...',
              progress: 60
            });
          }
          
          await NfcManager.requestTechnology(NfcTech.NdefFormatable);
          tag = await NfcManager.getTag();
          
          console.log('[NFC Write] NdefFormatable connection established, tag info:', {
            maxSize: tag?.maxSize,
            techTypes: tag?.techTypes,
            id: tag?.id
          });
          
          if (tag) {
            // Prepare the NDEF message
            console.log('[NFC Write] Preparing NDEF message...');
            const bytes = Ndef.encodeMessage([uriRecord]);
            const byteArray = bytes instanceof Uint8Array 
              ? Array.from(bytes) 
              : bytes;
            
            console.log('[NFC Write] Formatting tag and writing NDEF message...');
            // Format and write in one step - formatNdef takes the NDEF message bytes
            await NfcManager.ndefFormatableHandlerAndroid.formatNdef(byteArray);
            console.log('[NFC Write] Tag formatted and written successfully!');
            
            // Close connection
            await NfcManager.cancelTechnologyRequest();
            
            // Return success immediately
            const duration = Date.now() - startTime;
            console.log(`[NFC Write] Success! Duration: ${duration}ms`);
            return { success: true, duration };
          } else {
            throw new Error('Tag not accessible via NdefFormatable');
          }
        } catch (formatError: any) {
          console.error('[NFC Write] Formatting failed:', formatError);
          const formatErrorMsg = formatError?.message || formatError?.toString() || '';
          
          // Clean up
          try {
            await NfcManager.cancelTechnologyRequest();
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch {}
          
          // If "unsupported tag api", try alternative approach: pass array to requestTechnology
          // StackOverflow solution: order matters on Android, first tech in array is used
          if (formatErrorMsg.includes('unsupported') || formatErrorMsg.includes('Unsupported')) {
            console.log('[NFC Write] Trying alternative: requestTechnology with array [NfcA, NdefFormatable]...');
            try {
              await NfcManager.cancelTechnologyRequest();
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Try passing array - on Android, first tech is used, but this might help initialize
              await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.NdefFormatable]);
              await NfcManager.cancelTechnologyRequest();
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Now try NdefFormatable alone
              await NfcManager.requestTechnology(NfcTech.NdefFormatable);
              tag = await NfcManager.getTag();
              
              if (tag) {
                const bytes = Ndef.encodeMessage([uriRecord]);
                const byteArray = bytes instanceof Uint8Array 
                  ? Array.from(bytes) 
                  : bytes;
                
                await NfcManager.ndefFormatableHandlerAndroid.formatNdef(byteArray);
                await NfcManager.cancelTechnologyRequest();
                
                const duration = Date.now() - startTime;
                console.log(`[NFC Write] Success with array approach! Duration: ${duration}ms`);
                return { success: true, duration };
              }
            } catch (arrayError) {
              console.log('[NFC Write] Array approach also failed:', arrayError);
              try {
                await NfcManager.cancelTechnologyRequest();
              } catch {}
            }
            
            // Don't auto-retry - user must tap card again
            // Return error so UI can show it and encourage user to tap again
          }
          
          // Final fallback: Try NDEF one more time
          try {
            console.log('[NFC Write] Final retry with NDEF...');
            
            if (progressCallback) {
              progressCallback({
                attempt: attemptNumber,
                message: 'Final write...',
                progress: 80
              });
            }
            
            await NfcManager.requestTechnology(NfcTech.Ndef);
            tag = await NfcManager.getTag();
            tagFormatted = true;
            console.log('[NFC Write] Tag accessible after retry');
            
            // Now try writing to the retried tag
            if (!tag) {
              throw new Error('Tag not accessible after final retry');
            }
            
            const bytes = Ndef.encodeMessage([uriRecord]);
            const byteArray = bytes instanceof Uint8Array 
              ? Array.from(bytes) 
              : bytes;
            
            if (tag.maxSize && tag.maxSize < byteArray.length) {
              throw new Error(`Tag size (${tag.maxSize} bytes) is too small for message (${byteArray.length} bytes)`);
            }
            
            console.log('[NFC Write] Writing NDEF message after retry...');
            
            if (progressCallback) {
              progressCallback({
                attempt: attemptNumber,
                message: 'Writing...',
                progress: 90
              });
            }
            
            await NfcManager.ndefHandler.writeNdefMessage(byteArray);
            await NfcManager.cancelTechnologyRequest();
            
            const duration = Date.now() - startTime;
            console.log(`[NFC Write] Success after final retry! Duration: ${duration}ms`);
            
            if (progressCallback) {
              progressCallback({
                attempt: attemptNumber,
                message: 'Success!',
                progress: 100
              });
            }
            
            return { success: true, duration, attempt: attemptNumber, status: 'Write successful' };
          } catch (retryError) {
            console.error('[NFC Write] Final retry failed:', retryError);
            throw new Error(`Unable to format tag: ${formatErrorMsg}. The tag may be locked, incompatible, or need manual formatting with another app first.`);
          }
        }
      }
      
      // If we reach here, formatting succeeded or tag was already formatted
      // The formatting path returns early on success, so if we're here without a tag, something went wrong
      if (!tagFormatted || !tag) {
        // If first attempt and no tag, retry once
        if (retryCount === 0) {
          console.log('[NFC Write] First attempt failed - automatically retrying entire operation...');
          await new Promise(resolve => setTimeout(resolve, 800));
          return this.writeUrl(userId, cardIndex, 1);
        }
        throw new Error('Unable to format or access tag');
      }
      
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

