// Resource Hints Optimization Checks
// Analyzes dns-prefetch, preconnect, prefetch, preload, modulepreload, and early hints
// Based on advanced performance SEO research

import * as cheerio from 'cheerio';
import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface ResourceHint {
  type: 'dns-prefetch' | 'preconnect' | 'prefetch' | 'preload' | 'modulepreload';
  href: string;
  as?: string;
  crossorigin?: string;
}

export interface ResourceHintsData {
  dnsPrefetch: string[];
  preconnect: string[];
  prefetch: string[];
  preload: ResourceHint[];
  modulepreload: string[];
  thirdPartyDomains: string[];
  missingPreconnects: string[];
  earlyHints: boolean;
  http2Push: boolean;
}

/**
 * Extract all resource hints from HTML
 */
export function extractResourceHints(html: string): ResourceHint[] {
  const $ = cheerio.load(html);
  const hints: ResourceHint[] = [];

  // dns-prefetch
  $('link[rel="dns-prefetch"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hints.push({ type: 'dns-prefetch', href });
    }
  });

  // preconnect
  $('link[rel="preconnect"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hints.push({
        type: 'preconnect',
        href,
        crossorigin: $(el).attr('crossorigin'),
      });
    }
  });

  // prefetch
  $('link[rel="prefetch"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hints.push({
        type: 'prefetch',
        href,
        as: $(el).attr('as'),
      });
    }
  });

  // preload
  $('link[rel="preload"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hints.push({
        type: 'preload',
        href,
        as: $(el).attr('as'),
        crossorigin: $(el).attr('crossorigin'),
      });
    }
  });

  // modulepreload
  $('link[rel="modulepreload"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hints.push({ type: 'modulepreload', href });
    }
  });

  return hints;
}

/**
 * Detect third-party domains used on the page
 */
