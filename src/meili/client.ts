import { MeiliSearch } from 'meilisearch';
import { config } from '../config.js';

export function createClient(): MeiliSearch {
  return new MeiliSearch({
    host: config.meiliHost,
    apiKey: config.meiliKey,
  });
}
