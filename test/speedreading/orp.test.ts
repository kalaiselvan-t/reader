import { describe, it, expect } from 'vitest';
import { orpIndex } from '../../src/lib/speedreading/orp';

describe('orpIndex', () => {
  it('maps word length to a pivot index (Spritz-style)', () => {
    expect(orpIndex('a')).toBe(0);          // 1
    expect(orpIndex('to')).toBe(1);         // 2
    expect(orpIndex('cat')).toBe(1);        // 3
    expect(orpIndex('reading')).toBe(2);    // 7
    expect(orpIndex('wonderful')).toBe(2);  // 9
    expect(orpIndex('exceptional')).toBe(3);// 11
    expect(orpIndex('extraordinary')).toBe(3); // 13
    expect(orpIndex('internationalization')).toBe(4); // 20
  });

  it('returns 0 for empty string', () => {
    expect(orpIndex('')).toBe(0);
  });
});
