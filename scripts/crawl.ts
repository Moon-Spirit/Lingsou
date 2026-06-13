#!/usr/bin/env tsx
import { loadSeeds } from '../src/crawler/seedLoader.js';
import { runCrawlPipeline } from '../src/crawler/pipeline.js';

interface CliArgs {
  seeds: string;
  max: number;
  depth: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  }
  return {
    seeds: args.seeds ?? 'seeds.txt',
    max: args.max ? parseInt(args.max, 10) : 5,
    depth: args.depth ? parseInt(args.depth, 10) : 1,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  console.log(`[crawl] seeds=${args.seeds} max=${args.max} depth=${args.depth}`);
  const seeds = await loadSeeds(args.seeds);
  if (seeds.length === 0) {
    console.error('[crawl] no seeds loaded');
    process.exit(1);
  }
  console.log(`[crawl] loaded ${seeds.length} seeds`);
  const summary = await runCrawlPipeline({
    seeds: seeds.slice(0, args.max),
    maxPages: args.max,
    maxDepth: args.depth,
  });
  console.log(
    `[crawl] indexed ${summary.indexed}/${summary.total} (failed=${summary.failed}) in ${summary.durationMs}ms`
  );
}

main().catch((e) => {
  console.error('[crawl] fatal:', e);
  process.exit(1);
});