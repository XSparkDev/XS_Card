# ============================================
# APPLICATION CONFIGURATION
# ============================================

#APP_URL=http://192.168.68.106:8383
#APP_URL=https://xscard-app-8ign.onrender.com
#APP_URL=http://localhost:8383
#APP_URL=https://baseurl.xscard.co.za
#APP_URL=https://apistaging.xscard.co.za
#APP_URL=https://846084eede03.ngrok-free.app
API_BASE_URL=https://846084eede03.ngrok-free.app
NODE_ENV=development
PORT=8383

# WebSocket Configuration
SOCKET_IO_CORS_ORIGIN=*
SOCKET_IO_PORT=8383
WEBSOCKET_ENABLED=true


# ============================================
# OAUTH CONFIGURATION
# ============================================

# LINKEDIN_CLIENT_ID=77tprijl6otowg
# LINKEDIN_CLIENT_SECRET=<redacted>

LINKEDIN_CLIENT_ID=77xb2xng5rgwh0
LINKEDIN_CLIENT_SECRET=<redacted>


GOOGLE_WEB_CLIENT_ID=21153373630-u2fvkuach1visn6vtgo9gi4eaghqfrun.apps.googleusercontent.com


MICROSOFT_CLIENT_ID=df8a6c6f-3e38-44ec-b86f-3c46b371bc5a
MICROSOFT_CLIENT_SECRET=<redacted>
# MICROSOFT_TENANT_ID=43011e09-95a1-44bb-933e-431e9275d08e
MICROSOFT_REDIRECT_URI=https://846084eede03.ngrok-free.app/oauth/microsoft/callback
MICROSOFT_TENANT_ID=common
MICROSOFT_AUTH_ENDPOINT=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
MICROSOFT_TOKEN_ENDPOINT=https://login.microsoftonline.com/common/oauth2/v2.0/token

# ============================================
# PAYSTACK CONFIGURATION (Legacy - Android/Web)
# ============================================

# Passcreator Configuration
PASSCREATOR_API_KEY=<redacted>
PASSCREATOR_BASE_URL=https://app.passcreator.com
PASSCREATOR_TEMPLATE_ID=2e06f305-b6b6-46c1-a300-4ebbe49862c3

DEV_PASSCREATOR_PUBLIC_URL=http://192.168.68.112:8383
PROD_PASSCREATOR_PUBLIC_URL=https://xscard-app-8ign.onrender.com

# ============================================
# DEV FIREBASE CONFIGURATION
# ============================================



# FIREBASE_TYPE=service_account
# FIREBASE_PROJECT_ID=xscard-addd4
# FIREBASE_PRIVATE_KEY_ID=2f43afd277c2c0291c01c31fb5c7ad82845db91d
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<redacted>\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@xscard-addd4.iam.gserviceaccount.com
# FIREBASE_CLIENT_ID=112618487762885449363
# FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
# FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
# FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
# FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40xscard-addd4.iam.gserviceaccount.com
# FIREBASE_UNIVERSE_DOMAIN=googleapis.com
# FIREBASE_DATABASE_URL=https://xscard-addd4.firebaseio.com
# FIREBASE_WEB_API_KEY=<redacted>
# FIREBASE_STORAGE_BUCKET=xscard-addd4.firebasestorage.app
# # Firebase Auth Endpoints
# FIREBASE_AUTH_SIGNIN_URL=https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword
# FIREBASE_AUTH_SIGNUP_URL=https://identitytoolkit.googleapis.com/v1/accounts:signUp



FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=xscard-dev
FIREBASE_PRIVATE_KEY_ID=bd84b717c6e85cd728c0a0a122c5d802489c5114
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRtYWoVUNA4tUw\nYBYTuSgq6DTooKUTyA8yg37rJk8I5MSme/kcdeluHVgQDxJtiLQabGoxyL1DT5sJ\noeWUl5Bo1D9sVRYiD7cxV/HQpzFsR9zTCvbXIN4znf+ahxQI3JAqBMDCgq2BnM4E\nmMZRxjxZcKJP0j1hGGNqwzPg1VVJQIG6+A29qDZbP/BwEpDaYCTNScr+5CnCSNWm\n8msJ9tOFMtFvxDB+EY9N60zgTY3yOV/8pmMt0iYCJcKU4shwxc7J1z13YkTEym0q\nTcBDGVHfN0Dp8UwBQtVQ19HIjFFZatbXyIc+WhiD3nR+lHJ1POZZvtnCKcy2/KH9\n/bmZ4UcHAgMBAAECggEACJaijq5PPs0LZhvJS619k6RG5nAN0q2S0cLI4+CBxB96\nXkcdgKjjknrpLF8xpgK/PYXLI5bRCXytIMvclyVN6L0oi8tASMzT99VeNeljAMhA\npvP///d8oiiKW03E6EgAL3haXJz1diVx2oZXOOohdphCTXqSwPM6vxiXe1HBWGqU\n4RxRhvSIU+lLeZsGeByEDsYgCfV2ofhnCOZKL+40ubFjJlhR4WbpBfil0ESGLAuM\ngYxu+BP/AuxjAtfj4XnBtN0B78kR/v4YPb30C2UcypPp1VjY1FCoCgt3QLrpeCil\nlt4Eloz3EkE/Hv3EKb1i9v/SHhO9eXp0ltpUKTbVwQKBgQD3BXTWOrHNSUSl3aQE\nQr+twWrYP32h0SIfc9yPNYugOlbWBt0gfKgSpW6JyDD/aFLkfc6xFBMPBbzHYStq\n0gLuc63wHyVLw5NhrurCX2jn0FA9Ze/M+3S6cEbOqRuZtElPHo29IrFtbx/2QpMX\ngQMV/3tYmGPqRqXqW2Y/Eht2uQKBgQDZVN+stSByLzQyQnSleTO3NaFBVTHTJ8z1\naF8ymsWO3eywRp3KBeo1nIA3XtnwiPkf03NOeZtQUSo6OezmdKNJxIsV8tk522+V\nOe/72mwau0hDG/oKKqu8AKlOQ3ptVlYDYeYk2wioGm/Eyv2e6WU9bjfz0difLND8\n8m7AArfLvwKBgAHuCPujecAg0mh5Us61tsmkuTD3TgP1nk6gmRiFUpHt4r/JTfDz\nCF0c7cAl0DwulHc0hGjdv0hewxrLp4suGNfED5fQpnnxDTW2KB9cn3UwK3BPW5A+\nZqsONX9n0s9gmTIFCxZvLvOr6pQB8SQ93chONqh6iE1MP/+UtzfG7HABAoGANJ4a\n5VqY92w8S+rRCPsWLUY7u3Cf9oqNUeEqIztbl2JdmrQOIcpa0Q4J8N3zEAxpnG36\nXcaNdt2fxqcdlxIoMoT2U6MPOrXJBy0W0DgqsjIjpbPRTsLT/1l9pCgsLOqZOopq\nSQQKzYBRDSlETEQfscbMnyhwNOGJ26Pqcmx2CUsCgYEAtg3xTeolswkfByNyirqo\n1ljMbfyBRTyUKzR1ze0sKPSowtOo/g07NpX/JfxIONgFtJNTagZrHUIoz+OF8uvj\nW0b6m2W7tPBrHtbnVJc0y5NmmfEouTV/jfByngbuITpNvfXYm2Bz0YQbW2lrx+n1\ncxzcq08lW1TFCUGhjetu+30=\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@xscard-dev.iam.gserviceaccount.com"
FIREBASE_CLIENT_ID=102465102525210043166
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40xscard-dev.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=21153373630-u2fvkuach1visn6vtgo9gi4eaghqfrun.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_SECRET=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
# FIREBASE_DATABASE_URL=https://xscard-addd4.firebaseio.com
FIREBASE_DATABASE_URL=
FIREBASE_WEB_API_KEY=AIzaSyDxc-9wwCcy26XHQNEfDpybBANHKVhADL8
FIREBASE_STORAGE_BUCKET=xscard-dev.firebasestorage.app

# Firebase Auth Endpoints
FIREBASE_AUTH_SIGNIN_URL=https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword
FIREBASE_AUTH_SIGNUP_URL=https://identitytoolkit.googleapis.com/v1/accounts:signUp

# ============================================
# PAYSTACK CONFIGURATION (Legacy - Android/Web)
# ============================================

#PAYSTACK_MONTHLY_PLAN_CODE=PLN_25xliarx7epm9ct
#PAYSTACK_ANNUAL_PLAN_CODE=PLN_kzb7lj21vrehzeq
#WEBHOOK_SECRET=sk_test_f2a50b16ec0dc4a89a5e8038a2b10739f7d109ac
#PAYSTACK_BASE_URL=api.paystack.co
#PAYSTACK_PORT=443
#PAYSTACK_TIMEOUT=30000

# ============================================
# EMAIL CONFIGURATION
# ============================================

EMAIL_USER=xscard@xspark.co.za
EMAIL_PASSWORD=kKr0BWbK7$&Q
EMAIL_HOST=srv144.hostserv.co.za
EMAIL_SMTP_PORT=465
EMAIL_FROM_NAME=XS Card
EMAIL_FROM_ADDRESS=xscard@xspark.co.za


# ============================================
# HCAPTCHA CONFIGURATION
# ============================================
HCAPTCHA_SECRET_KEY=<redacted>


# ============================================
# REVENUECAT CONFIGURATION (iOS & Android IAP)
# ============================================

