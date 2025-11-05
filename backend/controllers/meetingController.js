const { db } = require('../firebase.js');
const { formatDate } = require('../utils/dateFormatter');
const { getUserInfo } = require('../utils/userUtils');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const { createCalendarEvent } = require('../public/Utils/calendarService');
const availabilityService = require('../services/availabilityService');
const crypto = require('crypto');

// Helper function for error responses
const sendError = (res, status, message, error = null) => {
    console.error(`${message}:`, error);
    res.status(status).send({ 
        message,
        ...(error && { error: error.message })
    });
};

exports.getAllMeetings = async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Verify if the requesting user has access to this userId's meetings
        if (userId !== req.user.uid) {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized access to this user\'s meetings',
                error: 'Authentication failed: You can only access your own meetings'
            });
        }

        const meetingRef = db.collection('meetings').doc(userId);
        const doc = await meetingRef.get();

        if (!doc.exists || !doc.data().bookings) {
            return res.status(404).json({ 
                success: false,
                message: 'No meetings found',
                details: {
                    userId: userId,
                    reason: !doc.exists ? 'User has no meetings document' : 'Bookings array is empty'
                }
            });
        }

        // Format dates in the response
        const meetings = doc.data().bookings.map(meeting => ({
            ...meeting,
            meetingWhen: formatDate(meeting.meetingWhen)
        }));

        res.status(200).json({
            success: true,
            message: 'Meetings retrieved successfully',
            data: {
                userId: userId,
                totalMeetings: meetings.length,
                meetings: meetings
            }
        });
    } catch (error) {
        sendError(res, 500, {
            success: false,
            message: 'Failed to fetch meetings',
            error: {
                type: error.name,
                description: error.message
            }
        });
    }
};

exports.createMeeting = async (req, res) => {
    const { meetingWith, meetingWhen } = req.body;
    const description = req.body.description || ''; // Make description optional
    const duration = req.body.duration || 30; // Default to 30 minutes if not specified
    const userId = req.user.uid;

    if (!meetingWith || !meetingWhen) {
        return res.status(400).send({ 
            message: 'Missing required fields',
            required: ['meetingWith', 'meetingWhen']
        });
    }

    try {
        const meetingRef = db.collection('meetings').doc(userId);
        const doc = await meetingRef.get();

        // Store as Date object in Firestore with duration in minutes
        const newMeeting = {
            meetingWith,
            meetingWhen: new Date(meetingWhen),
            description,
            duration // Store duration in minutes
        };

        if (doc.exists) {
            await meetingRef.update({
                bookings: [...(doc.data().bookings || []), newMeeting]
            });
        } else {
            await meetingRef.set({
                bookings: [newMeeting]
            });
        }

        // Format for response
        const responseData = {
            ...newMeeting,
            meetingWhen: formatDate(newMeeting.meetingWhen)
        };

        res.status(201).send({
            success: true,
            message: 'Meeting created successfully',
            meeting: responseData
        });
    } catch (error) {
        sendError(res, 500, 'Error creating meeting', error);
    }
};

