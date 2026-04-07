# Proxies

## Overview
This project uses the term "proxy" in two different ways:

1. Reverse-proxy awareness in the backend, especially for hosted HTTPS environments
2. Backend-mediated proxy flows for OAuth, where the mobile app talks to the backend and the backend talks to the external OAuth provider

There is no dedicated standalone proxy server inside the repo. Instead, the backend is written to behave correctly when it is deployed behind a reverse proxy such as:

- Render
- Heroku-style routing
- nginx
- other platforms that terminate TLS before traffic reaches Node

## Reverse proxy support in the backend

### Trust proxy
The backend explicitly enables Express proxy trust:

```js
// backend/server.js
app.set('trust proxy', 1);
```

This is important because, behind a reverse proxy, the incoming request to Node may appear as plain HTTP even when the end user used HTTPS. Without proxy trust, generated public URLs can be wrong.

### Public base URL resolution
The main reverse-proxy helper is:

- `backend/utils/publicBaseUrl.js`

It builds a public-facing base URL from forwarded headers:

```js
function getPublicBaseUrl(req) {
  const protoRaw = req.get('x-forwarded-proto') || req.protocol || 'https';
  const proto = String(protoRaw).split(',')[0].trim();
  const hostRaw = req.get('x-forwarded-host') || req.get('host') || '';
  const host = String(hostRaw).split(',')[0].trim();
  if (!host) {
    return `${proto}://localhost`;
  }
  return `${proto}://${host}`;
}
```

This logic protects URL generation when the request passes through a proxy that sets:

- `x-forwarded-proto`
- `x-forwarded-host`

## Why reverse-proxy handling matters here
Several features generate public URLs that must be correct outside the Node process.

### Wallet pass URLs
`backend/controllers/cardController.js` uses `getPublicBaseUrl(req)` to generate:

- Apple Wallet `.pkpass` URLs
- public save-contact URLs used by wallet passes

That is important because Safari / Wallet behavior can break if those links are generated with `http://` instead of `https://`.

### Hosted public routes
Public pages such as:

- `/saveContact`
- `/public/calendar/...`

also depend on accurate external URLs when shared or embedded in downstream flows.

## Backend as an OAuth proxy

### What this means
The mobile app does not complete OAuth directly against Google, LinkedIn, or Microsoft entirely on-device. Instead, it starts the flow through the backend.

Relevant files:

- `src/services/oauth/googleProvider.ts`
- `backend/routes/oauthRoutes.js`
- `backend/controllers/oauthController.js`

### App side
The app opens a backend route such as:

- `/oauth/google/start`

That provider file explicitly describes the flow as backend proxying:

```ts
/**
 * Google OAuth Provider
 *
 * Implements Google OAuth authentication via backend proxy.
 * Backend handles Google OAuth (requires https redirect URIs).
 * App receives Firebase custom token via deep link.
 */
```

### Backend side
The backend then:

1. receives the start request from the app
2. redirects the browser to the OAuth provider
3. receives the provider callback
4. exchanges the code for tokens
5. creates a Firebase custom token
6. redirects back into the app via `com.p.zzles.xscard://...`

This is proxy behavior in the application-flow sense: the backend stands between the app and the external identity provider.

## Proxy-related headers and security
Some backend logic also reads the effective client address through proxy-aware headers. For example, `backend/utils/webhookSecurity.js` checks:

- `req.ip`
- `req.connection.remoteAddress`
- `req.headers['x-forwarded-for']`

In development mode it explicitly tolerates tunneling/proxy-like origins such as:

- `ngrok`
- `tunnel`
- `localhost`

This matters for local webhook testing.

## Interaction with ngrok
When ngrok is used, it effectively becomes an external tunnel in front of the local backend. In that setup:

- mobile app can call a public ngrok URL
- third-party services can send callbacks/webhooks to your local machine
- proxy and forwarded-header handling becomes important for correct public URL generation

This is why ngrok and reverse-proxy support overlap in this codebase.

## What is not a proxy here
To avoid confusion:

- `src/utils/api.ts` is an API base URL helper, not a proxy
- Metro / Expo dev server is not acting as the backend API proxy in this architecture
- there is no separate BFF gateway or edge proxy service checked into this repo

## Summary
In this repository, proxies matter in three practical ways:

1. The backend must correctly understand forwarded HTTPS/host information when deployed behind a reverse proxy
2. Wallet and public URL generation relies on that proxy-aware base URL handling
3. OAuth is intentionally implemented through a backend proxy flow rather than direct provider calls from the app

If any of those proxy assumptions break, common symptoms include:

- wrong `http://` URLs in wallet/browser flows
- broken callback URLs
- app links opening the wrong host
- failures when moving between localhost, ngrok, staging, and production
