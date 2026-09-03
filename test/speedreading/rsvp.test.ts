import { describe, it, expect } from 'vitest';
import { chunk, chunkDelayMs } from '../../src/lib/speedreading/rsvp';
import { tokenize } from '../../src/lib/speedreading/tokenize';

describe('chunk', () => {
  it('groups tokens into fixed-size chunks', () => {
    const toks = tokenize('one two three four five six'); // last word pause 2.5
    const c = chunk(toks, 2);
    expect(c[0].text).toBe('one two');
    expect(c[0].wordCount).toBe(2);
    expect(c[0].orpWord).toBe('one'); // pivot aligns on first word
  });

  it('breaks a chunk early at a sentence/paragraph boundary', () => {
    const toks = tokenize('Stop. Go now');
    const c = chunk(toks, 3);
    // "Stop." ends a sentence (pause 2) -> chunk breaks after it despite size 3
    expect(c[0].text).toBe('Stop.');
    expect(c[1].text).toBe('Go now');
  });

  it('carries the last token pause onto the chunk', () => {
    const toks = tokenize('a b. c');
    const c = chunk(toks, 2);
    expect(c[0].pause).toBe(2); // ends on "b."
  });

  it('handles size <= 0 as size 1', () => {
    const toks = tokenize('a b c');
    expect(chunk(toks, 0).length).toBe(3);
  });
});

describe('chunkDelayMs', () => {
  it('is baseWordTime * wordCount * pause', () => {
    // 300 wpm -> 200ms/word; 1 word, pause 1 -> 200ms
    expect(chunkDelayMs({ text: 'a', orpWord: 'a', pause: 1, wordCount: 1 }, 300)).toBeCloseTo(200);
    // 2 words, pause 2 -> 200 * 2 * 2 = 800
    expect(chunkDelayMs({ text: 'a b', orpWord: 'a', pause: 2, wordCount: 2 }, 300)).toBeCloseTo(800);
  });
});
