import { describe, it, expect } from 'vitest';
import { bionicBoldCount, splitBionic } from '../../src/lib/speedreading/bionic';

describe('bionicBoldCount', () => {
  it('bolds a fraction of letters by strength, min 1', () => {
    expect(bionicBoldCount('reading', 'low')).toBe(2);  // round(7*0.3)=2
    expect(bionicBoldCount('reading', 'med')).toBe(3);  // round(7*0.4)=3
    expect(bionicBoldCount('reading', 'high')).toBe(4); // round(7*0.5)=4 (3.5 -> 4)
    expect(bionicBoldCount('a', 'low')).toBe(1);        // min 1
    expect(bionicBoldCount('to', 'med')).toBe(1);       // round(2*0.4)=1
  });

  it('returns 0 for empty string', () => {
    expect(bionicBoldCount('', 'med')).toBe(0);
  });
});

describe('splitBionic', () => {
  it('splits a word into a bold lead and a normal remainder', () => {
    expect(splitBionic('reading', 'med')).toEqual({ bold: 'rea', rest: 'ding' });
    expect(splitBionic('a', 'high')).toEqual({ bold: 'a', rest: '' });
  });

  it('never bolds more than the whole word', () => {
    const { bold, rest } = splitBionic('to', 'high'); // round(2*0.5)=1
    expect(bold + rest).toBe('to');
    expect(bold.length).toBeLessThanOrEqual(2);
  });
});
