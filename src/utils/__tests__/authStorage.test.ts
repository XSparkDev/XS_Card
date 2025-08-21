/**
 * Tests for authStorage utility functions
 * These tests validate Phase 1 implementation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getKeepLoggedInPreference,
  setKeepLoggedInPreference,
  getStoredAuthData,
  storeAuthData,
  clearAuthData,
  clearAuthDataButKeepPreference,
  hasValidAuthData,
  updateLastLoginTime,
  AUTH_STORAGE_KEYS,
  AuthData,
} from '../authStorage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('AuthStorage Utilities - Phase 1 Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Keep Logged In Preference', () => {
    it('should return false by default when no preference is stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await getKeepLoggedInPreference();
      
      expect(result).toBe(false);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.KEEP_LOGGED_IN);
    });

    it('should return true when preference is set to true', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      
      const result = await getKeepLoggedInPreference();
      
      expect(result).toBe(true);
    });

    it('should set keep logged in preference correctly', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();
      
      await setKeepLoggedInPreference(true);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.KEEP_LOGGED_IN,
        'true'
      );
    });

    it('should handle errors gracefully when getting preference', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      const result = await getKeepLoggedInPreference();
      
      expect(result).toBe(false); // Should default to false on error
    });
  });

  describe('Auth Data Management', () => {
    const mockAuthData: AuthData = {
      userToken: 'Bearer mock-token',
      userData: { id: '123', name: 'Test User', email: 'test@example.com' },
      userRole: 'user',
      keepLoggedIn: true,
      lastLoginTime: Date.now(),
    };

    it('should return null when no auth data is stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await getStoredAuthData();
      
      expect(result).toBeNull();
    });

    it('should store auth data correctly', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();
      
      await storeAuthData(mockAuthData);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.USER_TOKEN,
        mockAuthData.userToken
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.USER_DATA,
        JSON.stringify(mockAuthData.userData)
      );
    });

    it('should clear all auth data', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();
      
      await clearAuthData();
      
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.USER_TOKEN);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.USER_DATA);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.USER_ROLE);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.KEEP_LOGGED_IN);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.LAST_LOGIN_TIME);
    });

    it('should preserve keep logged in preference when clearing data but keeping preference', async () => {
      // Mock getting current preference
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('true') // First call for getKeepLoggedInPreference
        .mockResolvedValueOnce('true'); // Second call for setKeepLoggedInPreference
      
      mockAsyncStorage.removeItem.mockResolvedValue();
      mockAsyncStorage.setItem.mockResolvedValue();
      
      await clearAuthDataButKeepPreference();
      
      // Should remove auth data
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.USER_TOKEN);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEYS.USER_DATA);
      
      // Should restore the preference
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.KEEP_LOGGED_IN,
        'true'
      );
    });
  });

  describe('Auth Data Validation', () => {
    it('should return true when valid auth data exists', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('Bearer token') // userToken
        .mockResolvedValueOnce('{"id":"123"}') // userData
        .mockResolvedValueOnce('user') // userRole
        .mockResolvedValueOnce('true') // keepLoggedIn
        .mockResolvedValueOnce('1234567890'); // lastLoginTime
      
      const result = await hasValidAuthData();
      
      expect(result).toBe(true);
    });

    it('should return false when no token exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const result = await hasValidAuthData();
      
      expect(result).toBe(false);
    });
  });

  describe('Last Login Time', () => {
    it('should update last login time', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();
      
      await updateLastLoginTime();
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.LAST_LOGIN_TIME,
        expect.any(String)
      );
    });

    it('should handle errors gracefully when updating last login time', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      
      // Should not throw error
      await expect(updateLastLoginTime()).resolves.toBeUndefined();
    });
  });
});

// Integration test to verify all utilities work together
describe('AuthStorage Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup storage to behave like real AsyncStorage
    const storage: { [key: string]: string } = {};
    
    mockAsyncStorage.getItem.mockImplementation((key) => {
      return Promise.resolve(storage[key] || null);
    });
    
    mockAsyncStorage.setItem.mockImplementation((key, value) => {
      storage[key] = value;
      return Promise.resolve();
    });
    
    mockAsyncStorage.removeItem.mockImplementation((key) => {
      delete storage[key];
      return Promise.resolve();
    });
  });

  it('should handle complete auth flow: store, retrieve, clear', async () => {
    const testAuthData: Partial<AuthData> = {
      userToken: 'Bearer test-token',
      userData: { id: '123', name: 'Test User', email: 'test@example.com' },
      keepLoggedIn: true,
    };

    // Store auth data
    await storeAuthData(testAuthData);

    // Verify data can be retrieved
    const retrievedData = await getStoredAuthData();
    expect(retrievedData?.userToken).toBe(testAuthData.userToken);
    expect(retrievedData?.keepLoggedIn).toBe(true);

    // Verify auth data is considered valid
    const isValid = await hasValidAuthData();
    expect(isValid).toBe(true);

    // Clear data but keep preference
    await clearAuthDataButKeepPreference();

    // Verify data is cleared but preference is preserved
    const clearedData = await getStoredAuthData();
    expect(clearedData).toBeNull();

    const preference = await getKeepLoggedInPreference();
    expect(preference).toBe(true);
  });
}); 