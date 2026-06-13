import { readFile } from 'node:fs/promises';

export async function loadSeeds(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Normalize: remove fragment, trailing slash
    let url = trimmed;
    try {
      const u = new URL(url);
      // Only accept http/https schemes
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        continue;
      }
      u.hash = '';
      let s = u.toString();
      if (s.endsWith('/') && u.pathname === '/') {
        s = s.slice(0, -1) || s;
      }
      url = s;
    } catch {
      // Invalid URL, skip
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }

  return result;
}