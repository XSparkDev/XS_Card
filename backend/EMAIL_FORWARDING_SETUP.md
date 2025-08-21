# Email Forwarding Setup Guide

## Option 1: Forward XSpark Emails to Gmail

### Step 1: Set up Email Forwarding in your XSpark Email
1. **Log into your XSpark email** (xscard@xspark.co.za)
2. **Go to Settings → Forwarding**
3. **Add forwarding address**: `tshethlapuu@gmail.com`
4. **Choose forwarding options**:
   - Forward all emails
   - Keep a copy in XSpark inbox
   - Mark as read in XSpark

### Step 2: Verify Gmail Address
1. **Check your Gmail** (tshethlapuu@gmail.com)
2. **Look for verification email** from XSpark
3. **Click the verification link**

## Option 2: Use Gmail as Primary Reply Address

### Update Environment Variables:
```bash
# Change the reply-to address to Gmail
GMAIL_FROM_ADDRESS="XS Card" <tshethlapuu@gmail.com>
GMAIL_REPLY_TO=tshethlapuu@gmail.com
```

### Update Email Service Code:
```javascript
// In emailService.js, update the Gmail configuration
const gmailMailOptions = {
  ...mailOptions,
  from: process.env.GMAIL_FROM_ADDRESS || '"XS Card" <tshethlapuu@gmail.com>',
  replyTo: process.env.GMAIL_REPLY_TO || 'tshethlapuu@gmail.com'
};
```

## Option 3: Dual Email Setup (Recommended)

### Set up both addresses to receive emails:

1. **Keep XSpark as primary** for business emails
2. **Set up forwarding** from XSpark to Gmail
3. **Use Gmail for personal** communication
4. **Monitor both inboxes** for important emails

## Option 4: Gmail Filters

### Set up Gmail filters to organize emails:
1. **Go to Gmail Settings**
2. **Filters and Blocked Addresses**
3. **Create filter** for emails from XSpark domain
4. **Apply label** "XSpark Business"
5. **Mark as important** for business emails

## Testing the Setup

### Test Email Forwarding:
```bash
# Send test email to XSpark
node -e "
require('dotenv').config();
const { primaryTransporter } = require('./public/Utils/emailService');

const testEmail = {
  to: 'xscard@xspark.co.za',
  subject: 'Forwarding Test - ' + new Date().toISOString(),
  html: '<p>This email should be forwarded to Gmail if forwarding is set up.</p>'
};

primaryTransporter.sendMail(testEmail)
  .then(result => console.log('✅ Test email sent to XSpark'))
  .catch(error => console.log('❌ Failed:', error.message));
"
```

## Recommended Setup

### For Business Use:
- **Primary**: xscard@xspark.co.za (professional)
- **Forward to**: tshethlapuu@gmail.com (convenience)
- **Gmail fallback**: Uses tshethlapuu@gmail.com for sending
- **Replies go to**: xscard@xspark.co.za (maintains branding)

### For Personal Use:
- **Primary**: tshethlapuu@gmail.com
- **Business**: xscard@xspark.co.za (forwarded to Gmail)
- **All emails**: Received in Gmail inbox

## Environment Variables for Dual Receiving

```bash
# Primary SMTP
EMAIL_HOST=srv144.hostserv.co.za
EMAIL_USER=xscard@xspark.co.za
EMAIL_PASSWORD=your-password
EMAIL_SMTP_PORT=587
EMAIL_FROM_NAME=XSCard
EMAIL_FROM_ADDRESS=xscard@xspark.co.za

# Gmail Configuration
GMAIL_USER=tshethlapuu@gmail.com
GMAIL_APP_PASSWORD=xfot xdmq llsi akrb
GMAIL_FROM_ADDRESS="XS Card" <xscard@xspark.co.za>
GMAIL_REPLY_TO=tshethlapuu@gmail.com  # Add this for dual receiving

# SendGrid (optional)
SENDGRID_API_KEY=your-sendgrid-api-key

# Production
NODE_ENV=production
EMAIL_SERVICE=smtp
```

## Which Option Do You Prefer?

1. **Forward XSpark emails to Gmail** (easiest)
2. **Use Gmail as primary reply address** (requires code change)
3. **Dual setup** (recommended for business)
4. **Gmail filters** (for organization)

Let me know which approach you'd like to implement! 