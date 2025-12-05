import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Modal, Alert, TextInput, KeyboardAvoidingView, Animated, ActivityIndicator, FlatList, TouchableWithoutFeedback, InteractionManager, Linking, Share, Clipboard, RefreshControl } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { COLORS } from '../../constants/colors';
import AdminHeader from '../../components/AdminHeader';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AdminTabParamList, AuthStackParamList } from '../../types';
import { API_BASE_URL, ENDPOINTS, getUserId, buildUrl, authenticatedFetchWithRefresh, forceLogoutExpiredToken, useToast } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { MaterialIcons } from '@expo/vector-icons';
import { useMeetingNotifications, MeetingNotificationSummary } from '../../context/MeetingNotificationContext';
import { RootStackParamList } from '../../types';

type CalendarNavigationProp = BottomTabNavigationProp<AdminTabParamList, 'Calendar'>;
type CalendarScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ShareOption {
  id: string;
  name: string;
  icon: 'whatsapp' | 'send' | 'email' | 'linkedin' | 'content-copy';
  color: string;
  action: () => void;
}

// Contact interface for calendar (matches ContactScreen.tsx)
interface Contact {
  id?: string;
  name: string;
  surname: string;
  phone: string;
  email?: string;
  company?: string;
  howWeMet: string;
  createdAt: string;
  isXsCardUser?: boolean;
  sourceUserId?: string;
  sourceCardIndex?: number;
  profileImageUrl?: string | null;
  profileImageUrls?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
}

// Update Event type to include all meeting details
type Event = {
  id?: string;
  meetingWith: string;
  meetingWhen: string;
  description: string;
  title: string;
  duration: number;
  location: string;
  attendees: Contact[];
  startTime: string;
  endTime: string;
};

interface MarkedDates {
  [date: string]: {
    marked?: boolean;
    selected?: boolean;
    selectedColor?: string;
    dotColor?: string;
  };
}

interface MeetingDetails {
  title: string;
  duration: number;
  location: string;
  attendees: Contact[];
  startTime: string;
  endTime: string;
}

const MONTH_MAP: { [key: string]: string } = {
  January: '01',
  February: '02',
  March: '03',
  April: '04',
  May: '05',
  June: '06',
  July: '07',
  August: '08',
  September: '09',
  October: '10',
  November: '11',
  December: '12',
};

const MEETING_NOTIFICATION_SEEN_KEY = 'meetingNotificationSeenIds';
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000;

const getEventIdentifier = (event: Event, fallbackIndex: number): string | null => {
  if (event.id) {
    return event.id;
  }
  if ((event as any).uid) {
    return (event as any).uid;
  }
  if (event.meetingWhen || event.meetingWith) {
    return `${event.meetingWhen ?? ''}-${event.meetingWith ?? ''}-${fallbackIndex}`;
  }
  return null;
};

const parseMeetingDateFromString = (meetingWhen?: string): Date | null => {
  if (!meetingWhen) {
    return null;
  }
  try {
    const fixedDateStr = meetingWhen.replace(' at at ', ' at ');
    const [datePart, timePart] = fixedDateStr.split(' at ');
    if (!datePart) return null;
    const dateSegments = datePart.trim().split(' ');
    if (dateSegments.length !== 3) return null;
    const [monthStr, day, year] = dateSegments;
    const month = MONTH_MAP[monthStr];
    if (!month) return null;
    const isoString = `${year}-${month}-${day.padStart(2, '0')}T${timePart ? timePart.trim() : '00:00'}`;
    const parsed = new Date(isoString);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    console.error('Failed to parse meeting date:', meetingWhen, error);
    return null;
  }
};

const convertFirestoreTimestampToMs = (value: any): number | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value._seconds) {
    return value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1_000_000);
  }
  if (value.seconds) {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }
  return null;
};

