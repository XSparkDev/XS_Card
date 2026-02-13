/**
 * Shared helper: build and optionally write default card for a user.
 * Reused by normal profile card creation and by addEmployee (Group 2) so card shape stays consistent.
 *
 * @param {object} params
 * @param {object} params.db - Firestore db
 * @param {object} params.admin - Firebase admin (for Timestamp)
 * @param {string} params.userId - User document ID (cards doc id = userId)
 * @param {string} [params.name] - First name
 * @param {string} [params.surname] - Last name
 * @param {string} [params.email] - Email
 * @param {string} [params.phone] - Phone
 * @param {string} [params.occupation] - Occupation / position
 * @param {string} [params.company] - Company name
 * @param {string} [params.profileImage] - Profile image URL
 * @param {string} [params.companyLogo] - Company logo URL
 * @param {string} [params.colorScheme] - Hex color (default '#1B2B5B')
 * @param {boolean} [params.writeToFirestore=true] - If true, write to cards collection
 * @returns {Promise<object>} - Card data written (cards: [{ ... }])
 */
async function createDefaultCardForUser(params) {
  const {
    db,
    admin: adminModule,
    userId,
    name = '',
    surname = '',
    email = '',
    phone = '',
    occupation = '',
    company = '',
    profileImage = null,
    companyLogo = null,
    colorScheme = '#1B2B5B',
    writeToFirestore = true
  } = params;

  const cardData = {
    cards: [{
      name,
      surname,
      email,
      phone: phone ?? '',
      occupation: occupation ?? '',
      company: company ?? '',
      profileImage: profileImage ?? null,
      companyLogo: companyLogo ?? null,
      socials: {},
      colorScheme: colorScheme || '#1B2B5B',
      createdAt: adminModule.firestore.Timestamp.now(),
      template: 1
    }]
  };

  if (writeToFirestore && db && userId) {
    await db.collection('cards').doc(userId).set(cardData);
  }

  return cardData;
}

module.exports = {
  createDefaultCardForUser
};
