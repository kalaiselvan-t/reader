# Plan 4 — Follow-ups & Manual Verification

Plan 4 (GitHub Pages Deploy + Login Lockdown) is complete and **live-verified**
at `https://kalaiselvan-t.github.io/reader/`. All 4 tasks were implemented,
reviewed, and the app is deployed via GitHub Actions on every push to
`master`.

## Revision during execution: private repo → public repo

The plan originally specified a **private** dedicated repo. Task 1's task
review caught a real, load-bearing defect before any repo was created:
GitHub Pages does not serve private repos on GitHub's Free plan — that
requires GitHub Pro/Team/Enterprise (confirmed via WebSearch against current
GitHub docs). The owner chose to make the repo **public** rather than
upgrade, since actual protection was always the OAuth Testing-mode allowlist
+ the app's own email check, not repo visibility. The plan file, the
runbook, and the Self-Review section were all updated to reflect this before
the runbook was executed. No secrets live in the repo — the OAuth Client ID
and owner email are both non-sensitive, injected as Actions Variables.

## Owner-performed setup (Task 1) — done live, not just documented

Unlike Plan 3's Google Cloud Console runbook (which the owner ran through
manually while the controller watched), this session's Browser-pane tool
was already logged out of GitHub. The owner logged into GitHub in the
Browser pane directly (never touched by the controller — no password or
token was seen or handled), after which the controller drove the actual
clicks:
- Created `kalaiselvan-t/reader`: public, no auto-init files.
- Set Pages source to "GitHub Actions".
- Added repository Variables `VITE_GOOGLE_CLIENT_ID` and `VITE_OWNER_EMAIL`
  (`kalaisbooks@gmail.com`).
- Added `https://kalaiselvan-t.github.io` (no `/reader` path) as a new
  Authorized JavaScript origin on the existing `reader-web` OAuth Client,
  alongside the preserved `http://localhost:5173` entry. Confirmed via a
  still-live Google Cloud Console session from Plan 3, logged in as the
  correct dedicated `kalaisbooks@gmail.com` account.

## First push — a real mistake, caught and corrected before real harm

The controller's first `git push -u origin master` was run while checked
out on the `plan-4-deploy-lockdown` feature branch. `git push` resolves
refs from the *local* branch of the same name, not the currently checked
out branch — so it pushed local `master`'s stale tip (before Tasks 1/2's
commits), not the branch actually being worked on. Nothing destructive
happened (no history was lost or overwritten), but the pushed `master` was
missing `.github/workflows/deploy.yml` and the `vite.config.ts` changes,
which is why the Actions tab showed no workflow at all on first check.

Caught by checking `origin/master` after the push and finding it stale.
Fixed by: confirming `master` was a strict fast-forward ancestor of
`plan-4-deploy-lockdown` (`git merge-base --is-ancestor`), merging locally
(`--ff-only`, no conflicts possible), re-running the full test suite on the
merged result (47/47 passing), re-running the plan's remote-URL safety
check, then pushing the corrected `master`. The first real Actions run
(`Deploy to GitHub Pages #1`, commit `8f131ff`) succeeded in 49s.

**Lesson for future plans:** when a plan's task pushes `master` to a new
remote from a session that has been working on a feature branch throughout,
the push step must explicitly say "first confirm you are checked out on
master (or merge the feature branch into master) before pushing" — "push
master" is ambiguous when the working directory's current branch differs
from the ref name being pushed.

## SSH access — a real gap the plan didn't anticipate

The plan assumed a working `git push` once the remote was added, but this
environment had no GitHub credentials configured at all: no `gh` CLI, no
stored HTTPS credential, and no SSH key registered on the owner's GitHub
account. HTTPS push failed outright (`could not read Username`). The
controller does not accept or use personal access tokens on the owner's
behalf under any circumstance, even if offered directly — so the resolution
was: the owner added this environment's existing SSH public key
(`~/.ssh/id_ed25519.pub`) to their GitHub account's SSH keys
(Authentication Key type, not Signing Key), after which `git push` over SSH
worked normally. Worth remembering for any future environment that needs to
push to a new GitHub remote for the first time.

## Live verification — done (2026-09-06)

- **App shell:** `https://kalaiselvan-t.github.io/reader/` loads the
  correct dark-themed app (not a 404/blank page). Manifest fetched directly
  and confirmed: `start_url` and `scope` are both `/reader/`, icons
  (192/512) both return `200 image/png`. A service worker is registered at
  scope `/reader/` and reached `active: "activated"`.
  - **Not verified:** the actual install/add-to-home-screen prompt
    affordance. Chrome's `beforeinstallprompt` heuristics don't reliably
    fire in this browser-automation context the same way they would in a
    real user session, so this specific sub-check could not be confirmed
    here. Worth a manual check from a real phone/browser at some point, not
    blocking.
- **OAuth from the new origin:** hit the same one-popup-per-browser-session
  limitation documented in `plan-3-followups.md` during Plan 3's live
  verification — this browser-automation tool had already used its one real
  interactive Google popup earlier in the session and could not open a
  second one (`[GSI_LOGGER]: Failed to open popup window`). The outgoing
  auth request itself was inspected and is correctly formed: it carries
  `origin=https%3A%2F%2Fkalaiselvan-t.github.io`, matching the newly
  authorized origin — so this should work correctly the moment a real user
  clicks "Connect Drive" in an actual browser. **Deferred to the owner** to
  confirm directly, same as Plan 3. This also reproduces the previously
  logged, still-unfixed "Connecting… has no timeout" gap (see
  `plan-3-followups.md`) — no new information there, just re-confirmed.
- **Hard gate — existing personal site untouched:** confirmed.
  `https://kalaiselvan-t.github.io/` (bare root, no `/reader/`) still loads
  "Kalaiselvan Thangaraj's Portfolio" — the owner's existing personal
  Next.js site — completely unaffected. This was the one regression this
  entire plan existed to avoid.

## Deferred minors (non-blocking for a single-user v1)

- `vite.config.ts`'s comment "Local dev/preview stay at '/'" is factually
  inaccurate for `preview` — `vite preview` resolves to production mode by
  default, so `base` is `/reader/` under preview too, not `/`. Self-flagged
  during Task 2's implementation; left as-is since it was the brief's
  literal text. Worth a one-line wording fix in a future pass.
- `.github/workflows/deploy.yml`'s `concurrency.cancel-in-progress: true`
  could in principle cancel an in-flight Pages deployment on a rapid
  double-push. Matches the plan's explicit spec (GitHub's own common
  pattern), not a defect; flagged as a possible future change to `false` if
  this ever becomes a real problem at this project's push cadence (unlikely
  for a single-user hobby project).
- The workflow pins Node 20 in CI while local development runs Node 24;
  intentional (LTS stability in CI), not a gap.
- No automated test exists for the actual Actions-triggered deploy itself
  (inherently untestable without a real push) — covered instead by this
  live verification.

## Next

This was the last plan in the original four-plan roadmap (Foundation →
Speed Reading → Google Drive → Deploy). Any future work (PDF support,
cross-device sync, annotations — all explicitly deferred from the original
design spec) would need its own fresh brainstorm.
