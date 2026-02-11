# Firebase Cloud Functions Cron Job Setup

## Overview
This directory contains a sample Firebase Cloud Function that runs as a scheduled cron job every minute for testing purposes.

## What It Does
1. **Logs to Console** - Prints execution details to Firebase Functions logs
2. **Saves to Firestore** - Creates a log entry in `cron_logs` collection
3. **Sends Email** - Sends a test email using your configured email service

## Setup Instructions

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Functions (if not already done)
```bash
firebase init functions
```
- Select your Firebase project
- Choose JavaScript
- Install dependencies: Yes

### 4. Install Dependencies
```bash
cd functions
npm install
```

### 5. Set Environment Variables

#### Option A: Using Firebase Functions Config (Recommended for Production)
```bash
# Set email configuration
firebase functions:config:set email.host="srv144.hostserv.co.za"
firebase functions:config:set email.user="xscard@xspark.co.za"
firebase functions:config:set email.password="your-password"
firebase functions:config:set email.from="xscard@xspark.co.za"
firebase functions:config:set email.test_to="your-test-email@example.com"

# Set SendGrid (optional - for fallback)
firebase functions:config:set sendgrid.api_key="your-sendgrid-api-key"
```

#### Option B: Using .env file (for local testing)
Create `functions/.env`:
```bash
EMAIL_HOST=srv144.hostserv.co.za
EMAIL_USER=xscard@xspark.co.za
EMAIL_PASSWORD=your-password
EMAIL_FROM_ADDRESS=xscard@xspark.co.za
TEST_EMAIL_TO=your-test-email@example.com
SENDGRID_API_KEY=your-sendgrid-api-key
```

### 6. Deploy the Function
```bash
# From project root
firebase deploy --only functions:sampleCronJob
```

Or deploy all functions:
```bash
firebase deploy --only functions
```

## Testing

### 1. Check Firestore
After deployment, check the `cron_logs` collection in Firestore. You should see new entries every minute.

### 2. Check Email
You should receive test emails every minute at the configured `TEST_EMAIL_TO` address.

### 3. Check Logs
```bash
firebase functions:log --only sampleCronJob
```

Or view in Firebase Console:
- Go to Firebase Console → Functions → Logs

## Changing the Schedule

To change from every minute to a different schedule, edit `functions/index.js`:

```javascript
// Every minute (current)
.schedule('* * * * *')

// Every hour
.schedule('0 * * * *')

// Every day at 9 AM
.schedule('0 9 * * *')

// Every month on the 1st at 9 AM
.schedule('0 9 1 * *')
```

Cron format: `minute hour day month dayOfWeek`
- `* * * * *` = every minute
- `0 * * * *` = every hour at minute 0
- `0 9 * * *` = every day at 9:00 AM
- `0 9 1 * *` = 1st of every month at 9:00 AM

## Viewing Logs in Firestore

The cron job saves logs to:
```
cron_logs/{logId}
```

Each document contains:
- `timestamp` - When the cron ran
- `message` - Status message
- `logId` - Unique log ID
- `status` - 'success' or 'error'
- `emailSent` - Whether email was sent
- `emailError` - Email error if any
- `metadata` - Function execution details

## Stopping the Cron Job

To stop the cron job:
```bash
firebase functions:delete sampleCronJob
```

## Next Steps

Once you've verified the cron job works:
1. Change the schedule to your desired frequency (e.g., monthly)
2. Update the function to send monthly invoices instead of test emails
3. Add logic to query enterprise accounts with `monthlyInvoiceEmails: true`
4. Generate and email invoice PDFs

## Troubleshooting

### Function not running
- Check Firebase Console → Functions → Logs for errors
- Verify the function is deployed: `firebase functions:list`
- Check Firestore rules allow writes to `cron_logs`

### Email not sending
- Verify email configuration is set correctly
- Check Firebase Functions logs for email errors
- Verify SendGrid API key or SMTP credentials are correct

### Permission errors
- Ensure Firebase Admin SDK has proper permissions
- Check Firestore security rules
