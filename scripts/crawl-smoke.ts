import { crawl } from '../src/crawler/bfs.js';
import { loadSeeds } from '../src/crawler/seedLoader.js';

async function main(): Promise<void> {
  const seedsPath = process.argv[2] ?? '/root/lingsou/seeds.txt';
  const maxPages = Number(process.argv[3] ?? 3);
  const maxDepth = Number(process.argv[4] ?? 1);
  const delayMs = Number(process.argv[5] ?? 1000);

  console.log(`[crawl-smoke] loading seeds from ${seedsPath}`);
  const seeds = await loadSeeds(seedsPath);
  console.log(`[crawl-smoke] loaded ${seeds.length} seeds; taking first seed only`);
  const seedSlice = seeds.slice(0, 1);

  const start = Date.now();
  const results = await crawl(seedSlice, { maxPages, maxDepth, delayMs });
  const duration = Date.now() - start;

  console.log(`[crawl-smoke] DONE pages=${results.length} durationMs=${duration}`);
  for (const r of results) {
    console.log(
      `[crawl-smoke] url=${r.url} status=${r.status} title="${r.title}" ` +
        `contentLen=${r.content.length} links=${r.links.length} domain=${r.domain}`
    );
  }
}

main().catch((err: unknown) => {
  const e = err as Error;
  console.error('[crawl-smoke] FAILED:', e.message);
  process.exit(1);
});