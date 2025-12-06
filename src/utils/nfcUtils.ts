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
 */
export function encodeNDEFUrl(url: string): any[] {
  try {
    // Use the NDEF helper to create a URI record
    const uriRecord = Ndef.uriRecord(url);
    
    return [uriRecord];
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

