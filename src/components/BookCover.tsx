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
