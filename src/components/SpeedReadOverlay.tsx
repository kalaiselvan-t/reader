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
