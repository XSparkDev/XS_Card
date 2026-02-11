/**
 * Enterprise Manual Intervention Utilities
 *
 * Handles logging and email notifications for cases requiring manual intervention
 * when enterprise creation fails after all retry attempts.
 */

const { db, admin } = require('../firebase');
const { logEnterpriseError } = require('./enterpriseErrorLogger');
const { sendMailWithStatus } = require('../public/Utils/emailService');

/**
 * Log manual intervention required
 * 
 * Logs to error_logs with special flag for easy identification.
 * 
 * @param {string} enterpriseId - Enterprise ID that failed to create
 * @param {object} accountData - Account data that was attempted
 * @param {object} quoteData - Quote data used for creation
 * @param {string} error - Error message
 * @param {number} attempts - Number of retry attempts made
 * @returns {Promise<string>} - Document ID of logged error
 */
async function logManualInterventionRequired(enterpriseId, accountData, quoteData, error, attempts) {
  try {
    const errorLog = {
      type: 'enterprise_creation_manual_intervention',
      error: error,
      requiresManualIntervention: true, // Special flag for easy filtering
      context: {
        enterpriseId: enterpriseId,
        quoteId: quoteData?.quoteId || accountData?.quoteId,
        companyName: accountData?.companyName || quoteData?.companyName,
        contactEmail: accountData?.contactEmail || quoteData?.contactEmail,
        contactName: accountData?.contactName || quoteData?.contactName,
        numberOfEmployees: accountData?.numberOfEmployees || quoteData?.numberOfEmployees,
        accountData: accountData,
        quoteData: quoteData
      },
      attempt: attempts,
      maxRetries: attempts, // All retries exhausted
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      status: 'pending_manual_intervention'
    };

    const docRef = await db.collection('error_logs').add(errorLog);
    
    console.error(`🚨 MANUAL INTERVENTION REQUIRED [${enterpriseId}]:`, {
      id: docRef.id,
      error: error,
      attempts: attempts,
      timestamp: errorLog.createdAt
    });

    return docRef.id;
  } catch (loggingError) {
    // Fallback to console if Firestore logging fails
    console.error('❌ Failed to log manual intervention to Firestore:', loggingError);
    console.error('Original error:', {
      enterpriseId,
      error,
      attempts
    });
    return null;
  }
}

/**
 * Send manual intervention emails
 * 
 * Sends email to ops team with technical details and user-friendly email to contact person.
 * 
 * @param {string} enterpriseId - Enterprise ID that failed to create
 * @param {object} accountData - Account data that was attempted
 * @param {object} quoteData - Quote data used for creation
 * @returns {Promise<object>} - Result with success status for each email
 */