export function detectThirdPartyDomains(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const baseDomain = new URL(pageUrl).hostname;
  const domains = new Set<string>();

  // Check scripts
  $('script[src]').each((_, el) => {
    try {
      const src = $(el).attr('src')!;
      const url = new URL(src, pageUrl);
      if (url.hostname !== baseDomain) {
        domains.add(url.origin);
      }
    } catch {
      // Invalid URL
    }
  });

  // Check stylesheets
  $('link[rel="stylesheet"][href]').each((_, el) => {
    try {
      const href = $(el).attr('href')!;
      const url = new URL(href, pageUrl);
      if (url.hostname !== baseDomain) {
        domains.add(url.origin);
      }
    } catch {
      // Invalid URL
    }
  });

  // Check images
  $('img[src]').each((_, el) => {
    try {
      const src = $(el).attr('src')!;
      const url = new URL(src, pageUrl);
      if (url.hostname !== baseDomain) {
        domains.add(url.origin);
      }
    } catch {
      // Invalid URL
    }
  });

  // Check fonts (from @font-face in style tags - simplified)
  const styleContent = $('style').text();
  const fontUrlMatches = styleContent.match(/url\(['"]?(https?:\/\/[^'")\s]+)/g) || [];
  for (const match of fontUrlMatches) {
    try {
      const url = match.replace(/url\(['"]?/, '');
      const parsed = new URL(url);
      if (parsed.hostname !== baseDomain) {
        domains.add(parsed.origin);
      }
    } catch {
      // Invalid URL
    }
  }

  return [...domains];
}

/**
 * Common third-party services that should have preconnect
 */
const CRITICAL_THIRD_PARTIES: Record<string, string[]> = {
  'fonts.googleapis.com': ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
  'fonts.gstatic.com': ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
  'www.google-analytics.com': ['https://www.google-analytics.com'],
  'www.googletagmanager.com': ['https://www.googletagmanager.com'],
  'cdn.jsdelivr.net': ['https://cdn.jsdelivr.net'],
  'unpkg.com': ['https://unpkg.com'],
  'cdnjs.cloudflare.com': ['https://cdnjs.cloudflare.com'],
  'ajax.googleapis.com': ['https://ajax.googleapis.com'],
  'connect.facebook.net': ['https://connect.facebook.net'],
  'platform.twitter.com': ['https://platform.twitter.com'],
  'www.youtube.com': ['https://www.youtube.com', 'https://i.ytimg.com'],
  'player.vimeo.com': ['https://player.vimeo.com'],
  'js.stripe.com': ['https://js.stripe.com'],
};

/**
 * Find missing preconnects for critical third-party resources
 */
export function findMissingPreconnects(
  thirdPartyDomains: string[],
  existingHints: ResourceHint[]
): string[] {
  const preconnected = new Set(
    existingHints
      .filter((h) => h.type === 'preconnect' || h.type === 'dns-prefetch')
      .map((h) => {
        try {
          return new URL(h.href).origin;
        } catch {
          return h.href;
        }
      })
  );

  const missing: string[] = [];

  for (const domain of thirdPartyDomains) {
    try {
      const hostname = new URL(domain).hostname;
      const recommended = CRITICAL_THIRD_PARTIES[hostname] || [domain];

      for (const rec of recommended) {
        if (!preconnected.has(rec)) {
          missing.push(rec);
        }
      }
    } catch {
      // Invalid URL
    }
  }

  return [...new Set(missing)];
}

/**
 * Check for HTTP/2 Server Push and 103 Early Hints
 */
export async function checkAdvancedHints(
  url: string
): Promise<{ earlyHints: boolean; http2Push: boolean; linkHeaders: string[] }> {
  try {
    const response = await httpGet<string>(url, {
      
      timeout: 10000,
      validateStatus: () => true,
      // Note: fetch doesn't expose HTTP/2 details natively, this is simplified
    });

    const linkHeader = response.headers['link'] || '';
    const linkHeaders = Array.isArray(linkHeader) ? linkHeader : [linkHeader];

    // Check for preload hints in Link header
    const hasPreloadLinks = linkHeaders.some(
      (h) => h.includes('rel=preload') || h.includes("rel='preload'") || h.includes('rel="preload"')
    );

    return {
      earlyHints: false, // Would need special handling to detect 103
      http2Push: hasPreloadLinks,
      linkHeaders: linkHeaders.filter(Boolean),
    };
  } catch {
    return { earlyHints: false, http2Push: false, linkHeaders: [] };
  }
}

/**
 * Analyze preload usage for critical resources
 */
export function analyzePreloads(
  html: string,
  preloads: ResourceHint[]
): { missing: string[]; unused: string[] } {
  const $ = cheerio.load(html);
  const criticalResources: string[] = [];

  // LCP image candidates (large hero images)
  $('img').each((i, el) => {
    if (i === 0) {
      // First image is often LCP
      const src = $(el).attr('src');
      if (src) criticalResources.push(src);
    }
  });

  // Critical fonts
  $('link[rel="stylesheet"][href*="font"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) criticalResources.push(href);
  });

  // Check for missing preloads
  const preloadedUrls = new Set(preloads.map((p) => p.href));
  const missing = criticalResources.filter((r) => !preloadedUrls.has(r));

  // Check for unused preloads (preloaded but not used)
  // This would need runtime analysis, so we'll do a basic check
  const pageContent = $.html();
  const unused = preloads
    .map((p) => p.href)
    .filter((href) => !pageContent.includes(href.split('/').pop() || ''));

  return { missing: missing.slice(0, 3), unused };
}

/**
 * Main function: Analyze resource hints optimization
 */
export function analyzeResourceHints(
  html: string,
  url: string
): { issues: AuditIssue[]; data: ResourceHintsData } {
  const issues: AuditIssue[] = [];

  const hints = extractResourceHints(html);
  const thirdPartyDomains = detectThirdPartyDomains(html, url);
  const missingPreconnects = findMissingPreconnects(thirdPartyDomains, hints);

  const dnsPrefetch = hints.filter((h) => h.type === 'dns-prefetch').map((h) => h.href);
  const preconnect = hints.filter((h) => h.type === 'preconnect').map((h) => h.href);
  const prefetch = hints.filter((h) => h.type === 'prefetch').map((h) => h.href);
  const preload = hints.filter((h) => h.type === 'preload');
  const modulepreload = hints.filter((h) => h.type === 'modulepreload').map((h) => h.href);

  // Check for missing preconnects
  if (missingPreconnects.length > 0) {
    issues.push({
      code: 'MISSING_PRECONNECT',
      severity: 'warning',
      category: 'performance',
      title: 'Missing preconnect hints for third-party origins',
      description: `${missingPreconnects.length} third-party origins used without preconnect hints.`,
      impact: 'Connection setup to third-party origins adds latency to resource loading.',
      howToFix: `Add preconnect hints: ${missingPreconnects.slice(0, 3).map((d) => `<link rel="preconnect" href="${d}">`).join(' ')}`,
      affectedUrls: [url],
      details: { missingPreconnects: missingPreconnects.slice(0, 5) },
    });
  }

  // Check if Google Fonts are used without proper hints
  const usesGoogleFonts = thirdPartyDomains.some(
    (d) => d.includes('fonts.googleapis.com') || d.includes('fonts.gstatic.com')
  );
  const hasGoogleFontsPreconnect =
    preconnect.some((h) => h.includes('fonts.googleapis.com')) &&
    preconnect.some((h) => h.includes('fonts.gstatic.com'));

  if (usesGoogleFonts && !hasGoogleFontsPreconnect) {
    issues.push({
      code: 'GOOGLE_FONTS_NO_PRECONNECT',
      severity: 'warning',
      category: 'performance',
      title: 'Google Fonts without preconnect',
      description: 'Google Fonts are used but preconnect hints are missing.',
      impact: 'Adds significant latency to font loading, affecting LCP.',
      howToFix:
        'Add: <link rel="preconnect" href="https://fonts.googleapis.com"> and <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      affectedUrls: [url],
    });
  }

  // Check for LCP image preload
  const $ = cheerio.load(html);
  const hasHeroImage = $('img').first().length > 0;
  const hasImagePreload = preload.some((p) => p.as === 'image');

  if (hasHeroImage && !hasImagePreload) {
    issues.push({
      code: 'HERO_IMAGE_NOT_PRELOADED',
      severity: 'notice',
      category: 'performance',
      title: 'Hero image not preloaded',
      description: 'Page has images but none are preloaded for faster LCP.',
      impact: 'Preloading LCP images can improve Largest Contentful Paint.',
      howToFix: 'Add <link rel="preload" href="hero-image.jpg" as="image"> for your LCP image.',
      affectedUrls: [url],
    });
  }

  // Check for critical CSS preload
  const hasRenderBlockingCSS =
    $('link[rel="stylesheet"]').filter((_, el) => !$(el).attr('media') || $(el).attr('media') === 'all').length > 0;
  const hasCSSPreload = preload.some((p) => p.as === 'style');

  if (hasRenderBlockingCSS && !hasCSSPreload && preload.length === 0) {
    issues.push({
      code: 'NO_CRITICAL_RESOURCE_PRELOAD',
      severity: 'notice',
      category: 'performance',
      title: 'No critical resources preloaded',
      description: 'Page has render-blocking resources but no preload hints.',
      impact: 'Preloading critical resources can improve initial render time.',
      howToFix: 'Consider preloading critical CSS, fonts, or hero images.',
      affectedUrls: [url],
    });
  }

  // Check for excessive preloads (can hurt performance)
  if (preload.length > 10) {
    issues.push({
      code: 'EXCESSIVE_PRELOADS',
      severity: 'warning',
      category: 'performance',
      title: 'Too many preload hints',
      description: `Page has ${preload.length} preload hints, which can degrade performance.`,
      impact: 'Preloading too many resources competes for bandwidth and can delay critical resources.',
      howToFix: 'Limit preloads to truly critical resources (2-5 maximum).',
      affectedUrls: [url],
    });
  }

  // Check for modulepreload for ES modules
  const hasESModules = $('script[type="module"]').length > 0;
  if (hasESModules && modulepreload.length === 0) {
    issues.push({
      code: 'ES_MODULES_NO_MODULEPRELOAD',
      severity: 'notice',
      category: 'performance',
      title: 'ES modules without modulepreload',
      description: 'Page uses ES modules but no modulepreload hints are present.',
      impact: 'Modulepreload can parallelize module loading for faster execution.',
      howToFix: 'Add <link rel="modulepreload" href="critical-module.js"> for critical modules.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      dnsPrefetch,
      preconnect,
      prefetch,
      preload,
      modulepreload,
      thirdPartyDomains,
      missingPreconnects,
      earlyHints: false,
      http2Push: false,
    },
  };
}
