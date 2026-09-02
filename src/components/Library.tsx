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
