const { db } = require('../firebase');

/**
 * Past Meetings Cleanup Job
 * Deletes meetings that have passed their scheduled time
 */

/**
 * Check if a meeting has passed
 * @param {Object} meeting - The meeting object
 * @returns {boolean} - True if the meeting has passed
 */
const isMeetingPast = (meeting) => {
  try {
    let meetingDate = null;
    let dateSource = '';

    // Check for different date field structures
    if (meeting.date && typeof meeting.date === 'string') {
      // Direct date field (ISO format)
      meetingDate = new Date(meeting.date);
      dateSource = 'date field';
    } else if (meeting.meetingWhen) {
      if (typeof meeting.meetingWhen === 'string') {
        // String format
        meetingDate = new Date(meeting.meetingWhen);
        dateSource = 'meetingWhen string';
      } else if (meeting.meetingWhen._seconds) {
        // Firestore timestamp
        meetingDate = new Date(meeting.meetingWhen._seconds * 1000);
        dateSource = 'meetingWhen timestamp';
      }
    } else if (meeting.bookings && Array.isArray(meeting.bookings) && meeting.bookings.length > 0) {
      // Check the first booking's meetingWhen
      const firstBooking = meeting.bookings[0];
      if (firstBooking.meetingWhen) {
        if (typeof firstBooking.meetingWhen === 'string') {
          meetingDate = new Date(firstBooking.meetingWhen);
          dateSource = 'booking meetingWhen string';
        } else if (firstBooking.meetingWhen._seconds) {
          meetingDate = new Date(firstBooking.meetingWhen._seconds * 1000);
          dateSource = 'booking meetingWhen timestamp';
        }
      }
    }

    if (!meetingDate || isNaN(meetingDate.getTime())) {
      console.log(`No valid date found for meeting ${meeting.id || 'unknown'}`);
      return false;
    }

    const now = new Date();
    const isPast = meetingDate < now;
    
    console.log(`Meeting ${meeting.id || 'unknown'} (${dateSource}): ${meetingDate.toISOString()} | Now: ${now.toISOString()} | Past: ${isPast}`);
    return isPast;
  } catch (error) {
    console.error('Error checking if meeting is past:', error, meeting);
    return false;
  }
};

/**
 * Get all meetings from the database
 * @param {Object} db - Firestore database instance
 * @returns {Promise<Array>} - Array of all meetings
 */
