import { describe, it, expect } from 'vitest';
import iconv from 'iconv-lite';
import { detectEncoding, decodeHtml } from './encoding.js';

describe('detectEncoding', () => {
  it('detects UTF-8 BOM', () => {
    const buf = Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x69]);
    expect(detectEncoding(buf)).toBe('utf-8');
  });
  it('detects GBK for Chinese without utf-8', () => {
    const buf = iconv.encode('中文测试页面', 'gbk');
    const enc = detectEncoding(buf);
    expect(enc === 'gbk' || enc === 'gb18030').toBe(true);
  });
  it('decodes GBK to readable Chinese', () => {
    const buf = iconv.encode('搜索引擎原理', 'gbk');
    const text = decodeHtml(buf);
    expect(text).toBe('搜索引擎原理');
  });
});
