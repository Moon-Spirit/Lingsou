import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSeeds } from './seedLoader.js';

let tmpDir: string;
let file: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'seeds-'));
  file = join(tmpDir, 'seeds.txt');
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true });
});

describe('loadSeeds', () => {
  it('skips comments and empty lines', async () => {
    await writeFile(file, '# comment\n\nhttps://example.com/\n', 'utf-8');
    const result = await loadSeeds(file);
    expect(result).toEqual(['https://example.com']);
  });

  it('deduplicates URLs', async () => {
    await writeFile(file, 'https://example.com/\nhttps://example.com\n# comment', 'utf-8');
    const result = await loadSeeds(file);
    expect(result).toEqual(['https://example.com']);
  });

  it('strips fragments and trailing slash from root', async () => {
    await writeFile(file, 'https://example.com/#section\nhttps://other.com/path/', 'utf-8');
    const result = await loadSeeds(file);
    expect(result).toContain('https://example.com');
    expect(result).toContain('https://other.com/path/');
  });

  it('skips invalid URLs', async () => {
    await writeFile(file, 'not a url\nhttps://valid.com\nftp://invalid', 'utf-8');
    const result = await loadSeeds(file);
    expect(result).toEqual(['https://valid.com']);
  });
});