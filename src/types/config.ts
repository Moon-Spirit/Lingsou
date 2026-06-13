export interface AppConfig {
  meiliHost: string;
  meiliKey: string;
  meiliIndex: string;
  crawlMaxPages: number;
  crawlDelayMs: number;
  crawlUserAgent: string;
  crawlMaxDepth: number;
  crawlConcurrency: number;
  logLevel: string;
  port: number;
  /** Opt-in legacy single-engine SERP backend. `'none'` (default) disables any external fallback. */
  serpBackend: 'none' | 'duckduckgo' | 'bing';
  /**
   * Multi-engine SERP query strategy.
   *   - 'fallback'  (default): only fetch SERP when the local index returns 0 hits.
   *   - 'aggregate': always run local + SERP in parallel, merge via consensus re-rank.
   */
  serpMode: 'fallback' | 'aggregate';
  /** Engines queried when SERP is active. Empty array disables any external query. */
  serpEngines: Array<'duckduckgo' | 'bing'>;
  /** When true, SERP fallback hits are written back into the Meilisearch index. */
  serpIndexOnFetch: boolean;
}
