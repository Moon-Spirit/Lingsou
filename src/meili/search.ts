import type { MeiliSearch, SearchResponse as MeiliRawResponse } from 'meilisearch';
import type { SearchHit, SearchResponse, SuggestResponse } from '../types/index.js';

export interface SearchOpts {
  limit?: number;
  offset?: number;
  attributesToHighlight?: string[];
  cropLength?: number;
}

const DEFAULT_HIGHLIGHT_PRE = '<mark>';
const DEFAULT_HIGHLIGHT_POST = '</mark>';

interface RawHit {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  content?: unknown;
  domain?: unknown;
  crawledAt?: unknown;
  _formatted?: Record<string, unknown> | undefined;
}

function toSearchHit(h: RawHit): SearchHit {
  const formatted = h._formatted;
  return {
    id: String(h.id ?? ''),
    url: String(h.url ?? ''),
    title: String(h.title ?? ''),
    content: String(h.content ?? ''),
    domain: String(h.domain ?? ''),
    crawledAt: String(h.crawledAt ?? ''),
    _formatted: formatted
      ? {
          title: typeof formatted.title === 'string' ? formatted.title : undefined,
          content: typeof formatted.content === 'string' ? formatted.content : undefined,
        }
      : undefined,
  };
}

export async function search(
  client: MeiliSearch,
  indexName: string,
  query: string,
  opts: SearchOpts = {}
): Promise<SearchResponse> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const attrs = opts.attributesToHighlight ?? ['title', 'content'];

  const raw: MeiliRawResponse<RawHit> = await client
    .index(indexName)
    .search<RawHit>(query, {
      limit,
      offset,
      attributesToHighlight: attrs,
      highlightPreTag: DEFAULT_HIGHLIGHT_PRE,
      highlightPostTag: DEFAULT_HIGHLIGHT_POST,
      cropLength: opts.cropLength ?? 200,
    });

  const hits: SearchHit[] = (raw.hits as RawHit[]).map(toSearchHit);

  return {
    hits,
    total: typeof raw.estimatedTotalHits === 'number' ? raw.estimatedTotalHits : hits.length,
    processingTimeMs: raw.processingTimeMs,
    query,
    offset,
    limit,
  };
}

export async function suggest(
  client: MeiliSearch,
  indexName: string,
  prefix: string,
  limit = 5
): Promise<SuggestResponse> {
  if (!prefix.trim()) return { suggestions: [], query: prefix };
  const result = await search(client, indexName, prefix, {
    limit,
    attributesToHighlight: [],
  });
  return {
    query: prefix,
    suggestions: result.hits.map((h) => ({ title: h.title, url: h.url })),
  };
}
