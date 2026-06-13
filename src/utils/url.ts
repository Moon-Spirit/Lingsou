export function normalizeUrl(url: string, base?: string): string | null {
  try {
    const u = base ? new URL(url, base) : new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    let s = u.toString();
    // remove trailing slash from root path
    if (s.endsWith('/') && u.pathname === '/') {
      s = s.slice(0, -1);
    }
    return s;
  } catch {
    return null;
  }
}

export function isSameDomain(urlA: string, urlB: string): boolean {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.hostname === b.hostname;
  } catch {
    return false;
  }
}

export function shouldCrawl(url: string, allowList: string[] = [], denyList: string[] = []): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (allowList.length > 0 && !allowList.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`))) {
    return false;
  }
  if (denyList.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`))) {
    return false;
  }
  return true;
}
