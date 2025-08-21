import { API_BASE_URL } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import {
  Event,
  EventRegistration,
  EventPreferences,
  EventFilters,
  EventListResponse,
  EventTicket,
  GetTicketResponse,
  QRCodeData,
  GenerateQRResponse,
  CheckInResponse,
  AttendeesResponse,
  CheckInStatsResponse,
  BulkQRResult,
  EventAttendee,
} from '../types/events';

const BASE_URL = `${API_BASE_URL}/events`;

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  
  if (!token) {
    console.error('[EventService] No authentication token found in storage');
    throw new Error('No authentication token found. Please log in again.');
  }
  
  // Check if token already has Bearer prefix
  const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  
  return {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };
};

// Event CRUD Operations
export const getEvents = async (filters: EventFilters = {}): Promise<EventListResponse> => {
  try {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = `${BASE_URL}?${queryParams.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

export const getEventDetails = async (eventId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching event details:', error);
    throw error;
  }
};

export const createEvent = async (eventData: Partial<Event>) => {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(eventData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

export const updateEvent = async (eventId: string, eventData: Partial<Event>) => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(eventData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

export const deleteEvent = async (eventId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

// Event Registration
export const registerForEvent = async (eventId: string, registrationData: any) => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}/register`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(registrationData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error registering for event:', error);
    throw error;
  }
};

/**
 * Check the payment status for an event registration
 * @param eventId The event ID
 * @param registrationId The registration ID
 * @returns Payment status response
 */
export const checkRegistrationPaymentStatus = async (eventId: string, registrationId: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/${eventId}/registration/${registrationId}/payment/status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to check registration payment status');
    }

    return data;
  } catch (error) {
    console.error('[EventService] Error checking registration payment status:', error);
    throw error;
  }
};

export const unregisterFromEvent = async (eventId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}/unregister`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error unregistering from event:', error);
    throw error;
  }
};

export const getMyEvents = async () => {
  try {
    const response = await fetch(`${BASE_URL}/my-events`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching my events:', error);
    throw error;
  }
};

// Event Preferences
export const getEventPreferences = async (): Promise<EventPreferences> => {
  try {
    const response = await fetch(`${BASE_URL}/preferences`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data.preferences || {};
  } catch (error) {
    console.error('Error fetching event preferences:', error);
    throw error;
  }
};

export const updateEventPreferences = async (preferences: Partial<EventPreferences>) => {
  try {
    const response = await fetch(`${BASE_URL}/preferences`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(preferences),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating event preferences:', error);
    throw error;
  }
};

// QR Code and Ticket Functions
export const getMyTicketForEvent = async (eventId: string): Promise<GetTicketResponse> => {
  try {
    console.log('[EventService] Getting ticket for event:', eventId);
    console.log('[EventService] Event ID type:', typeof eventId);
    console.log('[EventService] Event ID length:', eventId.length);
    console.log('[EventService] Calling endpoint:', `${BASE_URL}/${eventId}/my-ticket`);
    const response = await fetch(`${BASE_URL}/${eventId}/my-ticket`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    console.log('[EventService] Ticket response status:', response.status);
    const data = await response.json();
    console.log('[EventService] Ticket response data:', data);
    
    // Return the full response to match what EventTicketScreen expects
    return data;
  } catch (error) {
    console.error('[EventService] Error fetching my ticket:', error);
    throw error;
  }
};

export const generateQRCodeForTicket = async (ticketId: string): Promise<GenerateQRResponse> => {
  try {
    if (!ticketId) {
      console.error('[EventService] Ticket ID is null, undefined, or empty:', ticketId);
      throw new Error('Ticket ID is required');
    }

    console.log('[EventService] Generating QR code for ticket:', ticketId);
    console.log('[EventService] Calling endpoint:', `${API_BASE_URL}/tickets/${ticketId}/qr`);
    const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/qr`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    console.log('[EventService] QR generation response status:', response.status);
    const data = await response.json();
    console.log('[EventService] QR generation response data:', data);
    
    return data;
  } catch (error) {
    console.error('[EventService] Error generating QR code:', error);
    throw error;
  }
};

