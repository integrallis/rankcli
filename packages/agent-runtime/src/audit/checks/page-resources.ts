/**
 * Page Resources Check (Page Objects Analysis)
 *
 * Analyzes the number and types of embedded resources on a page.
 * Too many HTTP requests slow down page load significantly due to:
 * - Connection overhead (DNS, TCP, TLS)
 * - Browser connection limits per domain
 * - Render blocking
 *
 * Best practices:
 * - Keep total requests under 50 for optimal performance
 * - Minimize third-party resources
 * - Combine/bundle CSS and JS where possible
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface PageResourcesData {
  total: number;
  byType: {
    stylesheets: number;
    scripts: number;
    images: number;
    fonts: number;
    iframes: number;
    other: number;
  };
  byOrigin: {
    firstParty: number;
    thirdParty: number;
  };
  thirdPartyDomains: string[];
  details: {
    stylesheets: string[];
    scripts: string[];
    images: string[];
    fonts: string[];
    iframes: string[];
  };
}

/**
 * Analyze page resources
 */
export function analyzePageResources(html: string, url: string): { issues: AuditIssue[]; data: PageResourcesData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);
  const baseHostname = baseUrl.hostname;

  const stylesheets: string[] = [];
  const scripts: string[] = [];
  const images: string[] = [];
  const fonts: string[] = [];
  const iframes: string[] = [];
  const thirdPartyDomains = new Set<string>();

  let firstParty = 0;
  let thirdParty = 0;

  /**
   * Check if URL is first-party
   */
  function isFirstParty(resourceUrl: string): boolean {
    try {
      const resourceHostname = new URL(resourceUrl, url).hostname;
      // Consider same domain or subdomains as first-party
      return resourceHostname === baseHostname || resourceHostname.endsWith(`.${baseHostname}`);
    } catch {
      return true; // Relative URLs are first-party
    }
  }

  /**
   * Track resource origin
   */
  function trackOrigin(resourceUrl: string): void {
    if (isFirstParty(resourceUrl)) {
      firstParty++;
    } else {
      thirdParty++;
      try {
        const domain = new URL(resourceUrl, url).hostname;
        thirdPartyDomains.add(domain);
      } catch {
        // Invalid URL
      }
    }
  }

  // Extract stylesheets
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('data:')) {
      stylesheets.push(href);
      trackOrigin(href);
    }
  });

  // Extract scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) {
      scripts.push(src);
      trackOrigin(src);
    }
  });

  // Extract images
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) {
      images.push(src);
      trackOrigin(src);
    }
  });

  // Also check srcset for responsive images
  $('img[srcset], source[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (srcset) {
      // Parse srcset - format: "url1 1x, url2 2x" or "url1 300w, url2 600w"
      const urls = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]);
      for (const srcUrl of urls) {
        if (srcUrl && !srcUrl.startsWith('data:') && !images.includes(srcUrl)) {
          images.push(srcUrl);
          trackOrigin(srcUrl);
        }
      }
    }
  });

  // Extract fonts (preloaded or linked)
  $('link[rel="preload"][as="font"], link[href*=".woff"], link[href*=".woff2"], link[href*=".ttf"], link[href*=".otf"]').each(
    (_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('data:')) {
        fonts.push(href);
        trackOrigin(href);
      }
    }
  );

  // Extract iframes
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('about:') && !src.startsWith('javascript:')) {
      iframes.push(src);
      trackOrigin(src);
    }
  });

  // Calculate other resources (preloads, prefetches that aren't already counted)
  let other = 0;
  $('link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"]').each((_, el) => {
    const href = $(el).attr('href');
    const as = $(el).attr('as');
    if (href && !href.startsWith('data:')) {
      // Don't double-count fonts and stylesheets
      if (as !== 'font' && as !== 'style' && !stylesheets.includes(href) && !fonts.includes(href)) {
        other++;
        trackOrigin(href);
      }
    }
  });

  const total = stylesheets.length + scripts.length + images.length + fonts.length + iframes.length + other;

  // Generate issues
  if (total > 100) {
    issues.push({
      code: 'PAGE_RESOURCES_EXCESSIVE',
      severity: 'error',
      category: 'performance',
      title: 'Excessive number of page resources',
      description: `Page requests ${total} resources. This significantly impacts load time due to connection overhead and browser limits.`,
      impact:
        'Too many HTTP requests cause slow page loads, poor Core Web Vitals, and high bounce rates. Each request has DNS, TCP, and TLS overhead.',
      howToFix:
        'Combine CSS/JS files, use image sprites or inline small images, lazy-load non-critical resources, remove unused dependencies.',
      affectedUrls: [url],
      details: {
        total,
        breakdown: {
          stylesheets: stylesheets.length,
          scripts: scripts.length,
          images: images.length,
          fonts: fonts.length,
          iframes: iframes.length,
          other,
        },
        recommendation: 'Aim for under 50 total requests for optimal performance.',
      },
    });
  } else if (total > 50) {
    issues.push({
      code: 'PAGE_RESOURCES_HIGH',
      severity: 'warning',
      category: 'performance',
      title: 'High number of page resources',
      description: `Page requests ${total} resources. Consider reducing for better performance.`,
      impact: 'Many HTTP requests increase page load time, especially on mobile networks.',
      howToFix: 'Bundle CSS/JS files, lazy-load images below the fold, consider critical CSS inlining.',
      affectedUrls: [url],
      details: {
        total,
        breakdown: {
          stylesheets: stylesheets.length,
          scripts: scripts.length,
          images: images.length,
          fonts: fonts.length,
          iframes: iframes.length,
          other,
        },
      },
    });
  }

  // Check third-party resources
  if (thirdParty > 20) {
    issues.push({
      code: 'PAGE_RESOURCES_THIRD_PARTY_HIGH',
      severity: 'warning',
      category: 'performance',
      title: 'Many third-party resources',
      description: `Page loads ${thirdParty} resources from ${thirdPartyDomains.size} third-party domains.`,
      impact:
        'Third-party resources are outside your control and add latency. They can also be a privacy/security concern.',
      howToFix:
        'Self-host critical third-party resources when possible. Use preconnect hints for remaining third-party origins.',
      affectedUrls: [url],
      details: {
        thirdPartyCount: thirdParty,
        domains: Array.from(thirdPartyDomains).slice(0, 10),
      },
    });
  }

  // Check for too many iframes
  if (iframes.length > 3) {
    issues.push({
      code: 'PAGE_RESOURCES_MANY_IFRAMES',
      severity: 'warning',
      category: 'performance',
      title: 'Multiple iframes detected',
      description: `Page contains ${iframes.length} iframes. Each iframe loads its own document and resources.`,
      impact: 'Iframes significantly increase page weight and can block the main thread.',
      howToFix:
        'Lazy-load iframes that are below the fold. Consider native embeds or facade patterns for video/widget iframes.',
      affectedUrls: [url],
      details: {
        iframeCount: iframes.length,
        iframes: iframes.slice(0, 5),
      },
    });
  }

  return {
    issues,
    data: {
      total,
      byType: {
        stylesheets: stylesheets.length,
        scripts: scripts.length,
        images: images.length,
        fonts: fonts.length,
        iframes: iframes.length,
        other,
      },
      byOrigin: {
        firstParty,
        thirdParty,
      },
      thirdPartyDomains: Array.from(thirdPartyDomains),
      details: {
        stylesheets,
        scripts,
        images: images.slice(0, 20), // Limit for data size
        fonts,
        iframes,
      },
    },
  };
}
