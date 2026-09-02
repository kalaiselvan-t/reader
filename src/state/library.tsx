import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getAllBooks, putBook, deleteBook, type BookRecord,
} from '../lib/storage/db';
import { hashBytes } from '../lib/hash';
import { parseEpubMetadata } from '../lib/epub/book';

interface LibraryCtx {
  books: BookRecord[];
  importFile: (file: File) => Promise<string>;
  remove: (id: string) => Promise<void>;
}

const Ctx = createContext<LibraryCtx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<BookRecord[]>([]);

  const refresh = async () => {
    const all = await getAllBooks();
    all.sort((a, b) => b.addedAt - a.addedAt);
    setBooks(all);
  };

  useEffect(() => { refresh(); }, []);

  const importFile = async (file: File): Promise<string> => {
    const data = await file.arrayBuffer();
    const id = hashBytes(data);
    const meta = await parseEpubMetadata(data);
    const record: BookRecord = {
      id,
      title: meta.title,
      author: meta.author,
      coverDataUrl: meta.coverDataUrl,
      source: 'local',
      data,
      addedAt: Date.now(),
    };
    await putBook(record);
    await refresh();
    return id;
  };

  const remove = async (id: string) => {
    await deleteBook(id);
    await refresh();
  };

  return <Ctx.Provider value={{ books, importFile, remove }}>{children}</Ctx.Provider>;
}

export function useLibrary(): LibraryCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary must be used within LibraryProvider');
  return v;
}
