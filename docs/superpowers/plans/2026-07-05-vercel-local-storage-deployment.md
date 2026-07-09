# Vercel Local Storage Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `gpt_image_playground` to Vercel as a static frontend and verify that local browser persistence, including `generalApiProfiles`, still works on the deployed origin.

**Architecture:** Keep the application as a pure Vite static build hosted by Vercel. Prefer zero business-logic changes, add only the narrowest regression coverage needed to lock in settings persistence, and treat deployment-specific fixes as conditional work that only happens if fresh verification shows a failure.

**Tech Stack:** React 19, TypeScript, Vite 6, Zustand persist, Vitest, Vercel static hosting, browser local storage and IndexedDB

## Global Constraints

- No task is considered complete without fresh verification evidence.
- No claim such as "build passes", "deployment works", or "local persistence is preserved" is acceptable unless it is backed by a current command run or live deployment check.
- Any item that cannot be verified remains incomplete and must be reported as such.
- Any residual risk that remains after verification must be stated explicitly.
- This work does not include cross-device sync.
- This work does not include user accounts or authentication.
- This work does not include server-side database storage.
- This work does not include moving browser data to Vercel storage.
- This work does not include implementing a Vercel Function proxy.
- This work does not include changing the current local persistence model from browser storage to a remote store.
- Default expectation: no business logic changes, no persistence model changes, no schema changes, and no UI changes required for this deployment goal.
- Only make scoped deployment-related changes if verification reveals a real issue.

---

## File Structure

- Modify: `src/store.test.ts`
  - Add a direct regression test that proves `getPersistedState()` retains `settings.generalApiProfiles` and `settings.generalActiveProfileId` in the persisted Zustand payload.
- Modify: `README.md`
  - Only if deployment verification reveals a documentation gap around domain-bound local storage or Vercel verification steps.
- Modify: `vite.config.ts`
  - Only if Vercel verification reveals a static asset or base-path failure.
- Modify: `public/sw.js`
  - Only if Vercel verification reveals a deployment-only service worker cache regression.
- Create: `docs/superpowers/plans/2026-07-05-vercel-local-storage-deployment.md`
  - This implementation plan.

## Task 1: Lock In General API Profile Persistence With a Store-Level Regression Test

**Files:**
- Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/store.test.ts`
- Test: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/src/store.test.ts`

**Interfaces:**
- Consumes: `getPersistedState(state: AppState): Record<string, unknown>` from `src/store.ts`
- Consumes: `useStore` from `src/store.ts`
- Consumes: `DEFAULT_SETTINGS` from `src/lib/apiProfiles.ts`
- Produces: a regression test proving the persisted payload keeps `settings.generalApiProfiles` and `settings.generalActiveProfileId`

- [ ] **Step 1: Add a failing regression test in `src/store.test.ts`**

Insert this test near the existing `input persistence setting` coverage so persistence tests stay grouped:

```ts
it('persists general API profiles inside settings', () => {
  useStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      generalApiProfiles: [
        {
          id: 'default-general',
          name: '默认',
          baseUrl: '',
          apiKey: '',
          apiMode: 'chat',
          apiProxy: false,
        },
        {
          id: 'gp-relay',
          name: 'Relay',
          baseUrl: 'https://relay.example.com/v1',
          apiKey: 'sk-relay',
          apiMode: 'responses',
          apiProxy: false,
        },
      ],
      generalActiveProfileId: 'gp-relay',
    },
  })

  const persisted = getPersistedState(useStore.getState()) as {
    settings?: {
      generalApiProfiles?: Array<{
        id: string
        name: string
        baseUrl: string
        apiKey: string
        apiMode: string
        apiProxy: boolean
      }>
      generalActiveProfileId?: string
    }
  }

  expect(persisted.settings?.generalActiveProfileId).toBe('gp-relay')
  expect(persisted.settings?.generalApiProfiles).toEqual([
    {
      id: 'default-general',
      name: '默认',
      baseUrl: '',
      apiKey: '',
      apiMode: 'chat',
      apiProxy: false,
    },
    {
      id: 'gp-relay',
      name: 'Relay',
      baseUrl: 'https://relay.example.com/v1',
      apiKey: 'sk-relay',
      apiMode: 'responses',
      apiProxy: false,
    },
  ])
})
```

- [ ] **Step 2: Run the focused store test file**

Run:

```bash
npm test -- src/store.test.ts
```

Expected:

- If the persistence path is already correct, this passes immediately.
- If it fails, the failure must mention missing or mismatched `generalApiProfiles` / `generalActiveProfileId` in `persisted.settings`.

- [ ] **Step 3: Only if the new test fails, make the minimal implementation fix**

Inspect these functions in `src/store.ts` and change only the narrowest broken path:

- `getPersistedState`
- `mergePersistedState`

The required behavior is:

