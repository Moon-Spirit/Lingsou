import { createClient, ensureIndex, pushDocuments } from '../../../src/meili/index.js';
import { config } from '../../../src/config.js';
import type { IndexedDocument } from '../../../src/types/index.js';

/**
 * E2E fixture documents — distinct IDs (`e2e-1`, `e2e-2`, `e2e-3`) that will
 * never collide with production data or integration-test fixtures.
 */
export const E2E_DOCS: IndexedDocument[] = [
  {
    id: 'e2e-1',
    url: 'https://e2e.example.com/article-1',
    title: '灵搜搜索引擎测试',
    content: '灵搜是一个测试文档,用于端到端测试搜索功能。包含灵搜和搜索引擎关键词。',
    tokens: ['灵搜', '搜索引擎', '测试', '端到端', '功能'],
    crawledAt: '2026-01-01T00:00:00.000Z',
    domain: 'e2e.example.com',
  },
  {
    id: 'e2e-2',
    url: 'https://e2e.example.com/article-2',
    title: 'Meilisearch 全文检索',
    content: 'Meilisearch 支持关键词高亮和即时搜索。',
    tokens: ['meilisearch', '全文', '检索', '关键词', '高亮', '即时搜索'],
    crawledAt: '2026-01-02T00:00:00.000Z',
    domain: 'e2e.example.com',
  },
  {
    id: 'e2e-3',
    url: 'https://e2e.example.com/article-3',
    title: '另一个测试页面',
    content: '本页包含与灵搜无关的测试内容。',
    tokens: ['页面', '测试内容'],
    crawledAt: '2026-01-03T00:00:00.000Z',
    domain: 'e2e.example.com',
  },
];

/**
 * Push E2E fixture documents into the production index (config.meiliIndex).
 * Called by the Playwright seed fixture before each test.
 */
export async function setupE2EFixture(): Promise<void> {
  const client = createClient();
  await ensureIndex(client, config.meiliIndex);
  await pushDocuments(client, config.meiliIndex, E2E_DOCS);
}

/**
 * Delete E2E fixture documents from the production index.
 * Called by the Playwright seed fixture after each test completes.
 */
export async function teardownE2EFixture(): Promise<void> {
  const client = createClient();
  const index = client.index(config.meiliIndex);
  for (const doc of E2E_DOCS) {
    await index.deleteDocument(doc.id);
  }
}
