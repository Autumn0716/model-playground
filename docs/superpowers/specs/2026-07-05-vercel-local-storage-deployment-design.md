# 2026-07-05 Vercel Local Storage Deployment Design

## Overview

This design covers deploying `gpt_image_playground` to Vercel as a static Vite application while preserving the existing browser-side persistence model. The immediate goal is narrow: make the project deploy cleanly to Vercel and confirm that local browser persistence for general API profiles and other settings continues to work under the deployed domain.

This design does not add a backend, cloud sync, account system, or server-side API proxy.

## Goal

Deploy the current application to Vercel using the existing static frontend architecture and preserve the current local persistence behavior for:

- general API profiles
- image API profiles
- app settings
- image/task/history data already stored in browser-side storage

## Quality Standard

This work uses a strict verification gate.

- No task is considered complete without fresh verification evidence.
- No claim such as "build passes", "deployment works", or "local persistence is preserved" is acceptable unless it is backed by a current command run or live deployment check.
- Any item that cannot be verified remains incomplete and must be reported as such.
- Any residual risk that remains after verification must be stated explicitly.

This design aims to minimize residual delivery risk through verification discipline. It does not claim that browser-based deployment work can be reduced to literal zero risk.

## Non-Goals

This work does not include:

- cross-device sync
- user accounts or authentication
- server-side database storage
- moving browser data to Vercel storage
- implementing a Vercel Function proxy
- changing the current local persistence model from browser storage to a remote store

## Current State

The current codebase already aligns well with static deployment:

- The app is a Vite frontend with `npm run build` defined in `package.json`.
- The project already contains a minimal `vercel.json`.
- The README already documents Vercel deployment and Vercel environment variables.
- App settings are persisted through Zustand `persist` under the storage key `gpt-image-playground`.
- `AppSettings` already includes `generalApiProfiles` and `generalActiveProfileId`.
- Large browser data such as tasks, images, thumbnails, and agent conversations are stored in IndexedDB.

Relevant code references:

- `package.json`
- `vercel.json`
- `src/store.ts`
- `src/types.ts`
- `src/lib/db.ts`
- `README.md`

## Deployment Boundary

The Vercel deployment remains a static hosting target only.

### Included

- Vercel hosts the built frontend assets.
- Browser local persistence remains the source of truth for settings.
- IndexedDB remains the source of truth for tasks, images, and related history data.
- Optional Vercel build-time environment variables may be used to prefill deployment defaults.

### Excluded

- No runtime server state is introduced.
- No browser data is uploaded to a backend.
- No same-origin proxy is introduced for `/api-proxy/`.
- No attempt is made to make browser storage portable across domains or devices.

## Persistence Model on Vercel

The expected persistence behavior after deployment is unchanged from local/browser usage.

### Settings persistence

The application persists normalized `settings` through Zustand persistence. That settings object already contains:

- `profiles`
- `activeProfileId`
- `generalApiProfiles`
- `generalActiveProfileId`
- related UI and behavior settings

Because this is browser-side persistence, deploying to Vercel does not remove the ability to store and restore these values.

### IndexedDB persistence

The application also stores images, tasks, thumbnails, and agent conversation data in IndexedDB. That behavior also remains browser-local after Vercel deployment.

### Storage boundary

Browser persistence is scoped to the site origin. Therefore:

- refreshes under the same domain should retain local settings
- reopening the same deployed domain in the same browser should retain local settings
- switching to a different domain creates a different browser storage scope
- changing from a temporary `*.vercel.app` domain to a custom domain will not automatically carry local browser data across
- changing browser, device, or clearing site data loses the local data

## Recommended Deployment Approach

Use the existing static Vite deployment path with no application architecture change.

### Recommendation

- Keep the project as a static Vercel deployment.
- Do not add Vercel Functions.
- Do not change the current persistence implementation unless build or runtime verification proves a deployment-specific issue.
- Optionally use `VITE_DEFAULT_API_URL` only if a deployment default is needed.

### Why this is the recommended path

- It matches the existing code and README guidance.
- It keeps the requested scope narrow.
- It preserves the current browser-local behavior for general API profile storage.
- It avoids introducing backend infrastructure that the user explicitly does not need yet.

## Configuration Plan

### Vercel project settings

The deployment should use:

- framework preset: Vite (or Vercel auto-detection if it resolves correctly)
- build command: `npm run build`
- output directory: `dist`

### Environment variables

Use the smallest possible environment variable set.

#### Required

- none

#### Optional

- `VITE_DEFAULT_API_URL`
- `VITE_SHOW_DEFAULT_CONFIG_ONLY`

These should only be used if there is a product requirement to pre-populate or constrain the default API configuration in the deployment.

### Explicitly not configured in this phase

- API proxy variables
- Vercel Functions
- database credentials
- sync-related secrets

## Verification Plan

Verification should focus on deployment correctness and browser persistence.

### Verification rule

No implementation step is considered complete until the corresponding verification step has been run and its result has been checked.

### Build verification

Run local build verification first:

1. install dependencies if needed
2. run `npm run build`
3. confirm a static `dist/` build completes successfully

### Post-deployment verification

After deployment to Vercel:

1. open the deployed site
2. create or edit a general API profile
3. refresh the page and confirm the profile remains
4. close and reopen the same site in the same browser and confirm the profile remains
5. verify standard API profile persistence still works
6. verify the app loads normally without a deployment-only regression

### Evidence required for completion

Completion requires fresh evidence for all applicable checks:

- local build output showing successful completion
- Vercel deployment result showing successful publish
- deployed-site verification showing that general API profile persistence survives refresh on the same domain
- deployed-site verification showing that reopening the same domain in the same browser retains the expected local settings

If any one of these checks is missing, blocked, or failing, the task remains incomplete.

### Acceptance criteria

The deployment is acceptable when all of the following are true:

- Vercel deployment completes successfully
- the site loads normally
- general API profiles can be created or edited on the deployed site
- general API profiles remain after refresh on the same domain
- local settings remain after reopening the same deployed domain in the same browser
- no backend infrastructure was required for this scope

## Risk Assessment

### Low-risk items

- Static build deployment to Vercel
- Retaining browser-local persisted settings on the same domain
- Using existing documented Vercel environment variables

### Moderate-risk items

- Domain transition later, which would create a new browser storage origin
- Service worker cache behavior after deployment updates, if an old asset cache becomes stale
- Any build-time mismatch between local Node/tooling and Vercel's build image

### Out-of-scope risks

- Loss of data across devices
- Loss of data after clearing browser storage
- Loss of data when switching domains

These are expected properties of browser-local persistence, not defects in this deployment design.

## Implementation Scope

Implementation should be kept minimal.

### Default expectation

- no business logic changes
- no persistence model changes
- no schema changes
- no UI changes required for this deployment goal

### Allowed narrow changes if validation fails

Only make scoped deployment-related changes if verification reveals a real issue, for example:

- Vercel build configuration adjustment
- minor static asset path adjustment
- deployment-specific service worker or base-path fix
- documentation updates clarifying domain-bound browser persistence

## Rollout Notes

### Testing domain choice

If the deployment starts on a temporary Vercel domain, treat it as a test origin. If long-term use matters, choose the final domain as early as possible to avoid local browser storage being fragmented across multiple origins.

### User expectations

The deployed app should be described as using browser-local storage, not remote sync. That expectation needs to remain explicit so the behavior around browser changes, device changes, and domain changes is understood.

## Final Recommendation

Proceed with a static Vercel deployment of the existing frontend, verify local browser persistence for general API profiles on the deployed origin, and avoid any backend or sync work in this phase.
