# Enterprise Payment Flow - Complete Scenario

## 🎬 Scenario: Acme Corporation Purchases Enterprise Subscription

---

## **Step 1: Enterprise Visits External UI**

**Actor:** Acme Corp Admin (John Doe)  
**Location:** External website (e.g., `enterprise.xscard.co.za`)

**Action:**
- Opens enterprise signup page
- Sees simple form with fields:
  - Company Name
  - Contact Name
  - Contact Email
  - Number of Employees
  - Currency (ZAR or USD)

**User Input:**
```
Company Name: "Acme Corporation"
Contact Name: "John Doe"
Contact Email: "john.doe@acme.com"
Number of Employees: 50
Currency: "ZAR"
```

**UI State:** Form ready, "Get Quote" button enabled

---

## **Step 2: User Clicks "Get Quote"**

**Action:** User clicks "Get Quote" button

**Frontend Request:**
```http
POST /api/enterprise/quote
Content-Type: application/json

{
  "companyName": "Acme Corporation",
  "contactName": "John Doe",
  "contactEmail": "john.doe@acme.com",
  "numberOfEmployees": 50,
  "currency": "ZAR"
}
```

**Backend Processing:**
1. **Validation:**
   - ✅ numberOfEmployees = 50 (valid, 1-10000)
   - ✅ Email format valid
   - ✅ Company name valid (1-200 chars)
   - ✅ Contact name valid (1-100 chars)
   - ✅ Currency = "ZAR" (valid)

2. **Price Calculation:**
   ```javascript
   // Using simple linear pricing for ZAR
   basePrice = 10000 (R100.00)
   pricePerEmployee = 1000 (R10.00)
   
   totalPrice = 10000 + (50 * 1000)
   totalPrice = 60000 cents = R600.00
   ```

3. **Quote Generation:**
   ```javascript
   quoteId = "quote_" + timestamp + "_" + randomString
   quoteId = "quote_1705123456789_abc123"
   
   expiresAt = now + 30 days
   expiresAt = "2024-02-15T12:00:00Z"
   ```

4. **Database Write:**
   ```javascript
   // Firestore: enterprise_quotes collection
   {
     quoteId: "quote_1705123456789_abc123",
     companyName: "Acme Corporation",
     contactEmail: "john.doe@acme.com",
     contactName: "John Doe",
     numberOfEmployees: 50,
     calculatedPrice: 60000,  // R600.00 in cents
     currency: "ZAR",
     quoteStatus: "pending",
     subscriptionType: "yearly",
     createdAt: Timestamp("2024-01-15T12:00:00Z"),
     expiresAt: Timestamp("2024-02-15T12:00:00Z"),
     paymentReference: null,
     paymentUrl: null,
     planCode: null,
     paidAt: null
   }
   ```

**Backend Response:**
```json
{
  "success": true,
  "quoteId": "quote_1705123456789_abc123",
  "companyName": "Acme Corporation",
  "numberOfEmployees": 50,
  "calculatedPrice": 60000,
  "currency": "ZAR",
  "priceDisplay": "R 600.00",
  "expiresAt": "2024-02-15T12:00:00Z",
  "message": "Quote generated successfully"
}
```

**UI State:** Quote displayed, "Proceed to Payment" button shown

---

## **Step 3: User Reviews Quote & Clicks "Proceed to Payment"**

**Action:** User reviews quote, sees:
- Company: Acme Corporation
- Employees: 50
- Price: R 600.00 per year
- Valid until: February 15, 2024

User clicks "Proceed to Payment" button

**Frontend Request:**
```http
POST /api/enterprise/payment/initialize
Content-Type: application/json

{
  "quoteId": "quote_1705123456789_abc123"
}
```

**Backend Processing:**
1. **Fetch Quote:**
   ```javascript
   quoteDoc = await db.collection('enterprise_quotes')
     .doc('quote_1705123456789_abc123')
     .get()
   
   quoteData = quoteDoc.data()
   // quoteData exists ✅
   // quoteData.quoteStatus = "pending" ✅
   // quoteData.expiresAt > now ✅ (not expired)
   ```

2. **Duplicate Payment Prevention:**
   ```javascript
   if (quoteData.quoteStatus === 'paid') {
     return res.status(400).json({ error: 'Quote already paid' });
   }
   // Status is "pending", proceed ✅
   ```

