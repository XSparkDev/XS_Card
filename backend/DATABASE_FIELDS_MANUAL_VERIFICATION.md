# 📊 DATABASE FIELDS FOR MANUAL VERIFICATION

## 🎯 **PURPOSE**
This document provides the exact database fields administrators need to check for manual subscription verification and troubleshooting.

## 🔍 **USERS COLLECTION (`users/{userId}`)**

### **Subscription Status Fields**
```javascript
{
  // Subscription Status
  subscriptionStatus: 'active' | 'trial' | 'cancelled' | 'expired' | 'trial_incomplete',
  
  // Plan Information
  subscriptionPlan: 'MONTHLY_PLAN' | 'ANNUAL_PLAN',
  plan: 'premium' | 'free', // RBAC field
  
  // Payment References
  subscriptionReference: 'paystack_reference_here',
  paymentReference: 'paystack_reference_here', // For trials
  
  // Dates
  subscriptionStart: '2024-01-01T00:00:00.000Z',
  subscriptionEnd: '2024-02-01T00:00:00.000Z',
  trialStartDate: '2024-01-01T00:00:00.000Z', // For trials
  trialEndDate: '2024-01-08T00:00:00.000Z', // For trials
  cancellationDate: '2024-01-15T00:00:00.000Z', // If cancelled
  firstBillingDate: '2024-01-08T00:00:00.000Z', // When trial converts
  
  // Paystack Integration
  customerCode: 'CUS_xxxxxxxxxxxxx',
  subscriptionCode: 'SUB_xxxxxxxxxxxxx',
  subscriptionId: 'subscription_id_from_paystack',
  
  // Payment Failures
  lastPaymentFailure: '2024-01-15T00:00:00.000Z',
  paymentFailureCount: 1,
  
  // Audit Fields
  createdAt: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z'
}
```

## 🔍 **SUBSCRIPTIONS COLLECTION (`subscriptions/{userId}`)**

### **Subscription Details Fields**
```javascript
{
  // User Reference
  userId: 'user_id_here',
  email: 'user@example.com',
  
  // Plan Information
  planId: 'MONTHLY_PLAN' | 'ANNUAL_PLAN',
  status: 'active' | 'trial' | 'cancelled' | 'expired',
  
  // Payment Information
  reference: 'paystack_reference_here',
  amount: 159.99, // Amount paid
  
  // Dates
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-02-01T00:00:00.000Z',
  trialStartDate: '2024-01-01T00:00:00.000Z', // For trials
  trialEndDate: '2024-01-08T00:00:00.000Z', // For trials
  cancellationDate: '2024-01-15T00:00:00.000Z', // If cancelled
  firstBillingDate: '2024-01-08T00:00:00.000Z', // When trial converts
  
  // Paystack Integration
  customerCode: 'CUS_xxxxxxxxxxxxx',
  subscriptionCode: 'SUB_xxxxxxxxxxxxx',
  subscriptionId: 'subscription_id_from_paystack',
  
  // Payment Data
  paymentData: { /* Full Paystack payment response */ },
  subscriptionData: { /* Full Paystack subscription response */ },
  transactionData: { /* Full Paystack transaction data */ },
  
  // Audit Fields
  createdAt: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z'
}
```

## 🔍 **SUBSCRIPTION LOGS COLLECTION (`subscriptionLogs/{logId}`)**

### **Audit Trail Fields**
```javascript
{
  // User Reference
  userId: 'user_id_here',
  
  // Event Information
  eventType: 'atomic_subscription_creation' | 'atomic_subscription_cancellation' | 'atomic_trial_conversion' | 'atomic_payment_failure' | 'subscription_created' | 'subscription_cancelled',
  
  // Event Data
  eventData: {
    reference: 'paystack_reference_here',
    planId: 'MONTHLY_PLAN',
    amount: 159.99,
    interval: 'monthly',
    userData: { /* User data that was updated */ },
    subscriptionData: { /* Subscription data that was updated */ },
    error: 'Error message if failed'
  },
  
  // Timestamp
  timestamp: '2024-01-01T00:00:00.000Z'
}
```

## 🔍 **USER BANK CARDS COLLECTION (`user_bank_cards/{userId}`)**

### **Banking Information Fields**
```javascript
{
  // User Reference
  userId: 'user_id_here',
  
  // Bank Details
  accountNumber: '1234567890',
  bankCode: '011',
  bankName: 'First Bank of Nigeria',
  accountName: 'John Doe',
  
  // Verification
  isVerified: true,
  verificationData: { /* Bank verification response */ },
  
  // Audit Fields
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}
```

