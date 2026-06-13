import * as cheerio from 'cheerio';
import { normalizeUrl } from './url.js';

export interface Extracted {
  title: string;
  text: string;
  links: string[];
}

export function extractTextAndLinks(html: string, baseUrl: string): Extracted {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, noscript, iframe').remove();
  const title = ($('title').first().text() || '').trim() || baseUrl;
  // Get text from main content; fallback to body
  const main = $('main').length ? $('main') : $('body');
  const text = main.text().replace(/\s+/g, ' ').trim();
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, baseUrl);
    if (normalized) links.push(normalized);
  });
  return { title, text, links };
}

export function stripHtml(html: string): string {
  const $ = cheerio.load('<root>' + html + '</root>');
  return $.root().text().replace(/\s+/g, ' ').trim();
}
