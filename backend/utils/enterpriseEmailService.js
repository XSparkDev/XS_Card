/**
 * Enterprise Email Service
 * 
 * Sends email notifications for enterprise subscription events.
 * Uses existing email service infrastructure.
 */

const { sendMailWithStatus } = require('../public/Utils/emailService');

/**
 * Send subscription email notification
 * 
 * @param {string} type - Email type ('welcome', 'payment_succeeded', 'payment_failed', 'suspended', 'reactivated', 'cancelled')
 * @param {object} enterpriseAccount - Enterprise account data
 * @param {object} data - Additional data for email (optional)
 * @returns {Promise<object>} - Email send result
 */
async function sendSubscriptionEmail(type, enterpriseAccount, data = {}) {
  try {
    // Always use the contact person's email (from quote/account)
    const email = enterpriseAccount.contactEmail;
    const companyName = enterpriseAccount.companyName;
    
    if (!email) {
      throw new Error('Contact email is required');
    }

    let subject, htmlBody, textBody;

    switch (type) {
      case 'welcome': {
        // Base URL for registration form (backend-hosted page)
        const enterpriseWebsiteUrl = process.env.ENTERPRISE_WEBSITE_URL || 'https://staging.xscard.co.za';
        // App URL for "Open enterprise app" link (e.g. http://localhost:5173 for E2E, or staging/prod app)
        const enterpriseAppUrl = process.env.ENTERPRISE_APP_URL || 'https://staging.xscard.co.za';
        const openAppUrl = `${enterpriseAppUrl.replace(/\/$/, '')}/contacts`;
        const registrationFormUrl = `${enterpriseWebsiteUrl.replace(/\/$/, '')}/enterprise-registration.html?enterpriseId=${encodeURIComponent(enterpriseAccount.enterpriseId)}&enterpriseName=${encodeURIComponent(companyName)}&redirectUrl=${encodeURIComponent(openAppUrl)}`;

        subject = `Welcome to Enterprise Subscription - ${companyName}`;
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
              <h1 style="color: #333; margin: 0;">XS Card Enterprise</h1>
            </div>
            
            <div style="padding: 20px; background-color: #fff;">
              <h2 style="color: #333;">Welcome to Enterprise Subscription!</h2>
              <p>Dear ${enterpriseAccount.contactName},</p>
              <p>Your enterprise subscription for <strong>${companyName}</strong> has been activated successfully.</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Subscription Details:</h3>
                <ul style="color: #333; line-height: 1.8;">
                  <li>Number of Employees: ${enterpriseAccount.numberOfEmployees}</li>
                  <li>Subscription Type: Annual</li>
                  <li>Status: Active</li>
                  <li>Next Billing Date: ${enterpriseAccount.nextBillingDate?.toDate().toLocaleDateString() || 'N/A'}</li>
                </ul>
              </div>
              
              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #4CAF50; margin-top: 0;">Next Steps</h3>
                <p style="color: #333;">To complete your enterprise account setup, please create your admin account:</p>
                <p style="text-align: center; margin: 20px 0;">
                  <a href="${registrationFormUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ff4b6e; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Create Admin Account</a>
                </p>
                <p style="color: #333; margin-top: 15px;">Then open your enterprise app:</p>
                <p style="text-align: center; margin: 10px 0;">
                  <a href="${openAppUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1B2B5B; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Enterprise App</a>
                </p>
                <p style="color: #666; font-size: 13px; margin-top: 15px;">
                  Or visit: <a href="${openAppUrl}" style="color: #ff4b6e;">${openAppUrl}</a>
                </p>
              </div>
              
              <p style="color: #666; margin-top: 20px;">
                Thank you for choosing our enterprise solution!
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
        `;
        textBody = `Welcome to Enterprise Subscription!\n\nDear ${enterpriseAccount.contactName},\n\nYour enterprise subscription for ${companyName} has been activated successfully.\n\nSubscription Details:\n- Number of Employees: ${enterpriseAccount.numberOfEmployees}\n- Subscription Type: Annual\n- Status: Active\n- Next Billing Date: ${enterpriseAccount.nextBillingDate?.toDate().toLocaleDateString() || 'N/A'}\n\nNext Steps:\nTo complete your enterprise account setup, please create your admin account:\n${registrationFormUrl}\n\nThen open your enterprise app: ${openAppUrl}\n\nThank you for choosing our enterprise solution!`;
        break;
      }

      case 'payment_succeeded':
        subject = `Payment Successful - ${companyName} Enterprise Subscription`;
        htmlBody = `
          <h2>Payment Successful</h2>
          <p>Dear ${enterpriseAccount.contactName},</p>
          <p>Your payment for <strong>${companyName}</strong> enterprise subscription has been processed successfully.</p>
          <p><strong>Payment Details:</strong></p>
          <ul>
            <li>Amount: ${data.amount || 'N/A'}</li>
            <li>Currency: ${enterpriseAccount.currency || 'ZAR'}</li>
            <li>Next Billing Date: ${enterpriseAccount.nextBillingDate?.toDate().toLocaleDateString() || 'N/A'}</li>
          </ul>
          <p>Thank you for your continued subscription!</p>
        `;
        textBody = `Payment Successful\n\nDear ${enterpriseAccount.contactName},\n\nYour payment for ${companyName} enterprise subscription has been processed successfully.\n\nPayment Details:\n- Amount: ${data.amount || 'N/A'}\n- Currency: ${enterpriseAccount.currency || 'ZAR'}\n- Next Billing Date: ${enterpriseAccount.nextBillingDate?.toDate().toLocaleDateString() || 'N/A'}\n\nThank you for your continued subscription!`;
        break;

      case 'payment_failed':
        const gracePeriodEnd = enterpriseAccount.gracePeriodEndDate?.toDate().toLocaleDateString() || 'N/A';
        subject = `Payment Failed - Action Required - ${companyName}`;
        htmlBody = `
          <h2>⚠️ Payment Failed - Action Required</h2>
          <p>Dear ${enterpriseAccount.contactName},</p>
          <p>We were unable to process the payment for your <strong>${companyName}</strong> enterprise subscription.</p>
          <p><strong>Important:</strong> Please update your payment method before ${gracePeriodEnd} to avoid account suspension.</p>
          <p><a href="${process.env.APP_URL || 'https://app.xscard.co.za'}/enterprise-payment-update">Update Payment Method</a></p>
          <p>If you have any questions, please contact our support team.</p>
        `;
        textBody = `Payment Failed - Action Required\n\nDear ${enterpriseAccount.contactName},\n\nWe were unable to process the payment for your ${companyName} enterprise subscription.\n\nImportant: Please update your payment method before ${gracePeriodEnd} to avoid account suspension.\n\nUpdate Payment Method: ${process.env.APP_URL || 'https://app.xscard.co.za'}/enterprise-payment-update\n\nIf you have any questions, please contact our support team.`;
        break;

      case 'suspended':
        subject = `Account Suspended - ${companyName} Enterprise Subscription`;
        htmlBody = `
          <h2>⚠️ Account Suspended</h2>
          <p>Dear ${enterpriseAccount.contactName},</p>
          <p>Your <strong>${companyName}</strong> enterprise subscription account has been suspended due to payment failure.</p>
          <p><strong>To reactivate your account:</strong> Please update your payment method and we will automatically reactivate your subscription.</p>
          <p><a href="${process.env.APP_URL || 'https://app.xscard.co.za'}/enterprise-payment-update">Update Payment Method</a></p>
          <p>If you have any questions, please contact our support team.</p>
        `;
        textBody = `Account Suspended\n\nDear ${enterpriseAccount.contactName},\n\nYour ${companyName} enterprise subscription account has been suspended due to payment failure.\n\nTo reactivate your account: Please update your payment method and we will automatically reactivate your subscription.\n\nUpdate Payment Method: ${process.env.APP_URL || 'https://app.xscard.co.za'}/enterprise-payment-update\n\nIf you have any questions, please contact our support team.`;
        break;

      case 'reactivated':
        subject = `Account Reactivated - ${companyName} Enterprise Subscription`;
        htmlBody = `
          <h2>✅ Account Reactivated</h2>
          <p>Dear ${enterpriseAccount.contactName},</p>
          <p>Your <strong>${companyName}</strong> enterprise subscription account has been reactivated successfully.</p>
          <p>Thank you for updating your payment method. Your subscription is now active again.</p>
          <p><strong>Next Billing Date:</strong> ${enterpriseAccount.nextBillingDate?.toDate().toLocaleDateString() || 'N/A'}</p>
        `;
        textBody = `Account Reactivated\n\nDear ${enterpriseAccount.contactName},\n\nYour ${companyName} enterprise subscription account has been reactivated successfully.\n\nThank you for updating your payment method. Your subscription is now active again.\n\nNext Billing Date: ${enterpriseAccount.nextBillingDate?.toDate().toLocaleDateString() || 'N/A'}`;
        break;

      case 'cancelled':
        const endDate = enterpriseAccount.subscriptionEndDate?.toDate().toLocaleDateString() || 'N/A';
        subject = `Subscription Cancelled - ${companyName}`;
        htmlBody = `
          <h2>Subscription Cancelled</h2>
          <p>Dear ${enterpriseAccount.contactName},</p>
          <p>Your <strong>${companyName}</strong> enterprise subscription has been cancelled.</p>
          <p>Your account will remain active until <strong>${endDate}</strong>. After this date, your subscription will not renew.</p>
          <p>If you have any questions or would like to reactivate your subscription, please contact our support team.</p>
        `;
        textBody = `Subscription Cancelled\n\nDear ${enterpriseAccount.contactName},\n\nYour ${companyName} enterprise subscription has been cancelled.\n\nYour account will remain active until ${endDate}. After this date, your subscription will not renew.\n\nIf you have any questions or would like to reactivate your subscription, please contact our support team.`;
        break;

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const mailOptions = {
      to: email,
      subject: subject,
      text: textBody,
      html: htmlBody
    };

    const result = await sendMailWithStatus(mailOptions);
    
    if (result.success) {
      console.log(`✅ Subscription email sent (${type}) to ${email} for ${companyName}`);
    } else {
      console.warn(`⚠️  Failed to send subscription email (${type}) to ${email}:`, result.error);
    }

    return result;
  } catch (error) {
    console.error(`❌ Error sending subscription email (${type}):`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendSubscriptionEmail
};

