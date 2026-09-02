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
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
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
