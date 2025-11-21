import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { RecurrencePattern } from '../../../types/events';
import { 
  formatRecurrenceDisplay, 
  validateRecurrencePattern,
  getDayName,
  getShortDayName,
  calculateOccurrenceCount
} from '../../../utils/eventsRecurrence';

interface RecurrenceConfigProps {
  value: RecurrencePattern | null;
  onChange: (pattern: RecurrencePattern | null) => void;
  eventDate: string; // ISO date from parent form
  errors?: string[];
}

const DAYS = [
  { value: 0, short: 'Sun', full: 'Sunday' },
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
];

export default function RecurrenceConfig({ value, onChange, eventDate, errors }: RecurrenceConfigProps) {
  const [isRecurring, setIsRecurring] = useState(!!value);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Initialize default pattern when toggling on
  useEffect(() => {
    if (isRecurring && !value) {
      const eventDateObj = new Date(eventDate);
      const defaultEndDate = new Date(eventDateObj);
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3); // 3 months from start
      
      const defaultPattern: RecurrencePattern = {
        type: 'weekly',
        daysOfWeek: [eventDateObj.getDay()], // Start with event's day
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg',
        startDate: eventDate.split('T')[0], // YYYY-MM-DD
        startTime: eventDateObj.toTimeString().slice(0, 5), // HH:mm
        endDate: defaultEndDate.toISOString().split('T')[0],
        excludedDates: [],
      };
      
      onChange(defaultPattern);
    } else if (!isRecurring && value) {
      onChange(null);
    }
  }, [isRecurring]);

  const toggleDay = (dayValue: number) => {
    if (!value) return;
    
    const newDays = value.daysOfWeek.includes(dayValue)
      ? value.daysOfWeek.filter(d => d !== dayValue)
      : [...value.daysOfWeek, dayValue].sort((a, b) => a - b);
    
    if (newDays.length === 0) {
      Alert.alert('Select Days', 'Please select at least one day of the week.');
      return;
    }
    
    onChange({ ...value, daysOfWeek: newDays });
  };

  const updateTime = (time: Date) => {
    if (!value) return;
    
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    onChange({ ...value, startTime: timeStr });
  };

  const updateStartDate = (date: Date) => {
    if (!value) return;
    
    const dateStr = date.toISOString().split('T')[0];
    onChange({ ...value, startDate: dateStr });
  };

  const updateEndDate = (date: Date) => {
    if (!value) return;
    
    const dateStr = date.toISOString().split('T')[0];
    onChange({ ...value, endDate: dateStr });
  };

  const displayText = value ? formatRecurrenceDisplay(value) : '';
  const occurrenceCount = value ? calculateOccurrenceCount(value) : 0;

  return (
    <View style={styles.container}>
      {/* Toggle Switch */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabel}>
          <MaterialIcons name="repeat" size={24} color={COLORS.primary} />
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleTitle}>Make this a recurring event</Text>
            <Text style={styles.toggleSubtitle}>Event repeats on selected days</Text>
          </View>
        </View>
        <Switch
          value={isRecurring}
          onValueChange={setIsRecurring}
          trackColor={{ false: COLORS.gray, true: COLORS.primary }}
          thumbColor={COLORS.white}
        />
      </View>

      {/* Recurrence Configuration */}
      {isRecurring && value && (
        <View style={styles.configContainer}>
          {/* Day Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repeat on days *</Text>
            <View style={styles.daysGrid}>
              {DAYS.map(day => (
                <TouchableOpacity
                  key={day.value}
                  style={[
                    styles.dayButton,
                    value.daysOfWeek.includes(day.value) && styles.dayButtonActive
                  ]}
                  onPress={() => toggleDay(day.value)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    value.daysOfWeek.includes(day.value) && styles.dayButtonTextActive
                  ]}>
                    {day.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <MaterialIcons name="calendar-today" size={20} color={COLORS.gray} />
              <Text style={styles.dateButtonText}>
                {new Date(value.startDate).toLocaleDateString([], {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
            
            {showStartDatePicker && (
              <DateTimePicker
                value={new Date(value.startDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowStartDatePicker(Platform.OS === 'ios');
                  if (date) updateStartDate(date);
                }}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* End Date */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>End date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <MaterialIcons name="event" size={20} color={COLORS.gray} />
              <Text style={styles.dateButtonText}>
                {new Date(value.endDate).toLocaleDateString([], {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
            
            {showEndDatePicker && (
              <DateTimePicker
                value={new Date(value.endDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowEndDatePicker(Platform.OS === 'ios');
                  if (date) updateEndDate(date);
                }}
                minimumDate={new Date(value.startDate)}
              />
            )}
          </View>

          {/* Start Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartTimePicker(true)}
            >
              <MaterialIcons name="access-time" size={20} color={COLORS.gray} />
              <Text style={styles.dateButtonText}>
                {(() => {
                  const [hours, minutes] = value.startTime.split(':').map(Number);
                  const period = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours % 12 || 12;
                  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
                })()}
              </Text>
            </TouchableOpacity>
            
            {showStartTimePicker && (
              <DateTimePicker
                value={(() => {
                  const [hours, minutes] = value.startTime.split(':').map(Number);
                  const date = new Date();
                  date.setHours(hours, minutes, 0, 0);
                  return date;
                })()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowStartTimePicker(Platform.OS === 'ios');
                  if (date) updateTime(date);
                }}
              />
            )}
          </View>

          {/* Timezone Display */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timezone</Text>
            <View style={styles.timezoneDisplay}>
              <MaterialIcons name="public" size={20} color={COLORS.gray} />
              <Text style={styles.timezoneText}>{value.timezone}</Text>
            </View>
          </View>

          {/* Preview */}
          {displayText && (
            <View style={styles.previewContainer}>
              <MaterialIcons name="info-outline" size={20} color={COLORS.primary} />
              <View style={styles.previewTextContainer}>
                <Text style={styles.previewText}>{displayText}</Text>
                <Text style={styles.occurrenceCount}>
                  {occurrenceCount} occurrence{occurrenceCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Errors */}
          {errors && errors.length > 0 && (
            <View style={styles.errorContainer}>
              {errors.map((error, index) => (
                <Text key={index} style={styles.errorText}>• {error}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 8,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
  },
  configContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  dayButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
  },
  dayButtonTextActive: {
    color: COLORS.white,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    gap: 10,
  },
  dateButtonText: {
    fontSize: 15,
    color: COLORS.black,
    flex: 1,
  },
  timezoneDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    gap: 10,
  },
  timezoneText: {
    fontSize: 15,
    color: COLORS.gray,
  },
  previewContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 10,
    marginTop: 8,
  },
  previewTextContainer: {
    flex: 1,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  occurrenceCount: {
    fontSize: 12,
    color: COLORS.gray,
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    marginBottom: 4,
  },
});

