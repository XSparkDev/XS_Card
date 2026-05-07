# Centralized XS Card Conference Lifecycle Plan

## Purpose
This document refines `backend/Centralized_XS_Card_Strategy.md` into an implementation-focused plan for this codebase.

It is intentionally stricter than the original strategy in three ways:

1. It separates what already exists in this repo from assumptions about an external conference app.
2. It defines a single source of truth and avoids introducing overlapping status fields.
3. It organizes the work into phases that can be shipped safely without breaking existing registration or subscription flows.

## Current Repo Reality

### What this repo already does
- Creates users through `AddUser` in `backend/controllers/userController.js`.
- Completes profile setup and creates the initial card through `UploadImages` in `backend/controllers/userController.js`.
- Supports premium upgrades through `upgradeToPremium` in `backend/controllers/userController.js`.
- Stores user data in the `users` collection and card data in the `cards` collection.
- Has existing subscription logic and scheduled jobs that already use fields like `plan` and `subscriptionStatus`.
- Has an events platform already in place with:
  - `events`
  - `event_registrations`
  - `tickets`
  - attendee listing
  - QR check-in
  - organiser-facing event flows

### What the original strategy assumes but this repo does not currently contain
The original strategy references:
- `mirror-registration`
- a Supabase `registrations` table
- organiser reads from Supabase
- a legacy SQLite fallback in `server/index.ts`
- `src/templates/Templates.tsx`

Those items are not present in this repo. For this implementation plan, treat them as external conference-system dependencies or prior architecture, not as code that can be edited here directly.

## Main Recommendation

### Use XS Card Firestore as the system of record
The XS Card backend should own:
- the user
- the user card/profile
- conference definitions through `events`
- attendee registration metadata through `event_registrations`
- conference premium entitlement state
- activation state
- inactivity and cleanup lifecycle

This should not be split across multiple operational databases for the same attendee lifecycle.

### Use events as the conference model
Because this repo already has a working events system, the cleanest direction is:

- model a conference as an event, or as a family of conference-scoped events
- use `event_registrations` as the attendee ledger
- use `tickets` for check-in and access operations
- keep `users` and `cards` as identity/profile records

This is a better fit than creating a second "conference registration" architecture beside the events system.

### Keep one meaning for subscription state
This codebase already uses:
- `plan`
- `subscriptionStatus`

Because those fields already drive premium access and jobs in the existing backend, the conference flow should extend that model rather than invent a second independent premium state such as `premium_status`.

Recommended rule:
- Keep `plan` and `subscriptionStatus` as the entitlement fields used by the live product.
- Add conference-specific lifecycle fields separately.

## Recommended Data Model

### Keep core identity and entitlement in `users`
Use the `users/{userId}` document for:
- `uid`
- `email`
- `name`
- `surname`
- `plan`
- `subscriptionStatus`
- `trialStartDate` or premium timestamps where needed
- `phone`
- `company`
- `occupation`

### Store conference/event lifecycle on registrations, not as one flat user field
If conferences will be created through the events system, then the lifecycle record should be attached to the attendee's registration for that event.

Recommended structure:

```text
event_registrations/{registrationId} {
  eventId,
  userId,
  status,
  registeredAt,
  ticketId,
  userInfo,
  conferenceMeta: {
    conferenceCode,
    registrationSource,
    premiumGranted,
    premiumGrantedAt,
    premiumExpiresAt,
    activationStatus,
    firstLoginAt,
    firstAuthenticatedAt,
    deviceRegisteredAt,
    lastSeenAt,
    remindersSent,
    cleanupStatus,
    cleanupDueAt,
    cleanupReason,
    photoConsent,
    photographyConsent,
    headshotAssetRef
  }
}
```

### Why attach lifecycle to `event_registrations`
This is the right long-term shape if:
- a user can attend more than one conference
- one user can register for multiple conference events over time
- organisers need attendee lifecycle per conference, not one global flag on the user

Use `users` for identity and entitlement.
Use `event_registrations` for conference participation lifecycle.

## Field Semantics

Use the following meanings consistently:

- `plan`: access tier used by the product, for example `free`, `premium`, `enterprise`
- `subscriptionStatus`: entitlement state used by the current subscription system, for example `trial`, `active`, `cancelled`, `expired`
- `conferenceMeta.activationStatus`: lifecycle state for conference adoption within a specific event registration, for example `registered_only`, `activated`, `inactive`, `scheduled_for_cleanup`, `deleted`

This is the key simplification:
- entitlement state answers "what should the user be allowed to do?"
- activation state answers "has the conference registrant actually adopted the app?"

## Registration Flow We Should Actually Implement

### Step 1: Create the user as today
Keep the existing registration entry point:
- `AddUser`

This already creates the base `users/{userId}` document.

### Step 2: Complete profile and create card as today
Keep the current profile completion flow:
- `UploadImages`

This currently:
- updates phone, company, occupation, and alternate phone on `users`
- creates the first card in `cards/{userId}`

### Step 3: Register the user into the conference event
After the user and base profile exist, register the user into the conference through the existing event registration domain.

