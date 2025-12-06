import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/colors';
import { RecurrencePattern } from '../../types/events';

interface RecurrenceConfigProps {
  value: RecurrencePattern | null;
  onChange: (pattern: RecurrencePattern | null) => void;
  startDate: string; // Event start date
  errors?: Record<string, string>;
  timezone?: string; // Default to user's timezone
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Default timezone - can be enhanced to detect from device
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const DEFAULT_TIMEZONE_ABBR = 'SAST';

export default function RecurrenceConfig({
  value,
  onChange,
  startDate,
  errors = {},
  timezone = DEFAULT_TIMEZONE,
}: RecurrenceConfigProps) {
  // Calculate default end date (3 months from start date)
  const getDefaultEndDate = () => {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 3);
    return end.toISOString().split('T')[0];
  };

  const [isRecurring, setIsRecurring] = useState(!!value);
  const [pattern, setPattern] = useState<Partial<RecurrencePattern>>(() => {
    if (value) {
      return value;
    }
    // Initialize with default end date
    return {
      type: 'weekly',
      daysOfWeek: [],
      timezone: timezone,
      startDate: startDate.split('T')[0], // Extract date part
      startTime: new Date(startDate).toTimeString().slice(0, 5), // Extract HH:mm
      endDate: getDefaultEndDate(), // Default to 3 months from start
      frequency: 1,
    };
  });
  // Default to false (end date required by default)
  const [neverEnds, setNeverEnds] = useState(value ? !value.endDate : false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const isInitializing = useRef(false);

  // Initialize from value prop when it changes
  useEffect(() => {
    if (value && !isInitializing.current) {
      isInitializing.current = true;
      setIsRecurring(true);
      setPattern(value);
      setNeverEnds(!value.endDate);
      setTimeout(() => { isInitializing.current = false; }, 100);
    } else if (!value && !isRecurring) {
      setIsRecurring(false);
    }
  }, [value?.type, value?.startDate]); // Only depend on key identifying fields

  // Ensure endDate is set in pattern state when recurring is enabled and neverEnds is false
  useEffect(() => {
    if (isRecurring && !neverEnds && !pattern.endDate) {
      const currentStartDate = pattern.startDate || startDate.split('T')[0];
      const start = new Date(currentStartDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 3);
      const defaultEndDate = end.toISOString().split('T')[0];
      setPattern(prev => ({ ...prev, endDate: defaultEndDate }));
    }
  }, [isRecurring, neverEnds, pattern.startDate, startDate]);

  // Update parent when pattern changes (but not during initialization)
  useEffect(() => {
    if (isInitializing.current) return;
    
    if (isRecurring) {
      // Calculate current start date for default end date calculation
      const currentStartDate = pattern.startDate || startDate.split('T')[0];
      
      // Ensure endDate is set if neverEnds is false
      let finalEndDate = pattern.endDate;
      if (!neverEnds) {
        if (!finalEndDate) {
          // Calculate default end date (3 months from start)
          const start = new Date(currentStartDate);
          const end = new Date(start);
          end.setMonth(end.getMonth() + 3);
          finalEndDate = end.toISOString().split('T')[0];
          // Update pattern state with default end date so UI shows it
          setPattern(prev => ({ ...prev, endDate: finalEndDate }));
          // Return early to let the state update trigger this effect again
          return;
        }
      }
      
      const newPattern: RecurrencePattern = {
        type: pattern.type || 'weekly',
        daysOfWeek: pattern.daysOfWeek || (pattern.type === 'weekly' ? [] : undefined),
        timezone: pattern.timezone || timezone,
        startDate: currentStartDate,
        startTime: pattern.startTime || new Date(startDate).toTimeString().slice(0, 5),
        // Only set endDate to undefined if neverEnds is true, otherwise use the calculated value
        endDate: neverEnds ? undefined : finalEndDate,
        frequency: pattern.frequency || 1,
        dayOfMonth: pattern.dayOfMonth,
      } as RecurrencePattern;
      onChange(newPattern);
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecurring, pattern.type, pattern.daysOfWeek?.length, pattern.startDate, pattern.startTime, pattern.endDate, pattern.frequency, pattern.dayOfMonth, neverEnds]);

  const updatePattern = (updates: Partial<RecurrencePattern>) => {
    setPattern(prev => ({ ...prev, ...updates }));
  };

  const toggleDayOfWeek = (day: number) => {
    const currentDays = pattern.daysOfWeek || [];
    if (currentDays.includes(day)) {
      if (currentDays.length > 1) {
        updatePattern({ daysOfWeek: currentDays.filter(d => d !== day) });
      }
    } else {
      updatePattern({ daysOfWeek: [...currentDays, day].sort() });
    }
  };

  const formatRecurrenceText = (): string => {
    if (!isRecurring || !pattern.type) return '';
    
    const freq = pattern.frequency || 1;
    const time = pattern.startTime || '10:00';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;
    
    switch (pattern.type) {
      case 'daily':
        if (freq === 1) {
          return `Every day at ${formattedTime} ${DEFAULT_TIMEZONE_ABBR}`;
        }
        return `Every ${freq} days at ${formattedTime} ${DEFAULT_TIMEZONE_ABBR}`;
      case 'weekly':
        const days = (pattern.daysOfWeek || [])
          .map(d => DAY_NAMES_FULL[d])
          .join(', ');
        if (freq === 1) {
          return `Every ${days} at ${formattedTime} ${DEFAULT_TIMEZONE_ABBR}`;
        }
        return `Every ${freq} weeks on ${days} at ${formattedTime} ${DEFAULT_TIMEZONE_ABBR}`;
      case 'monthly':
        const day = pattern.dayOfMonth || 1;
        const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
        return `Every month on the ${day}${suffix} at ${formattedTime} ${DEFAULT_TIMEZONE_ABBR}`;
      default:
        return '';
    }
  };

  const getNextOccurrences = (): string[] => {
    if (!isRecurring || !pattern.type || !pattern.startDate || !pattern.startTime) {
      return [];
    }
    
    const occurrences: string[] = [];
    const start = new Date(`${pattern.startDate}T${pattern.startTime}`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let current = new Date(start);
    const freq = pattern.frequency || 1;
    let count = 0;
    const maxOccurrences = 5;
    
    while (count < maxOccurrences && current <= new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)) {
      if (current >= today) {
        const dateStr = current.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
        occurrences.push(dateStr);
        count++;
      }
      
      // Calculate next occurrence based on type
      switch (pattern.type) {
        case 'daily':
          current = new Date(current);
          current.setDate(current.getDate() + freq);
          break;
        case 'weekly':
          current = new Date(current);
          current.setDate(current.getDate() + (7 * freq));
          break;
        case 'monthly':
          current = new Date(current);
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }
    
    return occurrences;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recurring Event</Text>
        <Switch
          value={isRecurring}
          onValueChange={setIsRecurring}
          trackColor={{ false: COLORS.gray, true: COLORS.primary }}
          thumbColor={COLORS.white}
        />
      </View>

      {isRecurring && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>
            Create a series of events that repeat automatically
          </Text>

          {/* Recurrence Type Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>Repeat Pattern *</Text>
            <View style={styles.typeSelector}>
              {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    pattern.type === type && styles.typeButtonActive,
                  ]}
                  onPress={() => {
                    updatePattern({ type });
                    if (type !== 'weekly') {
                      updatePattern({ daysOfWeek: undefined });
                    }
                    if (type !== 'monthly') {
                      updatePattern({ dayOfMonth: undefined });
                    }
                  }}
                >
                  <MaterialIcons
                    name={type === 'daily' ? 'today' : type === 'weekly' ? 'date-range' : 'calendar-month'}
                    size={20}
                    color={pattern.type === type ? COLORS.white : COLORS.gray}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      pattern.type === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
          </View>

          {/* Frequency Input (for Daily/Weekly) */}
          {(pattern.type === 'daily' || pattern.type === 'weekly') && (
            <View style={styles.section}>
              <Text style={styles.label}>
                Frequency: Every {pattern.type === 'daily' ? 'N days' : 'N weeks'} *
              </Text>
              <TextInput
                style={[styles.input, errors.frequency && styles.inputError]}
                value={(pattern.frequency || 1).toString()}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num >= 1) {
                    updatePattern({ frequency: num });
                  } else if (text === '') {
                    updatePattern({ frequency: 1 });
                  }
                }}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={COLORS.gray}
              />
              {errors.frequency && <Text style={styles.errorText}>{errors.frequency}</Text>}
            </View>
          )}

          {/* Days of Week Picker (Weekly only) */}
          {pattern.type === 'weekly' && (
            <View style={styles.section}>
              <Text style={styles.label}>Days of Week *</Text>
              <View style={styles.daysContainer}>
                {DAY_NAMES.map((day, index) => {
                  const isSelected = (pattern.daysOfWeek || []).includes(index);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayButton,
                        isSelected && styles.dayButtonActive,
                      ]}
                      onPress={() => toggleDayOfWeek(index)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          isSelected && styles.dayButtonTextActive,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.daysOfWeek && <Text style={styles.errorText}>{errors.daysOfWeek}</Text>}
            </View>
          )}

          {/* Day of Month Selector (Monthly only) */}
          {pattern.type === 'monthly' && (
            <View style={styles.section}>
              <Text style={styles.label}>Day of Month *</Text>
              <View style={styles.dayOfMonthContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayOfMonthButton,
                      pattern.dayOfMonth === day && styles.dayOfMonthButtonActive,
                    ]}
                    onPress={() => updatePattern({ dayOfMonth: day })}
                  >
                    <Text
                      style={[
                        styles.dayOfMonthButtonText,
                        pattern.dayOfMonth === day && styles.dayOfMonthButtonTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.dayOfMonth && <Text style={styles.errorText}>{errors.dayOfMonth}</Text>}
            </View>
          )}

          {/* Start Date Picker */}
          <View style={styles.section}>
            <Text style={styles.label}>Start Date *</Text>
            <TouchableOpacity
              style={[styles.dateInput, errors.startDate && styles.inputError]}
              onPress={() => {
                setTempDate(new Date(`${pattern.startDate || startDate.split('T')[0]}T${pattern.startTime || '10:00'}`));
                setShowStartDatePicker(true);
              }}
            >
              <Text style={styles.dateText}>
                {pattern.startDate || startDate.split('T')[0]}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color={COLORS.gray} />
            </TouchableOpacity>
            {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
          </View>

          {/* Time Picker */}
          <View style={styles.section}>
            <Text style={styles.label}>Time *</Text>
            <TouchableOpacity
              style={[styles.dateInput, errors.startTime && styles.inputError]}
              onPress={() => {
                const [hours, minutes] = (pattern.startTime || '10:00').split(':');
                const timeDate = new Date();
                timeDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                setTempDate(timeDate);
                setShowTimePicker(true);
              }}
            >
              <Text style={styles.dateText}>
                {pattern.startTime || '10:00'}
              </Text>
              <MaterialIcons name="access-time" size={20} color={COLORS.gray} />
            </TouchableOpacity>
            {errors.startTime && <Text style={styles.errorText}>{errors.startTime}</Text>}
          </View>

          {/* End Date Picker */}
          <View style={styles.section}>
            <View style={styles.neverEndsRow}>
              <Text style={styles.label}>End Date</Text>
              <View style={styles.neverEndsContainer}>
                <Text style={styles.neverEndsLabel}>Never ends</Text>
                <Switch
                  value={neverEnds}
                  onValueChange={(value) => {
                    setNeverEnds(value);
                    // If turning off "never ends", set a default end date if not already set
                    if (!value && !pattern.endDate) {
                      const defaultEndDate = getDefaultEndDate();
                      updatePattern({ endDate: defaultEndDate });
                    }
                  }}
                  trackColor={{ false: COLORS.gray, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>
            {neverEnds ? (
              <View style={[styles.neverEndsTextContainer, styles.disabledContainer]}>
                <Text style={styles.neverEndsText}>Continues indefinitely</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.dateInput, errors.endDate && styles.inputError]}
                  onPress={() => {
                    // Calculate current end date (use pattern.endDate or default)
                    const currentStartDate = pattern.startDate || startDate.split('T')[0];
                    const currentEndDate = pattern.endDate || (() => {
                      const start = new Date(currentStartDate);
                      const end = new Date(start);
                      end.setMonth(end.getMonth() + 3);
                      return end.toISOString().split('T')[0];
                    })();
                    setTempDate(new Date(currentEndDate));
                    setShowEndDatePicker(true);
                  }}
                >
                  <Text style={styles.dateText}>
                    {(() => {
                      // Always show end date - use pattern.endDate or calculate default
                      if (pattern.endDate) {
                        return pattern.endDate;
                      }
                      const currentStartDate = pattern.startDate || startDate.split('T')[0];
                      const start = new Date(currentStartDate);
                      const end = new Date(start);
                      end.setMonth(end.getMonth() + 3);
                      return end.toISOString().split('T')[0];
                    })()}
                  </Text>
                  <MaterialIcons name="event" size={20} color={COLORS.gray} />
                </TouchableOpacity>
                {errors.endDate && <Text style={styles.errorText}>{errors.endDate}</Text>}
              </>
            )}
          </View>

          {/* Timezone Display */}
          <View style={styles.section}>
            <Text style={styles.label}>Timezone</Text>
            <View style={styles.timezoneContainer}>
              <Text style={styles.timezoneText}>
                {timezone} ({DEFAULT_TIMEZONE_ABBR})
              </Text>
              <MaterialIcons name="info-outline" size={16} color={COLORS.gray} />
            </View>
            <Text style={styles.helpText}>
              All instances will use this timezone
            </Text>
          </View>

          {/* Live Preview */}
          <View style={styles.section}>
            <Text style={styles.label}>Preview</Text>
            <View style={styles.previewContainer}>
              <Text style={styles.previewText}>{formatRecurrenceText() || 'Configure recurrence pattern'}</Text>
              {getNextOccurrences().length > 0 && (
                <View style={styles.occurrencesContainer}>
                  <Text style={styles.occurrencesLabel}>Upcoming dates:</Text>
                  {getNextOccurrences().map((date, index) => (
                    <Text key={index} style={styles.occurrenceText}>• {date}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Date Pickers */}
          {showStartDatePicker && (
            <DateTimePicker
              value={tempDate}
              mode={Platform.OS === 'ios' ? 'date' : 'date'}
              display="default"
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowStartDatePicker(false);
                if (event.type === 'set' && selectedDate) {
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  updatePattern({ startDate: dateStr });
                }
              }}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={tempDate}
              mode={Platform.OS === 'ios' ? 'date' : 'date'}
              display="default"
              minimumDate={new Date(pattern.startDate || startDate.split('T')[0])}
              onChange={(event, selectedDate) => {
                setShowEndDatePicker(false);
                if (event.type === 'set' && selectedDate) {
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  updatePattern({ endDate: dateStr });
                }
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={tempDate}
              mode="time"
              display="default"
              is24Hour={true}
              onChange={(event, selectedTime) => {
                setShowTimePicker(false);
                if (event.type === 'set' && selectedTime) {
                  const hours = String(selectedTime.getHours()).padStart(2, '0');
                  const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                  updatePattern({ startTime: `${hours}:${minutes}` });
                }
              }}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  description: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 16,
  },
  content: {
    maxHeight: 600,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: COLORS.white,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonActive: {
    backgroundColor: COLORS.primary,
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  dayButtonTextActive: {
    color: COLORS.white,
  },
  dayOfMonthContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayOfMonthButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOfMonthButtonActive: {
    backgroundColor: COLORS.primary,
  },
  dayOfMonthButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  dayOfMonthButtonTextActive: {
    color: COLORS.white,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 8,
    padding: 12,
    backgroundColor: COLORS.white,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.black,
  },
  neverEndsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  neverEndsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neverEndsLabel: {
    fontSize: 14,
    color: COLORS.black,
  },
  neverEndsTextContainer: {
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  disabledContainer: {
    opacity: 0.6,
    backgroundColor: COLORS.background + '80',
  },
  neverEndsText: {
    fontSize: 14,
    color: COLORS.gray,
    fontStyle: 'italic',
  },
  timezoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  timezoneText: {
    fontSize: 14,
    color: COLORS.black,
    flex: 1,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
  },
  previewContainer: {
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  previewText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
    marginBottom: 8,
  },
  occurrencesContainer: {
    marginTop: 8,
  },
  occurrencesLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  occurrenceText: {
    fontSize: 12,
    color: COLORS.black,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
});

