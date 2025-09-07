import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform, Modal, Alert, TextInput, KeyboardAvoidingView, Animated, ActivityIndicator, FlatList, TouchableWithoutFeedback } from 'react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { COLORS } from '../../constants/colors';
import AdminHeader from '../../components/AdminHeader';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AdminTabParamList, Contact, AuthStackParamList } from '../../types';
import { API_BASE_URL, ENDPOINTS, getUserId, buildUrl, authenticatedFetchWithRefresh, forceLogoutExpiredToken } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type CalendarNavigationProp = BottomTabNavigationProp<AdminTabParamList, 'Calendar'>;
type CalendarScreenNavigationProp = StackNavigationProp<AuthStackParamList>;

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
}

interface ContactsModalProps {
  visible: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSelectContacts: (contacts: Contact[]) => void;
}

const calculateEndTime = (startTime: string, duration: number) => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes);
  date.setMinutes(date.getMinutes() + duration);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

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
  const calculateEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    date.setMinutes(date.getMinutes() + duration);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

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
      animationType="none"
      onRequestClose={onRequestClose}
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
                        <Text style={styles.attendeeName}>
                          {attendee.name} {attendee.surname}
                        </Text>
                        <Text style={styles.attendeeEmail}>{attendee.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeAttendeeButton}
                        onPress={() => {
                          setSelectedAttendees(selectedAttendees.filter(a => a.id !== attendee.id));
                        }}
                      >
                        <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
                      </TouchableOpacity>
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
                const isSelected = selectedAttendees.some(a => a.id === contact.id);
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

const DeleteConfirmationModal = ({ visible, onClose, onConfirm }: DeleteModalProps) => (
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
          >
            <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalButtonConfirm]}
            onPress={onConfirm}
          >
            <Text style={styles.modalButtonText}>Delete</Text>
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

