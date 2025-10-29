# hCaptcha Production Fix

## Issue
The contact form is failing in production because it's receiving `BYPASSED_FOR_DEV` tokens but the system is trying to verify them with the real hCaptcha service.

## Root Cause
The frontend is sending development bypass tokens (`BYPASSED_FOR_DEV`) in production, but the backend was only checking for `NODE_ENV === 'development'` which is not set in production.

## Fix Applied
Updated the `verifyCaptchaEnvironmentAware` function to:

1. **Properly handle bypass tokens**: Only allow `BYPASSED_FOR_DEV` in development environments
2. **Reject bypass tokens in production**: If a bypass token is received in production, it's rejected
3. **Added better logging**: To help debug environment issues
4. **Improved environment detection**: Check multiple environment variables

## Changes Made

### 1. Updated Captcha Verification Logic
```javascript
// Handle bypass token - should only work in development or when explicitly allowed
if (token === BYPASS_TOKEN) {
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       process.env.NODE_ENV === 'dev' || 
                       process.env.ALLOW_CAPTCHA_BYPASS === 'true';
  
  if (isDevelopment) {
    console.log('Bypassing captcha for development environment');
    return true;
  } else {
    console.log('Bypass token received in production - rejecting');
    return false;
  }
}
```

### 2. Added Debug Logging
```javascript
console.log('Environment check - NODE_ENV:', process.env.NODE_ENV);
console.log('Environment check - ALLOW_CAPTCHA_BYPASS:', process.env.ALLOW_CAPTCHA_BYPASS);
console.log('Captcha token received:', captchaToken);
```

## Next Steps

### For Production:
1. **Deploy the updated backend code**
2. **Ensure frontend sends real hCaptcha tokens in production**
3. **Set environment variables if needed**:
   ```bash
   NODE_ENV=production
   HCAPTCHA_SECRET_KEY=your_real_secret_key
   ```

### For Development:
1. **Keep using bypass tokens in development**
2. **Set environment variables**:
   ```bash
   NODE_ENV=development
   # OR
   ALLOW_CAPTCHA_BYPASS=true
   ```

## Testing
After deployment, test the contact form:
1. **Development**: Should work with `BYPASSED_FOR_DEV` tokens
2. **Production**: Should work with real hCaptcha tokens from the frontend

## Environment Variables
Make sure these are set correctly:

**Production:**
```bash
NODE_ENV=production
HCAPTCHA_SECRET_KEY=your_production_secret
```

**Development:**
```bash
NODE_ENV=development
# OR
ALLOW_CAPTCHA_BYPASS=true
```
