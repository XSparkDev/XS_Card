# Phase 1 Allowed Tests

**Phase:** Foundation Layer  
**Purpose:** List of all tests allowed for Phase 1 implementation  
**Rule:** Exclude tests for dependent features (departments, teams, security alerts, etc.)

---

## Test Categories

### ✅ Allowed Tests

#### 1. Enterprise CRUD Operations Tests

##### 1.1 `getAllEnterprises` Tests
- ✅ Test: Returns list of all enterprises
- ✅ Test: Returns empty array if no enterprises exist
- ✅ Test: Requires authentication
- ✅ Test: Returns correct enterprise data structure
- ✅ Test: Handles database errors gracefully
- ✅ Test: Filters by enterprise (if user is not admin)

##### 1.2 `getEnterpriseById` Tests
- ✅ Test: Returns enterprise details for valid ID
- ✅ Test: Returns 404 for non-existent enterprise
- ✅ Test: Requires authentication
- ✅ Test: Returns correct enterprise data structure
- ✅ Test: Handles database errors gracefully
- ✅ Test: User can only access their own enterprise (authorization)

##### 1.3 `updateEnterprise` Tests
- ✅ Test: Updates enterprise successfully
- ✅ Test: Updates single field (name only)
- ✅ Test: Updates multiple fields
- ✅ Test: Validates required fields (if any)
- ✅ Test: Validates field formats (website URL, email, etc.)
- ✅ Test: Returns 404 for non-existent enterprise
- ✅ Test: Requires authentication
- ✅ Test: Rejects unauthorized users (not enterprise admin)
- ✅ Test: Updates `updatedAt` timestamp
- ✅ Test: Handles database errors gracefully
- ✅ Test: Activity log created for update operation

##### 1.4 `deleteEnterprise` Tests
- ✅ Test: Deletes enterprise successfully
- ✅ Test: Returns 404 for non-existent enterprise
- ✅ Test: Requires authentication
- ✅ Test: Rejects unauthorized users (not enterprise admin)
- ✅ Test: Warns if enterprise has active subscription
- ✅ Test: Warns if enterprise has departments/employees
- ✅ Test: Handles database errors gracefully
- ✅ Test: Activity log created for delete operation

##### 1.5 `getEnterpriseStats` Tests
- ✅ Test: Returns enterprise statistics
- ✅ Test: Returns 404 for non-existent enterprise
- ✅ Test: Requires authentication
- ✅ Test: Returns correct statistics structure (placeholder)
- ✅ Test: Handles database errors gracefully

#### 2. Activity Logging Utility Tests

