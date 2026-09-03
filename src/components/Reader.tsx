import { useEffect, useRef, useState } from 'react';
import { ReaderBook, type RenderTheme } from '../lib/epub/book';
import { getBook, getProgress, putProgress } from '../lib/storage/db';
import { useSettings } from '../state/settings';
import { ReaderControls } from './ReaderControls';
import { SpeedReadOverlay } from './SpeedReadOverlay';

export function Reader({ bookId }: { bookId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<ReaderBook | null>(null);
  const [percent, setPercent] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [speedText, setSpeedText] = useState<string | null>(null);
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
      // Seed the progress bar from the saved record immediately — otherwise
      // onRelocated (registered after render()) doesn't fire until the first
      // page turn, so a resumed book shows a stale 0% until then.
      setPercent(saved?.percent ?? 0);
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

  const openSpeedRead = async () => {
    const t = await bookRef.current?.extractForward();
    if (t && t.trim()) setSpeedText(t);
  };

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
        onClick={openSpeedRead}
        aria-label="Speed read"
        style={{ position: 'absolute', right: 64, bottom: 16, zIndex: 20 }}
      >
        ⚡
      </button>
      <button
        onClick={() => setShowControls((s) => !s)}
        style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 20 }}
      >
        Aa
      </button>
      {showControls && <ReaderControls onClose={() => setShowControls(false)} />}
      {speedText !== null && (
        <SpeedReadOverlay text={speedText} onClose={() => setSpeedText(null)} />
      )}
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
