/**
 * Bing Optimization Checks
 *
 * ChatGPT Search uses Bing's index, making Bing optimization crucial for AI search visibility.
 * These checks verify Bing-specific optimizations that improve AI search presence.
 */

import * as cheerio from 'cheerio';
import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';
import { lookupSiteVerification } from './site-verification.js';
import { detectAddresses } from './local-seo.js';

export interface BingOptimizationData {
  hasBingSiteAuth: boolean;
  hasBingMetaTag: boolean;
  /** An MS=... TXT record on the domain. */
  hasBingDnsRecord: boolean;
  /** Whether the domain's DNS TXT records could be read (not in Deno, offline, or on a timeout). */
  dnsChecked: boolean;
  hasBingIndexNowKey: boolean;
  bingPlacesDetected: boolean;
  bingSitemapAccessible: boolean;
  issues: string[];
}

export async function analyzeBingOptimization(
  html: string,
  url: string
): Promise<{ issues: AuditIssue[]; data: BingOptimizationData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const parsedUrl = new URL(url);
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
  const detectedIssues: string[] = [];

  // Check for Bing site verification meta tag
  const bingMetaTag = $('meta[name="msvalidate.01"]').attr('content');
  const hasBingMetaTag = !!bingMetaTag && bingMetaTag.length > 0;

  // BingSiteAuth.xml and the DNS TXT record, looked up once per site and shared with the
  // tracking-verification check.
  const verification = await lookupSiteVerification(url);
  const hasBingSiteAuth = verification.bingSiteAuthFile;
  const hasBingDnsRecord = verification.bingDns;

  // Check for IndexNow key file (used by Bing)
  let hasBingIndexNowKey = false;
  try {
    // Common IndexNow key file patterns
    const keyPatterns = [
      `${baseUrl}/indexnow.txt`,
      `${baseUrl}/.well-known/indexnow`,
    ];

    for (const keyUrl of keyPatterns) {
      try {
        const keyResponse = await httpGet(keyUrl, { timeout: 5000 });
        if (keyResponse.status === 200 && keyResponse.data.length >= 8) {
          hasBingIndexNowKey = true;
          break;
        }
      } catch {
        // Continue checking other patterns
      }
    }
  } catch {
    // IndexNow key not found
  }

  // Check for Bing Places indicators in structured data
  const scripts = $('script[type="application/ld+json"]');
  let bingPlacesDetected = false;

  scripts.each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (jsonText) {
        const data = JSON.parse(jsonText);
        const schemas = Array.isArray(data) ? data : [data];

        for (const schema of schemas) {
          // Check for LocalBusiness or Organization with address
          if (schema['@type'] === 'LocalBusiness' ||
              (schema['@type'] === 'Organization' && schema.address)) {
            bingPlacesDetected = true;
          }

          // Check sameAs for Bing Places URL
          if (schema.sameAs) {
            const sameAsUrls = Array.isArray(schema.sameAs) ? schema.sameAs : [schema.sameAs];
            if (sameAsUrls.some((u: string) => u.includes('bing.com/maps'))) {
              bingPlacesDetected = true;
            }
          }
        }
      }
    } catch {
      // Invalid JSON
    }
  });

  // Check if sitemap is accessible (important for Bing indexing)
  let bingSitemapAccessible = false;
  try {
    const sitemapResponse = await httpGet(`${baseUrl}/sitemap.xml`, { timeout: 5000 });
    bingSitemapAccessible = sitemapResponse.status === 200 &&
      sitemapResponse.data.includes('<?xml');
  } catch {
    // Sitemap not accessible
  }

  // Generate issues

  // No Bing verification. Without DNS (Deno, offline) a TXT-verified site looks the same as an
  // unverified one, so the wording only claims what was seen; a site imported from Google
  // Search Console leaves no trace at all, hence the "if not yet".
  if (!hasBingMetaTag && !hasBingSiteAuth && !hasBingDnsRecord) {
    detectedIssues.push('No Bing site verification');
  }

  // No IndexNow for Bing
  if (!hasBingIndexNowKey) {
    detectedIssues.push('No IndexNow key for Bing');
    issues.push({
      code: 'BING_NO_INDEXNOW',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'IndexNow not configured for Bing instant indexing',
      description: 'IndexNow enables instant content indexing by Bing (and subsequently ChatGPT Search). Without it, new content may take longer to appear in AI search results.',
      impact: 'Content updates may be delayed in Bing\'s index and ChatGPT Search results.',
      howToFix: 'Implement IndexNow: 1) Generate an API key, 2) Host the key file at /indexnow.txt or /.well-known/indexnow, 3) Notify Bing of URL changes via the IndexNow API.',
      affectedUrls: [url],
      details: {
        indexNowEndpoint: 'https://www.bing.com/indexnow',
        documentation: 'https://www.indexnow.org/documentation',
      },
    });
  }

  // No sitemap for Bing
  if (!bingSitemapAccessible) {
    detectedIssues.push('Sitemap not accessible');
    issues.push({
      code: 'BING_SITEMAP_MISSING',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'XML sitemap not accessible for Bing crawling',
      description: 'A sitemap helps Bing discover and index all your pages. Without it, some content may not be indexed and thus not appear in ChatGPT Search.',
      impact: 'Bing may miss important pages, reducing your AI search coverage.',
      howToFix: 'Create and submit an XML sitemap: 1) Generate sitemap.xml with all important URLs, 2) Submit it in Bing Webmaster Tools, 3) Reference it in robots.txt.',
      affectedUrls: [url],
    });
  }

  // Local business without Bing Places
  const hasLocalBusinessSchema = bingPlacesDetected;
  // The same address detection as the local SEO check, so this cannot fire on a page that the
  // same report says has no address (it did: "street" and any five-digit number counted).
  const hasAddressOnPage = $('address').text().trim().length > 0 || detectAddresses(html).length > 0;

  if (hasAddressOnPage && !hasLocalBusinessSchema) {
    detectedIssues.push('Local business may not be on Bing Places');
  }

  return {
    issues,
    data: {
      hasBingSiteAuth,
      hasBingMetaTag,
      hasBingDnsRecord,
      dnsChecked: verification.dnsChecked,
      hasBingIndexNowKey,
      bingPlacesDetected,
      bingSitemapAccessible,
      issues: detectedIssues,
    },
  };
}
