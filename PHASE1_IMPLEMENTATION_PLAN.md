# Phase 1 Implementation Plan

**Phase:** Foundation Layer  
**Duration:** 1-2 weeks  
**Priority:** CRITICAL  
**Status:** Ready to Implement

---

## Overview

Phase 1 implements the foundation layer for enterprise features:
1. **Core Enterprise Management** - CRUD operations for enterprises
2. **Activity Logging** - Foundation for security and audit trails

These features have **no dependencies** and can be integrated independently.

---

## Part 1: Core Enterprise Management

### 1.1 Objectives
- Add enterprise CRUD operations to existing `enterpriseController.js`
- Enable enterprise admins to update their company information
- Maintain compatibility with existing payment/subscription flow

### 1.2 Files to Modify/Create

#### Modify: `backend/controllers/enterpriseController.js`
**Current Status:**
- ✅ Handles payment/subscription operations
- ✅ Creates `enterprise` document during payment (atomic with `enterprise_accounts`)
- ❌ No CRUD operations for enterprise management

**What to Add:**
1. `getAllEnterprises` - List all enterprises (admin function)
2. `getEnterpriseById` - Get enterprise details
3. `updateEnterprise` - Update enterprise information
4. `deleteEnterprise` - Delete enterprise (with validation)
5. `getEnterpriseStats` - Enterprise statistics (placeholder)

**Implementation Notes:**
- **DO NOT modify** existing payment/subscription code (CEMENT)
- Add new methods to the same file (POOP alongside CEMENT)
- Use same response format: `{ status: true/false, message, data }`
- Add activity logging to all operations
- Validate user has access to enterprise (enterprise admin only)

#### Create: `backend/middleware/enterpriseAuth.js` (if needed)
**Purpose:** Middleware to verify user has access to enterprise
- Check if user's `enterpriseRef` matches requested `enterpriseId`
- Check user role (admin only for update/delete)
- Return 403 if access denied

**Note:** May reuse existing authentication middleware if it handles this.

### 1.3 Routes to Add

#### Modify: `backend/routes/enterpriseRoutes.js`
**Add routes:**
```javascript
// Enterprise CRUD operations
router.get('/api/enterprise', authenticateUser, enterpriseController.getAllEnterprises);
router.get('/api/enterprise/:enterpriseId', authenticateUser, enterpriseController.getEnterpriseById);
router.put('/api/enterprise/:enterpriseId', authenticateUser, enterpriseController.updateEnterprise);
router.delete('/api/enterprise/:enterpriseId', authenticateUser, enterpriseController.deleteEnterprise);
router.get('/api/enterprise/:enterpriseId/stats', authenticateUser, enterpriseController.getEnterpriseStats);
```

**Note:** 
- `createEnterprise` route NOT needed (we create during payment)
- All routes require authentication
- Consider adding enterprise authorization middleware

### 1.4 Data Structure

**Enterprise Document Schema:**
```javascript
{
  name: string,                    // Company name
  description: string,             // Company description
  industry: string,               // Industry type
  website: string,                 // Company website
  logoUrl: string,                // Logo URL
  colorScheme: string,             // Brand color scheme
  companySize: string,            // Company size (from quote)
  address: {                       // Company address
    street: string,
    city: string,
    province: string,
    country: string,
    postalCode: string
  },
  numberOfEmployees: number,       // From quote
  contactEmail: string,            // From quote
  contactName: string,             // From quote
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Note:** 
- Fields like `numberOfEmployees`, `contactEmail`, `contactName` are set during payment
- Optional fields (`description`, `industry`, `website`, `logoUrl`, `colorScheme`, `address`) can be updated later

### 1.5 Validation Rules

**Update Enterprise:**
- `name`: 1-200 characters (if provided)
- `description`: Max 1000 characters (if provided)
- `website`: Valid URL format (if provided)
- `logoUrl`: Valid URL format (if provided)
- `colorScheme`: Valid hex color (if provided)
- `address`: Object with valid structure (if provided)
- At least one field must be provided for update

**Delete Enterprise:**
- Only enterprise admin can delete
- Check if enterprise has active subscription (warn if active)
- Check if enterprise has departments/employees (warn if exists)
- Soft delete option? (mark as deleted, don't actually delete)

### 1.6 Activity Logging

**Log all operations:**
- `CREATE` action for enterprise creation (already done during payment)
- `READ` action for `getEnterpriseById`
- `UPDATE` action for `updateEnterprise`
- `DELETE` action for `deleteEnterprise`
- `VIEW` action for `getAllEnterprises` and `getEnterpriseStats`

**Use:** `logActivity` from `utils/logger.js` (to be created in Part 2)

---

## Part 2: Activity Logging

### 2.1 Objectives
- Create activity logging utility (`utils/logger.js`)
- Create activity log controller (`controllers/activityLogController.js`)
- Add routes for querying activity logs
- Foundation for security alerts system (Phase 3)

### 2.2 Files to Create

#### Create: `backend/utils/logger.js`
**Purpose:** Core logging utility for all activities

**Exports:**
- `logActivity(data)` - Log activity to Firestore
- `ACTIONS` - Action type constants
- `RESOURCES` - Resource type constants
- `getActivitiesByAction(action, options)` - Query by action
- `getActivitiesByResource(resource, options)` - Query by resource

**Structure:**
```javascript
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'export',
  SEND: 'send',
  VERIFY: 'verify',
  VIEW: 'view',
  // ... other actions
};

