/**
 * Enterprise Account Creation Retry Configuration
 *
 * Handles retry configuration for enterprise account and document creation.
 * Reads from environment variables with sensible defaults.
 *
 * NOTE:
 * - MIN_RETRIES: Minimum number of retry attempts before considering manual intervention
 * - MAX_RETRIES: Maximum total retry attempts before failing
 * - Retry logic uses exponential backoff between attempts
 */

// Get minimum retries from environment variable (default: 5)
const MIN_RETRIES = parseInt(process.env.ENTERPRISE_ACCOUNT_CREATION_MIN_RETRIES || '5', 10);

// Get maximum retries from environment variable (default: 7)
const MAX_RETRIES = parseInt(process.env.ENTERPRISE_ACCOUNT_CREATION_MAX_RETRIES || '7', 10);

// Validate retry values
if (MIN_RETRIES < 1 || !Number.isInteger(MIN_RETRIES)) {
  throw new Error(`ENTERPRISE_ACCOUNT_CREATION_MIN_RETRIES must be a positive integer. Got: ${MIN_RETRIES}`);
}

if (MAX_RETRIES < 1 || !Number.isInteger(MAX_RETRIES)) {
  throw new Error(`ENTERPRISE_ACCOUNT_CREATION_MAX_RETRIES must be a positive integer. Got: ${MAX_RETRIES}`);
}

if (MIN_RETRIES > MAX_RETRIES) {
  throw new Error(`ENTERPRISE_ACCOUNT_CREATION_MIN_RETRIES (${MIN_RETRIES}) cannot be greater than MAX_RETRIES (${MAX_RETRIES})`);
}

module.exports = {
  MIN_RETRIES,
  MAX_RETRIES
};
