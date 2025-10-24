# Environment-Aware Captcha Verification Implementation

## Overview
The `/submit-query` endpoint now supports environment-aware captcha verification for development and production environments.

## Implementation Details

### New Function: `verifyCaptchaEnvironmentAware(token)`
- **Location**: `backend/server.js` (lines 868-908)
- **Purpose**: Handles captcha verification with environment-specific logic
- **Returns**: `Promise<boolean>`

### Supported Token Types

1. **Development Bypass**: `BYPASSED_FOR_DEV`
   - Always returns `true` in development
   - Can be forced with `ALLOW_CAPTCHA_BYPASS=true` environment variable

2. **Dummy hCaptcha Token**: `10000000-aaaa-bbbb-cccc-000000000001`
   - Verified using dummy secret: `0x0000000000000000000000000000000000000000`
   - Used for frontend testing with hCaptcha test site

3. **Real hCaptcha Token**: Any other token
   - Verified using `process.env.HCAPTCHA_SECRET_KEY`
   - Used in production with real hCaptcha verification

### Updated `/submit-query` Endpoint

**Changes Made**:
- Replaced `verifyHCaptcha()` with `verifyCaptchaEnvironmentAware()`
- Updated field validation to require `to` field
- Simplified response messages to match frontend expectations
- Removed IP-based rate limiting for this endpoint

**Request Format**:
```json
{
  "name": "string",
  "email": "string", 
  "message": "string",
  "to": "string",
  "type": "contact" | "inquiry",
  "captchaToken": "string"
}
```

**Response Format**:
- **Success**: `200 { "success": true, "message": "Submitted" }`
- **Captcha Failure**: `400 { "success": false, "message": "Captcha verification failed. Please try again." }`
- **Missing Fields**: `400 { "success": false, "message": "Missing required fields (name, email, message, to)" }`
- **Server Error**: `500 { "success": false, "message": "Internal server error" }`

## Testing

### Test Script
- **File**: `backend/test-captcha-environment.js`
- **Usage**: `node test-captcha-environment.js`
- **Tests**: Bypass tokens, dummy tokens, enterprise inquiries, validation errors

### Manual Testing with curl

**Development Bypass**:
```bash
curl -X POST http://localhost:8383/submit-query \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"t@e.com","message":"Hi","to":"support@xscard.co.za","type":"contact","captchaToken":"BYPASSED_FOR_DEV"}'
```

**Dummy Token**:
```bash
curl -X POST http://localhost:8383/submit-query \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"t@e.com","message":"Hi","to":"support@xscard.co.za","type":"contact","captchaToken":"10000000-aaaa-bbbb-cccc-000000000001"}'
```

## Environment Variables

- `HCAPTCHA_SECRET_KEY`: Real hCaptcha secret for production verification
- `ALLOW_CAPTCHA_BYPASS`: Set to `true` to force bypass all captcha verification
- `EMAIL_USER`: System email address for sending emails

## Frontend Integration

The frontend can now send any of these captcha tokens:
- `BYPASSED_FOR_DEV` - For development bypass
- `10000000-aaaa-bbbb-cccc-000000000001` - For hCaptcha test site
- Real hCaptcha token - For production verification

All tokens will be handled appropriately by the backend without frontend changes needed.


