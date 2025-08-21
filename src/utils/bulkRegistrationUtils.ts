import { AttendeeDetail, ValidationState, Event } from '../types/bulkRegistration';

/**
 * Calculate total cost for bulk registration
 */
export const calculateBulkRegistrationCost = (event: Event, quantity: number): number => {
  const ticketPrice = event.ticketPrice || 0;
  return ticketPrice * quantity;
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
 * Validate quantity for bulk registration
 */
export const validateQuantity = (
  quantity: number, 
  eventCapacity?: number, 
  currentRegistrations?: number
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (quantity < 2) {
    errors.push('Bulk registration requires at least 2 tickets');
  }

  if (quantity > 50) {
    errors.push('Bulk registration is limited to 50 tickets maximum');
  }

  if (eventCapacity && currentRegistrations !== undefined) {
    const availableSpots = eventCapacity - currentRegistrations;
    if (quantity > availableSpots) {
      errors.push(`Only ${availableSpots} spots available for this event`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Check if an event allows bulk registrations
 */
export const checkEventBulkRegistrationSupport = (event: Event): boolean => {
  return event.allowBulkRegistrations === true;
};

/**
 * Generate initial attendee details array
 */
export const generateInitialAttendeeDetails = (quantity: number): AttendeeDetail[] => {
  return Array.from({ length: quantity }, (_, index) => ({
    name: '',
    email: '',
    phone: ''
  }));
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2
  }).format(amount / 100); // Convert from cents
};

/**
 * Get step configuration for bulk registration flow
 */
export const getBulkRegistrationSteps = (currentStep: string) => {
  const steps = [
    {
      id: 'quantity' as const,
      title: 'Select Quantity',
      description: 'Choose number of tickets'
    },
    {
      id: 'details' as const,
      title: 'Attendee Details',
      description: 'Enter attendee information'
    },
    {
      id: 'review' as const,
      title: 'Review & Confirm',
      description: 'Review your registration'
    },
    {
      id: 'payment' as const,
      title: 'Payment',
      description: 'Complete payment'
    }
  ];

  return steps.map((step, index) => ({
    ...step,
    isComplete: steps.findIndex(s => s.id === currentStep) > index,
    isActive: step.id === currentStep
  }));
};

/**
 * Check if email is valid
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Check if phone number is valid
 */
const isValidPhone = (phone: string): boolean => {
  // Basic phone validation - can be enhanced based on requirements
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Get available capacity for an event
 */
export const getAvailableCapacity = (event: Event, currentRegistrations: number = 0): number => {
  const capacity = event.maxAttendees || 0;
  // If capacity is 0, it means unlimited, so return a large number
  if (capacity === 0) {
    return 999;
  }
  return Math.max(0, capacity - currentRegistrations);
};

/**
 * Check if bulk registration is possible for an event
 */
export const canBulkRegister = (event: Event, currentRegistrations: number = 0): boolean => {
  if (!checkEventBulkRegistrationSupport(event)) {
    return false;
  }

  const availableCapacity = getAvailableCapacity(event, currentRegistrations);
  return availableCapacity >= 2;
}; 