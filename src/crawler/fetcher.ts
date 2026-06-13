import { request } from 'undici';
import { logger } from '../logger.js';

export interface FetchResult {
  status: number;
  url: string;
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface FetchOpts {
  userAgent?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_USER_AGENT = 'LingsouBot/0.1';

export async function fetchPage(url: string, opts: FetchOpts = {}): Promise<FetchResult | null> {
  const ua = opts.userAgent ?? DEFAULT_USER_AGENT;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRetries = opts.maxRetries ?? DEFAULT_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await request(url, {
        method: 'GET',
        headers: { 'user-agent': ua, accept: 'text/html,*/*' },
        bodyTimeout: timeout,
        headersTimeout: timeout,
      });

      if (res.statusCode === 429 || res.statusCode === 403) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        logger.debug({ url, status: res.statusCode }, 'fetch rate-limited/blocked');
        return null;
      }

      if (res.statusCode >= 400) {
        logger.debug({ url, status: res.statusCode }, 'fetch http error');
        return null;
      }

      const body = await res.body.arrayBuffer();
      const buf = Buffer.from(body);
      return {
        status: res.statusCode,
        url,
        body: buf,
        headers: res.headers as Record<string, string | string[] | undefined>,
      };
    } catch (e: unknown) {
      const err = e as Error;
      logger.debug({ url, error: err.message, attempt }, 'fetch attempt failed');
      if (attempt >= maxRetries) return null;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}