3. **Find or Create Paystack Plan:**
   ```javascript
   // Check database first (fast lookup)
   existingPlan = await db.collection('enterprise_plans')
     .where('numberOfEmployees', '==', 50)
     .where('amount', '==', 60000)
     .where('currency', '==', 'ZAR')
     .limit(1)
     .get()
   
   if (!existingPlan.empty) {
     planCode = existingPlan.docs[0].data().planCode // Reuse existing
     planCode = "PLN_abc123xyz789"
   } else {
     // Create new plan in Paystack
     planCode = await createPaystackPlan(50, 60000, 'ZAR')
     planCode = "PLN_abc123xyz789"
     
     // Store in database for reuse
     await db.collection('enterprise_plans').add({
       planCode: "PLN_abc123xyz789",
       numberOfEmployees: 50,
       amount: 60000,
       currency: "ZAR",
       createdAt: Timestamp.now()
     })
   }
   ```

4. **Generate Payment Reference:**
   ```javascript
   timestamp = Date.now() // 1705123456789
   randomSuffix = Math.random().toString(36).substring(2, 8) // "xyz789"
   
   paymentReference = `ent_quote_1705123456789_abc123_${timestamp}_${randomSuffix}`
   paymentReference = "ent_quote_1705123456789_abc123_1705123456789_xyz789"
   ```

5. **Prepare Paystack Subscription Request:**
   ```javascript
   baseUrl = process.env.APP_URL // "https://api.xscard.co.za"
   
   paystackParams = {
     email: "john.doe@acme.com",
     amount: 60000,  // R600.00 in cents
     plan: "PLN_abc123xyz789",  // ← Paystack plan code (subscription)
     reference: "ent_quote_1705123456789_abc123_1705123456789_xyz789",
     currency: "ZAR",
     callback_url: "https://api.xscard.co.za/api/enterprise/payment/callback?ref=ent_quote_1705123456789_abc123_1705123456789_xyz789",
     metadata: {
       quoteId: "quote_1705123456789_abc123",
       companyName: "Acme Corporation",
       numberOfEmployees: 50,
       paymentType: "enterprise_subscription"  // ← Subscription, not one-time
     }
   }
   ```

6. **Call Paystack API:**
   ```http
   POST https://api.paystack.co/transaction/initialize
   Authorization: Bearer sk_live_xxxxxxxxxxxxx
   Content-Type: application/json
   
   {
     "email": "john.doe@acme.com",
     "amount": 60000,
     "plan": "PLN_abc123xyz789",  // ← Plan code for subscription
     "reference": "ent_quote_1705123456789_abc123_1705123456789_xyz789",
     "currency": "ZAR",
     "callback_url": "https://api.xscard.co.za/api/enterprise/payment/callback?ref=ent_quote_1705123456789_abc123_1705123456789_xyz789",
     "metadata": {
       "quoteId": "quote_1705123456789_abc123",
       "companyName": "Acme Corporation",
       "numberOfEmployees": 50,
       "paymentType": "enterprise_subscription"
     }
   }
   ```

7. **Paystack Response:**
   ```json
   {
     "status": true,
     "message": "Authorization URL created",
     "data": {
       "authorization_url": "https://paystack.com/pay/xyz789abc",
       "access_code": "xyz789abc",
       "reference": "ent_quote_1705123456789_abc123_1705123456789_xyz789"
     }
   }
   ```

8. **Update Quote in Database:**
   ```javascript
   await quoteDoc.ref.update({
     quoteStatus: "accepted",
     paymentReference: "ent_quote_1705123456789_abc123_1705123456789_xyz789",
     paymentUrl: "https://paystack.com/pay/xyz789abc",
     planCode: "PLN_abc123xyz789",
     updatedAt: Timestamp.now()
   })
   ```

**Backend Response:**
```json
{
  "success": true,
  "paymentUrl": "https://paystack.com/pay/xyz789abc",
  "paymentReference": "ent_quote_1705123456789_abc123_1705123456789_xyz789",
  "amount": 60000,
  "currency": "ZAR",
  "subscriptionType": "yearly"
}
```

**UI State:** User redirected to Paystack payment page

---

## **Step 4: User Completes Payment on Paystack**

**Action:** User is on Paystack payment page

**User Flow:**
1. Sees payment amount: R 600.00 per year
2. Sees subscription details: "Yearly subscription, auto-renews annually"
3. Selects payment method (card/bank transfer)
4. Enters payment details
5. Clicks "Pay"

