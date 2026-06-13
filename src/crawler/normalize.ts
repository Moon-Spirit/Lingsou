const TRACKING_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
]);

/**
 * Remove common tracking query params (utm_*) from a URL.
 * Returns the cleaned URL, or null if the input is not a valid URL.
 */
export function stripTrackingParams(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const keys: string[] = [];
    for (const k of u.searchParams.keys()) {
      if (k.startsWith('utm_') || TRACKING_KEYS.has(k)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Apply stripTrackingParams, then merge duplicate query params so that
 * "?a=1&a=2" becomes "?a=1". Keeps the first occurrence of each key.
 */
export function normalizeForIndex(url: string): string | null {
  try {
    const cleaned = stripTrackingParams(url);
    if (!cleaned) return null;
    const u = new URL(cleaned);
    const seen = new Set<string>();
    const merged: Array<[string, string]> = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push([k, v]);
    }
    const next = new URL(u.toString());
    next.search = '';
    for (const [k, v] of merged) {
      next.searchParams.append(k, v);
    }
    return next.toString();
  } catch {
    return null;
  }
}