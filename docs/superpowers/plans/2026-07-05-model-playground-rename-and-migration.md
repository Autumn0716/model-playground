# Model Playground Rename And Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project to `model-playground`, automatically migrate legacy browser-local data from the old project identifiers, create and align a new public GitHub repository, and redeploy to Vercel with full verification.

**Architecture:** Introduce a small startup migration layer that moves legacy `gpt-image-playground` browser state into the new `model-playground` naming scheme before the app depends on that state. Apply the rename consistently across code, docs, repository metadata, and deployment wiring, then prove the result with full automated verification and a fresh Vercel redeploy.

**Tech Stack:** React 19, TypeScript, Vite 6, Zustand persist, IndexedDB, service worker cache API, Vitest, GitHub CLI, Vercel CLI

## Global Constraints

- No task is considered complete without fresh verification evidence.
- No claim such as "rename is complete", "migration works", "tests pass", or "Vercel is healthy" is acceptable unless backed by a current command run or live deployment check.
- Any item that cannot be verified remains incomplete and must be reported as such.
- Any residual risk that remains after verification must be stated explicitly.
- This work does not include cross-device sync.
- This work does not include user accounts or authentication.
- This work does not include server-side database storage.
- This work does not include Vercel Function proxy work.
- This work does not include changing the product feature set outside the rename and migration scope.
- This work does not include unrelated refactors.
- The new public GitHub repository must be `Autumn0716/model-playground`.
- Browser-local legacy data must be automatically migrated from the old naming scheme.
- Migration must be conservative and idempotent.
- Prefer copy-then-switch over destructive rename.
- Never delete legacy data before the new target has been written successfully.
- Migration must happen early enough that the application does not render an empty state and only recover on a later refresh.

---

## File Structure

- Create: `src/lib/projectIdentity.ts`
  - Centralize current and legacy project names, storage keys, repo constants, and cache namespace constants.
- Create: `src/lib/storageMigration.ts`
  - Handle localStorage migration of legacy keys to new keys.
- Create: `src/lib/indexedDbMigration.ts`
  - Detect and migrate legacy IndexedDB stores into the new database name.
- Modify: `src/lib/db.ts`
  - Switch DB naming to `model-playground` and expose any helpers needed by the migration layer.
- Modify: `src/main.tsx`
  - Run startup migrations early before the app depends on migrated data.
- Modify: `src/store.ts`
  - Rename Zustand persist key and keep persisted settings compatible with migration.
- Modify: `src/components/SettingsModal.tsx`
  - Switch ancillary localStorage key names to the centralized identity constants.
- Modify: `src/hooks/useVersionCheck.ts`
  - Point release checks to `Autumn0716/model-playground`.
- Modify: `public/sw.js`
  - Rename cache namespace and clean legacy cache prefixes during activation.
- Modify: `public/manifest.webmanifest`
  - Rename app identity fields.
