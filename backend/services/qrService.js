const QRCode = require('qrcode');
const crypto = require('crypto');
const { db, admin } = require('../firebase.js');

class QRService {
  
  /**
   * Generate QR code data for an event ticket
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @param {string} ticketId - Ticket ID
   * @returns {object} QR code data and URL
   */
  static async generateTicketQR(eventId, userId, ticketId) {
    try {
      // Create unique verification token
      const timestamp = Date.now();
      const verificationToken = crypto
        .createHash('sha256')
        .update(`${eventId}_${userId}_${ticketId}_${timestamp}`)
        .digest('hex');

      // QR code payload
      const qrData = {
        eventId,
        userId,
        ticketId,
        verificationToken,
        timestamp,
        type: 'event_checkin',
        version: '1.0'
      };

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      // Store QR code verification token in database
      await db.collection('qr_tokens').doc(verificationToken).set({
        eventId,
        userId,
        ticketId,
        createdAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(timestamp + (24 * 60 * 60 * 1000)) // 24 hours validity
        ),
        used: false,
        checkedInAt: null,
        checkedInBy: null
      });

      return {
        success: true,
        qrCode: qrCodeDataURL,
        qrDataString: JSON.stringify(qrData), // Add raw QR data string for PDF generation
        verificationToken,
        expiresAt: new Date(timestamp + (24 * 60 * 60 * 1000)).toISOString()
      };

    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Validate and process QR code for check-in
   * @param {string} qrData - Raw QR code data
   * @param {string} organizerId - ID of the organizer attempting check-in
   * @returns {object} Validation result
   */
  static async validateQRCode(qrData, organizerId) {
    try {
      // Parse QR code data
      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
      } catch (parseError) {
        return {
          success: false,
          error: 'INVALID_QR_FORMAT',
          message: 'Invalid QR code format'
        };
      }

      // Validate QR code structure
      const requiredFields = ['eventId', 'userId', 'ticketId', 'verificationToken', 'type'];
      for (const field of requiredFields) {
        if (!parsedData[field]) {
          return {
            success: false,
            error: 'MISSING_QR_FIELDS',
            message: `Missing required field: ${field}`
          };
        }
      }

      if (parsedData.type !== 'event_checkin') {
        return {
          success: false,
          error: 'INVALID_QR_TYPE',
          message: 'Invalid QR code type'
        };
      }

      const { eventId, userId, ticketId, verificationToken } = parsedData;

      // Check if QR token exists and is valid
      const tokenDoc = await db.collection('qr_tokens').doc(verificationToken).get();
      if (!tokenDoc.exists) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'QR code token not found or invalid'
        };
      }

      const tokenData = tokenDoc.data();

      // Check if token has expired
      if (tokenData.expiresAt.toDate() < new Date()) {
        return {
          success: false,
          error: 'EXPIRED_TOKEN',
          message: 'QR code has expired'
        };
      }

      // Check if already used
      if (tokenData.used) {
        return {
          success: false,
          error: 'ALREADY_USED',
          message: 'QR code has already been used for check-in',
          checkedInAt: tokenData.checkedInAt?.toDate().toISOString(),
          checkedInBy: tokenData.checkedInBy
        };
      }

