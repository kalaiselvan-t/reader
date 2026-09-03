export interface Token {
  text: string;
  pause: number;
}

export const CLAUSE_PAUSE = 1.5;
export const SENTENCE_PAUSE = 2.0;
export const PARAGRAPH_PAUSE = 2.5;

function pauseForWord(word: string, isParagraphEnd: boolean): number {
  // Strip trailing quotes/brackets so `run!"` still reads as sentence-ending.
  const stripped = word.replace(/["')\]”’]+$/u, '');
  const last = stripped.slice(-1);
  let p = 1;
  if (/[,;:—]/.test(last)) p = CLAUSE_PAUSE;
  if (/[.!?…]/.test(last)) p = SENTENCE_PAUSE;
  if (isParagraphEnd) p = Math.max(p, PARAGRAPH_PAUSE);
  return p;
}

/** Split text into word Tokens, tagging each with a pause multiplier. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const paragraphs = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      tokens.push({ text: w, pause: pauseForWord(w, i === words.length - 1) });
    });
  }
  return tokens;
}
