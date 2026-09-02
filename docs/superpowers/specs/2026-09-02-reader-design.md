# Reader — Design Spec (v1)

**Date:** 2026-09-02
**Status:** Approved design — pending spec review before implementation plan
**Owner:** kalai (personal, single-user)

---

## 1. Summary

A personal, installable **PWA ebook reader** with a premium dark reading
aesthetic and two switchable speed-reading modes (RSVP + Bionic), both driven by
a press-and-hold interaction. Books come from the user's **Google Drive** and
from **local files**. EPUB only for v1 (PDF deferred). Runs fully client-side,
hosted on GitHub Pages, with login locked to a single Google account.

Built for one user (kalaiselvant0@gmail.com). No multi-user, no backend.

---

## 2. Goals & non-goals

### Goals
- Read EPUB books with a calm, premium, dark reading experience.
- Two speed-reading modes, switchable, both using press-and-hold.
- Library sourced from Google Drive (synced + cached offline) and local files.
- Installable to phone home screen; works offline after first load/download.
- Resume each book exactly where it was left off.
- Only the owner can log in and use it.

### Non-goals (v1)
- **PDF** rendering (deferred to v2 — noted in §11).
- **Google Play Books** direct sync — technically impossible (no API, DRM).
  Bridge path documented in §5.
- Highlights / annotations / notes.
- Cross-device account sync of reading position (position is per-device in v1).
- Dictionary lookup, text-to-speech, social features.

---

## 3. Platform & architecture

- **Type:** Progressive Web App (PWA) — single responsive codebase for desktop
  browser and mobile home-screen install. Service worker for offline +
  installability.
- **Stack:** React + Vite + TypeScript.
- **No backend.** All logic runs in the browser. This fits single-user use, is
  free to host, and has nothing to maintain server-side.
- **EPUB engine:** **epub.js** (chosen for maturity, theming hooks, and built-in
  CFI/location tracking used for resume-position). foliate-js considered as a
  premium alternative; revisit only if epub.js typography proves limiting.
- **Storage:** IndexedDB for cached book files, per-book reading position, and
  settings. Cache Storage (via service worker) for the app shell.
- **Hosting:** GitHub Pages (`kalaiselvan-t.github.io`), served over HTTPS so the
  PWA can install on mobile. Runs on `localhost` during development.

---

## 4. Access control (single-user lockdown)

GitHub Pages is public static hosting; the empty app shell is technically
viewable by anyone with the URL. Actual **use** is locked down at login:

1. **Google OAuth in "Testing" mode**, with only `kalaiselvant0@gmail.com` on
   the test-user allowlist. Google refuses sign-in for any other account.
2. **App-level email allowlist**: after login, the app verifies the account
   email matches the owner and rejects any other account.
3. **Auth model:** Google Identity Services token flow — 100% client-side, no
   backend. Scope: read access to Drive sufficient to list/download EPUBs
   (`drive.readonly`). The public OAuth client ID is not a secret; security comes
   from the test-user allowlist, redirect-URI restriction, and the email check.

**Accepted limitation:** the static shell HTML/JS is publicly fetchable; it
contains no data and is non-functional without an allowlisted Google login.

---

## 5. Book sources

### Google Drive (primary, synced)
- One-time free Google Cloud setup by the owner (guided steps provided during
  implementation): create project, enable Drive API, configure OAuth consent
  (Testing + self as test user), create OAuth client ID, add authorized origins
  (GitHub Pages URL + localhost).
- In-app: connect Drive → choose a folder → app lists EPUB files → download +
  **cache in IndexedDB** so they open instantly and work offline afterward.
- Re-sync refreshes the list; already-cached books remain available offline.

### Local files (baseline)
- Open an EPUB from the device at any time; the file is cached into the library
  like a Drive book. No setup, fully offline.

### Play Books bridge (documentation only)
- Play Books has no API and DRM-locks purchases — no automatic sync possible.
- Documented workaround: export a DRM-free book from Play Books as EPUB → drop
  in the synced Drive folder → it appears in the library automatically.

---

## 6. Reading experience — premium dark aesthetic

- **Palette:**
  - Background base `#0B0B0D`, raised surfaces `#17171A` (warm near-black, not
    harsh pure black).
  - Body text warm off-white `#E8E4DC`; secondary/UI text `#9A968E`.
  - Single restrained warm-amber accent `#E0B15D`, used sparingly: RSVP pivot
    letter, progress indicator, active controls.
