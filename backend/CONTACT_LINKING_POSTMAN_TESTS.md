# Contact Linking Feature - Postman Testing Guide

## Overview
This guide covers testing the new contact linking feature that automatically detects if a contact is an existing XS Card user and links their profile.

## Prerequisites
1. **Backend server running** on your configured port
2. **Postman** installed and configured
3. **Test users** in your database with known email addresses
4. **Test contacts** with various email scenarios

## Test Scenarios

### Scenario 1: Non-XS Card User Contact (Fast Path)
**Purpose**: Test that regular contacts are saved quickly without linking

**Request**:
```
POST {{baseUrl}}/AddContact
Content-Type: application/json

{
    "userId": "your-test-user-id",
    "contactInfo": {
        "name": "Jane",
        "surname": "Smith",
        "phone": "+1234567890",
        "email": "jane.smith@nonuser.com",
        "company": "External Corp",
        "howWeMet": "Conference"
    }
}
```

**Expected Response**:
```json
{
    "success": true,
    "message": "Contact saved successfully",
    "savedContact": {
        "name": "Jane",
        "surname": "Smith",
        "phone": "+1234567890",
        "email": "jane.smith@nonuser.com",
        "company": "External Corp",
        "howWeMet": "Conference",
        "createdAt": "timestamp"
        // NO linking fields (sourceUserId, sourceCardIndex, isXsCardUser, etc.)
    },
    "contactsCount": 1,
    "remainingContacts": 19
}
```

**Validation**:
- ✅ Contact saved quickly (< 2 seconds)
- ✅ No linking fields present
- ✅ All basic contact info preserved
- ✅ Contact count updated

---

### Scenario 2: Existing XS Card User Contact (Linked Path)
**Purpose**: Test that existing users are automatically linked

**Request**:
```
POST {{baseUrl}}/AddContact
Content-Type: application/json

{
    "userId": "card-owner-user-id",
    "contactInfo": {
        "name": "Sam",
        "surname": "Johnson",
        "phone": "+0987654321",
        "email": "sam@existinguser.com",
        "company": "XS Card User Corp",
        "howWeMet": "Networking Event"
    }
}
```

**Expected Response**:
```json
{
    "success": true,
    "message": "Contact saved successfully",
    "savedContact": {
        "name": "Sam",
        "surname": "Johnson",
        "phone": "+0987654321",
        "email": "sam@existinguser.com",
        "company": "XS Card User Corp",
        "howWeMet": "Networking Event",
        "createdAt": "timestamp",
        // LINKING FIELDS ADDED:
        "sourceUserId": "sam-user-id",
        "sourceCardIndex": 0,
        "profileImageUrl": "https://storage.googleapis.com/.../profiles/sam-user-id/card0.jpg",
        "isXsCardUser": true,
        "linkedAt": "2025-09-20T..."
    },
    "contactsCount": 2,
    "remainingContacts": 18
}
```

**Validation**:
- ✅ Contact saved with linking fields
- ✅ `sourceUserId` matches the existing user's ID
- ✅ `sourceCardIndex` is 0 (primary card)
- ✅ `isXsCardUser` is true
- ✅ `profileImageUrl` generated correctly
- ✅ `linkedAt` timestamp present

---

### Scenario 3: Missing Email (Validation Test)
**Purpose**: Test that email requirement is enforced

**Request**:
```
POST {{baseUrl}}/AddContact
Content-Type: application/json

{
    "userId": "your-test-user-id",
    "contactInfo": {
        "name": "Test",
        "surname": "User",
        "phone": "+1111111111",
        "company": "Test Corp",
        "howWeMet": "Test Event"
        // NO EMAIL PROVIDED
    }
}
```

**Expected Response**:
```json
{
    "success": false,
    "message": "Email is required for contact saving"
}
```

**Validation**:
- ✅ Request rejected with 400 status
- ✅ Clear error message about email requirement

---

### Scenario 4: Profile Image URL Generation
**Purpose**: Test the profile image endpoint

