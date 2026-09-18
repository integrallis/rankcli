import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface OnPageData {
  title?: string;
  titleLength: number;
  description?: string;
  descriptionLength: number;
  canonical?: string;
  h1s: string[];
  headings: { level: number; text: string }[];
  wordCount: number;
  textToHtmlRatio: number;
  hasNoindex: boolean;
  metaRobots?: string;
  /** X-Robots-Tag response header value, when the caller passed headers */
  xRobotsTag?: string;
}

// Hosts where the platform itself adds X-Robots-Tag: noindex to preview /
// branch deployments (never to the production deployment). A header-only
// noindex there is the platform keeping previews out of search, not a bug
// in the site, so it's reported as a notice instead of failing CI gates on
// every preview audit. A noindex *meta tag* is in the site's own HTML and
// ships to production, so it is never downgraded.
const PREVIEW_HOST_SUFFIXES = ['.vercel.app', '.netlify.app', '.pages.dev'];

export function isPreviewDeploymentHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PREVIEW_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
}

/**
 * Whether an X-Robots-Tag header value keeps Google/Bing from indexing the
 * page. Directives can be scoped to a crawler ("googlebot: noindex") - a
 * scope applies until the next scope; rules for other bots are ignored.
 */
export function xRobotsTagHasNoindex(value: string | undefined): boolean {
  if (!value) return false;
  // Directive names that take a colon-separated value, so "name:" isn't a
  // user-agent scope.
  const valued = new Set(['unavailable_after', 'max-snippet', 'max-image-preview', 'max-video-preview']);
  let agent: string | null = null;
  for (const raw of value.toLowerCase().split(',')) {
    let part = raw.trim();
    const scoped = part.match(/^([a-z0-9_.*-]+)\s*:\s*(.*)$/);
    if (scoped && !valued.has(scoped[1])) {
      agent = scoped[1];
      part = scoped[2].trim();
    }
    if (part === 'noindex' || part === 'none') {
      if (agent === null || agent === '*' || agent === 'googlebot' || agent === 'bingbot') return true;
    }
  }
  return false;
}

function metaHasNoindex(content: string | undefined): boolean {
  if (!content) return false;
  return content.toLowerCase().split(',').some(d => ['noindex', 'none'].includes(d.trim()));
}

/** The site root ("/" with no query) - a noindex there removes the whole site from search. */
export function isSiteRoot(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.pathname === '/' || u.pathname === '') && !u.search;
  } catch {
    return false;
  }
}

export interface OnPageOptions {
  /**
   * Whether this page is the root of what's being audited (the URL the user
   * asked for). Noindex there is an error rather than a warning. Defaults to
   * "is the URL the site's homepage".
   */
  auditRoot?: boolean;
}

