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
  attempt?: number; // Which attempt this is (1, 2, 3, etc.)
  status?: string; // Human-readable status message
}

export type NFCWriteProgressCallback = (status: {
  attempt: number;
  message: string;
  progress?: number;
}) => void;

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