**Request**:
```
GET {{baseUrl}}/profile-image/sam-user-id/0
```

**Expected Response**:
```json
{
    "success": true,
    "userId": "sam-user-id",
    "cardIndex": 0,
    "profileImageUrl": "https://storage.googleapis.com/your-bucket/profiles/sam-user-id/card0.jpg"
}
```

**Validation**:
- ✅ URL generated correctly
- ✅ Follows Firebase Storage public URL format
- ✅ Includes correct user ID and card index

---

### Scenario 5: Invalid Profile Image Request
**Purpose**: Test error handling for profile image endpoint

**Request**:
```
GET {{baseUrl}}/profile-image/invalid-user/abc
```

**Expected Response**:
```json
{
    "success": false,
    "message": "Card index must be a non-negative number"
}
```

**Validation**:
- ✅ Request rejected with 400 status
- ✅ Clear error message about invalid card index

---

## Performance Testing

### Test Contact Saving Speed
1. **Non-XS Card User**: Should complete in < 2 seconds
2. **XS Card User**: Should complete in < 3 seconds (includes user lookup)

### Monitor Console Logs
Check server console for:
```
Checking if contact is an XS Card user...
Contact is XS Card user: sam-user-id
Linked contact created: { ... }
```

OR

```
Contact is not an XS Card user, saving as regular contact
```

## Database Verification

### Check Contacts Collection
After each test, verify in Firebase Console:
```javascript
// Document: contacts/card-owner-user-id
{
    "userId": "reference to users/card-owner-user-id",
    "contactList": [
        {
            "name": "Sam",
            "surname": "Johnson",
            // ... other fields
            "sourceUserId": "sam-user-id",  // Only for linked contacts
            "isXsCardUser": true,           // Only for linked contacts
            "profileImageUrl": "https://...", // Only for linked contacts
        }
    ]
}
```

## Email Index Setup (Required)

Before testing, ensure the email index exists:

### Firebase Console Method:
1. Go to Firebase Console → Firestore Database
2. Navigate to "Indexes" tab
3. Create composite index:
   - Collection: `users`
   - Fields: `email` (Ascending)

### Admin SDK Method (Alternative):
```javascript
// Run once to create the index
const admin = require('firebase-admin');
const db = admin.firestore();

// This will create the index automatically on first query
// but it's better to create it manually in console
```

## Troubleshooting

### Common Issues:

1. **"Email is required" error**: Ensure email field is included in contactInfo
2. **Slow user lookup**: Check that email index is created in Firestore
3. **Linking fails silently**: Check server console for error logs
4. **Profile image URL incorrect**: Verify Firebase Storage bucket name in environment variables

### Debug Checklist:
- ✅ Backend server running
- ✅ Email index created in Firestore
- ✅ Test users exist with email addresses
- ✅ Firebase Storage bucket configured
- ✅ Environment variables set correctly

## Test Data Setup

### Create Test Users:
```json
// User 1: Card Owner (receives contacts)
{
    "id": "card-owner-user-id",
    "email": "cardowner@test.com",
    "plan": "free"
}

// User 2: XS Card User (will be linked)
{
    "id": "sam-user-id", 
    "email": "sam@existinguser.com",
    "plan": "free"
}
```

### Test Profile Images:
Upload test images to Firebase Storage:
- `profiles/sam-user-id/card0.jpg`
- `profiles/card-owner-user-id/card0.jpg`

## Success Criteria

All tests should pass with:
- ✅ **Fast non-user contacts**: < 2 seconds
- ✅ **Linked user contacts**: < 3 seconds  
- ✅ **Proper linking fields**: sourceUserId, isXsCardUser, profileImageUrl
- ✅ **Email validation**: Required field enforced
- ✅ **Profile image URLs**: Generated correctly
- ✅ **Error handling**: Graceful fallback if linking fails
- ✅ **Database consistency**: Contacts saved with correct structure

---

**Ready to test!** 🚀

Run through all scenarios in order and verify the expected responses. The feature should handle both fast non-user contacts and enhanced linked user contacts seamlessly.
