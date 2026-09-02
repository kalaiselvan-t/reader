# Reader — Plan 1: Foundation & EPUB Reading

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, installable offline PWA that opens local EPUB files, renders them in a premium dark reading theme, remembers each book's position, and shows a library of covers.

**Architecture:** Pure client-side React + Vite + TypeScript PWA. EPUB rendering via epub.js. Persistence in IndexedDB (via the `idb` wrapper). No backend. This plan delivers the reading foundation; speed reading (Plan 2) and Google Drive + deploy (Plan 3) build on the interfaces defined here.

**Tech Stack:** React 18, Vite 5, TypeScript 5, epubjs, idb, vite-plugin-pwa. Tests: Vitest + fake-indexeddb (+ jsdom for the DOM environment).

## Global Constraints

- Single user only (`kalaiselvant0@gmail.com`); no multi-user, no backend.
- v1 renders **EPUB only**. PDF and Play Books are out of scope (deferred).
- Palette (exact): bg base `#0B0B0D`, raised surface `#17171A`, body text `#E8E4DC`, secondary text `#9A968E`, amber accent `#E0B15D`.
- Reading body fonts: Literata / Newsreader (OFL). UI font: system SF-style stack.
- All book bytes, reading positions, and settings persist locally in IndexedDB.
- Frequent commits: every task ends with a commit. DRY, YAGNI, TDD where logic is pure.

---

## File Structure

```
reader/
  index.html
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  vitest.config.ts
  test/setup.ts
  public/
    manifest.webmanifest        # via vite-plugin-pwa (generated), icons below
    icons/icon-192.png
    icons/icon-512.png
  src/
    main.tsx                    # React entry
    App.tsx                     # top-level view switch (Library <-> Reader)
    vite-env.d.ts
    styles/
      tokens.css                # palette + typography CSS variables
      global.css                # resets, base app chrome
    lib/
      hash.ts                   # deterministic book id from bytes
      storage/
        db.ts                   # IndexedDB schema + typed accessors
      epub/
        book.ts                 # epub.js wrapper: load, metadata, render, locations
    state/
      library.tsx              # React context: books list + add/remove
      settings.tsx             # React context: reading settings (persisted)
    components/
      TopBar.tsx
      Library.tsx               # cover grid + "Open file" button
      BookCover.tsx
      Reader.tsx                # rendering surface + page turns + resume
      ReaderControls.tsx        # font size / brightness / font family
  test/
    hash.test.ts
    storage/db.test.ts
```

Split rationale: pure logic (`hash.ts`, `storage/db.ts`) is isolated and unit-tested; epub.js integration (`epub/book.ts`) is wrapped behind a small typed surface so components never touch epub.js directly; view state lives in two focused contexts.

---

### Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `test/setup.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable dev server (`npm run dev`), a passing test runner (`npm test`), a production build (`npm run build`). `App` is a placeholder component returning a titled shell.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "reader",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fontsource/literata": "^5.1.0",
    "@fontsource/newsreader": "^5.1.0",
    "epubjs": "^0.3.93",
    "idb": "^8.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` and `tsconfig.node.json`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts` and `vitest.config.ts`**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // base is '/' for local dev; Plan 3 sets the GitHub Pages base.
  base: '/',
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
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts']
  }
});
```

- [ ] **Step 4: Create `test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 5: Create `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0B0B0D" />
    <title>Reader</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Reader</div>;
}
```

- [ ] **Step 6: Install and verify**

Run:
```bash
npm install
npm run build
npm test
```
Expected: `npm install` succeeds; `npm run build` produces `dist/`; `npm test` reports "No test files found" (exit 0) — that's fine at this point.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TS PWA with vitest"
```

---

### Task 2: Deterministic book id (`hash.ts`)

**Files:**
- Create: `src/lib/hash.ts`
- Test: `test/hash.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hashBytes(bytes: ArrayBuffer): string` — a stable lowercase hex string (FNV-1a, 32-bit) used as a book's unique id so re-opening the same file maps to the same record.

- [ ] **Step 1: Write the failing test**

`test/hash.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashBytes } from '../src/lib/hash';

