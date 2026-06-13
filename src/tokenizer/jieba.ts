/**
 * Chinese word segmentation wrapper around nodejieba.
 *
 * Provides two functions:
 * - `tokenize(text)`        : split text into meaningful tokens (filter stop words, whitespace, single chars, pure punctuation)
 * - `tokenizeForIndex(text)`: `tokenize` result, lowercased and deduplicated — suitable for indexing
 */

import jiebaDefault from 'nodejieba';

// nodejieba is a CJS module. Under ESM `import jieba from 'nodejieba'` returns the whole
// `module.exports` object as the default export (the .d.ts file mis-types it as named exports).
// Cast it to a typed shape matching the runtime API we use.
interface NodeJieba {
  cut: (text: string, hmm?: boolean) => string[];
}

const jieba = jiebaDefault as unknown as NodeJieba;

/**
 * Common Chinese stop words. Kept compact (≥40) — used to drop high-frequency, low-value
 * tokens from indexing and search.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  '的', '了', '和', '是', '在', '我', '有', '与', '及', '或', '为', '也', '就', '都',
  '而', '但', '若', '以', '于', '上', '下', '中', '个', '些', '这', '那', '你', '他', '她',
  '它', '们', '之', '呢', '吗', '啊', '哦', '吧', '啦', '呀', '嗯', '从', '到', '向', '把',
  '被', '让', '使', '等', '其', '此', '所',
]);

// Must contain at least one letter or digit (Unicode-aware). Rejects pure punctuation/whitespace.
const TOKEN_REGEX = /^[\p{L}\p{N}]+$/u;

/**
 * Split `text` into meaningful tokens using nodejieba in HMM-aware strict mode.
 * Filters out:
 *  - empty / whitespace-only tokens
 *  - single-character tokens (single CJK chars are usually noise for indexing)
 *  - pure-punctuation tokens
 *  - common Chinese stop words
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const raw = jieba.cut(text, true);
  const out: string[] = [];
  for (const t of raw) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (trimmed.length < 2) continue;
    if (!TOKEN_REGEX.test(trimmed)) continue;
    if (STOP_WORDS.has(trimmed)) continue;
    out.push(trimmed);
  }
  return out;
}

/**
 * Like `tokenize` but lowercases English tokens and deduplicates (case-insensitive).
 * Designed for downstream inverted-index builders.
 */
export function tokenizeForIndex(text: string): string[] {
  const tokens = tokenize(text);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(lower);
  }
  return result;
}