/**
 * Frontend date formatter utility
 * Handles various timestamp formats and ensures proper timezone display
 */

export interface Timestamp {
  seconds: number;
  nanoseconds?: number;
}

/**
 * Formats a timestamp to a readable date string
 * @param timestamp - Can be a string, number, Date, or Timestamp object
 * @returns Formatted date string
 */
export const formatTimestamp = (timestamp: string | number | Date | Timestamp | null | undefined): string => {
  if (!timestamp) {
    return 'Unknown date';
  }

  let date: Date;

  try {
    // Handle different timestamp formats
    if (typeof timestamp === 'string') {
      // If it's already a formatted string, return as is
      if (timestamp.includes('at') || timestamp.includes('GMT') || timestamp.includes('AM') || timestamp.includes('PM')) {
        return timestamp;
      }
      // Try to parse as ISO string or other formats
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle Unix timestamp (seconds or milliseconds)
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      // Handle Firebase Timestamp format
      date = new Date(timestamp.seconds * 1000);
    } else {
      // Fallback
      date = new Date(timestamp);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    // Format the date using user's local timezone
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

  } catch (error) {
    console.error('Error formatting timestamp:', error, timestamp);
    return 'Invalid date';
  }
};

/**
 * Formats a timestamp to a shorter format (date only)
 * @param timestamp - Can be a string, number, Date, or Timestamp object
 * @returns Formatted date string (date only)
 */
export const formatDateOnly = (timestamp: string | number | Date | Timestamp | null | undefined): string => {
  if (!timestamp) {
    return 'Unknown date';
  }

  let date: Date;

  try {
    // Handle different timestamp formats
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

  } catch (error) {
    console.error('Error formatting date:', error, timestamp);
    return 'Invalid date';
  }
};

/**
 * Gets the relative time (e.g., "2 hours ago", "3 days ago")
 * @param timestamp - Can be a string, number, Date, or Timestamp object
 * @returns Relative time string
 */
export const getRelativeTime = (timestamp: string | number | Date | Timestamp | null | undefined): string => {
  if (!timestamp) {
    return 'Unknown time';
  }

  let date: Date;

  try {
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
      return 'Invalid time';
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return formatDateOnly(timestamp);
    }

  } catch (error) {
    console.error('Error getting relative time:', error, timestamp);
    return 'Invalid time';
  }
};