```ts
function getPersistedState(state: AppState) {
  const settings = normalizeSettings(state.settings)
  return {
    settings,
    // existing persisted fields remain unchanged
  }
}
```

If a fix is needed, it must preserve the existing persisted shape and keep `settings` as the normalized source of truth.

- [ ] **Step 4: Re-run the focused store test file**

Run:

```bash
npm test -- src/store.test.ts
```

Expected:

- PASS
- The new persistence regression test passes with the rest of `src/store.test.ts`

- [ ] **Step 5: Commit the test or minimal fix**

```bash
git add src/store.test.ts src/store.ts
git commit -m "test: lock general api profile persistence"
```

If `src/store.ts` did not change, commit only the test file:

```bash
git add src/store.test.ts
git commit -m "test: lock general api profile persistence"
```

## Task 2: Verify Local Production Build Matches Vercel's Static Deployment Shape

**Files:**
- Modify: none by default
- Possible Modify if verification fails: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/vite.config.ts`
- Possible Modify if verification fails: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/public/sw.js`

**Interfaces:**
- Consumes: `build` script from `package.json`
- Consumes: static asset config from `vite.config.ts`
- Consumes: service worker registration behavior from `src/main.tsx` and `public/sw.js`
- Produces: fresh build evidence and, only if needed, a minimal deployment-specific fix

- [ ] **Step 1: Run the production build**

Run:

```bash
npm run build
```

Expected:

- TypeScript build completes
- Vite build completes
- `dist/` is emitted successfully

- [ ] **Step 2: If the build fails, capture the exact failing output and fix only the deployment blocker**

Possible narrow fixes if verification shows a real issue:

- update a Vite config value in `vite.config.ts`
- fix a production-only static asset path assumption
- fix a service worker cache/path assumption in `public/sw.js`

Do not modify business logic, profile models, or persistence behavior during this step unless the failure explicitly proves they are the cause.

- [ ] **Step 3: Re-run the production build after any fix**

Run:

```bash
npm run build
```

Expected:

- PASS with exit code 0

- [ ] **Step 4: Inspect the built static shape**

Run:

```bash
ls dist
```

Expected:

- `index.html` present
- static assets directory present
- public assets such as `sw.js`, `manifest.webmanifest`, and `pwa-icon.svg` present if copied through build

- [ ] **Step 5: Commit only if a build-specific fix was required**

If a code/config fix was made:

```bash
git add vite.config.ts public/sw.js
git commit -m "fix: align static build with vercel deployment"
```

If no fix was needed, do not create a commit for this task.

## Task 3: Configure and Deploy the Existing Static Frontend to Vercel

**Files:**
- Modify: none by default
- Possible Modify: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/README.md`

**Interfaces:**
- Consumes: `vercel.json`
- Consumes: Vercel project settings
- Produces: a live Vercel deployment URL and deployment status evidence

- [ ] **Step 1: Confirm existing Vercel config is still minimal and in-scope**

Read and verify:

- `vercel.json` only disables automatic deployments by default
- no new Vercel runtime behavior is being introduced in this phase

- [ ] **Step 2: Create or update the Vercel project with static build settings**

Use these settings in Vercel:

- Framework Preset: `Vite` or verified equivalent auto-detection
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: default package-manager install unless Vercel requires an override

Optional environment variables only if actually needed:

- `VITE_DEFAULT_API_URL`
- `VITE_SHOW_DEFAULT_CONFIG_ONLY`

Do not configure:

- Vercel Functions
- server-side API proxy settings
- database credentials
- sync-related secrets

- [ ] **Step 3: Trigger a fresh deployment**

Run one of the following, depending on available tooling:

```bash
vercel --prod
```

or deploy through the Vercel dashboard and record the resulting production URL.

Expected:

- deployment finishes successfully
- a live site URL is available

- [ ] **Step 4: If deployment fails, fix only the exact deployment blocker**

Allowed narrow fixes:

- Vercel project setting correction
- `README.md` clarification if the deployment workflow itself was misleading
- static build config adjustment already identified in Task 2

Not allowed:

- broad refactors
- backend additions
- storage model changes

- [ ] **Step 5: Re-deploy after any fix**

Run the same deployment path again and confirm a successful publish.

- [ ] **Step 6: Commit documentation changes only if they were necessary**

If `README.md` changed:

```bash
git add README.md
git commit -m "docs: clarify vercel local storage deployment"
```

If no repo files changed in this task, do not create a commit.

## Task 4: Verify Live Browser Persistence on the Deployed Origin

**Files:**
- Modify: none by default
- Possible Modify if verification reveals a real issue: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/vite.config.ts`
- Possible Modify if verification reveals a real issue: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/public/sw.js`
- Possible Modify if verification reveals a real issue: `/Users/jiangxun/Documents/Zcode/gpt_image_playground/README.md`

**Interfaces:**
- Consumes: deployed Vercel URL from Task 3
- Consumes: UI path for editing general API profiles
- Produces: live verification evidence that persistence survives refresh and reopen on the same origin

- [ ] **Step 1: Open the deployed site in a clean browser session**

Use a real browser session against the deployed Vercel URL. Prefer a clean profile or private window if needed so prior local state does not mask regressions.

Expected:

- site loads normally
- no obvious deployment-only blank screen or broken asset issue

- [ ] **Step 2: Create or edit a general API profile and record exact values**

Use a distinct test profile such as:

- Name: `Relay Verification`
- Base URL: `https://relay.example.com/v1`
- API Key: `sk-relay`
- API Mode: `responses`
- API Proxy: `off`

