import type { IndexedDocument } from './document.js';

export interface SearchQuery {
  q: string;
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: string;
  url: string;
  title: string;
  content: string;
  domain: string;
  crawledAt: string;
  _formatted?: {
    title?: string;
    content?: string;
  };
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  processingTimeMs: number;
  query: string;
  offset: number;
  limit: number;
}

export interface SuggestResponse {
  suggestions: Array<{ title: string; url: string }>;
  query: string;
}

export type { IndexedDocument };
