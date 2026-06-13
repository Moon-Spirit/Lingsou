/**
 * Search router with optional SERP fallback / aggregation.
 *
 * Two modes (selected by `opts.serpMode`):
 *   - 'fallback'  (default, legacy): query local Meilisearch first; if it
 *     returns 0 hits AND `opts.serpEngine !== 'none'` → fetch from the
 *     configured SERP engine.
 *   - 'aggregate': always run local + SERP in parallel via the aggregator,
 *     merge via URL+title fingerprint, re-rank by cross-engine consensus,
 *     and return the combined result set.
 *
 * Re-indexing behaviour is controlled by `serpIndexOnFetch`: when true, SERP
 * hits are pushed back into Meilisearch so the next identical query can
 * resolve locally.
 *
 * NOTE: SERP scraping may violate the target engine's Terms of Service. This
 * layer is OFF by default and only activates when `SERP_BACKEND` is set or
 * `SERP_ENGINES` is non-empty.
 */
import type { SearchResponse, SearchHit, IndexedDocument } from '../types/index.js';
import { createClient, search as meiliSearch, ensureIndex, pushDocuments } from '../meili/index.js';
import { config } from '../config.js';
import { tokenizeForIndex } from '../tokenizer/jieba.js';
import { logger } from '../logger.js';
import { searchSERP, type SerpEngine, type SerpHit } from './client.js';
import { aggregateSearch } from './aggregator.js';
import type { MergedHit } from './fusion.js';

export type SerpSource = 'meili' | SerpEngine | 'aggregate';

export interface FallbackOpts {
  /** Legacy single-engine field. Used in 'fallback' mode. */
  serpEngine: SerpEngine | 'none';
  /** Engines to query in 'aggregate' mode. Empty array disables SERP. */
  serpEngines: SerpEngine[];
  /** 'fallback' = current single-engine behavior. 'aggregate' = always merge local + SERP. */
  serpMode: 'fallback' | 'aggregate';
  /** When true, SERP hits are pushed into the local index for future queries. */
  serpIndexOnFetch: boolean;
  /** Optional max results. Defaults to 10. */
  limit?: number;
  /** Optional pagination offset. Defaults to 0. */
  offset?: number;
}

export interface FallbackSearchResponse extends SearchResponse {
  /** Identifies where the bulk of hits came from. */
  serpSource: SerpSource;
  /**
   * Per-engine hit counts in the final merged response. `local` is the number
   * of Meilisearch hits, each engine key is the number of *unique* merged
   * hits (after dedup) that included that engine in their `engines` list.
   * Only populated when SERP contributed to the response.
   */
  serpSources?: Record<string, number>;
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

function mergedHitToMeiliDoc(hit: MergedHit): IndexedDocument {
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

function mergedHitToSearchHit(hit: MergedHit): SearchHit {
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
 * Run a search with optional SERP fallback / aggregation.
 *
 * Behavior depends on `opts.serpMode`:
 *   - 'fallback'  : local first; SERP only when local returns 0.
 *   - 'aggregate' : local + SERP always run in parallel; merged by consensus.
 */
export async function searchWithFallback(
  query: string,
  opts: FallbackOpts
): Promise<FallbackSearchResponse> {
  const limit = opts.limit ?? 10;
  const offset = opts.offset ?? 0;

  // Aggregate mode: run local + SERP in parallel, merge, return combined.
  if (opts.serpMode === 'aggregate' && opts.serpEngines.length > 0) {
    const [localRes, serpMerged] = await Promise.all([
      meiliSearch(createClient(), config.meiliIndex, query, { limit, offset }),
      aggregateSearch(query, { engines: opts.serpEngines, limit }),
    ]);

    if (opts.serpIndexOnFetch && serpMerged.length > 0) {
      try {
        const client = createClient();
        await ensureIndex(client, config.meiliIndex);
        const docs = serpMerged.map(mergedHitToMeiliDoc);
        await pushDocuments(client, config.meiliIndex, docs);
        logger.info({ indexed: docs.length }, 'aggregate SERP results indexed');
      } catch (e) {
        logger.warn({ error: (e as Error).message }, 'SERP indexing failed (non-fatal)');
      }
    }

    const localUrls = new Set(localRes.hits.map((h) => h.url));
    const serpOnly = serpMerged.filter((h) => !localUrls.has(h.url));
    const serpHits: SearchHit[] = serpOnly.map(mergedHitToSearchHit);
    const combined = [...localRes.hits, ...serpHits].slice(0, limit);

    const serpSources: Record<string, number> = {
      local: localRes.total,
      ...Object.fromEntries(
        opts.serpEngines.map((e) => [
          e,
          serpMerged.filter((h) => h.engines.includes(e)).length,
        ])
      ),
    };

    return {
      hits: combined,
      total: localRes.total + serpHits.length,
      processingTimeMs: localRes.processingTimeMs,
      query,
      offset: 0,
      limit,
      serpSource: 'aggregate',
      serpSources,
    };
  }

  // Fallback mode (legacy / default): local first, SERP only on miss.
  const local = await meiliSearch(createClient(), config.meiliIndex, query, { limit, offset });
  if (local.hits.length > 0) {
    return { ...local, serpSource: 'meili' };
  }

  if (opts.serpEngine === 'none') {
    return { ...local, serpSource: 'meili' };
  }

  logger.info({ query, engine: opts.serpEngine }, 'SERP fallback triggered');
  const serpHits = await searchSERP(query, { engine: opts.serpEngine, limit });

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

  const adaptedHits = serpHits.map(serpHitToSearchHit);
  return {
    hits: adaptedHits,
    total: adaptedHits.length,
    processingTimeMs: 0,
    query,
    offset: 0,
    limit,
    serpSource: opts.serpEngine,
    serpSources: { local: 0, [opts.serpEngine]: adaptedHits.length },
  };
}
