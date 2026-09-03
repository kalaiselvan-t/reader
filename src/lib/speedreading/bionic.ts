export type Fixation = 'low' | 'med' | 'high';

const RATIO: Record<Fixation, number> = { low: 0.3, med: 0.4, high: 0.5 };

/** Number of leading letters to bold for a word at the given fixation strength. */
export function bionicBoldCount(word: string, strength: Fixation): number {
  const n = word.length;
  if (n === 0) return 0;
  return Math.max(1, Math.round(n * RATIO[strength]));
}

/** Split a word into its bold lead and normal remainder. */
export function splitBionic(
  word: string,
  strength: Fixation
): { bold: string; rest: string } {
  const k = Math.min(bionicBoldCount(word, strength), word.length);
  return { bold: word.slice(0, k), rest: word.slice(k) };
}
