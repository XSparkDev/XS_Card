import { Platform, Linking } from 'react-native';
import * as Constants from 'expo-constants';
import { buildUrl, ENDPOINTS } from '../utils/api';

export interface VersionInfo {
  currentVersion: string;
  currentBuildNumber: string;
  latestVersion: string;
  latestBuildNumber: string;
  minimumRequiredVersion: string;
  minimumRequiredBuildNumber: string;
  needsUpdate: boolean;
  forceUpdate: boolean;
  updateMessage: string;
  updateUrl: string;
  releaseNotes: string;
}

export interface UpdateCheckResult {
  needsUpdate: boolean;
  forceUpdate: boolean;
  versionInfo: VersionInfo | null;
  error?: string;
}

/**
 * Get current app version and build number
 */
export const getCurrentAppVersion = (): { version: string; buildNumber: string } => {
  try {
    // For Expo apps, get version from Constants
    // Try multiple ways to get version (for different Expo SDK versions)
    let version = '0.0.0';
    let buildNumber = '0';
    
    if (Constants.expoConfig) {
      version = Constants.expoConfig.version || '0.0.0';
      if (Platform.OS === 'ios') {
        buildNumber = Constants.expoConfig.ios?.buildNumber || '0';
      } else if (Platform.OS === 'android') {
        buildNumber = String(Constants.expoConfig.android?.versionCode || 0);
      }
    } else if (Constants.manifest) {
      // Fallback for older Expo SDK
      version = Constants.manifest.version || '0.0.0';
      if (Platform.OS === 'ios') {
        buildNumber = Constants.manifest.ios?.buildNumber || '0';
      } else if (Platform.OS === 'android') {
        buildNumber = String(Constants.manifest.android?.versionCode || 0);
      }
    } else if (Constants.manifest2) {
      // Fallback for newer Expo SDK
      version = Constants.manifest2?.extra?.expoClient?.version || '0.0.0';
      if (Platform.OS === 'ios') {
        buildNumber = Constants.manifest2?.ios?.buildNumber || '0';
      }
    }
    
    return { version, buildNumber };
  } catch (error) {
    console.error('[UpdateCheck] Error getting app version:', error);
    return { version: '0.0.0', buildNumber: '0' };
  }
};

/**
 * Check if app needs update by comparing with server
 */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  try {
    // Only check on iOS
    if (Platform.OS !== 'ios') {
      console.log('[UpdateCheck] Skipping update check - not iOS platform');
      return {
        needsUpdate: false,
        forceUpdate: false,
        versionInfo: null
      };
    }

    const { version, buildNumber } = getCurrentAppVersion();
    console.log(`[UpdateCheck] Checking for updates. Current: ${version} (${buildNumber})`);

    const response = await fetch(buildUrl(ENDPOINTS.IOS_VERSION_CHECK), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentVersion: version,
        currentBuildNumber: buildNumber,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[UpdateCheck] Server error:', response.status, errorText);
      return {
        needsUpdate: false,
        forceUpdate: false,
        versionInfo: null,
        error: `Server error: ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      console.error('[UpdateCheck] API returned error:', data.message);
      return {
        needsUpdate: false,
        forceUpdate: false,
        versionInfo: null,
        error: data.message || 'Unknown error'
      };
    }

    console.log('[UpdateCheck] Update check result:', {
      needsUpdate: data.needsUpdate,
      forceUpdate: data.forceUpdate,
      latestVersion: data.versionInfo?.latestVersion
    });

    return {
      needsUpdate: data.needsUpdate || false,
      forceUpdate: data.forceUpdate || false,
      versionInfo: data.versionInfo || null
    };
  } catch (error) {
    console.error('[UpdateCheck] Error checking for update:', error);
    return {
      needsUpdate: false,
      forceUpdate: false,
      versionInfo: null,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
};

/**
 * Open App Store to update the app
 */
export const openAppStore = async (updateUrl?: string): Promise<void> => {
  try {
    const url = updateUrl || 'https://apps.apple.com/app/id6742452317';
    console.log('[UpdateCheck] Opening App Store:', url);
    
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      console.error('[UpdateCheck] Cannot open URL:', url);
    }
  } catch (error) {
    console.error('[UpdateCheck] Error opening App Store:', error);
  }
};

