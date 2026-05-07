# Centralized XS Card Registration and User Lifecycle Strategy

## Goal
Use the registration flow that already exists in this project to:

- keep one central user record instead of maintaining a separate conference database
- activate premium immediately when a user registers
- identify users who registered but never actually activated XS Card
- remove or deactivate inactive users after a defined period

## Current Project State
Today the project works like this:

1. The registration form creates the user in XS Card via `AddUser`.
2. It then creates the XS Card profile via `UploadImages`.
3. After that, the app mirrors the registration into Supabase through `mirror-registration`.
4. The organiser dashboard reads attendee data from Supabase, not directly from XS Card.
5. There is also a legacy local SQLite fallback in `server/index.ts`.

That means the current setup effectively has multiple data stores:

- XS Card backend data
- Supabase `registrations`
- local SQLite fallback

If the goal is "one centralized database, no separate database", the best direction is to make the XS Card backend database the system of record and treat this conference app as a frontend plus thin admin/proxy layer.

## Recommended Architecture
### Recommended Source of Truth
Make the XS Card backend database the single source of truth for:

- user identity
- conference registration state
- premium entitlement
- activation status
- lifecycle and cleanup status

This project should continue using the existing registration UI, but it should stop relying on a separate `registrations` table as the long-term operational database.

## What To Keep From This Project
Keep:

- the current multi-step registration form
- the existing XS Card user creation flow
- the app-install step and store redirect flow
- the organiser dashboard UX

Change:

- replace Supabase mirroring as the primary attendee store
- replace local SQLite fallback completely
- move attendee lifecycle, premium state, and inactive-user handling into XS Card backend data

## Data Model To Add In XS Card
The existing XS Card user record should be extended, or linked to a conference-registration record, with fields like these:

```text
user_id
conference_code
registration_source
registration_completed_at
profile_created_at
premium_status
premium_started_at
premium_expires_at
activation_status
first_login_at
device_registered_at
last_seen_at
cleanup_status
cleanup_due_at
cleanup_reason
email_verified
checked_in
checked_in_at
photo_consent
photography_consent
headshot_url_or_asset_ref
```

## Recommended Meaning Of Key Fields
- `registration_completed_at`: when the browser registration flow succeeds
- `premium_status`: `active`, `expired`, `revoked`, or `pending`
- `activation_status`: `registered_only`, `activated`, `inactive`, `scheduled_for_cleanup`, `deleted`
- `first_login_at`: first successful login inside XS Card
- `device_registered_at`: first device token or mobile session created
- `last_seen_at`: last app/backend activity
- `cleanup_due_at`: date after which the account can be removed if still inactive

## Important Note About "Never Downloaded XS Card"
The web registration form cannot reliably prove that a user downloaded the app.

What can be measured reliably is:

- first login to XS Card
- first mobile device registration
- first authenticated session
- first meaningful in-app action

So the implementation should treat "never downloaded the app" as:

- user registered through the conference form
- but never logged into XS Card
- and never registered a device

That is the safest and most measurable version of the rule.

## Recommended User Flow
Use the current registration flow with a backend adjustment.

### Step 1: Register User In XS Card
Keep the existing frontend call to:

- `AddUser`
- `UploadImages`

This already creates the XS Card account and profile.

### Step 2: Save Conference Registration In The Same Central Backend
Instead of sending the attendee record to a separate Supabase registrations table, the XS Card backend should:

- store the conference registration metadata in the same central database
- attach the registration to the XS user id
- store consent fields and headshot reference there
- mark the registration source as the conference landing page

### Step 3: Activate Premium Immediately
As soon as the registration succeeds, the XS Card backend should:

- create or update the premium entitlement for that user
- set `premium_status = active`
- set `premium_started_at = now()`
- set `premium_expires_at` based on the business rule

This avoids waiting for app install before premium becomes available.

### Step 4: Mark Activation Separately
Premium activation and app activation should be treated as different events.

- Registration success gives the user premium
- First XS Card login marks the user as activated

This lets the business team grant benefits immediately while still tracking adoption.

### Step 5: Run Inactive User Cleanup
If the user never activates XS Card within the allowed period, the backend should:

- send reminder notifications first
- mark the account as inactive
- revoke premium if required by policy
- soft-delete or hard-delete the account after the retention window

## Recommended Inactivity Policy
This is the safest policy for the current flow:

