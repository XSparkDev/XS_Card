# Phase 1 Testing Guide

## Overview

This guide covers testing for Phase 1 features:
- **Activity Logging System** - Query and export activity logs
- **Enterprise CRUD Operations** - Manage enterprise data

## Prerequisites

1. **Server Running**
   - Backend server must be running on `http://localhost:8383`
   - Check: `curl http://localhost:8383/api/enterprise/health`

2. **Test User Setup**
   - User must exist in Firebase Auth
   - User must have `enterpriseRef` or `enterpriseId` in user document
   - User must have `plan: 'enterprise'` and `role: 'admin'` for full CRUD access
   - Set in `.env`:
     ```
     TEST_USER_EMAIL=your-enterprise-user@example.com
     TEST_USER_PASSWORD=your-password
     ```

3. **Firestore Setup**
   - `enterprise` collection should have at least one enterprise document
   - `activityLogs` collection should exist (can be empty initially)

## Testing Methods

### 1. E2E Tests (Automated)

Run the automated test suite:

```bash
cd backend
node test-e2e-phase1-enterprise-crud.js
```

**What it tests:**
- ✅ Authentication flow
- ✅ Activity log endpoints (all 6 endpoints)
- ✅ Enterprise CRUD endpoints (5 endpoints)
- ✅ Authorization checks
- ✅ Response format validation

**Expected Output:**
```
🧪 Phase 1: Enterprise CRUD & Activity Logging E2E Tests

🔐 Authenticating user...
✅ Authentication successful
   User ID: abc123...
   Enterprise ID: enterprise-xyz...

📋 Activity Log Tests
✅ Get activities by action (view)
✅ Get activities by resource (enterprise)
✅ Get activities by user
✅ Get activities by enterprise
✅ Get activities by time range
✅ Export activities (CSV)

🏢 Enterprise CRUD Tests
✅ Get all enterprises
✅ Get enterprise by ID
✅ Get enterprise stats
✅ Update enterprise (description)

🔒 Authorization Tests
✅ Unauthorized access to activity logs (no token)
✅ Unauthorized access to enterprise (no token)

📊 Test Summary
✅ Passed: 12
❌ Failed: 0
📈 Total:  12
```

### 2. Postman Collection (Manual Testing)

**Import Collection:**
1. Open Postman
2. Click "Import"
3. Select `backend/Enterprise_Phase1_CRUD_ActivityLogs.postman_collection.json`

**Collection Structure:**
- **Authentication** - Sign In (saves token automatically)
- **Activity Logs** - 6 endpoints
- **Enterprise CRUD** - 5 endpoints
- **Authorization Tests** - 2 unauthorized access tests

**Usage:**
1. Run "Sign In" first (saves `authToken`, `userId`, `enterpriseId`)
2. Run other requests in any order
3. Check responses for `success: true` and expected data

**Variables:**
- `baseUrl` - Default: `http://localhost:8383`
- `authToken` - Auto-set after Sign In
- `userId` - Auto-set after Sign In
- `enterpriseId` - Auto-set after Sign In (if user has enterprise)

## Test Scenarios

### Activity Log Endpoints

#### 1. Get Activities by Action
```http
GET /api/activity-logs/action/view?limit=10
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, count: number, activities: [...] }`

#### 2. Get Activities by Resource
```http
GET /api/activity-logs/resource/enterprise?limit=10
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, count: number, activities: [...] }`

#### 3. Get Activities by User
```http
GET /api/activity-logs/user/{userId}?limit=10
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, userId: string, count: number, activities: [...] }`

#### 4. Get Activities by Enterprise
```http
GET /api/activity-logs/enterprise/{enterpriseId}?limit=10
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, enterpriseId: string, count: number, activities: [...] }`

#### 5. Get Activities by Time Range
```http
GET /api/activity-logs/time-range?startTime=2024-01-01T00:00:00.000Z&endTime=2024-12-31T23:59:59.999Z&limit=10
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, count: number, timeRange: {...}, activities: [...] }`

