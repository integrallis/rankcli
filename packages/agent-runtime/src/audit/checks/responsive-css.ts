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
  breakpoints: string[];
  hasMobileBreakpoint: boolean;
  hasTabletBreakpoint: boolean;
  hasDesktopBreakpoint: boolean;
}

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
    // Extract width values from media queries
    const widthMatches = query.match(/(?:min|max)-width\s*:\s*(\d+)(?:px|em|rem)?/gi);
    if (widthMatches) {
      for (const match of widthMatches) {
        const valueMatch = match.match(/(\d+)/);
        if (valueMatch) {
          const value = parseInt(valueMatch[1], 10);
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
    }

    // Check for common responsive patterns
    if (/screen\s+and/i.test(query)) {
      // Has screen media type - indicates responsive design
    }

    // Check for print media (not responsive but valid)
    if (/print/i.test(query)) {
      continue; // Don't count print as responsive
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

  // Check inline styles
  $('style').each((_, el) => {
    const css = $(el).text();
    const queries = extractMediaQueries(css);
    if (queries.length > 0) {
      allMediaQueries.push(...queries);
      inlineCount += queries.length;
    }
  });

  // Check linked stylesheets (first-party only, limit to 3)
  const cssLinks = $('link[rel="stylesheet"][href]')
    .toArray()
    .slice(0, 3)
    .map((el) => $(el).attr('href'))
    .filter((href): href is string => {
      if (!href || href.startsWith('data:')) return false;
      try {
        const cssHostname = new URL(href, url).hostname;
        return cssHostname === baseUrl.hostname;
      } catch {
        return false;
      }
    });

  // Fetch CSS files in parallel with short timeout
  const cssPromises = cssLinks.map(async (cssUrl) => {
    try {
      const fullUrl = new URL(cssUrl, url).href;
      const response = await httpGet<string>(fullUrl, {
        timeout: 3000, // Reduced timeout
        validateStatus: () => true,
      });

      if (response.status === 200 && typeof response.data === 'string') {
        const queries = extractMediaQueries(response.data);
        if (queries.length > 0) {
          allMediaQueries.push(...queries);
          externalSources.push(cssUrl);
        }
      }
    } catch {
      // Skip failed requests
    }
  });

  // Wait for all CSS checks with overall timeout
  await Promise.race([
    Promise.all(cssPromises),
    new Promise<void>((resolve) => setTimeout(resolve, 6000)), // 6s overall timeout
  ]);

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

  if (!hasMediaQueries) {
    issues.push({
      code: 'RESPONSIVE_NO_MEDIA_QUERIES',
      severity: 'warning',
      category: 'mobile',
      title: 'No CSS media queries detected',
      description: 'No @media queries found in inline styles or first-party stylesheets.',
      impact:
        'Without media queries, the site likely uses fixed layouts that do not adapt to different screen sizes. This hurts mobile usability and SEO.',
      howToFix:
        'Add CSS media queries to adapt layout for different screen sizes. Consider using a mobile-first approach with min-width breakpoints.',
      affectedUrls: [url],
      details: {
        suggestion: 'Common breakpoints: 480px (mobile), 768px (tablet), 1024px (desktop)',
      },
    });
  } else if (!hasMobile && !hasTablet) {
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
      breakpoints,
      hasMobileBreakpoint: hasMobile,
      hasTabletBreakpoint: hasTablet,
      hasDesktopBreakpoint: hasDesktop,
    },
  };
}
