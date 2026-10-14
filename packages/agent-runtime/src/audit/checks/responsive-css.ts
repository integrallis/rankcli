/**
 * Responsive CSS Check
 *
 * Checks if the site uses responsive design through CSS media queries.
 * Responsive design is essential for:
 * - Mobile-first indexing (Google uses mobile version for ranking)
 * - User experience across devices
 * - Core Web Vitals on mobile
 *
 * Detection methods:
 * - @media queries in inline styles
 * - @media queries in linked stylesheets
 * - Viewport meta tag (required for responsiveness)
 *
 * A Vite, Next.js or Tailwind site keeps every rule in an external stylesheet, so the page
 * itself has no @media at all. The verdict therefore rests on the stylesheets, and when they
 * cannot all be read (cross-origin, a failed fetch, more than the limit) the check says nothing:
 * silence beats telling a Tailwind site it is not responsive.
 */

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface ResponsiveCssData {
  hasViewport: boolean;
  viewportContent?: string;
  hasMediaQueries: boolean;
  mediaQueryCount: number;
  mediaQuerySources: {
    inline: number;
    external: string[];
  };
  /** @media, @container or fluid sizing (clamp/min/max) anywhere in the CSS that was read. */
  hasResponsiveSignals: boolean;
  /** Every linked stylesheet was same-origin, within the limit, and fetched. */
  stylesheetsCovered: boolean;
  breakpoints: string[];
  hasMobileBreakpoint: boolean;
  hasTabletBreakpoint: boolean;
  hasDesktopBreakpoint: boolean;
}

const MAX_STYLESHEETS = 3;
const MAX_STYLESHEET_BYTES = 1024 * 1024;
const STYLESHEET_TIMEOUT_MS = 3000;

/**
 * CSS that adapts to the viewport. @media is the classic signal; container queries and fluid
 * sizing are the modern ones, and a site can be responsive on those alone.
 */