#### 6. Export Activities (CSV)
```http
GET /api/activity-logs/export?limit=100
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Content-Type: `text/csv`
- Body: CSV format with headers

### Enterprise CRUD Endpoints

#### 1. Get All Enterprises
```http
GET /api/enterprise
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, data: [...] }`
- Note: Returns only user's enterprise (filtered)

#### 2. Get Enterprise by ID
```http
GET /api/enterprise/{enterpriseId}
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, data: { enterprise: {...} } }`
- Authorization: User must have access to this enterprise

#### 3. Get Enterprise Stats
```http
GET /api/enterprise/{enterpriseId}/stats
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, data: { stats: { totalUsers, activeUsers, departments, lastActivity } } }`

#### 4. Update Enterprise
```http
PUT /api/enterprise/{enterpriseId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "description": "Updated description",
  "industry": "Technology",
  "website": "https://example.com"
}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, message: "Enterprise updated successfully", data: { enterprise: {...} } }`
- Authorization: User must be enterprise admin

#### 5. Delete Enterprise
```http
DELETE /api/enterprise/{enterpriseId}
Authorization: Bearer {token}
```

**Expected:**
- Status: `200`
- Response: `{ success: true, message: "Enterprise deleted successfully", data: { id: string } }`
- ⚠️ **WARNING:** Destructive operation - use with caution

### Authorization Tests

#### Unauthorized Access (No Token)
```http
GET /api/enterprise/{enterpriseId}
```

**Expected:**
- Status: `401` or `403`
- Response: Error message

#### Unauthorized Access (Invalid Token)
```http
GET /api/enterprise/{enterpriseId}
Authorization: Bearer invalid_token
```

**Expected:**
- Status: `401` or `403`
- Response: Error message

#### Access Denied (Wrong Enterprise)
```http
GET /api/enterprise/different-enterprise-id
Authorization: Bearer {token}
```

**Expected:**
- Status: `403`
- Response: `{ success: false, message: "Access denied to enterprise" }`

## Common Issues & Solutions

### Issue: "User not found" or "No enterpriseId"
**Solution:** 
- Ensure test user has `enterpriseRef` or `enterpriseId` in user document
- Check user document in Firestore: `users/{userId}`
- Verify `plan: 'enterprise'` and `role: 'admin'`

### Issue: "Access denied to enterprise"
**Solution:**
- User's `enterpriseRef.id` must match requested `enterpriseId`
- Check user document: `users/{userId}.enterpriseRef.id`
- Ensure user has `role: 'admin'` for update/delete operations

### Issue: "Missing required index" (Firestore)
**Solution:**
- Activity log queries may require Firestore indexes
- Check error message for index creation URL
- Create index in Firebase Console
- Code includes fallback queries (client-side sorting) if index missing

### Issue: Empty activity logs
**Solution:**
- Activity logs are created when operations are performed
- Run some enterprise operations first (update, view, etc.)
- Check `activityLogs` collection in Firestore

### Issue: Authentication fails
**Solution:**
- Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `.env`
- Ensure user exists in Firebase Auth
- Check user's email is verified
- Verify server is running on correct port

## Verification Checklist

After running tests, verify:

- [ ] All activity log endpoints return `success: true`
- [ ] Enterprise CRUD endpoints return `success: true`
- [ ] Authorization checks work (401/403 for unauthorized)
- [ ] Activity logs are created for operations
- [ ] Enterprise updates persist in Firestore
- [ ] Stats endpoint returns correct user counts
- [ ] CSV export generates valid CSV format
- [ ] No breaking changes to existing payment flow

## Next Steps

After Phase 1 testing passes:
1. Review test results
2. Fix any issues found
3. Document any edge cases
4. Proceed to Phase 2 integration

## Notes

- **No Dummy Data:** All tests use real data from Firestore (Golden Rule #3)
- **Cement/Poop Principle:** Existing payment flow remains untouched
- **Activity Logging:** All operations create activity log entries
- **Authorization:** Users can only access their own enterprise
