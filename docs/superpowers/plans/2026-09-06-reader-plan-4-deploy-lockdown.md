# Reader — Plan 4: GitHub Pages Deploy + Login Lockdown

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Reader to a public GitHub Pages URL that installs on a phone, without touching the owner's existing `kalaiselvan-t.github.io` personal site, and without opening it up to anyone but the owner's allowlisted Google account (already enforced by Plan 3's app-level check + Google's OAuth Testing-mode allowlist).

**Architecture:** A new, dedicated **private** GitHub repository hosts Reader as a **project page** (`kalaiselvan-t.github.io/reader/`), built and published by a **GitHub Actions** workflow on every push to `master` (Pages "Source: GitHub Actions", the modern flow — no `gh-pages` branch, no `gh` CLI needed anywhere in this plan). The existing OAuth Client from Plan 3 is reused — only its authorized origins gain one new entry — so no new Google Cloud project or consent-screen work is needed. `vite.config.ts`'s base path is mode-aware (`/` for local dev/preview, `/reader/` for the CI production build) so the established local dev workflow from Plans 1–3 (`http://localhost:5173`) keeps working unchanged.

**Tech Stack:** GitHub Actions (`actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`) — all current, verified against 2026 documentation. Existing: Vite 5, `vite-plugin-pwa`, the Plan 3 auth/Drive code (unchanged by this plan).

## Global Constraints

- Single user, no backend. This plan changes **hosting and build config only** — no application logic changes.
- New repo is **private**, a **project page** (not the user page — `~/Dev/kalaiselvan-t.github.io` is a separate, existing Next.js site and must never be touched by this plan).
- Deploy mechanism is **GitHub Actions** with Pages "Source: GitHub Actions" — not a `gh-pages` branch, not `peaceiris/actions-gh-pages`.
- `VITE_GOOGLE_CLIENT_ID` / `VITE_OWNER_EMAIL` are injected into the Actions build as **repository Variables** (not Secrets — neither value is actually sensitive: the Client ID is a public identifier by Google's own documentation, and the owner email is already visible throughout this app's own source and docs). Using Variables rather than Secrets avoids treating non-sensitive config as if it needed secret-grade handling.
- Google's "Authorized JavaScript origins" match **origin only** (scheme + host + port) — never a path. The new origin to authorize is `https://kalaiselvan-t.github.io`, with no `/reader` suffix, even though the app itself lives at `https://kalaiselvan-t.github.io/reader/`.
- `base` in `vite.config.ts` must be **mode-aware**: `/` for `dev`/`preview` (preserving the exact local workflow used in Plans 1–3), `/reader/` only for the production build the Actions workflow runs. Never make local dev require a `/reader/` prefix.
- No code in this plan touches `src/lib/auth/*`, `src/lib/drive/*`, `src/state/*`, or any component — Plan 3's app logic is unchanged; only build/deploy config and one new origin entry in Google Cloud Console are touched.
- Frequent commits — every task ends with a commit (except the owner-performed runbook task, which is documentation, and the final push task, which is explicitly confirmed with the owner before running).

---

## File Structure

```
reader/
  docs/superpowers/
    github-pages-setup-runbook.md   # owner-performed: repo, Pages source, variables, OAuth origin
  .github/
    workflows/
      deploy.yml                    # build + deploy to GitHub Pages on push to master
  vite.config.ts                    # MODIFY: mode-aware base, explicit manifest start_url/scope
```

No other files change. This is the smallest plan of the four — most of the work is owner-performed account/repo setup (documented, not automated) plus two small config surfaces.

---

### Task 1: GitHub Pages setup runbook (owner-performed)

**Files:**
- Create: `docs/superpowers/github-pages-setup-runbook.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a document the owner follows to create the new repo, configure Pages, add the two repository Variables, and add the new OAuth origin. This is an external prerequisite for Task 3's push — like Plan 3's Task 1, it requires the owner's own GitHub/Google account actions, which cannot be performed on their behalf.

**This task cannot be "tested" by code — it is written and self-checked against the checklist below.**

- [ ] **Step 1: Write `docs/superpowers/github-pages-setup-runbook.md`**

```markdown
# GitHub Pages Setup Runbook (owner-performed, one time)

