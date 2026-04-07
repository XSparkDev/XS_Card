# Ngrok API Implementation

## Purpose
This project uses `ngrok` as a development tunnel when local services need to be reachable from outside the developer machine. In this codebase, that mainly applies to:

- OAuth callback URLs during local development
- webhook testing against a locally running backend
- temporary mobile-device testing when `localhost` is not reachable

It is not implemented as a standalone runtime service inside the app. Instead, the app and backend are configured to consume an externally started `ngrok` URL.

## Where ngrok appears

### Root app environment
The mobile app reads its API base URL from `EXPO_PUBLIC_API_BASE_URL` in the root `.env`.

Typical examples already present in the repo:

- `http://localhost:8383`
- `https://<subdomain>.ngrok-free.app`

The app API layer resolves the base URL here:

```ts
// src/utils/api.ts
const getBaseUrl = () => {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) return envBaseUrl;
  return 'https://apistaging.xscard.co.za';
};
```

This means switching between local, ngrok, staging, and production is done through environment configuration, not by changing fetch logic throughout the app.

### Backend environment
The backend uses `APP_URL` in `backend/.env` for public callback-style URLs such as payment and OAuth redirects.

Examples in `backend/.env` show the intended pattern:

- `http://localhost:8383`
- `https://<subdomain>.ngrok-free.app`
- hosted staging/production domains

### OAuth flow
The frontend OAuth providers are intentionally backend-mediated rather than direct-from-app. For example:

- `src/services/oauth/googleProvider.ts`
- `backend/routes/oauthRoutes.js`
- `backend/controllers/oauthController.js`

Flow:

1. App opens `${EXPO_PUBLIC_API_BASE_URL}/oauth/google/start`
2. Backend redirects to the provider
3. Provider redirects back to the backend callback URL
4. Backend creates a Firebase custom token
5. Backend redirects back into the app using the app scheme `com.p.zzles.xscard://...`

The backend callback URLs depend on a public base URL. During local development, that public base URL is typically an ngrok address.

## Webhook and tunnel-aware behavior
Some webhook/dev tooling explicitly acknowledges tunnel traffic. For example, `backend/utils/webhookSecurity.js` allows tunneling services in development mode:

- accepts clients containing `ngrok`
- accepts clients containing `tunnel`
- accepts `localhost`

There are also test scripts that target live ngrok endpoints, for example:

- `backend/test-live-server-webhook.js`
- `backend/test-live-server-webhook-fixed.js`
- `backend/test-webhook-fixes-final.js`

Those scripts are not the implementation itself; they are validation tools for externally exposed dev endpoints.

## How to use ngrok in this project

### Local backend over ngrok
If the backend runs on port `8383`, start a tunnel such as:

```bash
ngrok http 8383
```

Then update:

- root `.env` -> `EXPO_PUBLIC_API_BASE_URL=https://<your-ngrok-domain>.ngrok-free.app`
- `backend/.env` -> `APP_URL=https://<your-ngrok-domain>.ngrok-free.app`

Restart both:

```bash
# backend
cd backend
node server.js

# app / metro
cd ..
npx expo start --dev-client --clear
```

### When ngrok is needed
Use ngrok when:

- testing OAuth on a real device
- testing webhooks from third-party services
- exposing a local backend to cloud callback providers

Do not use ngrok when:

- testing only in the iOS simulator with a local backend
- your backend is already deployed and reachable through staging/production

For the iOS simulator, `http://localhost:8383` is usually simpler and more stable.

## Common failure modes

### Offline ngrok endpoint
If Metro or the app still points to an expired ngrok domain, you may see errors similar to:

- HTML 404 pages from `*.ngrok-free.app`
- `ERR_NGROK_3200`
- runtime `Network request failed`

This usually means:

- the ngrok process stopped
- the generated URL changed
- Metro is still using stale env values from before restart

### Physical device + localhost
On a real phone, `localhost` points to the phone itself, not your Mac. If you are not using ngrok, you must use your machine's LAN IP instead.

### Stale Expo env
Expo reads `EXPO_PUBLIC_*` values when Metro starts. If you change `.env`, restart Metro with cache clear so the new ngrok URL is picked up.

## Summary
Ngrok in this repo is a development exposure layer, not a bundled dependency. The implementation pattern is:

- app chooses backend through `EXPO_PUBLIC_API_BASE_URL`
- backend chooses public callback host through `APP_URL`
- OAuth and webhook testing rely on those public URLs
- test scripts and security helpers recognize ngrok during development
