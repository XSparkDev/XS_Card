# Backend hCaptcha Implementation Guide

## Overview
The frontend is correctly generating and sending hCaptcha tokens, but the backend `/submit-query` endpoint is rejecting them with "Captcha verification failed" errors. The backend needs to implement proper hCaptcha server-side verification.

## What the Frontend is Sending

The frontend sends POST requests to `/submit-query` with this structure:
```json
{
  "name": "John Doe",
  "email": "john@example.com", 
  "message": "Contact form content...",
  "to": "xscard@xspark.co.za",
  "type": "contact", // or "inquiry" for sales forms
  "captchaToken": "P1_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." // hCaptcha token
}
```

## What the Backend Must Implement

### 1. Environment Variable
Add this environment variable to your backend:
```bash
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key_here
```

### 2. hCaptcha Verification Function
```javascript
async function verifyHCaptcha(token) {
  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();
    console.log('hCaptcha verification result:', data);
    
    return data.success === true;
  } catch (error) {
    console.error('hCaptcha verification error:', error);
    return false;
  }
}
```

### 3. Update `/submit-query` Endpoint
```javascript
app.post('/submit-query', async (req, res) => {
  try {
    const { name, email, message, to, type, captchaToken } = req.body;

    // Verify captcha if token is provided
    if (captchaToken) {
      const isCaptchaValid = await verifyHCaptcha(captchaToken);
      
      if (!isCaptchaValid) {
        return res.status(400).json({
          success: false,
          message: "Captcha verification failed. Please try again."
        });
      }
      
      console.log('✅ Captcha verification passed');
    } else {
      // If no captcha token provided, you may want to reject or allow based on your security requirements
      console.log('⚠️ No captcha token provided');
    }

    // Your existing email/form processing logic here
    // ... process the form submission ...

    res.json({
      success: true,
      message: "Form submitted successfully"
    });

  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});
```

## Expected Behavior After Implementation

### Success Case
- **Frontend sends**: Valid hCaptcha token
- **Backend verifies**: Token with hCaptcha API
- **Backend responds**: `{"success": true, "message": "Form submitted successfully"}`

### Failure Cases
- **Invalid token**: `{"success": false, "message": "Captcha verification failed. Please try again."}`
- **No token**: Handle based on your security requirements
- **Network error**: `{"success": false, "message": "Internal server error"}`

## Testing Instructions

### 1. Test Health Endpoint
Ensure your `/health` endpoint is working:
```bash
curl https://xscard-app.onrender.com/health
```

### 2. Test with Valid Token
The frontend will automatically send valid tokens when forms are submitted.

### 3. Verify Logs
Add logging to see:
- Incoming captcha tokens (first 20 characters only for security)
- hCaptcha API responses
- Verification results

## What Frontend Expects from Backend

### Success Response
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "data": {} // optional
}
```

### Error Response
```json
{
  "success": false,
  "message": "Captcha verification failed. Please try again."
}
```

## What Backend Should Expect from Frontend

### Request Headers
```
Content-Type: application/json
Accept: application/json
```

### Request Body
Always includes these fields:
- `name`: string
- `email`: string  
- `message`: string (formatted content)
- `to`: string (always "xscard@xspark.co.za")
- `type`: string ("contact" or "inquiry")
- `captchaToken`: string (hCaptcha token) or undefined

## Security Notes

1. **Never log full captcha tokens** - only log first 20 characters
2. **Always verify server-side** - never trust frontend-only verification
3. **Handle network failures gracefully** - return appropriate error messages
4. **Rate limiting recommended** - prevent spam even with valid captcha

## Environment Setup Checklist

- [ ] `HCAPTCHA_SECRET_KEY` environment variable set
- [ ] hCaptcha verification function implemented
- [ ] `/submit-query` endpoint updated
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] Testing completed

## Debugging Tips

1. **Log hCaptcha API responses** to see exact error details
2. **Verify secret key** is correct and matches your hCaptcha account
3. **Check network connectivity** to hCaptcha API from your server
4. **Test with curl** to isolate backend issues

## What to Expect from Frontend

### Current Status
- ✅ Frontend correctly generates hCaptcha tokens
- ✅ Frontend sends properly formatted requests
- ✅ Frontend handles responses correctly
- ❌ Backend rejects valid tokens

### After Backend Fix
- ✅ Forms will submit successfully
- ✅ Users will see success messages
- ✅ No changes needed on frontend

## What Frontend Expects from Backend

### Immediate Response
- **Success**: `{"success": true, "message": "Form submitted successfully"}`
- **Failure**: `{"success": false, "message": "Captcha verification failed. Please try again."}`

### No Changes Needed
The frontend code is complete and working. Once the backend implements proper hCaptcha verification, the forms will work immediately without any frontend changes.

## Implementation Priority

1. **High Priority**: Implement hCaptcha verification on `/submit-query` endpoint
2. **Medium Priority**: Add proper error logging and debugging
3. **Low Priority**: Add rate limiting and additional security measures

The frontend is working correctly and will continue sending properly formatted requests with valid hCaptcha tokens. Once you implement the server-side verification, the forms should work immediately. 