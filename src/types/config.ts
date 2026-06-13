export interface AppConfig {
  meiliHost: string;
  meiliKey: string;
  meiliIndex: string;
  crawlMaxPages: number;
  crawlDelayMs: number;
  crawlUserAgent: string;
  crawlMaxDepth: number;
  crawlConcurrency: number;
  logLevel: string;
  port: number;
}
