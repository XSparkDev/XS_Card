import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getWidgetPreferences,
  setWidgetPreference,
  getWidgetPreference,
  toggleWidgetPreference,
  getEnabledWidgetCards,
  clearWidgetPreferences,
  getCardWidgetData
} from '../widgetUtils';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Widget Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWidgetPreferences', () => {
    it('should return empty object when no preferences stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      const result = await getWidgetPreferences();
      
      expect(result).toEqual({});
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('widgetPreferences');
    });

    it('should return parsed preferences when stored', async () => {
      const mockPreferences = { 0: true, 1: false };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockPreferences));
      
      const result = await getWidgetPreferences();
      
      expect(result).toEqual(mockPreferences);
    });

    it('should handle parsing errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');
      
      const result = await getWidgetPreferences();
      
      expect(result).toEqual({});
    });
  });

  describe('setWidgetPreference', () => {
    it('should set preference for specific card index', async () => {
      const existingPreferences = { 0: true };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingPreferences));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      
      await setWidgetPreference(1, true);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'widgetPreferences',
        JSON.stringify({ 0: true, 1: true })
      );
    });
  });

  describe('getWidgetPreference', () => {
    it('should return false for non-existent preference', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 0: true }));
      
      const result = await getWidgetPreference(1);
      
      expect(result).toBe(false);
    });

    it('should return stored preference value', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 0: true, 1: false }));
      
      const result = await getWidgetPreference(1);
      
      expect(result).toBe(false);
    });
  });

  describe('toggleWidgetPreference', () => {
    it('should toggle from false to true', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 0: false }));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      
      const result = await toggleWidgetPreference(0);
      
      expect(result).toBe(true);
    });

    it('should toggle from true to false', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 0: true }));
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      
      const result = await toggleWidgetPreference(0);
      
      expect(result).toBe(false);
    });
  });

  describe('getEnabledWidgetCards', () => {
    it('should return array of enabled card indices', async () => {
      const mockPreferences = { 0: true, 1: false, 2: true };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockPreferences));
      
      const result = await getEnabledWidgetCards();
      
      expect(result).toEqual([0, 2]);
    });

    it('should return empty array when no preferences enabled', async () => {
      const mockPreferences = { 0: false, 1: false };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockPreferences));
      
      const result = await getEnabledWidgetCards();
      
      expect(result).toEqual([]);
    });
  });

  describe('clearWidgetPreferences', () => {
    it('should remove widget preferences from storage', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
      
      await clearWidgetPreferences();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('widgetPreferences');
    });
  });
});