export function analyzeOnPage(
  html: string,
  url: string,
  headers?: Record<string, string>,
  options: OnPageOptions = {},
): { issues: AuditIssue[]; data: OnPageData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Extract data
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim();
  const canonical = $('link[rel="canonical"]').attr('href');
  const metaRobots = $('meta[name="robots"]').attr('content');

  // Check noindex: <meta name="robots"> or <meta name="googlebot"> (any
  // case), plus the X-Robots-Tag header when the caller passed headers.
  const robotsMetaValues: string[] = [];
  $('meta[name]').each((_, el) => {
    const name = ($(el).attr('name') || '').toLowerCase();
    if (name === 'robots' || name === 'googlebot') {
      robotsMetaValues.push($(el).attr('content') || '');
    }
  });
  const metaNoindex = robotsMetaValues.some(metaHasNoindex);
  const headerLookup = headers
    ? Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-robots-tag')?.[1]
    : undefined;
  const headerNoindex = xRobotsTagHasNoindex(headerLookup);
  const hasNoindex = metaNoindex || headerNoindex;

  // Extract headings
  const h1s: string[] = [];
  $('h1').each((_, el) => {
    h1s.push($(el).text().trim());
  });

  const headings: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName.charAt(1), 10);
    headings.push({ level, text: $(el).text().trim() });
  });

  // Calculate word count (text content only)
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Calculate text-to-HTML ratio
  const textLength = bodyText.length;
  const htmlLength = html.length;
  const textToHtmlRatio = htmlLength > 0 ? (textLength / htmlLength) * 100 : 0;

  const data: OnPageData = {
    title: title || undefined,
    titleLength: title?.length || 0,
    description,
    descriptionLength: description?.length || 0,
    canonical,
    h1s,
    headings,
    wordCount,
    textToHtmlRatio,
    hasNoindex,
    metaRobots,
    xRobotsTag: headerLookup,
  };

  // ==================== TITLE CHECKS ====================
  if (!title) {
    issues.push({
      ...ISSUE_DEFINITIONS.TITLE_MISSING,
      affectedUrls: [url],
    });
  } else {
    if (title.length < 30) {
      issues.push({
        ...ISSUE_DEFINITIONS.TITLE_TOO_SHORT,
        affectedUrls: [url],
        details: { title, length: title.length },
      });
    } else if (title.length > 60) {
      issues.push({
        ...ISSUE_DEFINITIONS.TITLE_TOO_LONG,
        affectedUrls: [url],
        details: { title, length: title.length },
      });
    }
  }

  // ==================== META DESCRIPTION CHECKS ====================
  if (!description) {
    issues.push({
      ...ISSUE_DEFINITIONS.META_DESC_MISSING,
      affectedUrls: [url],
    });
  } else {
    if (description.length < 120) {
      issues.push({
        ...ISSUE_DEFINITIONS.META_DESC_TOO_SHORT,
        affectedUrls: [url],
        details: { description, length: description.length },
      });
    } else if (description.length > 160) {
      issues.push({
        ...ISSUE_DEFINITIONS.META_DESC_TOO_LONG,
        affectedUrls: [url],
        details: { description, length: description.length },
      });
    }
  }

  // ==================== CANONICAL CHECKS ====================
  if (!canonical) {
    issues.push({
      ...ISSUE_DEFINITIONS.CANONICAL_MISSING,
      affectedUrls: [url],
    });
  }

  // Check for multiple canonicals
  const canonicalCount = $('link[rel="canonical"]').length;
  if (canonicalCount > 1) {
    issues.push({
      ...ISSUE_DEFINITIONS.MULTIPLE_CANONICALS,
      affectedUrls: [url],
      details: { count: canonicalCount },
    });
  }

  // ==================== H1 CHECKS ====================
  if (h1s.length === 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.H1_MISSING,
      affectedUrls: [url],
    });
  } else if (h1s.length > 1) {
    issues.push({
      ...ISSUE_DEFINITIONS.H1_MULTIPLE,
      affectedUrls: [url],
      details: { h1s, count: h1s.length },
    });
  }

  // Check if H1 duplicates title
  if (h1s.length === 1 && title && h1s[0].toLowerCase() === title.toLowerCase()) {
    issues.push({
      ...ISSUE_DEFINITIONS.H1_DUPLICATE_OF_TITLE,
      affectedUrls: [url],
      details: { h1: h1s[0], title },
    });
  }

  // Check for missing H2 tags (important for content structure)
  const h2Count = headings.filter(h => h.level === 2).length;
  if (h2Count === 0 && wordCount > 100) {
    // Only warn if there's enough content to warrant H2 headings
    issues.push({
      code: 'H2_MISSING',
      severity: 'warning',
      category: 'on-page',
      title: 'No H2 headings found',
      description: 'No H2 tags were found on the page. H2 headings help structure content and improve readability.',
      impact: 'Without H2 headings, search engines and users may find it harder to understand content structure. H2s are important for featuring in search results.',
      howToFix: 'Break your content into logical sections using H2 headings. Include relevant keywords naturally in your H2 tags.',
      affectedUrls: [url],
    });
  }

  // Check heading hierarchy
  let previousLevel = 0;
  for (const heading of headings) {
    if (heading.level > previousLevel + 1 && previousLevel > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.HEADING_SKIP,
        affectedUrls: [url],
        details: { from: previousLevel, to: heading.level },
      });
      break; // Only report once
    }
    previousLevel = heading.level;
  }

  // ==================== CONTENT CHECKS ====================
  if (wordCount < 300) {
    issues.push({
      ...ISSUE_DEFINITIONS.THIN_CONTENT,
      affectedUrls: [url],
      details: { wordCount },
    });
  }

  if (textToHtmlRatio < 10) {
    issues.push({
      ...ISSUE_DEFINITIONS.LOW_TEXT_HTML_RATIO,
      affectedUrls: [url],
      details: { ratio: textToHtmlRatio.toFixed(1) + '%' },
    });
  }

  // ==================== NOINDEX CHECK ====================
  // Noindex on the site root takes the whole site out of search - that's an
  // error, not an FYI. Elsewhere it may be deliberate (thank-you pages,
  // search results), so it's a warning.
  const root = options.auditRoot ?? isSiteRoot(url);
  if (metaNoindex) {
    issues.push({
      ...ISSUE_DEFINITIONS.NOINDEX_TAG,
      severity: root ? 'error' : 'warning',
      affectedUrls: [url],
      details: { metaRobots: robotsMetaValues.join(', '), siteRoot: root },
    });
  }
  if (headerNoindex) {
    let preview = false;
    try {
      preview = isPreviewDeploymentHost(new URL(url).hostname);
    } catch { /* invalid URL - treat as not a preview */ }
    issues.push({
      ...ISSUE_DEFINITIONS.NOINDEX_HEADER,
      severity: preview ? 'notice' : root ? 'error' : 'warning',
      ...(preview && {
        description: `${ISSUE_DEFINITIONS.NOINDEX_HEADER.description} This host is a preview-deployment domain (Vercel, Netlify or Cloudflare Pages), which adds this header to non-production deployments automatically - your production domain won't send it.`,
      }),
      affectedUrls: [url],
      details: { xRobotsTag: headerLookup, siteRoot: root, previewHost: preview },
    });
  }

  return { issues, data };
}
