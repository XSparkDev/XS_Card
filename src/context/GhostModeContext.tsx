/**
 * GhostModeContext
 *
 * Global on/off switch for the app's glassmorphic "Ghost Mode" appearance.
 * Follows the same shape as TooltipContext / ScanLimitContext: a single
 * AsyncStorage-persisted boolean, loaded once on mount, written on change.
 *
 * Components that want to render as frosted glass when Ghost Mode is on
 * should use the shared <GlassSurface> component (src/components/GlassSurface.tsx)
 * rather than reading this context directly, so the blur/overlay/border
 * treatment stays visually consistent everywhere it's applied.
 */
import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GHOST_MODE_KEY = 'ghost_mode_enabled';

interface GhostModeContextType {
  ghostModeEnabled: boolean;
  setGhostModeEnabled: (enabled: boolean) => void;
}

const GhostModeContext = createContext<GhostModeContextType | undefined>(undefined);

export const GhostModeProvider = ({ children }: { children: ReactNode }) => {
  const [ghostModeEnabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(GHOST_MODE_KEY)
      .then((v) => { if (active && v !== null) setEnabled(v === 'true'); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const setGhostModeEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    AsyncStorage.setItem(GHOST_MODE_KEY, enabled ? 'true' : 'false').catch(() => {});
  }, []);

  return (
    <GhostModeContext.Provider value={{ ghostModeEnabled, setGhostModeEnabled }}>
      {children}
    </GhostModeContext.Provider>
  );
};

export const useGhostMode = (): GhostModeContextType => {
  const context = useContext(GhostModeContext);
  if (context === undefined) {
    throw new Error('useGhostMode must be used within a GhostModeProvider');
  }
  return context;
};
