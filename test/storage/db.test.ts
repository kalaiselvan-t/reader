import { describe, it, expect, beforeEach } from 'vitest';
import {
  putBook, getBook, getAllBooks, deleteBook,
  putProgress, getProgress,
  getSettings, putSettings, DEFAULT_SETTINGS,
  type BookRecord
} from '../../src/lib/storage/db';

const sampleBook = (id: string): BookRecord => ({
  id,
  title: `Title ${id}`,
  author: 'Author',
  source: 'local',
  data: new TextEncoder().encode('epub-bytes').buffer,
  addedAt: 1,
});

describe('storage/db', () => {
  beforeEach(async () => {
    for (const b of await getAllBooks()) await deleteBook(b.id);
  });

  it('stores and retrieves a book', async () => {
    await putBook(sampleBook('a'));
    const got = await getBook('a');
    expect(got?.title).toBe('Title a');
  });

  it('lists all books', async () => {
    await putBook(sampleBook('a'));
    await putBook(sampleBook('b'));
    expect((await getAllBooks()).map(b => b.id).sort()).toEqual(['a', 'b']);
  });

  it('deletes a book', async () => {
    await putBook(sampleBook('a'));
    await deleteBook('a');
    expect(await getBook('a')).toBeUndefined();
  });

  it('stores and retrieves progress by bookId', async () => {
    await putProgress({ bookId: 'a', cfi: 'epubcfi(/6/4!/x)', percent: 0.42, updatedAt: 2 });
    const p = await getProgress('a');
    expect(p?.percent).toBeCloseTo(0.42);
  });

  it('returns default settings when none stored', async () => {
    const s = await getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('persists updated settings', async () => {
    await putSettings({ ...DEFAULT_SETTINGS, fontSize: 24 });
    expect((await getSettings()).fontSize).toBe(24);
  });
});
