/**
 * Recurrence Calculator Utility
 * 
 * Handles recurring event instance generation, validation, and timezone management.
 * Supports weekly recurrence patterns with configurable days of week.
 */

const moment = require('moment-timezone');

// Configuration
const MAX_INSTANCES_PER_QUERY = 100;
const MAX_LOOKAHEAD_DAYS = 90;

/**
 * Generate instances for a recurring event
 * @param {Date|string} startDate - First occurrence date
 * @param {Date|string} endDate - Series end date
 * @param {Object} pattern - Recurrence pattern
 * @param {Object} options - Generation options
 * @returns {Array} Array of event instances
 */
function generateInstances(startDate, endDate, pattern, options = {}) {
  const maxInstances = options.maxInstances || MAX_INSTANCES_PER_QUERY;
  const lookaheadLimit = options.lookaheadDays || MAX_LOOKAHEAD_DAYS;
  
  const today = new Date();
  const lookaheadEnd = addDays(today, lookaheadLimit);
  
  // Cap endDate to lookahead limit
  const queryEndDate = new Date(endDate);
  const cappedEndDate = queryEndDate > lookaheadEnd ? lookaheadEnd : queryEndDate;
  
  const instances = [];
  let currentDate = new Date(startDate);
  
  // Ensure we start from today or later
  if (currentDate < today) {
    currentDate = today;
  }
  
  while (currentDate <= cappedEndDate && instances.length < maxInstances) {
    // Check if current date is in excludedDates
    const dateStr = formatDateYYYYMMDD(currentDate);
    if (pattern.excludedDates && pattern.excludedDates.includes(dateStr)) {
      currentDate = calculateNextOccurrence(currentDate, pattern);
      continue;
    }
    
    // Check if current day is in daysOfWeek for weekly pattern
    if (pattern.type === 'weekly') {
      const dayOfWeek = currentDate.getDay();
      if (pattern.daysOfWeek.includes(dayOfWeek)) {
        // Generate instance with timezone handling
        const instance = generateInstanceWithTimezone(currentDate, pattern);
        instances.push(instance);
      }
    }
    
    currentDate = addDays(currentDate, 1); // Move to next day
  }
  
  return instances;
}

/**
 * Generate a single instance with proper timezone handling
 * @param {Date} date - The date for this instance
 * @param {Object} pattern - Recurrence pattern
 * @returns {Object} Instance object
 */
function generateInstanceWithTimezone(date, pattern) {
  const tz = pattern.timezone || 'Africa/Johannesburg';
  const eventTime = pattern.startTime || '10:00';
  
  // Combine date with time in organizer's timezone
  const dateStr = formatDateYYYYMMDD(date);
  const instanceDateTime = moment.tz(`${dateStr} ${eventTime}`, 'YYYY-MM-DD HH:mm', tz);
  
  // Convert to UTC for storage
  const utcTimestamp = instanceDateTime.utc().toDate();
  
  // Generate instanceId
  const instanceId = `${pattern.eventId || 'event'}_${dateStr}`;
  
  return {
    instanceId,
    eventDate: utcTimestamp,
    eventDateISO: instanceDateTime.toISOString(),
    localTime: eventTime,
    localTimeFormatted: instanceDateTime.format('h:mm A'),
    timezone: tz,
    timezoneAbbr: instanceDateTime.format('z'), // e.g., "SAST"
    date: dateStr,
    dayOfWeek: instanceDateTime.format('dddd'), // e.g., "Monday"
    isCancelled: false
  };
}

/**
 * Calculate next occurrence based on pattern
 * @param {Date} currentDate - Current date
 * @param {Object} pattern - Recurrence pattern
 * @returns {Date} Next occurrence date
 */
function calculateNextOccurrence(currentDate, pattern) {
  if (pattern.type === 'weekly') {
    // For weekly, just move to next day (caller will check daysOfWeek)
    return addDays(currentDate, 1);
  }
  
  // Future: Add daily, monthly patterns
  return addDays(currentDate, 7); // Default to weekly
}

/**
 * Validate recurrence pattern
 * @param {Object} pattern - Recurrence pattern to validate
 * @returns {Object} Validation result {valid: boolean, errors: Array}
 */
