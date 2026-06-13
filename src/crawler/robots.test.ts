import { describe, it, expect, beforeEach } from 'vitest';
import * as robotsParserMod from 'robots-parser';
import { isAllowed, clearRobotsCache } from './robots.js';

type RobotsParser = {
  isAllowed: (url: string, ua?: string) => boolean | undefined;
};

const RobotsParser = (robotsParserMod as unknown as { default?: (url: string, contents: string) => RobotsParser }).default ??
  (robotsParserMod as unknown as (url: string, contents: string) => RobotsParser);

// Pure robots-parser contract tests (no network). isAllowed() integration with
// the real fetch path is covered by bfs.test.ts where MockAgent intercepts.
describe('robots parser contract', () => {
  it('blocks disallowed path and allows public path', () => {
    const p = RobotsParser('http://x.com/robots.txt', 'User-agent: *\nDisallow: /private');
    expect(p.isAllowed('http://x.com/private/secret', 'Bot')).toBe(false);
    expect(p.isAllowed('http://x.com/public', 'Bot')).toBe(true);
  });

  it('allows everything when robots is empty', () => {
    const p = RobotsParser('http://x.com/robots.txt', '');
    expect(p.isAllowed('http://x.com/anything', 'Bot')).toBe(true);
  });

  it('respects specific user-agent rules over wildcard', () => {
    const txt =
      'User-agent: *\nDisallow: /\n' +
      'User-agent: Googlebot\nAllow: /';
    const p = RobotsParser('http://x.com/robots.txt', txt);
    expect(p.isAllowed('http://x.com/page', 'Googlebot')).toBe(true);
    expect(p.isAllowed('http://x.com/page', 'OtherBot')).toBe(false);
  });
});

describe('isAllowed() error handling', () => {
  beforeEach(() => {
    clearRobotsCache();
  });

  it('returns false for invalid URL', async () => {
    expect(await isAllowed('not a url', 'TestBot')).toBe(false);
  });
});