This gets Reader onto a public URL you can install on your phone, without
touching your existing `kalaiselvan-t.github.io` personal site. You do these
steps yourself — repo creation and Google Cloud Console changes both require
your own login.

**Time:** ~10 minutes. **Cost:** free (GitHub Pages + Actions are free for
public and private repos on personal accounts, within generous free-tier
minutes).

## 1. Create a new, dedicated, private repository

1. Go to https://github.com/new
2. Owner: your account (`kalaiselvan-t`). Repository name: `reader`.
3. **Visibility: Private.**
4. Do **not** initialize with a README/`.gitignore`/license — this repo will
   receive the existing local history via `git push`, not start fresh.
5. Click **Create repository**. Note the remote URL shown (SSH or HTTPS,
   whichever you normally use with GitHub) — Task 3 needs it.

## 2. Set the Pages source to GitHub Actions

1. In the new repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not
   "Deploy from a branch"). Don't pick a workflow template yet — Task 2 of
   the plan adds the actual workflow file.

## 3. Add the two repository Variables

1. Go to **Settings → Secrets and variables → Actions → Variables tab**
   (not the Secrets tab — neither value here is actually sensitive).
2. Add:
   - `VITE_GOOGLE_CLIENT_ID` = the same Client ID you put in `.env.local`
     for local development (from the Plan 3 runbook).
   - `VITE_OWNER_EMAIL` = the same owner email you put in `.env.local`.

## 4. Add the new origin to your existing OAuth Client

1. Go back to https://console.cloud.google.com/apis/credentials (the same
   project you created in Plan 3's runbook).
2. Open the Web application OAuth Client you already created.
3. Under **Authorized JavaScript origins**, add:
   ```
   https://kalaiselvan-t.github.io
   ```
   **No `/reader` at the end** — Google matches origins by scheme+host+port
   only, never a path, so this one entry covers the app regardless of which
   path it's served under.
4. Save. Keep the existing `http://localhost:5173` entry too — you still
   want local dev to work.

## Known limitations (by design, not bugs)

- The repo is **private**, but the *built site* is still public once
  deployed — that's how GitHub Pages works for any repo visibility. Actual
  protection is the OAuth Testing-mode allowlist + the app's own email
  check from Plan 3, unchanged by this plan.
- The first deploy only happens after Task 3's push — nothing goes live from
  this runbook alone.
```

- [ ] **Step 2: Self-check the runbook**

Confirm it covers, in order: repo creation (private, project page, no
auto-init), Pages source set to Actions, both repository Variables, and the
new OAuth origin (origin only, no path, existing localhost entry preserved).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/github-pages-setup-runbook.md
git commit -m "docs: add GitHub Pages setup runbook for repo/Actions/OAuth origin"
```

---

### Task 2: Deploy configuration — mode-aware base path + Actions workflow

**Files:**
- Modify: `vite.config.ts`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: nothing new (uses Vite's existing `defineConfig` factory form).
- Produces: a production build whose asset paths and PWA manifest correctly resolve under `/reader/`, while `npm run dev`/`npm run preview` keep working exactly as before at the root path. A workflow that builds and deploys on every push to `master`.

**Verify before committing (base-path + PWA manifest interaction is a known gotcha across `vite-plugin-pwa` versions):** after building with `base: '/reader/'`, inspect `dist/manifest.webmanifest` directly and confirm `start_url` and `scope` are actually `/reader/` (or `/reader/index.html` / a correctly-prefixed equivalent) — do not assume the plugin infers this from `base` correctly without checking the built output. If it doesn't, set `manifest.start_url`/`manifest.scope` explicitly in the `VitePWA()` config to force it.

- [ ] **Step 1: Modify `vite.config.ts`**

Replace the whole file with:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Project-page base path, only for the production build the CI workflow
// runs. Local dev/preview stay at '/', preserving the exact workflow used
// throughout Plans 1-3 (http://localhost:5173, no /reader/ prefix).
export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/reader/' : '/';
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Precache fonts too so reading typography works fully offline.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        manifest: {
          name: 'Reader',
          short_name: 'Reader',
          start_url: base,
          scope: base,
          theme_color: '#0B0B0D',
          background_color: '#0B0B0D',
          display: 'standalone',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ]
  };
});
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

