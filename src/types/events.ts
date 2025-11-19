// Event type definitions for XSCard Events feature

export interface EventLocation {
  venue: string;
  address: string;
  city: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface OrganizerInfo {
  name: string;
  email: string;
  profileImage?: string;
  company?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  eventDateISO?: string; // ISO format for editing
  endDate?: string;
  endDateISO?: string; // ISO format for editing
  location: EventLocation;
  category: string;
  eventType: 'free' | 'paid';
  ticketPrice: number;
  maxAttendees: number;
  currentAttendees: number;
  attendeesList?: string[];
  organizerId: string;
  organizerInfo: OrganizerInfo;
  status: 'draft' | 'published' | 'cancelled' | 'pending_payment';
  visibility: 'public' | 'private' | 'invite-only';
  images?: string[];
  bannerImage?: string;
  tags?: string[];
  allowBulkRegistrations?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  cancelledAt?: string;
  paymentReference?: string;
  /** Listing fee actually charged (currency minor-unit e.g. cents) */
  listingFee?: number;
  /** Detailed publishing cost returned from backend */
  publishingCost?: PublishingCost;
  // Recurring events fields
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  nextOccurrence?: string; // For search/list results
  displayText?: string; // "Every Monday at 10:00 AM SAST"
}

// Recurrence Pattern for recurring events
export interface RecurrencePattern {
  type: 'weekly'; // MVP: weekly only
  daysOfWeek: number[]; // [0-6] where 0=Sunday, 6=Saturday
  timezone: string; // IANA timezone (e.g., "Africa/Johannesburg")
  startDate: string; // First occurrence ISO date
  startTime: string; // "HH:mm" format (e.g., "10:00")
  endDate: string; // Required: Series end date (no "no end date" in MVP)
  excludedDates?: string[]; // Array of YYYY-MM-DD dates to skip
  eventId?: string; // Parent event template ID
}

// Event Instance (virtual, generated on-demand)
export interface EventInstance {
  instanceId: string; // Format: "eventId_YYYY-MM-DD"
  eventId: string; // Parent event template ID
  eventDate: string; // UTC timestamp
  eventDateISO?: string; // ISO format
  localTime: string; // "HH:mm" format in organizer timezone
  localTimeFormatted: string; // "10:00 AM" format
  timezone: string; // IANA timezone
  timezoneAbbr: string; // "SAST", "GMT", etc.
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "Monday", "Tuesday", etc.
  attendeeCount: number; // Number of registrations for this instance
  maxAttendees: number; // From parent template
  isCancelled: boolean;
  // Inherits all other fields from Event template
  title?: string;
  description?: string;
  location?: EventLocation;
  category?: string;
  eventType?: 'free' | 'paid';
  ticketPrice?: number;
  organizerInfo?: OrganizerInfo;
  images?: string[];
  bannerImage?: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  instanceId?: string | null; // For recurring events: "eventId_YYYY-MM-DD", null for non-recurring
  userId: string;
  userInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  status: 'registered' | 'pending_payment' | 'cancelled';
  registeredAt: string;
  specialRequests?: string;
  ticketId?: string;
  paymentReference?: string;
}

export interface EventPreferences {
  receiveEventNotifications: boolean;
  receiveNewEventBroadcasts: boolean;
  receiveEventUpdates: boolean;
  receiveEventReminders: boolean;
  receivePrivateEventBroadcasts?: boolean; // Optional, defaults to false
  preferredCategories: string[];
  locationRadius: number;
  preferredLocation?: {
    city: string;
    country: string;
  };
  eventTypePreference?: 'free' | 'paid' | null;
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface EventFilters {
  search?: string;
  category?: string;
  location?: string;
  eventType?: 'free' | 'paid';
  startDate?: string;
  endDate?: string;
  organizerId?: string;
  limit?: number;
  page?: number;
}

export interface EventListResponse {
  success: boolean;
  data: {
    events: Event[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalEvents: number;
      eventsPerPage: number;
    };
  };
}

export interface EventDetailsResponse {
  success: boolean;
  data: {
    event: Event;
    userRegistration?: EventRegistration;
    isOrganizer: boolean;
    attendeeDetails?: {
      totalAttendees: number;
      attendees: EventRegistration[];
    };
  };
}

export interface EventRegistrationResponse {
  success: boolean;
  message: string;
  registration: {
    id: string;
    eventId: string;
    userId: string;
    status: string;
    registeredAt: string;
    specialRequests?: string;
    ticketId: string;
    paymentReference?: string;
    paymentStatus?: 'pending' | 'completed' | 'failed' | 'abandoned';
    paymentInitiatedAt?: string;
    paymentCompletedAt?: string;
    paymentUrl?: string;
  };
  ticket: {
    id: string;
    eventId: string;
    userId: string;
    status: string;
    createdAt: string;
    ticketType: string;
    ticketPrice: number;
  };
  paymentRequired?: boolean;
  paymentUrl?: string;
  paymentReference?: string;
  amount?: number;
}

export interface UserEventsResponse {
  success: boolean;
  data: {
    events: Event[];
    totalEvents: number;
  };
}

export interface UserRegistrationsResponse {
  success: boolean;
  data: {
    registrations: Array<{
      registration: EventRegistration;
      event: Event;
    }>;
    totalRegistrations: number;
  };
}

export interface EventSearchResponse {
  success: boolean;
  data: {
    events: Event[];
    searchTerm: string;
    resultsCount: number;
  };
}

// Event categories
export const EVENT_CATEGORIES = [
  'tech',
  'business',
  'social',
  'sports',
  'arts',
  'education',
  'networking',
  'entertainment',
  'health',
  'other'
] as const;

export type EventCategory = typeof EVENT_CATEGORIES[number];

// Event status types
export const EVENT_STATUS = [
  'draft',
  'published',
  'pending_payment',
  'cancelled'
] as const;

export type EventStatus = typeof EVENT_STATUS[number];

// Registration status types
export const REGISTRATION_STATUS = [
  'registered',
  'pending_payment',
  'cancelled'
] as const;

export type RegistrationStatus = typeof REGISTRATION_STATUS[number];

// Event visibility types
export const EVENT_VISIBILITY = [
  'public',
  'private',
  'invite-only'
] as const;

export type EventVisibility = typeof EVENT_VISIBILITY[number];

// Event type for creation/editing
export interface CreateEventData {
  title: string;
  description: string;
  eventDate: string;
  endDate?: string;
  location: EventLocation;
  category: EventCategory;
  eventType: 'free' | 'paid';
  ticketPrice: number;
  maxAttendees: number;
  visibility: EventVisibility;
  images?: string[];
  bannerImage?: string;
  tags?: string[];
  allowBulkRegistrations?: boolean;
  // Recurring events fields
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

// Event analytics data
export interface EventAnalytics {
  totalViews: number;
  totalRegistrations: number;
  conversionRate: number;
  popularityScore: number;
  peakRegistrationTime: string;
  registrationsByDay: Array<{
    date: string;
    count: number;
  }>;
}

// QR Code Check-in System Types

export interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  userInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  status: 'active' | 'cancelled' | 'pending_payment' | 'refunded';
  createdAt: string;
  updatedAt: string;
  specialRequests?: string;
  ticketType: 'free' | 'paid';
  ticketPrice: number;
  paymentReference?: string;
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  qrGenerated: boolean;
  qrGeneratedAt?: string;
}

// Alias for backwards compatibility and clarity
export type EventTicket = Ticket;

export interface QRCode {
  ticketId: string;
  qrCode: string; // Base64 data URL
  verificationToken: string;
  expiresAt: string;
}

export interface QRCodeData {
  eventId: string;
  userId: string;
  ticketId: string;
  verificationToken: string;
  timestamp: number;
  type: 'event_ticket' | 'event_checkin';
  version: string;
}

export interface QRValidationResult {
  success: boolean;
  valid?: boolean;
  error?: string;
  message: string;
  eventId?: string;
  userId?: string;
  ticketId?: string;
  verificationToken?: string;
  eventData?: Event;
  ticketData?: Ticket;
  userData?: {
    name: string;
    email: string;
    profileImage?: string;
    company?: string;
  };
  checkedInAt?: string;
  checkedInBy?: string;
}

export interface CheckInStats {
  eventId: string;
  totalTickets: number;
  checkedInCount: number;
  pendingCheckIn: number;
  checkInRate: number;
  checkInDetails: Array<{
    ticketId: string;
    userId: string;
    checkedInAt: string;
    checkedInBy: string;
  }>;
}

export interface EventAttendee {
  ticketId: string;
  userId: string;
  userData: {
    name: string;
    email: string;
    profileImage?: string;
    company?: string;
  } | null;
  registeredAt: string;
  checkedIn: boolean;
  checkedInAt?: string;
  ticketStatus: string;
}

export interface BulkQRResult {
  eventId: string;
  totalTickets: number;
  generatedCount: number;
  errorCount: number;
  qrCodes: Array<{
    ticketId: string;
    userId: string;
    qrCode: string;
    verificationToken: string;
    expiresAt: string;
  }>;
  errors: Array<{
    ticketId: string;
    userId: string;
    error: string;
  }>;
}

// API Response Types for QR System

export interface GetTicketResponse {
  success: boolean;
  message?: string;
  ticket: EventTicket;
}

export interface GenerateQRResponse {
  success: boolean;
  message: string;
  ticketId: string;
  qrCode: string;
  verificationToken: string;
  expiresAt: string;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  eventId: string;
  ticketId: string;
  userData: {
    name: string;
    email: string;
    profileImage?: string;
    company?: string;
  } | null;
  checkedInAt: string;
}

export interface AttendeesResponse {
  success: boolean;
  message: string;
  eventId: string;
  totalAttendees: number;
  checkedInCount: number;
  attendees: EventAttendee[];
}

export interface CheckInStatsResponse {
  success: boolean;
  message: string;
  eventId: string;
  totalTickets: number;
  checkedInCount: number;
  pendingCheckIn: number;
  checkInRate: number;
  checkInDetails: Array<{
    ticketId: string;
    userId: string;
    checkedInAt: string;
    checkedInBy: string;
  }>;
}

// Notification Types for QR Check-in
export interface CheckInNotification {
  type: 'attendee_checked_in';
  eventId: string;
  attendeeName: string;
  checkedInAt: string;
  organizerId: string;
}

// Error Types for QR System
export type QRErrorType = 
  | 'INVALID_QR_FORMAT'
  | 'MISSING_QR_FIELDS'
  | 'INVALID_QR_TYPE'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'ALREADY_USED'
  | 'EVENT_NOT_FOUND'
  | 'UNAUTHORIZED_ORGANIZER'
  | 'TICKET_NOT_FOUND'
  | 'TICKET_MISMATCH'
  | 'ALREADY_CHECKED_IN'
  | 'VALIDATION_ERROR';

export interface PublishingCost {
  price: number;
  /**
   * null       – normal cash payment
   * "welcome" – free one-time credit on signup
   * "monthly" – monthly credit from Premium / Enterprise plans
   */
  creditType: 'welcome' | 'monthly' | null;
}