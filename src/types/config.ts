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
  /** Opt-in SERP engine. `'none'` (default) disables any external fallback. */
  serpBackend: 'none' | 'duckduckgo' | 'bing';
  /** When true, SERP fallback hits are written back into the Meilisearch index. */
  serpIndexOnFetch: boolean;
}