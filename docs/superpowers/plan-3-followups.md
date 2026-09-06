# Plan 3 — Follow-ups & Manual Verification

Plan 3 (Google Drive Integration) is complete and **live-verified**:
100% client-side OAuth via Google Identity Services (single `drive.readonly`
scope, no backend), a single-owner email allowlist, and a pasted-folder-link
sync flow into the existing library. All 7 tasks were implemented, reviewed,
and the final whole-branch review is clean after one fix wave. Build,
type-check, and all 47 unit tests are green.

## Live verification — done (2026-09-06)

Verified against a real Google account (`kalaisbooks@gmail.com`, a dedicated
books account, not the owner's personal email):
- Google Cloud Console setup completed (project, Drive API, OAuth consent
  screen, Client ID).
- Sign-in, Drive's `about`-endpoint email lookup, and the allowlist check all
  confirmed working live — including catching and fixing a real typo
  (`.env.local` had `kalaisbooks0@gmail.com`, missing/extra digit vs. the
  actual account) via the allowlist correctly rejecting the mismatch first.
- Folder sync, library persistence, and re-sync dedup confirmed working by
  the owner directly (bypassed this session's browser-automation tool, which
  hit a one-popup-per-session limitation unrelated to the app).
- Folder-link persistence confirmed: once synced successfully, the folder
  link is remembered in settings and pre-filled next time — no need to
  re-paste it. The Drive *connection* (access token) is intentionally
  session-only per the security design, so "Connect Drive" needs a fresh
  click periodically (~hourly token expiry, ~7-day re-consent in Testing
  mode) — this is expected, not a bug.
- Confirmed EPUB-only filtering is working as designed (PDF was deferred
  from the very first brainstorm — see the design spec's Non-goals).
- Confirmed the Play Books gap is the pre-known limitation, not a Drive Sync
  defect: Play Books has no API and DRM-locks purchases, so books already in
  Play Books don't appear in Drive automatically. The only path in is
  exporting a DRM-free EPUB (works only for personally-uploaded, non-DRM
  titles) into the synced folder, or using "Open EPUB" locally for files not
  going through Drive at all.

## New finding from live verification (not yet fixed)

**"Connecting…" has no timeout if the OAuth popup fails to open.** While
debugging the browser-automation tool's popup block, `google.ts`'s
`requestAccessToken()` was observed to hang indefinitely with no error
message when `window.open` fails (e.g. a real user's browser blocking the
popup, an ad-blocker, or losing the "user gesture" window by clicking too
slowly after page load). The promise from `initTokenClient(...)
.requestAccessToken()` simply never resolves or rejects in that case — GIS
only logs to the console (`[GSI_LOGGER]: Failed to open popup window...`),
which the app doesn't listen for. A real user hitting this would be stuck on
"Connecting…" with no feedback and no way to recover short of reloading the
page.
- **Severity:** Minor/Important border — didn't block the owner's own
  successful verification (their browser allowed the popup), but is a real
  gap for any browser with a popup blocker.
- **Fix (for a future pass):** race `requestAccessToken()` against a short
  timeout (e.g. 15s) in `connect()`, and on timeout show a clear message
  ("Pop-up blocked? Check your browser's pop-up settings and try again")
  rather than hanging silently.

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
