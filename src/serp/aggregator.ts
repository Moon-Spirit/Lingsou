/**
 * Multi-engine SERP aggregator.
 *
 * Queries N engines in parallel via Promise.allSettled so that a single
 * engine failure never blocks the others. The merged, consensus-ranked
 * hits are returned via the fusion layer.
 *
 * NOTE: Scraping search engines may violate their Terms of Service. This
 * module is OPT-IN: callers must explicitly configure SERP_ENGINES to use
 * it.
 */
import { searchSERP, type SerpEngine, type SerpHit } from './client.js';
import { mergeResults, reRankByConsensus, type MergedHit } from './fusion.js';
import { logger } from '../logger.js';

export interface AggregatorOpts {
  engines: SerpEngine[];
  limit?: number;
}

/**
 * Query all configured engines in parallel, merge via URL+title fingerprint,
 * and re-rank by cross-engine consensus. Returns up to `limit` merged hits.
 *
 * Per-engine failures are logged at warn level and skipped — the surviving
 * engines' hits still come through (Promise.allSettled semantics).
 */
export async function aggregateSearch(
  query: string,
  opts: AggregatorOpts
): Promise<MergedHit[]> {
  const limit = opts.limit ?? 20;
  if (opts.engines.length === 0) return [];

  const settled = await Promise.allSettled(
    opts.engines.map(async (engine): Promise<{ engine: SerpEngine; hits: SerpHit[] }> => {
      const hits = await searchSERP(query, { engine, limit });
      return { engine, hits };
    })
  );

  const perEngine: Array<{ engine: SerpEngine; hits: SerpHit[] }> = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      perEngine.push(r.value);
    } else {
      logger.warn(
        { engine: opts.engines[i], error: (r.reason as Error)?.message },
        'aggregator engine failed'
      );
    }
  }

  const merged = mergeResults(perEngine);
  return reRankByConsensus(merged).slice(0, limit);
}
