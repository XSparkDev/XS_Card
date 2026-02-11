/**
 * Invoice & Receipt Number Utilities
 *
 * Phase 1 implementation:
 * - getNextInvoiceSequence(year)
 * - generateInvoiceNumber()
 * - generateReceiptNumber()
 *
 * These helpers are used when creating invoices and receipts in the
 * enterprise_invoices collection.
 */

const { db, admin } = require('../firebase');

/**
 * Get the next invoice sequence for a given year using a Firestore transaction.
 *
 * Collection: invoice_counters
 * Document ID: <year> (e.g. "2026")
 * Fields:
 *   - sequence: number
 *   - updatedAt: Timestamp
 *
 * @param {number} year - Four digit year (e.g. 2026)
 * @returns {Promise<number>} - The next sequence number for that year
 */
async function getNextInvoiceSequence(year) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firestore is not initialized');
  }

  if (!year || typeof year !== 'number') {
    throw new Error('Valid year is required to generate invoice sequence');
  }

  const yearKey = String(year);
  const counterRef = db.collection('invoice_counters').doc(yearKey);

  const nextSequence = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(counterRef);

    let sequence = 1;
    if (snapshot.exists) {
      const data = snapshot.data() || {};
      const current = typeof data.sequence === 'number' ? data.sequence : 0;
      sequence = current + 1;
    }

    tx.set(
      counterRef,
      {
        sequence,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return sequence;
  });

  return nextSequence;
}

/**
 * Generate a new invoice number.
 *
 * Format: INV-YYYY-NNNN
 * Example: INV-2026-0001
 *
 * @returns {Promise<string>} - The generated invoice number
 */
async function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();

  const sequence = await getNextInvoiceSequence(year);
  const padded = String(sequence).padStart(4, '0');

  return `INV-${year}-${padded}`;
}

/**
 * Generate a receipt number.
 *
 * Requirements are light – it just needs to be unique enough for lookups.
 * We deliberately avoid tying it to the invoice sequence format so that
 * we can change display semantics later without affecting storage.
 *
 * Format (initial):
 *   RCP-<timestamp>-<RANDOM>
 *
 * Example:
 *   RCP-1739123456789-ABCD
 *
 * @returns {string} - The generated receipt number
 */
function generateReceiptNumber() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCP-${timestamp}-${random}`;
}

module.exports = {
  getNextInvoiceSequence,
  generateInvoiceNumber,
  generateReceiptNumber
};

