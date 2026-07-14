/**
 * Follow-Up Service
 *
 * Creates and manages the three-day (Day 1 / 6 / 9) lead-nurturing email
 * campaigns that fire after a QR-card scan produces a new contact.
 *
 * Campaign status values:
 *   active      — emails are still scheduled
 *   contacted   — owner marked the lead as contacted; all pending emails cancelled
 *   completed   — all nine emails sent (or skipped for missing address)
 *   cancelled   — contact was deleted; all pending emails cancelled
 *
 * Scheduled-email status values per slot:
 *   pending   — not yet sent
 *   sent      — delivered successfully
 *   skipped   — no email address available for this recipient
 *   cancelled — campaign was cancelled before this slot fired
 *   failed    — send attempt failed (will not be retried automatically)
 */

const { db, admin } = require('../firebase.js');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const templates = require('../templates/followUpEmails');

const COLLECTION = 'followUpCampaigns';

// Days (in ms) after which each slot should fire
const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_DAYS = [1, 6, 9];
const RECIPIENTS = ['owner', 'scanner'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build the six initial scheduled-email slot descriptors. */
const buildScheduledEmails = (createdAt) =>
  SCHEDULE_DAYS.flatMap((day) =>
    RECIPIENTS.map((recipient) => ({
      key: `day${day}_${recipient}`,
      day,
      recipient,
      scheduledFor: new Date(createdAt.getTime() + day * DAY_MS),
      status: 'pending',
      sentAt: null,
    }))
  );

/** Return the template function for a given slot. */
const getTemplate = (day, recipient) => {
  const map = {
    'day1_owner': templates.day1Owner,
    'day1_scanner': templates.day1Scanner,
    'day6_owner': templates.day6Owner,
    'day6_scanner': templates.day6Scanner,
    'day9_owner': templates.day9Owner,
    'day9_scanner': templates.day9Scanner,
  };
  return map[`day${day}_${recipient}`] || null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a follow-up campaign immediately after a new contact is saved.
 *
 * @param {string} ownerId          - UUID of the XS Card holder
 * @param {object} ownerData        - { name, surname, email, phone, company, occupation }
 * @param {object} scannerData      - { name, surname, email, phone, company, occupation }
 * @param {string} contactId        - UUID assigned to the contact entry
 * @returns {Promise<string>}       - Firestore campaign document ID
 */
const createCampaign = async (ownerId, ownerData, scannerData, contactId) => {
  const now = new Date();

  const scheduledEmails = buildScheduledEmails(now);

  // If scanner has no email address, mark scanner slots as skipped up front
  // so the job never tries to send to an empty address.
  if (!scannerData.email) {
    scheduledEmails.forEach((slot) => {
      if (slot.recipient === 'scanner') slot.status = 'skipped';
    });
  }

  const campaign = {
    ownerId,
    contactId,
    ownerEmail: ownerData.email || '',
    ownerName: [ownerData.name, ownerData.surname].filter(Boolean).join(' '),
    ownerPhone: ownerData.phone || '',
    ownerCompany: ownerData.company || '',
    ownerOccupation: ownerData.occupation || '',
    scannerEmail: scannerData.email || '',
    scannerName: scannerData.name || '',
    scannerSurname: scannerData.surname || '',
    scannerPhone: scannerData.phone || '',
    scannerCompany: scannerData.company || '',
    scannerOccupation: scannerData.occupation || '',
    status: 'active',
    createdAt: admin.firestore.Timestamp.fromDate(now),
    scheduledEmails: scheduledEmails.map((s) => ({
      ...s,
      scheduledFor: admin.firestore.Timestamp.fromDate(s.scheduledFor),
    })),
    cancellationReason: null,
    cancelledAt: null,
  };

  const ref = await db.collection(COLLECTION).add(campaign);
  console.log(`[FollowUp] Campaign ${ref.id} created for owner ${ownerId}, contact ${contactId}`);
  return ref.id;
};

/**
 * Cancel all pending email slots in a campaign.
 *
 * @param {string} campaignId
 * @param {'contacted'|'cancelled'} reason
 */
const cancelCampaign = async (campaignId, reason = 'cancelled') => {
  const ref = db.collection(COLLECTION).doc(campaignId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const data = doc.data();
  const updatedEmails = (data.scheduledEmails || []).map((slot) =>
    slot.status === 'pending' ? { ...slot, status: 'cancelled' } : slot
  );

  await ref.update({
    status: reason,
    scheduledEmails: updatedEmails,
    cancellationReason: reason,
    cancelledAt: admin.firestore.Timestamp.now(),
  });

  console.log(`[FollowUp] Campaign ${campaignId} cancelled — reason: ${reason}`);
};

/**
 * Find the active campaign for a specific (ownerId, contactId) pair and cancel it.
 * Used when a contact is deleted or marked as contacted.
 */
const cancelCampaignByContact = async (ownerId, contactId, reason = 'cancelled') => {
  const snapshot = await db
    .collection(COLLECTION)
    .where('ownerId', '==', ownerId)
    .where('contactId', '==', contactId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const campaignId = snapshot.docs[0].id;
  await cancelCampaign(campaignId, reason);
  return campaignId;
};

/**
 * Mark an active campaign as 'contacted' (owner has followed up manually).
 */
const markAsContacted = async (ownerId, contactId) =>
  cancelCampaignByContact(ownerId, contactId, 'contacted');

/**
 * Poll Firestore for pending email slots whose scheduledFor time has passed,
 * send them, and update their status. Called by the follow-up email job.
 *
 * Returns the number of emails processed (sent + failed).
 */
const processFollowUpEmails = async () => {
  const now = admin.firestore.Timestamp.now();
  let processed = 0;

  // Fetch all active campaigns — Firestore array-contains queries on nested
  // fields aren't supported for compound inequality, so we filter in-process.
  const snapshot = await db
    .collection(COLLECTION)
    .where('status', '==', 'active')
    .get();

  if (snapshot.empty) return 0;

  await Promise.all(
    snapshot.docs.map(async (campaignDoc) => {
      const data = campaignDoc.data();
      const updatedSlots = [...data.scheduledEmails];
      let anyChange = false;

      for (let i = 0; i < updatedSlots.length; i++) {
        const slot = updatedSlots[i];

        if (slot.status !== 'pending') continue;

        // scheduledFor is stored as a Firestore Timestamp
        const scheduledTs =
          slot.scheduledFor instanceof admin.firestore.Timestamp
            ? slot.scheduledFor
            : admin.firestore.Timestamp.fromDate(new Date(slot.scheduledFor));

        if (scheduledTs.toMillis() > now.toMillis()) continue; // not yet due

        const tmplFn = getTemplate(slot.day, slot.recipient);
        if (!tmplFn) {
          updatedSlots[i] = { ...slot, status: 'failed', sentAt: now };
          anyChange = true;
          continue;
        }

        const recipientEmail =
          slot.recipient === 'owner' ? data.ownerEmail : data.scannerEmail;

        if (!recipientEmail) {
          updatedSlots[i] = { ...slot, status: 'skipped', sentAt: now };
          anyChange = true;
          continue;
        }

        // Build template payload
        const ownerData = {
          name: data.ownerName,
          email: data.ownerEmail,
          phone: data.ownerPhone,
          company: data.ownerCompany,
          occupation: data.ownerOccupation,
        };
        const scannerData = {
          name: data.scannerName,
          surname: data.scannerSurname,
          email: data.scannerEmail,
          phone: data.scannerPhone,
          company: data.scannerCompany,
          occupation: data.scannerOccupation,
        };

        const { subject, html } = tmplFn({
          ownerName: data.ownerName,
          scanner: scannerData,
          ownerData,
        });

        const result = await sendMailWithStatus({
          from: process.env.EMAIL_USER,
          to: recipientEmail,
          subject,
          html,
        });

        const sentAt = admin.firestore.Timestamp.now();
        if (result.success) {
          updatedSlots[i] = { ...slot, status: 'sent', sentAt };
          console.log(`[FollowUp] Day ${slot.day} ${slot.recipient} email sent — campaign ${campaignDoc.id}`);
        } else {
          updatedSlots[i] = { ...slot, status: 'failed', sentAt };
          console.error(`[FollowUp] Day ${slot.day} ${slot.recipient} email FAILED — campaign ${campaignDoc.id}:`, result.error);
        }

        anyChange = true;
        processed++;
      }

      if (!anyChange) return;

      // Check if all slots are now terminal (sent/skipped/cancelled/failed)
      const allDone = updatedSlots.every((s) => s.status !== 'pending');
      const updates = { scheduledEmails: updatedSlots };
      if (allDone) updates.status = 'completed';

      await campaignDoc.ref.update(updates);
    })
  );

  return processed;
};

module.exports = {
  createCampaign,
  cancelCampaign,
  cancelCampaignByContact,
  markAsContacted,
  processFollowUpEmails,
};
