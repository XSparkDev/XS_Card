const { db } = require('../firebase');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Generate a PDF ticket and email it to the user
 */
exports.generateAndEmailTicketPDF = async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      eventId,
      ticketId,
      eventTitle,
      eventDate,
      eventTime,
      venue,
      city,
      qrCode,
      ticketStatus
    } = req.body;

    console.log(`[TicketController] Generating PDF ticket for user: ${userId}, event: ${eventTitle}`);

    // Validate required fields
    if (!eventId || !ticketId || !eventTitle || !qrCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required ticket information'
      });
    }

    // Get user's card information for email and name
    const cardRef = db.collection('cards').doc(userId);
    const cardDoc = await cardRef.get();

    if (!cardDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User card information not found'
      });
    }

    const cardData = cardDoc.data();
    if (!cardData.cards || !cardData.cards[0]) {
      return res.status(404).json({
        success: false,
        message: 'User card not found'
      });
    }

    const firstCard = cardData.cards[0];
    const userEmail = firstCard.email;
    const userName = `${firstCard.name} ${firstCard.surname}`.trim();

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email not found in card information'
      });
    }

    console.log(`[TicketController] Found user email: ${userEmail}, name: ${userName}`);

    // Verify the user owns this ticket
    const ticketRef = db.collection('tickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const ticketData = ticketDoc.data();
    if (ticketData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    // Generate PDF
    const pdfBuffer = await generateTicketPDF({
      eventId,
      ticketId,
      eventTitle,
      eventDate,
      eventTime,
      venue,
      city,
      userName,
      qrCode,
      ticketStatus
    });

    // Send email with PDF attachment
    const emailResult = await sendTicketEmail({
      userEmail,
      userName,
      eventTitle,
      eventDate,
      eventTime,
      venue,
      city,
      ticketId,
      pdfBuffer
    });

    if (emailResult.success) {
      console.log(`[TicketController] PDF ticket emailed successfully to: ${userEmail}`);
      
      // Update ticket with email sent timestamp
      await ticketRef.update({
        lastEmailSent: new Date().toISOString(),
        emailSentCount: (ticketData.emailSentCount || 0) + 1
      });

      res.status(200).json({
        success: true,
        message: 'PDF ticket has been sent to your email address',
        emailSent: true,
        sentTo: userEmail
      });
    } else {
      console.error(`[TicketController] Failed to send PDF ticket email:`, emailResult.error);
      res.status(500).json({
        success: false,
        message: 'Failed to send PDF ticket email',
        error: emailResult.error
      });
    }

  } catch (error) {
    console.error('[TicketController] Error generating PDF ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF ticket',
      error: error.message
    });
  }
};

/**
 * Generate a PDF ticket buffer
 */
