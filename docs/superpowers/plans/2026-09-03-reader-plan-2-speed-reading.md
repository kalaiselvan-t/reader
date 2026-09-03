# Reader — Plan 2: Speed Reading

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two switchable speed-reading modes — RSVP (flash words with an ORP pivot) and Bionic (bold word-starts) — both driven by a press-and-hold "dead-man's switch", launched from the current reading position, on top of the existing EPUB reader.

**Architecture:** Both modes are **overlays** rendered in our own React DOM, fed by plain text extracted from the current reading position via a new `ReaderBook.extractForward()`. Pure logic (tokenizing, ORP pivot, bionic split, RSVP timing/chunking) lives in `src/lib/speedreading/*` and is fully unit-tested. A shared `usePressHold` hook wires touch + mouse + Spacebar to start/stop. This decouples speed reading from epub.js's iframe rendering, keeping the moving parts controllable and testable.

**Tech Stack:** React 18, TypeScript, epub.js (existing `ReaderBook` wrapper), Vitest + @testing-library/react (existing). No new dependencies.

## Global Constraints

- Single user, no backend, EPUB-only. Builds on Plan 1 (merged to `master`).
- Palette: the RSVP **ORP pivot letter uses the amber accent `#E0B15D`**; overlays use bg `#0B0B0D`, text `#E8E4DC`, secondary `#9A968E`, surface `#17171A`.
- **Both** modes are driven by press-and-hold: motion happens only while held, freezes on release. Mobile = touch hold on the reading surface; desktop = hold mouse button OR hold `Spacebar`.
- **RSVP:** default **300 WPM**, range **100–900 step 25**. Punctuation pause multipliers: comma/clause (`, ; :`) **1.5×**, sentence-end (`. ! ?`) **2.0×**, paragraph end **2.5×**. Chunk size **1–3 words** (default 1).
- **Bionic:** fixation strength Low/Med/High = **30% / 40% / 50%** of a word's letters bolded (minimum 1 char); press-and-hold **auto-scrolls** the page at reading pace.
- Reading fonts are self-hosted (Literata/Newsreader); overlays use the same `--font-read` for body text and `--font-ui` for chrome.
- Existing `SettingsRecord` already has `wpm`, `chunkSize`, `fixation`. This plan adds `speedMode`.
- TDD for all pure logic. Frequent commits — every task ends with a commit.

---

## File Structure

```
src/
  lib/
    speedreading/
      tokenize.ts        # Token{text,pause}; tokenize(text) -> Token[]
      rsvp.ts            # Chunk; chunk(tokens,size) -> Chunk[]; chunkDelayMs(chunk,wpm)
      orp.ts             # orpIndex(word) -> number (Spritz-style pivot)
      bionic.ts          # Fixation; bionicBoldCount / splitBionic
    epub/
      book.ts            # + extractForward(maxChars?) method  (MODIFY)
    storage/
      db.ts              # + speedMode field; getSettings merges over defaults (MODIFY)
  hooks/
    usePressHold.ts      # touch/mouse/Space -> onStart/onStop
  components/
    RsvpOverlay.tsx      # centered chunk + amber ORP pivot; press-hold streams
    BionicOverlay.tsx    # scrollable bionic text; press-hold auto-scrolls
    SpeedReadOverlay.tsx # mode toggle + settings + active mode + exit
    Reader.tsx           # + speed-read entry button and overlay mount  (MODIFY)
test/
  speedreading/
    tokenize.test.ts
    rsvp.test.ts
    orp.test.ts
    bionic.test.ts
  hooks/
    usePressHold.test.tsx
  storage/
    db.test.ts           # + speedMode/default-merge cases  (MODIFY)
```

Split rationale: pure logic (`speedreading/*`) is isolated and TDD'd with no epub.js/DOM dependency; the epub.js text extraction is behind the existing `ReaderBook` surface; overlays consume only the pure logic + extracted text; `Reader.tsx` only gains an entry point and a mount.

---

### Task 1: Tokenizer + RSVP timing/chunking

**Files:**
- Create: `src/lib/speedreading/tokenize.ts`, `src/lib/speedreading/rsvp.ts`
- Test: `test/speedreading/tokenize.test.ts`, `test/speedreading/rsvp.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Token { text: string; pause: number }` and `tokenize(text: string): Token[]`
  - `interface Chunk { text: string; orpWord: string; pause: number; wordCount: number }`
  - `chunk(tokens: Token[], size: number): Chunk[]`
  - `chunkDelayMs(chunk: Chunk, wpm: number): number`
  - Exported pause constants `CLAUSE_PAUSE = 1.5`, `SENTENCE_PAUSE = 2.0`, `PARAGRAPH_PAUSE = 2.5`.

- [ ] **Step 1: Write the failing tests**

