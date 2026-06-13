/**
 * Result fusion: merges SERP hits from multiple engines, dedupes them by
 * normalized URL + title fingerprint, and re-ranks by cross-engine consensus.
 *
 * Design rationale (see plan in /root/.omo/plans/lingsou.md):
 *   - URL-only dedup is too strict (DDG and Bing often return the same page
 *     with slightly different titles); URL + title-prefix is forgiving but
 *     still catches obvious duplicates.
 *   - Cross-engine consensus is a strong relevance signal: a page that 2/2
 *     engines return is far more likely to be the canonical answer than one
 *     that only one engine surfaces.
 */
import type { SerpEngine, SerpHit } from './client.js';

export interface MergedHit {
  title: string;
  url: string;
  snippet: string;
  engines: SerpEngine[];
  /** How many engines returned this hit (1..N). */
  consensus: number;
  /** 0-based position in each engine's result list. Missing engines are absent. */
  positions: Record<SerpEngine, number>;
}

/**
 * Normalize a URL for dedup purposes:
 *   - strip the fragment
 *   - drop common tracking params (utm_*, gclid, fbclid)
 *   - drop trailing slash on root paths
 *   - leave anything else intact (we don't force lowercase host — that can
 *     mask legitimate duplicate detection across CDN variants)
 */
export function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      const lk = k.toLowerCase();
      if (lk.startsWith('utm_') || k === 'gclid' || k === 'fbclid') {
        u.searchParams.delete(k);
      }
    }
    let s = u.toString();
    if (s.endsWith('/') && u.pathname === '/') s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

/**
 * Normalize a title for dedup: lowercase, collapse all whitespace + CJK
 * full-width space + Unicode punctuation into nothing, cap at 80 chars so
 * that "A — A!" and "A - A" hash to the same fingerprint.
 */
export function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\s\u3000\p{P}]+/gu, '')
    .slice(0, 80);
}

/** Compose the dedup fingerprint. URL-only after normalization — two
 *  engines returning the same page (with slightly different titles) must
 *  collapse into one entry. Exported for testing. */
export function fingerprint(h: { title: string; url: string }): string {
  return normalizeUrlForDedup(h.url);
}

/**
 * Merge hits from N engines. Hits with the same URL+title fingerprint become
 * a single MergedHit; consensus and positions are accumulated.
 *
 * For a merged entry we keep the longest snippet and title across contributors
 * (Bing's snippets are often longer than DDG's).
 */
export function mergeResults(
  perEngine: ReadonlyArray<{ engine: SerpEngine; hits: ReadonlyArray<SerpHit> }>
): MergedHit[] {
  const seen = new Map<string, MergedHit>();
  for (const { engine, hits } of perEngine) {
    hits.forEach((h, idx) => {
      const key = fingerprint(h);
      const existing = seen.get(key);
      if (existing) {
        if (!existing.engines.includes(engine)) {
          existing.engines.push(engine);
          existing.positions[engine] = idx;
        }
        existing.consensus = existing.engines.length;
        if (h.snippet.length > existing.snippet.length) existing.snippet = h.snippet;
        if (h.title.length > existing.title.length) existing.title = h.title;
      } else {
        seen.set(key, {
          title: h.title,
          url: normalizeUrlForDedup(h.url),
          snippet: h.snippet,
          engines: [engine],
          consensus: 1,
          positions: { [engine]: idx } as Record<SerpEngine, number>,
        });
      }
    });
  }
  return Array.from(seen.values());
}

/**
 * Sort merged hits so multi-engine consensus wins, then by best position.
 * Stable on equal consensus + equal best position (preserves input order).
 */
export function reRankByConsensus(hits: ReadonlyArray<MergedHit>): MergedHit[] {
  return [...hits].sort((a, b) => {
    if (b.consensus !== a.consensus) return b.consensus - a.consensus;
    const aBest = Math.min(...Object.values(a.positions));
    const bBest = Math.min(...Object.values(b.positions));
    return aBest - bBest;
  });
}
