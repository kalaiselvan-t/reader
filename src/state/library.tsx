import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getAllBooks, putBook, deleteBook, type BookRecord,
} from '../lib/storage/db';
import { hashBytes } from '../lib/hash';
import { parseEpubMetadata } from '../lib/epub/book';
import { parseFolderId } from '../lib/drive/folderLink';
import { verifyFolder, listEpubFiles, downloadFile } from '../lib/drive/driveClient';

interface LibraryCtx {
  books: BookRecord[];
  importFile: (file: File) => Promise<string>;
  remove: (id: string) => Promise<void>;
  syncDriveFolder: (accessToken: string, folderInput: string) => Promise<{ added: number; skipped: number; failed: number; relinked: number }>;
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

  const syncDriveFolder = async (
    accessToken: string,
    folderInput: string
  ): Promise<{ added: number; skipped: number; failed: number; relinked: number }> => {
    const folderId = parseFolderId(folderInput);
    if (!folderId) {
      throw new Error("Couldn't find a folder id in that link.");
    }
    // Confirm this is a real, visible folder before listing — a bogus id
    // would otherwise silently produce "0 added", indistinguishable from a
    // real empty folder.
    await verifyFolder(accessToken, folderId);
    const files = await listEpubFiles(accessToken, folderId);
    const existingBooks = await getAllBooks();
    const existingDriveIds = new Set(
      existingBooks.map((b) => b.driveFileId).filter((id): id is string => Boolean(id))
    );
    // All existing book ids (regardless of source) — lets us tell a
    // genuinely new download apart from one that just re-links a book
    // already in the library under a different source (e.g. imported
    // locally first, now also found in the synced Drive folder). Without
    // this, re-linking the same content would inflate "added".
    const existingIds = new Set(existingBooks.map((b) => b.id));
    let added = 0;
    let skipped = 0;
    let failed = 0;
    let relinked = 0;
    for (const file of files) {
      if (existingDriveIds.has(file.id)) {
        skipped += 1;
        continue;
      }
      // Each file is isolated: one corrupt/unparseable EPUB is counted and
      // skipped, not allowed to abort the whole sync and lose books already
      // added earlier in this same run.
      try {
        const data = await downloadFile(accessToken, file.id);
        const id = hashBytes(data);
        const meta = await parseEpubMetadata(data);
        const isRelink = existingIds.has(id);
        await putBook({
          id,
          title: meta.title,
          author: meta.author,
          coverDataUrl: meta.coverDataUrl,
          source: 'drive',
          driveFileId: file.id,
          data,
          addedAt: Date.now(),
        });
        if (isRelink) {
          relinked += 1;
        } else {
          added += 1;
        }
      } catch {
        failed += 1;
      }
    }
    await refresh();
    return { added, skipped, failed, relinked };
  };

  return (
    <Ctx.Provider value={{ books, importFile, remove, syncDriveFolder }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLibrary(): LibraryCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLibrary must be used within LibraryProvider');
  return v;
}
