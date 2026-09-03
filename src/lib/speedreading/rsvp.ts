import { SENTENCE_PAUSE, type Token } from './tokenize';

export interface Chunk {
  text: string;
  orpWord: string;
  pause: number;
  wordCount: number;
}

function makeChunk(group: Token[]): Chunk {
  return {
    text: group.map((t) => t.text).join(' '),
    orpWord: group[0].text,
    pause: group[group.length - 1].pause,
    wordCount: group.length,
  };
}

/**
 * Group tokens into chunks of at most `size` words, breaking early at a
 * sentence/paragraph boundary (pause >= SENTENCE_PAUSE) so a chunk never spans
 * a sentence break.
 */
export function chunk(tokens: Token[], size: number): Chunk[] {
  const cap = Math.max(1, Math.floor(size) || 1);
  const chunks: Chunk[] = [];
  let group: Token[] = [];
  for (const t of tokens) {
    group.push(t);
    if (group.length >= cap || t.pause >= SENTENCE_PAUSE) {
      chunks.push(makeChunk(group));
      group = [];
    }
  }
  if (group.length) chunks.push(makeChunk(group));
  return chunks;
}

/** Milliseconds to display one chunk: base word time * word count * pause. */
export function chunkDelayMs(chunk: Chunk, wpm: number): number {
  const perWord = 60000 / wpm;
  return perWord * chunk.wordCount * chunk.pause;
}
