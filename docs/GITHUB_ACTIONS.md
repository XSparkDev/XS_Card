# GitHub Actions

## Overview
This repository currently contains one GitHub Actions workflow:

- `.github/workflows/pre-deploy.yml`

It is a pre-deployment validation workflow that protects important backend behavior before changes move forward on deployment-oriented branches.

## Workflow: Pre-deployment checks

### Trigger
The workflow runs on pushes to:

- `main`
- `production`

This means it is intended as a guardrail for release-oriented branches, not for every feature branch push.

### Job structure
There is currently a single job:

- `validate`

It runs on:

- `ubuntu-latest`

and sets these environment variables from repository secrets:

- `API_BASE`
- `TEST_USER_ID`

## What the workflow does

### 1. Checks out the code
Uses:

- `actions/checkout@v4`

### 2. Sets up Node
Uses:

- `actions/setup-node@v4`

Configured with:

- Node `20`

### 3. Installs root dependencies
Runs:

```bash
npm ci
```

This uses the lockfile for a consistent clean install in CI.

### 4. Runs a critical endpoint test
Runs:

```bash
node backend/test-addcontact-route.js
```

This test exists specifically to ensure the `AddContact` flow remains functional. The script itself states that it is a critical pre-deployment check.

The test sends a POST request to:

- `/AddContact`

using:

- `API_BASE`
- a test user id
- generated contact payload data

If the endpoint does not return `200` or `201`, the workflow fails.

## Failure notification
If the validation job fails, the workflow sends an email using:

- `dawidd6/action-send-mail@v3`

Expected secrets:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `NOTIFY_EMAILS`

The email includes:

- workflow name
- branch name
- commit SHA
- direct GitHub Actions run URL

There is also a commented placeholder for a future Slack failure notification.

## Why this workflow matters in this project
This codebase has a number of public routes and mobile/backend integrations, but the workflow currently focuses on a single high-value regression check:

- the public add-contact path

That is consistent with the code comments in `backend/test-addcontact-route.js`, which describe it as a route that must never break.

## Related files

### Workflow definition
- `.github/workflows/pre-deploy.yml`

### Test executed by the workflow
- `backend/test-addcontact-route.js`

## Current limitations
At the moment, the GitHub Actions coverage is intentionally narrow:

- no unit test suite is run
- no lint step is run
- no native iOS/Android build validation is run
- no backend integration matrix is run
- no preview environment provisioning is run

So the workflow should be understood as a focused deployment gate, not a full CI pipeline.

## How to extend it later
Common next steps, if you choose to expand CI, would be:

- add lint/typecheck steps for the app
- add backend route smoke tests beyond `AddContact`
- add environment-specific staging checks
- add EAS build validation for release branches
- add artifact or release metadata publishing

## Summary
GitHub Actions in this repository currently serves one purpose:

- validate a critical backend route before deployment-oriented branch updates proceed

It is lightweight, secrets-driven, and failure-aware through email notification, but it is not yet a full end-to-end CI/CD system.
