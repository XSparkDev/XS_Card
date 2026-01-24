/**
 * Recurrence Calculator Utility
 * 
 * Handles recurring event instance generation, validation, and timezone management.
 * Supports daily, weekly, monthly, and yearly recurrence patterns.
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
  
  // If no endDate (never ends), use lookahead limit as the effective end date
  // Cap endDate to lookahead limit
  let effectiveEndDate;
  if (endDate) {
    effectiveEndDate = new Date(endDate);
  } else {
    // No end date - use lookahead limit
    effectiveEndDate = lookaheadEnd;
  }
  const cappedEndDate = effectiveEndDate > lookaheadEnd ? lookaheadEnd : effectiveEndDate;
  
  const instances = [];
  let currentDate = new Date(startDate);
  
  // Ensure we start from today or later
  if (currentDate < today) {
    currentDate = today;
  }
  
  const frequency = pattern.frequency || 1;
  
  while (currentDate <= cappedEndDate && instances.length < maxInstances) {
    // Check if current date is in excludedDates
    const dateStr = formatDateYYYYMMDD(currentDate);
    if (pattern.excludedDates && pattern.excludedDates.includes(dateStr)) {
      currentDate = calculateNextOccurrence(currentDate, pattern);
      continue;
    }
    
    let shouldInclude = false;
    
    // Handle different pattern types
    if (pattern.type === 'daily') {
      // For daily, check if we're on the right frequency interval
      const daysSinceStart = Math.floor((currentDate - new Date(startDate)) / (1000 * 60 * 60 * 24));
      if (daysSinceStart % frequency === 0) {
        shouldInclude = true;
      }
    } else if (pattern.type === 'weekly') {
      const dayOfWeek = currentDate.getDay();
      if (pattern.daysOfWeek && pattern.daysOfWeek.includes(dayOfWeek)) {
        // Check frequency for weekly (every N weeks)
        const daysSinceStart = Math.floor((currentDate - new Date(startDate)) / (1000 * 60 * 60 * 24));
        const weeksSinceStart = Math.floor(daysSinceStart / 7);
        if (weeksSinceStart % frequency === 0) {
          shouldInclude = true;
        }
      }
    } else if (pattern.type === 'monthly') {
      const startDay = new Date(startDate).getDate();
      const currentDay = currentDate.getDate();
      if (currentDay === startDay) {
        shouldInclude = true;
      }
    } else if (pattern.type === 'yearly') {
      const startDateObj = new Date(startDate);
      const startMonth = startDateObj.getMonth();
      const startDay = startDateObj.getDate();
      const currentMonth = currentDate.getMonth();
      const currentDay = currentDate.getDate();
      if (currentMonth === startMonth && currentDay === startDay) {
        shouldInclude = true;
      }
    }
    
    if (shouldInclude) {
      // Generate instance with timezone handling
      const instance = generateInstanceWithTimezone(currentDate, pattern);
      instances.push(instance);
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
  const frequency = pattern.frequency || 1;
  
  if (pattern.type === 'daily') {
    // For daily, move forward by frequency days
    return addDays(currentDate, frequency);
  } else if (pattern.type === 'weekly') {
    // For weekly, just move to next day (caller will check daysOfWeek)
    return addDays(currentDate, 1);
  } else if (pattern.type === 'monthly') {
    // For monthly, move to next month
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + 1);
    return next;
  } else if (pattern.type === 'yearly') {
    // For yearly, move to next year
    const next = new Date(currentDate);
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  
  // Default fallback
  return addDays(currentDate, 1);
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
  const validTypes = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!pattern.type || !validTypes.includes(pattern.type)) {
    errors.push(`Pattern type must be one of: ${validTypes.join(', ')}`);
  }
  
  // Validate type-specific fields
  if (pattern.type === 'weekly') {
    // Validate daysOfWeek for weekly
    if (!pattern.daysOfWeek || !Array.isArray(pattern.daysOfWeek)) {
      errors.push('daysOfWeek must be an array for weekly patterns');
    } else if (pattern.daysOfWeek.length === 0) {
      errors.push('At least one day of week must be selected for weekly patterns');
    } else {
      // Validate each day is 0-6
      for (const day of pattern.daysOfWeek) {
        if (typeof day !== 'number' || day < 0 || day > 6) {
          errors.push(`Invalid day of week: ${day}. Must be 0-6 (Sunday-Saturday)`);
        }
      }
    }
  } else if (pattern.type === 'monthly' || pattern.type === 'yearly') {
    // Validate dayOfMonth for monthly/yearly
    if (!pattern.dayOfMonth || typeof pattern.dayOfMonth !== 'number') {
      errors.push(`dayOfMonth is required for ${pattern.type} patterns`);
    } else if (pattern.dayOfMonth < 1 || pattern.dayOfMonth > 31) {
      errors.push('dayOfMonth must be between 1 and 31');
    }
  }
  
  // Validate frequency for daily/weekly
  if (pattern.type === 'daily' || pattern.type === 'weekly') {
    if (pattern.frequency !== undefined) {
      if (typeof pattern.frequency !== 'number' || pattern.frequency < 1) {
        errors.push('Frequency must be a number greater than 0');
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
  
  // End date is optional (for "never ends" feature)
  // Only validate if provided
  if (pattern.endDate) {
    if (pattern.startDate) {
      const start = new Date(pattern.startDate);
      const end = new Date(pattern.endDate);
      
      if (end <= start) {
        errors.push('End date must be after start date');
      }
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
  if (!pattern || !pattern.type) {
    return '';
  }
  
  const tz = pattern.timezone || 'Africa/Johannesburg';
  const time = pattern.startTime || '10:00';
  const frequency = pattern.frequency || 1;
  
  // Format time with timezone
  const momentTime = moment.tz(`2000-01-01 ${time}`, 'YYYY-MM-DD HH:mm', tz);
  const formattedTime = momentTime.format('h:mm A');
  const tzAbbr = momentTime.format('z'); // e.g., "SAST"
  
  if (pattern.type === 'daily') {
    if (frequency === 1) {
      return `Every day at ${formattedTime} ${tzAbbr}`;
    } else {
      return `Every ${frequency} days at ${formattedTime} ${tzAbbr}`;
    }
  } else if (pattern.type === 'weekly') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const days = pattern.daysOfWeek
      .sort((a, b) => a - b)
      .map(d => dayNames[d])
      .join(', ');
    
    if (frequency === 1) {
      return `Every ${days} at ${formattedTime} ${tzAbbr}`;
    } else {
      return `Every ${frequency} weeks on ${days} at ${formattedTime} ${tzAbbr}`;
    }
  } else if (pattern.type === 'monthly') {
    const day = pattern.dayOfMonth || 1;
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    return `Every month on the ${day}${suffix} at ${formattedTime} ${tzAbbr}`;
  } else if (pattern.type === 'yearly') {
    const startDate = new Date(pattern.startDate);
    const monthName = startDate.toLocaleDateString('en-US', { month: 'long' });
    const day = pattern.dayOfMonth || startDate.getDate();
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    return `Every year on ${monthName} ${day}${suffix} at ${formattedTime} ${tzAbbr}`;
  }
  
  return '';
}

/**
 * Find the next occurrence from today
 * @param {Date} fromDate - Date to calculate from
 * @param {Object} pattern - Recurrence pattern
 * @returns {Date|null} Next occurrence date or null if series ended
 */
