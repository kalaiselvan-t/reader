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
