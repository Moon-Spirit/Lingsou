/**
 * Search router with optional SERP fallback.
 *
 * Strategy:
 *   1. Query the local Meilisearch index.
 *   2. If local results are non-empty → return them with `serpSource: 'meili'`.
 *   3. If local results are empty AND `serpEngine !== 'none'` → fetch from the
 *      configured SERP engine (DuckDuckGo HTML or Bing).
 *   4. If SERP returns hits AND `serpIndexOnFetch` is true → push them back into
 *      the local Meilisearch index so the next identical query hits local.
 *
 * NOTE: SERP scraping may violate the target engine's Terms of Service. This
 * layer is OFF by default and only activates when `SERP_BACKEND` is set.
 */
import type { SearchResponse, SearchHit, IndexedDocument } from '../types/index.js';
import { createClient, search as meiliSearch, ensureIndex, pushDocuments } from '../meili/index.js';
import { config } from '../config.js';
import { tokenizeForIndex } from '../tokenizer/jieba.js';
import { logger } from '../logger.js';
import { searchSERP, type SerpEngine, type SerpHit } from './client.js';

export type SerpSource = 'meili' | SerpEngine;

export interface FallbackOpts {
  serpEngine: SerpEngine | 'none';
  serpIndexOnFetch: boolean;
}

export interface FallbackSearchResponse extends SearchResponse {
  /** Identifies where the hits came from. */
  serpSource: SerpSource;
}

/** FNV-1a 32-bit hash. Used to derive a stable id from a URL. */
function hashId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function serpHitToMeiliDoc(hit: SerpHit): IndexedDocument {
  const text = `${hit.title}\n${hit.snippet}`;
  return {
    id: hashId(hit.url),
    url: hit.url,
    title: hit.title,
    content: text,
    tokens: tokenizeForIndex(text),
    crawledAt: new Date().toISOString(),
    domain: safeHostname(hit.url),
  };
}

function serpHitToSearchHit(hit: SerpHit): SearchHit {
  // SERP snippets are pre-extracted — no Meilisearch highlight is applied.
  return {
    id: hashId(hit.url),
    url: hit.url,
    title: hit.title,
    content: hit.snippet,
    domain: safeHostname(hit.url),
    crawledAt: new Date().toISOString(),
    _formatted: { title: hit.title, content: hit.snippet },
  };
}

/**
 * Run a search with optional SERP fallback.
 *
 * Always tries the local Meilisearch index first. Falls back to SERP only
 * when the local index returns zero hits AND `opts.serpEngine !== 'none'`.
 */
export async function searchWithFallback(
  query: string,
  opts: { limit?: number; offset?: number; serpEngine: SerpEngine | 'none'; serpIndexOnFetch: boolean }
): Promise<FallbackSearchResponse> {
  const limit = opts.limit ?? 10;
  const offset = opts.offset ?? 0;

  // 1) Local Meilisearch.
  const local = await meiliSearch(createClient(), config.meiliIndex, query, { limit, offset });
  if (local.hits.length > 0) {
    return { ...local, serpSource: 'meili' };
  }

  // 2) SERP fallback (opt-in).
  if (opts.serpEngine === 'none') {
    return { ...local, serpSource: 'meili' };
  }

  logger.info({ query, engine: opts.serpEngine }, 'SERP fallback triggered');
  const serpHits = await searchSERP(query, { engine: opts.serpEngine, limit });

  // 3) Optionally re-index for next time.
  if (opts.serpIndexOnFetch && serpHits.length > 0) {
    try {
      const client = createClient();
      await ensureIndex(client, config.meiliIndex);
      const docs = serpHits.map(serpHitToMeiliDoc);
      await pushDocuments(client, config.meiliIndex, docs);
      logger.info({ indexed: docs.length }, 'SERP results indexed for future queries');
    } catch (e) {
      logger.warn({ error: (e as Error).message }, 'SERP indexing failed (non-fatal)');
    }
  }

  // 4) Adapt SERP hits to SearchHit shape.
  const adaptedHits = serpHits.map(serpHitToSearchHit);
  return {
    hits: adaptedHits,
    total: adaptedHits.length,
    processingTimeMs: 0,
    query,
    offset: 0,
    limit,
    serpSource: opts.serpEngine,
  };
}