/**
 * Unit tests for the multi-engine aggregator.
 *
 * Uses undici's MockAgent to intercept outbound HTTP without hitting the
 * network. One engine is given a real intercept, the other is left
 * un-intercepted (disableNetConnect → undici throws → aggregator logs warn
 * and continues with whatever succeeded).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import type { Dispatcher } from 'undici';
import { aggregateSearch } from './aggregator.js';

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

describe('aggregateSearch', () => {
  it('merges results from multiple engines and re-ranks by consensus', async () => {
    // DDG returns two URLs; one of them Bing also returns.
    const ddg = mock.get('https://html.duckduckgo.com');
    ddg.intercept({ path: /\?q=test/ }).reply(
      200,
      `<html><body>
        <div class="result">
          <h2 class="result__title">
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fshared">Shared page</a>
          </h2>
          <a class="result__snippet">snippet shared</a>
        </div>
        <div class="result">
          <h2 class="result__title">
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fddg-only.test%2F">DDG only</a>
          </h2>
          <a class="result__snippet">snippet ddg-only</a>
        </div>
      </body></html>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const bing = mock.get('https://www.bing.com');
    bing.intercept({ path: /\?q=test/ }).reply(
      200,
      `<html><body>
        <ol id="b_results">
          <li class="b_algo">
            <h2><a href="https://example.com/shared">Shared page</a></h2>
            <div class="b_caption"><p>snippet shared (bing)</p></div>
          </li>
        </ol>
      </body></html>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const r = await aggregateSearch('test', { engines: ['duckduckgo', 'bing'], limit: 10 });
    expect(r.length).toBe(2);

    // The shared URL must be consensus=2 and ranked first.
    const shared = r.find((h) => h.url === 'https://example.com/shared');
    expect(shared).toBeDefined();
    expect(shared!.consensus).toBe(2);
    expect(shared!.engines.sort()).toEqual(['bing', 'duckduckgo']);
    expect(r[0]!.url).toBe('https://example.com/shared');
  });

  it('handles engine failure gracefully (one engine fails, others succeed)', async () => {
    // Only Bing is reachable; DDG has no intercept → undici throws on the
    // DDG request. searchSERP swallows it and returns []. Aggregator still
    // returns Bing's hits via Promise.allSettled.
    const bing = mock.get('https://www.bing.com');
    bing.intercept({ path: /\?q=test/ }).reply(
      200,
      `<html><body>
        <ol id="b_results">
          <li class="b_algo">
            <h2><a href="https://example.com/x">Bing only</a></h2>
            <div class="b_caption"><p>x snippet</p></div>
          </li>
        </ol>
      </body></html>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const r = await aggregateSearch('test', { engines: ['duckduckgo', 'bing'], limit: 10 });
    expect(r.length).toBe(1);
    expect(r[0]!.url).toBe('https://example.com/x');
    expect(r[0]!.engines).toEqual(['bing']);
    expect(r[0]!.consensus).toBe(1);
  });

  it('returns empty for empty engines list', async () => {
    const r = await aggregateSearch('test', { engines: [], limit: 10 });
    expect(r).toEqual([]);
  });

  it('returns empty when all engines fail', async () => {
    // No intercepts registered; both engines time out → no hits at all.
    const r = await aggregateSearch('test', { engines: ['duckduckgo', 'bing'], limit: 10 });
    expect(r).toEqual([]);
  });

  it('respects the limit', async () => {
    const ddg = mock.get('https://html.duckduckgo.com');
    ddg.intercept({ path: /\?q=test/ }).reply(
      200,
      `<div class="result">
        <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.test%2F">A</a></h2>
        <a class="result__snippet">sa</a>
       </div>
       <div class="result">
        <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fb.test%2F">B</a></h2>
        <a class="result__snippet">sb</a>
       </div>
       <div class="result">
        <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fc.test%2F">C</a></h2>
        <a class="result__snippet">sc</a>
       </div>`,
      { headers: { 'content-type': 'text/html' } }
    );

    const r = await aggregateSearch('test', { engines: ['duckduckgo'], limit: 2 });
    expect(r.length).toBe(2);
  });
});
