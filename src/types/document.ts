export interface IndexedDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  tokens: string[];
  crawledAt: string; // ISO timestamp
  domain: string;
}
