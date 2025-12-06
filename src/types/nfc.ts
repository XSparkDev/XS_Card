/**
 * NFC Type Definitions
 * 
 * Types for NFC card-to-phone functionality
 */

export interface NFCReadResult {
  url?: string;
  success: boolean;
  error?: string;
  duration?: number;
}

export interface NFCWriteResult {
  success: boolean;
  error?: string;
  duration?: number;
}

export interface NFCStatus {
  available: boolean;
  enabled: boolean;
  platform: 'android' | 'ios' | 'unsupported';
}

export interface NFCCardData {
  userId: string;
  cardIndex: number;
  url: string;
}