const bytesOf = (s: string) => new TextEncoder().encode(s).buffer;

describe('hashBytes', () => {
  it('is deterministic for identical input', () => {
    expect(hashBytes(bytesOf('hello'))).toBe(hashBytes(bytesOf('hello')));
  });

  it('differs for different input', () => {
    expect(hashBytes(bytesOf('hello'))).not.toBe(hashBytes(bytesOf('world')));
  });

  it('returns lowercase hex', () => {
    expect(hashBytes(bytesOf('abc'))).toMatch(/^[0-9a-f]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hash.test.ts`
Expected: FAIL — cannot find module `../src/lib/hash`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/hash.ts`:
```ts
/** FNV-1a 32-bit hash of the given bytes, returned as lowercase hex. */
export function hashBytes(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let hash = 0x811c9dc5;
  for (let i = 0; i < view.length; i++) {
    hash ^= view[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/hash.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hash.ts test/hash.test.ts
git commit -m "feat: deterministic FNV-1a book id from file bytes"
```

---

### Task 3: Storage layer (`storage/db.ts`)

**Files:**
- Create: `src/lib/storage/db.ts`
- Test: `test/storage/db.test.ts`

**Interfaces:**
- Consumes: `idb` (`openDB`).
- Produces:
  - Types `BookRecord`, `ProgressRecord`, `SettingsRecord` (see code).
  - `putBook(b: BookRecord): Promise<void>`
  - `getBook(id: string): Promise<BookRecord | undefined>`
  - `getAllBooks(): Promise<BookRecord[]>`
  - `deleteBook(id: string): Promise<void>`
  - `putProgress(p: ProgressRecord): Promise<void>`
  - `getProgress(bookId: string): Promise<ProgressRecord | undefined>`
  - `getSettings(): Promise<SettingsRecord>` (returns `DEFAULT_SETTINGS` if none stored)
  - `putSettings(s: SettingsRecord): Promise<void>`
  - `DEFAULT_SETTINGS: SettingsRecord`

- [ ] **Step 1: Write the failing test**

`test/storage/db.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  putBook, getBook, getAllBooks, deleteBook,
  putProgress, getProgress,
  getSettings, putSettings, DEFAULT_SETTINGS,
  type BookRecord
} from '../../src/lib/storage/db';

const sampleBook = (id: string): BookRecord => ({
  id,
  title: `Title ${id}`,
  author: 'Author',
  source: 'local',
  data: new TextEncoder().encode('epub-bytes').buffer,
  addedAt: 1,
});

describe('storage/db', () => {
  beforeEach(async () => {
    for (const b of await getAllBooks()) await deleteBook(b.id);
  });

  it('stores and retrieves a book', async () => {
    await putBook(sampleBook('a'));
    const got = await getBook('a');
    expect(got?.title).toBe('Title a');
  });

  it('lists all books', async () => {
    await putBook(sampleBook('a'));
    await putBook(sampleBook('b'));
    expect((await getAllBooks()).map(b => b.id).sort()).toEqual(['a', 'b']);
  });

  it('deletes a book', async () => {
    await putBook(sampleBook('a'));
    await deleteBook('a');
    expect(await getBook('a')).toBeUndefined();
  });

  it('stores and retrieves progress by bookId', async () => {
    await putProgress({ bookId: 'a', cfi: 'epubcfi(/6/4!/x)', percent: 0.42, updatedAt: 2 });
    const p = await getProgress('a');
    expect(p?.percent).toBeCloseTo(0.42);
  });

  it('returns default settings when none stored', async () => {
    const s = await getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('persists updated settings', async () => {
    await putSettings({ ...DEFAULT_SETTINGS, fontSize: 24 });
    expect((await getSettings()).fontSize).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/storage/db.test.ts`
Expected: FAIL — cannot find module `db`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/storage/db.ts`:
```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  coverDataUrl?: string;
  source: 'local' | 'drive';
  driveFileId?: string;
  data: ArrayBuffer;
  addedAt: number;
}

export interface ProgressRecord {
  bookId: string;
  cfi: string;
  percent: number;
  updatedAt: number;
}

export interface SettingsRecord {
  id: 'app';
  readingFont: string;
  fontSize: number;   // px
  brightness: number; // 0.4 .. 1
  wpm: number;
  chunkSize: number;
  fixation: 'low' | 'med' | 'high';
  lastBookId?: string;
}

export const DEFAULT_SETTINGS: SettingsRecord = {
  id: 'app',
  readingFont: 'Literata',
  fontSize: 20,
  brightness: 1,
  wpm: 300,
  chunkSize: 1,
  fixation: 'med',
};

interface ReaderDB extends DBSchema {
  books: { key: string; value: BookRecord };
  progress: { key: string; value: ProgressRecord };
  settings: { key: 'app'; value: SettingsRecord };
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | null = null;

function db(): Promise<IDBPDatabase<ReaderDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ReaderDB>('reader', 1, {
      upgrade(d) {
        d.createObjectStore('books', { keyPath: 'id' });
        d.createObjectStore('progress', { keyPath: 'bookId' });
        d.createObjectStore('settings', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function putBook(b: BookRecord): Promise<void> {
  await (await db()).put('books', b);
}
export async function getBook(id: string): Promise<BookRecord | undefined> {
  return (await db()).get('books', id);
}
export async function getAllBooks(): Promise<BookRecord[]> {
  return (await db()).getAll('books');
}
export async function deleteBook(id: string): Promise<void> {
  await (await db()).delete('books', id);
}
export async function putProgress(p: ProgressRecord): Promise<void> {
  await (await db()).put('progress', p);
}
export async function getProgress(bookId: string): Promise<ProgressRecord | undefined> {
  return (await db()).get('progress', bookId);
}
export async function getSettings(): Promise<SettingsRecord> {
  return (await (await db()).get('settings', 'app')) ?? DEFAULT_SETTINGS;
}
export async function putSettings(s: SettingsRecord): Promise<void> {
  await (await db()).put('settings', s);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/storage/db.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/db.ts test/storage/db.test.ts
git commit -m "feat: IndexedDB storage for books, progress, settings"
```

---

### Task 4: Theme tokens + app chrome (`tokens.css`, `global.css`)

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Modify: `src/main.tsx` (import the stylesheets)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties on `:root` for the whole app (`--bg`, `--surface`, `--text`, `--text-2`, `--accent`, `--font-ui`, `--font-read`, `--reading-measure`). A dark, premium base with no visible test target — verified manually.

- [ ] **Step 1: Create `src/styles/tokens.css`**

```css
:root {
  --bg: #0B0B0D;
  --surface: #17171A;
  --text: #E8E4DC;
  --text-2: #9A968E;
  --accent: #E0B15D;

  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --font-read: "Literata", "Newsreader", Georgia, serif;

  --reading-measure: 66ch;
  --reading-line: 1.6;
  --radius: 14px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 2: Create `src/styles/global.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  height: 100%;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button {
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
  transition: transform 0.15s var(--ease), border-color 0.15s var(--ease);
}
button:hover { border-color: rgba(224, 177, 93, 0.5); }
button:active { transform: scale(0.97); }
```

- [ ] **Step 3: Import stylesheets in `src/main.tsx`**

Add these imports at the top of `src/main.tsx`, above the React imports (self-hosted OFL fonts first, so the reading typography works offline and matches the premium spec):
```tsx
import '@fontsource/literata/400.css';
import '@fontsource/literata/600.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/600.css';
import './styles/tokens.css';
import './styles/global.css';
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open the shown localhost URL.
Expected: a near-black warm background (`#0B0B0D`) with off-white "Reader" text. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles src/main.tsx
git commit -m "feat: premium dark theme tokens and base chrome"
```

---

### Task 5: EPUB wrapper (`epub/book.ts`)

**Files:**
- Create: `src/lib/epub/book.ts`

**Interfaces:**
- Consumes: `epubjs`, `BookRecord` type from `storage/db`.
- Produces:
  - `parseEpubMetadata(data: ArrayBuffer): Promise<{ title: string; author: string; coverDataUrl?: string }>` — used when importing a file.
  - `class ReaderBook` wrapping an epub.js rendition:
    - `constructor(data: ArrayBuffer)`
    - `render(el: HTMLElement, theme: RenderTheme, startCfi?: string): Promise<void>` — displays `startCfi` on the first paint (falls back to book start when omitted, avoiding a flash-to-chapter-1); generates locations in the background so text paints immediately.
    - `next(): Promise<void>` / `prev(): Promise<void>`
    - `onRelocated(cb: (loc: { cfi: string; percent: number }) => void): void`
    - `applyTheme(theme: RenderTheme): void`
    - `destroy(): void`
  - `interface RenderTheme { fontFamily: string; fontSizePx: number; brightness: number }`

**Verify before committing (highest-risk unknown in Plan 1):** confirm `ePub(data)` actually loads a real EPUB from an `ArrayBuffer`. If it fails, use `ePub(data, { openAs: 'binary' })` instead and record the working call form in the task report so Task 8 inherits it. Also confirm `coverDataUrl` (a base64 data URL) stays valid after `book.destroy()`.

- [ ] **Step 1: Write the implementation**

`src/lib/epub/book.ts`:
```ts
import ePub, { type Book, type Rendition } from 'epubjs';

export interface RenderTheme {
  fontFamily: string;
  fontSizePx: number;
  brightness: number; // 0.4 .. 1
}

export async function parseEpubMetadata(
  data: ArrayBuffer
): Promise<{ title: string; author: string; coverDataUrl?: string }> {
  const book = ePub(data);
  const meta = await book.loaded.metadata;
  let coverDataUrl: string | undefined;
  try {
    const coverUrl = await book.coverUrl();
    if (coverUrl) {
      const blob = await (await fetch(coverUrl)).blob();
      coverDataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
    }
  } catch {
    coverDataUrl = undefined;
  }
  book.destroy();
  return {
    title: meta.title || 'Untitled',
    author: meta.creator || 'Unknown',
    coverDataUrl,
  };
}

function themeStyles(theme: RenderTheme): Record<string, Record<string, string>> {
  return {
    body: {
      background: '#0B0B0D',
      color: '#E8E4DC',
      'font-family': `${theme.fontFamily}, Georgia, serif`,
      'font-size': `${theme.fontSizePx}px`,
      'line-height': '1.6',
      padding: '0 8px',
      filter: `brightness(${theme.brightness})`,
    },
    p: { 'margin': '0 0 1em 0' },
    a: { color: '#E0B15D' },
    'img': { 'max-width': '100%' },
  };
}

export class ReaderBook {
  private book: Book;
  private rendition: Rendition | null = null;
  private locationsReady: Promise<unknown> | null = null;

  constructor(data: ArrayBuffer) {
    this.book = ePub(data);
  }

  async render(el: HTMLElement, theme: RenderTheme, startCfi?: string): Promise<void> {
    this.rendition = this.book.renderTo(el, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'auto',
    });
    this.rendition.themes.default(themeStyles(theme));
    await this.book.ready;
    // Paint the saved position (or book start) first so there's no flash-to-chapter-1.
    await this.rendition.display(startCfi);
    // Then generate locations in the background (this can take seconds on a big book).
    // Percent progress stays 0 until it resolves, which is acceptable.
    this.locationsReady = this.book.locations.generate(1024).catch(() => undefined);
  }

  applyTheme(theme: RenderTheme): void {
    this.rendition?.themes.default(themeStyles(theme));
  }

  async next(): Promise<void> { await this.rendition?.next(); }
  async prev(): Promise<void> { await this.rendition?.prev(); }

  onRelocated(cb: (loc: { cfi: string; percent: number }) => void): void {
    this.rendition?.on('relocated', (location: any) => {
      const cfi = location?.start?.cfi ?? '';
      const percent = cfi && this.book.locations.length()
        ? this.book.locations.percentageFromCfi(cfi)
        : 0;
      cb({ cfi, percent });
    });
  }

  destroy(): void {
    this.rendition?.destroy();
    this.book.destroy();
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors. (No unit test — epub.js needs a real browser; it is exercised via manual verification in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/epub/book.ts
git commit -m "feat: epub.js wrapper for metadata, rendering, locations"
```

---

### Task 6: Settings + Library contexts (`state/settings.tsx`, `state/library.tsx`)

**Files:**
- Create: `src/state/settings.tsx`, `src/state/library.tsx`

**Interfaces:**
- Consumes: `storage/db` accessors and types, `hashBytes`, `parseEpubMetadata`.
- Produces:
  - `SettingsProvider` + `useSettings(): { settings: SettingsRecord; update: (patch: Partial<SettingsRecord>) => void }` (persists to IndexedDB on update).
  - `LibraryProvider` + `useLibrary(): { books: BookRecord[]; importFile: (file: File) => Promise<string>; remove: (id: string) => Promise<void> }`. `importFile` returns the new book's id.

- [ ] **Step 1: Write `src/state/settings.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSettings, putSettings, DEFAULT_SETTINGS, type SettingsRecord } from '../lib/storage/db';

interface SettingsCtx {
  settings: SettingsRecord;
  update: (patch: Partial<SettingsRecord>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsRecord>(DEFAULT_SETTINGS);

  useEffect(() => { getSettings().then(setSettings); }, []);

  const update = (patch: Partial<SettingsRecord>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      putSettings(next);
      return next;
    });
  };

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used within SettingsProvider');
  return v;
}
```

- [ ] **Step 2: Write `src/state/library.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getAllBooks, putBook, deleteBook, type BookRecord,
} from '../lib/storage/db';
import { hashBytes } from '../lib/hash';
import { parseEpubMetadata } from '../lib/epub/book';

interface LibraryCtx {
  books: BookRecord[];
  importFile: (file: File) => Promise<string>;
  remove: (id: string) => Promise<void>;
}

const Ctx = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<BookRecord[]>([]);

  const refresh = async () => {
    const all = await getAllBooks();
    all.sort((a, b) => b.addedAt - a.addedAt);
    setBooks(all);
  };

  useEffect(() => { refresh(); }, []);

  const importFile = async (file: File): Promise<string> => {
    const data = await file.arrayBuffer();
    const id = hashBytes(data);
    const meta = await parseEpubMetadata(data);
    const record: BookRecord = {
      id,
      title: meta.title,
      author: meta.author,
      coverDataUrl: meta.coverDataUrl,
      source: 'local',
      data,
      addedAt: Date.now(),
    };
    await putBook(record);
    await refresh();
    return id;
  };

  const remove = async (id: string) => {
    await deleteBook(id);
    await refresh();
  };

  return <Ctx.Provider value={{ books, importFile, remove }}>{children}</Ctx.Provider>;
}

export function useLibrary(): LibraryCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary must be used within LibraryProvider');
  return v;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/state
git commit -m "feat: settings and library React contexts backed by IndexedDB"
```

---

### Task 7: Library UI (`TopBar`, `Library`, `BookCover`) + wire into `App`

**Files:**
- Create: `src/components/TopBar.tsx`, `src/components/Library.tsx`, `src/components/BookCover.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useLibrary`, `BookRecord`.
- Produces: `App` renders providers + a Library screen. Selecting a book sets `openBookId` state (Reader wired in Task 8). `Library` exposes an "Open EPUB" file input that calls `importFile`.

- [ ] **Step 1: Write `src/components/TopBar.tsx`**

```tsx
export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        background: 'rgba(11,11,13,0.72)',
        backdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{ padding: '6px 10px' }}>←</button>
      )}
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '0.01em' }}>{title}</h1>
    </header>
  );
}
```

- [ ] **Step 2: Write `src/components/BookCover.tsx`**

```tsx
import type { BookRecord } from '../lib/storage/db';

export function BookCover({ book, onOpen }: { book: BookRecord; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius)',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          aspectRatio: '2 / 3',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#111',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {book.coverDataUrl ? (
          <img src={book.coverDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-read)', padding: 8, textAlign: 'center' }}>
            {book.title}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{book.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{book.author}</div>
    </button>
  );
}
```

- [ ] **Step 3: Write `src/components/Library.tsx`**

```tsx
import { useRef } from 'react';
import { useLibrary } from '../state/library';
import { BookCover } from './BookCover';

export function Library({ onOpenBook }: { onOpenBook: (id: string) => void }) {
  const { books, importFile } = useLibrary();
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const id = await importFile(file);
      onOpenBook(id);
    }
    e.target.value = '';
  };

  return (
    <div style={{ padding: 18 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={onPick}
        style={{ display: 'none' }}
      />
      <button onClick={() => inputRef.current?.click()} style={{ marginBottom: 18 }}>
        Open EPUB
      </button>

      {books.length === 0 ? (
        <p style={{ color: 'var(--text-2)' }}>Your library is empty. Open an EPUB to begin.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          }}
        >
          {books.map((b) => (
            <BookCover key={b.id} book={b} onOpen={() => onOpenBook(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/App.tsx`**

```tsx
import { useState } from 'react';
import { SettingsProvider } from './state/settings';
import { LibraryProvider } from './state/library';
import { TopBar } from './components/TopBar';
import { Library } from './components/Library';

export default function App() {
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  return (
    <SettingsProvider>
      <LibraryProvider>
        {openBookId ? (
          <>
            <TopBar title="Reading" onBack={() => setOpenBookId(null)} />
            <div style={{ padding: 18, color: 'var(--text-2)' }}>
              Reader mounts here (Task 8): {openBookId}
            </div>
          </>
        ) : (
          <>
            <TopBar title="Reader" />
            <Library onOpenBook={setOpenBookId} />
          </>
        )}
      </LibraryProvider>
    </SettingsProvider>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`.
Expected: "Reader" top bar + "Open EPUB" button. Clicking it opens a file picker; choosing an EPUB adds a cover card and switches to the placeholder "Reader mounts here" view showing the book id. Reloading the page still shows the imported book in the grid (persisted).

- [ ] **Step 6: Commit**

```bash
git add src/components src/App.tsx
git commit -m "feat: library grid with local EPUB import and cover cards"
```

---

### Task 8: Reader view with resume + controls (`Reader`, `ReaderControls`)

**Files:**
- Create: `src/components/Reader.tsx`, `src/components/ReaderControls.tsx`
- Modify: `src/App.tsx` (mount `Reader` for `openBookId`)

**Interfaces:**
- Consumes: `ReaderBook`, `RenderTheme`, `getBook`, `getProgress`, `putProgress`, `useSettings`.
- Produces: `Reader` renders a book full-screen, restores saved CFI on open, saves CFI + percent on every relocation (debounced), turns pages via edge taps / arrow keys, and shows a progress bar. `ReaderControls` adjusts font size, reading font, brightness (persisted via settings).

- [ ] **Step 1: Write `src/components/ReaderControls.tsx`**

```tsx
import { useSettings } from '../state/settings';

const FONTS = ['Literata', 'Newsreader', 'Georgia'];

export function ReaderControls({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 72,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        width: 240,
        background: 'rgba(23,23,26,0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius)',
      }}
    >
      <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Font size: {settings.fontSize}px
        <input
          type="range" min={14} max={30} value={settings.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </label>
      <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Brightness: {Math.round(settings.brightness * 100)}%
        <input
          type="range" min={40} max={100} value={Math.round(settings.brightness * 100)}
          onChange={(e) => update({ brightness: Number(e.target.value) / 100 })}
          style={{ width: '100%' }}
        />
      </label>
      <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Reading font
        <select
          value={settings.readingFont}
          onChange={(e) => update({ readingFont: e.target.value })}
          style={{ width: '100%', marginTop: 4 }}
        >
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <button onClick={onClose}>Done</button>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/Reader.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { ReaderBook, type RenderTheme } from '../lib/epub/book';
import { getBook, getProgress, putProgress } from '../lib/storage/db';
import { useSettings } from '../state/settings';
import { ReaderControls } from './ReaderControls';

export function Reader({ bookId }: { bookId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<ReaderBook | null>(null);
  const [percent, setPercent] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const { settings } = useSettings();

  const theme: RenderTheme = {
    fontFamily: settings.readingFont,
    fontSizePx: settings.fontSize,
    brightness: settings.brightness,
  };

  // Mount the book once.
  useEffect(() => {
    let cancelled = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const rec = await getBook(bookId);
      if (!rec || cancelled || !hostRef.current) return;
      const saved = await getProgress(bookId);
      const rb = new ReaderBook(rec.data);
      bookRef.current = rb;
      // Pass the saved CFI into render so it paints there directly (no flash).
      await rb.render(hostRef.current, theme, saved?.cfi);
      rb.onRelocated(({ cfi, percent }) => {
        setPercent(percent);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          putProgress({ bookId, cfi, percent, updatedAt: Date.now() });
        }, 400);
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(saveTimer);
      bookRef.current?.destroy();
      bookRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // Re-apply theme when settings change.
  useEffect(() => {
    bookRef.current?.applyTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.readingFont, settings.fontSize, settings.brightness]);

  // Keyboard page turns.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') bookRef.current?.next();
      if (e.key === 'ArrowLeft') bookRef.current?.prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, top: 56 }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Edge tap zones for page turns */}
      <button
        aria-label="Previous page"
        onClick={() => bookRef.current?.prev()}
        style={edgeZone('left')}
      />
      <button
        aria-label="Next page"
        onClick={() => bookRef.current?.next()}
        style={edgeZone('right')}
      />

      {/* Progress bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', width: `${Math.round(percent * 100)}%`, background: 'var(--accent)' }} />
      </div>

      <button
        onClick={() => setShowControls((s) => !s)}
        style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 20 }}
      >
        Aa
      </button>
      {showControls && <ReaderControls onClose={() => setShowControls(false)} />}
    </div>
  );
}

function edgeZone(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width: '25%',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    zIndex: 5,
  };
}
```

- [ ] **Step 3: Wire `Reader` into `src/App.tsx`**

Replace the placeholder reader block in `App.tsx` (the `<div>Reader mounts here…</div>`) with the real component. The `openBookId` branch becomes:
```tsx
{openBookId ? (
  <>
    <TopBar title="Reading" onBack={() => setOpenBookId(null)} />
    <Reader bookId={openBookId} />
  </>
) : (
```
And add the import at the top:
```tsx
import { Reader } from './components/Reader';
```

- [ ] **Step 4: Verify manually (core acceptance)**

Run: `npm run dev`.
Expected:
1. Open an EPUB → it renders in the dark theme with serif body text.
2. Click right edge / press `→` → page advances; left edge / `←` → back.
3. Open the `Aa` panel → changing font size, brightness, and reading font updates the page live.
4. Note your page, go Back to the library, reopen the same book → it resumes at the same spot.
5. Reload the browser, reopen the book → still resumes (progress persisted).
6. The amber progress bar advances as you read.

- [ ] **Step 5: Commit**

```bash
git add src/components/Reader.tsx src/components/ReaderControls.tsx src/App.tsx
git commit -m "feat: EPUB reader view with resume, page turns, and live controls"
```

---

### Task 9: PWA icons + installability + offline shell

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Verify: `vite-plugin-pwa` config from Task 1 already registers the service worker.

**Interfaces:**
- Consumes: the manifest defined in `vite.config.ts` (Task 1).
- Produces: a build whose service worker precaches the app shell so it launches offline, and a manifest that lets the app install to a home screen.

- [ ] **Step 1: Generate placeholder icons**

Create two solid dark PNG icons with an amber glyph. Run:
```bash
mkdir -p public/icons
```
Then generate them (uses ImageMagick if available; otherwise create any 192×192 and 512×512 PNG named as below):
```bash
convert -size 512x512 xc:'#0B0B0D' -fill '#E0B15D' -gravity center \
  -pointsize 320 -font DejaVu-Serif label:'R' public/icons/icon-512.png 2>/dev/null || \
  echo "ImageMagick not found — create public/icons/icon-512.png (512x512) manually"
convert public/icons/icon-512.png -resize 192x192 public/icons/icon-192.png 2>/dev/null || \
  echo "Also create public/icons/icon-192.png (192x192) manually"
```
Expected: both PNG files exist under `public/icons/`.

- [ ] **Step 2: Build and preview**

Run:
```bash
npm run build
npm run preview
```
Expected: build completes; preview serves on a localhost URL.

- [ ] **Step 3: Verify installability + offline (manual)**

In Chrome on the preview URL:
1. DevTools → Application → Manifest: name "Reader", both icons load, no errors.
2. Application → Service Workers: a worker is "activated and running".
3. Import a book, then in DevTools Network toggle "Offline" and reload → the app shell still loads and the library (with cached book bytes) still opens the book.

Expected: all three succeed.

- [ ] **Step 4: Commit**

```bash
git add public/icons vite.config.ts
git commit -m "feat: PWA icons, installable manifest, offline app shell"
```

---

## Self-Review

**1. Spec coverage (against `2026-09-02-reader-design.md`):**
- §3 PWA/React/Vite/TS/epub.js/IndexedDB → Tasks 1, 3, 5, 9. ✅
- §6 premium dark aesthetic (palette, serif fonts, blurred top bar, adjustable font/brightness) → Tasks 4, 7, 8. ✅
- §8 library grid, auto-resume, progress % → Tasks 7, 8. ✅
- §9 data model (books/progress/settings) → Task 3. ✅
- §10 acceptance criteria 1,3(local part),4,5,6,10 → Tasks 7,8,9. ✅
- Out of Plan 1 by design (covered in later plans): RSVP + Bionic + press-and-hold (§7 → Plan 2); Google Drive + email allowlist + deploy (§4,§5 → Plan 3). Acceptance criteria 2,7,8,9 and the Drive part of 3 belong to Plans 2–3. ✅ (no gaps for Plan 1's scope)

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"write tests for the above" — all code is concrete. The `App.tsx` "Reader mounts here" text is an intentional intermediate state in Task 7, replaced with the real component in Task 8. ✅

**3. Type consistency:** `BookRecord`/`ProgressRecord`/`SettingsRecord` defined in Task 3 are consumed unchanged in Tasks 5–8. `RenderTheme { fontFamily, fontSizePx, brightness }` defined in Task 5 is constructed identically in Task 8. `ReaderBook` methods (`render(el, theme, startCfi?)`, `next`, `prev`, `onRelocated`, `applyTheme`, `destroy`) called in Task 8 all match Task 5. `useSettings`/`useLibrary` signatures match between Task 6 and Tasks 7–8. ✅

---

## Notes for Plan 2 & 3 (not part of this plan)

- Plan 2 (speed reading) will add `src/lib/speedreading/*` (tokenize, orp, bionic, rsvp engine) — all pure and TDD-friendly — plus a `usePressHold` hook and overlay components, reading text from a new `ReaderBook.extractText()` method.
- Plan 3 (Drive + deploy) will add `src/lib/drive/*` and `src/lib/auth/allowlist.ts`, set `vite.config.ts` `base` to the GitHub Pages path, and add the Google Cloud OAuth setup runbook.