`test/speedreading/tokenize.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/lib/speedreading/tokenize';

describe('tokenize', () => {
  it('splits words and marks the last word of a paragraph as a paragraph pause', () => {
    const t = tokenize('Hello world');
    expect(t.map((x) => x.text)).toEqual(['Hello', 'world']);
    expect(t[0].pause).toBe(1);
    expect(t[1].pause).toBe(2.5); // paragraph end
  });

  it('assigns clause and sentence pauses from trailing punctuation', () => {
    const t = tokenize('One, two. Three four');
    expect(t[0].pause).toBe(1.5); // One,
    expect(t[1].pause).toBe(2);   // two.
    expect(t[2].pause).toBe(1);   // Three
    expect(t[3].pause).toBe(2.5); // four (paragraph end)
  });

  it('treats blank-line-separated blocks as separate paragraphs', () => {
    const t = tokenize('A\n\nB');
    expect(t.map((x) => x.text)).toEqual(['A', 'B']);
    expect(t[0].pause).toBe(2.5);
    expect(t[1].pause).toBe(2.5);
  });

  it('detects sentence punctuation even behind a closing quote or bracket', () => {
    const t = tokenize('He said "run!" now');
    // "run!" -> strip trailing quote, last char is ! -> sentence
    expect(t[1].pause).toBe(2);
  });

  it('returns an empty array for empty/whitespace text', () => {
    expect(tokenize('   \n  ')).toEqual([]);
  });
});
```

`test/speedreading/rsvp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chunk, chunkDelayMs } from '../../src/lib/speedreading/rsvp';
import { tokenize } from '../../src/lib/speedreading/tokenize';

describe('chunk', () => {
  it('groups tokens into fixed-size chunks', () => {
    const toks = tokenize('one two three four five six'); // last word pause 2.5
    const c = chunk(toks, 2);
    expect(c[0].text).toBe('one two');
    expect(c[0].wordCount).toBe(2);
    expect(c[0].orpWord).toBe('one'); // pivot aligns on first word
  });

  it('breaks a chunk early at a sentence/paragraph boundary', () => {
    const toks = tokenize('Stop. Go now');
    const c = chunk(toks, 3);
    // "Stop." ends a sentence (pause 2) -> chunk breaks after it despite size 3
    expect(c[0].text).toBe('Stop.');
    expect(c[1].text).toBe('Go now');
  });

  it('carries the last token pause onto the chunk', () => {
    const toks = tokenize('a b. c');
    const c = chunk(toks, 2);
    expect(c[0].pause).toBe(2); // ends on "b."
  });

  it('handles size <= 0 as size 1', () => {
    const toks = tokenize('a b c');
    expect(chunk(toks, 0).length).toBe(3);
  });
});

describe('chunkDelayMs', () => {
  it('is baseWordTime * wordCount * pause', () => {
    // 300 wpm -> 200ms/word; 1 word, pause 1 -> 200ms
    expect(chunkDelayMs({ text: 'a', orpWord: 'a', pause: 1, wordCount: 1 }, 300)).toBeCloseTo(200);
    // 2 words, pause 2 -> 200 * 2 * 2 = 800
    expect(chunkDelayMs({ text: 'a b', orpWord: 'a', pause: 2, wordCount: 2 }, 300)).toBeCloseTo(800);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/speedreading/tokenize.test.ts test/speedreading/rsvp.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `tokenize.ts`**

```ts
export interface Token {
  text: string;
  pause: number;
}

export const CLAUSE_PAUSE = 1.5;
export const SENTENCE_PAUSE = 2.0;
export const PARAGRAPH_PAUSE = 2.5;

