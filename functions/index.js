/**
 * Firebase Cloud Functions
 * Sample Cron Job - Runs every minute for testing
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore database
const db = admin.firestore();

/**
 * Sample Cron Job - Runs every minute
 * 
 * This function:
 * 1. Logs to console
 * 2. Saves a record to Firestore
 * 3. Sends a test email
 */
exports.sampleCronJob = functions.pubsub
  .schedule('* * * * *') // Every minute (cron format: minute hour day month dayOfWeek)
  .timeZone('Africa/Johannesburg')
  .onRun(async (context) => {
    const timestamp = new Date().toISOString();
    const logId = `cron_${Date.now()}`;
    
    console.log(`[CRON JOB] Running at ${timestamp}`);
    
    try {
      // 1. Save log entry to Firestore
      const logData = {
        timestamp: admin.firestore.Timestamp.now(),
        message: 'Sample cron job executed successfully',
        logId: logId,
        status: 'success',
        metadata: {
          functionName: 'sampleCronJob',
          executionId: context.eventId
        }
      };
      
      await db.collection('cron_logs').doc(logId).set(logData);
      console.log(`[CRON JOB] Log saved to Firestore: ${logId}`);
      
      // 2. Send test email
      const emailResult = await sendTestEmail(timestamp, logId);
      console.log(`[CRON JOB] Email sent: ${emailResult.success ? 'Success' : 'Failed'}`);
      
      // 3. Update log with email result
      await db.collection('cron_logs').doc(logId).update({
        emailSent: emailResult.success,
        emailError: emailResult.error || null
      });
      
      console.log(`[CRON JOB] Completed successfully at ${timestamp}`);
      
      return {
        success: true,
        timestamp,
        logId,
        emailSent: emailResult.success
      };
      
    } catch (error) {
      console.error(`[CRON JOB] Error: ${error.message}`, error);
      
      // Save error to Firestore
      await db.collection('cron_logs').doc(logId).set({
        timestamp: admin.firestore.Timestamp.now(),
        message: 'Cron job failed',
        logId: logId,
        status: 'error',
        error: error.message,
        stack: error.stack,
        metadata: {
          functionName: 'sampleCronJob',
          executionId: context.eventId
        }
      });
      
      throw error;
    }
  });

/**
 * Send test email using configured email service
 */
async function sendTestEmail(timestamp, logId) {
  try {
    // Get email configuration from environment (Firebase Functions config)
    const emailHost = functions.config().email?.host || process.env.EMAIL_HOST;
    const emailUser = functions.config().email?.user || process.env.EMAIL_USER;
    const emailPassword = functions.config().email?.password || process.env.EMAIL_PASSWORD;
    const emailFrom = functions.config().email?.from || process.env.EMAIL_FROM_ADDRESS || emailUser;
    const sendgridKey = functions.config().sendgrid?.api_key || process.env.SENDGRID_API_KEY;
    const testEmailTo = functions.config().email?.test_to || process.env.TEST_EMAIL_TO || emailUser;
    
    // Try SendGrid first if configured
    if (sendgridKey && sendgridKey !== 'YOUR_SENDGRID_API_KEY') {
      sgMail.setApiKey(sendgridKey);
      
      const msg = {
        to: testEmailTo,
        from: emailFrom,
        subject: `[CRON TEST] Sample Cron Job - ${timestamp}`,
        text: `This is a test email from the Firebase Cloud Function cron job.\n\nTimestamp: ${timestamp}\nLog ID: ${logId}\n\nThis cron job runs every minute for testing purposes.`,
        html: `
          <h2>Cron Job Test Email</h2>
          <p>This is a test email from the Firebase Cloud Function cron job.</p>
          <ul>
            <li><strong>Timestamp:</strong> ${timestamp}</li>
            <li><strong>Log ID:</strong> ${logId}</li>
            <li><strong>Status:</strong> Success</li>
          </ul>
          <p>This cron job runs every minute for testing purposes.</p>
        `
      };
      
      await sgMail.send(msg);
      return { success: true, provider: 'sendgrid' };
    }
    
    // Fallback to SMTP
    if (emailHost && emailUser && emailPassword) {
      const transporter = nodemailer.createTransport({
        host: emailHost,
        port: 587,
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPassword
        }
      });
      
      const mailOptions = {
        from: emailFrom,
        to: testEmailTo,
        subject: `[CRON TEST] Sample Cron Job - ${timestamp}`,
        text: `This is a test email from the Firebase Cloud Function cron job.\n\nTimestamp: ${timestamp}\nLog ID: ${logId}\n\nThis cron job runs every minute for testing purposes.`,
        html: `
          <h2>Cron Job Test Email</h2>
          <p>This is a test email from the Firebase Cloud Function cron job.</p>
          <ul>
            <li><strong>Timestamp:</strong> ${timestamp}</li>
            <li><strong>Log ID:</strong> ${logId}</li>
            <li><strong>Status:</strong> Success</li>
          </ul>
          <p>This cron job runs every minute for testing purposes.</p>
        `
      };
      
      await transporter.sendMail(mailOptions);
      return { success: true, provider: 'smtp' };
    }
    
    // No email configuration found
    console.warn('[CRON JOB] No email configuration found - skipping email send');
    return { success: false, error: 'No email configuration found' };
    
  } catch (error) {
    console.error('[CRON JOB] Email send error:', error);
    return { success: false, error: error.message };
  }
}
