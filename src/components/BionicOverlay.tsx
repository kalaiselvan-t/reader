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

  // Auto-scroll while held, at a reading pace derived from WPM.
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
          lineHeight: 'var(--reading-line)', color: 'var(--text)', touchAction: 'pan-y',
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
