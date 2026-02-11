/**
 * Enterprise Collections Schema Documentation
 * 
 * Defines the structure and validation rules for enterprise-related Firestore collections.
 * This is documentation only - Firestore is schemaless, but this serves as a reference.
 */

// Get maximum employees from environment variable (default: 10000)
const MAX_EMPLOYEES = parseInt(process.env.ENTERPRISE_MAX_EMPLOYEES || '10000', 10);

/**
 * Collection: enterprise_quotes
 * 
 * Stores quote information for enterprise subscriptions.
 * 
 * Schema:
 * {
 *   quoteId: string,              // Unique quote ID (format: "quote_{timestamp}_{random}")
 *   companyName: string,          // Company name (1-200 chars)
 *   contactEmail: string,         // Contact email (valid email format, max 255 chars)
 *   contactName: string,          // Contact person name (1-100 chars)
 *   numberOfEmployees: number,    // Number of employees (1-{MAX_EMPLOYEES}, integer)
 *   calculatedPrice: number,      // Price in cents (kobo)
 *   currency: 'ZAR' | 'USD',     // Currency code
 *   billingAddress: {             // Billing address (required)
 *     street: string,
 *     building: string,           // Optional (e.g., "Building 2, Randjespark")
 *     city: string,
 *     province: string,           // Optional
 *     postalCode: string,
 *     country: string
 *   },
 *   vatNumber: string,            // Customer VAT number (optional)
 *   quoteStatus: 'pending' | 'accepted' | 'expired' | 'paid',
 *   paymentReference: string,     // Paystack payment reference (when payment initialized)
 *   paymentUrl: string,           // Paystack payment URL
 *   planCode: string,             // Paystack plan code (created dynamically)
 *   subscriptionType: 'yearly',   // Always "yearly"
 *   createdAt: Timestamp,         // Quote creation time
 *   expiresAt: Timestamp,         // Quote expiration (30 days from creation)
 *   paidAt: Timestamp,            // Payment completion time (null until paid)
 *   metadata: {                   // Additional metadata
 *     // Optional additional fields
 *   }
 * }
 * 
 * Indexes:
 * - quoteId (unique)
 * - paymentReference (for callback/webhook lookups)
 * - quoteStatus (for filtering)
 * - expiresAt (for cleanup queries)
 * - Composite: quoteStatus + expiresAt
 */
const ENTERPRISE_QUOTES_SCHEMA = {
  collection: 'enterprise_quotes',
  fields: {
    quoteId: { type: 'string', required: true, unique: true },
    companyName: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    contactEmail: { type: 'string', required: true, format: 'email', maxLength: 255 },
    contactName: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    numberOfEmployees: { type: 'number', required: true, min: 1, max: MAX_EMPLOYEES, integer: true },
    calculatedPrice: { type: 'number', required: true, min: 0 },
    currency: { type: 'string', required: true, enum: ['ZAR', 'USD'] },
    billingAddress: { type: 'object', required: true },
    vatNumber: { type: 'string', required: false },
    quoteStatus: { type: 'string', required: true, enum: ['pending', 'accepted', 'expired', 'paid'] },
    paymentReference: { type: 'string', required: false },
    paymentUrl: { type: 'string', required: false },
    planCode: { type: 'string', required: false },
    subscriptionType: { type: 'string', required: true, default: 'yearly' },
    createdAt: { type: 'timestamp', required: true },
    expiresAt: { type: 'timestamp', required: true },
    paidAt: { type: 'timestamp', required: false },
    metadata: { type: 'object', required: false }
  }
};

/**
 * Collection: enterprise_accounts
 * 
 * Stores enterprise account information after payment.
 * 
 * Schema:
 * {
 *   enterpriseId: string,         // Unique enterprise ID (format: "ent_{quoteId}")
 *   companyName: string,
 *   contactEmail: string,
 *   contactName: string,
 *   numberOfEmployees: number,
 *   plan: 'enterprise',
 *   accountStatus: 'active' | 'suspended' | 'cancelled',
 *   
 *   // Paystack Subscription Fields
 *   subscriptionCode: string,     // Paystack subscription code (e.g., "SUB_xyz789")
 *   subscriptionStatus: string,   // Paystack subscription status (active, cancelled, expired, payment_failed)
 *   planCode: string,            // Paystack plan code (e.g., "PLN_abc123")
 *   customerCode: string,        // Paystack customer code (e.g., "CUS_abc123")
 *   
 *   // Dates (synced from Paystack via webhooks)
 *   subscriptionStartDate: Timestamp,
 *   subscriptionEndDate: Timestamp,
 *   nextBillingDate: Timestamp,
 *   lastBillingDate: Timestamp,
 *   
 *   // Grace Period
 *   gracePeriodEndDate: Timestamp,
 *   paymentFailedAt: Timestamp,
 *   gracePeriodDays: number,     // Default: 7
 *   
 *   // Warning Banner
 *   warningBanner: {
 *     show: boolean,
 *     message: string,
 *     severity: 'error' | 'warning' | 'info',
 *     actionRequired: boolean,
 *     actionUrl: string
 *   },
 *   
 *   // Tracking
 *   quoteId: string,
 *   activatedAt: Timestamp,
 *   reactivatedAt: Timestamp,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 * 
 * Indexes:
 * - enterpriseId (unique)
 * - subscriptionCode (unique, for webhook lookups)
 * - customerCode (for Paystack customer lookups)
 * - accountStatus (for filtering)
 * - subscriptionStatus (for filtering)
 * - Composite: accountStatus + subscriptionStatus
 */