const RESPONSIVE_SIGNAL = /@media\b|@container\b|\bclamp\(|(?<![\w-])(?:min|max)\(/i;

/**
 * Extract media queries from CSS content
 */
function extractMediaQueries(css: string): string[] {
  const mediaQueries: string[] = [];
  // Match @media queries
  const regex = /@media\s*([^{]+)/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    mediaQueries.push(match[1].trim());
  }
  return mediaQueries;
}

// min-width: 640px, max-width: 48em, and the range form Tailwind v4 emits: (width >= 40rem).
const WIDTH_RULE =
  /(?:(?:min|max)-width\s*:|width\s*(?:<=|>=|<|>))\s*(\d+(?:\.\d+)?)\s*(px|em|rem)?|(\d+(?:\.\d+)?)\s*(px|em|rem)?\s*(?:<=|>=|<|>)\s*width/gi;

/**
 * Classify breakpoints
 */
function classifyBreakpoints(mediaQueries: string[]): {
  hasMobile: boolean;
  hasTablet: boolean;
  hasDesktop: boolean;
  breakpoints: string[];
} {
  const breakpoints = new Set<string>();
  let hasMobile = false;
  let hasTablet = false;
  let hasDesktop = false;

  for (const query of mediaQueries) {
    // Check for print media (not responsive but valid)
    if (/print/i.test(query)) {
      continue; // Don't count print as responsive
    }

    // Extract width values from media queries, in px (em and rem taken at the 16px default)
    for (const match of query.matchAll(WIDTH_RULE)) {
      const raw = match[1] ?? match[3];
      const unit = (match[2] ?? match[4] ?? 'px').toLowerCase();
      const value = Math.round(parseFloat(raw) * (unit === 'px' ? 1 : 16));
      breakpoints.add(`${value}px`);

      // Classify breakpoint
      if (value <= 480) {
        hasMobile = true;
      } else if (value <= 768) {
        hasMobile = true; // Small tablet / large phone
      } else if (value <= 1024) {
        hasTablet = true;
      } else {
        hasDesktop = true;
      }
    }
  }

  return {
    hasMobile,
    hasTablet,
    hasDesktop,
    breakpoints: Array.from(breakpoints).sort((a, b) => parseInt(a) - parseInt(b)),
  };
}

/**
 * Analyze responsive CSS
 */
export async function analyzeResponsiveCss(
  html: string,
  url: string
): Promise<{ issues: AuditIssue[]; data: ResponsiveCssData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  // Check viewport meta tag
  const viewportMeta = $('meta[name="viewport"]').attr('content');
  const hasViewport = !!viewportMeta;

  // Collect all media queries
  const allMediaQueries: string[] = [];
  const externalSources: string[] = [];
  let inlineCount = 0;
  let hasResponsiveSignals = false;

  // Check inline styles
  $('style').each((_, el) => {
    const css = $(el).text();
    const queries = extractMediaQueries(css);
    if (queries.length > 0) {
      allMediaQueries.push(...queries);
      inlineCount += queries.length;
    }
    if (RESPONSIVE_SIGNAL.test(css)) hasResponsiveSignals = true;
  });

  // Linked stylesheets: same-origin ones can be read, the rest only counted. rel can carry more
  // than one token ("stylesheet preload").
  const sameOrigin: string[] = [];
  let crossOrigin = 0;
  $('link[rel][href]').each((_, el) => {
    if (!/\bstylesheet\b/i.test($(el).attr('rel') ?? '')) return;
    const href = $(el).attr('href');
    if (!href || href.startsWith('data:')) return;
    try {
      const resolved = new URL(href, url);
      if (resolved.hostname === baseUrl.hostname) sameOrigin.push(resolved.href);
      else crossOrigin++;
    } catch {
      crossOrigin++; // unreadable either way
    }
  });

  // Fetch the first few in parallel, each with a short timeout and a size cap
  let fetchFailed = 0;
  await Promise.all(
    sameOrigin.slice(0, MAX_STYLESHEETS).map(async (cssUrl) => {
      try {
        const response = await httpGet<string>(cssUrl, {
          timeout: STYLESHEET_TIMEOUT_MS,
          maxBytes: MAX_STYLESHEET_BYTES,
        });
        if (typeof response.data !== 'string') throw new Error('not text');
        const queries = extractMediaQueries(response.data);
        if (queries.length > 0) allMediaQueries.push(...queries);
        if (RESPONSIVE_SIGNAL.test(response.data)) {
          hasResponsiveSignals = true;
          externalSources.push(cssUrl);
        }
      } catch {
        fetchFailed++;
      }
    })
  );

  const stylesheetsCovered = crossOrigin === 0 && fetchFailed === 0 && sameOrigin.length <= MAX_STYLESHEETS;
  const hasMediaQueries = allMediaQueries.length > 0;
  const { hasMobile, hasTablet, hasDesktop, breakpoints } = classifyBreakpoints(allMediaQueries);

  // Generate issues
  if (!hasViewport) {
    issues.push({
      code: 'RESPONSIVE_NO_VIEWPORT',
      severity: 'error',
      category: 'mobile',
      title: 'Missing viewport meta tag',
      description: 'No viewport meta tag found. This is required for responsive design to work properly.',
      impact:
        'Without a viewport meta tag, mobile browsers will render the page at desktop width and scale down, making it unusable.',
      howToFix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> section.',
      affectedUrls: [url],
    });
  }

  if (!hasResponsiveSignals && stylesheetsCovered) {
    issues.push({
      code: 'RESPONSIVE_NO_MEDIA_QUERIES',
      severity: 'warning',
      category: 'mobile',
      title: 'No CSS media queries detected',
      description: 'No @media or @container queries and no fluid sizing (clamp, min, max) found in inline styles or first-party stylesheets.',
      impact:
        'Without media queries, the site likely uses fixed layouts that do not adapt to different screen sizes. This hurts mobile usability and SEO.',
      howToFix:
        'Add CSS media queries to adapt layout for different screen sizes. Consider using a mobile-first approach with min-width breakpoints.',
      affectedUrls: [url],
      details: {
        suggestion: 'Common breakpoints: 480px (mobile), 768px (tablet), 1024px (desktop)',
        stylesheetsScanned: sameOrigin.length,
      },
    });
  } else if (hasMediaQueries && !hasMobile && !hasTablet) {
    issues.push({
      code: 'RESPONSIVE_NO_MOBILE_BREAKPOINT',
      severity: 'warning',
      category: 'mobile',
      title: 'No mobile breakpoints detected',
      description: `Found ${allMediaQueries.length} media queries but none target mobile screen sizes (≤768px).`,
      impact:
        'Site may not be optimized for mobile devices, which affects majority of web traffic and Google mobile-first indexing.',
      howToFix:
        'Add media queries for mobile devices. Example: @media (max-width: 768px) { ... } or use min-width for mobile-first.',
      affectedUrls: [url],
      details: {
        detectedBreakpoints: breakpoints,
      },
    });
  }

  return {
    issues,
    data: {
      hasViewport,
      viewportContent: viewportMeta,
      hasMediaQueries,
      mediaQueryCount: allMediaQueries.length,
      mediaQuerySources: {
        inline: inlineCount,
        external: externalSources,
      },
      hasResponsiveSignals,
      stylesheetsCovered,
      breakpoints,
      hasMobileBreakpoint: hasMobile,
      hasTabletBreakpoint: hasTablet,
      hasDesktopBreakpoint: hasDesktop,
    },
  };
}