function pauseForWord(word: string, isParagraphEnd: boolean): number {
  // Strip trailing quotes/brackets so `run!"` still reads as sentence-ending.
  const stripped = word.replace(/["')\]”’]+$/u, '');
  const last = stripped.slice(-1);
  let p = 1;
  if (/[,;:—]/.test(last)) p = CLAUSE_PAUSE;
  if (/[.!?…]/.test(last)) p = SENTENCE_PAUSE;
  if (isParagraphEnd) p = Math.max(p, PARAGRAPH_PAUSE);
  return p;
}

/** Split text into word Tokens, tagging each with a pause multiplier. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const paragraphs = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      tokens.push({ text: w, pause: pauseForWord(w, i === words.length - 1) });
    });
  }
  return tokens;
}
```

- [ ] **Step 4: Implement `rsvp.ts`**

```ts
import { SENTENCE_PAUSE, type Token } from './tokenize';

export interface Chunk {
  text: string;
  orpWord: string;
  pause: number;
  wordCount: number;
}

function makeChunk(group: Token[]): Chunk {
  return {
    text: group.map((t) => t.text).join(' '),
    orpWord: group[0].text,
    pause: group[group.length - 1].pause,
    wordCount: group.length,
  };
}

/**
 * Group tokens into chunks of at most `size` words, breaking early at a
 * sentence/paragraph boundary (pause >= SENTENCE_PAUSE) so a chunk never spans
 * a sentence break.
 */
export function chunk(tokens: Token[], size: number): Chunk[] {
  const cap = Math.max(1, Math.floor(size) || 1);
  const chunks: Chunk[] = [];
  let group: Token[] = [];
  for (const t of tokens) {
    group.push(t);
    if (group.length >= cap || t.pause >= SENTENCE_PAUSE) {
      chunks.push(makeChunk(group));
      group = [];
    }
  }
  if (group.length) chunks.push(makeChunk(group));
  return chunks;
}

/** Milliseconds to display one chunk: base word time * word count * pause. */
export function chunkDelayMs(chunk: Chunk, wpm: number): number {
  const perWord = 60000 / wpm;
  return perWord * chunk.wordCount * chunk.pause;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/speedreading/tokenize.test.ts test/speedreading/rsvp.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/speedreading/tokenize.ts src/lib/speedreading/rsvp.ts test/speedreading/tokenize.test.ts test/speedreading/rsvp.test.ts
git commit -m "feat: speed-reading tokenizer and RSVP chunk/timing logic"
```

---

### Task 2: ORP pivot + Bionic split

**Files:**
- Create: `src/lib/speedreading/orp.ts`, `src/lib/speedreading/bionic.ts`
- Test: `test/speedreading/orp.test.ts`, `test/speedreading/bionic.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `orpIndex(word: string): number` — index of the pivot letter (Spritz-style).
  - `type Fixation = 'low' | 'med' | 'high'`
  - `bionicBoldCount(word: string, strength: Fixation): number`
  - `splitBionic(word: string, strength: Fixation): { bold: string; rest: string }`

- [ ] **Step 1: Write the failing tests**

`test/speedreading/orp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { orpIndex } from '../../src/lib/speedreading/orp';

describe('orpIndex', () => {
  it('maps word length to a pivot index (Spritz-style)', () => {
    expect(orpIndex('a')).toBe(0);          // 1
    expect(orpIndex('to')).toBe(1);         // 2
    expect(orpIndex('cat')).toBe(1);        // 3
    expect(orpIndex('reading')).toBe(2);    // 7
    expect(orpIndex('wonderful')).toBe(2);  // 9
    expect(orpIndex('exceptional')).toBe(3);// 11
    expect(orpIndex('extraordinary')).toBe(3); // 13
    expect(orpIndex('internationalization')).toBe(4); // 20
  });

  it('returns 0 for empty string', () => {
    expect(orpIndex('')).toBe(0);
  });
});
```

`test/speedreading/bionic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { bionicBoldCount, splitBionic } from '../../src/lib/speedreading/bionic';

describe('bionicBoldCount', () => {
  it('bolds a fraction of letters by strength, min 1', () => {
    expect(bionicBoldCount('reading', 'low')).toBe(2);  // round(7*0.3)=2
    expect(bionicBoldCount('reading', 'med')).toBe(3);  // round(7*0.4)=3
    expect(bionicBoldCount('reading', 'high')).toBe(4); // round(7*0.5)=4 (3.5 -> 4)
    expect(bionicBoldCount('a', 'low')).toBe(1);        // min 1
    expect(bionicBoldCount('to', 'med')).toBe(1);       // round(2*0.4)=1
  });

  it('returns 0 for empty string', () => {
    expect(bionicBoldCount('', 'med')).toBe(0);
  });
});

describe('splitBionic', () => {
  it('splits a word into a bold lead and a normal remainder', () => {
    expect(splitBionic('reading', 'med')).toEqual({ bold: 'rea', rest: 'ding' });
    expect(splitBionic('a', 'high')).toEqual({ bold: 'a', rest: '' });
  });

  it('never bolds more than the whole word', () => {
    const { bold, rest } = splitBionic('to', 'high'); // round(2*0.5)=1
    expect(bold + rest).toBe('to');
    expect(bold.length).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/speedreading/orp.test.ts test/speedreading/bionic.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `orp.ts`**

```ts
/** Optimal Recognition Point index for a word, by length (Spritz-style). */
export function orpIndex(word: string): number {
  const n = word.length;
  if (n <= 1) return 0;
  if (n <= 5) return 1;
  if (n <= 9) return 2;
  if (n <= 13) return 3;
  return 4;
}
```

- [ ] **Step 4: Implement `bionic.ts`**

```ts
export type Fixation = 'low' | 'med' | 'high';

const RATIO: Record<Fixation, number> = { low: 0.3, med: 0.4, high: 0.5 };

/** Number of leading letters to bold for a word at the given fixation strength. */
export function bionicBoldCount(word: string, strength: Fixation): number {
  const n = word.length;
  if (n === 0) return 0;
  return Math.max(1, Math.round(n * RATIO[strength]));
}

/** Split a word into its bold lead and normal remainder. */
export function splitBionic(
  word: string,
  strength: Fixation
): { bold: string; rest: string } {
  const k = Math.min(bionicBoldCount(word, strength), word.length);
  return { bold: word.slice(0, k), rest: word.slice(k) };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/speedreading/orp.test.ts test/speedreading/bionic.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/speedreading/orp.ts src/lib/speedreading/bionic.ts test/speedreading/orp.test.ts test/speedreading/bionic.test.ts
git commit -m "feat: ORP pivot index and bionic word-split logic"
```

---

### Task 3: Settings — add `speedMode` + merge defaults

**Files:**
- Modify: `src/lib/storage/db.ts`
- Test: `test/storage/db.test.ts` (add cases)

**Interfaces:**
- Consumes: existing `SettingsRecord`, `DEFAULT_SETTINGS`, `getSettings`, `putSettings`.
- Produces: `SettingsRecord` gains `speedMode: 'rsvp' | 'bionic'`; `DEFAULT_SETTINGS.speedMode = 'rsvp'`; `getSettings()` now returns `{ ...DEFAULT_SETTINGS, ...stored }` so a record saved before this field existed still yields a valid `speedMode` (and any future field gets its default).

- [ ] **Step 1: Add the failing tests**

Add to `test/storage/db.test.ts` (inside the existing `describe('storage/db', ...)` block):
```ts
  it('defaults speedMode to rsvp', async () => {
    expect(DEFAULT_SETTINGS.speedMode).toBe('rsvp');
    expect((await getSettings()).speedMode).toBe('rsvp');
  });

  it('merges stored settings over defaults so missing new fields are filled', async () => {
    // Simulate a settings record persisted before `speedMode` existed.
    const legacy = { id: 'app', readingFont: 'Newsreader', fontSize: 18, brightness: 1, wpm: 300, chunkSize: 1, fixation: 'med' } as any;
    await putSettings(legacy);
    const s = await getSettings();
    expect(s.readingFont).toBe('Newsreader'); // stored value preserved
    expect(s.speedMode).toBe('rsvp');         // missing field filled from defaults
  });
```
(If `DEFAULT_SETTINGS`/`putSettings` are not already imported in this test file, add them to the import from `../../src/lib/storage/db`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/storage/db.test.ts`
Expected: FAIL — `speedMode` undefined / type error.

- [ ] **Step 3: Implement the changes in `src/lib/storage/db.ts`**

Add the field to the interface (after `fixation`):
```ts
  fixation: 'low' | 'med' | 'high';
  speedMode: 'rsvp' | 'bionic';
```
Add to `DEFAULT_SETTINGS` (after `fixation: 'med',`):
```ts
  fixation: 'med',
  speedMode: 'rsvp',
```
Replace the body of `getSettings` so it merges over defaults:
```ts
export async function getSettings(): Promise<SettingsRecord> {
  const stored = await (await db()).get('settings', 'app');
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}
```

- [ ] **Step 4: Run to verify pass (whole suite)**

Run: `npx vitest run`
Expected: PASS — all prior tests plus the two new cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/db.ts test/storage/db.test.ts
git commit -m "feat: add speedMode setting and merge stored settings over defaults"
```

---

### Task 4: `usePressHold` hook

**Files:**
- Create: `src/hooks/usePressHold.ts`
- Test: `test/hooks/usePressHold.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `usePressHold(onStart: () => void, onStop: () => void, opts?: { useSpace?: boolean }): { onPointerDown; onPointerUp; onPointerLeave; onPointerCancel }` — spread the returned handlers onto the hold surface. While `useSpace` is not `false`, holding `Space` (when focus is not in a form control) also starts/stops. A once-guard ensures `onStart` fires exactly once per hold even with key auto-repeat.

- [ ] **Step 1: Write the failing test**

`test/hooks/usePressHold.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { usePressHold } from '../../src/hooks/usePressHold';

function Harness({ onStart, onStop }: { onStart: () => void; onStop: () => void }) {
  const h = usePressHold(onStart, onStop);
  return <div data-testid="surface" {...h} style={{ width: 100, height: 100 }} />;
}

describe('usePressHold', () => {
  it('fires onStart on pointer down and onStop on pointer up', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { getByTestId } = render(<Harness onStart={onStart} onStop={onStop} />);
    const el = getByTestId('surface');
    fireEvent.pointerDown(el);
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('stops when the pointer leaves while held', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { getByTestId } = render(<Harness onStart={onStart} onStop={onStop} />);
    const el = getByTestId('surface');
    fireEvent.pointerDown(el);
    fireEvent.pointerLeave(el);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('starts once on Space keydown (ignoring auto-repeat) and stops on keyup', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<Harness onStart={onStart} onStop={onStop} />);
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does not start on Space when focus is in a form control', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { container } = render(
      <div>
        <input data-testid="inp" />
        <Harness onStart={onStart} onStop={onStop} />
      </div>
    );
    const input = container.querySelector('input')!;
    input.focus();
    fireEvent.keyDown(input, { code: 'Space' });
    expect(onStart).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/hooks/usePressHold.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/hooks/usePressHold.ts`**

```ts
import { useCallback, useEffect, useRef } from 'react';

interface PressHoldHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

function isFormElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/**
 * Press-and-hold "dead-man's switch": onStart fires when a hold begins
 * (pointer down or Space keydown), onStop when it ends (pointer up/leave/cancel
 * or Space keyup). onStart fires exactly once per hold even with key repeat.
 */
export function usePressHold(
  onStart: () => void,
  onStop: () => void,
  opts?: { useSpace?: boolean }
): PressHoldHandlers {
  const holding = useRef(false);
  const startRef = useRef(onStart);
  const stopRef = useRef(onStop);
  startRef.current = onStart;
  stopRef.current = onStop;

  const start = useCallback(() => {
    if (holding.current) return;
    holding.current = true;
    startRef.current();
  }, []);

  const stop = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    stopRef.current();
  }, []);

  useEffect(() => {
    if (opts?.useSpace === false) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isFormElement(e.target)) {
        e.preventDefault();
        start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFormElement(e.target)) {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [start, stop, opts?.useSpace]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run test/hooks/usePressHold.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePressHold.ts test/hooks/usePressHold.test.tsx
git commit -m "feat: usePressHold dead-man's-switch hook (touch/mouse/Space)"
```

---

### Task 5: `ReaderBook.extractForward()` — text from current position

**Files:**
- Modify: `src/lib/epub/book.ts`

**Interfaces:**
- Consumes: existing `ReaderBook` (its `book`/`rendition`).
- Produces: `extractForward(maxChars?: number): Promise<string>` on `ReaderBook` — returns plain text starting at the **current chapter** and continuing across following spine sections up to `maxChars` (default 20000). Paragraphs are separated by blank lines so the tokenizer can detect paragraph boundaries. Returns `''` if nothing is rendered yet.

**Verify before committing (epub.js API is version-sensitive, like the Plan 1 ArrayBuffer check):** confirm the exact calls that (a) get the current spine index from `this.rendition.currentLocation()`, (b) enumerate spine sections, and (c) load a section's document text and unload it. **Log and record the actual constructor/type that `section.load()` resolves to** — in epub.js it is often the section's `documentElement` (an `Element`), NOT a `Document`, so `doc.body` may be `undefined` and the `doc?.body ?? doc` fallback is load-bearing; also confirm that reading `textContent` BEFORE `section.unload()` (as the code does) survives the unload. The code below is the expected shape; if a call differs in this epub.js version, adjust and record the working form (including the resolved type) in the task report. Live-verify in a browser that opening a book and calling `extractForward()` returns readable text beginning at roughly the current chapter.

- [ ] **Step 1: Add the method to `ReaderBook` (in `src/lib/epub/book.ts`)**

Add inside the `ReaderBook` class (e.g. after `onRelocated`):
```ts
  /**
   * Plain text from the current chapter forward, across following spine
   * sections, up to `maxChars`. Paragraph blocks are separated by blank lines
   * so the tokenizer can detect paragraph ends. Used to feed the speed-reading
   * overlays from the reader's current position.
   */
  async extractForward(maxChars = 20000): Promise<string> {
    if (!this.rendition) return '';
    const loc = this.rendition.currentLocation() as any;
    const startIndex: number = loc?.start?.index ?? 0;
    const spineItems: any[] = (this.book.spine as any)?.spineItems ?? [];
    const loader = (this.book.load as any).bind(this.book);
    let out = '';
    for (let i = startIndex; i < spineItems.length && out.length < maxChars; i++) {
      const section = spineItems[i];
      try {
        const doc = await section.load(loader);
        // `doc` is the section's document (or its documentElement); read text
        // from the body when present, else the element itself.
        const body = doc?.body ?? doc;
        const raw: string = body?.textContent ?? '';
        // Collapse intra-line whitespace but keep paragraph breaks as blank lines.
        const text = raw
          .split(/\n{2,}/)
          .map((block: string) => block.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('\n\n');
        if (text) out += (out ? '\n\n' : '') + text;
      } catch {
        // skip unreadable sections
      } finally {
        try { section.unload(); } catch { /* ignore */ }
      }
    }
    return out.slice(0, maxChars);
  }
```

- [ ] **Step 2: Type-check + browser verification**

Run: `npx tsc -b`
Expected: clean.

Then verify live (build + `npm run preview` + browser, as Plan 1's reader task did; do not leave a server running): open a book, advance a couple of pages, and from the console/app confirm `extractForward()` returns readable text starting near the current chapter. Record the working epub.js calls (and any deviations from the code above) in the task report. If browser tooling is unavailable, document the exact manual steps and rely on type-check + code review.

- [ ] **Step 3: Commit**

```bash
git add src/lib/epub/book.ts
git commit -m "feat: extractForward() to pull reading text from current position"
```

---

### Task 6: RSVP and Bionic overlay components

**Files:**
- Create: `src/components/RsvpOverlay.tsx`, `src/components/BionicOverlay.tsx`

**Interfaces:**
- Consumes: `tokenize`, `chunk`, `chunkDelayMs`, `orpIndex`, `splitBionic`, `type Fixation`, `usePressHold`.
- Produces:
  - `RsvpOverlay({ chunks, wpm }: { chunks: Chunk[]; wpm: number })` — a self-contained centered RSVP display with an amber ORP pivot, advancing only while held (press-hold on the display area or Space), showing chunk index / total.
  - `BionicOverlay({ text, fixation, wpm }: { text: string; fixation: Fixation; wpm: number })` — a scrollable themed column of bionic-bolded text, auto-scrolling at a WPM-derived reading pace only while held.

- [ ] **Step 1: Implement `src/components/RsvpOverlay.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Chunk } from '../lib/speedreading/rsvp';
import { chunkDelayMs } from '../lib/speedreading/rsvp';
import { orpIndex } from '../lib/speedreading/orp';
import { usePressHold } from '../hooks/usePressHold';

export function RsvpOverlay({ chunks, wpm }: { chunks: Chunk[]; wpm: number }) {
  const [index, setIndex] = useState(0);
  const [holding, setHolding] = useState(false);
  const wpmRef = useRef(wpm);
  wpmRef.current = wpm;

  // Advance loop: runs only while holding. Driven by a LOCAL counter so it
  // never depends on a React render having committed the new index — a ref
  // synced during render would still read stale inside the recursive timeout.
  useEffect(() => {
    if (!holding) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let i = index; // resume from wherever we paused
    const tick = () => {
      if (cancelled || i >= chunks.length - 1) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        i += 1;
        setIndex(i);
        tick();
      }, chunkDelayMs(chunks[i], wpmRef.current));
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding, chunks]);

  const hold = usePressHold(() => setHolding(true), () => setHolding(false));

  const current = chunks[Math.min(index, Math.max(0, chunks.length - 1))];
  const word = current?.orpWord ?? '';
  const pivot = orpIndex(word);
  const before = word.slice(0, pivot);
  const at = word.slice(pivot, pivot + 1);
  const after = word.slice(pivot + 1);
  // Words beyond the pivot word in a multi-word chunk render on a SECOND line,
  // so they never disturb the three-column pivot centering.
  const extraWords = current ? current.text.split(' ').slice(1).join(' ') : '';
  const atEnd = index >= chunks.length - 1;

  return (
    <div
      {...hold}
      role="button"
      tabIndex={0}
      aria-label="Press and hold to read"
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
        background: 'var(--bg)', userSelect: 'none', cursor: 'pointer', touchAction: 'none',
      }}
    >
      {/* Fixed pivot display: three columns keep the pivot letter centered. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'baseline', width: 'min(90vw, 640px)', fontFamily: 'var(--font-read)', fontSize: 'clamp(28px, 7vw, 52px)' }}>
        <span style={{ textAlign: 'right', color: 'var(--text)' }}>{before}</span>
        <span style={{ color: 'var(--accent)', padding: '0 1px' }}>{at}</span>
        <span style={{ textAlign: 'left', color: 'var(--text)' }}>{after}</span>
      </div>
      {extraWords && (
        <div style={{ color: 'var(--text-2)', fontFamily: 'var(--font-read)', fontSize: 'clamp(18px, 4vw, 28px)' }}>{extraWords}</div>
      )}
      <div style={{ position: 'absolute', bottom: 40, color: 'var(--text-2)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
        {atEnd ? 'End' : holding ? 'Reading…' : 'Press and hold to read'} · {Math.min(index + 1, chunks.length)}/{chunks.length}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `src/components/BionicOverlay.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { splitBionic, type Fixation } from '../lib/speedreading/bionic';
import { usePressHold } from '../hooks/usePressHold';

export function BionicOverlay({ text, fixation, wpm }: { text: string; fixation: Fixation; wpm: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [holding, setHolding] = useState(false);
  const raf = useRef<number>();
  const wpmRef = useRef(wpm);
  wpmRef.current = wpm;

  const paragraphs = useMemo(
    () => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [text]
  );

  // Auto-scroll while held, at a WPM-independent comfortable reading pace.
  useEffect(() => {
    if (!holding) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    let last = performance.now();
    // Auto-scroll at reading pace derived from WPM: words/min -> lines/min ->
    // px/sec, assuming ~10 words per line at the reading line-height. Read wpm
    // from a ref each frame so slider changes take effect without restarting.
    const WORDS_PER_LINE = 10;
    const LINE_HEIGHT_PX = 20 * 1.6; // fontSize 20 * --reading-line 1.6
    const step = (now: number) => {
      const el = scroller.current;
      if (el) {
        const pxPerSec = (wpmRef.current / WORDS_PER_LINE / 60) * LINE_HEIGHT_PX;
        el.scrollTop += (pxPerSec * (now - last)) / 1000;
      }
      last = now;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [holding]);

  const hold = usePressHold(() => setHolding(true), () => setHolding(false));

  return (
    <div
      {...hold}
      role="button"
      tabIndex={0}
      aria-label="Press and hold to auto-scroll"
      style={{
        position: 'absolute', inset: 0, background: 'var(--bg)', userSelect: 'none',
        cursor: 'pointer', touchAction: 'none', display: 'flex', justifyContent: 'center',
      }}
    >
      <div
        ref={scroller}
        style={{
          overflowY: 'auto', width: 'min(92vw, var(--reading-measure))', height: '100%',
          padding: '32px 8px 96px', fontFamily: 'var(--font-read)', fontSize: 20,
          lineHeight: 'var(--reading-line)', color: 'var(--text)',
        }}
      >
        {paragraphs.map((para, pi) => (
          <p key={pi} style={{ margin: '0 0 1em' }}>
            {para.split(/\s+/).map((w, wi) => {
              const { bold, rest } = splitBionic(w, fixation);
              return (
                <span key={wi}>
                  <b style={{ fontWeight: 600 }}>{bold}</b>{rest}{' '}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 40, color: 'var(--text-2)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
        {holding ? 'Scrolling…' : 'Press and hold to auto-scroll'}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/RsvpOverlay.tsx src/components/BionicOverlay.tsx
git commit -m "feat: RSVP (ORP pivot) and Bionic (auto-scroll) reading overlays"
```

---

### Task 7: SpeedReadOverlay + wire into Reader

**Files:**
- Create: `src/components/SpeedReadOverlay.tsx`
- Modify: `src/components/Reader.tsx`

**Interfaces:**
- Consumes: `useSettings`, `tokenize`, `chunk`, `RsvpOverlay`, `BionicOverlay`, `type Fixation`, and `ReaderBook.extractForward`.
- Produces:
  - `SpeedReadOverlay({ text, onClose }: { text: string; onClose: () => void })` — full-screen speed-reading UI: a header with a mode toggle (RSVP / Bionic), mode-specific controls (WPM slider + chunk size for RSVP; fixation for Bionic), a close button, and the active overlay. Reads/writes `speedMode`, `wpm`, `chunkSize`, `fixation` via settings.
  - `Reader` gains a ⚡ speed-read button that calls `extractForward()` and mounts the overlay with the result.

- [ ] **Step 1: Implement `src/components/SpeedReadOverlay.tsx`**

```tsx
import { useMemo } from 'react';
import { useSettings } from '../state/settings';
import { tokenize } from '../lib/speedreading/tokenize';
import { chunk } from '../lib/speedreading/rsvp';
import type { Fixation } from '../lib/speedreading/bionic';
import { RsvpOverlay } from './RsvpOverlay';
import { BionicOverlay } from './BionicOverlay';

const WPM_MIN = 100;
const WPM_MAX = 900;
const WPM_STEP = 25;

export function SpeedReadOverlay({ text, onClose }: { text: string; onClose: () => void }) {
  const { settings, update } = useSettings();
  const mode = settings.speedMode;

  const tokens = useMemo(() => tokenize(text), [text]);
  const chunks = useMemo(() => chunk(tokens, settings.chunkSize), [tokens, settings.chunkSize]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'var(--bg)' }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: 'rgba(11,11,13,0.72)', backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 3 }}>
          {(['rsvp', 'bionic'] as const).map((m) => (
            <button
              key={m}
              onClick={() => update({ speedMode: m })}
              style={{
                border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#000' : 'var(--text-2)', fontSize: 13, fontWeight: 600,
              }}
            >
              {m === 'rsvp' ? 'RSVP' : 'Bionic'}
            </button>
          ))}
        </div>

        {/* WPM sets the pace for BOTH modes (RSVP stream + Bionic scroll). */}
        <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {settings.wpm} wpm
          <input
            type="range" min={WPM_MIN} max={WPM_MAX} step={WPM_STEP} value={settings.wpm}
            onChange={(e) => update({ wpm: Number(e.target.value) })}
          />
        </label>
        {mode === 'rsvp' ? (
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            chunk
            <select value={settings.chunkSize} onChange={(e) => update({ chunkSize: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ) : (
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            fixation
            <select value={settings.fixation} onChange={(e) => update({ fixation: e.target.value as Fixation })}>
              {(['low', 'med', 'high'] as const).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        )}

        <button onClick={onClose} aria-label="Exit speed reading" style={{ marginLeft: 'auto' }}>✕</button>
      </div>

      {/* Active mode fills the area below the header */}
      <div style={{ position: 'absolute', inset: 0, top: 52 }}>
        {mode === 'rsvp'
          ? <RsvpOverlay chunks={chunks} wpm={settings.wpm} />
          : <BionicOverlay text={text} fixation={settings.fixation} wpm={settings.wpm} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the entry point into `src/components/Reader.tsx`**

Add the import at the top:
```tsx
import { SpeedReadOverlay } from './SpeedReadOverlay';
```
Add state next to the other `useState` hooks:
```tsx
  const [speedText, setSpeedText] = useState<string | null>(null);
```
Add a handler (inside the component, before `return`):
```tsx
  const openSpeedRead = async () => {
    const t = await bookRef.current?.extractForward();
    if (t && t.trim()) setSpeedText(t);
  };
```
Add a ⚡ button next to the existing `Aa` button (place it just before the `Aa` button in the JSX):
```tsx
      <button
        onClick={openSpeedRead}
        aria-label="Speed read"
        style={{ position: 'absolute', right: 64, bottom: 16, zIndex: 20 }}
      >
        ⚡
      </button>
```
Mount the overlay at the end of the outer `<div>` (after the `{showControls && ...}` line):
```tsx
      {speedText !== null && (
        <SpeedReadOverlay text={speedText} onClose={() => setSpeedText(null)} />
      )}
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: both succeed.

- [ ] **Step 4: Browser smoke test (core acceptance)**

Build + `npm run preview` + browser (do not leave a server running). Confirm:
1. Open a book → tap ⚡ → the speed-read overlay appears with a mode toggle.
2. **RSVP:** press-and-hold the display (or hold Space) → words stream one at a time with the middle pivot letter in amber; release → freezes on the current word. Changing the WPM slider changes the pace; chunk 2–3 groups words.
3. **Bionic:** switch to Bionic → text shows with bolded word-starts; press-and-hold → the column auto-scrolls; release → stops. Fixation Low/Med/High changes how much of each word is bold.
4. ✕ returns to the normal reader at the same position.
5. `npx vitest run` → all tests still pass.

Record results (and any deviations) in the task report.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpeedReadOverlay.tsx src/components/Reader.tsx
git commit -m "feat: speed-read overlay with mode toggle, controls, and reader entry"
```

---

## Self-Review

**1. Spec coverage (design spec §7 + Global Constraints):**
- RSVP flash + ORP pivot in amber, 300 default / 100–900 step 25, punctuation pauses 1.5/2.0/2.5, chunk 1–3 → Tasks 1, 2, 6, 7. ✅
- Bionic bold word-starts, Low/Med/High = 30/40/50%, auto-scroll while held → Tasks 2, 6, 7. ✅
- Press-and-hold both modes; mobile touch / desktop mouse or Space → Task 4 (hook) used in Task 6 overlays. ✅
- Switchable modes, launched from the current **chapter** — `extractForward` starts at the current spine section, not the exact CFI offset within it; an accepted v1 simplification, refinable later → Task 5 + Task 7 (toggle). ✅ (position granularity noted, not the exact word)
- Settings persistence (mode/wpm/chunk/fixation) → Task 3 + existing fields. ✅

**2. Placeholder scan:** All steps contain real code and real test code. The epub.js `extractForward` calls (Task 5) are marked verify-in-browser with a concrete expected shape and a record-the-working-form instruction — this is a deliberate integration verification, not a placeholder.

**3. Type consistency:** `Token`/`Chunk` from Tasks 1 are consumed with identical shapes in Tasks 6–7. `Fixation` from Task 2 is used in `bionic`, `BionicOverlay`, and `SpeedReadOverlay` identically. `chunkDelayMs(chunk, wpm)` (Task 1) is called with that exact signature in Task 6. `usePressHold(onStart, onStop)` (Task 4) is called that way in both overlays. `extractForward(maxChars?)` (Task 5) is called with no args in Task 7. `settings.speedMode` (Task 3) is read/written in Task 7. ✅

---

## Notes for Plan 3 (not part of this plan)

Plan 3 adds Google Drive sync + GitHub Pages deploy + single-account login lockdown, and does not touch the speed-reading modules.
