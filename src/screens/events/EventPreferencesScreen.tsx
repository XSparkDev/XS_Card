import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants/colors';
import EventHeader from '../../components/EventHeader';
import { EventPreferences } from '../../types/events';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../../utils/api';
import { useToast } from '../../hooks/useToast';

type NavigationProp = NativeStackNavigationProp<any>;

const DEFAULT_PREFERENCES: EventPreferences = {
  receiveEventNotifications: true,
  receiveNewEventBroadcasts: true,
  receiveEventUpdates: true,
  receiveEventReminders: true,
  receivePrivateEventBroadcasts: false,
  preferredCategories: [],
  locationRadius: 50,
  preferredLocation: undefined,
  eventTypePreference: undefined,
  priceRange: undefined,
};

const CATEGORIES = [
  'tech', 'business', 'social', 'sports', 'arts', 
  'education', 'networking', 'entertainment', 'health', 'other'
];

export default function EventPreferencesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const toast = useToast();

  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<EventPreferences>(DEFAULT_PREFERENCES);
  const [connected, setConnected] = useState(false);

  // Load user preferences when screen mounts
  useEffect(() => {
    loadPreferences();
  }, []);

  // Load preferences from backend
  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.GET_EVENT_PREFERENCES,
        { method: 'GET' }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setLocalPreferences(result.data.eventPreferences || DEFAULT_PREFERENCES);
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update preferences on backend
  const updatePreferences = async (updates: Partial<EventPreferences>): Promise<boolean> => {
    try {
      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.UPDATE_EVENT_PREFERENCES,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventPreferences: updates }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        return result.success;
      }
      return false;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  };

  // Socket connection functions
  const connectToSocket = () => {
    setConnected(true);
    console.log('Connecting to WebSocket...');
  };

  const disconnectFromSocket = () => {
    setConnected(false);
    console.log('Disconnecting from WebSocket...');
  };

  // Handle preference updates
  const handlePreferenceChange = async (key: keyof EventPreferences, value: any) => {
    if (!localPreferences) return;

    const updatedPreferences = { ...localPreferences, [key]: value };
    setLocalPreferences(updatedPreferences);

    // Update backend
    setLoading(true);
    const success = await updatePreferences({ [key]: value });
    setLoading(false);

    if (!success) {
      // Revert on failure
      setLocalPreferences(localPreferences);
      toast.error('Error', 'Failed to update preferences. Please try again.');
    }
  };

  // Handle category toggle
  const handleCategoryToggle = (category: string) => {
    if (!localPreferences) return;

    const currentCategories = localPreferences.preferredCategories || [];
    const updatedCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];

    handlePreferenceChange('preferredCategories', updatedCategories);
  };

  // Handle notification master toggle
  const handleNotificationToggle = async (enabled: boolean) => {
    await handlePreferenceChange('receiveEventNotifications', enabled);

    // Show connection status
    if (enabled && !connected) {
      toast.info(
        'Connecting...',
        'Connecting to real-time notifications. This may take a moment.'
      );
      connectToSocket();
    } else if (!enabled && connected) {
      disconnectFromSocket();
    }
  };

  // Handle private event broadcast toggle
  const handlePrivateEventToggle = async (enabled: boolean) => {
    if (enabled) {
      // Show warning when enabling private event broadcasts
      Alert.alert(
        'Private Event Notifications',
        'You will receive notifications about private events that you may not be able to register for. These events are only accessible to invited users or organizers.\n\nContinue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Enable', 
            onPress: () => updatePrivateEventPreference(true),
            style: 'default'
          }
        ]
      );
    } else {
      // Disable without warning
      updatePrivateEventPreference(false);
    }
  };

  const updatePrivateEventPreference = async (enabled: boolean) => {
    const updatedPreferences = { ...localPreferences, receivePrivateEventBroadcasts: enabled };
    setLocalPreferences(updatedPreferences);

    setLoading(true);
    const success = await updatePreferences({ receivePrivateEventBroadcasts: enabled });
    setLoading(false);

    if (!success) {
      setLocalPreferences(localPreferences); // Revert on failure
      toast.error('Error', 'Failed to update private event notifications. Please try again.');
    } else {
      if (enabled) {
        toast.info('Enabled', 'You will now receive private event notifications.');
      } else {
        toast.success('Disabled', 'Private event notifications disabled.');
      }
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    Alert.alert(
      'Reset Preferences',
      'This will reset all your event notification preferences to default settings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultPreferences: EventPreferences = {
              receiveEventNotifications: true,
              receiveNewEventBroadcasts: true,
              receiveEventUpdates: true,
              receiveEventReminders: true,
              receivePrivateEventBroadcasts: false,
              preferredCategories: [],
              locationRadius: 50,
              preferredLocation: undefined,
              eventTypePreference: undefined,
              priceRange: undefined,
            };

            setLoading(true);
            const success = await updatePreferences(defaultPreferences);
            setLoading(false);

            if (success) {
              toast.success('Success', 'Preferences reset to defaults');
            } else {
              toast.error('Error', 'Failed to reset preferences');
            }
          }
        }
      ]
    );
  };

  // Handle save preferences
  const handleSavePreferences = async () => {
    try {
      setSaving(true);

      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.UPDATE_EVENT_PREFERENCES,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventPreferences: localPreferences }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save preferences: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success(
          'Preferences Saved',
          'Your event notification preferences have been updated successfully.'
        );
      } else {
        throw new Error(result.message || 'Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error(
        'Save Failed',
        error instanceof Error ? error.message : 'Failed to save preferences. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <EventHeader title="Event Preferences" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your preferences...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <EventHeader title="Event Preferences" />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={220}
        extraHeight={120}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={styles.introContainer}>
          <MaterialIcons name="tune" size={32} color={COLORS.primary} />
          <Text style={styles.introTitle}>Customize Your Event Experience</Text>
          <Text style={styles.introSubtitle}>
            Configure how you want to receive event notifications and what types of events interest you most.
          </Text>
        </View>

        {/* WebSocket Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-time Notifications</Text>
          <View style={styles.connectionStatus}>
            <MaterialIcons name="wifi" size={20} color="#4CAF50" />
            <Text style={styles.connectionText}>Connected to real-time updates</Text>
          </View>
        </View>

        {/* Main Notification Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Settings</Text>
          
          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <MaterialIcons name="notifications" size={24} color={COLORS.primary} />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceName}>Event Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Receive notifications about events in your area
                </Text>
              </View>
            </View>
            <Switch
              value={localPreferences.receiveEventNotifications}
              onValueChange={(value) => handlePreferenceChange('receiveEventNotifications', value)}
              trackColor={{ false: COLORS.background, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <MaterialIcons name="campaign" size={24} color={COLORS.primary} />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceName}>New Event Announcements</Text>
                <Text style={styles.preferenceDescription}>
                  Get notified when new events are published
                </Text>
              </View>
            </View>
            <Switch
              value={localPreferences.receiveNewEventBroadcasts}
              onValueChange={(value) => handlePreferenceChange('receiveNewEventBroadcasts', value)}
              trackColor={{ false: COLORS.background, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <MaterialIcons name="update" size={24} color={COLORS.primary} />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceName}>Event Updates</Text>
                <Text style={styles.preferenceDescription}>
                  Receive updates about events you're registered for
                </Text>
              </View>
            </View>
            <Switch
              value={localPreferences.receiveEventUpdates}
              onValueChange={(value) => handlePreferenceChange('receiveEventUpdates', value)}
              trackColor={{ false: COLORS.background, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <MaterialIcons name="alarm" size={24} color={COLORS.primary} />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceName}>Event Reminders</Text>
                <Text style={styles.preferenceDescription}>
                  Get reminded before events you're attending
                </Text>
              </View>
            </View>
            <Switch
              value={localPreferences.receiveEventReminders}
              onValueChange={(value) => handlePreferenceChange('receiveEventReminders', value)}
              trackColor={{ false: COLORS.background, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View style={styles.preferenceHeader}>
              <MaterialIcons name="lock" size={24} color="#FF6B6B" />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceName}>Private Event Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Receive notifications about private events (you may not be able to register)
                </Text>
              </View>
            </View>
            <Switch
              value={localPreferences.receivePrivateEventBroadcasts || false}
              onValueChange={(value) => handlePrivateEventToggle(value)}
              trackColor={{ false: COLORS.background, true: '#FF6B6B' }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Preferred Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Event Categories</Text>
          <Text style={styles.sectionDescription}>
            Select the types of events you're most interested in to receive targeted notifications.
          </Text>
          
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  localPreferences.preferredCategories.includes(category) && 
                  { backgroundColor: COLORS.primary }
                ]}
                onPress={() => handleCategoryToggle(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    localPreferences.preferredCategories.includes(category) && 
                    { color: COLORS.white }
                  ]}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Event Type Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Type Preference</Text>
          <Text style={styles.sectionDescription}>
            Choose if you prefer free events, paid events, or both.
          </Text>
          
          <View style={styles.eventTypeContainer}>
            <TouchableOpacity
              style={[
                styles.eventTypeOption,
                !localPreferences.eventTypePreference && { backgroundColor: COLORS.primary }
              ]}
              onPress={() => handlePreferenceChange('eventTypePreference', undefined)}
            >
              <Text
                style={[
                  styles.eventTypeText,
                  !localPreferences.eventTypePreference && { color: COLORS.white }
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.eventTypeOption,
                localPreferences.eventTypePreference === 'free' && { backgroundColor: COLORS.primary }
              ]}
              onPress={() => handlePreferenceChange('eventTypePreference', 'free')}
            >
              <Text
                style={[
                  styles.eventTypeText,
                  localPreferences.eventTypePreference === 'free' && { color: COLORS.white }
                ]}
              >
                Free
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.eventTypeOption,
                localPreferences.eventTypePreference === 'paid' && { backgroundColor: COLORS.primary }
              ]}
              onPress={() => handlePreferenceChange('eventTypePreference', 'paid')}
            >
              <Text
                style={[
                  styles.eventTypeText,
                  localPreferences.eventTypePreference === 'paid' && { color: COLORS.white }
                ]}
              >
                Paid
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: COLORS.primary }]}
            onPress={handleSavePreferences}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name="save" size={20} color={COLORS.white} />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    width: '100%', // Remove side spacing - use full width
    padding: 16,
    paddingTop: 16,
    paddingHorizontal: 16, // Smaller horizontal padding
    paddingBottom: 220, // Extra padding for keyboard
  },
  bottomSpacer: {
    height: 120,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  section: {
    marginBottom: 36, // Slightly more spacing between sections
  },
  sectionTitle: {
    fontSize: 19, // Slightly larger for better hierarchy
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 15, // Slightly larger for better readability
    color: COLORS.gray,
    marginBottom: 20, // More space before content
    lineHeight: 22, // Better line height for readability
  },
  connectionStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  connectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  connectButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4, // Add small horizontal padding
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 8, // Reduced margin to give more space for toggle
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 18,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30, // slimmer pill
    borderWidth: 1,
    borderColor: COLORS.gray,
    marginBottom: 8,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.error,
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  savingText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  introContainer: {
    alignItems: 'center',
    marginBottom: 40, // More space after intro
    paddingHorizontal: 16, // Add some horizontal padding
  },
  introTitle: {
    fontSize: 26, // Slightly larger title
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 12,
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 17, // Larger for better readability
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24, // Better line height
    paddingHorizontal: 16, // Add padding instead of max width for better responsiveness
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1, // Allow it to take available space but not overflow
    marginRight: 12, // Space between content and switch
  },
  preferenceText: {
    flex: 1,
  },
  preferenceName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
  eventTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  eventTypeOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30, // slimmer pill
    borderWidth: 1,
    borderColor: COLORS.gray,
    alignItems: 'center',
  },
  eventTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
  saveContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40, // lift from screen bottom
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  saveButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 40, // pill shape
    backgroundColor: COLORS.primary,
    minWidth: 180,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 17, // Slightly larger text
    fontWeight: 'bold',
  },
}); 