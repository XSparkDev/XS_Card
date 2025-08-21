import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '../types/events';

const RECENT_EVENTS_KEY = 'recentEvents';
const MAX_RECENT_EVENTS = 5;

export interface RecentEvent {
  id: string;
  title: string;
  eventDate: string;
  location: {
    venue: string;
    city: string;
  };
  bannerImage?: string;
  viewedAt: string;
}

// Add event to recent list
export const addToRecentEvents = async (event: Event): Promise<void> => {
  try {
    const existingRecents = await getRecentEvents();
    
    // Remove if already exists (to move to top)
    const filteredRecents = existingRecents.filter(recent => recent.id !== event.id);
    
    // Create recent event object
    const recentEvent: RecentEvent = {
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      location: {
        venue: event.location.venue,
        city: event.location.city,
      },
      bannerImage: event.bannerImage,
      viewedAt: new Date().toISOString(),
    };
    
    // Add to beginning and limit to MAX_RECENT_EVENTS
    const updatedRecents = [recentEvent, ...filteredRecents].slice(0, MAX_RECENT_EVENTS);
    
    await AsyncStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(updatedRecents));
  } catch (error) {
    console.error('Error adding to recent events:', error);
  }
};

// Get recent events
export const getRecentEvents = async (): Promise<RecentEvent[]> => {
  try {
    const recentsJson = await AsyncStorage.getItem(RECENT_EVENTS_KEY);
    if (recentsJson) {
      return JSON.parse(recentsJson);
    }
    return [];
  } catch (error) {
    console.error('Error getting recent events:', error);
    return [];
  }
};

// Clear recent events
export const clearRecentEvents = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RECENT_EVENTS_KEY);
  } catch (error) {
    console.error('Error clearing recent events:', error);
  }
};

// Remove specific event from recents
export const removeFromRecentEvents = async (eventId: string): Promise<void> => {
  try {
    const existingRecents = await getRecentEvents();
    const filteredRecents = existingRecents.filter(recent => recent.id !== eventId);
    await AsyncStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(filteredRecents));
  } catch (error) {
    console.error('Error removing from recent events:', error);
  }
}; 