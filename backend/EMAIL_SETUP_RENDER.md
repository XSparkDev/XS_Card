# Email Configuration for Render.com Production

## Current Issue
You're experiencing connection timeouts on port 465 in production on Render.com, while it works locally. This is a common issue with hosting platforms that have restrictive networking policies.

## Quick Fixes Applied

### 1. **Updated Email Service Configuration**
- Modified to prefer port 587 (STARTTLS) in production environments
- Added better timeout handling and connection fallbacks
- Enhanced error logging for debugging

### 2. **Environment Variables for Render.com**

Add these environment variables to your Render.com service:

```bash
# Required Email Settings
EMAIL_HOST=srv144.hostserv.co.za
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-email-password
EMAIL_FROM_NAME=XSCard
EMAIL_FROM_ADDRESS=your-email@domain.com

# Production Settings
NODE_ENV=production
EMAIL_SERVICE=smtp

# Recommended: Use port 587 instead of 465 for better compatibility
EMAIL_SMTP_PORT=587

# Optional: SendGrid Fallback (Highly Recommended)
SENDGRID_API_KEY=your-sendgrid-api-key
```

### 3. **Testing Your Configuration**

Run the test script locally first:
```bash
cd backend
node test-email-config.js
```

To test with actual email sending:
```bash
node test-email-config.js --send-test
```

## Recommended Solutions (in order of preference)

### Option 1: Switch to Port 587 (STARTTLS) ⭐ **Recommended**
Most hosting platforms, including Render.com, work better with port 587:
- Set `EMAIL_SMTP_PORT=587` in your Render environment variables
- The updated code now defaults to port 587 in production

### Option 2: Add SendGrid as Fallback ⭐ **Highly Recommended**
SendGrid is more reliable for production email delivery:

1. Sign up for [SendGrid](https://sendgrid.com/) (free tier available)
2. Create an API key in your SendGrid dashboard
3. Add to Render environment variables:
   ```
   SENDGRID_API_KEY=your-actual-api-key
   EMAIL_SERVICE=sendgrid  # Use SendGrid as primary
   ```

### Option 3: Keep SMTP as Primary, SendGrid as Fallback
```
EMAIL_SERVICE=smtp
SENDGRID_API_KEY=your-actual-api-key
```
This way, if SMTP fails, it automatically tries SendGrid.

## Why This Happens

1. **Render.com Networking**: Render may block or throttle certain ports (like 465)
2. **Firewall Restrictions**: Production environments often have stricter networking rules
3. **ISP Blocking**: Some hosting providers block traditional SMTP ports for security

## Verification Steps

After deploying the changes:

1. Check your Render logs for the email transporter configuration
2. Look for messages like:
   - `"Port 465 timed out, testing port 587 with STARTTLS..."`
   - `"Port 587 verification successful - switching to port 587 as default"`
3. Test email functionality through your application

## Additional Tips

- **DNS Issues**: Ensure `srv144.hostserv.co.za` is accessible from Render's servers
- **Authentication**: Double-check your email credentials in Render's environment variables
- **Rate Limiting**: Your email provider might have rate limits that differ between local and production

## Monitoring

The updated code provides better logging. Watch for these log messages in production:
- Connection attempts and results
- Fallback mechanisms being triggered
- SendGrid usage when SMTP fails

## Support

If issues persist, consider:
1. Contacting your email host (hostserv.co.za) about Render.com compatibility
2. Using a dedicated email service like SendGrid, Mailgun, or AWS SES
3. Checking Render.com's documentation for email/SMTP restrictions