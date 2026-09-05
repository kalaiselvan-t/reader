import { describe, it, expect } from 'vitest';
import { parseFolderId } from '../../src/lib/drive/folderLink';

describe('parseFolderId', () => {
  it('extracts the id from a standard folder share link', () => {
    expect(parseFolderId('https://drive.google.com/drive/folders/1AbC-XyZ_0123456789')).toBe('1AbC-XyZ_0123456789');
  });

  it('extracts the id from a link with a user index and query string', () => {
    expect(parseFolderId('https://drive.google.com/drive/u/0/folders/1AbC-XyZ_0123456789?usp=sharing')).toBe('1AbC-XyZ_0123456789');
  });

  it('accepts a bare folder id with no link', () => {
    expect(parseFolderId('1AbC-XyZ_0123456789')).toBe('1AbC-XyZ_0123456789');
  });

  it('trims surrounding whitespace', () => {
    expect(parseFolderId('  1AbC-XyZ_0123456789  ')).toBe('1AbC-XyZ_0123456789');
  });

  it('returns null for an unrelated url', () => {
    expect(parseFolderId('https://example.com/not-drive')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseFolderId('')).toBeNull();
  });

  it('returns null for a string with invalid id characters', () => {
    expect(parseFolderId('not a valid id!')).toBeNull();
  });
});