const getAllMeetings = async (db) => {
  try {
    console.log('📅 Fetching all meetings from database...');
    const meetingsRef = db.collection('meetings');
    const snapshot = await meetingsRef.get();
    
    const meetings = [];
    snapshot.forEach(doc => {
      meetings.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`📊 Found ${meetings.length} total meetings`);
    return meetings;
  } catch (error) {
    console.error('❌ Error fetching meetings:', error);
    throw error;
  }
};

/**
 * Delete past meetings (dry run)
 * @param {Object} db - Firestore database instance
 * @param {boolean} dryRun - If true, only log what would be deleted
 * @returns {Promise<Object>} - Summary of the operation
 */
const deletePastMeetings = async (db, dryRun = true) => {
  const startTime = new Date();
  console.log(`\n🧹 ${dryRun ? 'DRY RUN' : 'ACTUAL'} - Past Meetings Cleanup Job Started`);
  console.log(`⏰ Started at: ${startTime.toISOString()}`);
  
  try {
    // Get all meetings
    const allMeetings = await getAllMeetings(db);
    
    // Filter past meetings
    const pastMeetings = allMeetings.filter(meeting => {
      const isPast = isMeetingPast(meeting);
      if (isPast) {
        console.log(`🗑️  Past meeting found: ${meeting.title || 'Untitled'} - ID: ${meeting.id}`);
      }
      return isPast;
    });
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total meetings: ${allMeetings.length}`);
    console.log(`   Past meetings: ${pastMeetings.length}`);
    console.log(`   Current meetings: ${allMeetings.length - pastMeetings.length}`);
    
    if (pastMeetings.length === 0) {
      console.log('✅ No past meetings found to delete');
      return {
        success: true,
        totalMeetings: allMeetings.length,
        pastMeetings: 0,
        deletedMeetings: 0,
        dryRun: dryRun,
        duration: Date.now() - startTime.getTime()
      };
    }
    
    // Show details of past meetings
    console.log(`\n📋 PAST MEETINGS TO ${dryRun ? 'DELETE (DRY RUN)' : 'DELETE'}:`);
    pastMeetings.forEach((meeting, index) => {
      console.log(`   ${index + 1}. ${meeting.title || 'Untitled Meeting'}`);
      console.log(`      ID: ${meeting.id}`);
      console.log(`      Date: ${meeting.meetingWhen}`);
      console.log(`      With: ${meeting.meetingWith || 'Unknown'}`);
      console.log(`      Location: ${meeting.location || 'Not specified'}`);
      console.log('');
    });
    
    if (dryRun) {
      console.log('🔍 DRY RUN COMPLETE - No meetings were actually deleted');
      console.log('💡 To actually delete these meetings, run with dryRun=false');
    } else {
      // Actually delete the meetings
      console.log('🗑️  DELETING PAST MEETINGS...');
      const batch = db.batch();
      let deletedCount = 0;
      
      pastMeetings.forEach(meeting => {
        const meetingRef = db.collection('meetings').doc(meeting.id);
        batch.delete(meetingRef);
        deletedCount++;
        console.log(`   ✅ Queued for deletion: ${meeting.title || 'Untitled'} (${meeting.id})`);
      });
      
      // Commit the batch deletion
      await batch.commit();
      console.log(`\n🎉 SUCCESSFULLY DELETED ${deletedCount} PAST MEETINGS!`);
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.log(`\n⏱️  Job completed in ${duration}ms`);
    console.log(`🏁 Finished at: ${endTime.toISOString()}`);
    
    return {
      success: true,
      totalMeetings: allMeetings.length,
      pastMeetings: pastMeetings.length,
      deletedMeetings: dryRun ? 0 : pastMeetings.length,
      dryRun: dryRun,
      duration: duration
    };
    
  } catch (error) {
    console.error('❌ Error in past meetings cleanup job:', error);
    return {
      success: false,
      error: error.message,
      dryRun: dryRun,
      duration: Date.now() - startTime.getTime()
    };
  }
};

/**
 * Calculate milliseconds until next 12 AM SAST (10 PM UTC)
 */
const getMsUntilMidnightSAST = () => {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const sast = new Date(utc.getTime() + (2 * 3600000)); // UTC+2
  
  // Get next midnight SAST
  const nextMidnightSAST = new Date(sast);
  nextMidnightSAST.setHours(24, 0, 0, 0); // Next midnight
  
  // Convert back to UTC (subtract 2 hours)
  const nextMidnightUTC = new Date(nextMidnightSAST.getTime() - (2 * 3600000));
  
  const msUntilMidnight = nextMidnightUTC.getTime() - now.getTime();
  return msUntilMidnight;
};

/**
 * Start the past meetings cleanup job
 * @param {Object} db - Firestore database instance
 * @param {Object} options - Job options
 * @param {boolean} options.dryRun - If true, only log what would be deleted
 */
const startPastMeetingsCleanupJob = (db, options = {}) => {
  const { dryRun = false } = options; // Default to LIVE mode for scheduled job
  
  console.log(`🔄 Starting Past Meetings Cleanup Job`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Schedule: Daily at 12:00 AM SAST (10:00 PM UTC)`);
  
  // Calculate time until next midnight SAST
  const msUntilMidnight = getMsUntilMidnightSAST();
  const hoursUntilMidnight = Math.floor(msUntilMidnight / (1000 * 60 * 60));
  const minutesUntilMidnight = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log(`   Next run: ${hoursUntilMidnight}h ${minutesUntilMidnight}m from now`);
  
  // Schedule first run at midnight SAST
  setTimeout(() => {
    console.log(`\n🕛 Running scheduled past meetings cleanup at midnight SAST...`);
    deletePastMeetings(db, dryRun);
    
    // Then schedule daily runs every 24 hours
    setInterval(() => {
      console.log(`\n🕛 Running scheduled past meetings cleanup at midnight SAST...`);
      deletePastMeetings(db, dryRun);
    }, 24 * 60 * 60 * 1000); // 24 hours
  }, msUntilMidnight);
};

/**
 * Run the job once (for manual execution)
 * @param {Object} db - Firestore database instance
 * @param {boolean} dryRun - If true, only log what would be deleted
 */
const runPastMeetingsCleanup = async (db, dryRun = true) => {
  return await deletePastMeetings(db, dryRun);
};

module.exports = {
  startPastMeetingsCleanupJob,
  runPastMeetingsCleanup,
  deletePastMeetings,
  getAllMeetings,
  isMeetingPast
};