function findNextOccurrence(fromDate, pattern) {
  const start = new Date(fromDate);
  
  // If endDate is provided, check if series has ended
  if (pattern.endDate) {
    const end = new Date(pattern.endDate);
    if (start > end) {
      return null; // Series has ended
    }
  }
  
  let current = new Date(start);
  const frequency = pattern.frequency || 1;
  const maxSearchDays = pattern.type === 'yearly' ? 730 : pattern.type === 'monthly' ? 90 : 30;
  
  // Search for next occurrence
  for (let i = 0; i < maxSearchDays; i++) {
    if (pattern.endDate) {
      const end = new Date(pattern.endDate);
      if (current > end) {
        return null;
      }
    }
    
    const dateStr = formatDateYYYYMMDD(current);
    // Check if not excluded
    if (pattern.excludedDates && pattern.excludedDates.includes(dateStr)) {
      current = addDays(current, 1);
      continue;
    }
    
    let isMatch = false;
    
    if (pattern.type === 'daily') {
      const daysSinceStart = Math.floor((current - new Date(pattern.startDate)) / (1000 * 60 * 60 * 24));
      if (daysSinceStart >= 0 && daysSinceStart % frequency === 0) {
        isMatch = true;
      }
    } else if (pattern.type === 'weekly') {
      const dayOfWeek = current.getDay();
      if (pattern.daysOfWeek && pattern.daysOfWeek.includes(dayOfWeek)) {
        const daysSinceStart = Math.floor((current - new Date(pattern.startDate)) / (1000 * 60 * 60 * 24));
        const weeksSinceStart = Math.floor(daysSinceStart / 7);
        if (weeksSinceStart >= 0 && weeksSinceStart % frequency === 0) {
          isMatch = true;
        }
      }
    } else if (pattern.type === 'monthly') {
      const startDateObj = new Date(pattern.startDate);
      const startDay = startDateObj.getDate();
      const currentDay = current.getDate();
      if (currentDay === startDay) {
        isMatch = true;
      }
    } else if (pattern.type === 'yearly') {
      const startDateObj = new Date(pattern.startDate);
      const startMonth = startDateObj.getMonth();
      const startDay = startDateObj.getDate();
      const currentMonth = current.getMonth();
      const currentDay = current.getDate();
      if (currentMonth === startMonth && currentDay === startDay) {
        isMatch = true;
      }
    }
    
    if (isMatch) {
      return current;
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
  if (!pattern) {
    return false;
  }
  
  // If no endDate, series never ends (active)
  if (!pattern.endDate) {
    return true;
  }
  
  const endDate = new Date(pattern.endDate + 'T00:00:00'); // Parse as local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  // Series is active only if endDate is in the future (after today)
  // If endDate is today or earlier, the series has ended
  return endDate > today;
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

