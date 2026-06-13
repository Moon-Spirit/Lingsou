import 'dotenv/config';
import { z } from 'zod';
import type { AppConfig } from './types/index.js';

const ConfigSchema = z.object({
  MEILI_HOST: z.string().url(), // required - no default, throws if missing
  MEILI_KEY: z.string().min(1).default('lingsou-dev-key'),
  MEILI_INDEX: z.string().min(1).default('lingsou_pages'),
  CRAWL_MAX_PAGES: z.coerce.number().int().positive().default(50),
  CRAWL_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
  CRAWL_USER_AGENT: z.string().default('LingsouBot/0.1 (+https://github.com/Moon-Spirit/Lingsou)'),
  CRAWL_MAX_DEPTH: z.coerce.number().int().nonnegative().default(2),
  CRAWL_CONCURRENCY: z.coerce.number().int().positive().default(3),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PORT: z.coerce.number().int().positive().default(3001),
  // SERP fallback layer (opt-in). `'none'` keeps the local-only behavior.
  SERP_BACKEND: z.enum(['none', 'duckduckgo', 'bing']).default('none'),
  // When true, SERP results fetched as fallback are pushed back into Meilisearch
  // so future identical queries resolve locally.
  SERP_INDEX_ON_FETCH: z.coerce.boolean().default(false),
});

export type EnvInput = Record<string, string | undefined>;

export function loadConfig(env: EnvInput = process.env): AppConfig {
  const parsed = ConfigSchema.parse(env);
  return {
    meiliHost: parsed.MEILI_HOST,
    meiliKey: parsed.MEILI_KEY,
    meiliIndex: parsed.MEILI_INDEX,
    crawlMaxPages: parsed.CRAWL_MAX_PAGES,
    crawlDelayMs: parsed.CRAWL_DELAY_MS,
    crawlUserAgent: parsed.CRAWL_USER_AGENT,
    crawlMaxDepth: parsed.CRAWL_MAX_DEPTH,
    crawlConcurrency: parsed.CRAWL_CONCURRENCY,
    logLevel: parsed.LOG_LEVEL,
    port: parsed.PORT,
    serpBackend: parsed.SERP_BACKEND,
    serpIndexOnFetch: parsed.SERP_INDEX_ON_FETCH,
  };
}

export const config: AppConfig = loadConfig();