import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  coverDataUrl?: string;
  source: 'local' | 'drive';
  driveFileId?: string;
  data: ArrayBuffer;
  addedAt: number;
}

export interface ProgressRecord {
  bookId: string;
  cfi: string;
  percent: number;
  updatedAt: number;
}

export interface SettingsRecord {
  id: 'app';
  readingFont: string;
  fontSize: number;   // px
  brightness: number; // 0.4 .. 1
  wpm: number;
  chunkSize: number;
  fixation: 'low' | 'med' | 'high';
  lastBookId?: string;
}

export const DEFAULT_SETTINGS: SettingsRecord = {
  id: 'app',
  readingFont: 'Literata',
  fontSize: 20,
  brightness: 1,
  wpm: 300,
  chunkSize: 1,
  fixation: 'med',
};

interface ReaderDB extends DBSchema {
  books: { key: string; value: BookRecord };
  progress: { key: string; value: ProgressRecord };
  settings: { key: 'app'; value: SettingsRecord };
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | null = null;

function db(): Promise<IDBPDatabase<ReaderDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ReaderDB>('reader', 1, {
      upgrade(d) {
        d.createObjectStore('books', { keyPath: 'id' });
        d.createObjectStore('progress', { keyPath: 'bookId' });
        d.createObjectStore('settings', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function putBook(b: BookRecord): Promise<void> {
  await (await db()).put('books', b);
}
export async function getBook(id: string): Promise<BookRecord | undefined> {
  return (await db()).get('books', id);
}
export async function getAllBooks(): Promise<BookRecord[]> {
  return (await db()).getAll('books');
}
export async function deleteBook(id: string): Promise<void> {
  await (await db()).delete('books', id);
}
export async function putProgress(p: ProgressRecord): Promise<void> {
  await (await db()).put('progress', p);
}
export async function getProgress(bookId: string): Promise<ProgressRecord | undefined> {
  return (await db()).get('progress', bookId);
}
export async function getSettings(): Promise<SettingsRecord> {
  return (await (await db()).get('settings', 'app')) ?? DEFAULT_SETTINGS;
}
export async function putSettings(s: SettingsRecord): Promise<void> {
  await (await db()).put('settings', s);
}
