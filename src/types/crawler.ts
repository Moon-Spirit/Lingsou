export interface CrawlTask {
  url: string;
  depth: number;
  parentUrl?: string;
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  tokens: string[];
  domain: string;
  status: number;
  crawledAt: string;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  delayMs?: number;
  userAgent?: string;
  concurrency?: number;
  allowDomains?: string[]; // if set, only these domains are crawled
}

export interface CrawlSummary {
  total: number;
  indexed: number;
  failed: number;
  durationMs: number;
}