      // Verify event exists and organizer has permission
      const eventDoc = await db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        return {
          success: false,
          error: 'EVENT_NOT_FOUND',
          message: 'Event not found'
        };
      }

      const eventData = eventDoc.data();
      if (eventData.organizerId !== organizerId) {
        return {
          success: false,
          error: 'UNAUTHORIZED_ORGANIZER',
          message: 'Not authorized to check-in for this event'
        };
      }

      // Verify ticket exists and belongs to user
      const ticketDoc = await db.collection('tickets').doc(ticketId).get();
      if (!ticketDoc.exists) {
        return {
          success: false,
          error: 'TICKET_NOT_FOUND',
          message: 'Ticket not found'
        };
      }

      const ticketData = ticketDoc.data();
      if (ticketData.userId !== userId || ticketData.eventId !== eventId) {
        return {
          success: false,
          error: 'TICKET_MISMATCH',
          message: 'Ticket does not match QR code data'
        };
      }

      // Check if ticket is already checked in
      if (ticketData.checkedIn) {
        return {
          success: false,
          error: 'ALREADY_CHECKED_IN',
          message: 'Ticket has already been checked in',
          checkedInAt: ticketData.checkedInAt?.toDate().toISOString()
        };
      }

      return {
        success: true,
        valid: true,
        eventId,
        userId,
        ticketId,
        verificationToken,
        eventData,
        ticketData,
        userData: null // Will be populated by controller
      };

    } catch (error) {
      console.error('Error validating QR code:', error);
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Error validating QR code'
      };
    }
  }

  /**
   * Process check-in after validation
   * @param {string} ticketId - Ticket ID
   * @param {string} verificationToken - QR verification token
   * @param {string} organizerId - Organizer performing check-in
   * @returns {object} Check-in result
   */
  static async processCheckIn(ticketId, verificationToken, organizerId) {
    try {
      const checkInTime = admin.firestore.Timestamp.now();

      // Update ticket as checked in
      await db.collection('tickets').doc(ticketId).update({
        checkedIn: true,
        checkedInAt: checkInTime,
        checkedInBy: organizerId
      });

      // Mark QR token as used
      await db.collection('qr_tokens').doc(verificationToken).update({
        used: true,
        checkedInAt: checkInTime,
        checkedInBy: organizerId
      });

      // Get updated ticket data
      const ticketDoc = await db.collection('tickets').doc(ticketId).get();
      const ticketData = ticketDoc.data();

      return {
        success: true,
        checkedIn: true,
        checkedInAt: checkInTime.toDate().toISOString(),
        ticketData
      };

    } catch (error) {
      console.error('Error processing check-in:', error);
      throw new Error('Failed to process check-in');
    }
  }

  /**
   * Get check-in statistics for an event
   * @param {string} eventId - Event ID
   * @returns {object} Check-in statistics
   */
  static async getCheckInStats(eventId) {
    try {
      // Get all tickets for the event
      const ticketsSnapshot = await db.collection('tickets')
        .where('eventId', '==', eventId)
        .get();

      const totalTickets = ticketsSnapshot.size;
      let checkedInCount = 0;
      const checkInDetails = [];

      ticketsSnapshot.forEach(doc => {
        const ticket = doc.data();
        if (ticket.checkedIn) {
          checkedInCount++;
          checkInDetails.push({
            ticketId: doc.id,
            userId: ticket.userId,
            checkedInAt: ticket.checkedInAt?.toDate().toISOString(),
            checkedInBy: ticket.checkedInBy
          });
        }
      });

      return {
        success: true,
        eventId,
        totalTickets,
        checkedInCount,
        pendingCheckIn: totalTickets - checkedInCount,
        checkInRate: totalTickets > 0 ? (checkedInCount / totalTickets) * 100 : 0,
        checkInDetails
      };

    } catch (error) {
      console.error('Error getting check-in stats:', error);
      throw new Error('Failed to get check-in statistics');
    }
  }

  /**
   * Generate bulk QR codes for all registered users of an event
   * @param {string} eventId - Event ID
   * @param {string} organizerId - Organizer ID
   * @returns {object} Bulk QR generation result
   */
  static async generateBulkQRCodes(eventId, organizerId) {
    try {
      // Verify organizer owns the event
      const eventDoc = await db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      if (eventData.organizerId !== organizerId) {
        throw new Error('Not authorized to generate QR codes for this event');
      }

      // Get all tickets for the event
      const ticketsSnapshot = await db.collection('tickets')
        .where('eventId', '==', eventId)
        .get();

      const qrCodes = [];
      const errors = [];

      for (const ticketDoc of ticketsSnapshot.docs) {
        const ticket = ticketDoc.data();
        try {
          const qrResult = await this.generateTicketQR(eventId, ticket.userId, ticketDoc.id);
          qrCodes.push({
            ticketId: ticketDoc.id,
            userId: ticket.userId,
            qrCode: qrResult.qrCode,
            verificationToken: qrResult.verificationToken,
            expiresAt: qrResult.expiresAt
          });
        } catch (error) {
          errors.push({
            ticketId: ticketDoc.id,
            userId: ticket.userId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        eventId,
        totalTickets: ticketsSnapshot.size,
        generatedCount: qrCodes.length,
        errorCount: errors.length,
        qrCodes,
        errors
      };

    } catch (error) {
      console.error('Error generating bulk QR codes:', error);
      throw new Error(`Failed to generate bulk QR codes: ${error.message}`);
    }
  }
}

module.exports = QRService;
