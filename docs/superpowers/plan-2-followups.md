# Plan 2 — Follow-ups & Manual Verification

Plan 2 (Speed Reading) is complete: RSVP (amber ORP pivot, punctuation-aware
timing) and Bionic (bolded word-starts, WPM-derived auto-scroll) modes, both
driven by press-and-hold, launched from a ⚡ button in the reader. All 7 tasks
were implemented, reviewed, and the final whole-branch review is clean after
one fix wave. Build, type-check, and all 33 unit tests are green.

## Device-only manual checks (do these in real Chrome / a phone once)

The sandboxed browser tab used during development was non-composited
(`document.hidden === true`), which stalls `requestAnimationFrame` — so a
handful of visual/gesture behaviors were verified by code reading and CSS-spec
tracing rather than direct observation. None of these are suspected bugs; they
just need a real-device look before fully trusting them:

1. **Amber pivot color** — confirm the RSVP pivot letter actually renders in
   the amber accent (`#E0B15D`), not just that the CSS variable is correct.
2. **Bionic auto-scroll timing** — confirm the scroll speed at a couple of WPM
   settings roughly matches the selected pace (native `requestAnimationFrame`,
   not the interim shim used during development).
3. **Bionic manual touch-scroll** — confirm you can still drag-scroll the
   Bionic text column by hand (not holding) on a phone; a `touchAction: 'none'`
   ancestor issue was found and fixed (`pan-y` added to the scroller), but
   this fix was verified by CSS-spec reading, not on an actual touchscreen.

## Deliberately deferred (not a bug — a scoped-out feature)

- **RSVP "carry-back" position.** The design spec (§7.1) originally said
  releasing RSVP should park on the current word and that position should
  carry back into normal reading. During planning this turned out to require
  `extractForward()` to emit a chunk→CFI mapping rather than a flat string —
  a real pipeline change. The plan's own acceptance criteria instead define
  exit as "✕ returns to the reader at the same position as before opening",
  which is what ships. Full carry-back is a candidate for a future plan if
  wanted; it wasn't silently dropped, just knowingly scoped out here.

## Deferred minors (non-blocking for a single-user v1)

- Bionic's `WORDS_PER_LINE = 10` is calibrated for the desktop reading
  measure; on a narrow phone screen the actual words-per-line is lower, so
  scroll speed will run faster than the selected WPM there. Fix would derive
  words-per-line from the scroller's measured width.
- Bionic hardcodes `fontSize: 20` rather than honoring the reader's
  `settings.fontSize` (would need `LINE_HEIGHT_PX` updated alongside it).
- RSVP has no restart/seek once it reaches "End" — switching modes (which
  remounts the overlay) is the only way back to the start. Acceptable for v1.
- `extractForward()` still drops a container block's lead-in text when that
  text is wrapped in an inline element (e.g. `<em>Lead-in</em>`) directly
  before a nested block — a narrow edge case in unusual EPUB markup.
- The WPM slider writes to IndexedDB on every `onChange` tick during a drag
  (~30+ writes). Harmless for a single-user local PWA; a debounce would be a
  later nicety.
- Space-hold's `preventDefault` on the RSVP/Bionic mode-toggle and ✕ buttons
  means Space no longer activates a focused button there (Enter still does).

## Next

- **Plan 3 — Google Drive sync + GitHub Pages deploy + single-account login
  lockdown.** Not yet written as a plan; ready to brainstorm/plan whenever.
