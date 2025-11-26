const DEFAULT_COUNTRY_CODE = '+27';
const PHONE_ERROR_CODE = 'PHONE_ALREADY_IN_USE';
const PHONE_CHECK_WARN_THRESHOLD_MS = 5000;

const sanitizeCountryCode = (countryCode = DEFAULT_COUNTRY_CODE) => {
  if (!countryCode) {
    return DEFAULT_COUNTRY_CODE;
  }

  let cleaned = countryCode.toString().trim();
  cleaned = cleaned.replace(/[^\d+]/g, '');

  if (!cleaned.startsWith('+')) {
    cleaned = `+${cleaned.replace(/\D/g, '')}`;
  }

  return cleaned || DEFAULT_COUNTRY_CODE;
};

const normalizePhone = (phone, countryCode = DEFAULT_COUNTRY_CODE) => {
  if (!phone) {
    return '';
  }

  const sanitizedCode = sanitizeCountryCode(countryCode);
  let cleaned = phone.toString().trim();

  // Replace common international prefix formats
  cleaned = cleaned.replace(/^\s*00/, '+');

  // Remove all characters except digits and +
  cleaned = cleaned.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    const digits = cleaned.substring(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  // Remove leading zeros and re-apply selected country code
  const digitsOnly = cleaned.replace(/\D/g, '').replace(/^0+/, '');
  return digitsOnly ? `${sanitizedCode}${digitsOnly}` : '';
};

const arePhonesEqual = (phoneA, phoneB) => {
  if (!phoneA || !phoneB) {
    return false;
  }

  return normalizePhone(phoneA) === normalizePhone(phoneB);
};

const findConflictingPhoneOwner = async (db, normalizedPhone) => {
  if (!normalizedPhone) {
    return null;
  }

  const usersRef = db.collection('users');

  // Primary query uses normalized field for all new data
  const normalizedSnapshot = await usersRef
    .where('phoneNormalized', '==', normalizedPhone)
    .limit(1)
    .get();

  if (!normalizedSnapshot.empty) {
    return normalizedSnapshot.docs[0];
  }

  // Fallback query for legacy values stored without normalization
  const legacySnapshot = await usersRef
    .where('phone', '==', normalizedPhone)
    .limit(1)
    .get();

  if (!legacySnapshot.empty) {
    return legacySnapshot.docs[0];
  }

  return null;
};

const ensurePhoneAvailable = async (db, normalizedPhone, currentUserId) => {
  if (!normalizedPhone) {
    return null;
  }

  const start = Date.now();
  const conflictingDoc = await findConflictingPhoneOwner(db, normalizedPhone);
  const duration = Date.now() - start;

  console.log(`[PhoneCheck] Lookup for ${normalizedPhone} completed in ${duration}ms`);
  if (duration > PHONE_CHECK_WARN_THRESHOLD_MS) {
    console.warn(
      `[PhoneCheck] WARNING: Phone lookup exceeded ${PHONE_CHECK_WARN_THRESHOLD_MS}ms (took ${duration}ms)`
    );
  }

  if (conflictingDoc && conflictingDoc.id !== currentUserId) {
    const error = new Error('Phone number is already linked to another XSCard account');
    error.code = PHONE_ERROR_CODE;
    error.status = 409;
    error.conflictUserId = conflictingDoc.id;
    throw error;
  }

  return null;
};

module.exports = {
  normalizePhone,
  arePhonesEqual,
  ensurePhoneAvailable,
  PHONE_ERROR_CODE,
  DEFAULT_COUNTRY_CODE,
};