- Modify: `index.html`
  - Rename page title.
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `wrangler.jsonc`
- Modify: `scripts/mock-image-api.mjs`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/HelpModal.tsx`
- Modify: `src/components/SupportPromptModal.tsx`
- Modify: `README.md`
- Test: `src/store.test.ts`
- Test: `src/lib/*.test.ts` for migration helpers as needed

## Task 1: Centralize Project Identity Constants

**Files:**
- Create: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/projectIdentity.ts`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/hooks/useVersionCheck.ts`
- Test: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/projectIdentity.test.ts`

**Interfaces:**
- Produces: `CURRENT_PROJECT_SLUG`, `LEGACY_PROJECT_SLUG`, `CURRENT_REPO`, `LEGACY_REPO`, `CURRENT_PERSIST_KEY`, `LEGACY_PERSIST_KEY`, `CURRENT_DB_NAME`, `LEGACY_DB_NAME`, `CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY`, `LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY`, `CURRENT_CACHE_PREFIX`, `LEGACY_CACHE_PREFIX`
- Consumes later by: `src/store.ts`, `src/lib/db.ts`, `src/main.tsx`, `src/components/SettingsModal.tsx`, `public/sw.js`, `src/hooks/useVersionCheck.ts`

- [ ] **Step 1: Write the failing identity constants test**

Create `src/lib/projectIdentity.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import {
  CURRENT_PROJECT_SLUG,
  LEGACY_PROJECT_SLUG,
  CURRENT_REPO,
  LEGACY_REPO,
  CURRENT_PERSIST_KEY,
  LEGACY_PERSIST_KEY,
  CURRENT_DB_NAME,
  LEGACY_DB_NAME,
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_CACHE_PREFIX,
  LEGACY_CACHE_PREFIX,
} from './projectIdentity'

describe('project identity constants', () => {
  it('defines current and legacy identity values', () => {
    expect(CURRENT_PROJECT_SLUG).toBe('model-playground')
    expect(LEGACY_PROJECT_SLUG).toBe('gpt-image-playground')
    expect(CURRENT_REPO).toBe('Autumn0716/model-playground')
    expect(LEGACY_REPO).toBe('CookSleep/gpt_image_playground')
    expect(CURRENT_PERSIST_KEY).toBe('model-playground')
    expect(LEGACY_PERSIST_KEY).toBe('gpt-image-playground')
    expect(CURRENT_DB_NAME).toBe('model-playground')
    expect(LEGACY_DB_NAME).toBe('gpt-image-playground')
    expect(CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY).toBe('model-playground.copy-import-url-options')
    expect(LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY).toBe('gpt-image-playground.copy-import-url-options')
    expect(CURRENT_CACHE_PREFIX).toBe('model-playground-v')
    expect(LEGACY_CACHE_PREFIX).toBe('gpt-image-playground-v')
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- src/lib/projectIdentity.test.ts
```

Expected:

- FAIL because `src/lib/projectIdentity.ts` does not exist yet.

- [ ] **Step 3: Write the identity constants module**

Create `src/lib/projectIdentity.ts` with:

```ts
export const CURRENT_PROJECT_SLUG = 'model-playground'
export const LEGACY_PROJECT_SLUG = 'gpt-image-playground'

export const CURRENT_REPO = 'Autumn0716/model-playground'
export const LEGACY_REPO = 'CookSleep/gpt_image_playground'

export const CURRENT_PERSIST_KEY = CURRENT_PROJECT_SLUG
export const LEGACY_PERSIST_KEY = LEGACY_PROJECT_SLUG

export const CURRENT_DB_NAME = CURRENT_PROJECT_SLUG
export const LEGACY_DB_NAME = LEGACY_PROJECT_SLUG

export const CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY = `${CURRENT_PROJECT_SLUG}.copy-import-url-options`
export const LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY = `${LEGACY_PROJECT_SLUG}.copy-import-url-options`

export const CURRENT_CACHE_PREFIX = `${CURRENT_PROJECT_SLUG}-v`
export const LEGACY_CACHE_PREFIX = `${LEGACY_PROJECT_SLUG}-v`
```

Update `src/hooks/useVersionCheck.ts` to consume the centralized repo constant:

```ts
import { useState, useEffect } from 'react'
import { CURRENT_REPO } from '../lib/projectIdentity'

const REPO = CURRENT_REPO
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm test -- src/lib/projectIdentity.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Run the full suite once before commit**

Run:

```bash
npm test
```

Expected:

- PASS

- [ ] **Step 6: Commit Task 1**

```bash
git add src/lib/projectIdentity.ts src/lib/projectIdentity.test.ts src/hooks/useVersionCheck.ts
git commit -m "feat: centralize model playground identity"
```

## Task 2: Migrate localStorage Keys At Startup

**Files:**
- Create: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/storageMigration.ts`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/components/SettingsModal.tsx`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/main.tsx`
- Test: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/storageMigration.test.ts`

**Interfaces:**
- Consumes: constants from `src/lib/projectIdentity.ts`
- Produces: `migrateLegacyLocalStorage(): void`
- Later consumed by: app startup and settings modal key reads

- [ ] **Step 1: Write the failing migration tests**

Create `src/lib/storageMigration.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_PERSIST_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_PERSIST_KEY,
} from './projectIdentity'
import { migrateLegacyLocalStorage } from './storageMigration'

describe('migrateLegacyLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('copies legacy persisted state into the current key when current key is missing', () => {
    localStorage.setItem(LEGACY_PERSIST_KEY, JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))

    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_PERSIST_KEY)).toBe(JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))
  })

  it('does not overwrite current persisted state with legacy state', () => {
    localStorage.setItem(LEGACY_PERSIST_KEY, JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))
    localStorage.setItem(CURRENT_PERSIST_KEY, JSON.stringify({ state: { prompt: 'current' }, version: 2 }))

    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_PERSIST_KEY)).toBe(JSON.stringify({ state: { prompt: 'current' }, version: 2 }))
  })

  it('migrates ancillary copy-import-url options key', () => {
    localStorage.setItem(LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY, JSON.stringify({ useNewApiKey: true }))

    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY)).toBe(JSON.stringify({ useNewApiKey: true }))
  })

  it('is safe to run more than once', () => {
    localStorage.setItem(LEGACY_PERSIST_KEY, JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))

    migrateLegacyLocalStorage()
    migrateLegacyLocalStorage()

    expect(localStorage.getItem(CURRENT_PERSIST_KEY)).toBe(JSON.stringify({ state: { prompt: 'legacy' }, version: 2 }))
  })
})
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
npm test -- src/lib/storageMigration.test.ts
```

Expected:

- FAIL because `src/lib/storageMigration.ts` does not exist yet.

- [ ] **Step 3: Implement localStorage migration helper**

Create `src/lib/storageMigration.ts` with:

```ts
import {
  CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  CURRENT_PERSIST_KEY,
  LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY,
  LEGACY_PERSIST_KEY,
} from './projectIdentity'

function copyLocalStorageValue(legacyKey: string, currentKey: string) {
  const current = window.localStorage.getItem(currentKey)
  if (current !== null) return

  const legacy = window.localStorage.getItem(legacyKey)
  if (legacy === null) return

  window.localStorage.setItem(currentKey, legacy)
}

export function migrateLegacyLocalStorage() {
  if (typeof window === 'undefined') return

  copyLocalStorageValue(LEGACY_PERSIST_KEY, CURRENT_PERSIST_KEY)
  copyLocalStorageValue(LEGACY_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY, CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY)
}
```

Update `src/components/SettingsModal.tsx`:

```ts
import { CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY } from '../lib/projectIdentity'

const COPY_IMPORT_URL_OPTIONS_STORAGE_KEY = CURRENT_COPY_IMPORT_URL_OPTIONS_STORAGE_KEY
```

Update `src/main.tsx` to run the migration before app render:

```ts
import { migrateLegacyLocalStorage } from './lib/storageMigration'

migrateLegacyLocalStorage()
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

```bash
npm test -- src/lib/storageMigration.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Run the full suite once before commit**

Run:

```bash
npm test
```

Expected:

- PASS

- [ ] **Step 6: Commit Task 2**

```bash
git add src/lib/storageMigration.ts src/lib/storageMigration.test.ts src/components/SettingsModal.tsx src/main.tsx
git commit -m "feat: migrate legacy local storage keys"
```

## Task 3: Migrate IndexedDB From Legacy Database Name

**Files:**
- Create: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/indexedDbMigration.ts`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/db.ts`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/main.tsx`
- Test: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/lib/indexedDbMigration.test.ts`

**Interfaces:**
- Consumes: constants from `src/lib/projectIdentity.ts`
- Produces: `migrateLegacyIndexedDb(): Promise<void>`
- Produces: any small DB helper exports needed to inspect database existence or open by name
- Later consumed by: startup sequence before app depends on empty/new DB state

- [ ] **Step 1: Write failing IndexedDB migration tests**

Create `src/lib/indexedDbMigration.test.ts` with tests that cover:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_DB_NAME, LEGACY_DB_NAME } from './projectIdentity'
import { migrateLegacyIndexedDb } from './indexedDbMigration'

async function resetDb(name: string) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

describe('migrateLegacyIndexedDb', () => {
  beforeEach(async () => {
    await resetDb(LEGACY_DB_NAME)
    await resetDb(CURRENT_DB_NAME)
  })

  it('copies legacy task data into the current database', async () => {
    // create legacy DB and insert one task-like record into tasks
    // run migration
    // assert current DB contains that record
  })

  it('does not overwrite an already populated current database', async () => {
    // populate both DBs with different records
    // run migration
    // assert current DB still keeps its own record
  })

  it('is idempotent', async () => {
    // migrate twice
    // assert no duplicate records appear
  })
})
```

Use exact helper code in the implementation task so the test is executable, not conceptual.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
npm test -- src/lib/indexedDbMigration.test.ts
```

Expected:

- FAIL because the migration module and helpers do not exist yet.

- [ ] **Step 3: Implement IndexedDB migration and DB naming switch**

Create `src/lib/indexedDbMigration.ts` with helpers that:

- open a database by supplied name
- detect whether an object store has records
- copy all records store-by-store from legacy DB to current DB
- no-op when current DB already contains records

Update `src/lib/db.ts` so the active DB name comes from `CURRENT_DB_NAME` and any migration helpers can share store names through exported constants:

```ts
import { CURRENT_DB_NAME } from './projectIdentity'

export const DB_NAME = CURRENT_DB_NAME
export const DB_VERSION = 3
export const STORE_TASKS = 'tasks'
export const STORE_IMAGES = 'images'
export const STORE_THUMBNAILS = 'thumbnails'
export const STORE_AGENT_CONVERSATIONS = 'agentConversations'
```

Run migration during startup in `src/main.tsx` before render:

```ts
import { migrateLegacyIndexedDb } from './lib/indexedDbMigration'

await migrateLegacyIndexedDb()
```

If top-level `await` is awkward in the current file shape, introduce a small async bootstrap function:

```ts
async function bootstrap() {
  migrateLegacyLocalStorage()
  await migrateLegacyIndexedDb()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

```bash
npm test -- src/lib/indexedDbMigration.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Run the full suite once before commit**

Run:

```bash
npm test
```

Expected:

- PASS

- [ ] **Step 6: Commit Task 3**

```bash
git add src/lib/indexedDbMigration.ts src/lib/indexedDbMigration.test.ts src/lib/db.ts src/main.tsx
git commit -m "feat: migrate legacy indexeddb data"
```

## Task 4: Rename Store Keys, Cache Prefixes, Backup Names, And Product Identity

**Files:**
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/store.ts`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/public/sw.js`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/public/manifest.webmanifest`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/index.html`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/scripts/mock-image-api.mjs`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/components/Header.tsx`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/components/SettingsModal.tsx`
- Test: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/store.test.ts`

**Interfaces:**
- Consumes: identity constants and migration helpers from Tasks 1 to 3
- Produces: renamed storage keys, cache prefix handling, backup filename prefix, visible product naming

- [ ] **Step 1: Add or update failing tests for renamed persisted key behavior where needed**

Extend `src/store.test.ts` with a test asserting the persisted payload still flows after the rename, and add any focused assertions needed for backup filename prefix if a direct helper exists.

Use this test if no stronger one already exists:

```ts
it('continues persisting general API profiles after the project key rename', () => {
  useStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      generalApiProfiles: [
        { id: 'default-general', name: '默认', baseUrl: '', apiKey: '', apiMode: 'chat', apiProxy: false },
        { id: 'gp-relay', name: 'Relay', baseUrl: 'https://relay.example.com/v1', apiKey: 'sk-relay', apiMode: 'responses', apiProxy: false },
      ],
      generalActiveProfileId: 'gp-relay',
    },
  })

  const persisted = getPersistedState(useStore.getState()) as { settings?: { generalActiveProfileId?: string } }
  expect(persisted.settings?.generalActiveProfileId).toBe('gp-relay')
})
```

- [ ] **Step 2: Run the focused tests**

Run:

```bash
npm test -- src/store.test.ts
```

Expected:

- PASS or targeted failure showing rename-related breakage.

- [ ] **Step 3: Implement the rename surfaces for storage and visible identity**

Update `src/store.ts`:

```ts
import { CURRENT_PERSIST_KEY, CURRENT_PROJECT_SLUG } from './lib/projectIdentity'

// persist config
{
  name: CURRENT_PERSIST_KEY,
  version: 2,
  migrate: (persistedState) => migratePersistedState(persistedState),
  partialize: getPersistedState,
  merge: mergePersistedState,
}

// backup filename prefix
 a.download = `${CURRENT_PROJECT_SLUG}-backup_${formatExportFileTime(new Date(exportedAt))}.zip`
```

Update `public/sw.js` to rename and clean legacy cache prefixes:

```js
const CACHE_NAME = 'model-playground-v0.1.5'
const LEGACY_CACHE_PREFIX = 'gpt-image-playground-v'

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .filter((key) => key.startsWith(LEGACY_CACHE_PREFIX) || key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})
```

Update visible identity files:

- `public/manifest.webmanifest`
- `index.html`
- `scripts/mock-image-api.mjs`
- `src/components/Header.tsx`
- `src/components/SettingsModal.tsx`

Use `model-playground` for slug-style identifiers and `Model Playground` where a human-facing title is needed, except where upstream MIT attribution text must still accurately refer to the original upstream project.

- [ ] **Step 4: Run focused tests again**

Run:

```bash
npm test -- src/store.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Run the full suite once before commit**

Run:

```bash
npm test
```

Expected:

- PASS

- [ ] **Step 6: Commit Task 4**

```bash
git add src/store.ts public/sw.js public/manifest.webmanifest index.html scripts/mock-image-api.mjs src/components/Header.tsx src/components/SettingsModal.tsx src/store.test.ts
git commit -m "feat: rename persisted identity to model playground"
```

## Task 5: Rename Repository Links, Package Metadata, And Docs

**Files:**
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/package.json`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/package-lock.json`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/wrangler.jsonc`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/components/HelpModal.tsx`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/components/SupportPromptModal.tsx`
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/README.md`

**Interfaces:**
- Consumes: `CURRENT_REPO`, `LEGACY_REPO`, `CURRENT_PROJECT_SLUG`
- Produces: consistent repository metadata and public documentation links for `Autumn0716/model-playground`

- [ ] **Step 1: Add a repository-link regression test if one already fits an existing test file cleanly; otherwise skip test creation and rely on focused grep verification**

If no natural unit test location exists, use grep-based verification later in this task rather than inventing brittle presentational tests.

- [ ] **Step 2: Update metadata and repository links**

Apply these exact changes:

- `package.json` name -> `model-playground`
- `package-lock.json` top-level and package entry name -> `model-playground`
- `wrangler.jsonc` name -> `model-playground`
- GitHub links in app UI -> `https://github.com/Autumn0716/model-playground`
- GitHub issues links -> `https://github.com/Autumn0716/model-playground/issues`
- `README.md` badges and links -> `Autumn0716/model-playground`
- `README.md` deploy button params -> repository URL and repository name aligned to the new repo
- `README.md` star history references -> `Autumn0716/model-playground`

Keep upstream attribution text semantically correct by referring to the original upstream project where legally necessary, while pointing maintained-project home links to the new repository where appropriate.

- [ ] **Step 3: Run focused grep verification for legacy repo references**

Run:

```bash
rg -n "CookSleep/gpt_image_playground|https://github.com/CookSleep/gpt_image_playground|https://github.com/CookSleep/gpt_image_playground/issues" . -g '!node_modules' -g '!dist'
```

Expected:

- no remaining hits, except any deliberately retained upstream-attribution text that is explicitly justified by the implementation

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected:

- PASS

- [ ] **Step 5: Commit Task 5**

```bash
git add package.json package-lock.json wrangler.jsonc src/components/HelpModal.tsx src/components/SupportPromptModal.tsx README.md
git commit -m "chore: align repo metadata with model playground"
```

## Task 6: Create New GitHub Repository And Rewire Remotes

**Files:**
- Modify: git remote configuration only
- Possible Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/.gitignore` only if `.vercel` ignore handling needs deliberate cleanup

**Interfaces:**
- Consumes: authenticated GitHub CLI session
- Produces: `Autumn0716/model-playground` repository and intended local remote steady state

- [ ] **Step 1: Verify GitHub CLI auth before making remote changes**

Run:

```bash
gh auth status
```

Expected:

- authenticated as `Autumn0716`

- [ ] **Step 2: Create the new public repository**

Run:

```bash
gh repo create Autumn0716/model-playground --public --source=. --remote=origin --push
```

Expected:

- repository created successfully
- local `origin` updated to the new repository
- current branch pushed

If `origin` cannot be replaced cleanly because it already exists, use:

```bash
gh repo create Autumn0716/model-playground --public
git remote rename origin upstream
git remote add origin https://github.com/Autumn0716/model-playground.git
git push -u origin HEAD
```

Correct the `git` commands if writing commands into code or docs; execute real `git` commands only.

- [ ] **Step 3: Preserve upstream remote to original repository**

If `origin` was replaced, ensure there is still an `upstream` remote:

```bash
git remote get-url upstream || git remote add upstream https://github.com/CookSleep/gpt_image_playground.git
```

- [ ] **Step 4: Verify remote steady state**

Run:

```bash
git remote -v
```

Expected:

- `origin` points to `Autumn0716/model-playground`
- `upstream` points to `CookSleep/gpt_image_playground`

- [ ] **Step 5: Commit only if a tracked repo file changed during this task**

If no tracked repo file changed, do not create a commit.

## Task 7: Rebuild, Reconnect, And Redeploy To Vercel

**Files:**
- Modify: none by default
- Possible Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/vercel.json` only if verification proves a deployment config issue

**Interfaces:**
- Consumes: existing Vercel CLI auth and linked project `model-playground`
- Produces: fresh successful production deployment of the renamed project

- [ ] **Step 1: Verify Vercel auth and project linkage**

Run:

```bash
vercel whoami
cat .vercel/project.json
```

Expected:

- authenticated Vercel user
- linked project name `model-playground`

- [ ] **Step 2: If needed, reconnect the Vercel project to the new GitHub repository in Vercel settings or CLI-supported flow**

The goal is repository alignment, not necessarily automatic deployment enablement.

- [ ] **Step 3: Run a fresh production build locally**

Run:

```bash
npm run build
```

Expected:

- PASS

- [ ] **Step 4: Deploy production**

Run:

```bash
vercel deploy --prod --yes --scope autumn0716s-projects --cwd /Users/jiangxun/Documents/Zcode/gpt_image_playground
```

Expected:

- successful production deployment
- production URL returned

- [ ] **Step 5: If deployment fails, fix only the deployment blocker and re-run deploy**

Allowed changes:

- Vercel link/config correction
- minimal `vercel.json` adjustment
- minimal build/deployment compatibility fix

- [ ] **Step 6: Commit only if a tracked repo file changed during this task**

If no tracked repo file changed, do not create a commit.

## Task 8: Full Verification, Including Migration And Post-Deploy Checks

**Files:**
- Modify: tests only if verification exposes a real untested bug

**Interfaces:**
- Consumes: all prior tasks
- Produces: fresh evidence for every acceptance criterion, or an incomplete status if any proof is missing

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected:

- PASS

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected:

- PASS

- [ ] **Step 3: Verify legacy naming has been removed or intentionally retained**

Run:

```bash
rg -n "gpt-image-playground|gpt_image_playground|GPT Image Playground|CookSleep/gpt_image_playground" . -g '!node_modules' -g '!dist'
```

Expected:

- only intentional legacy references remain, such as migration code or explicit upstream-attribution text

- [ ] **Step 4: Verify migrated browser-local behavior locally**

Use a controlled browser session or app-level verification harness to confirm:

- legacy localStorage data is copied to the new key
- legacy IndexedDB data is copied to the new database name
- refresh after migration keeps data
- rerunning the app does not duplicate migrated records

If a real browser verification tool is unavailable, this step is incomplete until a concrete alternative with equivalent evidence is run.

- [ ] **Step 5: Verify the deployed Vercel site after rename**

At minimum verify:

- deployed site loads normally
- visible naming is consistent with `model-playground` where intended
- repository links point to `Autumn0716/model-playground`
- no obvious rename-related regression appears on first load

- [ ] **Step 6: Record residual risks explicitly**

The final report must still call out any remaining limitations, including:

- browser-local data still does not sync across devices
- if legacy IndexedDB cleanup is intentionally deferred, say so explicitly
- if Vercel Git integration was not fully reattached automatically, say so explicitly
- any browser-level verification that could not be performed must remain marked incomplete

- [ ] **Step 7: Commit only if verification exposed a real bug and fixing it changed tracked files**

Use a bug-fix commit message that matches the actual issue.

## Self-Review

### Spec coverage

- Full rename across code, docs, hosting, and persistence: covered by Tasks 1, 4, and 5.
- Automatic migration of legacy browser-local data: covered by Tasks 2 and 3.
- New public repo `Autumn0716/model-playground`: covered by Task 6.
- Rewire remotes and Vercel alignment: covered by Tasks 6 and 7.
- Full automated verification and redeploy: covered by Tasks 7 and 8.
- Strict evidence gate and explicit residual risks: covered by Global Constraints and Task 8.

No uncovered spec requirements remain.

### Placeholder scan

- No `TBD`, `TODO`, or "implement later" markers remain.
- Every task includes concrete file paths, commands, and code snippets.
- Conditional work is tied to explicit failure states rather than vague future polish.

### Type consistency

- Project identity constants are introduced once in Task 1 and reused consistently by later tasks.
- Startup migration functions are named `migrateLegacyLocalStorage()` and `migrateLegacyIndexedDb()` consistently.
- Repository targets and slugs are consistent with the approved spec.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-model-playground-rename-and-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
