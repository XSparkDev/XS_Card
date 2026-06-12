const { db, admin } = require('../firebase.js');

// Free users are limited to this many card scans within a rolling 1-hour window.
const FREE_USER_SCANS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Append a scan record to users/{userId}/scans. Uses a server timestamp so the
 * rolling-window calculation is immune to client/device clock skew.
 *
 * Stored in a subcollection (not an array) so the log can grow unbounded without
 * hitting the 1MB document limit and so it can be queried efficiently by time.
 */
const recordScan = async (userId) => {
  if (!userId) return;
  await db
    .collection('users')
    .doc(userId)
    .collection('scans')
    .add({
      scannedAt: admin.firestore.FieldValue.serverTimestamp(),
      scannerIp: null,
    });
};

/**
 * Compute the current rolling-hour scan status for a user.
 *
 * The window is calculated at read time (never stored). Premium users are never
 * limited. Returns a plain object safe to send straight to clients:
 *   { isFreeUser, scanCountThisHour, limit, isLimitExceeded, resetTime|null }
 *
 * resetTime is when the OLDEST scan in the current window ages out (freeing a
 * slot) — i.e. oldestScanInWindow + 1 hour, as an ISO string.
 */
const getScanStatus = async (userId) => {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const isFreeUser = userDoc.data().plan === 'free';

  // Premium users are never rate-limited — short-circuit without querying scans.
  if (!isFreeUser) {
    return {
      isFreeUser: false,
      scanCountThisHour: 0,
      limit: FREE_USER_SCANS_PER_HOUR,
      isLimitExceeded: false,
      resetTime: null,
    };
  }

  const oneHourAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - ONE_HOUR_MS));

  const snapshot = await db
    .collection('users')
    .doc(userId)
    .collection('scans')
    .where('scannedAt', '>=', oneHourAgo)
    .orderBy('scannedAt', 'desc')
    .get();

  const scanCountThisHour = snapshot.size;
  const isLimitExceeded = scanCountThisHour >= FREE_USER_SCANS_PER_HOUR;

  // Oldest scan in the window is the last doc (ordered desc).
  let resetTime = null;
  if (snapshot.size > 0) {
    const oldest = snapshot.docs[snapshot.docs.length - 1].data().scannedAt;
    if (oldest && typeof oldest.toDate === 'function') {
      const reset = new Date(oldest.toDate().getTime() + ONE_HOUR_MS);
      // If the reset moment is already in the past, treat as reset (no limit).
      resetTime = reset.getTime() > Date.now() ? reset.toISOString() : null;
    }
  }

  return {
    isFreeUser: true,
    scanCountThisHour,
    limit: FREE_USER_SCANS_PER_HOUR,
    isLimitExceeded,
    resetTime,
  };
};

/**
 * Record a scan (page load) and return the freshly-updated rolling-hour status
 * in a single round trip. The scan write is awaited BEFORE the status is read,
 * so the returned count/limit includes the scan that just happened — i.e. the
 * 5th scan of the hour will already report isLimitExceeded:true.
 *
 * Only free users are rate-limited, so only their scans are logged. Premium
 * owners get a no-op write and an always-unlimited status.
 */
const recordScanAndGetStatus = async (userId) => {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const isFreeUser = userDoc.data().plan === 'free';
  if (isFreeUser) {
    // Awaited so the status query below includes this scan.
    await recordScan(userId);
  }

  return getScanStatus(userId);
};

module.exports = {
  FREE_USER_SCANS_PER_HOUR,
  recordScan,
  getScanStatus,
  recordScanAndGetStatus,
};
