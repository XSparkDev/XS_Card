/**
 * Frontend utilities for recurring events
 * Mirrors backend recurrenceCalculator logic for client-side formatting and parsing
 */

import { RecurrencePattern } from '../types/events';

/**
 * Format recurrence pattern for display
 * @param pattern - Recurrence pattern
 * @returns Display text (e.g., "Every Monday, Wednesday, Friday at 10:00 AM SAST")
 */
export function formatRecurrenceDisplay(pattern: RecurrencePattern | null | undefined): string {
  if (!pattern || pattern.type !== 'weekly') {
    return '';
  }
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const days = pattern.daysOfWeek
    .sort((a, b) => a - b)
    .map(d => dayNames[d])
    .join(', ');
  
  // Format time
  const time = pattern.startTime || '10:00';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  
  return `Every ${days} at ${formattedTime}`;
}

/**
 * Parse instanceId to extract date
 * @param instanceId - Format: "eventId_YYYY-MM-DD"
 * @returns Date object or null
 */
export function instanceIdToDate(instanceId: string): Date | null {
  try {
    const parts = instanceId.split('_');
    if (parts.length < 2) return null;
    
    const dateStr = parts[1]; // YYYY-MM-DD
    const date = new Date(dateStr + 'T00:00:00');
    
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Error parsing instanceId:', error);
    return null;
  }
}

/**
 * Format instance date for display
 * @param instanceId - Instance ID
 * @param time - Time string (HH:mm)
 * @returns Formatted date string
 */
export function formatInstanceDate(instanceId: string, time?: string): string {
  const date = instanceIdToDate(instanceId);
  if (!date) return 'Invalid date';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  let dateStr = '';
  if (checkDate.getTime() === today.getTime()) {
    dateStr = 'Today';
  } else if (checkDate.getTime() === tomorrow.getTime()) {
    dateStr = 'Tomorrow';
  } else {
    dateStr = date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
  
  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    return `${dateStr} at ${timeStr}`;
  }
  
  return dateStr;
}

/**
 * Validate recurrence pattern on client side
 * @param pattern - Pattern to validate
 * @returns Validation result
 */
export function validateRecurrencePattern(pattern: RecurrencePattern): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!pattern) {
    return { valid: false, errors: ['Pattern is required'] };
  }
  
  // Validate type
  if (!pattern.type || pattern.type !== 'weekly') {
    errors.push('Pattern type must be "weekly"');
  }
  
  // Validate daysOfWeek
  if (!pattern.daysOfWeek || !Array.isArray(pattern.daysOfWeek)) {
    errors.push('Days of week must be an array');
  } else if (pattern.daysOfWeek.length === 0) {
    errors.push('At least one day must be selected');
  } else {
    for (const day of pattern.daysOfWeek) {
      if (typeof day !== 'number' || day < 0 || day > 6) {
        errors.push(`Invalid day: ${day}. Must be 0-6 (Sunday-Saturday)`);
      }
    }
  }
  
  // Validate timezone
  if (!pattern.timezone) {
    errors.push('Timezone is required');
  }
  
  // Validate dates
  if (!pattern.startDate) {
    errors.push('Start date is required');
  }
  
  if (!pattern.endDate) {
    errors.push('End date is required');
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
 * Get day name from day number
 */
export function getDayName(dayNumber: number): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[dayNumber] || '';
}

/**
 * Get short day name from day number
 */
export function getShortDayName(dayNumber: number): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[dayNumber] || '';
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date >= today;
}

/**
 * Calculate number of occurrences in a date range
 */
export function calculateOccurrenceCount(pattern: RecurrencePattern): number {
  if (!pattern.startDate || !pattern.endDate || !pattern.daysOfWeek.length) {
    return 0;
  }
  
  const start = new Date(pattern.startDate);
  const end = new Date(pattern.endDate);
  
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (pattern.daysOfWeek.includes(dayOfWeek)) {
      const dateStr = current.toISOString().split('T')[0];
      if (!pattern.excludedDates || !pattern.excludedDates.includes(dateStr)) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Get next occurrence date from today
 */
export function getNextOccurrence(pattern: RecurrencePattern): Date | null {
  if (!pattern.startDate || !pattern.endDate || !pattern.daysOfWeek.length) {
    return null;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = new Date(Math.max(new Date(pattern.startDate).getTime(), today.getTime()));
  const end = new Date(pattern.endDate);
  
  const current = new Date(start);
  
  // Search for next 14 days max (for weekly patterns)
  for (let i = 0; i < 14; i++) {
    if (current > end) return null;
    
    const dayOfWeek = current.getDay();
    if (pattern.daysOfWeek.includes(dayOfWeek)) {
      const dateStr = current.toISOString().split('T')[0];
      if (!pattern.excludedDates || !pattern.excludedDates.includes(dateStr)) {
        return current;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return null;
}

