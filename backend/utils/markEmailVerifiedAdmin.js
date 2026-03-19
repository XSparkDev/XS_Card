const { db, admin } = require('../firebase');

/**
 * Marks a user as email-verified in BOTH:
 * - Firebase Authentication
 * - Firestore `users/{uid}` document
 */
exports.markEmailVerifiedAdmin = async ({ email, uid }) => {
  if (!email && !uid) {
    throw new Error('Provide either `email` or `uid`.');
  }

  let targetUid = uid;

  // If email is provided, look up the Firebase UID.
  if (!targetUid) {
    const userRecord = await admin.auth().getUserByEmail(email);
    targetUid = userRecord.uid;
  }

  // Update Firebase Auth
  await admin.auth().updateUser(targetUid, { emailVerified: true });

  // Update Firestore
  const userRef = db.collection('users').doc(targetUid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error('User document not found in Firestore');
  }

  await userRef.set(
    {
      isEmailVerified: true,
      // Clear token so the app stops considering the user "pending verification"
      verificationToken: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );

  return { uid: targetUid, email };
};

