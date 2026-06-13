import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { crawl } from './bfs.js';
import { clearRobotsCache } from './robots.js';

let mock: MockAgent;
let realDispatcher: ReturnType<typeof getGlobalDispatcher>;

beforeAll(() => {
  realDispatcher = getGlobalDispatcher();
  mock = new MockAgent();
  mock.disableNetConnect();
  setGlobalDispatcher(mock);
});

beforeEach(() => {
  // Reset the in-memory robots cache between tests so mock intercepts are
  // re-evaluated from scratch.
  clearRobotsCache();
  // Each test gets a fresh pool; remove any leftover intercepts.
  // MockAgent has no public reset() so we recreate the pool per test inside.
});

afterAll(() => {
  setGlobalDispatcher(realDispatcher);
  clearRobotsCache();
});

describe('crawl BFS', () => {
  it('crawls same-domain pages and skips cross-domain', async () => {
    const pool = mock.get('https://example.com');
    pool.intercept({ path: '/robots.txt' }).reply(200, '');
    pool.intercept({ path: '/' }).reply(
      200,
      '<html><head><title>Home</title></head>' +
        '<body><a href="/page1">P1</a><a href="https://other.com/x">X</a></body></html>'
    );
    pool.intercept({ path: '/page1' }).reply(
      200,
      '<html><head><title>Page 1</title></head><body>content</body></html>'
    );

    const results = await crawl(['https://example.com/'], {
      maxPages: 5,
      maxDepth: 1,
      delayMs: 0,
      userAgent: 'TestBot',
    });

    const urls = results.map((r) => r.url);
    // given normalizeUrl strips trailing slash from root
    expect(urls).toContain('https://example.com');
    expect(urls.some((u) => u.endsWith('/page1'))).toBe(true);
    // Cross-domain link must be filtered out.
    expect(urls.some((u) => u.includes('other.com'))).toBe(false);
  });

  it('respects maxDepth=0 (no recursion past seed)', async () => {
    const pool = mock.get('https://example.com');
    pool.intercept({ path: '/robots.txt' }).reply(200, '');
    pool.intercept({ path: '/' }).reply(
      200,
      '<html><body><a href="/a">a</a></body></html>'
    );
    // /a should never be requested because depth=0 forbids enqueuing children.
    pool.intercept({ path: '/a' }).reply(
      200,
      '<html><body>should not see</body></html>'
    );

    const results = await crawl(['https://example.com/'], {
      maxPages: 10,
      maxDepth: 0,
      delayMs: 0,
    });

    expect(results.length).toBe(1);
    expect(results[0].url).toContain('example.com');
    expect(results.find((r) => r.url.includes('/a'))).toBeUndefined();
  });

  it('respects maxPages limit', async () => {
    const pool = mock.get('https://example.com');
    pool.intercept({ path: '/robots.txt' }).reply(200, '');
    pool.intercept({ path: '/' }).reply(
      200,
      '<html><body><a href="/a">a</a><a href="/b">b</a></body></html>'
    );
    pool.intercept({ path: '/a' }).reply(200, '<html><body>A</body></html>');
    pool.intercept({ path: '/b' }).reply(200, '<html><body>B</body></html>');

    const results = await crawl(['https://example.com/'], {
      maxPages: 1,
      maxDepth: 5,
      delayMs: 0,
    });
    expect(results.length).toBe(1);
  });

  it('deduplicates via visited set', async () => {
    const pool = mock.get('https://example.com');
    pool.intercept({ path: '/robots.txt' }).reply(200, '');
    pool.intercept({ path: '/' }).reply(
      200,
      '<html><body><a href="/page">p</a><a href="/page">dup</a></body></html>'
    );
    pool.intercept({ path: '/page' }).reply(200, '<html><body>p</body></html>');

    const results = await crawl(['https://example.com/'], {
      maxPages: 10,
      maxDepth: 1,
      delayMs: 0,
    });
    const pages = results.filter((r) => r.url.endsWith('/page'));
    expect(pages.length).toBe(1);
  });
});