const ENTERPRISE_ACCOUNTS_SCHEMA = {
  collection: 'enterprise_accounts',
  fields: {
    enterpriseId: { type: 'string', required: true, unique: true },
    companyName: { type: 'string', required: true },
    contactEmail: { type: 'string', required: true },
    contactName: { type: 'string', required: true },
    numberOfEmployees: { type: 'number', required: true },
    plan: { type: 'string', required: true, default: 'enterprise' },
    accountStatus: { type: 'string', required: true, enum: ['active', 'suspended', 'cancelled'] },
    subscriptionCode: { type: 'string', required: false },
    subscriptionStatus: { type: 'string', required: false },
    planCode: { type: 'string', required: false },
    customerCode: { type: 'string', required: false },
    subscriptionStartDate: { type: 'timestamp', required: false },
    subscriptionEndDate: { type: 'timestamp', required: false },
    nextBillingDate: { type: 'timestamp', required: false },
    lastBillingDate: { type: 'timestamp', required: false },
    gracePeriodEndDate: { type: 'timestamp', required: false },
    paymentFailedAt: { type: 'timestamp', required: false },
    gracePeriodDays: { type: 'number', required: false, default: 7 },
    warningBanner: { type: 'object', required: false },
    quoteId: { type: 'string', required: true },
    activatedAt: { type: 'timestamp', required: false },
    reactivatedAt: { type: 'timestamp', required: false },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  }
};

/**
 * Collection: enterprise_plans
 * 
 * Stores Paystack plan codes for reuse (avoids creating duplicate plans).
 * 
 * Schema:
 * {
 *   planCode: string,            // Paystack plan code (e.g., "PLN_abc123")
 *   numberOfEmployees: number,  // Number of employees
 *   amount: number,               // Price in cents
 *   currency: 'ZAR' | 'USD',     // Currency code
 *   createdAt: Timestamp         // When plan was created
 * }
 * 
 * Indexes:
 * - planCode (unique)
 * - Composite: numberOfEmployees + amount + currency (for fast plan lookup)
 */
const ENTERPRISE_PLANS_SCHEMA = {
  collection: 'enterprise_plans',
  fields: {
    planCode: { type: 'string', required: true, unique: true },
    numberOfEmployees: { type: 'number', required: true },
    amount: { type: 'number', required: true },
    currency: { type: 'string', required: true, enum: ['ZAR', 'USD'] },
    createdAt: { type: 'timestamp', required: true }
  }
};

/**
 * Collection: error_logs
 * 
 * Stores error logs for debugging and monitoring.
 * 
 * Schema:
 * {
 *   type: string,                // Error type (e.g., 'account_creation_failure')
 *   error: string,               // Error message
 *   context: object,             // Additional context data
 *   attempt: number,             // Retry attempt number (if applicable)
 *   maxRetries: number,          // Maximum retries (if applicable)
 *   stack: string,               // Stack trace (if available)
 *   metadata: object,            // Additional metadata
 *   timestamp: Timestamp,        // Server timestamp
 *   createdAt: string            // ISO timestamp string
 * }
 * 
 * Indexes:
 * - type (for filtering by error type)
 * - timestamp (for time-based queries)
 * - Composite: type + timestamp
 */
const ERROR_LOGS_SCHEMA = {
  collection: 'error_logs',
  fields: {
    type: { type: 'string', required: true },
    error: { type: 'string', required: true },
    context: { type: 'object', required: false },
    attempt: { type: 'number', required: false },
    maxRetries: { type: 'number', required: false },
    stack: { type: 'string', required: false },
    metadata: { type: 'object', required: false },
    timestamp: { type: 'timestamp', required: true },
    createdAt: { type: 'string', required: true }
  }
};

