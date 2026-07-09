# 2026-07-05 Model Playground Rename And Migration Design

## Overview

This design covers a full rename of the existing `gpt_image_playground` project to `model-playground`, creation of a new GitHub repository at `Autumn0716/model-playground`, migration of deployment wiring to that repository, and automatic migration of browser-local persisted data from the old naming scheme to the new one.

The target is not only cosmetic consistency. The rename must be applied across repository identity, package metadata, app display text, deployment metadata, browser persistence identifiers, and operational links. The result must build, test, deploy to Vercel again, and preserve existing local browser data through an automatic migration path.

## Goal

Deliver a unified rename to `model-playground` across code, product naming, GitHub, Vercel, and browser-local persistence, with automatic migration from legacy browser storage identifiers and with verified redeployment to Vercel.

## Quality Standard

This work uses a strict verification gate.

- No task is considered complete without fresh verification evidence.
- No claim such as "rename is complete", "migration works", "tests pass", or "Vercel is healthy" is acceptable unless backed by a current command run or live deployment check.
- Any item that cannot be verified remains incomplete and must be reported as such.
- Any residual risk that remains after verification must be stated explicitly.

This design aims to minimize delivery risk through verification discipline. It does not claim that a browser-storage migration or deployment change can be reduced to literal zero risk.

## Scope

This rename is comprehensive. It includes four layers.

### 1. Product and code naming

Rename all outward-facing project names and internal project identifiers that are meant to represent the product:

- package name
- lockfile package name
- page title and visible product title
- PWA manifest name and description where applicable
- Wrangler project name
- mock API display name
- backup filename prefix
- GitHub repository references embedded in the application
- README badges, links, examples, and deployment buttons

### 2. Repository and hosting identity

Create and standardize on a new public GitHub repository:

- owner: `Autumn0716`
- repository: `model-playground`
- visibility: public

Then align local git remotes and Vercel project wiring with that repository.

### 3. Browser-local persistence identity

Rename browser-local persistence identifiers from the old project name to the new one, including:

- Zustand persistence storage key
- IndexedDB database name
- service worker cache namespace
- other project-prefixed localStorage keys

### 4. Deployment re-validation

Rebuild and redeploy the renamed project to Vercel and verify that the renamed application behaves correctly after deployment.

## Non-Goals

This work does not include:

- cross-device sync
- user accounts or authentication
- server-side database storage
- Vercel Function proxy work
- changing the product feature set outside the rename and migration scope
- unrelated refactors

## Current State

The current project still exposes the legacy identity in multiple places.

### Repository identity

- Local directory name is `gpt_image_playground`
- current remote `origin` points at `https://github.com/CookSleep/gpt_image_playground.git`
- GitHub CLI is authenticated as `Autumn0716`
- Vercel project currently exists as `model-playground`

### Browser-local persistence identifiers

Current known identifiers include:

- Zustand persist key: `gpt-image-playground`
- IndexedDB database name: `gpt-image-playground`
- settings modal localStorage key prefix: `gpt-image-playground.copy-import-url-options`
- service worker cache name prefix: `gpt-image-playground-v...`
- exported backup filename prefix: `gpt-image-playground-backup_...`

### Hard-coded repository references

The current code and docs contain multiple references to:

- `CookSleep/gpt_image_playground`
- `https://github.com/CookSleep/gpt_image_playground`
- `https://github.com/CookSleep/gpt_image_playground/issues`

### Display naming

Current product naming includes:

- `GPT Image Playground`
- `GPT Image`
- `gpt-image-playground`
- `gpt_image_playground`

## Recommended Approach

Use a single coordinated rename with an automatic migration layer and a full verification cycle.

### Recommendation

- Rename all naming surfaces to `model-playground` in one change set.
- Add startup-time migration logic for browser-local persistence.
- Create a new GitHub repository `Autumn0716/model-playground`.
- Repoint local git remotes so `origin` targets the new repository.
- Update Vercel and repository links to the new repository.
- Run full automated verification and redeploy only after the migration and rename pass locally.

