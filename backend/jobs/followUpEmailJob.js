/**
 * Follow-Up Email Job
 *
 * Polls Firestore every 30 minutes for pending follow-up email slots whose
 * scheduled send time has passed, then delegates to followUpService to send
 * them and update their status.
 *
 * Uses the same setInterval pattern as the other jobs in this directory so
 * no additional scheduling library is required.
 */

const { processFollowUpEmails } = require('../services/followUpService');

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let intervalHandle = null;

const runOnce = async () => {
  try {
    console.log('[FollowUpEmailJob] Running follow-up email check…');
    const count = await processFollowUpEmails();
    console.log(`[FollowUpEmailJob] Done — ${count} email(s) processed.`);
  } catch (err) {
    console.error('[FollowUpEmailJob] Error during processing:', err);
  }
};

const startFollowUpEmailJob = () => {
  if (intervalHandle) return; // already running

  console.log('[FollowUpEmailJob] Starting — polling every 30 minutes.');

  // Fire immediately on start so missed sends after a restart are caught quickly
  runOnce();

  intervalHandle = setInterval(runOnce, POLL_INTERVAL_MS);
};

const stopFollowUpEmailJob = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[FollowUpEmailJob] Stopped.');
  }
};

module.exports = { startFollowUpEmailJob, stopFollowUpEmailJob };
