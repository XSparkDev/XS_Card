/**
 * ScanLimitContext
 *
 * App-wide source of truth for the QR scan rate limit (5 scans / rolling hour
 * for free users). Polls the backend once, here, instead of every screen that
 * needs the count — this is what lets the countdown banner stay mounted once
 * at the app root and stay in sync with the QR placeholders on the Cards screen.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL, getUserId } from '../utils/api';
import { useAuth } from './AuthContext';

const SCAN_LIMIT = 5;
const POLL_INTERVAL_MS = 3000;

export type ScanCounterColor = 'green' | 'orange' | 'red';

interface ScanLimitState {
  scansThisHour: number;
  limit: number;
  isLimitExceeded: boolean;
  resetTime: Date | null;
  /** "MM:SS" until the oldest scan in the window ages out. Empty when not limited. */
  countdownLabel: string;
  /** Escalating color for the scan counter: 1-2 green, 3-4 orange, 5 red. */
  counterColor: ScanCounterColor;
}

const defaultState: ScanLimitState = {
  scansThisHour: 0,
  limit: SCAN_LIMIT,
  isLimitExceeded: false,
  resetTime: null,
  countdownLabel: '',
  counterColor: 'green',
};

const ScanLimitContext = createContext<ScanLimitState>(defaultState);

const colorForCount = (count: number): ScanCounterColor => {
  if (count >= 5) return 'red';
  if (count >= 3) return 'orange';
  return 'green';
};

export function ScanLimitProvider({ children }: { children: ReactNode }) {
  const { isFreeUser, isLoadingUserStatus } = useAuth();
  const [scansThisHour, setScansThisHour] = useState(0);
  const [isLimitExceeded, setIsLimitExceeded] = useState(false);
  const [resetTime, setResetTime] = useState<Date | null>(null);
  const [countdownLabel, setCountdownLabel] = useState('');
  const activeRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId || !activeRef.current) return;
      const res = await fetch(`${API_BASE_URL}/scan-status/${userId}`);
      if (!res.ok || !activeRef.current) return;
      const data = await res.json();
      if (!activeRef.current || !data?.success) return;
      setScansThisHour(data.scanCountThisHour || 0);
      setIsLimitExceeded(!!data.isLimitExceeded);
      setResetTime(data.resetTime ? new Date(data.resetTime) : null);
    } catch (error) {
      console.log('[ScanLimitContext] poll failed:', error);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    if (isLoadingUserStatus || !isFreeUser) return;

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });

    return () => {
      activeRef.current = false;
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [isFreeUser, isLoadingUserStatus, poll]);

  // Premium upgrade mid-session → clear all limitation state immediately.
  useEffect(() => {
    if (!isFreeUser) {
      setIsLimitExceeded(false);
      setScansThisHour(0);
      setResetTime(null);
      setCountdownLabel('');
    }
  }, [isFreeUser]);

  // Live countdown to the moment the oldest scan in the window ages out.
  useEffect(() => {
    if (!isLimitExceeded || !resetTime) {
      setCountdownLabel('');
      return;
    }

    const tick = () => {
      const diff = resetTime.getTime() - Date.now();
      if (diff <= 0) {
        // Slot freed — drop the limit; the next poll confirms from the server.
        setIsLimitExceeded(false);
        setCountdownLabel('00:00');
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdownLabel(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isLimitExceeded, resetTime]);

  const value: ScanLimitState = {
    scansThisHour,
    limit: SCAN_LIMIT,
    isLimitExceeded,
    resetTime,
    countdownLabel,
    counterColor: colorForCount(scansThisHour),
  };

  return <ScanLimitContext.Provider value={value}>{children}</ScanLimitContext.Provider>;
}

export function useScanLimit(): ScanLimitState {
  return useContext(ScanLimitContext);
}
