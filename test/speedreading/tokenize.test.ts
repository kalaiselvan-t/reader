import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/lib/speedreading/tokenize';

describe('tokenize', () => {
  it('splits words and marks the last word of a paragraph as a paragraph pause', () => {
    const t = tokenize('Hello world');
    expect(t.map((x) => x.text)).toEqual(['Hello', 'world']);
    expect(t[0].pause).toBe(1);
    expect(t[1].pause).toBe(2.5); // paragraph end
  });

  it('assigns clause and sentence pauses from trailing punctuation', () => {
    const t = tokenize('One, two. Three four');
    expect(t[0].pause).toBe(1.5); // One,
    expect(t[1].pause).toBe(2);   // two.
    expect(t[2].pause).toBe(1);   // Three
    expect(t[3].pause).toBe(2.5); // four (paragraph end)
  });

  it('treats blank-line-separated blocks as separate paragraphs', () => {
    const t = tokenize('A\n\nB');
    expect(t.map((x) => x.text)).toEqual(['A', 'B']);
    expect(t[0].pause).toBe(2.5);
    expect(t[1].pause).toBe(2.5);
  });

  it('detects sentence punctuation even behind a closing quote or bracket', () => {
    const t = tokenize('He said "run!" now');
    // "run!" -> strip trailing quote, last char is ! -> sentence
    expect(t[2].pause).toBe(2);
  });

  it('returns an empty array for empty/whitespace text', () => {
    expect(tokenize('   \n  ')).toEqual([]);
  });
});