### Status Logic
- `registered_only`: user finished web registration but never logged into XS Card
- `activated`: user has logged in or registered a device
- `inactive`: user has remained `registered_only` past the inactivity threshold
- `scheduled_for_cleanup`: user is queued for removal
- `deleted`: user has been removed or anonymized

### Suggested Timeline
- Day 0: registration succeeds, premium becomes active immediately
- Day 7: reminder email/SMS to install and log into XS Card
- Day 14: second reminder
- Day 30: if still not activated, mark as inactive
- Day 37 or Day 45: perform cleanup

The exact number of days should be configurable by environment or conference.

## Recommended Cleanup Behavior
Use soft deletion first, not immediate hard deletion.

### Preferred Order
1. Mark user as inactive
2. Revoke premium if policy requires it
3. Hide the user from the organiser dashboard
4. Keep the row for a short audit window
5. Hard-delete or anonymize later

### Why Soft Delete First
This reduces risk if:

- the user actually installed the app late
- an organiser needs to recover the attendee
- the team needs an audit trail for registrations and entitlements

## How This Maps To The Current Codebase
### Frontend Registration
The existing registration form is already close to what is needed.

It currently:

- creates the XS user
- creates the XS card/profile
- optionally uploads headshot data
- shows install guidance after registration

That means the frontend does not need a major redesign.

### Main Backend Change
The main change is after registration succeeds:

- today: the app calls `mirror-registration` to persist to Supabase
- target: XS Card backend should persist conference registration and premium state itself

In other words, move the conference-registration write into the same backend domain that owns the XS user.

### Dashboard Change
The organiser dashboard should stop depending on a separate attendee table and instead read from XS Card admin endpoints, either:

- directly, or
- through thin Edge Functions that proxy XS Card admin APIs

That keeps the current dashboard UI while removing the separate conference database.

### Server Cleanup
The SQLite fallback in `server/index.ts` should be retired once the centralized backend is ready, because it introduces yet another data store that can drift from production truth.

## Suggested Migration Plan
### Phase 1: Centralize Writes First
Keep the current frontend flow, but update the XS Card backend so that successful registration also writes:

- conference registration metadata
- premium entitlement
- lifecycle status

During this phase, Supabase can still exist temporarily for backward compatibility.

### Phase 2: Move Dashboard Reads
Replace dashboard data reads so attendee listing, verification, check-in, and export come from XS Card admin endpoints instead of Supabase `registrations`.

At this stage, Supabase becomes optional.

### Phase 3: Remove Separate Conference Database
After dashboard parity is confirmed:

- remove `mirror-registration`
- remove `list-attendees` dependence on Supabase registrations
- remove local SQLite fallback
- keep only any storage layer that is still necessary for files

### Phase 4: Add Scheduled Cleanup
Implement a scheduled backend job that:

- finds users in `registered_only` status
- checks whether `first_login_at` or `device_registered_at` is still null
- compares `registration_completed_at` to the inactivity threshold
- revokes premium if required
- soft-deletes or deletes the user

## Minimum Backend Endpoints Needed
To support this approach cleanly, XS Card should expose admin/backend capabilities for:

- create conference registration metadata during signup
- update premium entitlement immediately
- fetch attendees by `conference_code`
- verify email
- mark check-in
- return activation status
- list inactive users pending cleanup
- deactivate, revoke premium, and delete users

## Recommended Business Rules
To avoid ambiguity, align on these rules before implementation:

1. Does premium remain active for users who never log in, or is it revoked at cleanup time?
2. Is cleanup a soft delete, hard delete, or anonymization?
3. Does a late login recover the account automatically if cleanup has not yet completed?
4. Should organisers still see inactive users in exports?
5. How long should audit data be retained after cleanup?

## Project-Specific Recommendation
For this codebase, the most practical solution is:

1. Keep the existing registration UI in `src/templates/Templates.tsx`
2. Keep the XS Card registration calls already in place
3. Move conference registration storage and premium activation into the XS Card backend
4. Use the organiser dashboard as a frontend over XS Card admin APIs
5. Retire Supabase attendee storage and local SQLite once the new admin endpoints are ready

This gives you:

- one central data store
- no duplicate attendee records
- immediate premium activation
- measurable activation tracking
- safe cleanup of users who never activate XS Card

## Short Answer
Yes, this can be achieved with the registration flow that already exists.

The key change is not the form itself. The key change is making XS Card own the full lifecycle after registration:

- registration
- conference metadata
- premium entitlement
- activation tracking
- inactivity cleanup

If you want, this document can be turned into a second implementation-focused markdown that lists the exact frontend, backend, and API changes file by file.
