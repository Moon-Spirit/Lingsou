import pLimit from 'p-limit';
import { fetchPage } from './fetcher.js';
import { isAllowed } from './robots.js';
import { logger } from '../logger.js';
import { decodeHtml } from '../utils/encoding.js';
import { extractTextAndLinks } from '../utils/html.js';
import { normalizeUrl, isSameDomain } from '../utils/url.js';
import type { CrawlOptions, CrawlResult } from '../types/index.js';

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_USER_AGENT = 'LingsouBot/0.1';

export async function crawl(seeds: string[], opts: CrawlOptions = {}): Promise<CrawlResult[]> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const allowDomains = opts.allowDomains;

  const limit = pLimit(concurrency);
  const visited = new Set<string>();
  const results: CrawlResult[] = [];
  const queue: Array<{ url: string; depth: number }> = [];

  for (const s of seeds) {
    const n = normalizeUrl(s);
    if (n) queue.push({ url: n, depth: 0 });
  }

  while (queue.length > 0 && results.length < maxPages) {
    // Drain a batch from the queue (BFS order, respects maxPages/visited).
    const batch = queue.splice(0, concurrency);
    const promises = batch.map((item) =>
      limit(async () => {
        if (visited.has(item.url)) return;
        if (results.length >= maxPages) return;
        if (item.depth > maxDepth) return;

        if (allowDomains && allowDomains.length > 0) {
          let ok = false;
          try {
            const host = new URL(item.url).hostname;
            ok = allowDomains.some((d) => host === d || host.endsWith(`.${d}`));
          } catch {
            ok = false;
          }
          if (!ok) {
            logger.debug({ url: item.url, allowDomains }, 'domain not allowed');
            return;
          }
        }

        visited.add(item.url);

        const allowed = await isAllowed(item.url, userAgent);
        if (!allowed) {
          logger.debug({ url: item.url }, 'disallowed by robots');
          return;
        }

        const fetched = await fetchPage(item.url, { userAgent });
        if (!fetched) return;

        const html = decodeHtml(fetched.body);
        const extracted = extractTextAndLinks(html, fetched.url);
        let domain = '';
        try {
          domain = new URL(fetched.url).hostname;
        } catch {
          domain = '';
        }
        const result: CrawlResult = {
          url: fetched.url,
          title: extracted.title,
          content: extracted.text,
          links: extracted.links,
          tokens: [], // filled by pipeline (T11)
          domain,
          status: fetched.status,
          crawledAt: new Date().toISOString(),
        };
        results.push(result);

        // Enqueue same-domain links for the next BFS level.
        if (item.depth < maxDepth) {
          for (const link of extracted.links) {
            if (visited.has(link)) continue;
            if (!isSameDomain(link, fetched.url)) continue;
            const normalized = normalizeUrl(link);
            if (!normalized) continue;
            if (visited.has(normalized)) continue;
            queue.push({ url: normalized, depth: item.depth + 1 });
          }
        }

        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      })
    );
    await Promise.all(promises);
  }

  return results;
}