function validatePattern(pattern) {
  const errors = [];
  
  if (!pattern) {
    return { valid: false, errors: ['Pattern is required'] };
  }
  
  // Validate type
  if (!pattern.type || pattern.type !== 'weekly') {
    errors.push('Pattern type must be "weekly" for MVP');
  }
  
  // Validate daysOfWeek
  if (!pattern.daysOfWeek || !Array.isArray(pattern.daysOfWeek)) {
    errors.push('daysOfWeek must be an array');
  } else if (pattern.daysOfWeek.length === 0) {
    errors.push('At least one day of week must be selected');
  } else {
    // Validate each day is 0-6
    for (const day of pattern.daysOfWeek) {
      if (typeof day !== 'number' || day < 0 || day > 6) {
        errors.push(`Invalid day of week: ${day}. Must be 0-6 (Sunday-Saturday)`);
      }
    }
  }
  
  // Validate timezone
  if (!pattern.timezone) {
    errors.push('Timezone is required');
  } else if (!moment.tz.zone(pattern.timezone)) {
    errors.push(`Invalid timezone: ${pattern.timezone}`);
  }
  
  // Validate dates
  if (!pattern.startDate) {
    errors.push('Start date is required');
  }
  
  if (!pattern.endDate) {
    errors.push('End date is required for MVP');
  }
  
  if (pattern.startDate && pattern.endDate) {
    const start = new Date(pattern.startDate);
    const end = new Date(pattern.endDate);
    
    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }
  
  // Validate startTime
  if (!pattern.startTime) {
    errors.push('Start time is required');
  } else if (!/^\d{2}:\d{2}$/.test(pattern.startTime)) {
    errors.push('Start time must be in HH:mm format (e.g., "10:00")');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format recurrence pattern for display
 * @param {Object} pattern - Recurrence pattern
 * @returns {string} Display text (e.g., "Every Monday, Wednesday, Friday at 10:00 AM SAST")
 */
function formatRecurrenceDisplay(pattern) {
  if (!pattern || pattern.type !== 'weekly') {
    return '';
  }
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days = pattern.daysOfWeek
    .sort((a, b) => a - b)
    .map(d => dayNames[d])
    .join(', ');
  
  const tz = pattern.timezone || 'Africa/Johannesburg';
  const time = pattern.startTime || '10:00';
  
  // Format time with timezone
  const momentTime = moment.tz(`2000-01-01 ${time}`, 'YYYY-MM-DD HH:mm', tz);
  const formattedTime = momentTime.format('h:mm A');
  const tzAbbr = momentTime.format('z'); // e.g., "SAST"
  
  return `Every ${days} at ${formattedTime} ${tzAbbr}`;
}

/**
 * Find the next occurrence from today
 * @param {Date} fromDate - Date to calculate from
 * @param {Object} pattern - Recurrence pattern
 * @returns {Date|null} Next occurrence date or null if series ended
 */
function findNextOccurrence(fromDate, pattern) {
  const start = new Date(fromDate);
  const end = new Date(pattern.endDate);
  
  if (start > end) {
    return null; // Series has ended
  }
  
  let current = new Date(start);
  
  // Search for next occurrence (max 14 days ahead for weekly)
  for (let i = 0; i < 14; i++) {
    if (current > end) {
      return null;
    }
    
    const dayOfWeek = current.getDay();
    if (pattern.daysOfWeek.includes(dayOfWeek)) {
      const dateStr = formatDateYYYYMMDD(current);
      // Check if not excluded
      if (!pattern.excludedDates || !pattern.excludedDates.includes(dateStr)) {
        return current;
      }
    }
    
    current = addDays(current, 1);
  }
  
  return null;
}

/**
 * Check if series is active (hasn't ended)
 * @param {Object} pattern - Recurrence pattern
 * @returns {boolean} True if series is still active
 */
function isSeriesActive(pattern) {
  if (!pattern || !pattern.endDate) {
    return false;
  }
  
  const endDate = new Date(pattern.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  return endDate >= today;
}

// Helper functions

/**
 * Add days to a date
 * @param {Date} date - Source date
 * @param {number} days - Number of days to add
 * @returns {Date} New date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  generateInstances,
  generateInstanceWithTimezone,
  calculateNextOccurrence,
  validatePattern,
  formatRecurrenceDisplay,
  findNextOccurrence,
  isSeriesActive,
  MAX_INSTANCES_PER_QUERY,
  MAX_LOOKAHEAD_DAYS
};