REVENUECAT_SECRET_KEY=<redacted>
REVENUECAT_IOS_PUBLIC_KEY=<redacted>
REVENUECAT_ANDROID_PUBLIC_KEY=<redacted>
REVENUECAT_IOS_MONTHLY_PRODUCT_ID=Premium_Monthly
REVENUECAT_IOS_ANNUAL_PRODUCT_ID=Premium_Annually
REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=premium_monthly:monthly-autorenewing
REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID=premium_annual:annual-autorenewing
REVENUECAT_ENTITLEMENT_ID=entl52399c68fe
REVENUECAT_WEBHOOK_AUTH_TOKEN=<redacted>
APPSTORE_SHARED_SECRET=<redacted>


# ============================================
# DATA PURGING CONFIGURATION
# ============================================

INACTIVE_USERS_CHECK_INTERVAL_MINUTES=259200

# ============================================
# OAUTH CONFIGURATION
# ============================================
# LinkedIn OAuth - Get from https://www.linkedin.com/developers/

# ============================================
# RATE_LIMIT CONFIGURATION
# ============================================

# Rate Limiting Configuration
SUBSCRIPTION_RATE_LIMIT=5
SUBSCRIPTION_RATE_WINDOW_MS=900000
WEBHOOK_RATE_LIMIT=100
WEBHOOK_RATE_WINDOW_MS=60000
API_RATE_LIMIT=1000
API_RATE_WINDOW_MS=900000

# ============================================
# MISC CONFIGURATION
# ============================================

# Development Mode Settings

SKIP_BANK_VERIFICATION=true

# Subscription Configuration
SUBSCRIPTION_VERIFICATION_AMOUNT=100
SUBSCRIPTION_TRIAL_DAYS=0
SUBSCRIPTION_TRIAL_MINUTES=3

FREE_TIER_NAME=Free
PREMIUM_TIER_NAME=Premium
ENTERPRISE_TIER_NAME=Enterprise

EVENT_BASE_PRICE=5000
PREMIUM_DISCOUNT_RATE=0.2
FREE_MONTHLY_CREDITS=0
PREMIUM_MONTHLY_CREDITS=5
ENTERPRISE_MONTHLY_CREDITS=12

# Payment Retry Configuration
PAYMENT_RETRY_ATTEMPT_1_DELAY_MINUTES=2    # 2 minutes for testing (1 day in production)
PAYMENT_RETRY_ATTEMPT_2_DELAY_MINUTES=5    # 5 minutes for testing (3 days in production)
PAYMENT_RETRY_ATTEMPT_3_DELAY_MINUTES=8    # 8 minutes for testing (7 days in production)

# Production values (commented for reference)
# PAYMENT_RETRY_ATTEMPT_1_DELAY_MINUTES=1440  # 1 day (24 * 60 minutes)
# PAYMENT_RETRY_ATTEMPT_2_DELAY_MINUTES=4320  # 3 days (72 * 60 minutes)
# PAYMENT_RETRY_ATTEMPT_3_DELAY_MINUTES=10080 # 7 days (168 * 60 minutes)

TRIAL_CHECK_INTERVAL_MINUTES=1

# Development Testing Configuration
ENABLE_DEV_TESTING=true



////////////////////////


# # Firebase Configuration
# EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyA1cmFJD61yxZ36hEOXF48r145ZdWA3Pjo
# EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xscard-addd4.firebaseapp.com
# EXPO_PUBLIC_FIREBASE_PROJECT_ID=xscard-addd4
# EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=xscard-addd4.firebasestorage.app
# EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=628567737496
# EXPO_PUBLIC_FIREBASE_APP_ID=1:628567737496:web:627d89a8a52ab35d4a7ced
# EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=21153373630-u2fvkuach1visn6vtgo9gi4eaghqfrun.apps.googleusercontent.com


# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDxc-9wwCcy26XHQNEfDpybBANHKVhADL8
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xscard-dev.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xscard-dev
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=xscard-dev.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=21153373630
EXPO_PUBLIC_FIREBASE_APP_ID=1:21153373630:web:90ffd7577a0a89a4bbadef

# LinkedIn
#EXPO_PUBLIC_LINKEDIN_CLIENT_ID=77tprijl6otowg
EXPO_PUBLIC_LINKEDIN_CLIENT_ID=77xb2xng5rgwh0

# Google
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=21153373630-u2fvkuach1visn6vtgo9gi4eaghqfrun.apps.googleusercontent.com

#M icrosoft
EXPO_PUBLIC_MICROSOFT_CLIENT_ID=df8a6c6f-3e38-44ec-b86f-3c46b371bc5a

# EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
# EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com



IAP_APP_SHARED_SECRET=3e0bffc872b342e0b59f4cf985dce8f6
REVENUECAT_IOS_PUBLIC_KEY=appl_wtSPChhISOCRASiRWkuJSHTCVIF
REVENUECAT_ANDROID_PUBLIC_KEY=goog_ihpOFcAHowZqiJQjlYFeimTNnES



ENABLE_DEVELOPMENT_TESTING=true
# OAuth Backend Configuration
EXPO_PUBLIC_API_BASE_URL=https://846084eede03.ngrok-free.app
