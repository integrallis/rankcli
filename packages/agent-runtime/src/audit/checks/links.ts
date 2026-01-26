import * as cheerio from 'cheerio';
import { httpHead } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface LinkData {
  internal: { href: string; text: string; nofollow: boolean }[];
  external: { href: string; text: string; nofollow: boolean }[];
  totalLinks: number;
  brokenInternal: string[];
  brokenExternal: string[];
  jsOnlyNavigation: { element: string; text: string; reason: string }[];
  ratio: {
    internal: number;
    external: number;
    internalToExternalRatio: number | null; // null if no external links
  };
}

export async function analyzeLinks(
  html: string,
  baseUrl: string,
  checkBroken: boolean = false
): Promise<{ issues: AuditIssue[]; data: LinkData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const baseHostname = new URL(baseUrl).hostname;

  const internal: LinkData['internal'] = [];
  const external: LinkData['external'] = [];
  const brokenInternal: string[] = [];
  const brokenExternal: string[] = [];
  const jsOnlyNavigation: LinkData['jsOnlyNavigation'] = [];

  // Extract all links
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const rel = $(el).attr('rel') || '';
    const nofollow = rel.includes('nofollow');

    // Skip javascript:, mailto:, tel:, and anchor links
    if (href.startsWith('javascript:') || href.startsWith('mailto:') ||
        href.startsWith('tel:') || href.startsWith('#')) {
      return;
    }

    try {
      const fullUrl = new URL(href, baseUrl).href;
      const linkHostname = new URL(fullUrl).hostname;
      const isInternal = linkHostname === baseHostname;

      if (isInternal) {
        internal.push({ href: fullUrl, text, nofollow });
        if (nofollow) {
          issues.push({
            ...ISSUE_DEFINITIONS.NOFOLLOW_INTERNAL,
            affectedUrls: [baseUrl],
            details: { link: fullUrl, anchorText: text },
          });
        }
      } else {
        external.push({ href: fullUrl, text, nofollow });
      }
    } catch {
      // Invalid URL, skip
    }
  });

  const totalLinks = internal.length + external.length;

  // Check for JavaScript-only navigation
  // Look for elements with onClick that appear to be navigation
  const navPatterns = /navigate|router|history\.push|location\.href|window\.location|goto|redirect/i;
  const navTextPatterns = /^(home|about|contact|pricing|blog|docs|features|products?|services?|sign\s*up|log\s*in|register|dashboard|account|settings|help|faq|support|menu|nav)$/i;

  // Check buttons and other elements with onClick
  $('button[onclick], div[onclick], span[onclick], li[onclick]').each((_, el) => {
    const $el = $(el);
    const onclick = $el.attr('onclick') || '';
    const text = $el.text().trim().substring(0, 50);

    // Check if onClick contains navigation-like code
    if (navPatterns.test(onclick) || navTextPatterns.test(text)) {
      jsOnlyNavigation.push({
        element: el.tagName.toLowerCase(),
        text: text || '(no text)',
        reason: 'Element uses onClick for navigation instead of <a href>',
      });
    }
  });

  // Check <a> tags with non-functional href but onClick (common anti-pattern)
  $('a[onclick]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const onclick = $el.attr('onclick') || '';
    const text = $el.text().trim().substring(0, 50);

    // href="#" or "javascript:" with onClick is a red flag
    if ((href === '#' || href === '' || href.startsWith('javascript:')) && onclick) {
      jsOnlyNavigation.push({
        element: 'a',
        text: text || '(no text)',
        reason: `Link has href="${href}" with onClick - crawlers cannot follow this`,
      });
    }
  });

  // Check for React/Vue patterns in inline scripts (data-* attributes often used)
  $('[data-href], [data-to], [data-link], [data-route]').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();
    const text = $el.text().trim().substring(0, 50);

    // If it's not an <a> tag with a real href, it's JS-only navigation
    if (tagName !== 'a' || !$el.attr('href') || $el.attr('href') === '#') {
      jsOnlyNavigation.push({
        element: tagName,
        text: text || '(no text)',
        reason: 'Uses data attribute for routing instead of real href',
      });
    }
  });

  // Report JS-only navigation issues (deduplicated, limit to 10)
  if (jsOnlyNavigation.length > 0) {
    const uniqueNav = jsOnlyNavigation.slice(0, 10);
    issues.push({
      ...ISSUE_DEFINITIONS.JS_ONLY_NAVIGATION,
      affectedUrls: [baseUrl],
      details: {
        count: jsOnlyNavigation.length,
        examples: uniqueNav,
      },
    });
  }

  // Calculate link ratio
  const internalCount = internal.length;
  const externalCount = external.length;
  const internalToExternalRatio = externalCount > 0 ? internalCount / externalCount : null;

  // Check for too many links
  if (totalLinks > 100) {
    issues.push({
      ...ISSUE_DEFINITIONS.TOO_MANY_LINKS,
      affectedUrls: [baseUrl],
      details: { totalLinks, internal: internalCount, external: externalCount },
    });
  }

  // Check for no internal links (bad for crawlability and user navigation)
  if (internalCount === 0 && totalLinks > 0) {
    issues.push({
      code: 'LINKS_NO_INTERNAL',
      severity: 'warning',
      category: 'links',
      title: 'No internal links found',
      description: 'This page has no internal links to other pages on your site.',
      impact: 'Internal links are crucial for SEO. They help search engines discover pages and distribute link equity throughout your site.',
      howToFix: 'Add relevant internal links to related content, navigation, or related articles section.',
      affectedUrls: [baseUrl],
      details: { totalLinks, external: externalCount },
    });
  }

  // Check for no external links (pages should reference external resources)
  if (externalCount === 0 && totalLinks > 5) {
    issues.push({
      code: 'LINKS_NO_EXTERNAL',
      severity: 'notice',
      category: 'links',
      title: 'No external links found',
      description: 'This page has no links to external websites.',
      impact: 'Linking to high-quality external sources can improve credibility and help search engines understand your content context.',
      howToFix: 'Add links to authoritative external sources that support your content. This builds trust and provides value to readers.',
      affectedUrls: [baseUrl],
      details: { totalLinks, internal: internalCount },
    });
  }

  // Check for poor internal-to-external ratio (too many external vs internal)
  if (externalCount > internalCount && externalCount > 5 && internalCount < 3) {
    issues.push({
      code: 'LINKS_RATIO_POOR',
      severity: 'warning',
      category: 'links',
      title: 'Poor internal-to-external link ratio',
      description: `Page has ${externalCount} external links but only ${internalCount} internal links.`,
      impact: 'A healthy page should have more internal links than external links. Too many external links can dilute page authority and may look spammy.',
      howToFix: 'Add more relevant internal links to balance the ratio. Aim for at least 2-3 internal links for every external link.',
      affectedUrls: [baseUrl],
      details: {
        internal: internalCount,
        external: externalCount,
        ratio: internalToExternalRatio ? `1:${(1/internalToExternalRatio).toFixed(1)}` : 'N/A',
        recommendation: 'Aim for a ratio of at least 2:1 (internal:external)',
      },
    });
  }

  // Check for broken links (limited to avoid too many requests)
  if (checkBroken) {
    // Check internal links (up to 10)
    const internalToCheck = internal.slice(0, 10);
    for (const link of internalToCheck) {
      try {
        const response = await httpHead(link.href, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        if (response.status >= 400) {
          brokenInternal.push(link.href);
        }
      } catch {
        brokenInternal.push(link.href);
      }
    }

    // Check external links (up to 5)
    const externalToCheck = external.slice(0, 5);
    for (const link of externalToCheck) {
      try {
        const response = await httpHead(link.href, {
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        if (response.status >= 400) {
          brokenExternal.push(link.href);
        }
      } catch {
        // Don't count timeouts as broken for external links
      }
    }

    // Add issues for broken links
    for (const brokenLink of brokenInternal) {
      issues.push({
        ...ISSUE_DEFINITIONS.BROKEN_INTERNAL_LINK,
        affectedUrls: [baseUrl],
        details: { brokenLink },
      });
    }

    for (const brokenLink of brokenExternal) {
      issues.push({
        ...ISSUE_DEFINITIONS.BROKEN_EXTERNAL_LINK,
        affectedUrls: [baseUrl],
        details: { brokenLink },
      });
    }
  }

  return {
    issues,
    data: {
      internal,
      external,
      totalLinks,
      brokenInternal,
      brokenExternal,
      jsOnlyNavigation,
      ratio: {
        internal: internalCount,
        external: externalCount,
        internalToExternalRatio,
      },
    }
  };
}