exports.updateMeeting = async (req, res) => {
    const { userId, meetingIndex } = req.params;
    const updateData = req.body;

    try {
        // Verify if the requesting user has access to this userId's meetings
        if (userId !== req.user.uid) {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized access to these meetings',
                error: 'Authentication failed: You can only update your own meetings'
            });
        }

        const meetingRef = db.collection('meetings').doc(userId);
        const doc = await meetingRef.get();

        if (!doc.exists || !doc.data().bookings) {
            return res.status(404).json({ 
                success: false,
                message: 'No meetings found',
                details: {
                    userId,
                    reason: !doc.exists ? 'User has no meetings document' : 'Bookings array is empty'
                }
            });
        }

        const bookings = doc.data().bookings;
        if (!bookings[meetingIndex]) {
            return res.status(404).json({ 
                success: false,
                message: 'Meeting not found',
                details: {
                    userId,
                    meetingIndex,
                    totalMeetings: bookings.length
                }
            });
        }

        // Store original meeting data for comparison
        const originalMeeting = bookings[meetingIndex];
        const originalAttendees = originalMeeting.attendees || [];
        const newAttendees = updateData.attendees || [];

        console.log('🔍 Update Meeting Debug:');
        console.log('Original attendees:', originalAttendees);
        console.log('New attendees:', newAttendees);
        console.log('Update data:', updateData);

        // Update meeting data
        bookings[meetingIndex] = {
            ...bookings[meetingIndex],
            ...updateData,
            meetingWhen: updateData.meetingWhen ? new Date(updateData.meetingWhen) : bookings[meetingIndex].meetingWhen
        };

        await meetingRef.update({ bookings });

        // Check for new attendees and send invites only to them
        if (newAttendees.length > 0) {
            const newAttendeesOnly = findNewAttendees(originalAttendees, newAttendees);
            
            console.log('🔍 New Attendee Detection:');
            console.log('New attendees found:', newAttendeesOnly);
            
            if (newAttendeesOnly.length > 0) {
                console.log(`Found ${newAttendeesOnly.length} new attendees, sending invites...`);
                
                try {
                    // Get organizer info
                    const userInfo = await getUserInfo(userId);
                    const organizerInfo = {
                        name: userInfo.name,
                        email: userInfo.email
                    };

                    // Prepare meeting data for email invites
                    const meetingData = {
                        title: bookings[meetingIndex].title,
                        description: bookings[meetingIndex].description || '',
                        startDateTime: bookings[meetingIndex].meetingWhen,
                        endDateTime: new Date(new Date(bookings[meetingIndex].meetingWhen).getTime() + (bookings[meetingIndex].duration || 30) * 60000).toISOString(),
                        location: bookings[meetingIndex].location || 'Virtual Meeting',
                        attendees: newAttendeesOnly,
                        organizer: organizerInfo,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    };

                    // Send invites only to new attendees
                    await sendInvitesToNewAttendees(meetingData);
                    
                    console.log(`Successfully sent invites to ${newAttendeesOnly.length} new attendees`);
                } catch (emailError) {
                    console.error('Error sending invites to new attendees:', emailError);
                    // Don't fail the entire update if email sending fails
                }
            }
        }

        // Format the date for response
        const responseData = {
            ...bookings[meetingIndex],
            meetingWhen: new Date(bookings[meetingIndex].meetingWhen)
                .toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'short'
                })
                .replace(',', '')
                .replace(/\s+/g, ' ')
                .replace(/(\d+:\d+)/, 'at $1')
        };

        res.status(200).json({
            success: true,
            message: 'Meeting updated successfully',
            data: {
                userId,
                meetingIndex,
                meeting: responseData
            }
        });
    } catch (error) {
        sendError(res, 500, 'Error updating meeting', error);
    }
};

exports.deleteMeeting = async (req, res) => {
    const { userId, meetingIndex } = req.params;

    try {
        // Verify if the requesting user has access
        if (userId !== req.user.uid) {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized access to these meetings',
                error: 'Authentication failed: You can only delete your own meetings'
            });
        }

        const meetingRef = db.collection('meetings').doc(userId);
        const doc = await meetingRef.get();

        if (!doc.exists || !doc.data().bookings) {
            return res.status(404).json({
                success: false,
                message: 'No meetings found',
                details: {
                    userId,
                    reason: !doc.exists ? 'User has no meetings document' : 'Bookings array is empty'
                }
            });
        }

        const bookings = doc.data().bookings;
        if (!bookings[meetingIndex]) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
                details: {
                    userId,
                    meetingIndex,
                    totalMeetings: bookings.length
                }
            });
        }

        bookings.splice(meetingIndex, 1);
        await meetingRef.update({ bookings });

        res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully',
            data: {
                userId,
                meetingIndex,
                remainingMeetings: bookings.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting meeting',
            error: {
                type: error.name,
                description: error.message
            }
        });
    }
};

