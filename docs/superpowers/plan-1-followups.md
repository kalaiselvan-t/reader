# Plan 1 — Follow-ups & Manual Verification

Plan 1 (Foundation & EPUB reading) is complete: an installable offline PWA that
opens local EPUBs, renders them in the premium dark theme with self-hosted
Literata/Newsreader fonts, resumes each book's position, and shows a cover
library. All 9 tasks were implemented, reviewed, and the final whole-branch
review is clean. Build, type-check, and the 9 unit tests are green.

## Human-only manual checks (do these in real desktop Chrome once)

The sandboxed build/browser tooling can verify artifacts but not the full
service-worker lifecycle. Before relying on offline use, confirm in real Chrome:

1. **Service worker activates** — DevTools → Application → Service Workers shows
   the worker "activated and running".
2. **Offline reload** — DevTools → Network → Offline → reload: the app shell
   loads with no network errors.
3. **Cached book opens offline** — import a book, go offline, reopen it: it still
   renders (book bytes live in IndexedDB; shell + fonts are precached).
4. **Install prompt** — the omnibox install icon appears (valid manifest + active
   SW + fetch handler are all present in the build).

Reading-font rendering (Literata in the reading pane, Newsreader switch) was
already confirmed live in a browser during the final fix, so it does not need
re-checking.

## Deferred minors (non-blocking for a single-user v1)

- `parseEpubMetadata` still races `destroy()` past its 3 s timeout only for an
  EPUB that takes >3 s to load (very large book) — bounded, rare, non-fatal.
- `onRelocated` has no unmount guard; a very-late relocate could persist the
  last valid position after unmount (benign).
- `BookCover` renders the title twice when a book has no cover image (cosmetic).
- Main JS chunk ~501 kB (epub.js weight; gzip ~158 kB) — trips Vite's 500 kB
  warning. Optional: code-split epub.js or raise `chunkSizeWarningLimit`.
- Icons are a placeholder serif "R"; no `maskable` icon variant yet.

## Next

- **Plan 2 — Speed reading** (RSVP + Bionic, press-and-hold both modes).
- **Plan 3 — Google Drive + GitHub Pages deploy + single-user login lockdown.**

Both will be written as their own spec-informed plans, extending the interfaces
established here (`ReaderBook`, storage layer, settings/library contexts).
