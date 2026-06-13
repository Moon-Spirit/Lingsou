import { tokenizeForIndex } from '../tokenizer/jieba.js';
import { crawl } from './bfs.js';
import { createClient, ensureIndex, pushDocuments } from '../meili/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { IndexedDocument, CrawlSummary } from '../types/index.js';

export interface PipelineOpts {
  seeds: string[];
  maxPages?: number;
  maxDepth?: number;
}

export async function runCrawlPipeline(opts: PipelineOpts): Promise<CrawlSummary> {
  const start = Date.now();
  const client = createClient();
  await ensureIndex(client, config.meiliIndex);

  logger.info(
    { seeds: opts.seeds.length, maxPages: opts.maxPages, maxDepth: opts.maxDepth },
    'crawl start'
  );
  const crawled = await crawl(opts.seeds, {
    maxPages: opts.maxPages ?? config.crawlMaxPages,
    maxDepth: opts.maxDepth ?? config.crawlMaxDepth,
    delayMs: config.crawlDelayMs,
    userAgent: config.crawlUserAgent,
    concurrency: config.crawlConcurrency,
  });

  let failed = 0;
  const docs: IndexedDocument[] = [];
  for (const c of crawled) {
    if (!c.title || !c.content) {
      failed++;
      continue;
    }
    const tokens = tokenizeForIndex(`${c.title} ${c.content}`);
    if (tokens.length === 0) {
      failed++;
      continue;
    }
    docs.push({
      id: hashId(c.url),
      url: c.url,
      title: c.title,
      content: c.content,
      tokens,
      crawledAt: c.crawledAt,
      domain: c.domain,
    });
  }

  if (docs.length > 0) {
    await pushDocuments(client, config.meiliIndex, docs);
  }

  const summary: CrawlSummary = {
    total: crawled.length,
    indexed: docs.length,
    failed,
    durationMs: Date.now() - start,
  };
  logger.info(summary, 'crawl done');
  return summary;
}

function hashId(s: string): string {
  // Simple stable hash (32-bit unsigned hex)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}