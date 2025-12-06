/**
 * Availability Service
 * Calculates available time slots based on calendar preferences
 */

/**
 * Get default calendar preferences
 */
function getDefaultPreferences() {
    return {
        enabled: true,
        workingHours: {
            monday: { start: '09:00', end: '17:00', enabled: true },
            tuesday: { start: '09:00', end: '17:00', enabled: true },
            wednesday: { start: '09:00', end: '17:00', enabled: true },
            thursday: { start: '09:00', end: '17:00', enabled: true },
            friday: { start: '09:00', end: '17:00', enabled: true },
            saturday: { start: '09:00', end: '17:00', enabled: false },
            sunday: { start: '09:00', end: '17:00', enabled: false }
        },
        bufferTime: 15,
        allowWeekends: false,
        allowedDurations: [30, 60],
        timezone: 'UTC',
        advanceBookingDays: 30,
        blockedDateRanges: [],
        defaultTimeRange: { start: '09:00', end: '17:00' },
        customTimes: false
    };
}

/**
 * Get day name from date (returns lowercase day name)
 */
function getDayName(date) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
}

/**
 * Parse time string (HH:MM) to minutes
 */
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:MM)
 */
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Generate time slots for a day based on working hours
 */
function generateTimeSlotsForDay(date, workingHours, allowedDurations, bufferTime = 15, preferences = null) {
    const dayName = getDayName(date);
    const dayConfig = workingHours[dayName];
    
    if (!dayConfig || !dayConfig.enabled) {
        return [];
    }

    const slots = [];

    // Determine if we should use default time range or custom times
    const useDefaultTimes = preferences && preferences.customTimes === false && preferences.defaultTimeRange;
    const startTime = useDefaultTimes ? preferences.defaultTimeRange.start : dayConfig.start;
    const endTime = useDefaultTimes ? preferences.defaultTimeRange.end : dayConfig.end;

    // Check if specific slots are defined (override working hours range) - only when customTimes is true
    const useSpecificSlots = preferences && preferences.customTimes !== false && dayConfig.specificSlots && Array.isArray(dayConfig.specificSlots) && dayConfig.specificSlots.length > 0;
    
    if (useSpecificSlots) {
        // Use specific slots only - allow all specific slots regardless of default time range
        // This gives users full control over their availability
        
        // Sort and validate specific slots
        const sortedSlots = dayConfig.specificSlots
            .filter(slot => {
                // Validate HH:MM format
                const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
                return timeRegex.test(slot);
            })
            .sort((a, b) => {
                const aMinutes = timeToMinutes(a);
                const bMinutes = timeToMinutes(b);
                return aMinutes - bMinutes;
            });

        // Generate slots from specific times
        // No restrictions - all specific slots are available for booking
        for (const timeStr of sortedSlots) {
            // All durations are available for specific slots
            // The user has explicitly defined these times, so respect their choice
            slots.push({
                time: timeStr,
                availableDurations: [...allowedDurations] // All allowed durations are available
            });
        }

        return slots;
    }

    // Fallback to range-based generation (current behavior)
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    // Use smaller intervals when buffer time is smaller than 30 minutes so buffers are respected more precisely
    const normalizedBuffer = Math.max(0, bufferTime || 0);
    let slotInterval = 30;
    if (normalizedBuffer > 0 && normalizedBuffer < 30) {
        slotInterval = Math.max(5, Math.min(30, normalizedBuffer));
    }

    // Use the minimum duration for slot generation
    const minDuration = Math.min(...allowedDurations);
    
    // Generate slots from start to end (minus minimum duration)
    for (let current = startMinutes; current + minDuration <= endMinutes; current += slotInterval) {
        const timeStr = minutesToTime(current);
        
        // Check which durations are available for this slot
        const availableDurations = [];
        for (const duration of allowedDurations) {
            if (current + duration <= endMinutes) {
                availableDurations.push(duration);
            }
        }
        
        if (availableDurations.length > 0) {
            slots.push({
                time: timeStr,
                availableDurations
            });
        }
    }

    return slots;
}

/**
 * Check if a slot conflicts with existing meetings
 */
