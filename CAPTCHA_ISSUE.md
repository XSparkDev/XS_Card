# Captcha Verification Issue

## Problem
The sales enquiry form is returning the error: `"{"success":false,"message":"Captcha verification failed. Please try again."}"` even though the hCaptcha widget passes verification on the frontend.

## Root Cause
The issue is that the backend server is not properly configured to verify hCaptcha tokens. The frontend correctly generates and sends the captcha token, but the backend fails to verify it with hCaptcha's API.

## Current Flow
1. Frontend: hCaptcha widget generates a token when verified
2. Frontend: Token is sent to backend via `/submit-query` endpoint
3. Backend: Receives token but fails to verify it with hCaptcha API
4. Backend: Returns "Captcha verification failed" error

## Solutions

### Option 1: Fix Backend (Recommended)
The backend needs to be updated to properly verify hCaptcha tokens. The backend should:

1. **Add hCaptcha Secret Key**: Set the `HCAPTCHA_SECRET_KEY` environment variable on the backend
2. **Implement Token Verification**: Add server-side verification logic similar to:

```javascript
// Backend verification example
const verifyCaptcha = async (token) => {
  const response = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.HCAPTCHA_SECRET_KEY,
      response: token,
    }),
  });
  
  const data = await response.json();
  return data.success === true;
};
```

### Option 2: Temporary Frontend Bypass (Development Only)
For testing purposes, you can temporarily bypass captcha verification by:

1. Using the `submitQueryWithoutCaptcha` function in `utils/api.ts`
2. Modifying the form submission to not require captcha verification

### Option 3: Remove Captcha (Not Recommended for Production)
Remove captcha verification entirely, but this reduces security.

## Files Affected
- `utils/api.ts`: Contains the API submission logic
- `components/ui/hcaptcha.tsx`: hCaptcha widget component
- `app/page.tsx`: Form submission handlers

## Testing
To test if the backend is working:
1. Check the health endpoint: `GET /health`
2. Test with a simple form submission without captcha
3. Verify backend logs for captcha verification attempts

## Next Steps
1. **Immediate**: Contact backend developer to fix hCaptcha verification
2. **Short-term**: Use temporary bypass for testing if needed
3. **Long-term**: Ensure proper captcha verification is implemented

## Environment Variables Needed
- `HCAPTCHA_SECRET_KEY`: Backend environment variable for hCaptcha verification
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`: Frontend environment variable (already configured) 