Before committing, check the current major version tags for `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages` on their GitHub Marketplace/releases pages — the versions below are believed current but a stale major tag fails the workflow with an unhelpful "unable to resolve action" error, so confirm rather than assume.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ vars.VITE_GOOGLE_CLIENT_ID }}
          VITE_OWNER_EMAIL: ${{ vars.VITE_OWNER_EMAIL }}

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Note: `npm run build` is `tsc -b && vite build` per the existing `package.json` script — Vite only applies `mode: 'production'` (and thus `base: '/reader/'`) when actually invoked in production mode, which `vite build` does by default with no extra flags needed.

- [ ] **Step 3: Verify the base-path/manifest build locally**

Run:
```bash
npm run build
cat dist/manifest.webmanifest
```
Expected: build succeeds; the printed manifest shows `"start_url":"/reader/"` and `"scope":"/reader/"` (or an equivalent correctly-prefixed form — record the exact output in the task report). Also confirm `dist/index.html` references assets under `/reader/assets/...`, not `/assets/...`.

- [ ] **Step 4: Confirm local dev is unaffected, and record `preview`'s expected new behavior**

Run `npm run dev`, confirm the app still loads at `http://localhost:5173` (no `/reader/` prefix needed) exactly as in Plans 1-3. This is the regression check for the mode-aware base — do not skip it.

Then run `npm run build && npm run preview` and confirm the app now serves correctly at `http://localhost:4173/reader/` — and that `http://localhost:4173/` (root, no prefix) is now blank/404. **This is expected, not a bug**: `preview` serves the production build, which now carries `base: '/reader/'`. Plan 1's Task 9 and Plan 2's Task 7 both used bare `npm run preview` for service-worker/offline checks — write this down explicitly in the task report so a future offline/SW check under `preview` isn't mistaken for a deploy regression when it's just navigating to the wrong path.

- [ ] **Step 5: Simulate a cold CI checkout locally**

The Actions workflow runs `npm ci && npm test && npm run build` on a completely fresh checkout — closer to that than any state this repo has been in locally so far. Simulate it:
```bash
rm -rf node_modules .ts-build-node
npm ci
npm test
npm run build
```
Expected: all three succeed with no leftover local build state to lean on. This specifically checks that `tsc -b`'s composite build (writing to `.ts-build-node/`, the Plan 1 Task 1 fix) works correctly from nothing, not just incrementally on top of an existing `.tsbuildinfo`.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts .github/workflows/deploy.yml
git commit -m "feat: mode-aware Pages base path and GitHub Actions deploy workflow"
```

---

### Task 3: First push to the new remote (owner confirmation required)

**Files:** none (git operations only).

**Interfaces:**
- Consumes: the new repo's remote URL from Task 1 (owner must have completed Task 1 first — repo exists, Pages source set to Actions, both Variables added).
- Produces: `master` pushed to the new `origin` remote, triggering the Actions workflow for the first time.

**This step visibly publishes the repository and triggers a real deploy — get explicit confirmation from the owner before running it, even though the repo is private.** Do not run this step automatically as part of a larger batch; treat it as its own checkpoint.

- [ ] **Step 1: Confirm with the owner**

Ask: "Task 1's runbook (new private repo, Pages source, Variables, OAuth origin) — is it done? What's the new repo's remote URL?" Do not proceed without an explicit go-ahead and the URL.

- [ ] **Step 2: Add the remote, verify it, then push**

```bash
git remote add origin <the URL the owner provided>
git remote -v
```
**Safety check before pushing — do not skip:** confirm the printed URL
contains `/reader` and does **not** contain `kalaiselvan-t.github.io`. The
existing personal site repo's remote would contain that string in its repo
name; the correct new repo's remote will not. This is the one check that
actually prevents a mistyped/misremembered URL from pushing Reader's
history into the owner's existing personal site repo — a one-character
typo away and genuinely destructive if it happened. If the check fails,
stop and get the correct URL from the owner before proceeding.

```bash
git push -u origin master
```
Expected: push succeeds. If `origin` already exists from a prior attempt, use `git remote set-url origin <url>` instead of `add`, then re-run the same safety check before pushing.

- [ ] **Step 3: Watch the Actions run**

If `gh` CLI is unavailable (it is, in this environment) and the owner isn't
watching the Actions tab themselves, ask the owner to check
`https://github.com/kalaiselvan-t/reader/actions` and report whether the
workflow succeeded, or paste any failure output. This plan has no way to
poll GitHub Actions status without either `gh` or the owner's own browser.