**Paystack Processing:**
- Processes payment
- Charges R 600.00
- **Creates customer** (if doesn't exist)
- **Creates subscription** (yearly recurring)
- Payment successful ✅
- **Subscription created** ✅

**Paystack Actions:**
1. **Redirects to Callback URL:**
   ```
   https://api.xscard.co.za/api/enterprise/payment/callback?ref=ent_quote_1705123456789_abc123_1705123456789_xyz789
   ```

2. **Sends Webhook (async):**
   ```http
   POST https://api.xscard.co.za/api/enterprise/payment/webhook
   X-Paystack-Signature: sha512_hash_here
   Content-Type: application/json
   
   {
     "event": "subscription.create",  // ← Subscription created, not charge.success
     "data": {
       "subscription": {
         "subscription_code": "SUB_xyz789",
         "customer": {
           "customer_code": "CUS_abc123",
           "email": "john.doe@acme.com"
         },
         "plan": {
           "plan_code": "PLN_abc123xyz789",
           "amount": 60000,
           "interval": "annually"
         },
         "next_payment_date": "2025-01-15T12:00:00Z",
         "status": "active"
       },
       "transaction": {
         "reference": "ent_quote_1705123456789_abc123_1705123456789_xyz789",
         "amount": 60000,
         "currency": "ZAR",
         "status": "success"
       },
       "metadata": {
         "quoteId": "quote_1705123456789_abc123",
         "companyName": "Acme Corporation",
         "numberOfEmployees": 50,
         "paymentType": "enterprise_subscription"
       }
     }
   }
   ```

---

## **Step 5A: Payment Callback (User Redirect)**

**Action:** Paystack redirects user to callback URL

**Backend Processing:**
1. **Extract Payment Reference:**
   ```javascript
   paymentReference = req.query.ref
   paymentReference = "ent_quote_1705123456789_abc123_1705123456789_xyz789"
   ```

2. **Verify Payment with Paystack:**
   ```javascript
   // Call Paystack verification API
   GET https://api.paystack.co/transaction/verify/ent_quote_1705123456789_abc123_1705123456789_xyz789
   Authorization: Bearer sk_live_xxxxxxxxxxxxx
   
   // Paystack Response:
   {
     "status": true,
     "data": {
       "reference": "ent_quote_1705123456789_abc123_1705123456789_xyz789",
       "amount": 60000,
       "currency": "ZAR",
       "status": "success",
       "customer": {
         "email": "john.doe@acme.com",
         "customer_code": "CUS_abc123"
       },
       "authorization": {
         "authorization_code": "AUTH_xyz789"
       },
       "metadata": {
         "quoteId": "quote_1705123456789_abc123",
         "companyName": "Acme Corporation",
         "numberOfEmployees": 50,
         "paymentType": "enterprise_subscription"
       }
     }
   }
   ```

3. **Get Subscription Details from Paystack:**
   ```javascript
   // Fetch subscription details (Paystack created subscription)
   subscriptionData = await getPaystackSubscriptionStatus("SUB_xyz789")
   // Returns:
   {
     subscription_code: "SUB_xyz789",
     customer_code: "CUS_abc123",
     plan_code: "PLN_abc123xyz789",
     status: "active",
     next_payment_date: "2025-01-15T12:00:00Z",
     created_at: "2024-01-15T12:05:00Z"
   }
   ```

4. **Find Quote:**
   ```javascript
   // Query by paymentReference
   quoteSnapshot = await db.collection('enterprise_quotes')
     .where('paymentReference', '==', 'ent_quote_1705123456789_abc123_1705123456789_xyz789')
     .limit(1)
     .get()
   
   quoteDoc = quoteSnapshot.docs[0]
   quoteData = quoteDoc.data()
   // quoteData.quoteId = "quote_1705123456789_abc123" ✅
   ```

5. **Check if Already Processed (Idempotency):**
   ```javascript
   if (quoteData.quoteStatus === 'paid') {
     // Already processed, redirect to success
     return res.redirect('/enterprise-payment-success.html?quoteId=quote_1705123456789_abc123')
   }
   // Status is "accepted", proceed with processing ✅
   ```

6. **Create Enterprise Account (Atomic Transaction):**
   ```javascript
   enterpriseId = "ent_" + quoteData.quoteId.replace('quote_', '')
   enterpriseId = "ent_1705123456789_abc123"
   
   // Use Firestore batch writes for atomicity
   const batch = db.batch();
   const accountRef = db.collection('enterprise_accounts').doc(enterpriseId);
   const quoteRef = quoteDoc.ref;
   
   // Account data with subscription fields
   accountData = {
     enterpriseId: "ent_1705123456789_abc123",
     companyName: "Acme Corporation",
     contactEmail: "john.doe@acme.com",
     contactName: "John Doe",
     numberOfEmployees: 50,
     plan: "enterprise",
     accountStatus: "active",
     
     // Paystack Subscription Fields
     subscriptionCode: "SUB_xyz789",
     subscriptionStatus: "active",
     planCode: "PLN_abc123xyz789",
     customerCode: "CUS_abc123",
     
     // Dates (from Paystack)
     subscriptionStartDate: Timestamp.fromDate(new Date("2024-01-15T12:05:00Z")),
     subscriptionEndDate: Timestamp.fromDate(new Date("2025-01-15T12:00:00Z")),
     nextBillingDate: Timestamp.fromDate(new Date("2025-01-15T12:00:00Z")),
     lastBillingDate: Timestamp.fromDate(new Date("2024-01-15T12:05:00Z")),
     
     // Our tracking
     quoteId: "quote_1705123456789_abc123",
     activatedAt: Timestamp.now(),
     createdAt: Timestamp.now(),
     updatedAt: Timestamp.now()
   }
   
   batch.set(accountRef, accountData);
   batch.update(quoteRef, {
     quoteStatus: "paid",
     paidAt: Timestamp.now()
   });
   
   await batch.commit(); // Atomic - both succeed or both fail
   ```

7. **Redirect to Success Page:**
   ```javascript
   res.redirect('/enterprise-payment-success.html?quoteId=quote_1705123456789_abc123&companyName=Acme%20Corporation')
   ```

**User Experience:**
- Sees success page
- Message: "Payment successful! Your enterprise subscription is now active."
- Shows company name, subscription details, and next billing date

---

## **Step 5B: Payment Webhook (Backend Processing)**

**Action:** Paystack sends webhook (happens in parallel with callback)

**Backend Processing:**
1. **Verify Webhook Signature:**
   ```javascript
   signature = req.headers['x-paystack-signature']
   payload = req.body
   
   hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
     .update(JSON.stringify(payload))
     .digest('hex')
   
   if (hash !== signature) {
     return res.status(400).json({ error: 'Invalid signature' })
   }
   // Signature valid ✅
   ```

2. **Acknowledge Webhook Immediately:**
   ```javascript
   res.status(200).json({ received: true }); // Acknowledge immediately
   ```

3. **Process Asynchronously:**
   ```javascript
   setImmediate(async () => {
     // Process webhook
   })
   ```

4. **Check Event Type:**
   ```javascript
   if (payload.event === 'subscription.create') {  // ← Subscription event
     // Process subscription creation ✅
   }
   ```

5. **Fetch Current State from Paystack (Handles Out-of-Order Webhooks):**
   ```javascript
   subscriptionCode = payload.data.subscription?.subscription_code
   subscriptionCode = "SUB_xyz789"
   
   // Always fetch current state from Paystack before processing
   currentSubscription = await getPaystackSubscriptionStatus(subscriptionCode)
   // Use current state, not webhook state (handles out-of-order)
   ```

6. **Extract Subscription Data:**
   ```javascript
   subscription = payload.data.subscription
   subscriptionCode = subscription.subscription_code // "SUB_xyz789"
   customerCode = subscription.customer.customer_code // "CUS_abc123"
   planCode = subscription.plan.plan_code // "PLN_abc123xyz789"
   metadata = payload.data.metadata
   quoteId = metadata.quoteId // "quote_1705123456789_abc123"
   ```

7. **Find Quote:**
   ```javascript
   quoteSnapshot = await db.collection('enterprise_quotes')
     .where('quoteId', '==', quoteId)
     .limit(1)
     .get()
   
   quoteDoc = quoteSnapshot.docs[0]
   quoteData = quoteDoc.data()
   ```

8. **Check if Already Processed (Idempotency):**
   ```javascript
   // Check if account already exists
   accountSnapshot = await db.collection('enterprise_accounts')
     .where('subscriptionCode', '==', subscriptionCode)
     .limit(1)
     .get()
   
   if (!accountSnapshot.empty) {
     account = accountSnapshot.docs[0].data()
     if (account.subscriptionStatus === 'active' && account.accountStatus === 'active') {
       console.log('✅ Already processed - skipping');
       return { alreadyProcessed: true };
     }
   }
   ```

9. **Create/Update Enterprise Account (Atomic Transaction with Retry):**
   ```javascript
   enterpriseId = "ent_1705123456789_abc123"
   
   // Retry logic for database failures
   for (let attempt = 1; attempt <= 3; attempt++) {
     try {
       const batch = db.batch();
       const accountRef = db.collection('enterprise_accounts').doc(enterpriseId);
       
       accountData = {
         enterpriseId: "ent_1705123456789_abc123",
         companyName: "Acme Corporation",
         contactEmail: "john.doe@acme.com",
         contactName: "John Doe",
         numberOfEmployees: 50,
         plan: "enterprise",
         accountStatus: "active",
         
         // Paystack Subscription Fields
         subscriptionCode: "SUB_xyz789",
         subscriptionStatus: "active",
         planCode: "PLN_abc123xyz789",
         customerCode: "CUS_abc123",
         
         // Dates (from Paystack)
         subscriptionStartDate: Timestamp.fromDate(new Date("2024-01-15T12:05:00Z")),
         subscriptionEndDate: Timestamp.fromDate(new Date("2025-01-15T12:00:00Z")),
         nextBillingDate: Timestamp.fromDate(new Date("2025-01-15T12:00:00Z")),
         lastBillingDate: Timestamp.fromDate(new Date("2024-01-15T12:05:00Z")),
         
         quoteId: "quote_1705123456789_abc123",
         activatedAt: Timestamp.now(),
         createdAt: Timestamp.now(),
         updatedAt: Timestamp.now()
       }
       
       batch.set(accountRef, accountData);
       batch.update(quoteRef, {
         quoteStatus: "paid",
         paidAt: Timestamp.now()
       });
       
       await batch.commit(); // Atomic - both succeed or both fail
       break; // Success
       
     } catch (error) {
       console.error(`Attempt ${attempt}/3 failed:`, error.message);
       
       // Log error
       await db.collection('error_logs').add({
         type: 'account_creation_failure',
         error: error.message,
         accountData: accountData,
         attempt,
         maxRetries: 3,
         timestamp: admin.firestore.FieldValue.serverTimestamp()
       });
       
       if (attempt === 3) {
         throw new Error(`Failed after 3 attempts: ${error.message}`);
       }
       
       // Exponential backoff
       await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
     }
   }
   ```

10. **Log Subscription Event:**
    ```javascript
    await logSubscriptionEvent(enterpriseId, 'subscription_created', {
      subscriptionCode: 'SUB_xyz789',
      planCode: 'PLN_abc123xyz789',
      amount: 60000,
      currency: 'ZAR'
    });
    ```

**Result:** Enterprise account is active, regardless of which process (callback or webhook) completes first

---

## **Step 6: User Checks Quote Status (Optional Polling)**

**Action:** External UI polls for payment status (if user stays on page)

**Frontend Request:**
```http
GET /api/enterprise/quote/quote_1705123456789_abc123
```

**Backend Processing:**
1. **Fetch Quote:**
   ```javascript
   quoteDoc = await db.collection('enterprise_quotes')
     .doc('quote_1705123456789_abc123')
     .get()
   
   quoteData = quoteDoc.data()
   ```

2. **Return Status:**
   ```json
   {
     "success": true,
     "quote": {
       "quoteId": "quote_1705123456789_abc123",
       "status": "paid",
       "calculatedPrice": 60000,
       "currency": "ZAR",
       "paymentStatus": "completed",
       "paidAt": "2024-01-15T12:05:00Z",
       "companyName": "Acme Corporation"
     }
   }
   ```

**UI State:** Shows "Payment Successful" message, updates UI

---

## **Step 7: Enterprise Account Activation Complete**

**Final State:**

**Database - enterprise_quotes:**
```javascript
{
  quoteId: "quote_1705123456789_abc123",
  quoteStatus: "paid",  // ✅
  paymentReference: "ent_quote_1705123456789_abc123_1705123456789_xyz789",
  planCode: "PLN_abc123xyz789",
  paidAt: Timestamp("2024-01-15T12:05:00Z"),
  // ... other fields
}
```

**Database - enterprise_accounts:**
```javascript
{
  enterpriseId: "ent_1705123456789_abc123",
  companyName: "Acme Corporation",
  contactEmail: "john.doe@acme.com",
  contactName: "John Doe",
  numberOfEmployees: 50,
  plan: "enterprise",
  accountStatus: "active",  // ✅
  
  // Paystack Subscription Fields
  subscriptionCode: "SUB_xyz789",
  subscriptionStatus: "active",
  planCode: "PLN_abc123xyz789",
  customerCode: "CUS_abc123",
  
  // Dates (from Paystack)
  subscriptionStartDate: Timestamp("2024-01-15T12:05:00Z"),
  subscriptionEndDate: Timestamp("2025-01-15T12:00:00Z"),
  nextBillingDate: Timestamp("2025-01-15T12:00:00Z"),
  lastBillingDate: Timestamp("2024-01-15T12:05:00Z"),
  
  quoteId: "quote_1705123456789_abc123",
  activatedAt: Timestamp("2024-01-15T12:05:00Z"),
  createdAt: Timestamp("2024-01-15T12:05:00Z")
}
```

**Result:**
- ✅ Payment verified and processed
- ✅ Enterprise account created and activated
- ✅ Subscription active (yearly recurring)
- ✅ Paystack will automatically renew on 2025-01-15
- ✅ Company can now use enterprise features

---

## **Step 8: Annual Renewal (Year 2+)**

**Scenario:** One year later, Paystack automatically renews subscription

**Paystack Actions (Automatic):**
1. **Paystack automatically charges** customer on subscriptionEndDate (2025-01-15)
2. **Payment succeeds** ✅
3. **Paystack sends webhook:**
   ```http
   POST https://api.xscard.co.za/api/enterprise/payment/webhook
   X-Paystack-Signature: sha512_hash_here
   
   {
     "event": "invoice.payment_succeeded",
     "data": {
       "subscription": {
         "subscription_code": "SUB_xyz789",
         "next_payment_date": "2026-01-15T12:00:00Z"
       },
       "amount": 60000,
       "currency": "ZAR",
       "paid_at": "2025-01-15T12:00:00Z"
     }
   }
   ```

**Backend Processing:**
1. **Verify webhook signature** ✅
2. **Acknowledge immediately** (200 response)
3. **Process asynchronously:**
   ```javascript
   // Find account by subscriptionCode
   accountSnapshot = await db.collection('enterprise_accounts')
     .where('subscriptionCode', '==', 'SUB_xyz789')
     .limit(1)
     .get()
   
   accountDoc = accountSnapshot.docs[0]
   account = accountDoc.data()
   
   // Check if already processed (idempotency)
   lastBillingDate = account.lastBillingDate?.toDate()
   webhookPaymentDate = new Date("2025-01-15T12:00:00Z")
   if (lastBillingDate && lastBillingDate.getTime() === webhookPaymentDate.getTime()) {
     console.log('✅ Payment already processed - skipping');
     return { alreadyProcessed: true };
   }
   
   // Update dates (+1 year)
   await accountDoc.ref.update({
     lastBillingDate: Timestamp.fromDate(new Date("2025-01-15T12:00:00Z")),
     nextBillingDate: Timestamp.fromDate(new Date("2026-01-15T12:00:00Z")),
     subscriptionEndDate: Timestamp.fromDate(new Date("2026-01-15T12:00:00Z")),
     subscriptionStatus: 'active',
     accountStatus: 'active',
     updatedAt: Timestamp.now()
   })
   
   // Log renewal
   await logSubscriptionEvent(account.enterpriseId, 'renewal_succeeded', {
     paymentDate: "2025-01-15T12:00:00Z",
     amount: 60000
   });
   ```

**Result:**
- ✅ Subscription renewed for another year
- ✅ Account stays active
- ✅ Next renewal: 2026-01-15

---

## **Step 9: Payment Failure Scenario (Renewal Fails)**

**Scenario:** Annual renewal payment fails

**Paystack Actions:**
1. **Paystack attempts to charge** on subscriptionEndDate (2025-01-15)
2. **Payment fails** (insufficient funds, card declined, etc.)
3. **Paystack sends webhook:**
   ```http
   POST https://api.xscard.co.za/api/enterprise/payment/webhook
   
   {
     "event": "invoice.payment_failed",
     "data": {
       "subscription": {
         "subscription_code": "SUB_xyz789"
       },
       "amount": 60000,
       "currency": "ZAR",
       "failed_at": "2025-01-15T12:00:00Z"
     }
   }
   ```

**Backend Processing:**
1. **Find account:**
   ```javascript
   accountSnapshot = await db.collection('enterprise_accounts')
     .where('subscriptionCode', '==', 'SUB_xyz789')
     .limit(1)
     .get()
   
   accountDoc = accountSnapshot.docs[0]
   ```

2. **Set Grace Period (WE TRACK THIS):**
   ```javascript
   const gracePeriodDays = 7; // Configurable
   
   await accountDoc.ref.update({
     subscriptionStatus: 'payment_failed', // Temporary
     paymentFailedAt: Timestamp.now(),
     gracePeriodEndDate: Timestamp.fromDate(
       new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)
     ),
     accountStatus: 'active' // Still active during grace period
   })
   ```

3. **Log Failure:**
   ```javascript
   await logSubscriptionEvent(account.enterpriseId, 'payment_failed', {
     subscriptionCode: 'SUB_xyz789',
     failureReason: 'insufficient_funds',
     gracePeriodEndDate: gracePeriodEndDate
   });
   ```

**Result:**
- ✅ Account still active (grace period)
- ✅ Paystack will retry automatically (we don't control this)
- ✅ If retry succeeds, we get `invoice.payment_succeeded` webhook
- ✅ If all retries fail, Paystack sends `subscription.disable` webhook

---

## **Step 10: Grace Period Expiration**

**Scenario:** Grace period expires, payment still failed

**Backend Processing (On-Demand Check):**
```javascript
// When enterprise accesses account or status endpoint is called
async function checkGracePeriodExpiration(enterpriseAccount) {
  const now = new Date();
  const gracePeriodEnd = enterpriseAccount.gracePeriodEndDate?.toDate();
  
  if (enterpriseAccount.subscriptionStatus === 'payment_failed' &&
      gracePeriodEnd && gracePeriodEnd < now) {
    // Grace period expired, suspend account
    await suspendEnterpriseAccount(enterpriseAccount.enterpriseId);
  }
}

async function suspendEnterpriseAccount(enterpriseId) {
  const accountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
  
  await accountDoc.ref.update({
    accountStatus: 'suspended',
    subscriptionStatus: 'expired',
    warningBanner: {
      show: true,
      message: 'Your subscription payment failed. Please update your payment method to reactivate your account.',
      severity: 'error',
      actionRequired: true,
      actionUrl: '/update-payment-method'
    },
    updatedAt: Timestamp.now()
  });
  
  // Log suspension
  await logSubscriptionEvent(enterpriseId, 'account_suspended', {
    reason: 'grace_period_expired'
  });
}
```

**Result:**
- ✅ Account suspended
- ✅ Enterprise features disabled
- ✅ Account accessible (can update payment method)
- ✅ Warning banner shown in UI

---

## **Step 11: Account Reactivation (Payment Succeeds on Retry)**

**Scenario:** Enterprise updates payment method, Paystack retry succeeds

**Paystack Actions:**
1. Enterprise updates payment method in Paystack dashboard
2. **Paystack retries payment** (automatic)
3. **Payment succeeds** ✅
4. **Paystack sends webhook:**
   ```http
   POST https://api.xscard.co.za/api/enterprise/payment/webhook
   
   {
     "event": "invoice.payment_succeeded",
     "data": {
       "subscription": {
         "subscription_code": "SUB_xyz789",
         "next_payment_date": "2026-01-15T12:00:00Z"
       },
       "amount": 60000,
       "paid_at": "2025-01-20T12:00:00Z"
     }
   }
   ```

**Backend Processing:**
1. **Find account:**
   ```javascript
   accountSnapshot = await db.collection('enterprise_accounts')
     .where('subscriptionCode', '==', 'SUB_xyz789')
     .limit(1)
     .get()
   
   accountDoc = accountSnapshot.docs[0]
   account = accountDoc.data()
   ```

2. **Check if Suspended (Reactivation Scenario):**
   ```javascript
   if (account.accountStatus === 'suspended') {
     console.log('🔄 Reactivating suspended account');
     
     await accountDoc.ref.update({
       accountStatus: 'active',
       subscriptionStatus: 'active',
       lastBillingDate: Timestamp.fromDate(new Date("2025-01-20T12:00:00Z")),
       nextBillingDate: Timestamp.fromDate(new Date("2026-01-15T12:00:00Z")),
       subscriptionEndDate: Timestamp.fromDate(new Date("2026-01-15T12:00:00Z")),
       reactivatedAt: Timestamp.now(),
       warningBanner: {
         show: false // Hide warning banner
       },
       // Clear grace period
       paymentFailedAt: admin.firestore.FieldValue.delete(),
       gracePeriodEndDate: admin.firestore.FieldValue.delete()
     });
     
     // Log reactivation
     await logSubscriptionEvent(account.enterpriseId, 'account_reactivated', {
       paymentDate: "2025-01-20T12:00:00Z",
       amount: 60000
     });
   } else {
     // Normal renewal - just update dates
     await accountDoc.ref.update({
       lastBillingDate: Timestamp.fromDate(new Date("2025-01-20T12:00:00Z")),
       nextBillingDate: Timestamp.fromDate(new Date("2026-01-15T12:00:00Z")),
       subscriptionEndDate: Timestamp.fromDate(new Date("2026-01-15T12:00:00Z"))
     });
   }
   ```

**Result:**
- ✅ Account reactivated
- ✅ Subscription active
- ✅ Warning banner hidden
- ✅ Next renewal: 2026-01-15

---

## 🔄 Error Scenarios

### **Scenario A: Quote Expired**
**User Action:** Tries to pay after 30 days

**Backend Check:**
```javascript
if (quoteData.expiresAt < now) {
  return res.status(400).json({
    success: false,
    error: "Quote expired",
    message: "This quote has expired. Please generate a new quote."
  })
}
```

**User Experience:** Error message, option to generate new quote

---

### **Scenario B: Payment Failed (Initial)**
**User Action:** Payment declined on Paystack

**Paystack Response:**
```json
{
  "status": false,
  "message": "Card declined"
}
```

**Backend Processing:**
- Quote status remains "accepted" (not changed to "paid")
- User can retry payment with same quote
- No enterprise account created

**User Experience:** Error message, option to retry payment

---

### **Scenario C: Duplicate Payment Prevention**
**Scenario:** User clicks payment button twice, or webhook arrives before callback

**Backend Check:**
```javascript
if (quoteData.quoteStatus === 'paid') {
  // Already processed
  return res.status(200).json({
    success: true,
    message: "Payment already processed",
    enterpriseId: existingEnterpriseId
  })
}
```

**Result:** Idempotent - no duplicate accounts created

---

### **Scenario D: Invalid Employee Count**
**User Input:** numberOfEmployees = -5

**Backend Validation:**
```javascript
if (numberOfEmployees < 1 || numberOfEmployees > 10000) {
  return res.status(400).json({
    success: false,
    error: "Invalid employee count",
    message: "Number of employees must be between 1 and 10,000"
  })
}
```

**User Experience:** Validation error, form shows error message

---

### **Scenario E: Plan Creation Failure**
**Scenario:** Paystack plan creation API fails

**Backend Processing:**
```javascript
// Retry with exponential backoff
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    planCode = await createPaystackPlan(numberOfEmployees, amount, currency);
    break; // Success
  } catch (error) {
    console.error(`Plan creation attempt ${attempt}/3 failed:`, error.message);
    
    // Log error
    await db.collection('error_logs').add({
      type: 'plan_creation_failure',
      error: error.message,
      attempt,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (attempt === 3) {
      return res.status(500).json({
        success: false,
        error: "Payment initialization failed",
        message: "Unable to initialize payment. Please try again later."
      });
    }
    
    // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}
```

**User Experience:** User-friendly error message, can retry

---

### **Scenario F: Database Write Failure**
**Scenario:** Account creation fails after payment succeeds

**Backend Processing:**
```javascript
// Retry logic with exponential backoff
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const batch = db.batch();
    // ... batch operations
    await batch.commit();
    break; // Success
  } catch (error) {
    console.error(`Attempt ${attempt}/3 failed:`, error.message);
    
    // Log error (CRITICAL)
    await db.collection('error_logs').add({
      type: 'account_creation_failure',
      error: error.message,
      accountData: accountData,
      attempt,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (attempt === 3) {
      // All retries failed - webhook will retry from Paystack
      throw new Error(`Failed after 3 attempts: ${error.message}`);
    }
    
    // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}
```

**Result:** 
- Error logged
- Retry attempted
- If all retries fail, Paystack webhook will retry

---

## 📊 Flow Diagram Summary

```
[External UI]
    │
    ├─> POST /api/enterprise/quote
    │   └─> [Backend] Calculate price, create quote
    │       └─> [Database] Save quote (status: "pending")
    │
    ├─> POST /api/enterprise/payment/initialize
    │   └─> [Backend] Find or create Paystack plan (check DB first)
    │       └─> [Paystack] Initialize subscription (with plan code)
    │           └─> [Database] Update quote (status: "accepted", planCode stored)
    │
    ├─> [Paystack Payment Page]
    │   └─> User completes payment
    │       └─> Paystack creates customer + subscription
    │
    ├─> [Paystack Redirect] → GET /api/enterprise/payment/callback
    │   └─> [Backend] Verify payment, get subscription details
    │       └─> [Database] Update quote (status: "paid")
    │           └─> [Database] Create enterprise account (atomic transaction, retry on failure)
    │
    └─> [Paystack Webhook] → POST /api/enterprise/payment/webhook
        └─> [Backend] Verify signature, fetch current state (handles out-of-order)
            └─> [Database] Update quote (status: "paid")
                └─> [Database] Create/update enterprise account (idempotent, atomic transaction)
    
[Annual Renewal - Automatic]
    │
    └─> [Paystack] Automatically charges on subscriptionEndDate
        └─> [Paystack Webhook] → invoice.payment_succeeded
            └─> [Backend] Update dates (+1 year), reactivate if suspended
                └─> [Database] Update account (idempotent)
```

---

## ✅ Key Points

1. **Single Variable:** Only `numberOfEmployees` determines price
2. **Subscription Flow:** Quote → Payment → Subscription Activation (yearly recurring)
3. **Dual Verification:** Both callback and webhook can activate account (idempotent)
4. **Error Handling:** Expired quotes, failed payments, validation errors, API failures all handled
5. **No Authentication:** External UI doesn't require user login
6. **Plan Reuse:** Plans stored in DB for fast lookup
7. **Atomic Transactions:** Batch writes ensure data consistency
8. **Retry Logic:** All critical operations have retry with exponential backoff
9. **Grace Periods:** WE track grace periods, suspend account when expired
10. **Reactivation:** Automatic reactivation when payment succeeds on retry
11. **Out-of-Order Webhooks:** Always fetch current state from Paystack before processing

---

**Ready for Review** 🎯
