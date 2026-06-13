import { createClient, ensureIndex, pushDocuments, clearIndex } from '../../src/meili/index.js';
import type { IndexedDocument } from '../../src/types/index.js';

/**
 * Test fixture documents for API integration tests.
 *
 * Three Chinese-tech docs with distinct terminology so tests can target each
 * fixture by id (`fixture-1` through `fixture-3`). IDs are prefixed `fixture-`
 * to avoid collisions with any real production data in `lingsou_pages`.
 */
export const FIXTURE_DOCS: IndexedDocument[] = [
  {
    id: 'fixture-1',
    url: 'https://example.com/article-1',
    title: '搜索引擎原理详解',
    content: '搜索引擎由爬虫、索引器、查询处理器三部分组成,本文介绍其工作原理。',
    tokens: ['搜索', '引擎', '原理', '爬虫', '索引', '查询'],
    crawledAt: '2026-01-01T00:00:00.000Z',
    domain: 'example.com',
  },
  {
    id: 'fixture-2',
    url: 'https://example.com/article-2',
    title: 'Meilisearch 入门',
    content: 'Meilisearch 是一个轻量级全文搜索引擎,基于 Rust 实现,支持中文分词。',
    tokens: ['meilisearch', '轻量级', '全文搜索', '引擎', 'rust', '中文', '分词'],
    crawledAt: '2026-01-02T00:00:00.000Z',
    domain: 'example.com',
  },
  {
    id: 'fixture-3',
    url: 'https://example.com/article-3',
    title: 'Node.js 网络爬虫实战',
    content: '本文展示如何用 Node.js 和 undici 编写高效的网页爬虫。',
    tokens: ['nodejs', 'undici', '爬虫', '网页'],
    crawledAt: '2026-01-03T00:00:00.000Z',
    domain: 'example.com',
  },
];

/**
 * Push fixture documents into the production index `lingsou_pages` (additive).
 *
 * The production search routes hardcode `config.meiliIndex`, so we share that
 * index rather than introducing a parallel test index. Fixture IDs are unique
 * (`fixture-1..3`) so they cannot collide with real production data, and
 * `removeFixtures()` deletes them after the suite finishes to keep the index
 * clean.
 */
export async function pushFixtures(): Promise<void> {
  const client = createClient();
  await ensureIndex(client, 'lingsou_pages');
  await pushDocuments(client, 'lingsou_pages', FIXTURE_DOCS);
}

/**
 * Delete every fixture document from the production index. Idempotent —
 * calling on a non-existent document is a no-op in Meilisearch.
 */
export async function removeFixtures(): Promise<void> {
  const client = createClient();
  const index = client.index('lingsou_pages');
  for (const doc of FIXTURE_DOCS) {
    await index.deleteDocument(doc.id);
  }
}

/**
 * Fully wipe the production index. Use with care — this destroys real data.
 * Intended only for destructive local debugging, not the standard suite.
 */
export async function wipeProductionIndex(): Promise<void> {
  const client = createClient();
  await ensureIndex(client, 'lingsou_pages');
  await clearIndex(client, 'lingsou_pages');
}