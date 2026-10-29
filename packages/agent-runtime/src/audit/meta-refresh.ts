import * as cheerio from 'cheerio';

/**
 * Where a `<meta http-equiv="refresh" content="0;url=...">` sends the page, resolved against
 * the page's own URL, or null when the page is not such a redirect.
 *
 * Search engines treat an instant meta refresh as a redirect and index the target, so an
 * audit has to follow it too: docs.astro.build answers its root with an 80-byte stub of this
 * kind, and auditing the stub scored the site 57 with seven errors (no title, no H1, no
 * viewport, no content) that the real page does not have. Only quick refreshes count (up to
 * 5 seconds, the range Google documents as a redirect); a page that reloads itself every
 * minute is a page, not a redirect, and a refresh to the same URL is ignored.
 */
export function metaRefreshTarget(html: string, pageUrl: string): string | null {
  if (!/http-equiv\s*=\s*["']?refresh/i.test(html)) return null;
  const $ = cheerio.load(html);
  for (const el of $('meta[http-equiv]').toArray()) {
    if (($(el).attr('http-equiv') || '').trim().toLowerCase() !== 'refresh') continue;
    const content = $(el).attr('content') || '';
    const match = content.match(/^\s*(\d+(?:\.\d+)?)\s*[;,]\s*(?:url\s*=\s*)?['"]?\s*([^'"\s>]+)/i);
    if (!match) continue;
    if (Number(match[1]) > 5) continue;
    try {
      const target = new URL(match[2], pageUrl);
      if (target.protocol !== 'http:' && target.protocol !== 'https:') continue;
      const strip = (u: URL) => u.origin + (u.pathname.replace(/\/+$/, '') || '/') + u.search;
      if (strip(target) === strip(new URL(pageUrl))) continue;
      return target.toString();
    } catch {
      continue;
    }
  }
  return null;
}