const RESOURCES = {
  USER: 'user',
  ENTERPRISE: 'enterprise',
  DEPARTMENT: 'department',
  TEAM: 'team',
  EMPLOYEE: 'employee',
  CONTACT: 'contact',
  SUBSCRIPTION: 'subscription',
  PAYMENT: 'payment',
  EMAIL: 'email',
  SYSTEM: 'system',
  // ... other resources
};

async function logActivity(data) {
  // Log to 'activityLogs' collection
  // Structure:
  // {
  //   timestamp: Timestamp,
  //   action: string,
  //   resource: string,
  //   status: 'success' | 'error',
  //   userId: string,
  //   resourceId: string | null,
  //   enterpriseId: string | null,
  //   departmentId: string | null,
  //   details: object,
  //   ip: string | null
  // }
}
```

**Implementation Notes:**
- Use Firestore `activityLogs` collection
- Include error handling (don't fail if logging fails)
- Support optional fields (enterpriseId, departmentId, ip)
- Use server timestamp for consistency

#### Create: `backend/controllers/activityLogController.js`
**Purpose:** Controller for querying activity logs

**Methods:**
1. `getByAction` - Get activities by action type
2. `getByResource` - Get activities by resource type
3. `getByUser` - Get activities by user ID
4. `getByEnterprise` - Get activities by enterprise ID
5. `getByTimeRange` - Get activities in time range
6. `exportActivities` - Export activities to CSV

**Query Options:**
- `userId` - Filter by user
- `resource` - Filter by resource type
- `status` - Filter by status (success/error)
- `startTime` - Start of time range
- `endTime` - End of time range
- `limit` - Result limit (default: 50)
- `order` - Order direction (asc/desc, default: desc)

**Response Format:**
```javascript
{
  success: true,
  count: number,
  activities: Array<Activity>,
  filters: object,
  timestamp: string
}
```

### 2.3 Routes to Add

#### Modify: `backend/routes/enterpriseRoutes.js` (or create `activityLogRoutes.js`)
**Add routes:**
```javascript
// Activity Log routes
router.get('/api/activity-logs/action/:action', authenticateUser, activityLogController.getByAction);
router.get('/api/activity-logs/resource/:resource', authenticateUser, activityLogController.getByResource);
router.get('/api/activity-logs/user/:userId', authenticateUser, activityLogController.getByUser);
router.get('/api/activity-logs/enterprise/:enterpriseId', authenticateUser, activityLogController.getByEnterprise);
router.get('/api/activity-logs/time-range', authenticateUser, activityLogController.getByTimeRange);
router.get('/api/activity-logs/export', authenticateUser, activityLogController.exportActivities);
```

**Note:**
- All routes require authentication
- Add enterprise authorization (users can only see their enterprise's logs)
- Consider rate limiting for export endpoint

### 2.4 Data Structure

**Activity Log Document Schema:**
```javascript
{
  timestamp: Timestamp,           // When activity occurred
  action: string,                 // Action type (from ACTIONS)
  resource: string,               // Resource type (from RESOURCES)
  status: 'success' | 'error',    // Operation status
  userId: string,                 // User who performed action
  resourceId: string | null,      // ID of affected resource
  enterpriseId: string | null,    // Enterprise ID (if applicable)
  departmentId: string | null,    // Department ID (if applicable)
  details: object,                // Additional context
  ip: string | null               // IP address (if available)
}
```

### 2.5 Firestore Indexes Required

**Composite Indexes:**
1. `activityLogs`: `action` + `timestamp` (descending)
2. `activityLogs`: `resource` + `timestamp` (descending)
3. `activityLogs`: `userId` + `timestamp` (descending)
4. `activityLogs`: `enterpriseId` + `timestamp` (descending)
5. `activityLogs`: `enterpriseId` + `action` + `timestamp` (descending)
6. `activityLogs`: `enterpriseId` + `resource` + `timestamp` (descending)

**Note:** Include fallback queries if indexes are missing (similar to other server pattern)

---

## Integration Steps

### Step 1: Create Activity Logging Utility
1. Create `backend/utils/logger.js`
2. Implement `logActivity`, `getActivitiesByAction`, `getActivitiesByResource`
3. Export `ACTIONS` and `RESOURCES` constants
4. Test logging functionality

### Step 2: Create Activity Log Controller
1. Create `backend/controllers/activityLogController.js`
2. Implement all query methods
3. Add error handling and fallback queries
4. Add activity logging to controller operations (meta-logging)

### Step 3: Add Activity Log Routes
1. Add routes to `backend/routes/enterpriseRoutes.js` (or create separate file)
2. Add authentication middleware
3. Add enterprise authorization (if needed)
4. Test routes

### Step 4: Add Enterprise CRUD Operations
1. Add methods to `backend/controllers/enterpriseController.js`
2. Add activity logging to all operations
3. Add validation
4. Add enterprise authorization checks

### Step 5: Add Enterprise CRUD Routes
1. Add routes to `backend/routes/enterpriseRoutes.js`
2. Add authentication middleware
3. Add enterprise authorization middleware (if needed)
4. Test routes

### Step 6: Integration Testing
1. Test enterprise CRUD operations
2. Test activity logging
3. Test enterprise authorization
4. Test error handling
5. Test with real data (Rule #3: No Dummy Data)

### Step 7: Update Documentation
1. Update `ENTERPRISE_INTEGRATION_TRACKER.md`
2. Document new endpoints
3. Document activity log structure
4. Document required Firestore indexes

---

## Testing Checklist

### Enterprise CRUD Operations
- [ ] `getAllEnterprises` - Returns list of enterprises
- [ ] `getEnterpriseById` - Returns enterprise details
- [ ] `updateEnterprise` - Updates enterprise successfully
- [ ] `updateEnterprise` - Validates input fields
- [ ] `updateEnterprise` - Rejects unauthorized users
- [ ] `deleteEnterprise` - Deletes enterprise (with validation)
- [ ] `deleteEnterprise` - Rejects if active subscription
- [ ] `getEnterpriseStats` - Returns statistics (placeholder)

### Activity Logging
- [ ] `logActivity` - Logs activity successfully
- [ ] `logActivity` - Handles missing fields gracefully
- [ ] `getByAction` - Returns activities by action
- [ ] `getByResource` - Returns activities by resource
- [ ] `getByUser` - Returns activities by user
- [ ] `getByEnterprise` - Returns activities by enterprise
- [ ] `getByTimeRange` - Returns activities in time range
- [ ] `exportActivities` - Exports to CSV
- [ ] Fallback queries work if indexes missing

### Integration
- [ ] Enterprise operations log activities
- [ ] Activity logs include correct enterpriseId
- [ ] Authorization works correctly
- [ ] Error handling works
- [ ] No breaking changes to existing payment flow

---

## Dependencies

### External Dependencies
- ✅ Firebase Admin SDK (already installed)
- ✅ Express.js (already installed)
- ⚠️ `csv-stringify` or `json2csv` (for export - may need to install)

### Internal Dependencies
- ✅ `firebase.js` - Firebase connection
- ✅ Authentication middleware (existing)
- ⚠️ Enterprise authorization middleware (may need to create)

### Firestore Collections
- `enterprise` - Enterprise documents (already exists)
- `activityLogs` - Activity log documents (to be created)

---

## Notes

1. **Cement/Poop Principle:** 
   - Existing payment code = CEMENT (don't modify)
   - New CRUD operations = POOP (build alongside)

2. **No Dummy Data:**
   - Use real enterprise documents for testing
   - Use real activity logs for testing

3. **Activity Logging:**
   - Log all enterprise operations
   - Include enterpriseId in logs
   - Support filtering by enterprise

4. **Authorization:**
   - Enterprise admins can update/delete their enterprise
   - Regular users can view their enterprise
   - System admins can view all enterprises

5. **Error Handling:**
   - Comprehensive error logging
   - User-friendly error messages
   - Graceful degradation if logging fails

---

## Success Criteria

✅ Enterprise admins can update their company information  
✅ Activity logs are created for all enterprise operations  
✅ Activity logs can be queried by action, resource, user, enterprise, time range  
✅ No breaking changes to existing payment/subscription flow  
✅ All tests pass  
✅ Documentation updated  

---

**Ready to implement when you give explicit permission.**
