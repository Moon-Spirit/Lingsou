import iconv from 'iconv-lite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const jschardet: { detect: (b: Buffer) => { encoding: string | null; confidence: number } } = require('jschardet');

export function detectEncoding(buffer: Buffer): 'utf-8' | 'gbk' | 'gb18030' {
  if (buffer.length === 0) return 'utf-8';
  // Check for BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf-8';
  const result = jschardet.detect(buffer);
  const enc = (result.encoding || '').toLowerCase();
  if (enc.includes('gb') || enc === 'gb2312') return 'gb18030';
  if (enc.includes('utf')) return 'utf-8';
  // Heuristic: high-bit bytes without valid utf8 → gb18030
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    void decoded;
    return 'utf-8';
  } catch {
    return 'gb18030';
  }
}

export function decodeHtml(buffer: Buffer): string {
  const enc = detectEncoding(buffer);
  if (enc === 'utf-8') return buffer.toString('utf-8');
  return iconv.decode(buffer, enc);
}
