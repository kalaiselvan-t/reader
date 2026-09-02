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