exports.sendMeetingInvite = async (req, res) => {
    try {
        const userId = req.user.uid;
        const {
            title,
            description,
            startDateTime,
            endDateTime,
            location,
            attendees,
            organizer,
            timezone = 'UTC',
            duration = 30 // Default to 30 minutes if not provided
        } = req.body;
        
        // Validate required fields
        if (!title || !startDateTime || !endDateTime || !attendees || !Array.isArray(attendees)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['title', 'startDateTime', 'endDateTime', 'attendees']
            });
        }
        
        // Get user info to use as organizer if not provided
        let organizerInfo = organizer;
        if (!organizerInfo || !organizerInfo.name || !organizerInfo.email) {
            const userInfo = await getUserInfo(userId);
            organizerInfo = {
                name: userInfo.name,
                email: userInfo.email
            };
        }
        
        console.log('Using organizer info:', organizerInfo);
        
        // Generate the calendar event
        const calendarEvent = await createCalendarEvent({
            title,
            description: description || '',
            start: startDateTime,
            end: endDateTime,
            location: location || 'Online meeting',
            attendees,
            organizer: organizerInfo,
            timezone
        });
        
        // Send emails to all attendees
        const emailPromises = attendees.map(async (attendee) => {
            const mailOptions = {
                to: attendee.email,
                // Override default sender to appear as coming from the user
                from: {
                    name: organizerInfo.name,
                    address: process.env.EMAIL_FROM_ADDRESS // We still use system email address for deliverability
                },
                replyTo: organizerInfo.email, // Replies will go to the actual user
                subject: `Meeting Invitation: ${title}`,
                html: `
                    <h2>Meeting Invitation from ${organizerInfo.name}</h2>
                    <p><strong>Subject:</strong> ${title}</p>
                    <p><strong>When:</strong> ${new Date(startDateTime).toLocaleString(undefined, { 
                        dateStyle: 'full', 
                        timeStyle: 'short' 
                    })}</p>
                    <p><strong>Duration:</strong> ${duration} minutes</p>
                    <p><strong>Where:</strong> ${location || 'Online meeting'}</p>
                    <p><strong>Organizer:</strong> ${organizerInfo.name} (${organizerInfo.email})</p>
                    ${description ? `<p><strong>Description:</strong><br>${description.replace(/\n/g, '<br>')}</p>` : ''}
                    <p>This invitation contains a calendar attachment that you can add to your calendar application.</p>
                `,
                attachments: [{
                    filename: 'meeting.ics',
                    content: calendarEvent,
                    contentType: 'text/calendar'
                }]
            };
            
            return sendMailWithStatus(mailOptions);
        });
        
        const emailResults = await Promise.all(emailPromises);
        
        // Save meeting to database with duration in minutes
        const meetingRef = db.collection('meetings').doc(userId);
        const meetingDoc = await meetingRef.get();
        
        const newMeeting = {
            title,
            meetingWith: title,
            meetingWhen: new Date(startDateTime),
            endTime: new Date(endDateTime),
            description: description || '',
            location: location || 'Online meeting',
            attendees: attendees,
            duration: duration // Store duration in minutes
        };
        
        if (meetingDoc.exists) {
            await meetingRef.update({
                bookings: [...(meetingDoc.data().bookings || []), newMeeting]
            });
        } else {
            await meetingRef.set({
                bookings: [newMeeting]
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Meeting invitations sent successfully',
            data: {
                emailResults: emailResults.map(r => ({
                    success: r.success,
                    recipients: r.accepted
                })),
                meeting: {
                    ...newMeeting,
                    meetingWhen: formatDate(newMeeting.meetingWhen)
                }
            }
        });
    } catch (error) {
        console.error('Error sending meeting invites:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send meeting invitations',
            error: error.message
        });
    }
};

// Helper function to find new attendees by comparing email addresses
const findNewAttendees = (originalAttendees, newAttendees) => {
    if (!originalAttendees || originalAttendees.length === 0) {
        return newAttendees; // All attendees are new if there were no original attendees
    }
    
    const originalEmails = originalAttendees.map(attendee => attendee.email?.toLowerCase());
    
    return newAttendees.filter(attendee => {
        const attendeeEmail = attendee.email?.toLowerCase();
        return attendeeEmail && !originalEmails.includes(attendeeEmail);
    });
};

