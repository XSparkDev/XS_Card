# Apple App Review - Account Deletion Response

**App Name:** XS Card  
**Response Date:** October 13, 2025  
**Review Question:** When users select the deactivate account option in Settings, what happens to their account and any user data associated with their account?

---

## Response to Apple

Dear App Review Team,

We have implemented **two separate options** for account management to give users maximum control:

### 1. **Deactivate Account** (Temporary)
This option temporarily disables the user's account:
- The Firebase Authentication account is **disabled** (not deleted)
- User cannot log in
- Personal data remains in the database
- Account can be reactivated by contacting support
- This is for users who want to take a break but may return

### 2. **Delete Account** (Permanent) ✅ **Required by Apple**
This option **permanently deletes** the user's account and **anonymizes** all personal data:

#### **What Happens Immediately:**

**Authentication & Access:**
- Firebase Authentication account is **permanently deleted**
- User is immediately logged out
- User can never log back in with this account
- Login credentials are completely removed

**Personal Data Removal:**
- User's name, surname, email, and phone number are **anonymized** (replaced with "Deleted User" and unique identifier)
- All digital business cards are **anonymized** (personal information replaced with generic placeholders)
- Profile images are set to null (removed from system)
- Company logos are set to null (removed from system)
- All social media links are cleared
- All contact information is removed

#### **What is Retained (Legal Compliance):**

We retain the following anonymized data to comply with South African and international law:

1. **Transaction Records** (7 years - Required by South African Revenue Service)
   - Payment history (anonymized)
   - Subscription records (anonymized)
   - Invoice data (required for tax audits)

2. **Aggregate Statistics** (Anonymized - No Personal Identifiers)
   - Account creation date (for business analytics)
   - Subscription plan type (for reporting)
   - Number of cards created (anonymized count)
   - App usage patterns (fully anonymized)

3. **Audit Logs** (Security & Compliance)
   - Deletion timestamp
   - Anonymized user identifier
   - Deletion event logs (for compliance verification)

**Important:** All retained data is **anonymized** and cannot be linked back to the individual. The email becomes "deleted_user_[timestamp]@deleted.local", the name becomes "Deleted User", and all personal identifiers are removed.

#### **User Experience:**

1. **Location:** Settings → Danger Zone → "Delete Account"
2. **Clear Labeling:** Button clearly states "Delete Account - Permanently delete account and data"
3. **Confirmation Dialog:** Shows exactly what will be deleted and what will be kept
4. **No External Steps:** Everything happens in-app, no need to contact support or visit a website
5. **Immediate Effect:** Account deletion is immediate; user loses access instantly
6. **Transparency:** User is informed of the process before confirming

#### **Subscription Handling:**

For users with active RevenueCat subscriptions:
- They are informed during the deletion process
- We direct them to cancel subscriptions via Apple's subscription management
- Link provided: https://apps.apple.com/account/subscriptions
- Subscription billing continues through Apple until user cancels
- Transaction history is retained as required by financial regulations

#### **Timeline:**

- **Immediate:** User account disabled, authentication deleted, user logged out
- **Immediate:** Personal data anonymization begins
- **Within 1 hour:** All personal identifiers replaced with generic placeholders
- **30 days:** Complete data scrubbing verification
- **7 years:** Transaction records retained then deleted (tax law requirement)

---

## Technical Implementation

**Frontend:**
- File: `src/screens/SettingsScreen.tsx`
- Clear warning dialog before deletion
- Explains what will be deleted and what will be kept
- Two-step confirmation process

**Backend:**
- File: `backend/controllers/userController.js`
- Function: `deleteUserAccount()`
- Deletes Firebase Authentication
- Anonymizes user document in Firestore
- Anonymizes cards document in Firestore
- Creates audit log in deletionLogs collection

**Route:**
- Endpoint: `DELETE /Users/delete-account`
- Authentication required
- Comprehensive logging for compliance

---

## Compliance

This implementation complies with:

✅ **Apple App Store Guidelines** 5.1.1(v) - Account deletion in-app  
✅ **GDPR** Article 17 - Right to erasure with legal basis exceptions  
✅ **CCPA** - Consumer data deletion rights  
✅ **POPIA** (South Africa) - Data subject rights  
✅ **South African Tax Law** - 7-year retention of financial records  
✅ **International Financial Regulations** - Transaction record retention

---

## Evidence Available

We can provide:
1. Screenshots of the deletion flow
2. Code review of anonymization logic
3. Sample anonymized data structure
4. Audit logs showing deletion events
5. Legal consultation documentation supporting retention policies

---

## Summary

**User Control:** ✅ Complete  
**In-App Deletion:** ✅ Fully implemented  
**Personal Data Removed:** ✅ Anonymized immediately  
**Legal Compliance:** ✅ Retained data fully anonymized  
**Clear Communication:** ✅ Users informed of entire process  
**No Barriers:** ✅ No external steps required

Users can **easily and permanently delete their accounts** directly within the app, with all personal data anonymized immediately. We retain only anonymized aggregate statistics and legally-required financial records.

---

**Contact:** [Your support email]  
**Documentation:** Available upon request  
**Testing:** Feature live and testable in current build

---

## Screenshots

[Attach screenshots showing:]
1. Settings screen with "Delete Account" button
2. Confirmation dialog explaining deletion
3. Success message after deletion
4. Sample of anonymized data structure

---

This implementation **exceeds** Apple's requirements by providing users with granular control over their data while maintaining our legal obligations.

Respectfully submitted,  
XS Card Development Team