const generateTicketPDF = async (ticketData) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[PDF Generation] Starting PDF generation...');
      
      // Create a new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      // Collect PDF data
      const chunks = [];
      doc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        console.log('[PDF Generation] PDF generation completed');
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      doc.on('error', (error) => {
        console.error('[PDF Generation] PDF generation error:', error);
        reject(error);
      });

      // Add XSCard branding
      doc.fillColor('#1B2B5B')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('XSCard Event Ticket', 50, 50);

      // Add event title
      doc.fillColor('#000')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text(ticketData.eventTitle || 'Event', 50, 100);

      // Add event details
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#333');

      let yPosition = 140;
      const lineSpacing = 20;

      // Event details
      doc.text(`Date: ${ticketData.eventDate || 'TBD'}`, 50, yPosition);
      yPosition += lineSpacing;
      
      doc.text(`Time: ${ticketData.eventTime || 'TBD'}`, 50, yPosition);
      yPosition += lineSpacing;

      doc.text(`Venue: ${ticketData.venue || 'TBD'}`, 50, yPosition);
      yPosition += lineSpacing;

      doc.text(`City: ${ticketData.city || 'TBD'}`, 50, yPosition);
      yPosition += lineSpacing + 20;

      // Ticket holder information
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Ticket Holder:', 50, yPosition);
      yPosition += lineSpacing;

      doc.fontSize(12)
         .font('Helvetica')
         .text(`Name: ${ticketData.userName || 'Unknown'}`, 50, yPosition);
      yPosition += lineSpacing;

      doc.text(`Ticket ID: ${ticketData.ticketId || 'Unknown'}`, 50, yPosition);
      yPosition += lineSpacing;

      doc.text(`Status: ${(ticketData.ticketStatus || 'unknown').toUpperCase()}`, 50, yPosition);
      yPosition += lineSpacing + 30;

      // Generate QR code
      try {
        console.log('[PDF Generation] Generating QR code...');
        const qrCodeBuffer = await QRCode.toBuffer(ticketData.qrCode, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        console.log('[PDF Generation] QR code generated, adding to PDF...');
        
        // Add QR code to PDF
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Entry QR Code:', 50, yPosition);
        yPosition += lineSpacing + 10;

        doc.image(qrCodeBuffer, 50, yPosition, {
          width: 150,
          height: 150
        });
        
        yPosition += 170;

        // Add instructions
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666')
           .text('Present this QR code at the event for entry', 50, yPosition);
        yPosition += lineSpacing;

        doc.text('This ticket is valid for one entry only', 50, yPosition);
        
        console.log('[PDF Generation] QR code added to PDF');
        
      } catch (qrError) {
        console.error('[PDF Generation] QR code generation failed:', qrError);
        // Continue without QR code
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#ff0000')
           .text('QR Code generation failed - contact support', 50, yPosition);
      }

      // Add footer
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#999')
         .text(`Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 80);

      doc.text('XSCard - Digital Business Card Solutions', 50, doc.page.height - 60);

      // Finalize the PDF
      console.log('[PDF Generation] Finalizing PDF...');
      doc.end();

    } catch (error) {
      console.error('[PDF Generation] Error in PDF generation:', error);
      reject(error);
    }
  });
};

/**
 * Send email with PDF ticket attachment
 */
const sendTicketEmail = async (emailData) => {
  try {
    console.log('[Email] Sending PDF ticket email...');
    
    const { userEmail, userName, eventTitle, eventDate, eventTime, venue, city, ticketId, pdfBuffer } = emailData;

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1B2B5B; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">XSCard Event Ticket</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #1B2B5B; margin-bottom: 20px;">Hello ${userName || 'Event Attendee'},</h2>
          
          <p style="font-size: 16px; line-height: 1.5;">
            Your ticket for <strong>${eventTitle}</strong> is attached to this email as a PDF.
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1B2B5B; margin-top: 0;">Event Details:</h3>
            <p><strong>Event:</strong> ${eventTitle}</p>
            <p><strong>Date:</strong> ${eventDate || 'TBD'}</p>
            <p><strong>Time:</strong> ${eventTime || 'TBD'}</p>
            <p><strong>Venue:</strong> ${venue || 'TBD'}</p>
            <p><strong>City:</strong> ${city || 'TBD'}</p>
            <p><strong>Ticket ID:</strong> ${ticketId}</p>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">Important Instructions:</h4>
            <ul style="color: #856404; margin-bottom: 0;">
              <li>Please bring this PDF ticket (printed or on your phone) to the event</li>
              <li>The QR code on your ticket will be scanned for entry</li>
              <li>Arrive 15 minutes early for smooth check-in</li>
              <li>Contact the event organizer if you have any questions</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            This is an automated email from XSCard. Please do not reply to this email.
          </p>
        </div>
        
        <div style="background-color: #1B2B5B; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">XSCard - Digital Business Card Solutions</p>
          <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    // Send email with PDF attachment
    const mailOptions = {
      to: userEmail,
      subject: `Your Event Ticket - ${eventTitle}`,
      html: emailHtml,
      attachments: [
        {
          filename: `XSCard-Ticket-${ticketId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    console.log('[Email] Sending email to:', userEmail);
    const result = await sendMailWithStatus(mailOptions);
    
    if (result.success) {
      console.log('[Email] PDF ticket email sent successfully');
      return {
        success: true,
        message: 'Email sent successfully',
        sentTo: userEmail
      };
    } else {
      console.error('[Email] Failed to send PDF ticket email:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to send email'
      };
    }

  } catch (error) {
    console.error('[Email] Error sending ticket email:', error);
    return {
      success: false,
      error: error.message || 'Email sending failed'
    };
  }
}; 

exports.generateTicketPDF = generateTicketPDF;
exports.sendTicketEmail = sendTicketEmail; 