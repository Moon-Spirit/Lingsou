import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from './client.js';
import { ensureIndex, pushDocuments, clearIndex, deleteIndex } from './indexer.js';
import { search, suggest } from './search.js';
import type { IndexedDocument } from '../types/index.js';
import type { MeiliSearch } from 'meilisearch';

const TEST_INDEX = 'lingsou_test_pages';

const sampleDocs: IndexedDocument[] = [
  {
    id: 't1',
    url: 'https://example.com/a',
    title: '测试搜索引擎原理',
    content: '本文介绍搜索引擎的工作原理与索引结构',
    tokens: ['搜索引擎', '原理', '索引'],
    crawledAt: '2026-06-13T00:00:00.000Z',
    domain: 'example.com',
  },
  {
    id: 't2',
    url: 'https://example.com/b',
    title: 'JavaScript 入门',
    content: 'JavaScript 是一门脚本语言,广泛用于网页开发',
    tokens: ['JavaScript', '脚本', '网页'],
    crawledAt: '2026-06-13T00:01:00.000Z',
    domain: 'example.com',
  },
  {
    id: 't3',
    url: 'https://other.org/c',
    title: '搜索引擎优化指南',
    content: 'SEO best practices for ranking higher',
    tokens: ['搜索引擎', '优化', 'SEO'],
    crawledAt: '2026-06-13T00:02:00.000Z',
    domain: 'other.org',
  },
];

describe('meili search e2e (real Meilisearch)', () => {
  let client: MeiliSearch;

  beforeAll(async () => {
    client = createClient();
    await deleteIndex(client, TEST_INDEX);
    await ensureIndex(client, TEST_INDEX);
    await clearIndex(client, TEST_INDEX);
    await pushDocuments(client, TEST_INDEX, sampleDocs);
  }, 60_000);

  afterAll(async () => {
    await deleteIndex(client, TEST_INDEX);
  });

  it('returns hits for a Chinese query', async () => {
    const r = await search(client, TEST_INDEX, '搜索引擎');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0]?.title).toContain('搜索引擎');
  });

  it('emits <mark> highlight tags in _formatted.title', async () => {
    const r = await search(client, TEST_INDEX, '搜索引擎');
    const hit = r.hits[0];
    expect(hit?._formatted?.title).toBeDefined();
    expect(hit?._formatted?.title ?? '').toContain('<mark>');
    expect(hit?._formatted?.title ?? '').toContain('</mark>');
  });

  it('respects limit and offset', async () => {
    const r1 = await search(client, TEST_INDEX, '搜索引擎', { limit: 1 });
    expect(r1.hits).toHaveLength(1);
    const r2 = await search(client, TEST_INDEX, '搜索引擎', { limit: 1, offset: 1 });
    expect(r2.hits[0]?.id).not.toBe(r1.hits[0]?.id);
  });

  it('suggest returns up to N title+url pairs', async () => {
    const r = await suggest(client, TEST_INDEX, '搜索', 5);
    expect(r.query).toBe('搜索');
    expect(Array.isArray(r.suggestions)).toBe(true);
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions[0]?.title).toBeTruthy();
    expect(r.suggestions[0]?.url).toBeTruthy();
  });

  it('suggest returns empty for blank prefix', async () => {
    const r = await suggest(client, TEST_INDEX, '   ');
    expect(r.suggestions).toEqual([]);
  });

  it('clearIndex removes all documents', async () => {
    await clearIndex(client, TEST_INDEX);
    const r = await search(client, TEST_INDEX, '搜索引擎');
    expect(r.hits).toHaveLength(0);
    // Restore docs for any follow-up tests in the suite.
    await pushDocuments(client, TEST_INDEX, sampleDocs);
  });
});