/**
 * Collection: enterprise_invoices
 * 
 * Stores invoices and receipts for enterprise subscriptions.
 * Uses single collection with isReceipt flag to distinguish invoices from receipts.
 * 
 * Schema:
 * {
 *   invoiceId: string,            // Unique invoice ID (format: "inv_{timestamp}_{random}")
 *   invoiceNumber: string,         // Sequential invoice number (e.g., "INV-2025-001")
 *   receiptNumber: string,         // Receipt number (e.g., "RCP-2736-3055") - only when paid
 *   quoteId: string,               // Reference to original quote (if converted from quote)
 *   enterpriseId: string,          // Reference to enterprise account (if applicable)
 *   
 *   // Company Info (XSCard) - fetched from env vars
 *   companyInfo: {
 *     name: string,
 *     address: { street, city, province, postalCode, country },
 *     phone: string,
 *     email: string,
 *     vatNumber: string (optional)
 *   },
 *   
 *   // Bill To (Customer) - reused from quote
 *   billTo: {
 *     companyName: string,
 *     contactName: string,
 *     contactEmail: string,
 *     address: { street, building, city, province, postalCode, country },
 *     vatNumber: string (optional)
 *   },
 *   
 *   // Line Items
 *   lineItems: [{
 *     description: string,
 *     quantity: number,
 *     unitPrice: number,          // in cents
 *     amount: number               // in cents
 *   }],
 *   
 *   // Pricing
 *   subtotal: number,             // in cents
 *   tax: number,                   // in cents (0 if no tax)
 *   total: number,                 // in cents
 *   amountPaid: number,            // in cents
 *   currency: 'ZAR' | 'USD',
 *   
 *   // Dates
 *   invoiceDate: Timestamp,
 *   dueDate: Timestamp,            // null for receipts
 *   datePaid: Timestamp,           // null for invoices
 *   
 *   // Payment
 *   paymentReference: string,      // Paystack payment reference
 *   paymentMethod: string,          // "Visa - 4043" (optional, fetched when paid)
 *   
 *   // Status
 *   invoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
 *   isReceipt: boolean,            // true if receipt, false if invoice
 *   
 *   // Metadata
 *   metadata: {
 *     subscriptionType: string,
 *     numberOfEmployees: number
 *   },
 *   
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 * 
 * Indexes:
 * - invoiceId (unique)
 * - invoiceNumber (unique)
 * - receiptNumber (unique, when present)
 * - quoteId (for quote lookups)
 * - enterpriseId (for enterprise lookups)
 * - invoiceStatus (for filtering)
 * - isReceipt (for filtering)
 * - Composite: enterpriseId + invoiceStatus
 */
const ENTERPRISE_INVOICES_SCHEMA = {
  collection: 'enterprise_invoices',
  fields: {
    invoiceId: { type: 'string', required: true, unique: true },
    invoiceNumber: { type: 'string', required: true, unique: true },
    receiptNumber: { type: 'string', required: false, unique: true },
    quoteId: { type: 'string', required: false },
    enterpriseId: { type: 'string', required: false },
    companyInfo: { type: 'object', required: true },
    billTo: { type: 'object', required: true },
    lineItems: { type: 'array', required: true },
    subtotal: { type: 'number', required: true, min: 0 },
    tax: { type: 'number', required: true, min: 0 },
    total: { type: 'number', required: true, min: 0 },
    amountPaid: { type: 'number', required: true, min: 0 },
    currency: { type: 'string', required: true, enum: ['ZAR', 'USD'] },
    invoiceDate: { type: 'timestamp', required: true },
    dueDate: { type: 'timestamp', required: false },
    datePaid: { type: 'timestamp', required: false },
    paymentReference: { type: 'string', required: false },
    paymentMethod: { type: 'string', required: false },
    invoiceStatus: { type: 'string', required: true, enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
    isReceipt: { type: 'boolean', required: true },
    metadata: { type: 'object', required: false },
    createdAt: { type: 'timestamp', required: true },
    updatedAt: { type: 'timestamp', required: true }
  }
};

/**
 * Initialize enterprise collections (create if they don't exist)
 * 
 * Note: Firestore collections are created automatically on first write.
 * This function verifies collections are accessible.
 * 
 * @returns {Promise<boolean>} - Success status
 */
async function initializeEnterpriseCollections() {
  try {
    const { db } = require('../firebase');
    
    const collections = [
      'enterprise_quotes',
      'enterprise_accounts',
      'enterprise_plans',
      'enterprise_invoices',
      'error_logs'
    ];

    console.log('Initializing enterprise collections...');

    for (const collectionName of collections) {
      try {
        // Verify collection is accessible by attempting a limit query
        const collection = db.collection(collectionName);
        
        // Check if we're in mock mode (limited API)
        if (typeof collection.limit === 'function') {
          const snapshot = await collection.limit(1).get();
          console.log(`✓ ${collectionName} collection accessible`);
        } else {
          // Mock mode - just verify collection object exists
          console.log(`✓ ${collectionName} collection structure verified (mock mode)`);
        }
      } catch (error) {
        // In mock mode, this is expected
        if (error.message && error.message.includes('limit is not a function')) {
          console.log(`✓ ${collectionName} collection structure verified (mock mode)`);
        } else {
          throw error;
        }
      }
    }

    console.log('Enterprise collections initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing enterprise collections:', error);
    // In mock mode, this is acceptable for Phase 0
    // We just need to verify the structure is correct
    return false;
  }
}

module.exports = {
  ENTERPRISE_QUOTES_SCHEMA,
  ENTERPRISE_ACCOUNTS_SCHEMA,
  ENTERPRISE_PLANS_SCHEMA,
  ENTERPRISE_INVOICES_SCHEMA,
  ERROR_LOGS_SCHEMA,
  initializeEnterpriseCollections
};

