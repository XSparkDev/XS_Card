const { db, admin } = require('../firebase.js');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const { checkUserExistsByEmail } = require('../utils/userDetection');
const { linkContactToXsCardUser } = require('../utils/contactLinking');

const FREE_PLAN_CONTACT_LIMIT = 20;

const normalizeCardIndex = (cardIndex) => {
  const parsedCardIndex = Number.parseInt(cardIndex, 10);
  return Number.isInteger(parsedCardIndex) && parsedCardIndex >= 0 ? parsedCardIndex : 0;
};

const serializeContactList = (contactList) =>
  contactList.map((contact) => ({
    ...contact,
    createdAt: contact.createdAt ? contact.createdAt.toDate().toISOString() : new Date().toISOString(),
  }));

const addPublicContact = async ({ userId, contactInfo, cardIndex }) => {
  if (!userId || !contactInfo) {
    const error = new Error('User ID and contact info are required');
    error.status = 400;
    throw error;
  }

  if (!contactInfo.email || !String(contactInfo.email).trim()) {
    const error = new Error('Email is required for contact saving');
    error.status = 400;
    throw error;
  }

  const normalizedCardIndex = normalizeCardIndex(cardIndex);
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  if (!userData) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const contactRef = db.collection('contacts').doc(userId);
  const doc = await contactRef.get();

  let currentContacts = [];
  if (doc.exists) {
    currentContacts = doc.data().contactList || [];
  }

  if (userData.plan === 'free' && currentContacts.length >= FREE_PLAN_CONTACT_LIMIT) {
    const error = new Error('Contact limit reached');
    error.status = 403;
    error.code = 'FREE_PLAN_LIMIT_REACHED';
    error.details = {
      currentContacts: currentContacts.length,
      limit: FREE_PLAN_CONTACT_LIMIT,
    };
    throw error;
  }

  const baseContact = {
    ...contactInfo,
    email: String(contactInfo.email || ''),
    sourceCardIndex: normalizedCardIndex,
    createdAt: admin.firestore.Timestamp.now(),
  };

  let newContact = baseContact;

  try {
    console.log('Checking if contact is an XS Card user...');
    const existingUser = await checkUserExistsByEmail(baseContact.email);

    if (existingUser) {
      console.log(`Contact is XS Card user: ${existingUser.userId}`);

      setImmediate(async () => {
        try {
          const linkedContact = await linkContactToXsCardUser(
            baseContact,
            existingUser.userId,
            normalizedCardIndex
          );
          console.log('Linked contact created in background');

          const updatedContacts = [...currentContacts];
          const contactIndex = updatedContacts.findIndex((contact) => contact.email === baseContact.email);

          if (contactIndex !== -1) {
            updatedContacts[contactIndex] = linkedContact;
            await contactRef.set(
              {
                userId: db.doc(`users/${userId}`),
                contactList: updatedContacts,
              },
              { merge: true }
            );
            console.log('Contact updated with linking info');
          }
        } catch (linkingError) {
          console.error('Error during background linking:', linkingError);
        }
      });

      console.log('Contact saved, linking will happen in background');
    } else {
      console.log('Contact is not an XS Card user, saving as regular contact');
    }
  } catch (linkingError) {
    console.error('Error during user detection (non-blocking):', linkingError);
    newContact = baseContact;
  }

  currentContacts.push(newContact);

  await contactRef.set(
    {
      userId: db.doc(`users/${userId}`),
      contactList: currentContacts,
    },
    { merge: true }
  );

  if (userData.email) {
    setImmediate(async () => {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userData.email,
          subject: `${contactInfo.name} Saved Your Contact Information`,
          html: `
            <h2>New Contact Added</h2>
            <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p><strong>Contact Details:</strong></p>
              <ul style="list-style: none; padding-left: 0;">
                <li><strong>Name:</strong> ${contactInfo.name}</li>
                <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                <li><strong>Phone Number:</strong> ${contactInfo.phone || 'Not provided'}</li>
                <li><strong>Email:</strong> ${contactInfo.email || 'Not provided'}</li>
                ${contactInfo.company ? `<li><strong>Company:</strong> ${contactInfo.company}</li>` : ''}
                <li><strong>How You Met:</strong> ${contactInfo.howWeMet || 'Not provided'}</li>
              </ul>
            </div>
            <p style="color: #666; font-size: 12px;">This is an automated notification from your XS Card application.</p>
            ${
              userData.plan === 'free'
                ? `<p style="color: #ff4b6e;">You have ${FREE_PLAN_CONTACT_LIMIT - currentContacts.length} contacts remaining in your free plan.</p>`
                : ''
            }
          `,
        };

        const mailResult = await sendMailWithStatus(mailOptions);
        if (!mailResult.success) {
          console.error('Failed to send email notification:', mailResult.error);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    });
  }

  return {
    success: true,
    message: 'Contact added successfully',
    contactList: serializeContactList(currentContacts),
    remainingContacts:
      userData.plan === 'free' ? FREE_PLAN_CONTACT_LIMIT - currentContacts.length : 'unlimited',
  };
};

module.exports = {
  addPublicContact,
};
