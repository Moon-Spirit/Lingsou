import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSameDomain, shouldCrawl } from './url.js';

describe('normalizeUrl', () => {
  it('converts relative to absolute', () => {
    expect(normalizeUrl('/foo', 'https://x.com')).toBe('https://x.com/foo');
  });
  it('strips fragment', () => {
    expect(normalizeUrl('https://x.com/path#section')).toBe('https://x.com/path');
  });
  it('returns null for invalid', () => {
    expect(normalizeUrl('not a url')).toBeNull();
  });
  it('rejects non-http protocols', () => {
    expect(normalizeUrl('ftp://x.com/')).toBeNull();
  });
  it('removes trailing slash from root', () => {
    expect(normalizeUrl('https://x.com/')).toBe('https://x.com');
  });
});

describe('isSameDomain', () => {
  it('returns true for same host', () => {
    expect(isSameDomain('https://x.com/a', 'https://x.com/b')).toBe(true);
  });
  it('returns false for different host', () => {
    expect(isSameDomain('https://x.com/a', 'https://y.com/a')).toBe(false);
  });
});

describe('shouldCrawl', () => {
  it('passes by default', () => {
    expect(shouldCrawl('https://x.com/a')).toBe(true);
  });
  it('blocks denied domains', () => {
    expect(shouldCrawl('https://bad.com/a', [], ['bad.com'])).toBe(false);
  });
  it('blocks when not in allow list', () => {
    expect(shouldCrawl('https://x.com/a', ['y.com'])).toBe(false);
  });
});