export const validateQRCode = async (qrData: QRCodeData) => {
  try {
    const response = await fetch(`${BASE_URL}/qr/validate`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        qrData: JSON.stringify(qrData),
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error validating QR code:', error);
    throw error;
  }
};

export const checkInAttendee = async (qrData: QRCodeData): Promise<CheckInResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/qr/checkin`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        qrData: JSON.stringify(qrData),
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking in attendee:', error);
    throw error;
  }
};

// Event Management for Organizers
export const getEventAttendees = async (eventId: string): Promise<AttendeesResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}/attendees`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching event attendees:', error);
    throw error;
  }
};

export const getCheckInStats = async (eventId: string): Promise<CheckInStatsResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}/checkin/stats`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching check-in stats:', error);
    throw error;
  }
};

export const generateBulkQRCodes = async (eventId: string): Promise<BulkQRResult> => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}/qr/bulk`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating bulk QR codes:', error);
    throw error;
  }
};

export const exportAttendeesToCSV = async (eventId: string, attendees: EventAttendee[], eventTitle: string) => {
  try {
    if (!attendees || attendees.length === 0) {
      return {
        success: false,
        message: 'No attendees to export'
      };
    }

    // Calculate summary stats
    const totalAttendees = attendees.length;
    const checkedInCount = attendees.filter(a => a.checkedIn).length;
    const pendingCount = totalAttendees - checkedInCount;
    const checkInRate = totalAttendees > 0 ? ((checkedInCount / totalAttendees) * 100).toFixed(1) : '0.0';

    // Generate CSV content with metadata
    const csvHeaders = [
      'Name',
      'Email',
      'Company',
      'Ticket ID',
      'Status',
      'Registered At',
      'Checked In At'
    ];

    const csvRows = attendees.map(attendee => [
      attendee.userData?.name || 'N/A',
      attendee.userData?.email || 'N/A',
      attendee.userData?.company || 'N/A',
      attendee.ticketId || 'N/A',
      attendee.checkedIn ? 'Checked In' : 'Pending',
      attendee.registeredAt ? new Date(attendee.registeredAt).toLocaleString() : 'N/A',
      attendee.checkedInAt ? new Date(attendee.checkedInAt).toLocaleString() : 'N/A'
    ]);

    // Create CSV string with metadata
    const timestamp = new Date().toISOString().split('T')[0];
    const exportTime = new Date().toLocaleString();
    
    const csvContent = [
      `Event: ${eventTitle}`,
      `Export Date: ${exportTime}`,
      `Total Attendees: ${totalAttendees}`,
      `Checked In: ${checkedInCount}`,
      `Pending: ${pendingCount}`,
      `Check-in Rate: ${checkInRate}%`,
      '', // Empty line separator
      csvHeaders.join(','),
      ...csvRows.map(row => 
        row.map(cell => {
          // Escape commas and quotes in CSV
          const escaped = String(cell).replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
            ? `"${escaped}"` 
            : escaped;
        }).join(',')
      )
    ].join('\n');

    // Generate filename with timestamp
    const filename = `${eventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_attendees_${timestamp}.csv`;

    // Use React Native Share API
    const shareOptions = {
      title: 'Export Attendees',
      message: `${eventTitle} - Attendees List (${attendees.length} total, ${checkedInCount} checked in)`,
      url: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
      subject: `${eventTitle} - Attendees Export`,
      filename: filename,
    };

    const result = await Share.share(shareOptions);

    // Handle different share results
    if (result.action === Share.sharedAction) {
      return {
        success: true,
        message: 'Attendees exported successfully',
        result: result
      };
    } else if (result.action === Share.dismissedAction) {
      return {
        success: false,
        message: 'Export cancelled by user',
        result: result
      };
    } else {
      return {
        success: true,
        message: 'Export completed',
        result: result
      };
    }
  } catch (error) {
    console.error('Error exporting attendees:', error);
    return {
      success: false,
      message: 'Failed to export attendees. Please try again.',
      error: error
    };
  }
};

// Real-time notifications (WebSocket integration would go here)
export const subscribeToEventNotifications = (eventId: string, callback: (notification: any) => void) => {
  // This would integrate with the socket service for real-time updates
  // For now, we'll use polling
  return setInterval(async () => {
    try {
      const stats = await getCheckInStats(eventId);
      callback({ type: 'stats_update', data: stats });
    } catch (error) {
      console.error('Error polling for updates:', error);
    }
  }, 30000); // Poll every 30 seconds
};

export const unsubscribeFromEventNotifications = (subscriptionId: NodeJS.Timeout) => {
  if (subscriptionId) {
    clearInterval(subscriptionId);
  }
};