### Why this is the recommended path

- It is the only approach that satisfies the requirement for full naming unification.
- It avoids a split-brain state where product naming, repository naming, and persistence naming diverge.
- It preserves existing local data through controlled migration instead of forcing users into a cold start.
- It gives one clean maintenance target for GitHub and Vercel going forward.

## Alternative Approaches Considered

### Alternative A: rename outward-facing surfaces only

This would rename GitHub, README, and UI text but keep old persistence keys and database names.

Why not chosen:

- It does not satisfy the explicit requirement to unify everything.
- It leaves long-term ambiguity and hidden legacy state.

### Alternative B: hard cut to the new names without migration

This would rename all identifiers but ignore old local data.

Why not chosen:

- It breaks continuity for existing browser-local settings and history.
- It conflicts with the explicit requirement for automatic migration.

## Rename Surfaces

The rename must be applied consistently across the following categories.

### Code and package metadata

- `package.json`
- `package-lock.json`
- `wrangler.jsonc`
- script-visible project names where applicable

### App display and product identity

- `index.html` title
- header title text
- settings/about product naming
- PWA manifest name, short name, and description where appropriate

### Documentation and public links

- README headings
- badges
- repository links
- issues links
- deploy button parameters
- example URLs and repository references
- star history references

### Browser persistence identifiers

- Zustand persist key
- IndexedDB database name
- ancillary localStorage keys
- service worker cache name prefix
- export file name prefix

## Migration Design

The browser-local migration must be conservative and idempotent.

### Migration principles

- Prefer copy-then-switch over destructive rename.
- Never delete legacy data before the new target has been written successfully.
- Migration must be safe to retry.
- Migration must not create duplicate logical records if it runs twice.
- Migration must happen early enough that the application does not render an empty state and only recover on a later refresh.

### localStorage migration

The application currently uses a project-scoped key for Zustand persistence and at least one additional project-scoped localStorage key.

The migration behavior should be:

1. Check whether the new key exists.
2. If the new key exists, use it and do not overwrite it with legacy data.
3. If the new key does not exist and the legacy key exists, copy legacy data to the new key.
4. Validate that the new key is readable.
5. Only then remove the legacy key, or mark it migrated if the chosen implementation needs a safer staged cleanup.
6. Apply the same pattern to any other project-prefixed localStorage keys.

### IndexedDB migration

The current IndexedDB database name is `gpt-image-playground`.

The migration behavior should be:

1. Detect whether the legacy database exists and whether the new database exists.
2. If the new database already contains migrated data, do nothing.
3. If the new database is absent or empty while the legacy database contains data, copy all supported stores from old to new.
4. Migrate all current stores:
   - `tasks`
   - `images`
   - `thumbnails`
   - `agentConversations`
5. Verify copied data is readable from the new database.
6. Only after successful copy and verification should legacy cleanup be considered.

### Migration timing

Migration must happen during application startup, before the app begins relying on the new persistence locations as if they were already populated.

The startup sequence should ensure:

- settings migration occurs before persisted settings are treated as authoritative
- IndexedDB migration occurs before UI logic assumes the new database is empty
- the app can distinguish a true empty state from a pre-migration state

### Service worker and cache migration

The cache namespace should be renamed to the new project identity.

The service worker activation logic should additionally clean up known legacy cache namespaces so users do not remain on a mixed old/new cache set.

This cache cleanup is not a data migration feature; it is a deployment consistency and stale-asset control measure.

## Repository And Remote Design

### New repository

Create:

- `Autumn0716/model-playground`
- visibility: public

### Local remotes

Recommended steady state:

- `origin` -> `Autumn0716/model-playground`
- `upstream` -> `CookSleep/gpt_image_playground`

This preserves a clean owner-controlled primary remote while keeping the old upstream reachable for future sync if desired.

### Repository references in code and docs