Expected:

- profile saves normally in the UI
- the profile becomes selectable or remains visible in the general API settings area

- [ ] **Step 3: Refresh the page and verify same-origin persistence**

Refresh the browser tab.

Expected:

- the `Relay Verification` profile still exists
- the expected active general API profile remains selected if that is how the UI currently behaves

- [ ] **Step 4: Close and reopen the same deployed origin in the same browser**

Close the tab, reopen the exact same deployed URL in the same browser profile.

Expected:

- the `Relay Verification` profile still exists
- the expected general API settings remain available

- [ ] **Step 5: Verify standard image API profile persistence still works**

Create or edit a standard image API profile, then refresh once.

Expected:

- standard API profile persistence still works
- no regression was introduced by the deployment path

- [ ] **Step 6: If live persistence verification fails, isolate the failure class before making changes**

Classify the failure as one of:

- build/deploy asset failure
- service worker stale cache failure
- storage rehydration failure
- domain/origin mismatch caused by using a different URL than the saved data

Only then make the narrowest applicable fix.

- [ ] **Step 7: Re-run the live persistence verification after any fix**

Repeat Steps 1 through 5 on the fresh deployed build.

Expected:

- all live persistence checks pass on the deployed origin

- [ ] **Step 8: Commit only if a deployment-specific repo fix was required**

Examples:

```bash
git add vite.config.ts public/sw.js README.md
git commit -m "fix: preserve vercel deployment persistence behavior"
```

If no repo files changed in this task, do not create a commit.

## Task 5: Record Verification Evidence and Residual Risks Before Claiming Completion

**Files:**
- Modify: none unless documentation needs a final clarification

**Interfaces:**
- Consumes: build output from Task 2
- Consumes: Vercel deployment result from Task 3
- Consumes: live-site persistence verification from Task 4
- Produces: final status report that distinguishes verified completion from remaining risk or missing evidence

- [ ] **Step 1: Gather fresh evidence for every required claim**

Collect the results for:

- `npm run build`
- Vercel deployment success
- live deployed-site persistence across refresh
- live deployed-site persistence across reopen on the same browser and same origin

- [ ] **Step 2: Check every acceptance criterion against evidence**

Acceptance criteria to verify one by one:

- Vercel deployment completes successfully
- the site loads normally
- general API profiles can be created or edited on the deployed site
- general API profiles remain after refresh on the same domain
- local settings remain after reopening the same deployed domain in the same browser
- no backend infrastructure was required for this scope

- [ ] **Step 3: State residual risks explicitly**

The final report must still call out any remaining expected browser-local limitations, including:

- switching domains creates a new browser storage origin
- clearing site data removes local state
- changing browser or device does not carry local state across

- [ ] **Step 4: If any evidence is missing or failing, mark the task incomplete**

Use this rule exactly:

- missing verification means incomplete
- blocked deployment means incomplete
- failing live persistence check means incomplete

- [ ] **Step 5: Commit only if this task required a final repo documentation change**

```bash
git add README.md
git commit -m "docs: document verified vercel local storage behavior"
```

If no file changed, do not create a commit.

## Self-Review

### Spec coverage

- Static Vercel deployment only: covered by Tasks 2 and 3.
- Preserve browser-local persistence for `generalApiProfiles`: covered by Tasks 1 and 4.
- Zero business-logic change preference: enforced in Tasks 2 through 4 as conditional-fix-only work.
- Fresh verification evidence before completion: enforced in Tasks 2 through 5.
- Residual risks stated explicitly: covered in Task 5.

No uncovered spec requirements remain.

### Placeholder scan

- No `TBD`, `TODO`, or deferred implementation markers remain.
- Every code-changing task contains concrete file paths, commands, and code snippets.
- Conditional fix tasks are constrained to exact failure classes rather than vague "handle edge cases" wording.

### Type consistency

- Uses existing `getPersistedState(state)` and `useStore` interfaces from `src/store.ts`.
- Uses `settings.generalApiProfiles` and `settings.generalActiveProfileId` names consistent with `src/types.ts` and `src/lib/apiProfiles.ts`.
- No later task depends on an interface that is not named earlier in the plan.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-vercel-local-storage-deployment.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