Preferred outcome:
- `users/{userId}` remains the canonical identity record
- the conference itself lives in `events/{eventId}`
- the attendee lifecycle lives in `event_registrations/{registrationId}`
- no second operational attendee database is required

For event-backed conferences, the operational moment is not "write conference metadata to user".
It is "create or update the attendee registration for the conference event".

### Step 4: Grant premium immediately using existing fields
Do not invent a parallel premium model.

Instead:
- set `plan = premium`
- set `subscriptionStatus` to the agreed value for conference-granted access
- persist start and expiry timestamps if the policy requires an end date

If conference premium is temporary, choose one of:
- `subscriptionStatus = active` with `premiumExpiresAt` stored under `conferenceRegistration`
- `subscriptionStatus = trial` if conference access should behave like a managed trial

The better option depends on whether conference access should behave like standard billing or a special entitlement.

## Recommended Entitlement Decision

For this codebase, use:
- `plan = premium`
- `subscriptionStatus = active`
- `event_registrations/{registrationId}.conferenceMeta.premiumGrantedAt`
- `event_registrations/{registrationId}.conferenceMeta.premiumExpiresAt`

Why:
- it avoids colliding with the existing trial-expiration logic
- it makes conference users clearly premium in the live product
- it leaves cleanup/revocation to the conference lifecycle instead of pretending this is a normal billing trial

## Activation Tracking

### What we can reliably measure
We should not model "downloaded the app" directly.

Reliable activation signals are:
- first successful sign-in
- first authenticated session
- first device token registration
- first meaningful in-app action

### Recommended activated condition
Mark the user as `activated` when any of the following happens:
- first successful app sign-in
- device token saved
- first authenticated API action after login

Recommended fields:
- `event_registrations/{registrationId}.conferenceMeta.firstLoginAt`
- `event_registrations/{registrationId}.conferenceMeta.firstAuthenticatedAt`
- `event_registrations/{registrationId}.conferenceMeta.deviceRegisteredAt`
- `event_registrations/{registrationId}.conferenceMeta.lastSeenAt`

## API Changes Recommended

### 1. Use the existing event registration path for conference attendee creation
The lowest-risk path is:
- keep `AddUser`
- keep `UploadImages`
- then use the existing event registration flow for conference registration

In practice, the conference journey becomes:
1. create user
2. complete profile/create card
3. register user to the conference event
4. attach conference-specific lifecycle metadata to that registration

The event registration write should accept or derive metadata such as:
- `conferenceCode`
- `registrationSource`
- `photoConsent`
- `photographyConsent`
- `headshotAssetRef`

### 2. Reuse existing organiser and attendee endpoints where possible
Add explicit admin endpoints for:
- list conference attendees by `eventId` or `conferenceCode`
- get attendee activation state
- mark attendee checked in
- update conference lifecycle state
- list inactive users pending cleanup
- revoke conference premium access

Where the existing events platform already provides attendee listing or check-in, extend those endpoints instead of creating duplicates.

### 3. Add lifecycle update hooks on authentication
Wherever sign-in/session creation is confirmed, update:
- the matching conference registration for the active event, if one exists
- `conferenceMeta.firstLoginAt` if missing
- `conferenceMeta.firstAuthenticatedAt` if missing
- `conferenceMeta.lastSeenAt`
- `conferenceMeta.activationStatus = activated`

## Recommended Collection Strategy

### Preferred approach
Use the existing event collections as the conference layer:
- `events` for conference definitions
- `event_registrations` for attendee records
- `tickets` for check-in and access state
- `users` for identity and premium entitlement
- `cards` for XS Card profile presentation

### Conference classification
To phase this in cleanly, introduce a conference marker on events rather than a new top-level conference store.

Recommended event fields:

```text
eventCategory: 'conference'
conferenceCode
conferenceMode: 'conference'
```

That allows the current events system to host standard events and conference events side by side.

## File-Level Impact In This Repo

### `backend/controllers/userController.js`
This still matters for the first half of onboarding because:
- `AddUser` creates the base user
- `uploadUserImages` completes profile data and creates the first card
- `upgradeToPremium` modifies premium entitlement

But with an event-first conference model, this file is no longer the only orchestrator. It should own identity/profile creation, not the full attendee lifecycle by itself.

### `backend/controllers/eventController.js`
This becomes the main conference orchestration layer because it already owns:
- event creation
- registration
- attendee listing
- ticket creation
- check-in

Conference-specific registration metadata and attendee lifecycle should be layered onto this controller and its supporting services.

### `backend/routes/eventRoutes.js`
This is where conference creation, registration, attendee management, and check-in should be phased in through existing event endpoints.

### `backend/routes/userRoutes.js`
User routes should remain focused on:
- identity creation
- profile completion
- premium entitlement helpers where needed
- optional admin utilities that truly belong to users rather than events

### `backend/jobs`
Add or extend scheduled jobs for:
- reminder notifications
- stale `registered_only` detection
- premium revocation if policy requires it
- soft deletion / anonymization