---

## 🚨 **MANUAL VERIFICATION PROCEDURES**

### **1. Verify Subscription Status**
```javascript
// Check if user and subscription status match
users/{userId}.subscriptionStatus === subscriptions/{userId}.status
users/{userId}.subscriptionPlan === subscriptions/{userId}.planId
users/{userId}.subscriptionReference === subscriptions/{userId}.reference
```

### **2. Verify Payment References**
```javascript
// Ensure payment references are consistent
users/{userId}.subscriptionReference === subscriptions/{userId}.reference
// Both should match Paystack transaction reference
```

### **3. Verify Dates Consistency**
```javascript
// Check date alignment
users/{userId}.subscriptionStart === subscriptions/{userId}.startDate
users/{userId}.subscriptionEnd === subscriptions/{userId}.endDate
users/{userId}.trialStartDate === subscriptions/{userId}.trialStartDate
users/{userId}.trialEndDate === subscriptions/{userId}.trialEndDate
```

### **4. Verify Plan and RBAC Consistency**
```javascript
// Check plan consistency for access control
if (users/{userId}.subscriptionStatus === 'active') {
  users/{userId}.plan should be 'premium'
}
if (users/{userId}.subscriptionStatus === 'cancelled') {
  users/{userId}.plan should be 'free'
}
```

---

## 🔧 **COMMON TROUBLESHOOTING SCENARIOS**

### **Scenario 1: User Claims Premium But Shows Free**
**Check:**
1. `users/{userId}.subscriptionStatus` - Should be 'active'
2. `users/{userId}.plan` - Should be 'premium'
3. `subscriptions/{userId}.status` - Should be 'active'
4. `subscriptions/{userId}.endDate` - Should be in future

**Fix:** Update both collections with atomic transaction

### **Scenario 2: Payment Succeeded But User Not Premium**
**Check:**
1. `subscriptionLogs` for recent events with userId
2. `users/{userId}.subscriptionReference` - Should match payment
3. `subscriptions/{userId}.reference` - Should match payment
4. `subscriptions/{userId}.transactionData` - Check Paystack response

**Fix:** Run manual subscription activation with correct data

### **Scenario 3: Data Inconsistency Between Collections**
**Check:**
1. Run consistency validation: `validateDataConsistency(userId)`
2. Compare all matching fields between collections
3. Check `subscriptionLogs` for failed atomic transactions

**Fix:** Use atomic transaction to synchronize data

### **Scenario 4: Subscription Shows Active But Expired**
**Check:**
1. `subscriptions/{userId}.endDate` - Compare with current date
2. `users/{userId}.subscriptionEnd` - Should match subscription
3. Check for webhook processing failures in logs

**Fix:** Update status to 'expired' and plan to 'free'

---

## 📋 **MANUAL VERIFICATION CHECKLIST**

### **For Active Subscriptions:**
- [ ] `subscriptionStatus` = 'active' in both collections
- [ ] `plan` = 'premium' in users collection
- [ ] `endDate` is in the future
- [ ] Payment references match between collections
- [ ] Paystack subscription is active (check with API)

### **For Cancelled Subscriptions:**
- [ ] `subscriptionStatus` = 'cancelled' in both collections
- [ ] `plan` = 'free' in users collection
- [ ] `cancellationDate` is set in both collections
- [ ] Paystack subscription is cancelled (check with API)

### **For Trial Subscriptions:**
- [ ] `subscriptionStatus` = 'trial' in both collections
- [ ] `plan` = 'premium' in users collection (during trial)
- [ ] `trialEndDate` is in the future (if still in trial)
- [ ] `customerCode` and `subscriptionCode` are set

---

## 🎯 **DATA CONSISTENCY COMMANDS**

### **Check Data Consistency (Node.js)**
```javascript
const { validateDataConsistency } = require('./utils/atomicTransactions');
const result = await validateDataConsistency('user_id_here');
console.log('Consistent:', result.isConsistent);
console.log('Issues:', result.inconsistencies);
```

### **Manual Atomic Update (Node.js)**
```javascript
const { executeAtomicSubscriptionUpdate } = require('./utils/atomicTransactions');
await executeAtomicSubscriptionUpdate(
  'user_id_here',
  { subscriptionStatus: 'active', plan: 'premium' },
  { status: 'active' },
  'manual_fix'
);
```

**This documentation provides everything needed for manual verification and troubleshooting of subscription data.**
