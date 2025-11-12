# Subscription Listing Job Usage Guide

## Overview
The subscription listing job checks and lists every user that has a subscription (trial, active, or premium plan) in the XS Card system.

## Usage

### Run the Job
```bash
# From the backend directory
node jobs/subscriptionListingJob.js

# Or from the project root
node backend/jobs/subscriptionListingJob.js
```

### What the Job Does
1. **Scans all users** in the database (230 users found in current system)
2. **Categorizes users** by subscription status:
   - 🟢 Active Subscriptions (22 users)
   - 🟡 Trial Subscriptions (1 user) 
   - 🔵 Premium Plan Users (13 users)
   - 🔴 Cancelled Subscriptions (3 users)
   - ⚫ Expired Subscriptions (0 users)
   - ⚪ Free Plan Users (98 users)
   - ❓ Unknown Status (93 users)

3. **Provides detailed information** for each user:
   - Name and email
   - Subscription plan and status
   - Customer codes and subscription codes
   - Trial dates and billing dates
   - Last login information

4. **Calculates statistics**:
   - Total users: 230
   - Users with subscriptions: 36 (15.65% subscription rate)
   - Breakdown by category

5. **Checks RevenueCat collections** for additional subscription data

## Sample Output
```
📊 SUBSCRIPTION ANALYSIS RESULTS
================================================================================

🟢 ACTIVE SUBSCRIPTIONS: 22
  1. Pule Tshetlha (kolacet883@forexru.com)
     Plan: ANNUAL_PLAN | Status: active
     Start: N/A | End: N/A
     Customer Code: CUS_jc2e0sav0ceye2e

📈 SUMMARY STATISTICS
================================================================================
Total Users: 230
Users with Subscriptions: 36
  - Active Subscriptions: 22
  - Trial Subscriptions: 1
  - Premium Plan Users: 13
Free Users: 98
Cancelled Subscriptions: 3
Expired Subscriptions: 0
Unknown Status: 93

Subscription Rate: 15.65%
```

## Integration with Jobs System
The job is integrated into the main jobs system and can be accessed via:

```javascript
const jobs = require('./jobs');

// Run subscription listing
await jobs.checkUsersWithSubscriptions();

// Check RevenueCat subscriptions
await jobs.checkRevenueCatSubscriptions();

// Get detailed info for specific user
await jobs.getUserSubscriptionDetails('userId');
```

## Data Sources
The job checks multiple data sources:
1. **Users collection** - Main user data with subscription status
2. **Subscriptions collection** - Detailed subscription information
3. **RevenueCat collections** - Third-party subscription data (if available)

## Use Cases
- **Business Analytics**: Track subscription metrics and user conversion
- **Customer Support**: Quickly identify user subscription status
- **Revenue Analysis**: Monitor active vs cancelled subscriptions
- **System Health**: Verify subscription data integrity
- **Reporting**: Generate subscription reports for stakeholders

## Notes
- The job is read-only and doesn't modify any data
- Safe to run multiple times
- Provides comprehensive subscription overview
- Includes both Paystack and RevenueCat subscription data
- Shows both active subscriptions and premium plan users