##### 2.1 `logActivity` Tests
- ✅ Test: Logs activity successfully
- ✅ Test: Creates log entry with correct structure
- ✅ Test: Handles missing required fields gracefully
- ✅ Test: Handles optional fields (enterpriseId, departmentId, ip)
- ✅ Test: Uses server timestamp
- ✅ Test: Handles Firestore errors gracefully (doesn't throw)
- ✅ Test: Returns boolean (true/false) for success/failure

##### 2.2 `getActivitiesByAction` Tests
- ✅ Test: Returns activities by action type
- ✅ Test: Filters by userId (if provided)
- ✅ Test: Filters by resource (if provided)
- ✅ Test: Filters by status (if provided)
- ✅ Test: Filters by time range (if provided)
- ✅ Test: Orders by timestamp (descending by default)
- ✅ Test: Applies limit (default: 50)
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Returns empty array if no matches
- ✅ Test: Handles database errors gracefully

##### 2.3 `getActivitiesByResource` Tests
- ✅ Test: Returns activities by resource type
- ✅ Test: Filters by userId (if provided)
- ✅ Test: Filters by action (if provided)
- ✅ Test: Filters by status (if provided)
- ✅ Test: Filters by time range (if provided)
- ✅ Test: Orders by timestamp (descending by default)
- ✅ Test: Applies limit (default: 50)
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Returns empty array if no matches
- ✅ Test: Handles database errors gracefully

#### 3. Activity Log Controller Tests

##### 3.1 `getByAction` Tests
- ✅ Test: Returns activities by action type
- ✅ Test: Validates action parameter (must be valid ACTIONS value)
- ✅ Test: Supports query parameters (userId, resource, status, limit, order, startTime, endTime)
- ✅ Test: Returns correct response structure
- ✅ Test: Requires authentication
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Activity log created for view operation (meta-logging)

##### 3.2 `getByResource` Tests
- ✅ Test: Returns activities by resource type
- ✅ Test: Validates resource parameter (must be valid RESOURCES value)
- ✅ Test: Supports query parameters (userId, action, status, limit, order, startTime, endTime)
- ✅ Test: Returns correct response structure
- ✅ Test: Requires authentication
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Activity log created for view operation (meta-logging)

##### 3.3 `getByUser` Tests
- ✅ Test: Returns activities by user ID
- ✅ Test: Validates userId parameter
- ✅ Test: Supports query parameters (action, resource, status, limit, order, startTime, endTime)
- ✅ Test: Returns correct response structure
- ✅ Test: Requires authentication
- ✅ Test: User can only see their own activities (authorization)
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Activity log created for view operation (meta-logging)

##### 3.4 `getByEnterprise` Tests
- ✅ Test: Returns activities by enterprise ID
- ✅ Test: Validates enterpriseId parameter
- ✅ Test: Supports query parameters (action, resource, status, limit, order, startTime, endTime)
- ✅ Test: Returns correct response structure
- ✅ Test: Requires authentication
- ✅ Test: User can only see their enterprise's activities (authorization)
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Activity log created for view operation (meta-logging)

##### 3.5 `getByTimeRange` Tests
- ✅ Test: Returns activities in time range
- ✅ Test: Validates startTime and endTime parameters
- ✅ Test: Supports query parameters (action, resource, userId, enterpriseId, status, limit, order)
- ✅ Test: Returns correct response structure
- ✅ Test: Requires authentication
- ✅ Test: Handles missing indexes (fallback query)
- ✅ Test: Activity log created for view operation (meta-logging)

##### 3.6 `exportActivities` Tests
- ✅ Test: Exports activities to CSV format
- ✅ Test: Supports same filters as query endpoints
- ✅ Test: Returns CSV file with correct headers
- ✅ Test: Requires authentication
- ✅ Test: Handles large datasets (pagination/chunking)
- ✅ Test: Activity log created for export operation (meta-logging)

#### 4. Integration Tests

##### 4.1 Enterprise Operations + Activity Logging
- ✅ Test: Enterprise update creates activity log
- ✅ Test: Enterprise delete creates activity log
- ✅ Test: Activity log includes correct enterpriseId
- ✅ Test: Activity log includes correct userId
- ✅ Test: Activity log includes correct action type
- ✅ Test: Activity log includes correct resource type

##### 4.2 Authorization Tests
- ✅ Test: Enterprise admin can update their enterprise
- ✅ Test: Enterprise admin can delete their enterprise
- ✅ Test: Regular user cannot update enterprise
- ✅ Test: Regular user cannot delete enterprise
- ✅ Test: User can only view their enterprise's activity logs
- ✅ Test: User can only view their own activity logs

##### 4.3 Error Handling Tests
- ✅ Test: Database errors are handled gracefully
- ✅ Test: Missing indexes trigger fallback queries
- ✅ Test: Invalid parameters return 400 errors
- ✅ Test: Unauthorized access returns 403 errors
- ✅ Test: Not found resources return 404 errors

#### 5. Regression Tests

##### 5.1 Existing Payment Flow
- ✅ Test: Payment callback still works
- ✅ Test: Enterprise document creation during payment still works
- ✅ Test: Enterprise account creation still works
- ✅ Test: Quote generation still works
- ✅ Test: Subscription webhook handling still works

##### 5.2 Existing User Registration
- ✅ Test: User registration still works
- ✅ Test: Enterprise user linking still works
- ✅ Test: Email verification still works

---

## ❌ Excluded Tests (Dependent Features)

### Department Management Tests
- ❌ Department CRUD operations
- ❌ Employee management within departments
- ❌ Department hierarchy
- ❌ Department cache invalidation

### Team Management Tests
- ❌ Team CRUD operations
- ❌ Team member management
- ❌ Team leader assignment

### Contact Aggregation Tests
- ❌ Contact aggregation queries
- ❌ Cache hit/miss scenarios
- ❌ Cache invalidation
- ❌ Cache warming

### Security Alerts Tests
- ❌ Security alert detection
- ❌ Security alert creation
- ❌ Security alert resolution
- ❌ Security log queries
- ❌ Security actions (password reset, account lock)

### Permissions Management Tests
- ❌ Individual permissions
- ❌ Calendar permissions
- ❌ Permission inheritance

### Data Export Tests (for dependent features)
- ❌ Export departments
- ❌ Export teams
- ❌ Export employees
- ✅ Export activities (allowed - part of activity logging)

### Enterprise Email Interface Tests
- ❌ Email sending with attachments
- ❌ Email activity logs (separate from activity logging)

---

## Test Data Requirements

### Real Data (Rule #3: No Dummy Data)
- ✅ Use real enterprise documents from Firestore
- ✅ Use real user documents from Firestore
- ✅ Use real activity logs from Firestore
- ✅ Use real enterprise_accounts documents

### Test Enterprise Setup
- ✅ Create test enterprise (or use existing)
- ✅ Create test enterprise admin user
- ✅ Create test regular user
- ✅ Link users to enterprise

### Test Activity Logs Setup
- ✅ Create test activity logs with various actions
- ✅ Create test activity logs with various resources
- ✅ Create test activity logs with various time ranges
- ✅ Create test activity logs for different enterprises

---

## Test Execution Order

1. **Unit Tests:**
   - Activity logging utility (`logActivity`, `getActivitiesByAction`, `getActivitiesByResource`)
   - Enterprise CRUD operations (individual methods)

2. **Integration Tests:**
   - Enterprise operations + activity logging
   - Authorization checks
   - Error handling

3. **Controller Tests:**
   - Activity log controller endpoints
   - Enterprise controller endpoints

4. **Regression Tests:**
   - Existing payment flow
   - Existing user registration

5. **End-to-End Tests:**
   - Full enterprise update flow
   - Full activity log query flow

---

## Test Tools & Framework

### Recommended
- **Jest** or **Mocha** for test framework
- **Supertest** for API endpoint testing
- **Firebase Emulator** for local Firestore testing (optional)
- **Real Firestore** for integration testing (Rule #3)

### Test Structure
```javascript
describe('Enterprise CRUD Operations', () => {
  describe('getEnterpriseById', () => {
    it('should return enterprise details for valid ID', async () => {
      // Test implementation
    });
    // ... more tests
  });
  // ... more describe blocks
});
```

---

## Success Criteria

✅ All allowed tests pass  
✅ No tests for excluded features  
✅ Tests use real data (no mocks/dummies)  
✅ Tests cover happy path and error cases  
✅ Tests verify activity logging  
✅ Tests verify authorization  
✅ Regression tests confirm no breaking changes  

---

**Note:** This list may be updated as implementation progresses. Always follow Rule #1 (Never Make Assumptions) and Rule #3 (No Dummy or Mock Data).
