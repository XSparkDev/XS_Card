# Scheduled Jobs

This directory contains all scheduled background jobs for the XS Card application.

## Jobs Overview

### 1. Trial Expiration Job (`trialExpirationJob.js`)
- **Purpose**: Checks for expired trial users and converts them to active subscriptions
- **Schedule**: Every 12 hours
- **Function**: 
  - Finds users with `subscriptionStatus: 'trial'` and expired `trialEndDate`
  - Verifies subscription status with Paystack
  - Converts valid subscriptions to active status
  - Marks cancelled subscriptions as cancelled and changes plan to free

### 2. Inactive Users Job (`inactiveUsersJob.js`)
- **Purpose**: Finds and lists inactive user accounts for Apple compliance
- **Schedule**: Configurable via environment variable (default: 6 months)
- **Function**:
  - Finds users with `active: false`
  - Lists detailed information for review
  - Prepares for future archiving functionality

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Inactive users check interval (in minutes)
# Default: 6 months (259,200 minutes)
# For testing: Use small values like 5, 10, 30 minutes
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=259200
```

### Time Conversions
- 1 minute = 1
- 1 hour = 60
- 1 day = 1,440
- 1 week = 10,080
- 1 month (30 days) = 43,200
- 6 months = 259,200
- 1 year = 525,600

## Usage

### Starting All Jobs
```javascript
const jobs = require('./jobs');
jobs.startAllJobs(db);
```

### Starting Individual Jobs
```javascript
const jobs = require('./jobs');

// Start only trial expiration job
jobs.startTrialExpirationJob(db);

// Start only inactive users job
jobs.startInactiveUsersJob(db);
```

### Manual Job Execution (for testing)
```javascript
const jobs = require('./jobs');

// Manually run trial expiration check
await jobs.checkExpiredTrials(db);

// Manually run inactive users check
await jobs.checkInactiveUsers(db);
```

## Job Structure

Each job file exports:
- `start[JobName]Job(db)` - Function to start the scheduled job
- `check[JobName](db)` - Function to manually run the job once

## Logging

All jobs log their activities to the console:
- When they start
- What they find
- What actions they take
- Any errors encountered

## Future Enhancements

- Archive inactive users to separate collection
- Send notifications to admin
- Export inactive users list
- Automatic data anonymization
- Job status monitoring
- Job failure alerts
