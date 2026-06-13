import { describe, it, expect } from 'vitest';
import { tokenize, tokenizeForIndex } from './jieba.js';

describe('tokenize', () => {
  it('splits Chinese into words and drops stop words', () => {
    const r = tokenize('搜索引擎的原理');
    // jieba treats the high-frequency bigram "搜索引擎" as a single token.
    expect(r).toContain('搜索引擎');
    expect(r).toContain('原理');
    expect(r).not.toContain('的');
  });

  it('keeps english tokens (case preserved) and CJK tokens', () => {
    const r = tokenize('Hello World 中文');
    expect(r.some((t) => t === 'Hello')).toBe(true);
    expect(r.some((t) => t === 'World')).toBe(true);
    expect(r).toContain('中文');
  });

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('filters pure punctuation', () => {
    const r = tokenize('你好，世界！');
    expect(r).toContain('你好');
    expect(r.every((t) => /^[\p{L}\p{N}]+$/u.test(t))).toBe(true);
  });

  it('filters stop words and single characters', () => {
    const r = tokenize('的 了 和');
    expect(r).toEqual([]);
  });

  it('keeps multi-char alphanumeric tokens and drops single chars', () => {
    const r = tokenize('JS nodeJS A B 测试 测试用例');
    // tokenize() preserves case; lowercasing happens in tokenizeForIndex()
    expect(r).toContain('nodeJS');
    expect(r).toContain('测试');
    expect(r).toContain('测试用例');
    // single characters dropped (A, B)
    expect(r.some((t) => t === 'A')).toBe(false);
    expect(r.some((t) => t === 'B')).toBe(false);
    // "JS" is 2 chars and matches alnum, so it's kept
    expect(r.some((t) => t === 'JS')).toBe(true);
  });
});

describe('tokenizeForIndex', () => {
  it('lowercases English tokens', () => {
    const r = tokenizeForIndex('Hello HELLO world');
    const english = r.filter((t) => /[a-z]/.test(t));
    expect(english).toEqual(['hello', 'world']);
  });

  it('deduplicates case-insensitively for English and CJK', () => {
    const r = tokenizeForIndex('搜索 搜索 引擎 引擎 Hello hello');
    const cjk = r.filter((t) => /^[\p{Script=Han}]+$/u.test(t));
    expect(new Set(cjk).size).toBe(cjk.length);
    // English dedup should collapse to one "hello"
    expect(r.filter((t) => /[a-z]/.test(t))).toEqual(['hello']);
  });

  it('returns empty for empty input', () => {
    expect(tokenizeForIndex('')).toEqual([]);
  });
});