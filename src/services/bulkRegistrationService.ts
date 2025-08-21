import { authenticatedFetchWithRefresh, ENDPOINTS } from '../utils/api';

export interface AttendeeDetail {
  name: string;
  email: string;
  phone?: string;
}

export interface BulkRegistrationRequest {
  quantity: number;
  attendeeDetails: AttendeeDetail[];
  paymentMethod?: string;
}

export interface BulkRegistrationResponse {
  success: boolean;
  message: string;
  data: {
    bulkRegistrationId: string;
    paymentUrl?: string;
    reference?: string;
    totalAmount: number;
    quantity: number;
  };
}

export interface BulkRegistrationDetails {
  id: string;
  eventId: string;
  userId: string;
  quantity: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  paymentMethod?: string;
  attendeeDetails: AttendeeDetail[];
  createdAt: any;
  updatedAt: any;
  paymentReference?: string;
  paymentUrl?: string;
  paymentStatus?: string;
  completedAt?: any;
  ticketIds?: string[];
  tickets?: any[];
  event?: any;
}

/**
 * Create a bulk registration for multiple attendees
 */
export const createBulkRegistration = async (
  eventId: string, 
  request: BulkRegistrationRequest
): Promise<BulkRegistrationResponse> => {
  try {
    const endpoint = ENDPOINTS.CREATE_BULK_REGISTRATION.replace(':eventId', eventId);
    
    const response = await authenticatedFetchWithRefresh(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create bulk registration');
    }

    return data;
  } catch (error) {
    console.error('Bulk registration error:', error);
    throw error;
  }
};

/**
 * Get details of a specific bulk registration
 */
export const getBulkRegistration = async (bulkRegistrationId: string): Promise<BulkRegistrationDetails> => {
  try {
    const endpoint = ENDPOINTS.GET_BULK_REGISTRATION.replace(':bulkRegistrationId', bulkRegistrationId);
    
    const response = await authenticatedFetchWithRefresh(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get bulk registration details');
    }

    return data.data;
  } catch (error) {
    console.error('Get bulk registration error:', error);
    throw error;
  }
};

/**
 * Get all bulk registrations for the current user
 */
export const getUserBulkRegistrations = async (): Promise<BulkRegistrationDetails[]> => {
  try {
    const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_USER_BULK_REGISTRATIONS);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user bulk registrations');
    }

    return data.data;
  } catch (error) {
    console.error('Get user bulk registrations error:', error);
    throw error;
  }
};

/**
 * Cancel a bulk registration (if payment is still pending)
 */
export const cancelBulkRegistration = async (bulkRegistrationId: string): Promise<void> => {
  try {
    const endpoint = ENDPOINTS.CANCEL_BULK_REGISTRATION.replace(':bulkRegistrationId', bulkRegistrationId);
    
    const response = await authenticatedFetchWithRefresh(endpoint, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to cancel bulk registration');
    }
  } catch (error) {
    console.error('Cancel bulk registration error:', error);
    throw error;
  }
};

/**
 * Check if an event allows bulk registrations
 */
export const checkEventBulkRegistrationSupport = (event: any): boolean => {
  return event.allowBulkRegistrations === true;
};

/**
 * Validate attendee details for bulk registration
 */
export const validateAttendeeDetails = (attendeeDetails: AttendeeDetail[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!attendeeDetails || !Array.isArray(attendeeDetails)) {
    errors.push('Attendee details must be an array');
    return { valid: false, errors };
  }

  if (attendeeDetails.length < 2) {
    errors.push('Bulk registration requires at least 2 attendees');
    return { valid: false, errors };
  }

  if (attendeeDetails.length > 50) {
    errors.push('Bulk registration is limited to 50 attendees maximum');
    return { valid: false, errors };
  }

  attendeeDetails.forEach((attendee, index) => {
    if (!attendee.name || attendee.name.trim().length === 0) {
      errors.push(`Attendee ${index + 1}: Name is required`);
    }

    if (!attendee.email || attendee.email.trim().length === 0) {
      errors.push(`Attendee ${index + 1}: Email is required`);
    } else if (!isValidEmail(attendee.email)) {
      errors.push(`Attendee ${index + 1}: Invalid email format`);
    }

    // Phone is optional but if provided, should be valid
    if (attendee.phone && attendee.phone.trim().length > 0) {
      if (!isValidPhone(attendee.phone)) {
        errors.push(`Attendee ${index + 1}: Invalid phone number format`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
};

/**
 * Calculate total cost for bulk registration
 */
export const calculateBulkRegistrationCost = (event: any, quantity: number): number => {
  const ticketPrice = event.ticketPrice || 0;
  return ticketPrice * quantity;
};

// Helper functions
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone: string): boolean => {
  // Basic phone validation - can be enhanced based on requirements
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}; 