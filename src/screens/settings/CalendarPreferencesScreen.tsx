import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  Clipboard,
  ActivityIndicator,
  Animated,
  FlatList,
  TouchableWithoutFeedback,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS as colors } from '../../constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { RootStackParamList, CalendarPreferences, WorkingHours, BlockedDateRange } from '../../types';
import { getCalendarPreferences, updateCalendarPreferences, API_BASE_URL } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  primary: colors.primary,
  secondary: colors.secondary,
  white: '#FFFFFF',
  black: '#000000',
  gray: '#8E8E93',
  lightGray: '#F5F5F5',
  error: '#FF3B30',
  success: '#34C759',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CalendarPreferences'>;

const DEFAULT_PREFERENCES: CalendarPreferences = {
  enabled: true,
  workingHours: {
    monday: { start: '09:00', end: '17:00', enabled: true },
    tuesday: { start: '09:00', end: '17:00', enabled: true },
    wednesday: { start: '09:00', end: '17:00', enabled: true },
    thursday: { start: '09:00', end: '17:00', enabled: true },
    friday: { start: '09:00', end: '17:00', enabled: true },
    saturday: { start: '09:00', end: '17:00', enabled: false },
    sunday: { start: '09:00', end: '17:00', enabled: false },
  },
  bufferTime: 15,
  allowWeekends: false,
  allowedDurations: [30, 60],
  timezone: 'UTC',
  advanceBookingDays: 30,
  blockedDateRanges: [],
  defaultTimeRange: { start: '09:00', end: '17:00' },
  customTimes: false,
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DURATIONS = [15, 30, 45, 60, 75, 90];

interface AvailableEmail {
  email: string;
  source: 'user' | 'card';
  label: string;
}

const ANIMATION_DURATION = 300;
const DROPDOWN_MAX_HEIGHT = 200;

export default function CalendarPreferencesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<CalendarPreferences>(DEFAULT_PREFERENCES);
  const [userId, setUserId] = useState<string>('');
  const [availableEmails, setAvailableEmails] = useState<AvailableEmail[]>([]);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [workingHoursExpanded, setWorkingHoursExpanded] = useState(true);
  const emailDropdownRef = useRef<View>(null);
  const emailDropdownAnimation = useRef(new Animated.Value(0)).current;
  const workingHoursAnimation = useRef(new Animated.Value(1)).current;
  const [emailDropdownPosition, setEmailDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  const scrollViewRef = useRef<ScrollView>(null);
  const [showBlockedDatesModal, setShowBlockedDatesModal] = useState(false);
  const [selectedRangeStart, setSelectedRangeStart] = useState<string | null>(null);
  const [selectedRangeEnd, setSelectedRangeEnd] = useState<string | null>(null);
  const [currentViewMonth, setCurrentViewMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [newSlotInputs, setNewSlotInputs] = useState<Record<string, string>>({});
  const [showTimePicker, setShowTimePicker] = useState<Record<string, boolean>>({});
  const [tempTimeSlot, setTempTimeSlot] = useState<Record<string, Date>>({});

  useEffect(() => {
    loadPreferences();
    loadUserId();
  }, []);

  const loadUserId = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        const extractedUserId = parsed.id || parsed.uid;
        console.log('[Calendar Preferences] Loaded userId:', extractedUserId);
        console.log('[Calendar Preferences] Full userData:', parsed);
        setUserId(extractedUserId);
      } else {
        console.warn('[Calendar Preferences] No userData found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await getCalendarPreferences();
      const responseData = response.data;
      
      console.log('[Calendar Preferences] Full response data:', JSON.stringify(responseData, null, 2));
      
      // Extract availableEmails if present
      if (responseData.availableEmails && Array.isArray(responseData.availableEmails)) {
        console.log('[Calendar Preferences] Found availableEmails:', responseData.availableEmails.length);
        setAvailableEmails(responseData.availableEmails);
        // Set default notificationEmail if not set and emails available
        if (!responseData.notificationEmail && responseData.availableEmails.length > 0) {
          responseData.notificationEmail = responseData.availableEmails[0].email;
          console.log('[Calendar Preferences] Set default notificationEmail:', responseData.notificationEmail);
        }
      } else {
        console.warn('[Calendar Preferences] No availableEmails in response or not an array');
        // Set empty array so UI still shows if needed
        setAvailableEmails([]);
      }
      
      // Remove availableEmails from preferences before setting state
      const { availableEmails: _, ...prefs } = responseData;
      setPreferences(prefs);
      console.log('[Calendar Preferences] Final preferences:', prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      // Use defaults if loading fails
      setAvailableEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await updateCalendarPreferences(preferences);
      Alert.alert('Success', 'Calendar preferences updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const updateWorkingHours = (day: keyof typeof preferences.workingHours, field: keyof WorkingHours, value: any) => {
    setPreferences({
      ...preferences,
      workingHours: {
        ...preferences.workingHours,
        [day]: {
          ...preferences.workingHours[day],
          [field]: value,
        },
      },
    });
  };

  const addSpecificSlot = (day: keyof typeof preferences.workingHours, time: string) => {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g., 11:30)');
      return;
    }
    
    const currentSlots = preferences.workingHours[day].specificSlots || [];
    if (currentSlots.includes(time)) {
      Alert.alert('Duplicate Time', 'This time slot already exists');
      return;
    }
    
    // Check if time is outside default time range and warn
    const defaultStart = preferences.defaultTimeRange?.start || '09:00';
    const defaultEnd = preferences.defaultTimeRange?.end || '17:00';
    const [timeHours, timeMinutes] = time.split(':').map(Number);
    const [startHours, startMinutes] = defaultStart.split(':').map(Number);
    const [endHours, endMinutes] = defaultEnd.split(':').map(Number);
    
    const timeInMinutes = timeHours * 60 + timeMinutes;
    const startInMinutes = startHours * 60 + startMinutes;
    const endInMinutes = endHours * 60 + endMinutes;
    
    if (timeInMinutes < startInMinutes || timeInMinutes > endInMinutes) {
      Alert.alert(
        'Note',
        `This time slot (${time}) is outside your default working hours (${defaultStart} - ${defaultEnd}). It will still be available for bookings.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
    
    const newSlots = [...currentSlots, time].sort((a, b) => {
      const [aHours, aMinutes] = a.split(':').map(Number);
      const [bHours, bMinutes] = b.split(':').map(Number);
      return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
    });
    
    updateWorkingHours(day, 'specificSlots', newSlots);
  };

  const handleTimePickerChange = (day: keyof typeof preferences.workingHours, event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker({ ...showTimePicker, [day]: false });
    }
    
    if (selectedDate) {
      // Update temp time for iOS (so user can see their selection)
      setTempTimeSlot({ ...tempTimeSlot, [day]: selectedDate });
      
      // On Android, immediately add the slot
      if (Platform.OS === 'android' && event.type === 'set') {
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        addSpecificSlot(day, timeString);
      }
    }
  };

  const openTimePicker = (day: keyof typeof preferences.workingHours) => {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // Default to 9:00 AM
    setTempTimeSlot({ ...tempTimeSlot, [day]: now });
    setShowTimePicker({ ...showTimePicker, [day]: true });
  };

  const removeSpecificSlot = (day: keyof typeof preferences.workingHours, time: string) => {
    const currentSlots = preferences.workingHours[day].specificSlots || [];
    const newSlots = currentSlots.filter(slot => slot !== time);
    updateWorkingHours(day, 'specificSlots', newSlots.length > 0 ? newSlots : undefined);
  };

  const toggleDuration = (duration: number) => {
    const allowed = preferences.allowedDurations;
    if (allowed.includes(duration)) {
      setPreferences({
        ...preferences,
        allowedDurations: allowed.filter(d => d !== duration),
      });
    } else {
      setPreferences({
        ...preferences,
        allowedDurations: [...allowed, duration].sort((a, b) => a - b),
      });
    }
  };

  const getCalendarLink = () => {
    if (!userId) return '';
    return `${API_BASE_URL}/public/calendar/${userId}.html`;
  };

  const shareCalendarLink = async () => {
    const link = getCalendarLink();
    if (!link) {
      Alert.alert('Error', 'Unable to generate calendar link');
      return;
    }

    try {
      await Share.share({
        message: `Book a meeting with me: ${link}`,
        title: 'My Calendar Booking Link',
      });
    } catch (error) {
      console.error('Error sharing:', error);
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

  const animateEmailDropdown = (show: boolean) => {
    Animated.timing(emailDropdownAnimation, {
      toValue: show ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
  };

  const animateWorkingHours = (expanded: boolean) => {
    Animated.timing(workingHoursAnimation, {
      toValue: expanded ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
  };

  const selectEmail = (email: string) => {
    setPreferences({
      ...preferences,
      notificationEmail: email,
    });
    setShowEmailDropdown(false);
    animateEmailDropdown(false);
  };

  const toggleWorkingHours = () => {
    const newExpanded = !workingHoursExpanded;
    setWorkingHoursExpanded(newExpanded);
    animateWorkingHours(newExpanded);
  };

  // Blocked Dates Functions
  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    const blockedRanges = preferences.blockedDateRanges || [];

    blockedRanges.forEach((range) => {
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      const currentMonth = new Date(currentViewMonth + '-01');
      
      // Check if this range applies to the current month
      if (range.repeatMonthly) {
        // For monthly repeats, show the range for the current month
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        // Calculate day of month for start and end
        const startDay = start.getDate();
        const endDay = end.getDate();
        
        // Mark days in current month
        for (let day = Math.max(1, startDay); day <= Math.min(monthEnd.getDate(), endDay); day++) {
          const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          if (day === startDay) {
            marked[dateStr] = { startingDay: true, color: COLORS.error, textColor: COLORS.white };
          } else if (day === endDay) {
            marked[dateStr] = { endingDay: true, color: COLORS.error, textColor: COLORS.white };
          } else {
            marked[dateStr] = { color: COLORS.error, textColor: COLORS.white };
          }
        }
      } else {
        // For specific dates, only show if in current month
        const startMonth = start.getMonth();
        const startYear = start.getFullYear();
        const endMonth = end.getMonth();
        const endYear = end.getFullYear();
        const viewMonth = currentMonth.getMonth();
        const viewYear = currentMonth.getFullYear();
        
        if ((startYear === viewYear && startMonth === viewMonth) || 
            (endYear === viewYear && endMonth === viewMonth) ||
            (startYear < viewYear || (startYear === viewYear && startMonth < viewMonth)) &&
            (endYear > viewYear || (endYear === viewYear && endMonth > viewMonth))) {
          
          const monthStart = new Date(viewYear, viewMonth, 1);
          const monthEnd = new Date(viewYear, viewMonth + 1, 0);
          const rangeStart = start > monthStart ? start : monthStart;
          const rangeEnd = end < monthEnd ? end : monthEnd;
          
          for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            if (d.getTime() === start.getTime()) {
              marked[dateStr] = { startingDay: true, color: COLORS.error, textColor: COLORS.white };
            } else if (d.getTime() === end.getTime()) {
              marked[dateStr] = { endingDay: true, color: COLORS.error, textColor: COLORS.white };
            } else {
              marked[dateStr] = { color: COLORS.error, textColor: COLORS.white };
            }
          }
        }
      }
    });

    // Mark selected range
    if (selectedRangeStart && selectedRangeEnd) {
      const start = new Date(selectedRangeStart);
      const end = new Date(selectedRangeEnd);
      const startDateStr = selectedRangeStart;
      const endDateStr = selectedRangeEnd;
      
      // Use period marking for range selection
      marked[startDateStr] = {
        ...marked[startDateStr],
        startingDay: true,
        color: COLORS.primary,
        textColor: COLORS.white,
        endingDay: startDateStr === endDateStr,
      };
      
      if (startDateStr !== endDateStr) {
        marked[endDateStr] = {
          ...marked[endDateStr],
          endingDay: true,
          color: COLORS.primary,
          textColor: COLORS.white,
        };
        
        // Mark days in between
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          if (dateStr !== startDateStr && dateStr !== endDateStr) {
            marked[dateStr] = { ...marked[dateStr], color: COLORS.primary, textColor: COLORS.white };
          }
        }
      }
    } else if (selectedRangeStart) {
      marked[selectedRangeStart] = { ...marked[selectedRangeStart], selected: true, selectedColor: COLORS.primary };
    }

    return marked;
  };

  const handleDayPress = (day: DateData) => {
    if (!selectedRangeStart || (selectedRangeStart && selectedRangeEnd)) {
      // Start new selection
      setSelectedRangeStart(day.dateString);
      setSelectedRangeEnd(null);
    } else {
      // Complete selection
      const start = new Date(selectedRangeStart);
      const end = new Date(day.dateString);
      
      if (end < start) {
        // Swap if end is before start
        setSelectedRangeStart(day.dateString);
        setSelectedRangeEnd(selectedRangeStart);
      } else {
        setSelectedRangeEnd(day.dateString);
      }
    }
  };

  const addBlockedRange = () => {
    if (!selectedRangeStart) {
      Alert.alert('Error', 'Please select a date range');
      return;
    }

    const endDate = selectedRangeEnd || selectedRangeStart;
    const startDate = selectedRangeStart;

    const newRange: BlockedDateRange = {
      startDate,
      endDate,
      repeatMonthly: repeatMonthly,
    };

    const updatedRanges = [...(preferences.blockedDateRanges || []), newRange];
    setPreferences({
      ...preferences,
      blockedDateRanges: updatedRanges,
    });

    // Reset selection
    setSelectedRangeStart(null);
    setSelectedRangeEnd(null);
    setRepeatMonthly(false);
    setShowBlockedDatesModal(false);
  };

  const removeBlockedRange = (index: number) => {
    const updatedRanges = [...(preferences.blockedDateRanges || [])];
    updatedRanges.splice(index, 1);
    setPreferences({
      ...preferences,
      blockedDateRanges: updatedRanges,
    });
  };

  const openBlockedDatesModal = () => {
    setSelectedRangeStart(null);
    setSelectedRangeEnd(null);
    setRepeatMonthly(false);
    setCurrentViewMonth(new Date().toISOString().slice(0, 7));
    setShowBlockedDatesModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar Preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          if (showEmailDropdown) {
            setShowEmailDropdown(false);
            animateEmailDropdown(false);
          }
        }}
        onScroll={() => {
          // Update dropdown position when scrolling
          if (showEmailDropdown) {
            emailDropdownRef.current?.measureInWindow((xPos: number, yPos: number, widthMeasure: number, heightMeasure: number) => {
              setEmailDropdownPosition({ x: xPos, y: yPos + heightMeasure, width: widthMeasure });
            });
          }
        }}
      >
        {/* Enable/Disable Calendar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Calendar Booking</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Public Booking</Text>
              <Text style={styles.settingDescription}>
                Allow others to book meetings with you
              </Text>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={(value) => setPreferences({ ...preferences, enabled: value })}
              trackColor={{ false: COLORS.gray, true: COLORS.primary }}
            />
          </View>
        </View>

        {preferences.enabled && (
          <>
            {/* Calendar Link */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="link" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Your Booking Link</Text>
              </View>
              <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {getCalendarLink()}
                </Text>
              </View>
              <View style={styles.linkButtons}>
                <TouchableOpacity style={styles.linkButton} onPress={copyCalendarLink}>
                  <Ionicons name="copy-outline" size={20} color={COLORS.white} />
                  <Text style={styles.linkButtonText}>Copy Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkButton} onPress={shareCalendarLink}>
                  <Ionicons name="share-outline" size={20} color={COLORS.white} />
                  <Text style={styles.linkButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notification Email Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="mail" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Notification Email</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Choose which email address should receive booking notifications
              </Text>
              {loading ? (
                <View style={styles.emailSelector}>
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 10 }} />
                  <Text style={[styles.emailSelectorText, { color: COLORS.gray }]}>
                    Loading available emails...
                  </Text>
                </View>
              ) : availableEmails.length > 0 ? (
                <View style={styles.dropdownWrapper}>
                  <View style={styles.dropdownContainer}>
                    <View
                      ref={emailDropdownRef}
                      style={styles.emailSelector}
                      onLayout={() => {
                        // Update position when layout changes (e.g., on scroll)
                        if (showEmailDropdown) {
                          emailDropdownRef.current?.measureInWindow((xPos: number, yPos: number, widthMeasure: number, heightMeasure: number) => {
                            setEmailDropdownPosition({ x: xPos, y: yPos + heightMeasure, width: widthMeasure });
                          });
                        }
                      }}
                    >
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        onPress={() => {
                          emailDropdownRef.current?.measureInWindow((xPos: number, yPos: number, widthMeasure: number, heightMeasure: number) => {
                            setEmailDropdownPosition({ x: xPos, y: yPos + heightMeasure, width: widthMeasure });
                            const newState = !showEmailDropdown;
                            setShowEmailDropdown(newState);
                            animateEmailDropdown(newState);
                          });
                        }}
                      >
                      <Text style={styles.emailSelectorText}>
                        {preferences.notificationEmail
                          ? availableEmails.find((e) => e.email === preferences.notificationEmail)?.label ||
                            preferences.notificationEmail
                          : availableEmails[0]?.email || 'Select email'}
                      </Text>
                        <MaterialIcons 
                          name={showEmailDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                          size={20} 
                          color={COLORS.primary} 
                        />
                      </TouchableOpacity>
                    </View>
                    {preferences.notificationEmail && (
                      <Text style={styles.emailDisplayText}>
                        {preferences.notificationEmail}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.emailSelector}>
                  <Text style={[styles.emailSelectorText, { color: COLORS.gray }]}>
                    No emails available
                  </Text>
                </View>
              )}
            </View>

            {/* Blocked Dates - Moved above Allow Weekend Bookings */}
            <View style={[styles.section, { zIndex: 1 }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Blocked Dates</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Select date ranges where bookings are not allowed
              </Text>
              
              <TouchableOpacity style={styles.addBlockedButtonOutlined} onPress={openBlockedDatesModal}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.error} />
                <Text style={styles.addBlockedButtonTextOutlined}>Add Blocked Date Range</Text>
              </TouchableOpacity>

              {(preferences.blockedDateRanges || []).length > 0 && (
                <View style={styles.blockedRangesList}>
                  {(preferences.blockedDateRanges || []).map((range, index) => (
                    <View key={index} style={styles.blockedRangeItem}>
                      <View style={styles.blockedRangeInfo}>
                        <Text style={styles.blockedRangeText}>
                          {new Date(range.startDate).toLocaleDateString()} - {new Date(range.endDate).toLocaleDateString()}
                        </Text>
                        {range.repeatMonthly && (
                          <Text style={styles.repeatBadge}>Repeats monthly</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => removeBlockedRange(index)}
                        style={styles.removeBlockedButton}
                      >
                        <Ionicons name="close-circle" size={24} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Weekend Bookings */}
            <View style={styles.section}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Allow Weekend Bookings</Text>
                  <Text style={styles.settingDescription}>
                    Enable Saturday and Sunday bookings
                  </Text>
                </View>
                <Switch
                  value={preferences.allowWeekends}
                  onValueChange={(value) => {
                    // When toggling weekends off, disable Saturday and Sunday
                    if (!value) {
                      setPreferences({
                        ...preferences,
                        allowWeekends: value,
                        workingHours: {
                          ...preferences.workingHours,
                          saturday: { ...preferences.workingHours.saturday, enabled: false },
                          sunday: { ...preferences.workingHours.sunday, enabled: false },
                        },
                      });
                    } else {
                      setPreferences({ ...preferences, allowWeekends: value });
                    }
                  }}
                  trackColor={{ false: COLORS.gray, true: COLORS.primary }}
                />
              </View>
            </View>

            {/* Default Times Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Default Times</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Set default working hours that apply to all days. Enable "Custom Times" to set specific time slots for individual days.
              </Text>
              
              {/* Default Time Range */}
              <View style={styles.timeInputsContainer}>
                <View style={styles.timeInputs}>
                  <View style={styles.timeInputContainer}>
                    <Text style={styles.timeLabel}>Start</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={preferences.defaultTimeRange?.start || '09:00'}
                      onChangeText={(value) => {
                        setPreferences({
                          ...preferences,
                          defaultTimeRange: {
                            start: value,
                            end: preferences.defaultTimeRange?.end || '17:00',
                          },
                        });
                      }}
                      placeholder="09:00"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <Text style={styles.timeSeparator}>-</Text>
                  <View style={styles.timeInputContainer}>
                    <Text style={styles.timeLabel}>End</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={preferences.defaultTimeRange?.end || '17:00'}
                      onChangeText={(value) => {
                        setPreferences({
                          ...preferences,
                          defaultTimeRange: {
                            start: preferences.defaultTimeRange?.start || '09:00',
                            end: value,
                          },
                        });
                      }}
                      placeholder="17:00"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </View>

              {/* Custom Times Toggle */}
              <View style={[styles.settingRow, { marginTop: 15 }]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Custom Times</Text>
                  <Text style={styles.settingDescription}>
                    Enable to set specific time slots for each day in Working Hours
                  </Text>
                </View>
                <Switch
                  value={preferences.customTimes || false}
                  onValueChange={(value) => {
                    setPreferences({
                      ...preferences,
                      customTimes: value,
                      // Clear all specific slots when disabling custom times
                      ...(value === false && {
                        workingHours: Object.keys(preferences.workingHours).reduce((acc, day) => {
                          acc[day as keyof typeof preferences.workingHours] = {
                            ...preferences.workingHours[day as keyof typeof preferences.workingHours],
                            specificSlots: undefined,
                          };
                          return acc;
                        }, {} as typeof preferences.workingHours),
                      }),
                    });
                  }}
                  trackColor={{ false: COLORS.gray, true: COLORS.primary }}
                />
              </View>
            </View>

            {/* Available Time Slots - Collapsible */}
            <View style={[styles.section, { zIndex: 1 }]}>
              <TouchableOpacity 
                style={[styles.sectionHeader, { justifyContent: 'space-between' }]}
                onPress={toggleWorkingHours}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="time" size={24} color={COLORS.primary} />
                  <Text style={styles.sectionTitle}>Available Time Slots</Text>
                </View>
                <MaterialIcons 
                  name={workingHoursExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                  size={24} 
                  color={COLORS.primary} 
                />
              </TouchableOpacity>
              
              <Animated.View
                style={{
                  maxHeight: workingHoursAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1000], // Large enough for all days
                  }),
                  opacity: workingHoursAnimation,
                  overflow: 'hidden',
                }}
                pointerEvents={workingHoursExpanded ? 'auto' : 'none'}
              >
                {DAYS.map((day) => {
                  // Saturday and Sunday should only be visible if allowWeekends is enabled
                  const isWeekend = day === 'saturday' || day === 'sunday';
                  if (isWeekend && !preferences.allowWeekends) {
                    return null; // Don't render weekend days if weekends are not allowed
                  }
                  
                  return (
                    <View key={day} style={styles.dayRow}>
                      <View style={styles.dayHeader}>
                        <Text style={styles.dayLabel}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </Text>
                        <Switch
                          value={preferences.workingHours[day].enabled}
                          onValueChange={(value) => updateWorkingHours(day, 'enabled', value)}
                          trackColor={{ false: COLORS.gray, true: COLORS.primary }}
                        />
                      </View>
                      {preferences.workingHours[day].enabled && preferences.customTimes && (
                        <View style={styles.timeInputsContainer}>
                          {/* Time Slots */}
                          <View style={styles.specificSlotsContainer}>
                            {(preferences.workingHours[day].specificSlots && preferences.workingHours[day].specificSlots.length > 0) && (
                              <>
                                <Text style={styles.specificSlotsLabel}>Time Slots</Text>
                                <View style={styles.slotsList}>
                                  {preferences.workingHours[day].specificSlots.map((slot, index) => (
                                  <Pressable
                                    key={index}
                                    style={({ pressed }: { pressed: boolean }) => [
                                      styles.slotItem,
                                      pressed && { opacity: 0.7, backgroundColor: COLORS.primary + '25' }
                                    ]}
                                    onPress={() => {
                                      console.log('[Slot] Pressed:', slot);
                                      // Allow editing by tapping the slot
                                      if (Platform.OS === 'ios') {
                                        Alert.prompt(
                                          'Edit Time Slot',
                                          'Enter new time in HH:MM format',
                                          [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                              text: 'Update',
                                              onPress: (newTime) => {
                                                if (newTime && newTime.trim()) {
                                                  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
                                                  if (timeRegex.test(newTime.trim())) {
                                                    const currentSlots = preferences.workingHours[day].specificSlots || [];
                                                    const updatedSlots = currentSlots.map(s => s === slot ? newTime.trim() : s)
                                                      .sort((a, b) => {
                                                        const [aHours, aMinutes] = a.split(':').map(Number);
                                                        const [bHours, bMinutes] = b.split(':').map(Number);
                                                        return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
                                                      });
                                                    updateWorkingHours(day, 'specificSlots', updatedSlots);
                                                  } else {
                                                    Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g., 11:30)');
                                                  }
                                                }
                                              }
                                            }
                                          ],
                                          'plain-text',
                                          slot
                                        );
                                      } else {
                                        // Android: Use TextInput in Alert
                                        Alert.alert(
                                          'Edit Time Slot',
                                          'Enter new time in HH:MM format',
                                          [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                              text: 'Update',
                                              onPress: () => {
                                                // For Android, we'll use the existing input field
                                                // Set the input value and focus it
                                                setNewSlotInputs({
                                                  ...newSlotInputs,
                                                  [day]: slot
                                                });
                                                // Remove the old slot first
                                                removeSpecificSlot(day, slot);
                                              }
                                            }
                                          ],
                                          { cancelable: true }
                                        );
                                      }
                                    }}
                                  >
                                    <Text style={styles.slotTime}>{slot}</Text>
                                    <Pressable
                                      onPress={() => {
                                        console.log('[Slot] Remove button pressed:', slot);
                                        removeSpecificSlot(day, slot);
                                      }}
                                      style={({ pressed }: { pressed: boolean }) => [
                                        styles.removeSlotButton,
                                        pressed && { opacity: 0.5 }
                                      ]}
                                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                      <MaterialIcons name="close" size={18} color={COLORS.error} />
                                    </Pressable>
                                  </Pressable>
                                ))}
                                </View>
                              </>
                            )}
                            
                            {/* Add Slot Button - Always Visible */}
                            <View style={styles.addSlotContainer}>
                              <TouchableOpacity
                                style={styles.timePickerButton}
                                onPress={() => openTimePicker(day)}
                              >
                                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                                <Text style={styles.timePickerButtonText}>Select Time</Text>
                              </TouchableOpacity>
                              
                              {/* Time Picker */}
                              {showTimePicker[day] && Platform.OS === 'android' && (
                                <DateTimePicker
                                  value={tempTimeSlot[day] || new Date()}
                                  mode="time"
                                  display="default"
                                  is24Hour={true}
                                  onChange={(event, selectedDate) => {
                                    handleTimePickerChange(day, event, selectedDate);
                                  }}
                                />
                              )}
                              
                              {Platform.OS === 'ios' && showTimePicker[day] && (
                                <>
                                  <DateTimePicker
                                    value={tempTimeSlot[day] || new Date()}
                                    mode="time"
                                    display="spinner"
                                    is24Hour={true}
                                    onChange={(event, selectedDate) => {
                                      handleTimePickerChange(day, event, selectedDate);
                                    }}
                                  />
                                  <View style={styles.iosPickerActions}>
                                    <TouchableOpacity
                                      style={styles.iosPickerButton}
                                      onPress={() => setShowTimePicker({ ...showTimePicker, [day]: false })}
                                    >
                                      <Text style={styles.iosPickerButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[styles.iosPickerButton, styles.iosPickerButtonConfirm]}
                                      onPress={() => {
                                        if (tempTimeSlot[day]) {
                                          const hours = tempTimeSlot[day].getHours().toString().padStart(2, '0');
                                          const minutes = tempTimeSlot[day].getMinutes().toString().padStart(2, '0');
                                          const timeString = `${hours}:${minutes}`;
                                          addSpecificSlot(day, timeString);
                                          setShowTimePicker({ ...showTimePicker, [day]: false });
                                        }
                                      }}
                                    >
                                      <Text style={[styles.iosPickerButtonText, { color: COLORS.white }]}>Add</Text>
                                    </TouchableOpacity>
                                  </View>
                                </>
                              )}
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </Animated.View>
            </View>

            {/* Allowed Durations */}
            <View style={[styles.section, { zIndex: 1 }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="hourglass" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Meeting Durations</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Select the meeting durations you want to offer
              </Text>
              <View style={styles.durationsGrid}>
                {DURATIONS.map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationChip,
                      preferences.allowedDurations.includes(duration) && styles.durationChipSelected,
                    ]}
                    onPress={() => toggleDuration(duration)}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        preferences.allowedDurations.includes(duration) && styles.durationChipTextSelected,
                      ]}
                    >
                      {duration} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Buffer Time */}
            <View style={[styles.section, { zIndex: 1 }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="timer" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Buffer Time</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Time between meetings (in minutes)
              </Text>
              <TextInput
                style={styles.input}
                value={String(preferences.bufferTime)}
                onChangeText={(value) => setPreferences({ ...preferences, bufferTime: parseInt(value) || 0 })}
                keyboardType="number-pad"
                placeholder="15"
              />
            </View>

            {/* Advance Booking Days */}
            <View style={[styles.section, { zIndex: 1 }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-number" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Advance Booking Window</Text>
              </View>
              <Text style={styles.sectionDescription}>
                How many days in advance can people book? (days)
              </Text>
              <TextInput
                style={styles.input}
                value={String(preferences.advanceBookingDays)}
                onChangeText={(value) => setPreferences({ ...preferences, advanceBookingDays: parseInt(value) || 30 })}
                keyboardType="number-pad"
                placeholder="30"
              />
            </View>

          </>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Email Dropdown - Rendered outside ScrollView for proper z-index */}
      {showEmailDropdown && availableEmails.length > 0 && (
        <TouchableWithoutFeedback
          onPress={() => {
            setShowEmailDropdown(false);
            animateEmailDropdown(false);
          }}
        >
          <View style={styles.dropdownOverlay}>
            <Animated.View 
                style={[
                styles.dropdownListAbsolute,
                {
                  top: emailDropdownPosition.y > 0 ? emailDropdownPosition.y : 0,
                  left: emailDropdownPosition.x > 0 ? emailDropdownPosition.x : 15,
                  width: emailDropdownPosition.width > 0 ? emailDropdownPosition.width : '90%',
                  opacity: emailDropdownAnimation,
                  transform: [{
                    translateY: emailDropdownAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    })
                  }],
                }
              ]}
              pointerEvents="auto"
            >
              <ScrollView 
                style={styles.dropdownScrollView}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {availableEmails.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.email}-${index}`}
                    style={[
                      styles.dropdownItem,
                      preferences.notificationEmail === item.email && styles.dropdownItemSelected,
                    ]}
                    onPress={() => selectEmail(item.email)}
                  >
                    <View style={styles.dropdownItemContent}>
                      <Text style={[
                        styles.dropdownItemLabel,
                        preferences.notificationEmail === item.email && styles.dropdownItemLabelSelected,
                      ]}>
                        {item.label}
                      </Text>
                      <Text style={[
                        styles.dropdownItemEmail,
                        preferences.notificationEmail === item.email && styles.dropdownItemEmailSelected,
                      ]}>
                        {item.email}
                      </Text>
                    </View>
                    {preferences.notificationEmail === item.email && (
                      <MaterialIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Blocked Dates Modal */}
      <Modal
        visible={showBlockedDatesModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowBlockedDatesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBlockedDatesModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Block Dates</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={24} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Select Date Range</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Click to select start date, then click again for end date
              </Text>

              <RNCalendar
                style={styles.calendar}
                minDate={new Date().toISOString().split('T')[0]}
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
                  arrowColor: COLORS.primary,
                }}
                markedDates={getMarkedDates()}
                onDayPress={handleDayPress}
                onMonthChange={(month: DateData) => {
                  setCurrentViewMonth(month.dateString.slice(0, 7));
                }}
                markingType="period"
              />

              {selectedRangeStart && (
                <View style={styles.selectedRangeInfo}>
                  <Text style={styles.selectedRangeLabel}>Selected Range:</Text>
                  <Text style={styles.selectedRangeText}>
                    {new Date(selectedRangeStart).toLocaleDateString()}
                    {selectedRangeEnd && ` - ${new Date(selectedRangeEnd).toLocaleDateString()}`}
                  </Text>
                </View>
              )}

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Repeat Monthly</Text>
                  <Text style={styles.settingDescription}>
                    Apply this blocked range to all future months
                  </Text>
                </View>
                <Switch
                  value={repeatMonthly}
                  onValueChange={setRepeatMonthly}
                  trackColor={{ false: COLORS.gray, true: COLORS.primary }}
                />
              </View>

              <TouchableOpacity
                style={[styles.addBlockedButton, !selectedRangeStart && styles.addBlockedButtonDisabled]}
                onPress={addBlockedRange}
                disabled={!selectedRangeStart}
              >
                <Text style={styles.addBlockedButtonText}>Add Blocked Range</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.gray,
  },
  header: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
    color: COLORS.black,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.gray,
  },
  linkContainer: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
  },
  linkButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  linkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  linkButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emailSelector: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  emailSelectorText: {
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
    fontWeight: '500',
  },
  emailDisplayText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 5,
    paddingLeft: 5,
  },
  dropdownWrapper: {
    marginTop: 10,
  },
  dropdownContainer: {
    position: 'relative',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    ...(Platform.OS === 'android' && { elevation: 20 }),
  },
  dropdownListAbsolute: {
    position: 'absolute',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 10000,
    maxHeight: DROPDOWN_MAX_HEIGHT,
    overflow: 'hidden',
  },
  dropdownScrollView: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  dropdownItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemLabel: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
    marginBottom: 2,
  },
  dropdownItemLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  dropdownItemEmail: {
    fontSize: 12,
    color: COLORS.gray,
  },
  dropdownItemEmailSelected: {
    color: COLORS.primary,
  },
  dayRow: {
    marginBottom: 15,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 5,
  },
  timeInput: {
    backgroundColor: COLORS.white,
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  timeSeparator: {
    marginHorizontal: 10,
    fontSize: 18,
    color: COLORS.gray,
  },
  timeInputsContainer: {
    paddingLeft: 15,
  },
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modeButtonInactive: {
    backgroundColor: 'transparent',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: COLORS.white,
  },
  modeButtonTextInactive: {
    color: COLORS.gray,
  },
  specificSlotsContainer: {
    marginTop: 10,
  },
  specificSlotsLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 10,
    fontWeight: '500',
  },
  slotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    marginBottom: 4,
    minHeight: 40,
    minWidth: 100,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: 8,
  },
  removeSlotButton: {
    padding: 4,
    marginLeft: 4,
    borderRadius: 12,
    backgroundColor: COLORS.error + '20',
  },
  addSlotContainer: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 10,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 8,
  },
  timePickerButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  iosPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  iosPickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.lightGray,
  },
  iosPickerButtonConfirm: {
    backgroundColor: COLORS.primary,
  },
  iosPickerButtonText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  addSlotInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  addSlotButton: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  durationChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  durationChipTextSelected: {
    color: COLORS.white,
  },
  input: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
  },
  modalContent: {
    flex: 1,
    padding: 15,
  },
  calendar: {
    borderRadius: 10,
    marginBottom: 20,
  },
  selectedRangeInfo: {
    backgroundColor: COLORS.lightGray,
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  selectedRangeLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 5,
  },
  selectedRangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  addBlockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addBlockedButtonDisabled: {
    backgroundColor: COLORS.gray,
    opacity: 0.5,
  },
  addBlockedButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  addBlockedButtonOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.error,
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  addBlockedButtonTextOutlined: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
  blockedRangesList: {
    marginTop: 15,
  },
  blockedRangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  blockedRangeInfo: {
    flex: 1,
  },
  blockedRangeText: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
    marginBottom: 5,
  },
  repeatBadge: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  removeBlockedButton: {
    padding: 5,
  },
});