const ContactsModal = ({ visible, onClose, contacts, onSelectContacts }: ContactsModalProps) => {
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [showError, setShowError] = useState(false);

  // Debug logging
  console.log('📱 ContactsModal rendered with:', {
    visible,
    contactsCount: contacts?.length || 0,
    contacts: contacts
  });

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
        animationType="fade"
        onRequestClose={onClose}
        presentationStyle="overFullScreen"
        statusBarTranslucent={false}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={() => {}}>
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
                  onSelectContacts(selectedContacts);
                  setSelectedContacts([]);
                  onClose();
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

const MONTH_MAP: { [key: string]: string } = {
  'January': '01',
  'February': '02',
  'March': '03',
  'April': '04',
  'May': '05',
  'June': '06',
  'July': '07',
  'August': '08',
  'September': '09',
  'October': '10',
  'November': '11',
  'December': '12'
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
  const [selectedDate, setSelectedDate] = useState('');
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
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<number | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigation = useNavigation<CalendarScreenNavigationProp>();
  const [userInfo, setUserInfo] = useState<{ name: string; surname: string; email: string } | null>(null);
  const [meetingDetails, setMeetingDetails] = useState<MeetingDetails>({
    title: '',
    duration: 30,
    location: '',
    attendees: [],
    startTime: '',
    endTime: '',  });
  const [todayString, setTodayString] = useState(getTodayDateString());
  
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
            const dateStr = event.meetingWhen.replace(' at at ', ' at ');
            console.log('Processing fixed date:', dateStr);
            
            // Parse the date parts
            const [monthStr, day, year] = dateStr.split(' at ')[0].split(' ');
            
            // Get month number from our mapping
            const month = MONTH_MAP[monthStr];
            
            // Format the date in YYYY-MM-DD format
            const formattedDate = `${year}-${month}-${day.padStart(2, '0')}`;
            console.log('Formatted date:', formattedDate);
            
            marks[formattedDate] = { marked: true, dotColor: '#FF69B4' };
          } catch (error) {
            console.error('Error parsing date:', error, event.meetingWhen);
          }
        });
        setMarkedDates(marks);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'Failed to load meetings');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
    loadEvents();
  }, []);

  useEffect(() => {
    const checkUserPlan = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const { plan } = JSON.parse(userData);
          setUserPlan(plan);
          
          // Redirect if user is on free plan
          if (plan === 'free') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainApp', params: undefined }],
            });
          }
        }
      } catch (error) {
        console.error('Error checking user plan:', error);
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp', params: undefined }],
        });
      }
    };

    checkUserPlan();
  }, [navigation]);

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

      // First try to send invitation
      const inviteResponse = await authenticatedFetchWithRefresh(ENDPOINTS.MEETING_INVITE, {
        method: 'POST',
        body: JSON.stringify(meetingData)
      });
      
      let inviteResult;
      try {
        // Log the response for debugging
        inviteResult = await inviteResponse.json();
        console.log('Invite response:', inviteResult);
      } catch (jsonError) {
        console.error('Error parsing invite response:', jsonError);
      }
      
      if (!inviteResponse.ok) {
        console.warn("Failed to send invitation, falling back to regular meeting creation");
        
        // Fallback to regular meeting creation if invite fails
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

      // Reload events to get updated list
      await loadEvents();
      
      // Show success and reset states
      setShowSuccessModal(true);
      setIsNoteModalVisible(false);
      setSelectedContact(null);
      setEventNote('');
      setSelectedDate('');
      setSelectedTime('');

    } catch (error: unknown) {
      console.error('Error saving event:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const handleDeleteMeeting = async (index: number) => {
    try {
      const userId = await getUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      const deleteResponse = await authenticatedFetchWithRefresh(`/meetings/${userId}/${index}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete meeting');
      }

      // Reload events after deletion
      await loadEvents();
      setIsDeleteModalVisible(false);
      setMeetingToDelete(null);
      setSelectedEventIndex(null);

    } catch (error) {
      console.error('Error deleting meeting:', error);
      Alert.alert('Error', 'Failed to delete meeting');
    }
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

  const handleContactSelect = (selectedContacts: Contact[]) => {
    console.log('📝 handleContactSelect called with:', selectedContacts);
    
    if (selectedContacts.length === 0) {
      setIsContactsModalVisible(false);
      setIsTransitioning(false); // Reset transition state
      return;
    }
    
    // Calculate end time based on default duration (30 minutes)
    const endTime = calculateEndTime(selectedTime, 30);
    
    // Update both selectedContact and meetingDetails.attendees
    setSelectedContact(selectedContacts[0]);
    setMeetingDetails(prev => ({
      ...prev,
      attendees: selectedContacts, // Store all selected contacts as attendees
      startTime: selectedTime,
      endTime: endTime
    }));
    
    setIsContactsModalVisible(false);
    setIsTransitioning(false); // Reset transition state
    
    // Small delay before showing note modal to ensure contacts modal is fully closed
    setTimeout(() => {
      setIsNoteModalVisible(true);
    }, Platform.OS === 'ios' ? 300 : 100);
  };

  const renderEventCard = (event: Event, index: number) => (
    <TouchableOpacity 
      key={event.id ? `event-${event.id}-${index}` : `event-${index}`}
      style={styles.eventCard}
      onPress={() => setSelectedEventIndex(selectedEventIndex === index ? null : index)}
    >
      {selectedEventIndex === index && (
        <TouchableOpacity 
          style={styles.deleteIcon}
          onPress={() => {
            setMeetingToDelete(index);
            setIsDeleteModalVisible(true);
          }}
        >
          <Ionicons name="close-circle" size={32} color={COLORS.error} />
        </TouchableOpacity>
      )}
      
      {/* Title and Date */}
      <Text style={styles.eventTitle}>{event.title || `Meeting with ${event.meetingWith}`}</Text>
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
          <Text style={styles.eventDetailText}>{event.location}</Text>
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
    </TouchableOpacity>
  );

  const renderAndroidEventCard = (event: Event, index: number) => (
    <TouchableOpacity 
      key={event.id ? `event-${event.id}-${index}` : `event-${index}`}
      style={styles.androidEventCard}
      onPress={() => setSelectedEventIndex(selectedEventIndex === index ? null : index)}
    >
      {selectedEventIndex === index && (
        <TouchableOpacity 
          style={styles.deleteIcon}
          onPress={() => {
            setMeetingToDelete(index);
            setIsDeleteModalVisible(true);
          }}
        >
          <Ionicons name="close-circle" size={32} color={COLORS.error} />
        </TouchableOpacity>
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

  // Update the todayString if the component is mounted past midnight
  useEffect(() => {
    const todayUpdateInterval = setInterval(() => {
      const newTodayString = getTodayDateString();
      if (newTodayString !== todayString) {
        setTodayString(newTodayString);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(todayUpdateInterval);
  }, [todayString]);

  // Filter available time slots for today
  const getAvailableTimeSlots = () => {
    if (selectedDate === todayString) {
      return timeSlots.filter(time => !isTimeInPast(time));
    }
    return timeSlots;
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Calendar" />
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        <View style={styles.eventsSection}>
          <Text style={styles.upcomingTitle}>Upcoming Events</Text>
          {events.length > 0 ? (
            Platform.OS === 'ios' ? (
              <View style={styles.eventsWrapper}>
                <ScrollView 
                  horizontal={true}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.eventsScrollView}
                  style={styles.eventsScrollContainer}
                  nestedScrollEnabled={true}
                >
                  {events.map((event, index) => renderEventCard(event, index))}
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
                    {events.map((event, index) => renderAndroidEventCard(event, index))}
                  </View>
                </ScrollView>
              </View>
            )
          ) : (
            <Text style={styles.emptyEventsMessage}>No events scheduled</Text>
          )}
          <TouchableOpacity 
            style={[
              styles.createEventButton,
              selectedDate && styles.createEventButtonActive
            ]}
            onPress={() => {
              if (selectedDate) {
                setIsTimeModalVisible(true);
              }
            }}
          >
            <Text style={[
              styles.createEventText,
              selectedDate && styles.createEventTextActive            ]}>
              + Create Events
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ContactsModal
        visible={isContactsModalVisible}
        onClose={() => {
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
                    
                    setIsTransitioning(true);
                    setSelectedTime(time);
                    setIsTimeModalVisible(false);
                    
                    // Add delay for iOS modal transition
                    setTimeout(async () => {
                      try {
                        await loadContacts();
                        setIsContactsModalVisible(true);
                      } catch (error) {
                        console.error('❌ Error loading contacts:', error);
                        Alert.alert('Error', 'Failed to load contacts. Please try again.');
                      } finally {
                        setIsTransitioning(false);
                      }
                    }, Platform.OS === 'ios' ? 500 : 100);
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

      <NoteModal 
        visible={isNoteModalVisible}
        selectedContact={selectedContact}
        selectedTime={selectedTime}
        eventNote={eventNote}
        meetingDetails={meetingDetails}
        onChangeNote={setEventNote}
        onChangeMeetingDetails={(details) => 
          setMeetingDetails(prev => ({ ...prev, ...details }))
        }
        onBack={() => {
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
          setIsTimeModalVisible(true);
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
      />
    </View>
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
  upcomingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
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
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
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
  deleteIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    zIndex: 1,
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
});