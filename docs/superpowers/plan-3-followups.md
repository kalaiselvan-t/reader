# Plan 3 — Follow-ups & Manual Verification

Plan 3 (Google Drive Integration) is complete: 100% client-side OAuth via
Google Identity Services (single `drive.readonly` scope, no backend), a
single-owner email allowlist, and a pasted-folder-link sync flow into the
existing library. All 7 tasks were implemented, reviewed, and the final
whole-branch review is clean after one fix wave. Build, type-check, and all
47 unit tests are green.

## Owner action required before this is usable (not done yet)

**You haven't completed the Google Cloud Console setup**, so Drive sync is
currently unusable end-to-end (the app correctly shows a "not set up" state
rather than crashing). Follow
[docs/superpowers/google-drive-setup-runbook.md](google-drive-setup-runbook.md)
(~10 minutes) whenever you're ready:
1. Create a Google Cloud project, enable the Drive API.
2. Configure the OAuth consent screen (External, Testing, single
   `drive.readonly` scope, add yourself as a test user).
3. Create an OAuth Client ID (Web application, `http://localhost:5173`
   authorized origin).
4. Put the Client ID and your email in `.env.local` (gitignored).

## Live verification — do this once `.env.local` is set (not yet done)

This is the one thing that could not be verified without your own Google
account:
1. Open the app, click "Connect Drive" — Google's consent popup should open.
2. Sign in with your account — the folder-link input should appear.
3. Confirm the account's email is read correctly (the app reads it via
   Drive's own `about` endpoint, not a separate OIDC scope — a genuinely
   novel path, not previously exercised against a real account).
4. Paste a real Drive folder link containing at least one EPUB, click Sync —
   it should download and appear in the library; re-clicking Sync should
   report it as already-had, not re-added.
5. Paste an unrelated/nonexistent ID — should show "wasn't found," not a
   silent "Added 0."
6. If a second Google account is available, confirm it's rejected with the
   "denied" message and never reaches the library.
7. **New check, added after the final review's fix:** let a token actually
   expire (or manually revoke it via
   [myaccount.google.com/permissions](https://myaccount.google.com/permissions)),
   then click Sync — confirm you're signed out with a "Drive session
   expired — connect again" message, and that clicking Connect Drive works
   again. This is the fix for the Important finding below.

## Deferred minors (non-blocking for a single-user v1)

- **Relinking resets a book's `addedAt`.** A book imported locally months
  ago jumps to the top of the library on its first Drive sync (library sorts
  by `addedAt`). Reading progress is unaffected (keyed by content hash, not
  by `addedAt`). Fix would preserve the original `addedAt` on the relink path.
- **`connect()`'s error catch doesn't null `accessToken`/`email`.** Not
  currently reachable as a bug (the only caller path already has both null),
  but latent — worth hardening if a "reconnect while already signed in"
  entry point is ever added.
- **The folder-link text input has no custom styling** — it renders with
  browser-default light chrome inside the dark surface. Matches an existing
  gap (`<select>` elements elsewhere are also unstyled), not a new
  regression.
- **`listEpubFiles` doesn't paginate** (`pageSize=1000`, no `nextPageToken`
  handling) — silently truncates a folder larger than 1000 items. Fine at
  personal-library scale.
- **`parseFolderId` is called twice per sync** (once inside `syncDriveFolder`,
  once in the panel to persist the setting) — harmless, the second call's
  `?? undefined` fallback is unreachable dead code since a parse failure
  would have already thrown before that point.
- **A stale "Drive session expired" message can linger** after a successful
  reconnect, until the next Sync click clears it (the panel is mounted once
  at the app root, so its message state isn't reset across a
  disconnect→reconnect cycle). Cosmetic, self-clears.
- **A 403 from Drive's rate-limit errors** also triggers the new
  "session expired, please reconnect" path (indistinguishable from an actual
  auth failure at the HTTP-status level). Rare at single-user scale; the
  fallback (reconnect) still works even though the message is imprecise.
- No unit tests exist yet for `driveClient.ts`'s three functions or
  `syncDriveFolder`'s branching logic (added/skipped/failed/relinked) — the
  final review's own recommendation is that this is the highest-value gap to
  close next, since two of the three fix-wave bugs lived in exactly that
  untested surface.

## Next

- **Plan 4 — GitHub Pages deploy + single-account login lockdown.** New
  dedicated private repo (project page, `kalaiselvan-t.github.io/reader/`),
  GitHub Actions auto-deploy, adding the deployed origin to the OAuth
  Client's authorized origins (another owner-performed Google Cloud step),
  and injecting the env vars as GitHub Actions secrets at build time. Not
  yet written as a plan.
