import { request } from 'undici';
import * as robotsParserMod from 'robots-parser';
import { logger } from '../logger.js';

type RobotsParser = {
  isAllowed: (url: string, ua?: string) => boolean | undefined;
  isDisallowed: (url: string, ua?: string) => boolean | undefined;
  getMatchingLineNumber: (url: string, ua?: string) => number;
  getCrawlDelay: (ua?: string) => number | undefined;
  getSitemaps: () => string[];
  getPreferredHost: () => string | null;
};

type RobotsParserFactory = (url: string, contents: string) => RobotsParser;

const robotsParserFactory: RobotsParserFactory =
  (robotsParserMod as unknown as { default?: RobotsParserFactory }).default ??
  (robotsParserMod as unknown as RobotsParserFactory);

interface CacheEntry {
  parser: RobotsParser;
  fetchedAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour
const ROBOTS_TIMEOUT = 10_000;

async function getParser(origin: string, userAgent: string): Promise<RobotsParser | null> {
  const cached = CACHE.get(origin);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.parser;
  }
  try {
    const res = await request(`${origin}/robots.txt`, {
      method: 'GET',
      headers: { 'user-agent': userAgent },
      bodyTimeout: ROBOTS_TIMEOUT,
      headersTimeout: ROBOTS_TIMEOUT,
    });
    if (res.statusCode >= 400) {
      // No robots.txt (or error) — cache an empty parser so we don't refetch.
      const empty = robotsParserFactory(`${origin}/robots.txt`, '');
      CACHE.set(origin, { parser: empty, fetchedAt: Date.now() });
      return CACHE.get(origin)!.parser;
    }
    const body = await res.body.text();
    const parser = robotsParserFactory(`${origin}/robots.txt`, body);
    CACHE.set(origin, { parser, fetchedAt: Date.now() });
    return CACHE.get(origin)!.parser;
  } catch (e: unknown) {
    const err = e as Error;
    logger.debug({ origin, error: err.message }, 'robots fetch failed');
    return null;
  }
}

export async function isAllowed(url: string, userAgent: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const origin = `${u.protocol}//${u.hostname}`;
  const parser = await getParser(origin, userAgent);
  if (!parser) {
    // Fail open when robots is unreachable.
    return true;
  }
  const result = parser.isAllowed(url, userAgent);
  // robots-parser returns boolean | undefined; treat undefined as allowed.
  return result !== false;
}

export function clearRobotsCache(): void {
  CACHE.clear();
}