async function sendManualInterventionEmails(enterpriseId, accountData, quoteData) {
  const results = {
    opsEmailSent: false,
    userEmailSent: false,
    opsEmailError: null,
    userEmailError: null
  };

  // Get ops team email from environment (default to support email)
  const opsEmail = process.env.OPS_TEAM_EMAIL || process.env.SUPPORT_EMAIL || 'support@xscard.co.za';
  const contactEmail = accountData?.contactEmail || quoteData?.contactEmail;
  const companyName = accountData?.companyName || quoteData?.companyName || 'Unknown Company';
  const contactName = accountData?.contactName || quoteData?.contactName || 'Enterprise Contact';

  // 1. Send email to ops team with technical details
  try {
    const opsMailOptions = {
      to: opsEmail,
      subject: `🚨 MANUAL INTERVENTION REQUIRED: Enterprise Creation Failed - ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ff4b6e; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">🚨 Manual Intervention Required</h1>
          </div>
          
          <div style="padding: 20px; background-color: #fff;">
            <h2 style="color: #333;">Enterprise Creation Failed</h2>
            <p>The system attempted to create an enterprise account and document but failed after all retry attempts.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Enterprise Details</h3>
              <p><strong>Enterprise ID:</strong> ${enterpriseId}</p>
              <p><strong>Quote ID:</strong> ${quoteData?.quoteId || accountData?.quoteId || 'N/A'}</p>
              <p><strong>Company Name:</strong> ${companyName}</p>
              <p><strong>Contact Name:</strong> ${contactName}</p>
              <p><strong>Contact Email:</strong> ${contactEmail || 'N/A'}</p>
              <p><strong>Number of Employees:</strong> ${accountData?.numberOfEmployees || quoteData?.numberOfEmployees || 'N/A'}</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">Action Required</h3>
              <p>Please manually create the enterprise document in Firestore:</p>
              <ul style="color: #856404;">
                <li>Collection: <code>enterprise</code></li>
                <li>Document ID: <code>${enterpriseId}</code></li>
                <li>Check error_logs collection for detailed error information</li>
                <li>Verify payment was successful in Paystack</li>
                <li>Create enterprise document with data from accountData and quoteData</li>
              </ul>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Account Data</h3>
              <pre style="background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(accountData, null, 2)}</pre>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Quote Data</h3>
              <pre style="background-color: #fff; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px;">${JSON.stringify(quoteData, null, 2)}</pre>
            </div>
            
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This is an automated notification. The user has been notified that manual intervention is required.
            </p>
          </div>
        </div>
      `
    };

    const opsResult = await sendMailWithStatus(opsMailOptions);
    results.opsEmailSent = opsResult.success;
    results.opsEmailError = opsResult.success ? null : opsResult.error;

    if (opsResult.success) {
      console.log(`✅ Manual intervention email sent to ops team: ${opsEmail}`);
    } else {
      console.error(`❌ Failed to send manual intervention email to ops team:`, opsResult.error);
    }
  } catch (opsEmailError) {
    console.error('❌ Error sending ops team email:', opsEmailError);
    results.opsEmailError = opsEmailError.message;
  }

  // 2. Send user-friendly email to contact person
  if (contactEmail) {
    try {
      const userMailOptions = {
        to: contactEmail,
        subject: `Your Enterprise Account Setup - Action Required`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
              <h1 style="color: #333; margin: 0;">XS Card Enterprise</h1>
            </div>
            
            <div style="padding: 20px; background-color: #fff;">
              <h2 style="color: #333;">Hello ${contactName},</h2>
              
              <p>Thank you for your payment. We have successfully received your payment for <strong>${companyName}</strong>.</p>
              
              <p>However, our system encountered an issue while setting up your enterprise account. Our technical team has been notified and is working to resolve this matter.</p>
              
              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #4CAF50; margin-top: 0;">What Happens Next?</h3>
                <p style="color: #333;">Our engineering team has been automatically notified and will manually complete the setup of your enterprise account. You can expect to receive a call from our team within <strong>24 to 48 hours</strong> to confirm everything is set up correctly.</p>
              </div>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">No Action Required</h3>
                <p style="color: #333;">You don't need to do anything at this time. Our team will handle everything and will contact you once your account is ready.</p>
              </div>
              
              <p style="color: #666; margin-top: 20px;">
                If you have any questions or concerns, please don't hesitate to contact our support team at <a href="mailto:support@xscard.co.za">support@xscard.co.za</a>.
              </p>
              
              <p style="color: #666;">
                Best regards,<br>
                The XS Card Team
              </p>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p>&copy; ${new Date().getFullYear()} XS Card. All Rights Reserved.</p>
            </div>
          </div>
        `
      };

      const userResult = await sendMailWithStatus(userMailOptions);
      results.userEmailSent = userResult.success;
      results.userEmailError = userResult.success ? null : userResult.error;

      if (userResult.success) {
        console.log(`✅ User notification email sent to: ${contactEmail}`);
      } else {
        console.error(`❌ Failed to send user notification email:`, userResult.error);
      }
    } catch (userEmailError) {
      console.error('❌ Error sending user email:', userEmailError);
      results.userEmailError = userEmailError.message;
    }
  } else {
    console.warn(`⚠️  No contact email available - skipping user notification email`);
  }

  return results;
}

module.exports = {
  logManualInterventionRequired,
  sendManualInterventionEmails
};
