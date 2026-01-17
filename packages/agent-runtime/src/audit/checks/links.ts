import * as cheerio from 'cheerio';
import axios from 'axios';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

const USER_AGENT = 'SEO-Autopilot/1.0 (+https://seo-autopilot.dev)';

export interface LinkData {
  internal: { href: string; text: string; nofollow: boolean }[];
  external: { href: string; text: string; nofollow: boolean }[];
  totalLinks: number;
  brokenInternal: string[];
  brokenExternal: string[];
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

  // Check for too many links
  if (totalLinks > 100) {
    issues.push({
      ...ISSUE_DEFINITIONS.TOO_MANY_LINKS,
      affectedUrls: [baseUrl],
      details: { totalLinks, internal: internal.length, external: external.length },
    });
  }

  // Check for broken links (limited to avoid too many requests)
  if (checkBroken) {
    // Check internal links (up to 10)
    const internalToCheck = internal.slice(0, 10);
    for (const link of internalToCheck) {
      try {
        const response = await axios.head(link.href, {
          headers: { 'User-Agent': USER_AGENT },
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
        const response = await axios.head(link.href, {
          headers: { 'User-Agent': USER_AGENT },
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
    }
  };
}
