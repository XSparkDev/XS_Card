# Apple Receipt Validation Implementation Guide

## Overview
This implementation adds direct Apple receipt validation with production-first, sandbox fallback strategy as required by Apple's App Store guidelines (Guideline 2.1).

## Architecture

### Files Created
1. **`backend/services/appleReceiptValidation.js`** - Core validation logic
2. **`backend/controllers/appleReceiptController.js`** - Request handling
3. **`backend/routes/appleReceiptRoutes.js`** - Route definition
4. **`backend/test-apple-receipt-validation.js`** - Testing script

### Files Modified
1. **`backend/server.js`** - Added route registration

## How It Works

### Validation Flow
```
1. App makes purchase → Receives receipt from Apple
2. App sends receipt to: POST /api/apple-receipt/validate
3. Backend validates with Apple's production servers
4. If error 21007 (sandbox receipt) → Retry with sandbox servers
5. Return validation result to app
```

### Production-First Strategy
```javascript
try {
  // Step 1: Try production
  result = validateWithApple(receipt, 'production');
  if (result.status === 0) return success;
  
  // Step 2: If error 21007, try sandbox
  if (result.status === 21007) {
    result = validateWithApple(receipt, 'sandbox');
    if (result.status === 0) return success;
  }
  
  return failure;
} catch (error) {
  return error;
}
```

## API Endpoint

### POST /api/apple-receipt/validate

**Authentication:** Required (user must be logged in)

**Request Body:**
```json
{
  "receiptData": "base64_encoded_receipt_data"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "environment": "production",
  "receipt": { /* receipt info */ },
  "latest_receipt_info": [ /* subscription info */ ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Receipt validation failed",
  "status": 21002,
  "environment": "production"
}
```

## Configuration

### Environment Variable Required
Add to your `.env` file:
```bash
APPSTORE_SHARED_SECRET=your_shared_secret_from_app_store_connect
```

### How to Get Shared Secret
1. Go to App Store Connect
2. Navigate to your app
3. Go to "App Information"
4. Find "App-Specific Shared Secret"
5. Generate if not already done
6. Copy and add to `.env`

## Testing

### 1. Test Configuration
```bash
cd backend
node test-apple-receipt-validation.js
```

This will verify:
- ✅ APPSTORE_SHARED_SECRET is set
- ✅ Service can connect to Apple's servers
- ✅ Error handling works correctly

### 2. Test with Real Receipt
After making a test purchase in your app:
```bash
# Use curl or Postman
POST http://localhost:8383/api/apple-receipt/validate
Headers: Authorization: Bearer <your_token>
Body: {
  "receiptData": "<actual_receipt_from_app>"
}
```

### 3. Test Production → Sandbox Fallback
- Use a sandbox receipt from your test device
- Backend will try production first (gets error 21007)
- Then automatically retries with sandbox
- Check logs for "Error 21007 - retrying with sandbox"

## Apple Status Codes

| Code | Meaning |
|------|---------|
| 0 | Valid receipt |
| 21000 | The App Store could not read the JSON object you provided |
| 21002 | The data in the receipt-data property was malformed |
| 21003 | The receipt could not be authenticated |
| 21005 | The receipt server is not currently available |
| 21007 | **Sandbox receipt sent to production** (triggers fallback) |
| 21008 | Production receipt sent to sandbox |

## Integration with RevenueCat

This implementation **complements** RevenueCat, it doesn't replace it:

1. **RevenueCat handles the purchase flow** ✅
2. **RevenueCat manages subscription state** ✅
3. **Apple validation provides backup verification** ✅

### When to Use Direct Validation
- As a backup when RevenueCat webhook fails
- During App Store review (Apple expects this)
- For additional security/verification layer

### Optional: Add to RevenueCat Webhook
You can optionally add receipt validation to your RevenueCat webhook handler:

```javascript
// In backend/controllers/revenueCatController.js
const handleRevenueCatWebhook = async (req, res) => {
  try {
    // ... existing webhook logic ...
    
    // Optional: Validate receipt directly with Apple as backup
    if (eventData.receipt) {
      const appleValidation = await validateReceipt(eventData.receipt);
      console.log('Apple validation result:', appleValidation);
    }
    
    // ... rest of webhook logic ...
  } catch (error) {
    // ... error handling ...
  }
};
```

## Logging

The implementation includes comprehensive logging:

```
[Apple Receipt] Starting validation - trying production first
[Apple Receipt] Validating with production environment
[Apple Receipt] Response status: 21007
[Apple Receipt] Error 21007 - retrying with sandbox
[Apple Receipt] Validating with sandbox environment
[Apple Receipt] Response status: 0
[Apple Receipt] ✅ Valid receipt (sandbox)
```

## Security

✅ **Authentication Required** - Endpoint requires user authentication
✅ **Shared Secret Protection** - Stored in environment variables
✅ **Direct Apple Communication** - No third-party intermediaries
✅ **Production-First Strategy** - Follows Apple's recommended approach

## Compliance

This implementation satisfies Apple's requirements:

✅ **Guideline 2.1** - Receipt validation with production/sandbox fallback
✅ **Error 21007 Handling** - Automatic sandbox retry
✅ **Server-Side Validation** - All validation happens on backend
✅ **Independent of RevenueCat** - Meets Apple's direct validation requirement

## Troubleshooting

### Issue: "APPSTORE_SHARED_SECRET not configured"
**Solution:** Add the shared secret to your `.env` file

### Issue: "Receipt validation failed" with status 21002
**Solution:** Receipt data is malformed or not base64 encoded correctly

### Issue: "Receipt validation failed" with status 21003
**Solution:** Receipt is not valid or has been tampered with

### Issue: All validations fail
**Solution:** 
1. Check internet connectivity
2. Verify shared secret is correct
3. Ensure receipt data is properly encoded
4. Check Apple's system status

## Next Steps

1. ✅ **Configuration Complete** - Add `APPSTORE_SHARED_SECRET` to `.env`
2. ✅ **Test Locally** - Run `node test-apple-receipt-validation.js`
3. ✅ **Deploy to Production** - Ensure environment variable is set on server
4. ✅ **Test with Real Purchase** - Make test purchase and validate receipt
5. ✅ **Monitor Logs** - Check for successful production/sandbox fallback
6. ✅ **Submit to App Store** - Apple will test receipt validation during review

## Support

For issues or questions:
- Check logs in console (comprehensive logging included)
- Verify environment variables are set correctly
- Test with the provided test script
- Review Apple's receipt validation documentation

