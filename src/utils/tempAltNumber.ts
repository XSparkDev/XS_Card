// Temporary file for alt number data until backend is ready
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AltNumberData {
  altNumber?: string;
  altCountryCode?: string;
  showAltNumber?: boolean; // Toggle to show/hide on card
}

// Store alt number per card index
export const saveAltNumber = async (cardIndex: number, data: AltNumberData) => {
  try {
    const key = `altNumber_${cardIndex}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving alt number:', error);
  }
};

// Get alt number for a card
export const getAltNumber = async (cardIndex: number): Promise<AltNumberData | null> => {
  try {
    const key = `altNumber_${cardIndex}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting alt number:', error);
    return null;
  }
};

