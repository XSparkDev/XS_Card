# Firebase Cloud Functions - Sample Cron Job

## Quick Start

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Set Environment Variables
```bash
# Using Firebase Functions config (recommended)
firebase functions:config:set email.host="srv144.hostserv.co.za"
firebase functions:config:set email.user="xscard@xspark.co.za"
firebase functions:config:set email.password="your-password"
firebase functions:config:set email.from="xscard@xspark.co.za"
firebase functions:config:set email.test_to="your-test-email@example.com"
```

### 3. Deploy
```bash
# From project root
firebase deploy --only functions:sampleCronJob
```

### 4. Verify
- Check Firestore `cron_logs` collection - new entries every minute
- Check your email - test emails every minute
- Check logs: `firebase functions:log --only sampleCronJob`

## What It Does

Every minute, this function:
1. ✅ Logs to console
2. ✅ Saves entry to Firestore `cron_logs` collection
3. ✅ Sends test email

## Change Schedule

Edit `functions/index.js`:
```javascript
// Every minute (current - for testing)
.schedule('* * * * *')

// Every hour
.schedule('0 * * * *')

// Every day at 9 AM
.schedule('0 9 * * *')

// Monthly on 1st at 9 AM
.schedule('0 9 1 * *')
```

## Stop the Cron

```bash
firebase functions:delete sampleCronJob
```

See `FIREBASE_CRON_SETUP.md` for full documentation.