---

### Task 4: Live verification

**Files:** none.

**Interfaces:** none new — this is verification only.

**Two independent halves, same pattern as Plan 3's Task 7:**

- [ ] **Step 1: App shell verification (once Actions succeeds — needs Task 3 done)**

Attempt to navigate to `https://kalaiselvan-t.github.io/reader/` with this
session's browser tooling first and report what actually happens — prior
tasks in this project only ever exercised `localhost`, so whether this
tool can reach the public internet at all is unverified, not assumed. If it
can't reach the URL, ask the owner to do this verification themselves and
report back, rather than assuming success or failure. Confirm:
1. The app loads with the premium dark theme, not a 404 or blank page.
2. DevTools/Application → Manifest shows the correct `start_url`/`scope`
   (`/reader/`) and both icons load.
3. A service worker registers and reaches "activated".
4. The install prompt / add-to-home-screen affordance is available.

- [ ] **Step 2: OAuth-from-new-origin verification (requires the owner, same constraint as Plan 3 Task 7)**

Click "Connect Drive" from the deployed URL and confirm sign-in still works
now that `https://kalaiselvan-t.github.io` is an authorized origin. If this
session's browser tooling hits the same one-popup-per-session limitation
observed during Plan 3's live verification, ask the owner to do this step
themselves and report back — do not fabricate a result.

- [ ] **Step 3: Confirm the existing personal site is untouched**

Visit `https://kalaiselvan-t.github.io/` (root, no `/reader/`) and confirm
it still shows the owner's existing personal Next.js site, completely
unaffected by this deploy. This is the one regression this whole plan exists
to avoid — treat it as a hard gate, not a formality.

- [ ] **Step 4: Record results**

Write the actual outcome of all three steps (including any part that had to
be deferred to the owner) into `docs/superpowers/plan-4-followups.md`,
following the same pattern as Plans 1-3's followups docs.

---

## Self-Review

**1. Spec coverage (design spec §3 hosting + §4 access control, plus the decisions confirmed before Plan 3 started):**
- New dedicated repo, project page, not the user page → Task 1. ✅
- GitHub Actions auto-deploy → Tasks 2, 3. ✅
- Private repo → Task 1. ✅
- Authorized origin added to the existing OAuth Client (§4.3's client reused, not recreated) → Task 1. ✅
- Accepted limitation restated (§4: static shell is publicly fetchable regardless of repo visibility; only login is gated) → Task 1's runbook "Known limitations" section, consistent with the original design spec's own accepted limitation. ✅

**2. Placeholder scan:** No "TBD"/"configure appropriately" — every step has literal file content or exact commands. Task 1 and Task 4 Step 2 are explicitly owner-dependent, disclosed the same honest way Plan 3 disclosed its external dependency, not hidden as if code-only.

**3. Type consistency / config consistency:** `vite.config.ts`'s `base` value is computed once and reused for both the top-level `base` key and `manifest.start_url`/`manifest.scope`, so they can never drift apart. The workflow's `VITE_GOOGLE_CLIENT_ID`/`VITE_OWNER_EMAIL` env var names match exactly what `src/lib/auth/google.ts` and `src/state/auth.tsx` already read via `import.meta.env` (unchanged from Plan 3 — verified by reading those files' existing `import.meta.env.VITE_*` references before writing this plan). ✅

**4. Blast-radius check specific to this plan:** every task was written to avoid any file, remote, or account outside the new dedicated repo and the one new OAuth origin entry. Nothing in this plan writes to `~/Dev/kalaiselvan-t.github.io`, modifies the existing OAuth Client's other settings, or touches `src/lib/auth/*`/`src/lib/drive/*`/`src/state/*`. Task 3 (the only step with a real external side effect before Task 4's verification) is explicitly gated on owner confirmation, not bundled into automatic execution.

---

## Notes

This is the last plan in the original four-plan roadmap (Foundation → Speed
Reading → Google Drive → Deploy). No further plans are implied by the
original design spec; any future work (PDF support, cross-device sync,
annotations — all explicitly deferred in Plan 1's spec §11) would need its
own fresh brainstorm.