function isSlotConflicting(slotTime, slotDuration, existingMeetings, bufferTime = 15) {
    const [slotHour, slotMinute] = slotTime.split(':').map(Number);
    const slotStart = slotHour * 60 + slotMinute;
    const slotEnd = slotStart + slotDuration;
    const bufferBefore = Math.max(0, bufferTime);
    const bufferAfter = Math.max(0, bufferTime);

    for (const meeting of existingMeetings) {
        if (!meeting.meetingWhen) continue;
        
        const meetingDate = meeting.meetingWhen.toDate ? meeting.meetingWhen.toDate() : new Date(meeting.meetingWhen);
        const meetingStart = meetingDate.getHours() * 60 + meetingDate.getMinutes();
        const meetingDuration = meeting.duration || 60;
        const meetingEnd = meetingStart + meetingDuration;

        // Expand meeting window by buffer on both sides
        const windowStart = meetingStart - bufferBefore;
        const windowEnd = meetingEnd + bufferAfter;

        // Overlap check between slot window and meeting window
        // A slot conflicts if it overlaps with the blocked window
        // - If slot ends exactly at windowStart, it's OK (no overlap, ends when buffer begins)
        // - If slot starts at or before windowEnd, it should be blocked (can't start during or at end of buffer)
        // - Any slot that overlaps the window should be blocked
        // So: slotStart <= windowEnd && slotEnd > windowStart
        if (slotStart <= windowEnd && slotEnd > windowStart) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a specific slot is available
 */
function isSlotAvailable(slotTime, date, duration, existingMeetings, bufferTime = 15, preferences = null) {
    // Check if date is blocked
    if (preferences && preferences.blockedDateRanges && Array.isArray(preferences.blockedDateRanges)) {
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        const currentDayOfMonth = checkDate.getDate();
        
        for (const range of preferences.blockedDateRanges) {
            const startDateStr = range.startDate || range.start;
            const endDateStr = range.endDate || range.end;
            
            if (!startDateStr || !endDateStr) continue;
            
            if (range.repeatMonthly) {
                // For monthly repeats, check if the day of month falls within the range
                const rangeStart = new Date(startDateStr);
                const rangeEnd = new Date(endDateStr);
                const rangeStartDay = rangeStart.getDate();
                const rangeEndDay = rangeEnd.getDate();
                
                if (rangeStartDay <= rangeEndDay) {
                    // Normal range (e.g., 7th to 15th)
                    if (currentDayOfMonth >= rangeStartDay && currentDayOfMonth <= rangeEndDay) {
                        return false;
                    }
                } else {
                    // Range spans month boundary (e.g., 25th to 5th)
                    if (currentDayOfMonth >= rangeStartDay || currentDayOfMonth <= rangeEndDay) {
                        return false;
                    }
                }
            } else {
                // For specific dates, check if current date falls within the range
                const rangeStart = new Date(startDateStr);
                const rangeEnd = new Date(endDateStr);
                rangeStart.setHours(0, 0, 0, 0);
                rangeEnd.setHours(23, 59, 59, 999);
                
                if (checkDate >= rangeStart && checkDate <= rangeEnd) {
                    return false;
                }
            }
        }
    }
    
    // Check if slot conflicts with existing meetings
    const conflicts = isSlotConflicting(slotTime, duration, existingMeetings, bufferTime);
    
    return !conflicts;
}

/**
 * Calculate available slots for a date range
 */
function calculateAvailableSlots(userId, startDate, daysToCalculate, preferences, existingMeetings) {
    const availability = {};
    const workingHours = preferences.workingHours || getDefaultPreferences().workingHours;
    const allowedDurations = preferences.allowedDurations || [30, 60];
    const bufferTime = preferences.bufferTime || 15;
    const allowWeekends = preferences.allowWeekends || false;
    
    // Filter existing meetings for the date range
    const startTimestamp = startDate.getTime();
    const endTimestamp = startTimestamp + (daysToCalculate * 24 * 60 * 60 * 1000);
    
    const relevantMeetings = existingMeetings.filter(meeting => {
        if (!meeting.meetingWhen) return false;
        
        const meetingDate = meeting.meetingWhen.toDate ? meeting.meetingWhen.toDate() : new Date(meeting.meetingWhen);
        const meetingTimestamp = meetingDate.getTime();
        
        return meetingTimestamp >= startTimestamp && meetingTimestamp < endTimestamp;
    });

    // Group meetings by date
    const meetingsByDate = {};
    for (const meeting of relevantMeetings) {
        if (!meeting.meetingWhen) continue;
        
        const meetingDate = meeting.meetingWhen.toDate ? meeting.meetingWhen.toDate() : new Date(meeting.meetingWhen);
        // Use local date components to avoid timezone issues
        const year = meetingDate.getFullYear();
        const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
        const day = String(meetingDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        
        if (!meetingsByDate[dateKey]) {
            meetingsByDate[dateKey] = [];
        }
        meetingsByDate[dateKey].push(meeting);
    }

    // Generate availability for each day
    // Parse startDate properly to avoid timezone issues
    let startDateObj;
    if (typeof startDate === 'string') {
        // Parse date string (YYYY-MM-DD) as local date to avoid timezone conversion
        const [year, month, day] = startDate.split('-').map(Number);
        startDateObj = new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight
    } else {
        startDateObj = new Date(startDate);
    }
    
    for (let i = 0; i < daysToCalculate; i++) {
        const currentDate = new Date(startDateObj);
        currentDate.setDate(currentDate.getDate() + i);
        currentDate.setHours(0, 0, 0, 0);
        
        // Use local date components to create dateKey, avoiding timezone conversion
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        const dayName = getDayName(currentDate);
        
        // Skip weekends if not allowed
        if (!allowWeekends && (dayName === 'saturday' || dayName === 'sunday')) {
            continue;
        }

        // Check if date is in blocked ranges
        if (preferences.blockedDateRanges && Array.isArray(preferences.blockedDateRanges)) {
            let isBlocked = false;
            const currentDayOfMonth = currentDate.getDate();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            
            for (const range of preferences.blockedDateRanges) {
                // Support both old format (start/end) and new format (startDate/endDate)
                const startDateStr = range.startDate || range.start;
                const endDateStr = range.endDate || range.end;
                
                if (!startDateStr || !endDateStr) continue;
                
                if (range.repeatMonthly) {
                    // For monthly repeats, check if the day of month falls within the range
                    const rangeStart = new Date(startDateStr);
                    const rangeEnd = new Date(endDateStr);
                    const rangeStartDay = rangeStart.getDate();
                    const rangeEndDay = rangeEnd.getDate();
                    
                    // Check if current day of month falls within the range
                    if (rangeStartDay <= rangeEndDay) {
                        // Normal range (e.g., 7th to 15th)
                        if (currentDayOfMonth >= rangeStartDay && currentDayOfMonth <= rangeEndDay) {
                            isBlocked = true;
                            break;
                        }
                    } else {
                        // Range spans month boundary (e.g., 25th to 5th)
                        if (currentDayOfMonth >= rangeStartDay || currentDayOfMonth <= rangeEndDay) {
                            isBlocked = true;
                            break;
                        }
                    }
                } else {
                    // For specific dates, check if current date falls within the range
                    const rangeStart = new Date(startDateStr);
                    const rangeEnd = new Date(endDateStr);
                    rangeStart.setHours(0, 0, 0, 0);
                    rangeEnd.setHours(23, 59, 59, 999);
                    
                    if (currentDate >= rangeStart && currentDate <= rangeEnd) {
                        isBlocked = true;
                        break;
                    }
                }
            }
            if (isBlocked) {
                continue;
            }
        }

        // Generate base time slots for the day
        const daySlots = generateTimeSlotsForDay(currentDate, workingHours, allowedDurations, bufferTime, preferences);
        const dateMeetings = meetingsByDate[dateKey] || [];
        
        // Mark slots as available or unavailable (don't filter them out)
        const processedSlots = daySlots.map(slot => {
            // Check each available duration for this slot
            const validDurations = slot.availableDurations.filter(duration => {
                return !isSlotConflicting(slot.time, duration, dateMeetings, bufferTime);
            });
            
            // Mark slot as available if at least one duration is available
            const isAvailable = validDurations.length > 0;
            
            return {
                time: slot.time,
                availableDurations: validDurations,
                available: isAvailable, // Add availability flag
                allDurations: slot.availableDurations // Keep original durations for display
            };
        });

        // Include all slots (both available and unavailable)
        if (processedSlots.length > 0) {
            availability[dateKey] = processedSlots;
        }
    }

    return availability;
}

module.exports = {
    getDefaultPreferences,
    calculateAvailableSlots,
    isSlotAvailable,
    generateTimeSlotsForDay
};

