import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys for authentication data
export const AUTH_STORAGE_KEYS = {
  KEEP_LOGGED_IN: 'keepLoggedIn',
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
  USER_ROLE: 'userRole',
  LAST_LOGIN_TIME: 'lastLoginTime',
} as const;

// Interface for stored authentication data
export interface AuthData {
  userToken: string | null;
  userData: any | null;
  userRole: string | null;
  keepLoggedIn: boolean;
  lastLoginTime: number | null;
}

/**
 * Get the "Keep Logged In" preference
 * @returns Promise<boolean> - true if user wants to stay logged in
 */
export const getKeepLoggedInPreference = async (): Promise<boolean> => {
  try {
    const preference = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.KEEP_LOGGED_IN);
    console.log('getKeepLoggedInPreference - Raw value:', preference);
    return preference === 'true';
  } catch (error) {
    console.warn('Error getting keep logged in preference:', error);
    return false; // Default to false for security
  }
};

/**
 * Set the "Keep Logged In" preference
 * @param value - boolean indicating if user wants to stay logged in
 */
export const setKeepLoggedInPreference = async (value: boolean): Promise<void> => {
  try {
    console.log('setKeepLoggedInPreference - Setting value:', value);
    await AsyncStorage.setItem(AUTH_STORAGE_KEYS.KEEP_LOGGED_IN, value.toString());
    
    // Verify it was stored correctly
    const verification = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.KEEP_LOGGED_IN);
    console.log('setKeepLoggedInPreference - Verification read:', verification);
  } catch (error) {
    console.error('Error setting keep logged in preference:', error);
    throw new Error('Failed to save login preference');
  }
};

/**
 * Get all stored authentication data
 * @returns Promise<AuthData | null> - all auth data or null if not found
 */
export const getStoredAuthData = async (): Promise<AuthData | null> => {
  try {
    const [userToken, userData, userRole, keepLoggedIn, lastLoginTime] = await Promise.all([
      AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER_TOKEN),
      AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER_DATA),
      AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER_ROLE),
      getKeepLoggedInPreference(),
      AsyncStorage.getItem(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME),
    ]);

    // If no token, return null
    if (!userToken) {
      return null;
    }

    return {
      userToken,
      userData: userData ? JSON.parse(userData) : null,
      userRole,
      keepLoggedIn,
      lastLoginTime: lastLoginTime ? parseInt(lastLoginTime, 10) : null,
    };
  } catch (error) {
    console.error('Error getting stored auth data:', error);
    return null;
  }
};

/**
 * Store authentication data
 * @param authData - Authentication data to store
 */
export const storeAuthData = async (authData: Partial<AuthData>): Promise<void> => {
  try {
    const promises: Promise<void>[] = [];

    if (authData.userToken !== undefined) {
      promises.push(
        authData.userToken 
          ? AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER_TOKEN, authData.userToken)
          : AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_TOKEN)
      );
    }

    if (authData.userData !== undefined) {
      promises.push(
        authData.userData
          ? AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER_DATA, JSON.stringify(authData.userData))
          : AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_DATA)
      );
    }

    if (authData.userRole !== undefined) {
      promises.push(
        authData.userRole
          ? AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER_ROLE, authData.userRole)
          : AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_ROLE)
      );
    }

    if (authData.keepLoggedIn !== undefined) {
      promises.push(setKeepLoggedInPreference(authData.keepLoggedIn));
    }

    if (authData.lastLoginTime !== undefined) {
      promises.push(
        authData.lastLoginTime
          ? AsyncStorage.setItem(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME, authData.lastLoginTime.toString())
          : AsyncStorage.removeItem(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME)
      );
    }

    await Promise.all(promises);
    
    // iOS-specific: Add a small delay to ensure storage is complete
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Error storing auth data:', error);
    throw new Error('Failed to store authentication data');
  }
};

/**
 * Clear all authentication data
 */
export const clearAuthData = async (): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_TOKEN),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_DATA),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_ROLE),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.KEEP_LOGGED_IN),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME),
    ]);
  } catch (error) {
    console.error('Error clearing auth data:', error);
    throw new Error('Failed to clear authentication data');
  }
};

/**
 * Clear auth data but preserve the "keep logged in" preference
 * Useful for when user manually logs out but we want to remember their preference
 */
export const clearAuthDataButKeepPreference = async (): Promise<void> => {
  try {
    const keepLoggedIn = await getKeepLoggedInPreference();
    await Promise.all([
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_TOKEN),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_DATA), 
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER_ROLE),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME),
    ]);
    // Restore the preference
    await setKeepLoggedInPreference(keepLoggedIn);
  } catch (error) {
    console.error('Error clearing auth data while preserving preference:', error);
    throw new Error('Failed to clear authentication data');
  }
};

/**
 * Check if user has valid stored authentication data
 * @returns Promise<boolean> - true if user appears to be authenticated
 */
export const hasValidAuthData = async (): Promise<boolean> => {
  try {
    const authData = await getStoredAuthData();
    return !!(authData?.userToken && authData?.userData);
  } catch (error) {
    console.error('Error checking auth data validity:', error);
    return false;
  }
};

/**
 * Update last login time to current timestamp
 */
export const updateLastLoginTime = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME, Date.now().toString());
  } catch (error) {
    console.error('Error updating last login time:', error);
    // Don't throw here as this is not critical
  }
}; 