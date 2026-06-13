/**
 * SERP (Search Engine Results Page) client.
 *
 * Scrapes public HTML search endpoints — DuckDuckGo HTML and Bing — using
 * pure HTTP via undici + cheerio for parsing. No headless browser required.
 *
 * Adapted from https://github.com/Moon-Spirit/search-engine-tool (which uses
 * axios + cheerio). We swap axios for undici (already a project dependency).
 *
 * NOTE: Scraping search engines may violate their Terms of Service. This
 * module is OPT-IN: callers must explicitly configure `SERP_BACKEND` to use
 * it. Use sparingly and respect rate limits.
 */
import { request } from 'undici';
import * as cheerio from 'cheerio';
import { logger } from '../logger.js';

export type SerpEngine = 'duckduckgo' | 'bing';

export interface SerpHit {
  title: string;
  url: string;
  snippet: string;
  source: SerpEngine;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HTTP_OPTS = {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  },
  headersTimeout: 10_000,
  bodyTimeout: 10_000,
} as const;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await request(url, { ...HTTP_OPTS, method: 'GET' });
    if (res.statusCode >= 400) {
      logger.debug({ url, status: res.statusCode }, 'SERP fetch non-2xx');
      return null;
    }
    return await res.body.text();
  } catch (e) {
    logger.debug({ url, error: (e as Error).message }, 'SERP fetch failed');
    return null;
  }
}

/**
 * Unwrap a DuckDuckGo redirect URL to its underlying target URL.
 *
 * DDG HTML links look like:
 *   //duckduckgo.com/l/?uddg=<encoded>&rut=<hash>
 *   https://duckduckgo.com/l/?uddg=<encoded>&rut=<hash>
 *
 * The `uddg` query param is the real destination (percent-encoded). Any
 * other params (`rut`, etc.) are tracking noise we discard.
 */
function unwrapDuckDuckGoHref(href: string): string {
  // Normalize protocol-relative to absolute.
  const normalized = href.startsWith('//') ? 'https:' + href : href;
  if (!normalized.includes('duckduckgo.com/l/?')) return href;
  try {
    const u = new URL(normalized);
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
  } catch {
    /* keep original href on parse failure */
  }
  return href;
}

async function duckduckgoSearch(query: string, limit: number): Promise<SerpHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const results: SerpHit[] = [];
  // DDG HTML uses `a.result__a` inside `h2.result__title` for the result link.
  // `.result__title a` is more forgiving across markup variants.
  $('.result').each((_, el) => {
    if (results.length >= limit) return false;
    const $el = $(el);
    const $link = $el.find('a.result__a').first();
    const title = $link.text().trim() || $el.find('.result__title').text().trim();
    const rawHref = $link.attr('href') || $el.find('.result__title a').first().attr('href') || '';
    const href = unwrapDuckDuckGoHref(rawHref);
    const snippet = $el.find('.result__snippet').text().trim();
    if (title && href) {
      results.push({ title, url: href, snippet, source: 'duckduckgo' });
    }
  });
  return results;
}

async function bingSearch(query: string, limit: number): Promise<SerpHit[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const results: SerpHit[] = [];
  $('#b_results .b_algo').each((_, el) => {
    if (results.length >= limit) return false;
    const $el = $(el);
    const title = $el.find('h2').text().trim();
    const href = $el.find('h2 a').attr('href') || '';
    const snippet = $el.find('.b_caption p').text().trim();
    if (title && href) {
      results.push({ title, url: href, snippet, source: 'bing' });
    }
  });
  return results;
}

/**
 * Query a SERP engine for the given search query and return up to `limit`
 * normalized hits. Returns an empty array on network/parse failure.
 *
 * Throws if `opts.engine` is not a recognized engine.
 */
export async function searchSERP(
  query: string,
  opts: { engine: SerpEngine; limit?: number }
): Promise<SerpHit[]> {
  const limit = opts.limit ?? 10;
  switch (opts.engine) {
    case 'duckduckgo':
      return duckduckgoSearch(query, limit);
    case 'bing':
      return bingSearch(query, limit);
    default: {
      // Exhaustiveness check — narrows string to never.
      const exhaustive: never = opts.engine;
      throw new Error(`Unknown SERP engine: ${String(exhaustive)}`);
    }
  }
}