/** Optimal Recognition Point index for a word, by length (Spritz-style). */
export function orpIndex(word: string): number {
  const n = word.length;
  if (n <= 1) return 0;
  if (n <= 5) return 1;
  if (n <= 9) return 2;
  if (n <= 13) return 3;
  return 4;
}
