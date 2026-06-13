/**
 * Unit tests for the result fusion layer (merge + consensus re-rank).
 *
 * Pure functions — no HTTP, no Meilisearch. Runs in milliseconds.
 */
import { describe, it, expect } from 'vitest';
import {
  mergeResults,
  reRankByConsensus,
  normalizeUrlForDedup,
  normalizeTitle,
  fingerprint
} from './fusion.js';

const ddg = 'duckduckgo' as const;
const bing = 'bing' as const;

describe('normalizeUrlForDedup', () => {
  it('strips fragments', () => {
    expect(normalizeUrlForDedup('https://x.com/p#section')).toBe('https://x.com/p');
  });
  it('strips utm_* params', () => {
    expect(normalizeUrlForDedup('https://x.com/p?utm_source=a&utm_medium=b&q=keep'))
      .toBe('https://x.com/p?q=keep');
  });
  it('strips gclid / fbclid', () => {
    expect(normalizeUrlForDedup('https://x.com/p?gclid=abc&fbclid=def&keep=1'))
      .toBe('https://x.com/p?keep=1');
  });
  it('strips trailing slash on root paths only', () => {
    expect(normalizeUrlForDedup('https://x.com/')).toBe('https://x.com');
    expect(normalizeUrlForDedup('https://x.com/path/')).toBe('https://x.com/path/');
  });
  it('returns input on parse failure', () => {
    expect(normalizeUrlForDedup('not a url')).toBe('not a url');
  });
});

describe('normalizeTitle', () => {
  it('lowercases and strips whitespace', () => {
    expect(normalizeTitle('  Hello World  ')).toBe('helloworld');
  });
  it('strips CJK full-width space and unicode punctuation', () => {
    expect(normalizeTitle('Hello — World!')).toBe('helloworld');
    expect(normalizeTitle('A\u3000B')).toBe('ab');
  });
  it('caps at 80 chars', () => {
    expect(normalizeTitle('a'.repeat(200)).length).toBe(80);
  });
});

describe('fingerprint', () => {
  it('treats utm-tracked and clean URL as same fingerprint', () => {
    const a = fingerprint({ title: 'Same', url: 'https://x.com/p?utm_source=a' });
    const b = fingerprint({ title: 'Same', url: 'https://x.com/p' });
    expect(a).toBe(b);
  });
});

describe('mergeResults', () => {
  it('dedupes by URL+title fingerprint', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [{ title: 'A', url: 'https://x.com/p', snippet: 's1', source: ddg }] },
      { engine: bing, hits: [{ title: 'A 2', url: 'https://x.com/p', snippet: 's1 longer', source: bing }] }
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0]!.consensus).toBe(2);
    expect(merged[0]!.engines.sort()).toEqual(['bing', 'duckduckgo']);
    expect(merged[0]!.positions).toEqual({ duckduckgo: 0, bing: 0 });
    expect(merged[0]!.snippet).toBe('s1 longer');
  });

  it('keeps hits with different URLs separate', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [{ title: 'A', url: 'https://x.com/a', snippet: '', source: ddg }] },
      { engine: bing, hits: [{ title: 'B', url: 'https://x.com/b', snippet: '', source: bing }] }
    ]);
    expect(merged.length).toBe(2);
    expect(merged.every((m) => m.consensus === 1)).toBe(true);
  });

  it('strips utm params for dedup', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [{ title: 'A', url: 'https://x.com/p?utm_source=t', snippet: '', source: ddg }] },
      { engine: bing, hits: [{ title: 'A', url: 'https://x.com/p', snippet: '', source: bing }] }
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0]!.consensus).toBe(2);
  });

  it('does not duplicate engines on re-encounter of the same fingerprint', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [
        { title: 'A', url: 'https://x.com/p', snippet: '', source: ddg },
        { title: 'A dup', url: 'https://x.com/p', snippet: 's2', source: ddg },
      ]}
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0]!.engines).toEqual(['duckduckgo']);
    expect(merged[0]!.consensus).toBe(1);
    expect(merged[0]!.positions).toEqual({ duckduckgo: 0 });
  });

  it('returns empty array for empty input', () => {
    expect(mergeResults([])).toEqual([]);
    expect(mergeResults([{ engine: ddg, hits: [] }, { engine: bing, hits: [] }])).toEqual([]);
  });

  it('single-engine input still works', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [
        { title: 'A', url: 'https://x.com/a', snippet: 'sa', source: ddg },
        { title: 'B', url: 'https://x.com/b', snippet: 'sb', source: ddg },
      ]}
    ]);
    expect(merged.length).toBe(2);
    expect(merged.every((m) => m.engines.length === 1 && m.consensus === 1)).toBe(true);
  });

  it('keeps higher-similarity title entries (longer title wins)', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [{ title: 'Short', url: 'https://x.com/p', snippet: 'short', source: ddg }] },
      { engine: bing, hits: [{ title: 'A Much Longer Title', url: 'https://x.com/p', snippet: 'a much longer snippet', source: bing }] }
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0]!.title).toBe('A Much Longer Title');
    expect(merged[0]!.snippet).toBe('a much longer snippet');
  });
});

describe('reRankByConsensus', () => {
  it('puts multi-engine hits first', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [{ title: 'A', url: 'https://x.com/a', snippet: '', source: ddg }] },
      { engine: bing, hits: [{ title: 'A', url: 'https://x.com/a', snippet: '', source: bing }] },
      { engine: ddg, hits: [{ title: 'B', url: 'https://x.com/b', snippet: '', source: ddg }] }
    ]);
    const ranked = reRankByConsensus(merged);
    expect(ranked[0]!.url).toBe('https://x.com/a');
    expect(ranked[0]!.consensus).toBe(2);
    expect(ranked[1]!.url).toBe('https://x.com/b');
  });

  it('uses best (lowest) position as tiebreaker for equal consensus', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [
        { title: 'A', url: 'https://x.com/a', snippet: '', source: ddg },
        { title: 'B', url: 'https://x.com/b', snippet: '', source: ddg },
      ]},
      { engine: bing, hits: [
        { title: 'B', url: 'https://x.com/b', snippet: '', source: bing },
        { title: 'A', url: 'https://x.com/a', snippet: '', source: bing },
      ]}
    ]);
    // Both A and B have consensus=2. A's positions: {ddg:0, bing:1} best=0.
    // B's positions: {ddg:1, bing:0} best=0. Tie on best position → preserves
    // original input order (which is A first).
    const ranked = reRankByConsensus(merged);
    expect(ranked[0]!.url).toBe('https://x.com/a');
  });

  it('returns empty array for empty input', () => {
    expect(reRankByConsensus([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const merged = mergeResults([
      { engine: ddg, hits: [{ title: 'A', url: 'https://x.com/a', snippet: '', source: ddg }] },
      { engine: bing, hits: [{ title: 'A', url: 'https://x.com/a', snippet: '', source: bing }] }
    ]);
    const before = [...merged];
    reRankByConsensus(merged);
    expect(merged).toEqual(before);
  });
});