const formatNotificationSummary = (
  event: Event,
  eventId: string,
  meetingDate?: Date
): MeetingNotificationSummary => ({
  id: eventId,
  title: event.title || event.description || event.meetingWith || 'Meeting',
  meetingWhen: event.meetingWhen,
  meetingWith: event.meetingWith,
  location: event.location,
  formattedTime: meetingDate
    ? `${meetingDate.toLocaleDateString()} • ${meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : event.meetingWhen,
});

const buildNotificationSummaries = async (
  events: Event[]
): Promise<{ startingSoon: MeetingNotificationSummary[]; recentBookings: MeetingNotificationSummary[] }> => {
  const now = Date.now();
  let storedIdsRaw: string | null = null;
  try {
    storedIdsRaw = await AsyncStorage.getItem(MEETING_NOTIFICATION_SEEN_KEY);
  } catch (error) {
    console.error('Unable to read meeting notification cache:', error);
  }

  const hasStoredIds = !!storedIdsRaw;
  const seenIds = new Set<string>(storedIdsRaw ? JSON.parse(storedIdsRaw) : []);
  const updatedIds = new Set<string>(seenIds);

  const startingSoon: MeetingNotificationSummary[] = [];
  const recentBookings: MeetingNotificationSummary[] = [];

  events.forEach((event, index) => {
    const eventId = getEventIdentifier(event, index);
    if (!eventId) {
      return;
    }

    updatedIds.add(eventId);

    const meetingDate = parseMeetingDateFromString(event.meetingWhen);
    if (meetingDate) {
      const diff = meetingDate.getTime() - now;
      if (diff >= 0 && diff <= UPCOMING_WINDOW_MS) {
        startingSoon.push(formatNotificationSummary(event, eventId, meetingDate));
      }
    }

    if (!seenIds.has(eventId)) {
      const createdAtMs =
        convertFirestoreTimestampToMs((event as any).createdAt) ??
        convertFirestoreTimestampToMs((event as any).timestamp);
      const referenceTime = createdAtMs ?? meetingDate?.getTime();
      if (referenceTime && referenceTime <= now && now - referenceTime <= UPCOMING_WINDOW_MS) {
        recentBookings.push(formatNotificationSummary(event, eventId, meetingDate || undefined));
      }
    }
  });

  try {
    await AsyncStorage.setItem(MEETING_NOTIFICATION_SEEN_KEY, JSON.stringify(Array.from(updatedIds)));
  } catch (error) {
    console.error('Unable to persist meeting notification cache:', error);
  }

  return {
    startingSoon,
    recentBookings: hasStoredIds ? recentBookings : [],
  };
};
// Utility functions for time formatting
const calculateEndTime = (startTime: string, duration: number) => {
  try {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error calculating end time:', error);
    return 'Invalid time';
  }
};

const renderEventTime = (dateStr: string) => {
  try {
    const fixedDateStr = dateStr.replace(' at at ', ' at ');
    const [, timeStr] = fixedDateStr.split(' at ');
    return timeStr.split(' ')[0]; // Returns just the time part
  } catch (error) {
    console.error('Error rendering time:', error);
    return 'Invalid time';
  }
};

interface NoteModalProps {
  visible: boolean;
  selectedContact: Contact | null;
  selectedTime: string;
  eventNote: string;
  meetingDetails: MeetingDetails;
  onChangeNote: (text: string) => void;
  onChangeMeetingDetails: (details: Partial<MeetingDetails>) => void;
  onBack: () => void;
  onSave: () => void;
  onRequestClose: () => void;
  isLoading: boolean;
  contacts: Contact[];
  userInfo: {
    name: string;
    surname: string;
    email: string;
  } | null;
}

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

interface DeleteModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

interface ContactsModalProps {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSelectContacts: (contacts: Contact[]) => void;
}

const LocationInput = ({ value, onChange }: { 
  value: string; 
  onChange: (location: string) => void;
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAndroidSuggestions, setShowAndroidSuggestions] = useState(false);
  
  // Common meeting locations
  const commonLocations = [
    "Virtual Meeting",
    "Phone Call",
    "Office - Meeting Room 1",
    "Office - Meeting Room 2",
    "Office - Conference Room A",
    "Office - Conference Room B",
    "Office - Boardroom",
    "Office - Break Room",
    "Office - Executive Suite",
    "Office - Open Area",
    "Office - Huddle Space",
    "Office - Quiet Room",
    "Office - Innovation Lab",
    "Office - Client Meeting Room",
    "Office - Presentation Room",
    "Office - Training Room",
    "Office - Cafeteria",
    "Office - Lobby",
    "Office - Rooftop Terrace",
    "Office - Workshop Area",
    "Coffee Shop",
    "Restaurant",
    "Hotel Lobby",
    "Client Office",
    "Co-working Space",
    "Business Center",
    "Conference Center",
    "Airport Lounge",
    "Library",
    "Outdoor - Park",
    "Outdoor - Patio",
    "Exhibition Hall",
    "Training Center"
  ];

  const getSuggestions = (text: string) => {
    if (!text) return [];
    const filtered = commonLocations.filter(location => 
      location.toLowerCase().includes(text.toLowerCase())
    );
    return filtered;
  };

  const handleTextChange = (text: string) => {
    onChange(text);
    const newSuggestions = getSuggestions(text);
    setSuggestions(newSuggestions);
    if (Platform.OS === 'android') {
      setShowAndroidSuggestions(newSuggestions.length > 0);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setSuggestions([]);
    if (Platform.OS === 'android') {
      setShowAndroidSuggestions(false);
    }
  };

  // Render iOS suggestions inline
  const renderIOSSuggestions = () => {
    if (Platform.OS !== 'ios' || suggestions.length === 0) return null;
    
    return (
      <View style={styles.suggestionsContainer}>
        <ScrollView 
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          style={styles.suggestionsScrollView}
          contentContainerStyle={styles.suggestionsContentContainer}
          showsVerticalScrollIndicator={true}
          bounces={false}
          overScrollMode="never"
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(suggestion)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.locationInputContainer}>
      <TextInput
        style={styles.textInput}
        placeholder="Add meeting location..."
        value={value}
        onChangeText={handleTextChange}
        onFocus={() => {
          if (Platform.OS === 'android' && suggestions.length > 0) {
            setShowAndroidSuggestions(true);
          }
        }}
      />
      
      {/* iOS inline suggestions */}
      {renderIOSSuggestions()}
      
      {/* Android modal suggestions */}
      {Platform.OS === 'android' && (
        <Modal
          visible={showAndroidSuggestions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAndroidSuggestions(false)}
        >
          <TouchableOpacity 
            style={styles.androidSuggestionsOverlay}
            activeOpacity={1}
            onPress={() => setShowAndroidSuggestions(false)}
          >
            <View style={styles.androidSuggestionsContainer}>
              <FlatList
                data={suggestions}
                keyboardShouldPersistTaps="always"
                keyExtractor={(_, index) => `suggestion-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Text style={styles.suggestionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const NoteModal = ({ 
  visible, 
  selectedContact, 
  selectedTime, 
  eventNote, 
  meetingDetails,
  onChangeNote,
  onChangeMeetingDetails,
  onBack, 
  onSave,
  onRequestClose,
  isLoading,
  contacts,
  userInfo
}: NoteModalProps) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedAttendees, setSelectedAttendees] = useState<Contact[]>(meetingDetails.attendees || []);
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);

  // Debug logging
  console.log('📝 NoteModal rendered with:', {
    visible,
    selectedContact: selectedContact?.name,
    selectedTime,
    meetingDetails,
    attendeesCount: meetingDetails.attendees?.length || 0
  });

  // Calculate end time based on duration
  useEffect(() => {
    if (selectedContact && !selectedAttendees.some(a => a.id === selectedContact.id)) {
      setSelectedAttendees([selectedContact]);
    }
  }, [selectedContact]);

  useEffect(() => {
    setSelectedAttendees(meetingDetails.attendees || []);
  }, [meetingDetails.attendees]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onRequestClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'formSheet'}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.modalContainer}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.modalScrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Meeting Details</Text>
              
              {/* Meeting Title */}
              <Text style={styles.inputLabel}>Meeting Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter meeting title..."
                value={meetingDetails.title}
                onChangeText={(text) => onChangeMeetingDetails({ title: text })}
              />

              {/* Update Meeting Organizer Section */}
              <View style={styles.contactInfoContainer}>
                <Text style={styles.contactInfoLabel}>Meeting Organizer:</Text>
                <Text style={styles.contactInfoText}>
                  {userInfo ? `${userInfo.name} ${userInfo.surname}` : 'You'}
                </Text>
                <Text style={styles.contactEmail}>{userInfo?.email}</Text>
              </View>

              {/* Attendees Section */}
              <Text style={styles.inputLabel}>Attendees</Text>
              <View style={styles.attendeesContainer}>
                {selectedAttendees.length > 0 ? (
                  selectedAttendees.map((attendee, index) => (
                    <View key={index} style={styles.attendeeChip}>
                      <View style={styles.attendeeInfo}>
                        <View style={styles.attendeeNameContainer}>
                          <Text style={styles.attendeeName}>
                            {attendee.name} {attendee.surname}
                          </Text>
                          {index === 0 && (
                            <View style={styles.organizerBadge}>
                              <Text style={styles.organizerBadgeText}>Organizer</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.attendeeEmail}>{attendee.email}</Text>
                      </View>
                      {index > 0 && (
                        <TouchableOpacity
                          style={styles.removeAttendeeButton}
                          onPress={() => {
                            setSelectedAttendees(selectedAttendees.filter(a => a.email !== attendee.email));
                          }}
                        >
                          <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noAttendeesText}>No attendees added yet</Text>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.addAttendeeButton}
                onPress={() => setShowAttendeePicker(true)}
              >
                <Text style={styles.addAttendeeText}>+ Add Attendee</Text>
              </TouchableOpacity>

              {/* Time Section with Start and End Time */}
              <View style={styles.timeContainer}>
                <View style={styles.timeRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>Start Time</Text>
                    <Text style={styles.timeValue}>{selectedTime}</Text>
                  </View>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>End Time</Text>
                    <Text style={styles.timeValue}>
                      {calculateEndTime(selectedTime, meetingDetails.duration)}
                    </Text>
                  </View>
                </View>
                
                {/* Duration Selector */}
                <View style={styles.durationSelector}>
                  <Text style={styles.timeLabel}>Duration:</Text>
                  <View style={styles.durationButtonsContainer}>
                    {[30, 45, 60, 90].map((mins) => (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.durationButton,
                          meetingDetails.duration === mins && styles.durationButtonActive
                        ]}
                        onPress={() => onChangeMeetingDetails({ duration: mins })}
                      >
                        <Text style={[
                          styles.durationButtonText,
                          meetingDetails.duration === mins && styles.durationButtonTextActive
                        ]}>
                          {mins} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Location with Autocomplete */}
              <Text style={styles.inputLabel}>Location (optional)</Text>
              <LocationInput
                value={meetingDetails.location}
                onChange={(location) => onChangeMeetingDetails({ location })}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add meeting notes..."
                multiline
                value={eventNote}
                onChangeText={onChangeNote}
                textAlignVertical="top"
              />

              {/* Buttons */}
              <View style={styles.noteButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.noteButton, styles.backButton]}
                  onPress={() => {
                    setSelectedAttendees([]);
                    onBack();
                  }}
                  disabled={isLoading}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.noteButton, styles.saveButton]}
                  onPress={onSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create Meeting</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Update Attendee Picker Modal */}
      <Modal
        visible={showAttendeePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAttendeePicker(false)}
      >
        <View style={styles.modalWrapper}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Attendees</Text>
              <TouchableOpacity onPress={() => setShowAttendeePicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.contactsList}>
              {contacts.map((contact, index) => {
                const isSelected = selectedAttendees.some(a => a.email === contact.email);
                return (
                  <TouchableOpacity
                    key={`contact-${index}`}
                    style={[
                      styles.contactItem,
                      isSelected && styles.contactItemSelected
                    ]}
                    onPress={() => {
                      setSelectedAttendees(prev => {
                        const isAlreadySelected = prev.some(a => a.id === contact.id);
                        if (isAlreadySelected) {
                          return prev.filter(a => a.id !== contact.id);
                        }
                        return [...prev, contact];
                      });
                    }}
                  >
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>
                        {contact.name} {contact.surname}
                      </Text>
                      <Text style={styles.contactEmail}>{contact.email}</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons 
                        name="check-circle" 
                        size={24} 
                        color={COLORS.primary} 
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowAttendeePicker(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => setShowAttendeePicker(false)}
              >
                <Text style={styles.modalButtonText}>
                  Add {selectedAttendees.length > 0 ? `(${selectedAttendees.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const SuccessModal = ({ visible, onClose }: SuccessModalProps) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
    presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'fullScreen'}
  >
    <View style={styles.modalContainer}>
      <View style={styles.successModalContent}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Meeting Created!</Text>
        <TouchableOpacity style={styles.successButton} onPress={onClose}>
          <Text style={styles.successButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const DeleteConfirmationModal = ({ visible, onClose, onConfirm, isLoading }: DeleteModalProps) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Delete Meeting</Text>
        <Text style={styles.modalMessage}>Are you sure you want to delete this meeting?</Text>
        <View style={styles.modalButtonsContainer}>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonCancel]}
            onPress={onClose}
            disabled={isLoading}
          >
            <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonConfirm]}
            onPress={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.modalButtonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const ErrorModal = ({ visible, message, onClose }: { 
  visible: boolean; 
  message: string; 
  onClose: () => void;
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="fade"
  >
    <View style={styles.modalContainer}>
      <View style={styles.errorModalContent}>
        <MaterialCommunityIcons name="alert-circle" size={50} color={COLORS.error} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{message}</Text>
        <TouchableOpacity 
          style={styles.errorButton}
          onPress={onClose}
        >
          <Text style={styles.errorButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

interface EditMeetingModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedData: any) => void;
  isLoading: boolean;
  event: Event | null;
  userInfo: { name: string; surname: string; email: string } | null;
  contacts: Contact[];
}

const EditMeetingModal = ({ 
  visible, 
  onClose, 
  onSave, 
  isLoading, 
  event,
  userInfo,
  contacts
}: EditMeetingModalProps) => {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [duration, setDuration] = useState(event?.duration || 30);
  const [selectedAttendees, setSelectedAttendees] = useState<Contact[]>([]);
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setLocation(event.location || '');
      setDuration(event.duration || 30);
      setSelectedAttendees(event.attendees || []);
    }
  }, [event]);

  const handleSave = () => {
    if (!event) return;
    
    const updatedData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      duration: duration,
      attendees: selectedAttendees.map(attendee => ({
        name: attendee.name,
        email: attendee.email || 'no-email@example.com'
      }))
    };
    
    onSave(updatedData);
  };

  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="formSheet"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.modalContainer}>
          <ScrollView 
            style={styles.modalScrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Meeting</Text>
              
              {/* Meeting Title */}
              <Text style={styles.inputLabel}>Meeting Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter meeting title..."
                value={title}
                onChangeText={setTitle}
              />

              {/* Meeting Organizer Section */}
              <View style={styles.contactInfoContainer}>
                <Text style={styles.contactInfoLabel}>Meeting Organizer:</Text>
                <Text style={styles.contactInfoText}>
                  {userInfo ? `${userInfo.name} ${userInfo.surname}` : 'You'}
                </Text>
                <Text style={styles.contactEmail}>{userInfo?.email}</Text>
              </View>

              {/* Attendees Section */}
              <Text style={styles.inputLabel}>Attendees</Text>
              <View style={styles.attendeesContainer}>
                {selectedAttendees.length > 0 ? (
                  selectedAttendees.map((attendee, index) => (
                    <View key={index} style={styles.attendeeChip}>
                      <View style={styles.attendeeInfo}>
                        <View style={styles.attendeeNameContainer}>
                          <Text style={styles.attendeeName}>
                            {attendee.name} {attendee.surname}
                          </Text>
                          {index === 0 && (
                            <View style={styles.organizerBadge}>
                              <Text style={styles.organizerBadgeText}>Organizer</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.attendeeEmail}>{attendee.email}</Text>
                      </View>
                      {index > 0 && (
                        <TouchableOpacity
                          style={styles.removeAttendeeButton}
                          onPress={() => {
                            setSelectedAttendees(selectedAttendees.filter(a => a.email !== attendee.email));
                          }}
                        >
                          <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noAttendeesText}>No attendees added yet</Text>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.addAttendeeButton}
                onPress={() => setShowAttendeePicker(true)}
              >
                <Text style={styles.addAttendeeText}>+ Add Attendee</Text>
              </TouchableOpacity>

              {/* Time Section with Start and End Time */}
              <View style={styles.timeContainer}>
                <View style={styles.timeRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>Start Time</Text>
                    <Text style={styles.timeValue}>
                      {renderEventTime(event.meetingWhen)}
                    </Text>
                  </View>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>End Time</Text>
                    <Text style={styles.timeValue}>
                      {calculateEndTime(renderEventTime(event.meetingWhen), duration)}
                    </Text>
                  </View>
                </View>
                
                {/* Duration Selector */}
                <View style={styles.durationSelector}>
                  <Text style={styles.timeLabel}>Duration:</Text>
                  <View style={styles.durationButtonsContainer}>
                    {[30, 45, 60, 90].map((mins) => (
                      <TouchableOpacity
                        key={mins}
                        style={[
                          styles.durationButton,
                          duration === mins && styles.durationButtonActive
                        ]}
                        onPress={() => setDuration(mins)}
                      >
                        <Text style={[
                          styles.durationButtonText,
                          duration === mins && styles.durationButtonTextActive
                        ]}>
                          {mins} min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Location with Autocomplete */}
              <Text style={styles.inputLabel}>Location (optional)</Text>
              <LocationInput
                value={location}
                onChange={setLocation}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add meeting notes..."
                multiline
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />

              {/* Buttons */}
              <View style={styles.noteButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.noteButton, styles.backButton]}
                  onPress={onClose}
                  disabled={isLoading}
                >
                  <Text style={styles.backButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.noteButton, styles.saveButton]}
                  onPress={handleSave}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Attendee Picker Modal */}
      <Modal
        visible={showAttendeePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAttendeePicker(false)}
      >
        <View style={styles.modalWrapper}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Attendees</Text>
              <TouchableOpacity onPress={() => setShowAttendeePicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.contactsList}>
              {/* Filter out current attendees and the organizer */}
              {contacts
                .filter(contact => 
                  contact.email !== userInfo?.email && 
                  !selectedAttendees.some(attendee => attendee.email === contact.email)
                )
                .map((contact, index) => {
                const isSelected = selectedAttendees.some(a => a.email === contact.email);
                return (
                  <TouchableOpacity
                    key={`contact-${index}`}
                    style={[
                      styles.contactItem,
                      isSelected && styles.contactItemSelected
                    ]}
                    onPress={() => {
                      setSelectedAttendees(prev => {
                        const isAlreadySelected = prev.some(a => a.email === contact.email);
                        if (isAlreadySelected) {
                          return prev.filter(a => a.email !== contact.email);
                        } else {
                          return [...prev, contact];
                        }
                      });
                    }}
                  >
                    <View style={styles.contactItemContent}>
                      <View style={styles.contactItemInfo}>
                        <Text style={styles.contactItemName}>
                          {contact.name} {contact.surname}
                        </Text>
                        <Text style={styles.contactItemEmail}>{contact.email}</Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.contactPickerButtons}>
              <TouchableOpacity
                style={[styles.contactPickerButton, styles.contactPickerCancelButton]}
                onPress={() => setShowAttendeePicker(false)}
              >
                <Text style={styles.contactPickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactPickerButton, styles.contactPickerConfirmButton]}
                onPress={() => setShowAttendeePicker(false)}
              >
                <Text style={styles.contactPickerConfirmText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

interface MeetingActionsMenuProps {
  visible: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const MeetingActionsMenu = ({ visible, onEdit, onDelete }: MeetingActionsMenuProps) => {
  const animatedScale = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(animatedScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(animatedScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.menuDropdown,
        {
          transform: [{ scale: animatedScale }],
          opacity: animatedOpacity,
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={onEdit}
      >
        <Ionicons name="pencil" size={16} color={COLORS.primary} />
        <Text style={styles.menuItemText}>Edit</Text>
      </TouchableOpacity>
      
      <View style={styles.menuSeparator} />
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={onDelete}
      >
        <Ionicons name="trash" size={16} color={COLORS.error} />
        <Text style={[styles.menuItemText, { color: COLORS.error }]}>Delete</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ContactsModal = ({ visible, onClose, contacts, onSelectContacts }: ContactsModalProps) => {
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [showError, setShowError] = useState(false);

  // Debug logging
  console.log('📱 ContactsModal rendered with:', {
    visible,
    contactsCount: contacts?.length || 0,
    selectedContactsCount: selectedContacts.length
  });

  // Reset selected contacts when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setSelectedContacts([]);
      setShowError(false);
    }
  }, [visible]);

  const handleContactPress = (contact: Contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      }
      return [...prev, contact];
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'pageSheet'}
        statusBarTranslucent={false}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contacts</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.contactsList}>
              {contacts.length === 0 ? (
                <View style={styles.emptyContactsContainer}>
                  <Text style={styles.emptyContactsText}>No contacts found</Text>
                  <Text style={styles.emptyContactsSubtext}>
                    You need to have contacts saved to create meetings
                  </Text>
                </View>
              ) : (
                contacts.map((contact, index) => {
                  const isSelected = selectedContacts.some(c => c.id === contact.id);
                  return (
                    <TouchableOpacity
                      key={`contact-${index}`}
                      style={[
                        styles.contactItem,
                        isSelected && styles.contactItemSelected
                      ]}
                      onPress={() => handleContactPress(contact)}
                    >
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>
                          {contact.name} {contact.surname}
                        </Text>
                        <Text style={styles.contactEmail}>{contact.email}</Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={24} 
                          color={COLORS.primary} 
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setSelectedContacts([]);
                  onClose();
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  if (selectedContacts.length === 0) {
                    setShowError(true);
                    return;
                  }
                  // Pass the selected contacts and close modal
                  onSelectContacts(selectedContacts);
                  // Reset after a brief delay to ensure the callback processes first
                  setTimeout(() => {
                    setSelectedContacts([]);
                  }, 100);
                }}
              >
                <Text style={styles.modalButtonText}>
                  Add {selectedContacts.length > 0 ? `(${selectedContacts.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ErrorModal
        visible={showError}
        message="Please select at least one contact"
        onClose={() => setShowError(false)}
      />
    </>
  );
};

// Add helper function to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Add helper function to check if a time is in the past for today
const isTimeInPast = (timeString: string) => {
  const now = new Date();
  const [hours, minutes] = timeString.split(':').map(Number);
  
  const selectedTime = new Date();
  selectedTime.setHours(hours, minutes, 0, 0);
  
  return selectedTime <= now;
};

// Add helper function to check if date with time is in the past
const isDateTimeInPast = (dateString: string, timeString: string) => {
  const today = getTodayDateString();
  
  if (dateString < today) {
    return true;
  }
  
  if (dateString === today) {
    return isTimeInPast(timeString);
  }
  
  return false;
};

export default function Calendar() {
  const [selectedYear, setSelectedYear] = useState('2024');
  const todayString = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isContactsModalVisible, setIsContactsModalVisible] = useState(false);
  const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [eventNote, setEventNote] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('Loading...');
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const [pendingNoteModal, setPendingNoteModal] = useState(false);
  const [pendingSuccessModal, setPendingSuccessModal] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingMeetingIndex, setEditingMeetingIndex] = useState<number | null>(null);
  const [isUpdatingMeeting, setIsUpdatingMeeting] = useState(false);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const [expandedMenuIndex, setExpandedMenuIndex] = useState<number | null>(null);
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const { updateNotifications } = useMeetingNotifications();
  const toast = useToast();
  const [userInfo, setUserInfo] = useState<{ name: string; surname: string; email: string } | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  // Helper function to detect if location looks like an address or URL
  const isAddressLike = (location: string): boolean => {
    if (!location || location.trim().length === 0) return false;
    
    // Check if it's a URL
    if (location.startsWith('http://') || location.startsWith('https://')) {
      return true;
    }
    
    // Check for common address patterns (street numbers, common words)
    const addressPatterns = /\d+\s+[A-Za-z]|street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|lane|ln|place|pl|circle|cir|court|ct|terrace|ter/i;
    return addressPatterns.test(location) && location.length > 10;
  };

  // Function to open location in maps or browser
  const openLocationInMaps = async (location: string) => {
    try {
      let url: string;
      
      // If it's a URL, open in browser
      if (location.startsWith('http://') || location.startsWith('https://')) {
        url = location;
      } else {
        // Otherwise, open in maps (Google Maps works on both iOS and Android)
        // iOS will offer to open in Apple Maps if available
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
      }
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open location');
      }
    } catch (error) {
      console.error('Error opening location:', error);
      Alert.alert('Error', 'Unable to open location');
    }
  };

  // Safety function to reset all modal states
  const resetAllModals = () => {
    console.log('🔄 Resetting all modal states');
    setIsTimeModalVisible(false);
    setIsContactsModalVisible(false);
    setIsNoteModalVisible(false);
    setIsTransitioning(false);
    setTransitionMessage('Loading...');
    setPendingNoteModal(false);
    setIsEditModalVisible(false);
    setEditingMeetingIndex(null);
    setIsUpdatingMeeting(false);
    setIsDeletingMeeting(false);
    setExpandedMenuIndex(null);
    setIsModalTransitioning(false);
    loadingOpacity.setValue(0);
  };
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails>({
    title: '',
    duration: 30,
    location: '',
    attendees: [],
    startTime: '',
    endTime: '',  });
  const [showOnlyPublic, setShowOnlyPublic] = useState(false);
  
  // Load user ID
  const loadUserId = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        const extractedUserId = parsed.id || parsed.uid;
        setUserId(extractedUserId);
      }
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  };

  // Get calendar link for sharing
  const getCalendarLink = (): string => {
    if (!userId) return '';
    return `${API_BASE_URL}/public/calendar/${userId}.html`;
  };

  // Share calendar link - opens modal
  const shareCalendarLink = () => {
    const link = getCalendarLink();
    if (!link) {
      Alert.alert('Error', 'Unable to generate calendar link');
      return;
    }
    setIsShareModalVisible(true);
  };

  // Share options array (same as CalendarPreferencesScreen)
  const shareOptions: ShareOption[] = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: 'whatsapp',
      color: '#25D366',
      action: async () => {
        const link = getCalendarLink();
        if (!link) {
          Alert.alert('Error', 'Unable to generate calendar link');
          return;
        }
        const message = `Schedule a meeting with me: ${link}`;
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() => {
          Alert.alert('Error', 'WhatsApp is not installed on your device');
        });
      }
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: 'send',
      color: '#0088cc',
      action: async () => {
        const link = getCalendarLink();
        if (!link) {
          Alert.alert('Error', 'Unable to generate calendar link');
          return;
        }
        const message = `Schedule a meeting with me: ${link}`;
        Linking.openURL(`tg://msg?text=${encodeURIComponent(message)}`).catch(() => {
          Alert.alert('Error', 'Telegram is not installed on your device');
        });
      }
    },
    {
      id: 'email',
      name: 'Email',
      icon: 'email',
      color: '#EA4335',
      action: async () => {
        const link = getCalendarLink();
        if (!link) {
          Alert.alert('Error', 'Unable to generate calendar link');
          return;
        }
        const message = `Hello,\n\nSchedule a meeting with me using this link: ${link}\n\nBest regards`;
        const emailUrl = `mailto:?subject=${encodeURIComponent('Book a Meeting')}&body=${encodeURIComponent(message)}`;
        Linking.openURL(emailUrl).catch(() => {
          Alert.alert('Error', 'Could not open email client');
        });
      }
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: 'linkedin',
      color: '#0077B5',
      action: async () => {
        const link = getCalendarLink();
        if (!link) {
          Alert.alert('Error', 'Unable to generate calendar link');
          return;
        }
        const message = `Schedule a meeting with me!`;
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}&summary=${encodeURIComponent(message)}`;
        Linking.openURL(linkedinUrl).catch(() => {
          Alert.alert('Error', 'Could not open LinkedIn');
        });
      }
    },
    {
      id: 'copy',
      name: 'Copy link',
      icon: 'content-copy',
      color: '#6B7280',
      action: async () => {
        await copyCalendarLink();
      }
    }
  ];

  const handlePlatformSelect = (platform: string) => {
    const selectedOption = shareOptions.find(opt => opt.id === platform);
    if (selectedOption) {
      selectedOption.action();
      setIsShareModalVisible(false);
    }
  };

  const copyCalendarLink = async () => {
    const link = getCalendarLink();
    if (!link) {
      Alert.alert('Error', 'Unable to generate calendar link');
      return;
    }

    Clipboard.setString(link);
    Alert.alert('Copied!', 'Calendar link copied to clipboard');
  };
  
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00',
    '17:00', '18:00'
  ];

  const loadContacts = async () => {
    try {
      console.log('🔄 Starting loadContacts...');
      const userId = await getUserId();
      if (!userId) {
        console.log('❌ No userId found');
        return;
      }

      console.log('📞 Fetching contacts with userId:', userId);
      const contactsResponse = await authenticatedFetchWithRefresh(ENDPOINTS.GET_CONTACTS + `/${userId}`);
      console.log('📡 Contacts response status:', contactsResponse.status);
      
      const data = await contactsResponse.json();
      console.log('📋 Raw contacts data:', data);

      if (data && Array.isArray(data.contactList)) {
        const contactsWithIds = data.contactList.map((contact: Contact, index: number) => ({
          ...contact,
          id: contact.id || `contact-${index}`
        }));
        console.log('✅ Setting contacts:', contactsWithIds.length, 'contacts found');
        setContacts(contactsWithIds);
      } else {
        console.log('⚠️ Invalid contacts data format:', data);
        setContacts([]);
      }
    } catch (error) {
      console.error('❌ Error in loadContacts:', error);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (isContactsModalVisible) {
      loadContacts();
    }
  }, [isContactsModalVisible]);

  // Handle pending note modal when contacts modal is closed
  useEffect(() => {
    if (pendingNoteModal && !isContactsModalVisible) {
      console.log('🗒️ Opening note modal from pending state');
      setPendingNoteModal(false);
      setIsTransitioning(false);
      
      // Add delay to ensure contacts modal is fully dismissed
      setTimeout(() => {
        console.log('🗒️ Contacts modal fully dismissed, opening note modal');
        setIsNoteModalVisible(true);
      }, Platform.OS === 'ios' ? 500 : 100);
    }
  }, [pendingNoteModal, isContactsModalVisible]);

  // Handle pending success modal when note modal is closed
  useEffect(() => {
    if (pendingSuccessModal && !isNoteModalVisible) {
      console.log('🎉 Opening success modal from pending state');
      setPendingSuccessModal(false);
      setIsModalTransitioning(false);
      
      // Add delay to ensure note modal is fully dismissed
      setTimeout(() => {
        console.log('🎉 Note modal fully dismissed, opening success modal');
        setShowSuccessModal(true);
      }, Platform.OS === 'ios' ? 500 : 100);
    }
  }, [pendingSuccessModal, isNoteModalVisible]);

  const loadEvents = async () => {
    try {
      setIsLoadingEvents(true);
      const userId = await getUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      const eventsResponse = await authenticatedFetchWithRefresh(`/meetings/${userId}`);
      const data = await eventsResponse.json();
      
      console.log('Meetings response:', JSON.stringify(data, null, 2));

      if (data.success && data.data.meetings) {
        setEvents(data.data.meetings);
        
        const marks: MarkedDates = {};
        data.data.meetings.forEach((event: Event) => {
          try {
            // Skip if meetingWhen is not a string
            if (!event.meetingWhen || typeof event.meetingWhen !== 'string') {
              console.warn('Invalid meetingWhen:', event.meetingWhen);
              return;
            }
            
            const dateStr = event.meetingWhen.replace(' at at ', ' at ');
            console.log('Processing fixed date:', dateStr);
            
            // Parse the date parts
            const dateParts = dateStr.split(' at ')[0].split(' ');
            if (dateParts.length !== 3) {
              console.warn('Invalid date format:', dateStr);
              return;
            }
            
            const [monthStr, day, year] = dateParts;
            
            // Get month number from our mapping
            const month = MONTH_MAP[monthStr];
            if (!month) {
              console.warn('Invalid month:', monthStr);
              return;
            }
            
            // Format the date in YYYY-MM-DD format
            const formattedDate = `${year}-${month}-${day.padStart(2, '0')}`;
            console.log('Formatted date:', formattedDate);
            
            marks[formattedDate] = { marked: true, dotColor: '#FF69B4' };
          } catch (error) {
            console.error('Error parsing date:', error, event.meetingWhen);
          }
        });
        setMarkedDates(marks);

        try {
          const notificationSummary = await buildNotificationSummaries(data.data.meetings);
          updateNotifications(notificationSummary);
        } catch (notificationError) {
          console.error('Error deriving meeting notifications:', notificationError);
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    fetchUserInfo();
    loadEvents();
    loadUserId();
  }, []);




  const fetchUserInfo = async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        console.error('No user ID found for fetching user info');
        return;
      }
      
      console.log('Fetching user card info for user ID:', userId);
      const userInfoResponse = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_CARD}/${userId}`);
      
      if (!userInfoResponse.ok) {
        console.error('Failed to fetch user card info');
        return;
      }
      
      const responseData = await userInfoResponse.json();
      console.log('User cards response data:', responseData);
      
      // Handle new response structure
      let cardsArray;
      
      if (responseData.cards) {
        // New structure: { cards: [...], analytics: {...} }
        cardsArray = responseData.cards;
      } else if (Array.isArray(responseData)) {
        // Fallback for old structure: [card1, card2, ...]
        cardsArray = responseData;
        console.log('Using fallback for old API response structure in Calendar');
      } else {
        console.error('Unexpected API response structure:', responseData);
        return;
      }
      
      if (cardsArray && cardsArray.length > 0) {
        // Use the default card (first card)
        const defaultCard = cardsArray[0];
        setUserInfo({
          name: defaultCard.name || '',
          surname: defaultCard.surname || '',
          email: defaultCard.email || 'contact@xscard.com'
        });
        
        console.log('Set user info from card:', {
          name: defaultCard.name,
          surname: defaultCard.surname,
          email: defaultCard.email
        });
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const handleSaveEvent = async () => {
    if (isCreatingMeeting) return;
    
    try {
      setIsCreatingMeeting(true);

      if (!selectedDate || !selectedTime || meetingDetails.attendees.length === 0) {
        Alert.alert('Error', 'Please select date, time and at least one attendee');
        return;
      }
      
      // Check if the selected date and time are in the past
      if (isDateTimeInPast(selectedDate, selectedTime)) {
        Alert.alert('Error', 'Cannot create meetings in the past. Please select a future date and time.');
        setIsCreatingMeeting(false);
        return;
      }

      const [hour, minute] = selectedTime.split(':');
      const startDateTime = new Date(selectedDate + 'T' + `${hour}:${minute}:00`);
      
      // Calculate end time based on duration
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + meetingDetails.duration);

      const meetingData = {
        title: meetingDetails.title || `Meeting with ${meetingDetails.attendees[0].name}`,
        description: eventNote,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        location: meetingDetails.location || "Virtual Meeting",
        duration: meetingDetails.duration, // Explicitly pass duration in minutes
        attendees: meetingDetails.attendees.map(attendee => ({
          name: `${attendee.name} ${attendee.surname}`.trim(),
          email: attendee.email || 'no-email@example.com'
        })),
        organizer: {
          name: userInfo?.name ? `${userInfo.name} ${userInfo.surname}`.trim() : "XS Card User",
          email: userInfo?.email || "contact@xscard.com"
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      console.log('Sending meeting data:', meetingData);

      if (Platform.OS === 'ios') {
        // iOS-specific: Complete modal isolation approach
        console.log('🍎 iOS: Starting complete modal isolation...');
        
        // Step 1: Set transition flag to prevent modal conflicts
        setIsModalTransitioning(true);
        setIsCreatingMeeting(false);
        
        // Step 2: Completely close and reset note modal
        console.log('🍎 iOS: Completely closing note modal...');
        setIsNoteModalVisible(false);
        setSelectedContact(null);
        setEventNote('');
        setSelectedDate('');
        setSelectedTime('');
        
        // Step 3: Set pending success modal (useEffect will handle the transition)
        console.log('🍎 iOS: Setting pending success modal');
        setPendingSuccessModal(true);
        console.log('🍎 iOS: Pending success modal set, waiting for useEffect to trigger');
        
        // Handle API calls in background after a delay
        setTimeout(async () => {
          try {
            console.log('🍎 iOS: Starting background API calls...');
            
            // First try to send invitation
            const inviteResponse = await authenticatedFetchWithRefresh(ENDPOINTS.MEETING_INVITE, {
              method: 'POST',
              body: JSON.stringify(meetingData)
            });
            
            let inviteResult;
            try {
              inviteResult = await inviteResponse.json();
              console.log('Invite response:', inviteResult);
            } catch (jsonError) {
              console.error('Error parsing invite response:', jsonError);
            }
            
            if (!inviteResponse.ok) {
              console.warn("Failed to send invitation, falling back to regular meeting creation");
              
              const fallbackMeeting = {
                meetingWith: selectedContact ? `${selectedContact.name} ${selectedContact.surname}`.trim() : '',
                meetingWhen: startDateTime.toISOString(),
                description: eventNote || ''
              };
              
              const fallbackResponse = await authenticatedFetchWithRefresh(ENDPOINTS.CREATE_MEETING, {
                method: 'POST',
                body: JSON.stringify(fallbackMeeting)
              });
              
              if (!fallbackResponse.ok) {
                console.error('Both invite and fallback creation failed');
                return;
              }
            }

            // Reload events after successful creation
            await loadEvents();
            console.log('🍎 iOS: Background API calls completed');
            
          } catch (error) {
            console.error('Error in iOS background meeting creation:', error);
          }
        }, 1000); // Delay for API calls
      } else {
        // Android: Handle normally with API calls first
        console.log('🤖 Android: Normal API flow...');
        
        // First try to send invitation
        const inviteResponse = await authenticatedFetchWithRefresh(ENDPOINTS.MEETING_INVITE, {
          method: 'POST',
          body: JSON.stringify(meetingData)
        });
        
        let inviteResult;
        try {
          inviteResult = await inviteResponse.json();
          console.log('Invite response:', inviteResult);
        } catch (jsonError) {
          console.error('Error parsing invite response:', jsonError);
        }
        
        if (!inviteResponse.ok) {
          console.warn("Failed to send invitation, falling back to regular meeting creation");
          
          const fallbackMeeting = {
            meetingWith: selectedContact ? `${selectedContact.name} ${selectedContact.surname}`.trim() : '',
            meetingWhen: startDateTime.toISOString(),
            description: eventNote || ''
          };
          
          const fallbackResponse = await authenticatedFetchWithRefresh(ENDPOINTS.CREATE_MEETING, {
            method: 'POST',
            body: JSON.stringify(fallbackMeeting)
          });
          
          if (!fallbackResponse.ok) {
            let errorMessage = 'Failed to create meeting';
            try {
              const errorData = await fallbackResponse.json();
              if (errorData && errorData.message) {
                errorMessage = errorData.message;
              }
            } catch (e) {
              console.error('Error parsing error response:', e);
            }
            
            throw new Error(errorMessage);
          }
        }

        // Show success modal after API calls complete (Android)
        setShowSuccessModal(true);
        setIsNoteModalVisible(false);
        setSelectedContact(null);
        setEventNote('');
        setSelectedDate('');
        setSelectedTime('');
        
        // Reload events
        setTimeout(async () => {
          try {
            await loadEvents();
          } catch (error) {
            console.error('Error reloading events:', error);
          }
        }, 100);
      }

    } catch (error: unknown) {
      console.error('Error saving event:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      // Only reset loading state on Android (iOS resets it immediately)
      if (Platform.OS !== 'ios') {
        setIsCreatingMeeting(false);
      }
    }
  };

  const handleDeleteMeeting = async (index: number) => {
    if (isDeletingMeeting) return;
    
    try {
      setIsDeletingMeeting(true);
      const userId = await getUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      console.log('Deleting meeting at index:', index);

      const deleteResponse = await authenticatedFetchWithRefresh(`/meetings/${userId}/${index}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.message || 'Failed to delete meeting');
      }

      // Reload events after deletion
      await loadEvents();
      setIsDeleteModalVisible(false);
      setMeetingToDelete(null);
      setSelectedEventIndex(null);
      setExpandedMenuIndex(null);

      toast.success('Meeting deleted', 'The meeting has been removed.');

    } catch (error) {
      console.error('Error deleting meeting:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to delete meeting');
    } finally {
      setIsDeletingMeeting(false);
    }
  };

  const handleUpdateMeeting = async (meetingIndex: number, updatedData: any) => {
    if (isUpdatingMeeting) return;
    
    try {
      setIsUpdatingMeeting(true);
      const userId = await getUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      console.log('Updating meeting:', { meetingIndex, updatedData });

      const updateResponse = await authenticatedFetchWithRefresh(`/meetings/${userId}/${meetingIndex}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData)
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || 'Failed to update meeting');
      }

      const result = await updateResponse.json();
      console.log('Meeting updated successfully:', result);

      // Reload events to show updated data
      await loadEvents();
      setIsEditModalVisible(false);
      setEditingMeetingIndex(null);

      Alert.alert('Success', 'Meeting updated successfully');

    } catch (error) {
      console.error('Error updating meeting:', error);
      Alert.alert('Error', (error as Error).message || 'Failed to update meeting');
    } finally {
      setIsUpdatingMeeting(false);
    }
  };

  const handleEditMeeting = (index: number) => {
    console.log('Editing meeting at index:', index);
    setEditingMeetingIndex(index);
    setIsEditModalVisible(true);
    setExpandedMenuIndex(null); // Close menu
  };

  const toggleMenu = (index: number) => {
    setExpandedMenuIndex(expandedMenuIndex === index ? null : index);
  };

  const closeMenu = () => {
    setExpandedMenuIndex(null);
  };

const renderEventDate = (dateStr: string) => {
  try {
    const fixedDateStr = dateStr.replace(' at at ', ' at ');
    const [monthStr, day, year] = fixedDateStr.split(' at ')[0].split(' ');
    
    // Return day, abbreviated month, and year
    return `${day} ${monthStr.slice(0, 3).toUpperCase()} ${year}`;
  } catch (error) {
    console.error('Error rendering date:', error);
    return 'Invalid date';
  }
  };

  const handleContactSelect = (selectedContacts: Contact[]) => {
    console.log('📝 handleContactSelect called with:', selectedContacts);
    
    if (selectedContacts.length === 0) {
      console.log('❌ No contacts selected, closing modal');
      setIsContactsModalVisible(false);
      setIsTransitioning(false); // Reset transition state
      return;
    }
    
    console.log('✅ Processing', selectedContacts.length, 'selected contacts');
    
    // Calculate end time based on default duration (30 minutes)
    const endTime = calculateEndTime(selectedTime, 30);
    
    // Create meeting creator contact
    const meetingCreator: Contact = {
      id: userInfo?.email || 'creator',
      name: userInfo?.name || 'Meeting Creator',
      surname: userInfo?.surname || '',
      email: userInfo?.email || '',
      phone: '',
      company: '',
      howWeMet: 'Meeting Organizer',
      isXsCardUser: true,
      createdAt: new Date().toISOString(),
      profileImageUrl: null,
      profileImageUrls: null
    };
    
    // Combine selected contacts with meeting creator
    const allAttendees = [meetingCreator, ...selectedContacts];
    
    // Update both selectedContact and meetingDetails.attendees
    setSelectedContact(selectedContacts[0]);
    setMeetingDetails(prev => ({
      ...prev,
      attendees: allAttendees, // Store all attendees including creator
      startTime: selectedTime,
      endTime: endTime
    }));
    
    console.log('📋 Meeting details updated with', allAttendees.length, 'attendees (including creator), closing contacts modal');
    setIsContactsModalVisible(false);
    setPendingNoteModal(true); // Set flag to open note modal when contacts modal is fully closed
  };

  const renderEventCard = (event: Event, index: number) => (
    <TouchableOpacity 
      key={event.id ? `event-${event.id}-${index}` : `event-${index}`}
      style={[
        styles.eventCard,
        (event as any).source === 'public' && styles.publicEventCard
      ]}
      onPress={() => setSelectedEventIndex(selectedEventIndex === index ? null : index)}
    >
      {selectedEventIndex === index && (
        <View style={styles.eventActionsContainer}>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => toggleMenu(index)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          <MeetingActionsMenu
            visible={expandedMenuIndex === index}
            onEdit={() => handleEditMeeting(index)}
            onDelete={() => {
              setMeetingToDelete(index);
              setIsDeleteModalVisible(true);
            }}
          />
        </View>
      )}
      
      {/* Title and Date */}
      <View style={styles.eventTitleRow}>
        <Text style={styles.eventTitle}>{event.title || `Meeting with ${event.meetingWith}`}</Text>
        {(event as any).source === 'public' && (
          <View style={styles.publicBadge}>
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        )}
      </View>
      <Text style={styles.eventDate}>{renderEventDate(event.meetingWhen)}</Text>

      {/* Time Details */}
      <View style={styles.eventDetailSection}>
        <View style={styles.eventDetailHeader}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
          <Text style={styles.eventDetailTitle}>Time</Text>
        </View>
        <Text style={styles.eventDetailText}>
          {renderEventTime(event.meetingWhen)} - {calculateEndTime(renderEventTime(event.meetingWhen), event.duration)}
        </Text>
        <Text style={styles.eventDuration}>Duration: {event.duration} minutes</Text>
      </View>

      {/* Organizer */}
      <View style={styles.eventDetailSection}>
        <View style={styles.eventDetailHeader}>
          <MaterialCommunityIcons name="account" size={14} color="#666" />
          <Text style={styles.eventDetailTitle}>Organizer</Text>
        </View>
        <Text style={styles.eventDetailText}>{event.meetingWith}</Text>
      </View>

      {/* Location */}
      {event.location && (
        <View style={styles.eventDetailSection}>
          <View style={styles.eventDetailHeader}>
            <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
            <Text style={styles.eventDetailTitle}>Location</Text>
          </View>
          {isAddressLike(event.location) ? (
            <TouchableOpacity onPress={() => openLocationInMaps(event.location)}>
              <View style={styles.locationRow}>
                <Text style={[styles.eventDetailText, styles.clickableLocation]}>{event.location}</Text>
                <MaterialCommunityIcons name="open-in-new" size={16} color={COLORS.primary} style={styles.locationIcon} />
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={styles.eventDetailText}>{event.location}</Text>
          )}
        </View>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <View style={styles.eventDetailSection}>
          <View style={styles.eventDetailHeader}>
            <MaterialCommunityIcons name="account-group" size={14} color="#666" />
            <Text style={styles.eventDetailTitle}>
              Attendees ({event.attendees.length})
            </Text>
          </View>
          {event.attendees.map((attendee, idx) => (
            <Text key={idx} style={styles.eventAttendeeItem}>
              • {attendee.name} {attendee.surname}
            </Text>
          ))}
        </View>
      )}

      {/* Notes */}
      {event.description && (
        <View style={styles.eventDetailSection}>
          <View style={styles.eventDetailHeader}>
            <MaterialCommunityIcons name="text" size={14} color="#666" />
            <Text style={styles.eventDetailTitle}>Notes</Text>
          </View>
          <Text style={styles.eventNote}>{event.description}</Text>
        </View>
      )}

      {/* Booker Information for Public Bookings */}
      {(event as any).source === 'public' && (event as any).bookerInfo && (
        <View style={styles.eventDetailSection}>
          <View style={styles.eventDetailHeader}>
            <MaterialCommunityIcons name="calendar-check" size={14} color="#007AFF" />
            <Text style={[styles.eventDetailTitle, { color: '#007AFF' }]}>Booked via Public Calendar</Text>
          </View>
          <Text style={styles.eventDetailText}>Email: {(event as any).bookerInfo.email}</Text>
          <Text style={styles.eventDetailText}>Phone: {(event as any).bookerInfo.phone}</Text>
          {(event as any).bookerInfo.message && (
            <Text style={styles.eventNote}>Message: {(event as any).bookerInfo.message}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderAndroidEventCard = (event: Event, index: number) => (
    <TouchableOpacity 
      key={event.id ? `event-${event.id}-${index}` : `event-${index}`}
      style={styles.androidEventCard}
      onPress={() => setSelectedEventIndex(selectedEventIndex === index ? null : index)}
    >
      {selectedEventIndex === index && (
        <View style={styles.eventActionsContainer}>
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => toggleMenu(index)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          <MeetingActionsMenu
            visible={expandedMenuIndex === index}
            onEdit={() => handleEditMeeting(index)}
            onDelete={() => {
              setMeetingToDelete(index);
              setIsDeleteModalVisible(true);
            }}
          />
        </View>
      )}
      <Text style={styles.eventTitle}>{event.title || `Meeting with ${event.meetingWith}`}</Text>
      <Text style={styles.eventDate}>{renderEventDate(event.meetingWhen)}</Text>
      <Text style={styles.eventTime}>
        {renderEventTime(event.meetingWhen)} ({event.duration} mins)
      </Text>
      {event.location && (
        <View style={styles.eventLocationContainer}>
          <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
          <Text style={styles.eventLocation}>{event.location}</Text>
        </View>
      )}
      {event.attendees && event.attendees.length > 0 && (
        <View style={styles.eventAttendeesContainer}>
          <MaterialCommunityIcons name="account-group" size={14} color="#666" />
          <Text style={styles.eventAttendees}>
            {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
          </Text>
        </View>
      )}
      {event.description && <Text style={styles.eventNote}>{event.description}</Text>}
    </TouchableOpacity>
  );

  // Note: Removed todayString state update logic since todayString is now a constant
  // The calendar automatically handles date changes through its own state management

  // Filter available time slots for today
  const getAvailableTimeSlots = () => {
    if (selectedDate === todayString) {
      return timeSlots.filter(time => !isTimeInPast(time));
    }
    return timeSlots;
  };

  return (
    <TouchableWithoutFeedback onPress={closeMenu}>
      <View style={styles.container}>
      <AdminHeader title="Calendar" />
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <RNCalendar
          style={styles.calendar}
          minDate={todayString} // Add minimum date to prevent selecting past dates
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#000000',
            selectedDayBackgroundColor: COLORS.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: COLORS.primary,
            dayTextColor: '#2d4150',
            monthTextColor: COLORS.primary,
            textMonthFontSize: 20,
            textMonthFontWeight: 'bold',
          }}
          markedDates={{
            ...markedDates,
            [selectedDate]: { selected: true, selectedColor: COLORS.primary }
          }}
          onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        />

        {/* Schedule Meeting Button */}
        <TouchableOpacity
          style={[
            styles.scheduleMeetingButton,
            styles.scheduleMeetingButtonActive
          ]}
          onPress={() => {
            setIsTimeModalVisible(true);
          }}
        >
          <MaterialCommunityIcons 
            name="calendar-plus" 
            size={20} 
            color={COLORS.white} 
            style={styles.scheduleMeetingIcon}
          />
          <Text style={[
            styles.scheduleMeetingText,
            styles.scheduleMeetingTextActive
          ]}>
            Schedule Meeting
          </Text>
        </TouchableOpacity>

        {/* Share, Filter, and Settings Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={shareCalendarLink}
          >
            <MaterialCommunityIcons 
              name="share-variant" 
              size={18} 
              color={COLORS.primary} 
            />
            <Text style={styles.shareButtonText}>
              Share
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowOnlyPublic(!showOnlyPublic)}
          >
            <MaterialCommunityIcons 
              name="filter" 
              size={18} 
              color={COLORS.primary} 
            />
            <Text style={styles.filterButtonText}>
              {showOnlyPublic ? 'All' : 'Public Only'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={() => {
              const parentNav = navigation.getParent();
              if (parentNav) {
                (parentNav as any).navigate('CalendarPreferences');
              }
            }}
          >
            <Ionicons 
              name="settings" 
              size={18} 
              color={COLORS.primary} 
            />
            <Text style={styles.shareButtonText}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.eventsSection}>
          <View style={styles.eventsSectionHeader}>
            <Text style={styles.upcomingTitle}>
              Upcoming Meetings
            </Text>
          </View>
          {(() => {
            const filteredEvents = showOnlyPublic 
              ? events.filter(e => (e as any).source === 'public') 
              : events;
            return filteredEvents.length > 0 ? (
            Platform.OS === 'ios' ? (
              <View style={styles.eventsWrapper}>
                <ScrollView 
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.eventsScrollView}
                  style={styles.eventsScrollContainer}
                  nestedScrollEnabled={true}
                >
                  {filteredEvents.map((event, index) => renderEventCard(event, index))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.androidEventsWrapper}>
                <ScrollView
                  horizontal={false}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.androidEventsScrollView}
                  style={styles.androidEventsScrollContainer}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.androidEventsGrid}>
                    {filteredEvents.map((event, index) => renderAndroidEventCard(event, index))}
                  </View>
                </ScrollView>
              </View>
            )
          ) : (
              <Text style={styles.emptyEventsMessage}>
                {showOnlyPublic ? 'No public bookings' : 'No meetings scheduled'}
            </Text>
            );
          })()}
        </View>
      </ScrollView>

      <ContactsModal
        visible={isContactsModalVisible}
        onClose={() => {
          console.log('🚪 ContactsModal onClose called');
          setIsContactsModalVisible(false);
          setIsTransitioning(false); // Reset transition state when modal is closed
        }}
        contacts={contacts}
        onSelectContacts={handleContactSelect}
      />

      <Modal
        visible={isTimeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsTimeModalVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent={false}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <ScrollView style={styles.timeList}>
              {getAvailableTimeSlots().map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeItem,
                    selectedTime === time && styles.selectedTimeItem
                  ]}
                  onPress={async () => {
                    if (isTransitioning) return; // Prevent rapid taps
                    
                    setSelectedTime(time);
                    setTransitionMessage('Preparing contact list...');
                    
                    // Close time modal first
                    setIsTimeModalVisible(false);
                    
                    // Show loading overlay after a brief delay
                    setTimeout(() => {
                      setIsTransitioning(true);
                      loadingOpacity.setValue(1); // Set to full opacity immediately
                    }, 100);
                    
                    // Wait for modal to close, then load contacts
                    setTimeout(async () => {
                      try {
                        setTransitionMessage('Loading contacts...');
                        await loadContacts();
                        setIsContactsModalVisible(true);
                      } catch (error) {
                        console.error('Error loading contacts:', error);
                        Alert.alert('Error', 'Failed to load contacts. Please try again.');
                      } finally {
                        // Animate loading modal out
                        Animated.timing(loadingOpacity, {
                          toValue: 0,
                          duration: 150,
                          useNativeDriver: true,
                        }).start(() => {
                          setIsTransitioning(false);
                          setTransitionMessage('Loading...');
                        });
                      }
                    }, Platform.OS === 'ios' ? 300 : 150); // Shorter delay since loading is already visible
                  }}
                >
                  <Text style={[
                    styles.timeText,
                    selectedTime === time && styles.selectedTimeText
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
              {selectedDate === todayString && getAvailableTimeSlots().length < timeSlots.length && (
                <Text style={styles.pastTimeMessage}>Times in the past are not available</Text>
              )}
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setIsTimeModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay for Transition */}
      {isTransitioning && (
        <View style={styles.loadingOverlayContainer}>
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{transitionMessage}</Text>
          </View>
        </View>
      )}

      <NoteModal 
        visible={isNoteModalVisible && !isModalTransitioning}
        selectedContact={selectedContact}
        selectedTime={selectedTime}
        eventNote={eventNote}
        meetingDetails={meetingDetails}
        onChangeNote={setEventNote}
        onChangeMeetingDetails={(details) => 
          setMeetingDetails(prev => ({ ...prev, ...details }))
        }
        onBack={() => {
          console.log('⬅️ Note modal back button pressed');
          setIsNoteModalVisible(false);
          setSelectedContact(null);
          setEventNote('');
          setMeetingDetails({
            title: '',
            duration: 30,
            location: '',
            attendees: [],
            startTime: '',
            endTime: '',
          });
          // Go back to time selection instead of contacts
          setTimeout(() => {
            setIsTimeModalVisible(true);
          }, Platform.OS === 'ios' ? 300 : 100);
        }}
        onSave={handleSaveEvent}
        onRequestClose={() => setIsNoteModalVisible(false)}
        isLoading={isCreatingMeeting}
        contacts={contacts}
        userInfo={userInfo}
      />

      <SuccessModal 
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />

      <DeleteConfirmationModal
        visible={isDeleteModalVisible}
        onClose={() => {
          setIsDeleteModalVisible(false);
          setMeetingToDelete(null);
        }}
        onConfirm={() => {
          if (meetingToDelete !== null) {
            handleDeleteMeeting(meetingToDelete);
          }
        }}
        isLoading={isDeletingMeeting}
      />

      <EditMeetingModal
        visible={isEditModalVisible}
        onClose={() => {
          setIsEditModalVisible(false);
          setEditingMeetingIndex(null);
        }}
        onSave={(updatedData) => {
          if (editingMeetingIndex !== null) {
            handleUpdateMeeting(editingMeetingIndex, updatedData);
          }
        }}
        isLoading={isUpdatingMeeting}
        event={editingMeetingIndex !== null ? events[editingMeetingIndex] : null}
        userInfo={userInfo}
        contacts={contacts}
      />

      {/* Share Modal */}
      <Modal
        visible={isShareModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsShareModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModalContent}>
            <TouchableOpacity
              style={styles.shareModalCloseButton}
              onPress={() => {
                setIsShareModalVisible(false);
              }}
            >
              <MaterialIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>

            <Text style={styles.shareModalTitle}>Share via</Text>
            <View style={styles.shareOptions}>
              {shareOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.shareOption}
                  onPress={() => handlePlatformSelect(option.id)}
                >
                  <View style={[styles.iconCircle, { backgroundColor: option.color }]}>
                    {option.id === 'whatsapp' ? (
                      <MaterialCommunityIcons name="whatsapp" size={22} color={COLORS.white} />
                    ) : option.id === 'linkedin' ? (
                      <MaterialCommunityIcons name="linkedin" size={22} color={COLORS.white} />
                    ) : (
                      <MaterialIcons
                        name={option.icon as 'send' | 'email' | 'content-copy'}
                        size={22}
                        color={COLORS.white}
                      />
                    )}
                  </View>
                  <Text style={styles.shareOptionText} numberOfLines={1}>{option.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    marginTop: 90,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: Platform.select({
      ios: 20,
      android: 80,
    }),
  },
  calendar: {
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  eventsSection: {
    marginTop: 20,
    marginBottom: 20, // Add some bottom margin
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upcomingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 4,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  eventCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginRight: 15,
    width: 350, // Increased width to accommodate more content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  publicEventCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    backgroundColor: '#F8FBFF',
  },
  eventsScrollView: {
    paddingLeft: 20, // Add left padding
    paddingRight: 5, // Add right padding
    marginBottom: 15, // Add bottom margin
  },
  emptyEventsMessage: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 20,
  },
  eventDate: {
    color: '#FF69B4',
    fontSize: 12,
    marginBottom: 5,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    flex: 1,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  publicBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  publicBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  eventTime: {
    color: '#666',
    fontSize: 12,
  },
  createEventButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: Platform.OS === 'android' ? 20 : 0,
  },
  createEventButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  createEventText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  createEventTextActive: {
    color: 'white',
  },
  scheduleMeetingButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  scheduleMeetingButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scheduleMeetingIcon: {
    marginRight: 8,
  },
  scheduleMeetingText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  scheduleMeetingTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Add padding for iOS status bar
  },
  modalContent: {
    backgroundColor: 'white',
    width: '90%',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 40 : 30, // Increased Android bottom margin
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  contactsList: {
    maxHeight: '80%',
  },
  emptyContactsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContactsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyContactsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  contactItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contactItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactItemInfo: {
    flex: 1,
  },
  contactItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  contactItemEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  contactPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  contactPickerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  contactPickerCancelButton: {
    backgroundColor: '#f5f5f5',
  },
  contactPickerConfirmButton: {
    backgroundColor: COLORS.primary,
  },
  contactPickerCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  contactPickerConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  timeList: {
    maxHeight: '70%',
  },
  timeItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  selectedTimeItem: {
    backgroundColor: COLORS.primary + '20',
  },
  timeText: {
    fontSize: 18,
    color: '#333',
  },
  selectedTimeText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  selectedInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    height: 120,
    backgroundColor: '#fff',
    fontSize: 16,
    textAlignVertical: 'top',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  noteButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    marginBottom: Platform.select({
      ios: 20,
      android: 25, // Increased Android bottom margin
    }),
  },
  noteButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#666',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    minHeight: 45, // Add minimum height to prevent size change during loading
    justifyContent: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  eventNote: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },
  successModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
  },
  successIcon: {
    fontSize: 50,
    color: '#4CAF50',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  successButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  successButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  eventActionsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    minWidth: 140,
    overflow: 'hidden',
    transformOrigin: 'top right',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
    flex: 1,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 8,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.black,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  eventsWrapper: {
    flex: 1,
  },
  eventsScrollContainer: {
    flex: 1,
  },
  androidEventsWrapper: {
    height: 200,
    marginBottom: 10,
  },
  androidEventsScrollContainer: {
    flex: 1,
  },
  androidEventsScrollView: {
    paddingHorizontal: 10,
  },
  androidEventsGrid: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  androidEventCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    width: '100%', // Changed to full width for better readability
    marginBottom: 12,
    position: 'relative',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 5,
    marginTop: 15,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  contactInfoContainer: {
    marginVertical: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  contactInfoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  contactInfoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  contactEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timeContainer: {
    marginVertical: 15,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeColumn: {
    flexDirection: 'column',
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  durationSelector: {
    marginVertical: 15,
  },
  durationButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    minWidth: 80,
  },
  durationButtonActive: {
    backgroundColor: COLORS.primary,
  },
  durationButtonText: {
    color: COLORS.primary,
    fontSize: 14,
  },
  durationButtonTextActive: {
    color: 'white',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    height: 200, // Fixed height instead of maxHeight
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
    overflow: 'hidden',
  },
  suggestionsScrollView: {
    flex: 1,
    width: '100%',
  },
  suggestionsContentContainer: {
    flexGrow: 1,
  },
  androidSuggestionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  androidSuggestionsContainer: {
    width: '80%',
    maxHeight: 300,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  attendeesContainer: {
    marginTop: 10,
    gap: 10,
  },
  attendeeChip: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  attendeeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  organizerBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  organizerBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  attendeeEmail: {
    fontSize: 12,
    color: '#666',
  },
  removeAttendeeButton: {
    padding: 5,
  },
  noAttendeesText: {
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  addAttendeeButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addAttendeeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 10,
  },
  locationInputContainer: {
    zIndex: 100,
    marginBottom: 15,
    position: 'relative',
  },
  modalWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noContactsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noContactsText: {
    color: '#666',
    fontSize: 16,
    fontStyle: 'italic',
  },
  contactItemSelected: {
    backgroundColor: `${COLORS.primary}15`,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  contactInfo: {
    flex: 1,
  },
  errorModalContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.error,
    marginVertical: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  eventLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  eventLocation: {
    color: '#666',
    fontSize: 12,
    flex: 1,
  },
  eventAttendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  eventAttendees: {
    color: '#666',
    fontSize: 12,
  },
  eventDetailSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  eventDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 4,
  },
  eventDetailTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  eventDetailText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 18,
  },
  clickableLocation: {
    color: COLORS.primary,
    flex: 1,
  },
  locationIcon: {
    marginLeft: 8,
  },
  eventDuration: {
    fontSize: 12,
    color: '#666',
    marginLeft: 18,
    marginTop: 2,
  },
  eventAttendeeItem: {
    fontSize: 12,
    color: '#666',
    marginLeft: 18,
    marginBottom: 2,
  },
  pastTimeMessage: {
    textAlign: 'center',
    padding: 15,
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
  },
  testButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  // Loading overlay styles
  loadingOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingModalContent: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10, // Higher elevation for Android
    minWidth: 200,
    minHeight: 120,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalContent: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 20,
  },
  shareModalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 5,
  },
  shareOption: {
    alignItems: 'center',
    padding: 4,
    flex: 1,
    maxWidth: 60,
  },
  shareOptionText: {
    fontSize: 10,
    color: COLORS.black,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});