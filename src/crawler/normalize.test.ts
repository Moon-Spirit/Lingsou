import { describe, it, expect } from 'vitest';
import { stripTrackingParams, normalizeForIndex } from './normalize.js';

describe('stripTrackingParams', () => {
  it('removes utm_* params', () => {
    expect(stripTrackingParams('https://x.com/?utm_source=a&id=1'))
      .toBe('https://x.com/?id=1');
  });

  it('preserves other params and order', () => {
    expect(stripTrackingParams('https://x.com/?q=test&page=2'))
      .toBe('https://x.com/?q=test&page=2');
  });

  it('returns null for invalid URL', () => {
    expect(stripTrackingParams('not a url')).toBeNull();
  });

  it('strips multiple utm_* at once', () => {
    const cleaned = stripTrackingParams(
      'https://x.com/path?utm_source=a&utm_medium=b&keep=1'
    );
    expect(cleaned).toBe('https://x.com/path?keep=1');
  });
});

describe('normalizeForIndex', () => {
  it('merges duplicate query keys, keeping first', () => {
    const merged = normalizeForIndex('https://x.com/?a=1&a=2&b=3');
    expect(merged).toBe('https://x.com/?a=1&b=3');
  });

  it('strips tracking then merges', () => {
    const out = normalizeForIndex('https://x.com/?utm_source=z&id=1&id=2');
    expect(out).toBe('https://x.com/?id=1');
  });
});