All repository references should move to the new repository where they represent the maintained project home.

That includes:

- header GitHub links
- help and support links
- README badges and repo URLs
- issues URLs
- deploy button repository URL
- version check repo reference
- star history URLs

### License and attribution handling

Where the app currently contains explicit attribution to the original open-source project and MIT license obligations, those notices must remain accurate.

If the text currently says the site is based on the original upstream project, keep the attribution intact while updating maintained-project links where appropriate. The rename must not silently remove required license notices.

## Vercel Design

### Current deployment state

The Vercel project already exists as `model-playground` and the local directory is linked to it.

### Required follow-up

- ensure the deployed project still builds successfully after the rename
- ensure Vercel references the new GitHub repository where integration is required
- redeploy after the rename and migration work is complete
- verify the deployed domain loads normally after the rename

### Deployment mode

Manual production deployment remains acceptable for this work. Automatic Git-driven deployment is not required for the rename itself unless separately configured later.

## Testing Strategy

Testing must scale to the risk of a full identity and persistence migration.

### Automated tests

At minimum, add or update coverage for:

- localStorage migration from legacy key to new key
- preservation of migrated settings under the new key
- IndexedDB migration from legacy database name to new database name
- migration idempotency
- continued persistence under the new naming scheme
- any code paths that assume old fixed repo names or storage names

Then run:

- full test suite
- production build

### Manual or browser-level verification

Before and after deployment, verify:

- the app loads normally
- visible naming is consistently `model-playground` where intended
- migrated local data remains available
- refresh does not lose migrated data
- reopening the same origin does not lose migrated data
- service worker and manifest still function without obvious regression

### Deployment verification

After redeploying to Vercel, verify:

- the deployed site loads normally
- no deployment-only asset failure is introduced
- renamed repository links resolve correctly
- the app continues to function under the deployed origin

## Acceptance Criteria

The work is acceptable only if all of the following are true:

- naming is unified to `model-playground` across code, docs, hosting identity, and browser-local persistence identifiers
- a new public GitHub repository exists at `Autumn0716/model-playground`
- local git remotes are updated to the intended steady state
- browser-local legacy data is automatically migrated to the new naming scheme
- migration is idempotent and does not require manual user intervention
- full automated test verification passes
- production build passes
- the renamed app redeploys successfully to Vercel
- deployed-site validation shows no rename-related regression
- any remaining residual risks are explicitly reported

## Risks And Mitigations

### Risk: local data loss during migration

Mitigation:

- use copy-then-verify semantics
- avoid destructive cleanup before successful migration
- add migration tests for existing populated state

### Risk: stale caches or mixed asset state after rename

Mitigation:

- rename cache namespace
- clean legacy cache namespaces during service worker activation
- verify post-deploy behavior on a real deployed origin

### Risk: incomplete rename coverage

Mitigation:

- use repository-wide search for all legacy naming variants
- verify all hits are intentionally changed or intentionally retained for attribution

### Risk: broken repo/deploy links

Mitigation:

- update every hard-coded GitHub reference
- re-verify README links and in-app links after change
- ensure Vercel project/repository relationship is aligned with the new repo

### Risk: existing local data is preserved but old legacy state remains behind

Mitigation:

- decide cleanup timing deliberately
- prefer safe staged cleanup over aggressive deletion if needed
- report any intentionally retained legacy footprint as a residual risk

## Rollout Order

Recommended execution order:

1. Implement rename constants and migration helpers.
2. Update local persistence identifiers and startup migration flow.
3. Update all naming surfaces and repository links.
4. Create and wire the new GitHub repository.
5. Run full automated verification.
6. Redeploy to Vercel.
7. Run post-deploy validation.

## Final Recommendation

Proceed with a single coordinated rename to `model-playground`, include automatic browser-local migration from the legacy identifiers, standardize on a new public repository at `Autumn0716/model-playground`, and do not treat the work as complete until full tests, build, redeploy, and post-deploy validation all pass.
