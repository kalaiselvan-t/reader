import ePub, { type Book, type Rendition } from 'epubjs';
import literata400 from '@fontsource/literata/files/literata-latin-400-normal.woff2?url';
import literata600 from '@fontsource/literata/files/literata-latin-600-normal.woff2?url';
import newsreader400 from '@fontsource/newsreader/files/newsreader-latin-400-normal.woff2?url';
import newsreader600 from '@fontsource/newsreader/files/newsreader-latin-600-normal.woff2?url';

export interface RenderTheme {
  fontFamily: string;
  fontSizePx: number;
  brightness: number; // 0.4 .. 1
}

// epub.js renders each chapter inside its own iframe, which is a separate
// document — @font-face rules declared in the parent document (main.tsx's
// `@fontsource/...` CSS imports) do not cross into it. Without this, the
// rendition's `font-family` rule always falls through to the Georgia
// fallback and switching readingFont is a visual no-op. Build the same
// @font-face declarations from the same self-hosted woff2 files (bundled to
// app-origin absolute URLs by Vite's `?url` import) and inject them directly
// into each content document via a rendition content hook.
const FONT_FACE_CSS = `
@font-face {
  font-family: 'Literata';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${literata400}) format('woff2');
}
@font-face {
  font-family: 'Literata';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(${literata600}) format('woff2');
}
@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${newsreader400}) format('woff2');
}
@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(${newsreader600}) format('woff2');
}
`;

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
  // Let epub.js's background load chains settle before destroying the book.
  // Destroying while either is still in flight leaves internal state
  // (`book.loading`, `book.resources`) undefined by the time a queued `.then()`
  // callback runs, producing unhandled TypeErrors on real EPUB imports. Two
  // *independent* chains need to be awaited — neither one covers the other:
  //   - `loadNavigation(...).then(() => this.loading.navigation.resolve(...))`
  //     (epubjs `book.js` `unpack()`) reads `this.loading` after destroy nulls
  //     it (the 'navigation' error). This chain is separate from `opened` —
  //     nothing on the `opened` path waits for it — so `book.opened` alone
  //     does not guard against it. Guarded by `book.loaded.navigation`.
  //   - `resources.replacements().then(() => resources.replaceCss())` reads
  //     `this.resources` after destroy nulls it (the 'replaceCss' error).
  //     `book.ready` does NOT guard against this: it's
  //     `Promise.all([..., loaded.resources, ...])`, and `loaded.resources`
  //     resolves synchronously the instant the `Resources` object is
  //     constructed, *before* the replacements()/replaceCss() chain even
  //     starts (confirmed empirically — a spy on `replaceCss` never fires
  //     before `book.ready` resolves). `book.opened` is the promise that
  //     actually gates on that chain finishing (for archived/ArrayBuffer
  //     books, `unpack()` only resolves `book.opened` after
  //     `replacements().then(() => replaceCss())` and displayOptions settle).
  //     Guarded by `book.opened`.
  // Both `opened` and `loaded.navigation` are only ever resolved, never
  // rejected, by epub.js, and either can hang indefinitely on a malformed
  // EPUB — race the pair against a short timeout so `destroy()` always
  // eventually runs.
  await Promise.race([
    Promise.all([
      book.opened.catch(() => {}),
      book.loaded.navigation.catch(() => {}),
    ]),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
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
    // Register before the first `display()` so the first-painted content
    // document gets the @font-face rules too (not just later chapters).
    this.rendition.hooks.content.register((contents: any) => {
      const style = contents.document.createElement('style');
      style.textContent = FONT_FACE_CSS;
      contents.document.head.appendChild(style);
    });
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
    // Referenced (not awaited) so the strict `noUnusedLocals` check doesn't flag this
    // field; background location generation is best-effort and doesn't block teardown.
    void this.locationsReady;
    this.rendition?.destroy();
    this.book.destroy();
  }
}
