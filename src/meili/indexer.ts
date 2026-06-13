import type { MeiliSearch } from 'meilisearch';
import type { IndexedDocument } from '../types/index.js';

const INDEX_ALREADY_EXISTS = 'index_already_exists';
const INDEX_NOT_FOUND = 'index_not_found';

function isMeiliError(e: unknown): e is { code?: string } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

export async function ensureIndex(client: MeiliSearch, indexName: string): Promise<void> {
  // Create the index (idempotent). Meilisearch returns "index_already_exists" if it does.
  try {
    const createTask = await client.createIndex(indexName, { primaryKey: 'id' });
    await client.waitForTask(createTask.taskUid);
  } catch (e: unknown) {
    if (!isMeiliError(e) || e.code !== INDEX_ALREADY_EXISTS) throw e;
  }

  // Apply settings (searchable/filterable/sortable attributes).
  const settingsTask = await client
    .index(indexName)
    .updateSettings({
      searchableAttributes: ['title', 'content', 'tokens'],
      filterableAttributes: ['domain'],
      sortableAttributes: ['crawledAt'],
    });
  await client.waitForTask(settingsTask.taskUid);
}

export async function pushDocuments(
  client: MeiliSearch,
  indexName: string,
  docs: IndexedDocument[],
  batchSize = 100
): Promise<void> {
  if (docs.length === 0) return;
  const index = client.index(indexName);
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const task = await index.addDocuments(batch);
    // Wait for the task so callers can be sure data is queryable.
    await client.waitForTask(task.taskUid);
  }
}

export async function clearIndex(client: MeiliSearch, indexName: string): Promise<void> {
  const index = client.index(indexName);
  const task = await index.deleteAllDocuments();
  await client.waitForTask(task.taskUid);
}

export async function deleteIndex(client: MeiliSearch, indexName: string): Promise<void> {
  try {
    const task = await client.deleteIndex(indexName);
    await client.waitForTask(task.taskUid);
  } catch (e: unknown) {
    if (!isMeiliError(e) || e.code !== INDEX_NOT_FOUND) throw e;
  }
}
