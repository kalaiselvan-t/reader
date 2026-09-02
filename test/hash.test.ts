import { describe, it, expect } from 'vitest';
import { hashBytes } from '../src/lib/hash';

const bytesOf = (s: string) => new TextEncoder().encode(s).buffer;

describe('hashBytes', () => {
  it('is deterministic for identical input', () => {
    expect(hashBytes(bytesOf('hello'))).toBe(hashBytes(bytesOf('hello')));
  });

  it('differs for different input', () => {
    expect(hashBytes(bytesOf('hello'))).not.toBe(hashBytes(bytesOf('world')));
  });

  it('returns lowercase hex', () => {
    expect(hashBytes(bytesOf('abc'))).toMatch(/^[0-9a-f]+$/);
  });
});
