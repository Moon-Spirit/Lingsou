import { describe, it, expect } from 'vitest';
import { extractTextAndLinks, stripHtml } from './html.js';

describe('extractTextAndLinks', () => {
  it('extracts title', () => {
    const html = '<html><head><title>测试</title></head><body>content</body></html>';
    const r = extractTextAndLinks(html, 'https://x.com');
    expect(r.title).toBe('测试');
  });
  it('removes script and style', () => {
    const html = '<html><head><style>p{color:red}</style><script>alert(1)</script></head><body>visible</body></html>';
    const r = extractTextAndLinks(html, 'https://x.com');
    expect(r.text).not.toContain('alert');
    expect(r.text).not.toContain('color:red');
    expect(r.text).toContain('visible');
  });
  it('extracts links relative to base', () => {
    const html = '<html><body><a href="/foo">F</a><a href="https://other.com">O</a></body></html>';
    const r = extractTextAndLinks(html, 'https://x.com');
    expect(r.links).toContain('https://x.com/foo');
    expect(r.links).toContain('https://other.com');
  });
});

describe('stripHtml', () => {
  it('returns plain text', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });
});
