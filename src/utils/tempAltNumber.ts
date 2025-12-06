// Temporary file for alt number data until backend is ready
// NOTE: This file is now deprecated. Alt numbers are stored in the backend.
// These functions are kept for backward compatibility during migration period.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedFetchWithRefresh, ENDPOINTS } from './api';

export interface AltNumberData {
  altNumber?: string;
  altCountryCode?: string;
  showAltNumber?: boolean; // Toggle to show/hide on card
}

// DEPRECATED: Store alt number per card index (use backend instead)
export const saveAltNumber = async (cardIndex: number, data: AltNumberData) => {
  console.warn('saveAltNumber is deprecated. Alt numbers should be saved to backend.');
  try {
    const key = `altNumber_${cardIndex}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving alt number:', error);
  }
};

// DEPRECATED: Get alt number for a card (use backend instead)
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

// Migration function to sync existing AsyncStorage alt numbers to backend
export const migrateAltNumbersToBackend = async (userId: string): Promise<void> => {
  try {
    // Check if migration has already been completed
    const migrationFlag = await AsyncStorage.getItem('altNumberMigrated');
    if (migrationFlag === 'true') {
      console.log('Alt number migration already completed');
      return;
    }

    console.log('Starting alt number migration to backend...');
    
    // Get all keys from AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    const altNumberKeys = allKeys.filter(key => key.startsWith('altNumber_'));
    
    if (altNumberKeys.length === 0) {
      console.log('No alt numbers found in AsyncStorage to migrate');
      // Mark as migrated even if no data exists
      await AsyncStorage.setItem('altNumberMigrated', 'true');
      return;
    }

    let migratedCount = 0;
    let failedCount = 0;

    // Migrate each alt number to backend
    for (const key of altNumberKeys) {
      try {
        // Extract card index from key (format: "altNumber_0", "altNumber_1", etc.)
        const cardIndex = parseInt(key.replace('altNumber_', ''));
        if (isNaN(cardIndex)) {
          console.warn(`Invalid card index in key: ${key}`);
          continue;
        }

        // Get alt number data from AsyncStorage
        const altDataJson = await AsyncStorage.getItem(key);
        if (!altDataJson) continue;

        const altData: AltNumberData = JSON.parse(altDataJson);
        
        // Skip if no meaningful data
        if (!altData.altNumber && !altData.showAltNumber) {
          continue;
        }

        // Update card in backend with alt number data
        const updateData = {
          altNumber: altData.altNumber || '',
          altCountryCode: altData.altCountryCode || '+27',
          showAltNumber: altData.showAltNumber || false
        };

        const response = await authenticatedFetchWithRefresh(
          `${ENDPOINTS.UPDATE_CARD.replace(':id', userId)}?cardIndex=${cardIndex}`,
          {
            method: 'PATCH',
            body: JSON.stringify(updateData),
          }
        );

        if (response.ok) {
          migratedCount++;
          console.log(`Migrated alt number for card index ${cardIndex}`);
        } else {
          failedCount++;
          console.error(`Failed to migrate alt number for card index ${cardIndex}:`, await response.text());
        }
      } catch (error) {
        failedCount++;
        console.error(`Error migrating alt number from key ${key}:`, error);
      }
    }

    // If all migrations succeeded, clear AsyncStorage and set migration flag
    if (failedCount === 0 && migratedCount > 0) {
      // Clear all alt number keys from AsyncStorage
      await AsyncStorage.multiRemove(altNumberKeys);
      console.log(`Cleared ${altNumberKeys.length} alt number keys from AsyncStorage`);
    }

    // Set migration flag
    await AsyncStorage.setItem('altNumberMigrated', 'true');
    
    console.log(`Alt number migration completed: ${migratedCount} migrated, ${failedCount} failed`);
  } catch (error) {
    console.error('Error during alt number migration:', error);
    // Don't throw - migration failure shouldn't break the app
  }
};

