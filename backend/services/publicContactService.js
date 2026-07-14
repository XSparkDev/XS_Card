const { db, admin } = require('../firebase.js');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const { checkUserExistsByEmail } = require('../utils/userDetection');
const { linkContactToXsCardUser } = require('../utils/contactLinking');
const { createCampaign } = require('./followUpService');
const { v4: uuidv4 } = require('uuid');

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
    // Stable UUID — survives array reindexing and links this entry to its
    // follow-up campaign without relying on position or mutable fields.
    contactId: uuidv4(),
    // Optional scanner geolocation captured at scan time. Persisted as-is when
    // provided, otherwise stored as null so the field is always present.
    location: contactInfo.location || null,
    locationCapturedAt: contactInfo.locationCapturedAt || (contactInfo.location && contactInfo.location.capturedAt) || null,
    followUpStatus: 'active',
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

  // Start the three-day follow-up email campaign in the background.
  setImmediate(async () => {
    try {
      const ownerData = {
        name: userData.name || '',
        surname: userData.surname || '',
        email: userData.email || '',
        phone: userData.phone || '',
        company: userData.company || '',
        occupation: userData.occupation || '',
      };
      const scannerData = {
        name: baseContact.name || '',
        surname: baseContact.surname || '',
        email: baseContact.email || '',
        phone: baseContact.phone || '',
        company: baseContact.company || '',
        occupation: baseContact.occupation || '',
      };
      await createCampaign(userId, ownerData, scannerData, baseContact.contactId);
    } catch (campaignError) {
      console.error('[FollowUp] Failed to create follow-up campaign:', campaignError);
    }
  });

  // NOTE: Scans are recorded at saveContact.html PAGE LOAD (via /record-scan),
  // not on contact save — a scan is "someone landed on the page", independent of
  // whether they fill in or submit the form.

  if (userData.email) {
    setImmediate(async () => {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userData.email,
          subject: `${contactInfo.name} ${contactInfo.surname} Saved Your Contact Information`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <div style="background-color: #1B2B5B; padding: 24px; text-align: center;">
                <span style="color: #FF4B6E; font-size: 24px; font-weight: bold;">XS</span><span style="color: #ffffff; font-size: 24px; font-weight: bold;">Card</span>
              </div>
              <div style="padding: 24px;">
                <h2 style="color: #1B2B5B; margin-top: 0;">New Contact Added</h2>
                <p><strong>${contactInfo.name} ${contactInfo.surname}</strong> recently received your XS Card and has sent you their details:</p>
                <div style="background-color: #FFE5E9; border-left: 4px solid #FF4B6E; padding: 16px; border-radius: 6px; margin: 16px 0;">
                  <p style="margin-top: 0;"><strong>Contact Details:</strong></p>
                  <ul style="list-style: none; padding-left: 0; margin-bottom: 0;">
                    <li><strong>Name:</strong> ${contactInfo.name}</li>
                    <li><strong>Surname:</strong> ${contactInfo.surname}</li>
                    <li><strong>Phone Number:</strong> ${contactInfo.phone || 'Not provided'}</li>
                    <li><strong>Email:</strong> ${contactInfo.email || 'Not provided'}</li>
                    ${contactInfo.company ? `<li><strong>Company:</strong> ${contactInfo.company}</li>` : ''}
                    <li><strong>How You Met:</strong> ${contactInfo.howWeMet || 'Not provided'}</li>
                  </ul>
                </div>
                ${
                  userData.plan === 'free'
                    ? `<p style="color: #FF4B6E; font-weight: bold;">You have ${FREE_PLAN_CONTACT_LIMIT - currentContacts.length} contacts remaining in your free plan.</p>`
                    : ''
                }
                <p style="color: #888888; font-size: 12px; margin-top: 24px;">This is an automated notification from your XS Card application.</p>
              </div>
            </div>
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

  // Confirmation email to the person who scanned the card and saved the contact
  setImmediate(async () => {
    try {
      const ownerName = [userData.name, userData.surname].filter(Boolean).join(' ') || 'this XS Card user';
      const scannerFirstName = String(contactInfo.name || '').trim();
      const appStoreUrl = 'https://apps.apple.com/app/id6742452317';

      const scannerMailOptions = {
        from: process.env.EMAIL_USER,
        to: contactInfo.email,
        subject: `You just scanned ${ownerName}'s XS Card`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #1B2B5B; padding: 24px; text-align: center;">
              <span style="color: #FF4B6E; font-size: 24px; font-weight: bold;">XS</span><span style="color: #ffffff; font-size: 24px; font-weight: bold;">Card</span>
            </div>
            <div style="padding: 24px;">
              <h2 style="color: #1B2B5B; margin-top: 0;">Nice scan${scannerFirstName ? `, ${scannerFirstName}` : ''}! 👋</h2>
              <p>You just saved <strong>${ownerName}</strong>'s contact details straight from their digital business card — no paper, no typing.</p>
              <div style="background-color: #FFE5E9; border-left: 4px solid #FF4B6E; padding: 16px; border-radius: 6px; margin: 16px 0;">
                <p style="margin-top: 0;"><strong>Who you connected with:</strong></p>
                <ul style="list-style: none; padding-left: 0; margin-bottom: 0;">
                  <li><strong>Name:</strong> ${ownerName}</li>
                  ${userData.company ? `<li><strong>Company:</strong> ${userData.company}</li>` : ''}
                  ${userData.email ? `<li><strong>Email:</strong> ${userData.email}</li>` : ''}
                  ${userData.phone ? `<li><strong>Phone:</strong> ${userData.phone}</li>` : ''}
                </ul>
              </div>
              <div style="background-color: #1B2B5B; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
                <h3 style="color: #ffffff; margin-top: 0;">Get your own XS Card</h3>
                <p style="color: #E0E0E0; margin-bottom: 16px;">Share your details just as easily — create your free digital business card and start collecting contacts like this one, without printing a single card.</p>
                <a href="${appStoreUrl}" style="display: inline-block; background-color: #FF4B6E; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold;">Get XS Card</a>
              </div>
              <p style="color: #888888; font-size: 12px;">This is an automated notification from XS Card.</p>
            </div>
          </div>
        `,
      };

      const scannerMailResult = await sendMailWithStatus(scannerMailOptions);
      if (!scannerMailResult.success) {
        console.error('Failed to send scanner confirmation email:', scannerMailResult.error);
      }
    } catch (scannerEmailError) {
      console.error('Scanner confirmation email error:', scannerEmailError);
    }
  });

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
