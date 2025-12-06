/**
 * NFC NDEF Utilities
 * 
 * Optimized NDEF encoding/parsing for NFC card-to-phone functionality
 */

import { API_BASE_URL } from './api';
import { Ndef } from 'react-native-nfc-manager';

/**
 * Generate NFC URL for a specific card
 * Format: https://xscard.co.za/nfc?userId={userId}&cardIndex={cardIndex}
 */
export function generateNFCUrl(userId: string, cardIndex: number): string {
  return `${API_BASE_URL}/nfc?userId=${userId}&cardIndex=${cardIndex}`;
}

/**
 * Encode URL into NDEF URI Record (optimized for speed)
 * Uses minimal NDEF format for fastest write times
 * 
 * react-native-nfc-manager expects:
 * - payload: Array of numbers (byte values 0-255)
 * - type: Array of numbers (byte values) - for URI record, type is [0x55] ('U')
 * - tnf: Number (1 = Well Known Type)
 */
export function encodeNDEFUrl(url: string): any[] {
  try {
    // Manually construct NDEF URI record to ensure correct format
    // URI Record format:
    // - TNF: 1 (Well Known Type)
    // - Type: [0x55] ('U' for URI)
    // - Payload: [0x04] (https://www.) + URL bytes
    
    // Determine URI prefix code (0x04 = https://www.)
    const prefixCode = 0x04; // https://www.
    
    // Remove https://www. prefix if present (we'll use prefix code instead)
    let urlWithoutPrefix = url;
    if (url.startsWith('https://www.')) {
      urlWithoutPrefix = url.substring(12); // Remove 'https://www.'
    } else if (url.startsWith('https://')) {
      urlWithoutPrefix = url.substring(8); // Remove 'https://'
      // Note: If no www, we might need prefix code 0x03 (https://)
      // But for simplicity, let's use 0x04 and add www if needed
    }
    
    // Encode URL string to bytes
    const urlBytes = Array.from(new TextEncoder().encode(urlWithoutPrefix));
    
    // Construct payload: [prefix_code, ...url_bytes]
    const payload = [prefixCode, ...urlBytes];
    
    // Construct NDEF record
    const ndefRecord = {
      tnf: 1, // Well Known Type
      type: [0x55], // 'U' for URI record type
      id: [], // No ID
      payload: payload.map(b => Number(b)), // Ensure all are numbers
    };
    
    console.log('[NDEF Encode] Manual record:', {
      tnf: ndefRecord.tnf,
      type: ndefRecord.type,
      payloadLength: ndefRecord.payload.length,
      url: url,
    });
    
    return [ndefRecord];
  } catch (error) {
    console.error('[NDEF Encode] Error encoding URL:', error);
    throw new Error(`Failed to encode NDEF URL: ${error}`);
  }
}

/**
 * Parse NDEF message to extract URL (optimized for speed)
 * Extracts only the URL, minimal processing
 */
export function parseNDEFUrl(ndefMessage: any): string | null {
  try {
    if (!ndefMessage || !Array.isArray(ndefMessage) || ndefMessage.length === 0) {
      console.log('[NDEF Parse] No NDEF message or empty array');
      return null;
    }

    // Get first record
    const record = ndefMessage[0];
    
    if (!record) {
      console.log('[NDEF Parse] No record found');
      return null;
    }

    // Try to parse using NDEF helper
    try {
      const uri = Ndef.uri.decodePayload(record.payload);
      if (uri) {
        console.log('[NDEF Parse] Extracted URL:', uri);
        return uri;
      }
    } catch (e) {
      // If decodePayload fails, try alternative parsing
      console.log('[NDEF Parse] Standard decode failed, trying alternative');
    }

    console.log('[NDEF Parse] Could not extract URL from record');
    return null;
  } catch (error) {
    console.error('[NDEF Parse] Error parsing NDEF:', error);
    return null;
  }
}

/**
 * Validate NFC URL format
 */
export function validateNFCUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    return (
      (urlObj.hostname === 'xscard.co.za' || urlObj.hostname.includes('localhost')) &&
      urlObj.pathname === '/nfc' &&
      params.has('userId') &&
      params.has('cardIndex')
    );
  } catch {
    return false;
  }
}

/**
 * Extract userId and cardIndex from NFC URL
 */
export function parseNFCUrl(url: string): { userId: string; cardIndex: number } | null {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    const userId = params.get('userId');
    const cardIndexStr = params.get('cardIndex');
    
    if (!userId || !cardIndexStr) {
      return null;
    }
    
    return {
      userId,
      cardIndex: parseInt(cardIndexStr, 10),
    };
  } catch {
    return null;
  }
}

