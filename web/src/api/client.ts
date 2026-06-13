// Browser-side API client for the Lingsou backend.
// All requests go through Vite's dev-server proxy (/api -> http://localhost:3001).

export interface SearchHit {
  id: string;
  url: string;
  title: string;
  content: string;
  domain: string;
  crawledAt: string;
  _formatted?: { title?: string; content?: string };
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  processingTimeMs: number;
  query: string;
  offset: number;
  limit: number;
}

export interface SuggestResponse {
  suggestions: Array<{ title: string; url: string }>;
  query: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function searchApi(
  q: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q,
    limit: String(opts.limit ?? 10),
    offset: String(opts.offset ?? 0),
  });
  return jsonOrThrow<SearchResponse>(await fetch(`/api/search?${params.toString()}`));
}

export async function suggestApi(q: string, limit = 5): Promise<SuggestResponse> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return jsonOrThrow<SuggestResponse>(await fetch(`/api/suggest?${params.toString()}`));
}