// Helper function to send invites only to new attendees
const sendInvitesToNewAttendees = async (meetingData) => {
    try {
        // Generate the calendar event
        const calendarEvent = await createCalendarEvent({
            title: meetingData.title,
            description: meetingData.description || '',
            start: meetingData.startDateTime,
            end: meetingData.endDateTime,
            location: meetingData.location || 'Online meeting',
            attendees: meetingData.attendees,
            organizer: meetingData.organizer,
            timezone: meetingData.timezone
        });

        // Send emails only to new attendees
        const emailPromises = meetingData.attendees.map(async (attendee) => {
            try {
                await sendMailWithStatus({
                    to: attendee.email,
                    subject: `Meeting Invitation: ${meetingData.title}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #007AFF;">Meeting Invitation</h2>
                            <p><strong>You've been invited to a meeting:</strong></p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; color: #333;">${meetingData.title}</h3>
                                ${meetingData.description ? `<p><strong>Description:</strong> ${meetingData.description}</p>` : ''}
                                <p><strong>Date & Time:</strong> ${new Date(meetingData.startDateTime).toLocaleString()}</p>
                                <p><strong>Duration:</strong> ${meetingData.duration || 30} minutes</p>
                                <p><strong>Location:</strong> ${meetingData.location || 'Virtual Meeting'}</p>
                                <p><strong>Organizer:</strong> ${meetingData.organizer.name} (${meetingData.organizer.email})</p>
                            </div>
                            
                            <div style="margin: 20px 0;">
                                <p><strong>Calendar Event:</strong></p>
                                <pre style="background-color: #f0f0f0; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${calendarEvent}</pre>
                            </div>
                            
                            <p style="color: #666; font-size: 14px;">
                                This meeting was updated and you are a new attendee. Please add this to your calendar.
                            </p>
                        </div>
                    `
                });
                
                console.log(`Invite sent successfully to ${attendee.email}`);
                return { success: true, email: attendee.email };
            } catch (emailError) {
                console.error(`Failed to send invite to ${attendee.email}:`, emailError);
                return { success: false, email: attendee.email, error: emailError.message };
            }
        });

        const results = await Promise.all(emailPromises);
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        console.log(`Email results: ${successCount} sent, ${failCount} failed`);
        return results;
        
    } catch (error) {
        console.error('Error in sendInvitesToNewAttendees:', error);
        throw error;
    }
};

// ============= CALENDAR PREFERENCES API =============

/**
 * Get user's calendar preferences
 */