### `src/screens/auth/CompleteProfile.tsx`
This is the current frontend path that finishes registration and uploads user assets/profile fields.
If conference metadata is supplied by the registration frontend, this is a likely client touchpoint for transmitting it.

### `src/utils/api.ts`
This is where any added admin or lifecycle endpoints would be declared for frontend use.

## Cleanup Policy

### Recommended statuses
Use these under `conferenceMeta.activationStatus` on `event_registrations`:
- `registered_only`
- `activated`
- `inactive`
- `scheduled_for_cleanup`
- `deleted`

Use these under `conferenceMeta.cleanupStatus`:
- `none`
- `reminder_sent`
- `scheduled`
- `soft_deleted`
- `hard_deleted`
- `anonymized`

### Recommended timeline
- Day 0: registration completed, premium granted, activation status `registered_only`
- Day 7: first reminder
- Day 14: second reminder
- Day 30: mark `inactive` if no activation evidence exists
- Day 37 or Day 45: soft delete or anonymize according to policy

These thresholds should be configurable per conference or environment.

## Soft Delete Recommendation

Use soft delete first.

Recommended behavior:
1. Keep the user row
2. Mark the registration lifecycle as inactive or scheduled for cleanup
3. Revoke premium if policy requires it
4. Hide the user from normal organiser lists by default
5. Hard-delete or anonymize later after an audit window

This is safer than immediate deletion because:
- users may activate late
- organisers may need recovery
- premium grants and registration records may need to be audited

## Biggest Risks To Avoid

### 1. Duplicating entitlement logic
Do not maintain:
- `plan`
- `subscriptionStatus`
- `premium_status`

all as separate sources of truth.

Use the existing product entitlement fields and add conference metadata on the event registration beside them.

### 2. Mixing conference lifecycle with billing lifecycle
Conference inactivity is not the same thing as subscription cancellation.

Do not let conference cleanup accidentally break normal billing flows for users who later become paying subscribers.

### 3. Creating a second attendee database "temporarily" and never removing it
If a compatibility layer is needed, make it explicitly transitional and give it a removal phase.

### 4. Treating "downloaded app" as measurable when it is not
Track activation based on login/session/device evidence instead.

## Recommended Delivery Phases

### Phase 1: Classify conference events in the existing events platform
- use `events` as the source of truth for conferences
- add event-level markers such as `eventCategory = conference` and `conferenceCode`
- keep non-conference events working exactly as they do today

This phase creates the structural bridge without changing attendee registration yet.

### Phase 2: Route conference attendee onboarding through event registration
- keep `AddUser` and `UploadImages`
- after identity/profile completion, register the user into the conference event
- enrich `event_registrations` with `conferenceMeta`
- grant premium immediately using existing entitlement fields

This is the phase where conference onboarding becomes event-backed.

### Phase 3: Reuse and extend organiser event tooling
- use existing attendee listing by `eventId`
- reuse existing check-in and ticket flows
- extend organiser reads to show conference-specific activation and lifecycle fields
- add conference filters such as `conferenceCode` only where needed

This phase avoids building a second organiser stack.

### Phase 4: Add activation and lifecycle tracking on top of registrations
- update auth/session flow to record activation against the user's conference registration
- mark `conferenceMeta.activationStatus = activated` when evidence appears
- record `lastSeenAt`

This phase makes "registered but never activated" measurable in the event system.

### Phase 5: Add reminder and cleanup jobs driven by `event_registrations`
- reminder scheduling
- inactive detection
- premium revocation if policy requires it
- soft delete / anonymization logic tied to the registration lifecycle

This is where the lifecycle becomes operational instead of informational.

### Phase 6: Remove any external mirrored attendee store
- only after event-backed organiser reads are complete
- only after conference reporting/export is covered by XS Card event APIs
- only after event registrations are the accepted attendee ledger

## Decisions Needed Before Build

Before implementation, confirm these business rules:

1. Is conference premium time-limited?
2. If a conference user never activates, should premium always be revoked?
3. If a user becomes a real paying subscriber later, should conference cleanup still touch that account?
4. Can the same user register for multiple conferences, and if yes, should each conference be a separate event or a parent conference with child events later?
5. Should inactive users remain visible in organiser exports?
6. Is final cleanup hard delete or anonymization?

## Recommended Final Shape

If we were implementing this for the current repo, the cleanest design would be:

1. Keep `users` as the canonical identity record
2. Keep `cards` as the presentation/profile record
3. Use `events` as the conference definition layer
4. Use `event_registrations` as the attendee and conference lifecycle layer
5. Reuse `plan` and `subscriptionStatus` for entitlement
6. Reuse event attendee and check-in tooling before adding new admin endpoints
7. Add activation tracking off auth/session events
8. Use scheduled soft cleanup with an audit window

## Short Answer

How I would do it in this codebase:

- keep the current user/profile registration flow
- phase conferences into the existing events platform rather than creating a parallel conference store
- use `event_registrations` as the attendee ledger
- reuse the current entitlement model for premium access
- track activation from login/session evidence against the conference registration
- reuse existing attendee and check-in tooling before adding new conference-only APIs
- only remove external mirrored attendee storage after event-backed parity is proven