// NEW: Function to get organizer info from backend
export const getOrganizerInfo = async (userId: string) => {
  try {
    console.log(`[EventService] Getting organizer info for userId: ${userId}`);
    const response = await fetch(`${API_BASE_URL}/api/test-user-info/${userId}`, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      console.warn(`[EventService] Failed to get organizer info for ${userId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[EventService] Got organizer info:`, data.data.userInfo);
    return data.data.userInfo;
  } catch (error) {
    console.error(`[EventService] Error getting organizer info for ${userId}:`, error);
    return null;
  }
};

// NEW: Function to enhance events with correct organizer information
export const enhanceEventsWithOrganizerInfo = async (events: Event[]): Promise<Event[]> => {
  try {
    const enhancedEvents = await Promise.all(
      events.map(async (event) => {
        // Check if event has undefined or generic organizer name
        const organizerName = event.organizerInfo?.name;
        const needsEnhancement = (
          !organizerName ||
          organizerName === 'undefined' ||
          organizerName === 'undefined undefined' ||
          organizerName === 'User' ||
          organizerName.includes('undefined')
        );

        if (!needsEnhancement) {
          return event;
        }

        // Get correct organizer info from backend
        const correctOrganizerInfo = await getOrganizerInfo(event.organizerId);
        
        if (correctOrganizerInfo && correctOrganizerInfo.name !== 'User') {
          return {
            ...event,
            organizerInfo: {
              name: correctOrganizerInfo.name,
              email: correctOrganizerInfo.email || event.organizerInfo?.email || '',
              company: correctOrganizerInfo.company || event.organizerInfo?.company || '',
              profileImage: correctOrganizerInfo.profileImage || event.organizerInfo?.profileImage || null,
            }
          };
        } else {
          return event;
        }
      })
    );

    return enhancedEvents;
  } catch (error) {
    console.error('[EventService] Error enhancing events with organizer info:', error);
    // Return original events if enhancement fails
    return events;
  }
};

// ===================== Publishing & Payment Helpers =====================

/**
 * Attempt to publish an event.
 * If a payment is required the backend returns: { paymentRequired: true, paymentUrl, reference, amount }
 * If no payment is needed it returns success:true and the event object.
 */
export const publishEvent = async (eventId: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${eventId}/publish`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[EventService] Error publishing event:', error);
    throw error;
  }
};

/**
 * Verify a Paystack payment using the reference returned from publishEvent.
 * Your backend should expose GET /events/payment/verify?reference=<ref> that maps to Paystack verify endpoint.
 */
export const verifyPayment = async (reference: string) => {
  try {
    const url = `${BASE_URL}/payment/verify?reference=${encodeURIComponent(reference)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[EventService] Error verifying payment:', error);
    throw error;
  }
};

/**
 * Force verify a payment with Paystack, bypassing any cached status.
 * This is useful for troubleshooting payment issues.
 */
export const forceVerifyPayment = async (reference: string) => {
  try {
    const headers = await getAuthHeaders();
    const url = `${BASE_URL}/payment/force-verify?reference=${encodeURIComponent(reference)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[EventService] Error force verifying payment:', error);
    throw error;
  }
};

/**
 * Convenience wrapper around getEventDetails to poll an event's latest status.
 */
export const getEventStatus = async (eventId: string) => {
  try {
    const details = await getEventDetails(eventId);
    return details?.data?.event || null;
  } catch (error) {
    console.error('[EventService] Error getting event status:', error);
    throw error;
  }
};

// Payment Status Checking (Phase 2)
export const checkEventPaymentStatus = async (eventId: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/${eventId}/payment/status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to check payment status');
    }

    // Check for specific payment status
    if (data.event) {
      // If event is published, payment was successful
      if (data.event.status === 'published') {
        return {
          ...data,
          paymentStatus: 'completed'
        };
      }
      
      // If event has paymentStatus field, use it
      if (data.event.paymentStatus) {
        return {
          ...data,
          paymentStatus: data.event.paymentStatus
        };
      }
      
      // Check for abandoned payment (more than 1 hour old)
      if (data.event.paymentInitiatedAt) {
        const paymentInitiatedAt = new Date(data.event.paymentInitiatedAt);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (paymentInitiatedAt < oneHourAgo) {
          return {
            ...data,
            paymentStatus: 'abandoned'
          };
        }
      }
    }

    return data;
  } catch (error) {
    console.error('[EventService] Error checking payment status:', error);
    throw error;
  }
};