exports.getCalendarPreferences = async (req, res) => {
    try {
        const userId = req.user.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userData = userDoc.data();
        const preferences = userData.calendarPreferences || availabilityService.getDefaultPreferences();

        // Get available emails from user and cards
        const availableEmails = [];
        
        // First email from users collection (primary) - MUST be first
        if (userData.email) {
            availableEmails.push({
                email: userData.email,
                source: 'user',
                label: 'Account Email (Primary)'
            });
        }

        // Get emails from cards (additional options)
        try {
            const cardDoc = await db.collection('cards').doc(userId).get();
            if (cardDoc.exists) {
                const cardData = cardDoc.data();
                if (cardData.cards && Array.isArray(cardData.cards)) {
                    cardData.cards.forEach((card, index) => {
                        if (card.email && card.email.trim() && 
                            !availableEmails.find(e => e.email.toLowerCase() === card.email.toLowerCase())) {
                            availableEmails.push({
                                email: card.email.trim(),
                                source: 'card',
                                label: `Card ${index + 1}${card.name ? ` (${card.name})` : ''}`
                            });
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[Calendar Preferences] Error fetching cards:', error);
        }

        res.status(200).json({
            success: true,
            data: {
                ...preferences,
                availableEmails: availableEmails
            }
        });
    } catch (error) {
        console.error('Error getting calendar preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get calendar preferences',
            error: error.message
        });
    }
};

/**
 * Update user's calendar preferences
 */
exports.updateCalendarPreferences = async (req, res) => {
    try {
        const userId = req.user.uid;
        const preferences = req.body;

        // Validate working hours format
        if (preferences.workingHours) {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
            
            for (const day of days) {
                if (preferences.workingHours[day]) {
                    const { start, end, specificSlots } = preferences.workingHours[day];
                    
                    // Validate start/end time format
                    if (start && !timeRegex.test(start)) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid start time format for ${day}. Use HH:MM format.`
                        });
                    }
                    if (end && !timeRegex.test(end)) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid end time format for ${day}. Use HH:MM format.`
                        });
                    }
                    
                    // Validate specificSlots if provided
                    if (specificSlots !== undefined && specificSlots !== null) {
                        if (!Array.isArray(specificSlots)) {
                            return res.status(400).json({
                                success: false,
                                message: `specificSlots for ${day} must be an array`
                            });
                        }
                        
                        // Check for duplicate times
                        const uniqueSlots = new Set(specificSlots);
                        if (uniqueSlots.size !== specificSlots.length) {
                            return res.status(400).json({
                                success: false,
                                message: `Duplicate time slots found for ${day}. Each time must be unique.`
                            });
                        }
                        
                        // Validate each slot format
                        for (const slot of specificSlots) {
                            if (typeof slot !== 'string') {
                                return res.status(400).json({
                                    success: false,
                                    message: `Invalid specificSlots format for ${day}. All slots must be strings in HH:MM format.`
                                });
                            }
                            if (!timeRegex.test(slot)) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Invalid time slot format "${slot}" for ${day}. Use HH:MM format (e.g., "11:30").`
                                });
                            }
                        }
                        
                        // Validate time range (00:00 to 23:59)
                        for (const slot of specificSlots) {
                            const [hours, minutes] = slot.split(':').map(Number);
                            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                                return res.status(400).json({
                                    success: false,
                                    message: `Invalid time slot "${slot}" for ${day}. Hours must be 00-23 and minutes must be 00-59.`
                                });
                            }
                        }
                    }
                }
            }
        }

        // Validate defaultTimeRange if provided
        if (preferences.defaultTimeRange) {
            const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
            if (preferences.defaultTimeRange.start && !timeRegex.test(preferences.defaultTimeRange.start)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid default start time format. Use HH:MM format (e.g., "09:00").'
                });
            }
            if (preferences.defaultTimeRange.end && !timeRegex.test(preferences.defaultTimeRange.end)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid default end time format. Use HH:MM format (e.g., "17:00").'
                });
            }
        }

        // Validate allowed durations
        if (preferences.allowedDurations) {
            if (!Array.isArray(preferences.allowedDurations)) {
                return res.status(400).json({
                    success: false,
                    message: 'allowedDurations must be an array'
                });
            }
            if (preferences.allowedDurations.some(d => typeof d !== 'number' || d <= 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'All durations must be positive numbers'
                });
            }
        }

        // Update preferences in Firestore
        await db.collection('users').doc(userId).update({
            calendarPreferences: preferences,
            updatedAt: new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Calendar preferences updated successfully',
            data: preferences
        });
    } catch (error) {
        console.error('Error updating calendar preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update calendar preferences',
            error: error.message
        });
    }
};

// ============= PUBLIC CALENDAR API =============

/**
 * Get public calendar availability (no auth required)
 */
exports.getPublicCalendarAvailability = async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, days = 30 } = req.query;

        console.log(`[Public Calendar] Fetching availability for user: ${userId}`);
        console.log(`[Public Calendar] Full URL params:`, req.params);
        console.log(`[Public Calendar] Query params:`, req.query);

        // Trim userId in case there's whitespace or .html suffix
        const cleanUserId = userId?.trim().replace('.html', '');

        if (!cleanUserId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        console.log(`[Public Calendar] Clean userId: ${cleanUserId}`);

        // Get user's calendar preferences
        const userDoc = await db.collection('users').doc(cleanUserId).get();
        
        if (!userDoc.exists) {
            console.log(`[Public Calendar] User document not found for ID: ${cleanUserId}`);
            // Try to find user by email as fallback (in case userId format is different)
            return res.status(404).json({
                success: false,
                message: 'User not found',
                debug: { receivedUserId: userId, cleanUserId }
            });
        }

        const userData = userDoc.data();
        const preferences = userData.calendarPreferences || availabilityService.getDefaultPreferences();

        // Check if calendar booking is enabled
        if (!preferences.enabled) {
            return res.status(403).json({
                success: false,
                message: 'Calendar booking is not enabled for this user'
            });
        }

        // Get user's existing meetings
        const meetingRef = db.collection('meetings').doc(cleanUserId);
        const meetingDoc = await meetingRef.get();
        const existingMeetings = meetingDoc.exists ? (meetingDoc.data().bookings || []) : [];

        // Calculate availability
        const start = startDate ? new Date(startDate) : new Date();
        const daysToCalculate = Math.min(parseInt(days), preferences.advanceBookingDays || 30);
        
        const availability = availabilityService.calculateAvailableSlots(
            cleanUserId,
            start,
            daysToCalculate,
            preferences,
            existingMeetings
        );

        // Get user info for display
        const userInfo = await getUserInfo(cleanUserId);

        res.status(200).json({
            success: true,
            data: {
                user: {
                    name: userInfo.name,
                    company: userInfo.company || '',
                    profileImage: userInfo.profileImage || null
                },
                availability,
                allowedDurations: preferences.allowedDurations || [30, 60],
                timezone: preferences.timezone || 'UTC'
            }
        });
    } catch (error) {
        console.error('[Public Calendar] Error getting availability:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get calendar availability',
            error: error.message
        });
    }
};

/**
 * Create public booking (no auth required)
 */
exports.createPublicBooking = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            name,
            email,
            phone,
            message,
            date,
            time,
            duration
        } = req.body;

        console.log(`[Public Booking] New booking request for user: ${userId}`);

        // Validate required fields
        if (!name || !email || !phone || !date || !time || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['name', 'email', 'phone', 'date', 'time', 'duration']
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Get user's calendar preferences
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const userData = userDoc.data();
        const preferences = userData.calendarPreferences || availabilityService.getDefaultPreferences();

        // Check if calendar booking is enabled
        if (!preferences.enabled) {
            return res.status(403).json({
                success: false,
                message: 'Calendar booking is not enabled for this user'
            });
        }

        // Check if duration is allowed
        const allowedDurations = preferences.allowedDurations || [30, 60];
        if (!allowedDurations.includes(parseInt(duration))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid duration selected',
                allowedDurations
            });
        }

        // Parse date and time
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        const meetingDateTime = new Date(year, month - 1, day, hour, minute);

        // Check if the slot is still available
        const meetingRef = db.collection('meetings').doc(userId);
        const meetingDoc = await meetingRef.get();
        const existingMeetings = meetingDoc.exists ? (meetingDoc.data().bookings || []) : [];

        const isAvailable = availabilityService.isSlotAvailable(
            time,
            new Date(year, month - 1, day),
            parseInt(duration),
            existingMeetings,
            preferences.bufferTime || 0,
            preferences
        );

        if (!isAvailable) {
            return res.status(409).json({
                success: false,
                message: 'Time slot is no longer available'
            });
        }

        // Generate unique cancellation token
        const cancellationToken = crypto.randomBytes(32).toString('hex');
        
        // Create booking
        const newMeeting = {
            meetingWith: name,
            meetingWhen: meetingDateTime,
            description: message || '',
            duration: parseInt(duration),
            location: 'Online meeting',
            source: 'public',
            bookerInfo: {
                name,
                email,
                phone,
                message: message || ''
            },
            cancellationToken,
            createdAt: new Date()
        };

        // Save to database
        if (meetingDoc.exists) {
            await meetingRef.update({
                bookings: [...existingMeetings, newMeeting]
            });
        } else {
            await meetingRef.set({
                bookings: [newMeeting]
            });
        }

        // Get calendar owner info - always use email from users collection
        const ownerInfo = await getUserInfo(userId);
        
        // Get the notification email - use preference or fallback to user email
        let ownerEmail = userData.email;
        if (preferences.notificationEmail && preferences.notificationEmail.trim()) {
            ownerEmail = preferences.notificationEmail.trim();
            console.log(`[Public Booking] Using preferred notification email: ${ownerEmail}`);
        } else if (userData.email) {
            ownerEmail = userData.email;
            console.log(`[Public Booking] Using user email from users collection: ${ownerEmail}`);
        } else {
            console.error(`[Public Booking] No email found for user ${userId} in users collection`);
            // Still try to send, but log the issue
        }

        // Send email to booker
        try {
            const endDateTime = new Date(meetingDateTime);
            endDateTime.setMinutes(endDateTime.getMinutes() + parseInt(duration));

            const calendarEvent = await createCalendarEvent({
                title: `Meeting with ${ownerInfo.name}`,
                description: message || 'Booked via XSCard Calendar',
                start: meetingDateTime.toISOString(),
                end: endDateTime.toISOString(),
                location: 'Online meeting',
                attendees: [{ name, email }],
                organizer: {
                    name: ownerInfo.name,
                    email: ownerEmail
                },
                timezone: preferences.timezone || 'UTC'
            });

            await sendMailWithStatus({
                to: email,
                subject: `Meeting Confirmed with ${ownerInfo.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #007AFF;">Meeting Confirmed!</h2>
                        <p>Hi ${name},</p>
                        <p>Your meeting with <strong>${ownerInfo.name}</strong> has been confirmed.</p>
                        
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Date:</strong> ${meetingDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p><strong>Time:</strong> ${meetingDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p><strong>Duration:</strong> ${duration} minutes</p>
                            ${message ? `<p><strong>Your message:</strong> ${message}</p>` : ''}
                        </div>
                        
                        <p>A calendar event has been attached to this email. Please add it to your calendar.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.API_BASE_URL || 'https://xscard.com'}/public/calendar/${userId}/cancel/${cancellationToken}" 
                               style="background-color: #FF3B30; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                                Cancel this booking
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #666;">Need to reschedule? Cancel this booking and book a new time. For questions, contact ${ownerInfo.name} at ${ownerEmail}.</p>
                    </div>
                `,
                attachments: [{
                    filename: 'meeting.ics',
                    content: calendarEvent,
                    contentType: 'text/calendar'
                }]
            });
            console.log(`[Public Booking] Email sent to booker: ${email}`);
        } catch (emailError) {
            console.error('[Public Booking] Error sending booker email:', emailError);
        }

        // Send email to calendar owner
        if (ownerEmail) {
            try {
                await sendMailWithStatus({
                    to: ownerEmail,
                    subject: `New Booking: ${name}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #007AFF;">New Meeting Booked</h2>
                            <p>Hi ${ownerInfo.name},</p>
                            <p>You have a new meeting booking from <strong>${name}</strong>.</p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0;">Booking Details</h3>
                                <p><strong>Name:</strong> ${name}</p>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Phone:</strong> ${phone}</p>
                                <p><strong>Date:</strong> ${meetingDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p><strong>Time:</strong> ${meetingDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                <p><strong>Duration:</strong> ${duration} minutes</p>
                                ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
                            </div>
                            
                            <p>This meeting has been added to your calendar in the XSCard app.</p>
                            
                            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                                <strong>Note:</strong> The booker can cancel this meeting using the cancellation link sent to their email. You will be notified if they cancel.
                            </p>
                        </div>
                    `
                });
                console.log(`[Public Booking] Email sent to calendar owner: ${ownerEmail}`);
            } catch (emailError) {
                console.error('[Public Booking] Error sending owner email:', emailError);
                console.error('[Public Booking] Email error details:', emailError.message);
            }
        } else {
            console.error(`[Public Booking] Cannot send email to owner: no email address found for user ${userId}`);
        }

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: {
                meetingDateTime: meetingDateTime.toISOString(),
                duration: parseInt(duration),
                bookerName: name
            }
        });
    } catch (error) {
        console.error('[Public Booking] Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: error.message
        });
    }
};

/**
 * Cancel public booking (no auth required)
 */
exports.cancelPublicBooking = async (req, res) => {
    try {
        const { userId, token } = req.params;
        
        console.log(`[Public Booking] Cancellation request for user: ${userId}, token: ${token}`);
        
        // Get all bookings for this user
        const meetingRef = db.collection('meetings').doc(userId);
        const meetingDoc = await meetingRef.get();
        
        if (!meetingDoc.exists || !meetingDoc.data().bookings) {
            return res.status(404).json({
                success: false,
                message: 'No bookings found'
            });
        }
        
        const bookings = meetingDoc.data().bookings;
        
        // Find booking by cancellation token
        const bookingIndex = bookings.findIndex(b => b.cancellationToken === token);
        
        if (bookingIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found or invalid cancellation link'
            });
        }
        
        const booking = bookings[bookingIndex];
        
        // Check if booking has already passed
        const meetingDateTime = booking.meetingWhen.toDate ? booking.meetingWhen.toDate() : new Date(booking.meetingWhen);
        if (meetingDateTime < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a booking that has already passed'
            });
        }
        
        // Remove booking from array
        bookings.splice(bookingIndex, 1);
        await meetingRef.update({ bookings });
        
        console.log(`[Public Booking] Booking cancelled successfully`);
        
        // Get calendar owner info
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const ownerInfo = await getUserInfo(userId);
        
        // Get notification email
        let ownerEmail = userData.email;
        const preferences = userData.calendarPreferences || {};
        if (preferences.notificationEmail && preferences.notificationEmail.trim()) {
            ownerEmail = preferences.notificationEmail.trim();
        }
        
        // Send cancellation confirmation to booker
        try {
            await sendMailWithStatus({
                to: booking.bookerInfo.email,
                subject: `Booking Cancelled - ${ownerInfo.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #FF3B30;">Booking Cancelled</h2>
                        <p>Hi ${booking.bookerInfo.name},</p>
                        <p>Your booking with <strong>${ownerInfo.name}</strong> has been cancelled.</p>
                        
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Cancelled Booking Details</h3>
                            <p><strong>Date:</strong> ${meetingDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p><strong>Time:</strong> ${meetingDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                            <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                        </div>
                        
                        <p>If you need to reschedule, you can book a new meeting at: ${process.env.API_BASE_URL || 'https://xscard.com'}/public/calendar/${userId}.html</p>
                    </div>
                `
            });
            console.log(`[Public Booking] Cancellation email sent to booker: ${booking.bookerInfo.email}`);
        } catch (emailError) {
            console.error('[Public Booking] Error sending booker cancellation email:', emailError);
        }
        
        // Send cancellation notification to owner
        if (ownerEmail) {
            try {
                await sendMailWithStatus({
                    to: ownerEmail,
                    subject: `Booking Cancelled: ${booking.bookerInfo.name}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #FF3B30;">Booking Cancelled</h2>
                            <p>Hi ${ownerInfo.name},</p>
                            <p>A booking has been cancelled by <strong>${booking.bookerInfo.name}</strong>.</p>
                            
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0;">Cancelled Booking Details</h3>
                                <p><strong>Name:</strong> ${booking.bookerInfo.name}</p>
                                <p><strong>Email:</strong> ${booking.bookerInfo.email}</p>
                                <p><strong>Phone:</strong> ${booking.bookerInfo.phone}</p>
                                <p><strong>Date:</strong> ${meetingDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p><strong>Time:</strong> ${meetingDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                            </div>
                            
                            <p>This time slot is now available for other bookings.</p>
                        </div>
                    `
                });
                console.log(`[Public Booking] Cancellation email sent to owner: ${ownerEmail}`);
            } catch (emailError) {
                console.error('[Public Booking] Error sending owner cancellation email:', emailError);
            }
        }
        
        // Serve a simple HTML page confirming cancellation
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Booking Cancelled - XSCard</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                        max-width: 500px;
                        text-align: center;
                    }
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #FF3B30;
                        margin-bottom: 10px;
                    }
                    p {
                        color: #666;
                        line-height: 1.6;
                        margin-bottom: 20px;
                    }
                    .details {
                        background: #f5f5f5;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        text-align: left;
                    }
                    .details p {
                        margin: 8px 0;
                        color: #333;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 24px;
                        background: #007AFF;
                        color: white;
                        text-decoration: none;
                        border-radius: 6px;
                        margin-top: 20px;
                    }
                    .button:hover {
                        background: #0056b3;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">✓</div>
                    <h1>Booking Cancelled</h1>
                    <p>Your booking has been successfully cancelled.</p>
                    
                    <div class="details">
                        <p><strong>Meeting with:</strong> ${ownerInfo.name}</p>
                        <p><strong>Date:</strong> ${meetingDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p><strong>Time:</strong> ${meetingDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    
                    <p>A confirmation email has been sent to ${booking.bookerInfo.email}</p>
                    <p>If you need to reschedule, you can book a new meeting below.</p>
                    
                    <a href="${process.env.API_BASE_URL || 'https://xscard.com'}/public/calendar/${userId}.html" class="button">Book Another Meeting</a>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('[Public Booking] Error cancelling booking:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error - XSCard</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                        max-width: 500px;
                        text-align: center;
                    }
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        color: #FF3B30;
                        margin-bottom: 10px;
                    }
                    p {
                        color: #666;
                        line-height: 1.6;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">⚠️</div>
                    <h1>Error</h1>
                    <p>Unable to cancel booking. The link may be invalid or the booking may have already been cancelled.</p>
                    <p>Please contact support if you need assistance.</p>
                </div>
            </body>
            </html>
        `);
    }
};