- **Typography:**
  - Serif body fonts for reading (Literata / Newsreader), user-switchable.
  - System SF-style font for UI chrome.
  - Line-height ~1.6, measure ~66 characters, generous page margins.
- **Feel:**
  - Minimal chrome that fades away while reading.
  - Translucent blurred top bar (Apple-style).
  - Soft depth, spring-eased transitions.
  - Tap/click zones for page turns.
  - Adjustable: font size, reading font, brightness.

---

## 7. Speed reading

Two switchable modes. **Both are driven by press-and-hold** ("dead-man's
switch"): motion happens only while held, and freezes on release.

### 7.1 RSVP (Rapid Serial Visual Presentation)
- Words flash one at a time in a fixed position.
- **ORP pivot letter** highlighted in the amber accent and aligned to a fixed
  center column so the eye never moves.
- **Default 300 WPM**, adjustable range **100–900** (step 25).
- **Punctuation pauses** (multipliers on the per-word interval): comma 1.5×,
  sentence-ending punctuation 2×, paragraph break 2.5×.
- **Chunking:** 1 word default, selectable 1–3 words.
- Launches from the current reading position; releasing parks on the current
  (readable) word and that position carries back to normal reading.

### 7.2 Bionic
- Static overlay on the normal themed page: the leading portion of each word is
  bolded to create fixation points.
- **Fixation strength** adjustable Low / Med / High (~30% / 40% / 50% of a
  word's letters bolded; minimum 1 char; weighted by word length).
- Read normally at own pace when not holding.

### 7.3 Press-and-hold interaction (applies to both)
- **Mobile:** press-and-hold anywhere on the reading surface → advance; lift →
  pause.
- **Desktop:** hold mouse button **or** hold `Spacebar` → advance; release →
  pause.
- In **RSVP**, holding streams words at the set WPM.
- In **Bionic**, holding **auto-scrolls** the page at reading pace; releasing
  stops scrolling.

---

## 8. Library & progress

- **Home screen:** a shelf/grid of book covers, merging Drive + local sources.
- **Auto-resume:** each book stores its exact position (epub.js CFI); reopening
  returns to that spot.
- **Progress:** reading progress percentage shown per book.
- **Settings** persist (theme options, fonts, WPM, fixation strength, etc.).

---

## 9. Data model (IndexedDB)

- `books`: id, title, author, cover, source (drive|local), driveFileId?,
  cachedBlob (EPUB bytes), addedAt.
- `progress`: bookId, cfi/location, percent, updatedAt.
- `settings`: singleton — reading font, font size, brightness, WPM, chunk size,
  fixation strength, last active book.
- `auth`: cached token metadata (not long-lived secrets).

---

## 10. Acceptance criteria (v1 "done")

1. App installs to phone home screen and launches offline.
2. Only `kalaiselvant0@gmail.com` can log in; any other Google account is
   rejected at Google and again in-app.
3. Connect Drive → list EPUBs from a chosen folder → open one → it renders in the
   premium dark theme.
4. Open a local EPUB → it renders and is added to the library.
5. Cached books open with no network.
6. Reopening a book resumes the exact prior position.
7. RSVP mode: press-and-hold streams words at adjustable WPM with an amber ORP
   pivot; release pauses on a readable word.
8. Bionic mode: word-starts are bolded at adjustable strength; press-and-hold
   auto-scrolls at reading pace, release stops.
9. Toggle between RSVP and Bionic works from within a book.
10. Font, font size, brightness, and speed settings are adjustable and persist.

---

## 11. Deferred / future (v2+)

- **PDF support** — two-mode approach previously discussed (original fidelity
  view + reflowed reading view for bionic/theming). Deferred at owner's request.
- Cross-device sync of reading position.
- Highlights, annotations, bookmarks list.
- Dictionary lookup, TTS.
- Opening the OAuth app to additional users (requires Google verification).

---

## 12. Open items / notes

- Product name: currently "Reader" (folder `reader/`) — owner may rename.
- Confirm the exact Drive scope during build (`drive.readonly` vs a
  more limited scope + folder picker) balancing convenience and least-privilege.
- Font licensing: use open-licensed fonts (Literata, Newsreader are OFL).
