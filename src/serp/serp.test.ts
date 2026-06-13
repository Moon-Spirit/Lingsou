/**
 * Unit tests for the SERP client.
 *
 * Uses undici's MockAgent to intercept outbound HTTP without hitting the
 * network. This lets us assert on the parsing logic deterministically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';
import { searchSERP } from './client.js';

let mock: MockAgent;
let real: Dispatcher;

beforeEach(() => {
  real = getGlobalDispatcher();
  mock = new MockAgent();
  mock.disableNetConnect();
  setGlobalDispatcher(mock);
});

afterEach(() => {
  setGlobalDispatcher(real);
});

describe('SERP client - DuckDuckGo', () => {
  it('parses a single result, unwrapping the duckduckgo redirect URL', async () => {
    const pool = mock.get('https://html.duckduckgo.com');
    pool.intercept({ path: /\?q=test/ }).reply(
      200,
      `<html><body>
        <div class="result">
          <h2 class="result__title">
            <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;rut=deadbeef">Example Title</a>
          </h2>
          <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">A snippet describing example.com</a>
        </div>
      </body></html>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const r = await searchSERP('test', { engine: 'duckduckgo', limit: 5 });
    expect(r).toHaveLength(1);
    expect(r[0]?.title).toBe('Example Title');
    expect(r[0]?.url).toBe('https://example.com/page');
    expect(r[0]?.snippet).toContain('snippet');
    expect(r[0]?.source).toBe('duckduckgo');
  });

  it('respects the limit, stopping after N results', async () => {
    const pool = mock.get('https://html.duckduckgo.com');
    pool.intercept({ path: /\?q=test/ }).reply(
      200,
      `<div class="result">
         <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.test%2F">A</a></h2>
         <a class="result__snippet">s1</a>
       </div>
       <div class="result">
         <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fb.test%2F">B</a></h2>
         <a class="result__snippet">s2</a>
       </div>
       <div class="result">
         <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fc.test%2F">C</a></h2>
         <a class="result__snippet">s3</a>
       </div>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const r = await searchSERP('test', { engine: 'duckduckgo', limit: 2 });
    expect(r).toHaveLength(2);
    expect(r.map((h) => h.title)).toEqual(['A', 'B']);
  });
});

describe('SERP client - Bing', () => {
  it('parses a single result from the b_algo list', async () => {
    const pool = mock.get('https://www.bing.com');
    pool.intercept({ path: /\?q=test/ }).reply(
      200,
      `<html><body>
        <ol id="b_results">
          <li class="b_algo">
            <h2><a href="https://example.com">Bing Result</a></h2>
            <div class="b_caption"><p>bing snippet text</p></div>
          </li>
        </ol>
      </body></html>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const r = await searchSERP('test', { engine: 'bing', limit: 5 });
    expect(r).toHaveLength(1);
    expect(r[0]?.title).toBe('Bing Result');
    expect(r[0]?.url).toBe('https://example.com');
    expect(r[0]?.snippet).toContain('bing snippet');
    expect(r[0]?.source).toBe('bing');
  });
});

describe('SERP client - error handling', () => {
  it('returns empty array on network failure (no intercept matches)', async () => {
    // disableNetConnect is on, and no intercepts registered → undici throws.
    const r = await searchSERP('test', { engine: 'duckduckgo', limit: 5 });
    expect(r).toEqual([]);
  });

  it('returns empty array when the server returns a 5xx', async () => {
    const pool = mock.get('https://html.duckduckgo.com');
    pool.intercept({ path: /\?q=test/ }).reply(503, 'service unavailable');
    const r = await searchSERP('test', { engine: 'duckduckgo', limit: 5 });
    expect(r).toEqual([]);
  });

  it('throws on unknown engine', async () => {
    await expect(
      searchSERP('test', { engine: 'google' as never })
    ).rejects.toThrow(/Unknown SERP engine/i);
  });

  it('silently swallows errors thrown by undici.fetch itself', async () => {
    // Use replyWithError to simulate a low-level socket error.
    const pool = mock.get('https://html.duckduckgo.com');
    pool.intercept({ path: /\?q=boom/ }).replyWithError(new Error('socket hang up'));
    const r = await searchSERP('boom', { engine: 'duckduckgo', limit: 5 });
    expect(r).toEqual([]);
  });

  // Sanity check that vi is wired correctly (the test runner is healthy).
  it('vitest is alive', () => {
    expect(vi).toBeDefined();
  });
});