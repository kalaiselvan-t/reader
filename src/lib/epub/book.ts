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
  // Let epub.js's background load chains settle before destroying the book.
  // Destroying while any of them is still in flight leaves internal state
  // (`book.loading`, `book.resources`) undefined by the time a queued `.then()`
  // callback runs, producing unhandled TypeErrors on real EPUB imports:
  //   - `loadNavigation(...).then(() => this.loading.navigation.resolve(...))`
  //     reads `this.loading` after destroy nulls it (the 'navigation' error).
  //   - `resources.replacements().then(() => resources.replaceCss())` reads
  //     `this.resources` after destroy nulls it (the 'replaceCss' error).
  // `book.ready` is NOT sufficient to guard against the second one: it is
  // `Promise.all([..., loaded.resources, ...])`, and `loaded.resources`
  // resolves synchronously the instant the `Resources` object is constructed
  // (epubjs `book.js` `unpack()`), *before* the replacements()/replaceCss()
  // chain is even started — confirmed empirically (a spy on `replaceCss`
  // never fires before `book.ready` resolves). `book.opened` is the promise
  // that actually gates on that chain finishing (for archived/ArrayBuffer
  // books, `unpack()` only resolves `book.opened` after
  // `replacements().then(() => replaceCss())` and displayOptions settle), so
  // it's the correct one to await here. Like `loaded.navigation`, `opened` is
  // only ever resolved, never rejected, by epub.js, and can hang indefinitely
  // on a malformed EPUB — race it against a short timeout so `destroy()`
  // always eventually runs.
  await Promise.race([
    book.opened.catch(() => {}),
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
