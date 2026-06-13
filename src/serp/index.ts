export { searchSERP } from './client.js';
export { searchWithFallback } from './router.js';
export { aggregateSearch } from './aggregator.js';
export { mergeResults, reRankByConsensus } from './fusion.js';
export type { AggregatorOpts } from './aggregator.js';
export type { MergedHit } from './fusion.js';
export type { SerpEngine, SerpHit } from './client.js';
export type { FallbackOpts, FallbackSearchResponse, SerpSource } from './router.js';
