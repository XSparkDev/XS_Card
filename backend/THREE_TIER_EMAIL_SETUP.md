# Three-Tier Email Fallback System Setup

## Overview
Your email system now supports a robust three-tier fallback system:
1. **Primary SMTP** (your main email server)
2. **SendGrid** (secondary fallback)
3. **Gmail** (tertiary fallback)

## Environment Variables Setup

### Required Variables for Render.com:

```bash
# Primary SMTP Configuration
EMAIL_HOST=srv144.hostserv.co.za
EMAIL_USER=xscard@xspark.co.za
EMAIL_PASSWORD=your-actual-password
EMAIL_SMTP_PORT=587
EMAIL_FROM_NAME=XSCard
EMAIL_FROM_ADDRESS=xscard@xspark.co.za

# SendGrid Configuration (Optional - for fallback)
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_SERVICE=smtp

# Gmail Configuration (Required - for tertiary fallback)
GMAIL_USER=tshethlapuu@gmail.com
GMAIL_APP_PASSWORD=xfot xdmq llsi akrb
GMAIL_FROM_ADDRESS="XS Card" <xscard@xspark.co.za>

# Production Settings
NODE_ENV=production
```

## How the Fallback System Works

### 1. Primary SMTP (First Attempt)
- Uses your main email server (srv144.hostserv.co.za)
- Port 587 with STARTTLS (production-friendly)
- If successful: Email sent, process complete

### 2. SendGrid (Second Attempt)
- Only tried if Primary SMTP fails
- Requires SENDGRID_API_KEY to be configured
- If successful: Email sent, process complete

### 3. Gmail (Third Attempt)
- Only tried if both Primary SMTP and SendGrid fail
- Uses Gmail's SMTP with app password authentication
- Most reliable fallback option
- If successful: Email sent, process complete

### 4. Alternative Port (Last Resort)
- If all above fail due to connection issues
- Tries Primary SMTP on port 587 with different settings
- Final attempt before giving up

## Testing Your Setup

### Local Testing:
```bash
cd backend
node test-email-fallbacks.js
```

### Individual Service Testing:
```bash
# Test Primary SMTP only
EMAIL_SERVICE=smtp node test-email-config.js

# Test SendGrid only
EMAIL_SERVICE=sendgrid node test-sendgrid.js

# Test Gmail only (manual test)
```

## Gmail App Password Setup

If you need to generate a new Gmail app password:

1. **Go to Google Account Settings**: https://myaccount.google.com/
2. **Security → 2-Step Verification** (must be enabled)
3. **App passwords** (at the bottom)
4. **Generate new app password** for "Mail"
5. **Copy the 16-character password** (like: `xfot xdmq llsi akrb`)

## Deployment Steps

### 1. Update Environment Variables
Add all the variables above to your Render.com service

### 2. Deploy Updated Code
```bash
git add .
git commit -m "Add three-tier email fallback system"
git push
```

### 3. Test in Production
- Send a test email through your application
- Check Render.com logs for success messages
- Look for provider information in logs

## Monitoring and Logs

The system provides detailed logging:

```
✅ Email sent via primary SMTP to: user@example.com
❌ Primary SMTP failed, trying SendGrid as fallback...
✅ Email sent via SendGrid to: user@example.com
❌ SendGrid failed, trying Gmail as final fallback...
✅ Email sent via Gmail fallback to: user@example.com
```

## Troubleshooting

### Primary SMTP Issues:
- Check EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD
- Verify port 587 is accessible from Render.com
- Check firewall/network restrictions

### SendGrid Issues:
- Verify SENDGRID_API_KEY is correct
- Check SendGrid account status and limits
- Ensure API key has "Mail Send" permissions

### Gmail Issues:
- Verify GMAIL_USER and GMAIL_APP_PASSWORD
- Check if 2FA is enabled on Gmail account
- Ensure app password is generated correctly

## Benefits of This System

1. **Maximum Reliability**: Three different email providers
2. **Automatic Failover**: No manual intervention needed
3. **Production Ready**: Handles connection timeouts gracefully
4. **Cost Effective**: Uses free tiers where possible
5. **Easy Monitoring**: Clear logging shows which provider was used

## Emergency Contacts

If all email services fail:
1. Check Render.com logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test individual services using the test scripts
4. Contact your email provider for server status

## Next Steps

1. **Deploy the updated code** to Render.com
2. **Add all environment variables** to your Render service
3. **Test the system** using the test script
4. **Monitor logs** for the first few days
5. **Set up alerts** if needed for email failures

Your email system is now bulletproof with triple redundancy! 🛡️ 