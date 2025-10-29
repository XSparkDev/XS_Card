# Data Purging System Implementation Plan

## Overview
This document outlines the complete implementation plan for the XS Card data purging system, designed to comply with Apple's data deletion requirements while maintaining business continuity and user data restoration capabilities.

## Table of Contents
1. [Current Implementation Status](#current-implementation-status)
2. [System Architecture](#system-architecture)
3. [Phase 1: User Account Purging (COMPLETED)](#phase-1-user-account-purging-completed)
4. [Phase 2: User Data Purging (PLANNED)](#phase-2-user-data-purging-planned)
5. [Phase 3: Financial Data Purging (PLANNED)](#phase-3-financial-data-purging-planned)
6. [Phase 4: Media & Asset Purging (PLANNED)](#phase-4-media--asset-purging-planned)
7. [Phase 5: Audit & Compliance (PLANNED)](#phase-5-audit--compliance-planned)
8. [Configuration & Environment Variables](#configuration--environment-variables)
9. [Data Restoration System](#data-restoration-system)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Plan](#deployment-plan)

---

## Current Implementation Status

### ✅ COMPLETED
- **Inactive Users Detection**: Identifies users with `active: false`
- **User Listing**: Logs inactive users for review
- **Firebase Auth Deletion**: Removes users from authentication
- **UID Preservation**: Stores original UIDs for restoration
- **Archiving System**: Moves users to `archived_users` collection
- **Modular Job System**: Jobs organized in `/backend/jobs/` folder

### 🚧 IN PROGRESS
- **Data Restoration**: Framework for restoring deleted users
- **Comprehensive Purging**: Additional data types pending

### 📋 PLANNED
- **Cards Data Purging**: User business 
- **Contacts Purging**: User contact lists
- **Events Purging**: Event registrations and data
- **Meetings Purging**: Meeting records
- **Images Purging**: Profile images and media
- **Financial Data Purging**: Subscription and payment data
- **Audit System**: Complete purging audit trail

---

## System Architecture

### Job Management Structure
```
backend/jobs/
├── index.js                    # Central job coordinator
├── inactiveUsersJob.js        # ✅ User account purging
├── userDataPurgingJob.js      # 📋 User data purging
├── financialDataPurgingJob.js # 📋 Financial data purging
├── mediaPurgingJob.js         # 📋 Media and assets purging
├── auditJob.js                # 📋 Audit and compliance
└── restorationJob.js           # 📋 Data restoration
```

### Data Flow
```
Inactive Users → Archive → Purge Data → Audit → Restore (if needed)
     ↓              ↓         ↓         ↓         ↓
  Detection    → Storage → Deletion → Logging → Recovery
```

---

## Phase 1: User Account Purging (COMPLETED)

### Current Implementation
- **File**: `backend/jobs/inactiveUsersJob.js`
- **Function**: `checkInactiveUsers()`, `archiveInactiveUsers()`
- **Status**: ✅ Fully implemented and tested

### Features Implemented
1. **Inactive User Detection**
   - Queries users with `active: false`
   - Lists users with detailed information
   - Configurable check intervals

2. **Firebase Auth Deletion**
   - Deletes users from Firebase Authentication
   - Preserves UIDs for restoration
   - Handles deletion errors gracefully

3. **Firestore Archiving**
   - Moves users to `archived_users` collection
   - Preserves all user data with metadata
   - Maintains audit trail

4. **Configuration**
   - Environment variable controls
   - Configurable intervals
   - Optional auth deletion

### Environment Variables
```bash
# User Account Purging
ARCHIVE_INACTIVE_USERS=true
DELETE_FIREBASE_AUTH_USERS=true
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=262800  # 6 months
```

---

## Phase 2: User Data Purging (PLANNED)

### Target Data Types
- **Business Cards**: User's digital business cards
- **Contacts**: User's contact lists
- **Events**: Event registrations and participation
- **Meetings**: Meeting records and history
- **Profile Data**: Additional profile information

### Implementation Plan

#### 2.1 Business Cards Purging
```javascript
// File: backend/jobs/userDataPurgingJob.js
const purgeUserCards = async (db, userId) => {
    // 1. Find all cards for user
    const cardsSnapshot = await db.collection('cards')
        .where('userId', '==', userId)
        .get();
    
    // 2. Archive cards data
    for (const cardDoc of cardsSnapshot.docs) {
        await db.collection('archived_cards').add({
            ...cardDoc.data(),
            originalId: cardDoc.id,
            userId: userId,
            archivedAt: new Date().toISOString(),
            archivedBy: 'system',
            archiveReason: 'user_purging'
        });
    }
    
    // 3. Delete from active collection
    const batch = db.batch();
    cardsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};
```

#### 2.2 Contacts Purging
```javascript
const purgeUserContacts = async (db, userId) => {
    // 1. Find user's contact list
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    const contactList = userData.contactList || [];
    
    // 2. Archive contacts
    await db.collection('archived_contacts').add({
        userId: userId,
        contactList: contactList,
        archivedAt: new Date().toISOString(),
        archivedBy: 'system',
        archiveReason: 'user_purging'
    });
    
    // 3. Clear contacts from user document
    await db.collection('users').doc(userId).update({
        contactList: [],
        contactsArchivedAt: new Date().toISOString()
    });
};
```

#### 2.3 Events Purging
```javascript
const purgeUserEvents = async (db, userId) => {
    // 1. Find user's event registrations
    const eventsSnapshot = await db.collection('event_registrations')
        .where('userId', '==', userId)
        .get();
    
    // 2. Archive event data
    for (const eventDoc of eventsSnapshot.docs) {
        await db.collection('archived_event_registrations').add({
            ...eventDoc.data(),
            originalId: eventDoc.id,
            userId: userId,
            archivedAt: new Date().toISOString(),
            archivedBy: 'system',
            archiveReason: 'user_purging'
        });
    }
    
    // 3. Delete from active collection
    const batch = db.batch();
    eventsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};
```

### Environment Variables
```bash
# User Data Purging
PURGE_USER_CARDS=true
PURGE_USER_CONTACTS=true
PURGE_USER_EVENTS=true
PURGE_USER_MEETINGS=true
USER_DATA_PURGING_INTERVAL_MINUTES=262800  # 6 months
```

---

## Phase 3: Financial Data Purging (PLANNED)

### Target Data Types
- **Subscription Data**: User subscription history
- **Payment Records**: Payment transactions
- **Billing Information**: Billing addresses and methods
- **Trial Data**: Trial period information

### Implementation Plan

#### 3.1 Subscription Data Purging
```javascript
// File: backend/jobs/financialDataPurgingJob.js
const purgeFinancialData = async (db, userId) => {
    // 1. Archive subscription data
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (subscriptionDoc.exists) {
        await db.collection('archived_subscriptions').add({
            ...subscriptionDoc.data(),
            originalId: subscriptionDoc.id,
            userId: userId,
            archivedAt: new Date().toISOString(),
            archivedBy: 'system',
            archiveReason: 'user_purging'
        });
        
        await subscriptionDoc.ref.delete();
    }
    
    // 2. Archive payment records
    const paymentsSnapshot = await db.collection('payments')
        .where('userId', '==', userId)
        .get();
    
    for (const paymentDoc of paymentsSnapshot.docs) {
        await db.collection('archived_payments').add({
            ...paymentDoc.data(),
            originalId: paymentDoc.id,
            userId: userId,
            archivedAt: new Date().toISOString(),
            archivedBy: 'system',
            archiveReason: 'user_purging'
        });
    }
    
    // 3. Delete payment records
    const batch = db.batch();
    paymentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};
```

### Environment Variables
```bash
# Financial Data Purging
PURGE_FINANCIAL_DATA=true
FINANCIAL_DATA_RETENTION_DAYS=2555  # 7 years (legal requirement)
FINANCIAL_DATA_PURGING_INTERVAL_MINUTES=525600  # 1 year
```

---

## Phase 4: Media & Asset Purging (PLANNED)

### Target Data Types
- **Profile Images**: User profile pictures
- **Card Images**: Business card images
- **Event Images**: Event-related media
- **Meeting Recordings**: Meeting audio/video files

### Implementation Plan

#### 4.1 Media Purging
```javascript
// File: backend/jobs/mediaPurgingJob.js
const purgeUserMedia = async (db, userId) => {
    // 1. Find all media references
    const mediaSnapshot = await db.collection('media')
        .where('userId', '==', userId)
        .get();
    
    // 2. Archive media metadata
    for (const mediaDoc of mediaSnapshot.docs) {
        const mediaData = mediaDoc.data();
        
        await db.collection('archived_media').add({
            ...mediaData,
            originalId: mediaDoc.id,
            userId: userId,
            archivedAt: new Date().toISOString(),
            archivedBy: 'system',
            archiveReason: 'user_purging'
        });
        
        // 3. Delete from cloud storage (Firebase Storage)
        if (mediaData.downloadURL) {
            try {
                const fileRef = admin.storage().bucket().file(mediaData.filePath);
                await fileRef.delete();
                console.log(`✅ Deleted media file: ${mediaData.filePath}`);
            } catch (error) {
                console.error(`❌ Failed to delete media file: ${mediaData.filePath}`, error);
            }
        }
    }
    
    // 4. Delete from Firestore
    const batch = db.batch();
    mediaSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};
```

### Environment Variables
```bash
# Media Purging
PURGE_USER_MEDIA=true
MEDIA_PURGING_INTERVAL_MINUTES=262800  # 6 months
```

---

## Phase 5: Audit & Compliance (PLANNED)

### Audit System
```javascript
// File: backend/jobs/auditJob.js
const createPurgingAudit = async (db, purgingData) => {
    await db.collection('purging_audit').add({
        userId: purgingData.userId,
        purgingType: purgingData.type,
        dataPurged: purgingData.dataTypes,
        purgedAt: new Date().toISOString(),
        purgedBy: 'system',
        complianceReason: 'apple_data_deletion_requirements',
        restorationAvailable: true,
        auditId: `audit_${Date.now()}_${purgingData.userId}`
    });
};
```

### Environment Variables
```bash
# Audit System
ENABLE_PURGING_AUDIT=true
AUDIT_RETENTION_DAYS=2555  # 7 years
```

---

## Data Restoration System

### Restoration Framework
```javascript
// File: backend/jobs/restorationJob.js
const restoreUserData = async (db, userId) => {
    // 1. Restore Firebase Auth user
    const archivedUser = await getArchivedUser(db, userId);
    await admin.auth().createUser({
        uid: archivedUser.originalId,
        email: archivedUser.email,
        displayName: archivedUser.name,
        emailVerified: archivedUser.emailVerified
    });
    
    // 2. Restore Firestore user data
    await db.collection('users').doc(userId).set({
        ...archivedUser,
        active: true,
        restoredAt: new Date().toISOString(),
        restoredBy: 'system'
    });
    
    // 3. Restore user data
    await restoreUserCards(db, userId);
    await restoreUserContacts(db, userId);
    await restoreUserEvents(db, userId);
    
    // 4. Remove from archived collections
    await removeFromArchivedCollections(db, userId);
};
```

### Environment Variables
```bash
# Data Restoration
ENABLE_DATA_RESTORATION=true
RESTORATION_REQUEST_EXPIRY_DAYS=30
```

---

## Configuration & Environment Variables

### Complete Environment Configuration
```bash
# ===========================================
# DATA PURGING SYSTEM CONFIGURATION
# ===========================================

# User Account Purging
ARCHIVE_INACTIVE_USERS=true
DELETE_FIREBASE_AUTH_USERS=true
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=262800  # 6 months

# User Data Purging
PURGE_USER_CARDS=true
PURGE_USER_CONTACTS=true
PURGE_USER_EVENTS=true
PURGE_USER_MEETINGS=true
USER_DATA_PURGING_INTERVAL_MINUTES=262800  # 6 months

# Financial Data Purging
PURGE_FINANCIAL_DATA=true
FINANCIAL_DATA_RETENTION_DAYS=2555  # 7 years
FINANCIAL_DATA_PURGING_INTERVAL_MINUTES=525600  # 1 year

# Media Purging
PURGE_USER_MEDIA=true
MEDIA_PURGING_INTERVAL_MINUTES=262800  # 6 months

# Audit System
ENABLE_PURGING_AUDIT=true
AUDIT_RETENTION_DAYS=2555  # 7 years

# Data Restoration
ENABLE_DATA_RESTORATION=true
RESTORATION_REQUEST_EXPIRY_DAYS=30
```

---

## Testing Strategy

### 1. Unit Testing
- Test individual purging functions
- Test data restoration functions
- Test error handling scenarios

### 2. Integration Testing
- Test complete purging workflow
- Test restoration workflow
- Test audit trail creation

### 3. Compliance Testing
- Verify data deletion completeness
- Verify restoration capability
- Verify audit trail integrity

### 4. Performance Testing
- Test purging performance with large datasets
- Test restoration performance
- Test system resource usage

---

## Deployment Plan

### Phase 1: Foundation (COMPLETED)
- ✅ Inactive users job
- ✅ Firebase Auth deletion
- ✅ UID preservation
- ✅ Archiving system

### Phase 2: User Data (PLANNED)
- 📋 Business cards purging
- 📋 Contacts purging
- 📋 Events purging
- 📋 Meetings purging

### Phase 3: Financial Data (PLANNED)
- 📋 Subscription data purging
- 📋 Payment records purging
- 📋 Billing information purging

### Phase 4: Media & Assets (PLANNED)
- 📋 Profile images purging
- 📋 Card images purging
- 📋 Event media purging
- 📋 Meeting recordings purging

### Phase 5: Audit & Compliance (PLANNED)
- 📋 Audit trail system
- 📋 Compliance reporting
- 📋 Data restoration system

---

## Compliance Benefits

### Apple Requirements
- ✅ **Data Deletion**: Complete user data removal
- ✅ **User Control**: Users can request data deletion
- ✅ **Transparency**: Clear data handling policies
- ✅ **Restoration**: Users can restore their data

### Legal Compliance
- ✅ **GDPR**: Right to be forgotten
- ✅ **CCPA**: Data deletion rights
- ✅ **Apple Guidelines**: App Store compliance
- ✅ **Data Portability**: User data export/import

---

## Monitoring & Maintenance

### Health Checks
- Monitor purging job execution
- Monitor restoration success rates
- Monitor audit trail integrity
- Monitor system performance

### Maintenance Tasks
- Regular audit trail cleanup
- Archive storage optimization
- Performance monitoring
- Compliance reporting

---

## Conclusion

This implementation plan provides a comprehensive framework for data purging that:
1. **Complies with Apple requirements** for data deletion
2. **Maintains business continuity** through data restoration
3. **Provides audit trails** for compliance
4. **Scales efficiently** with user growth
5. **Handles edge cases** gracefully

The phased approach allows for incremental implementation while maintaining system stability and compliance.
