/**
 * Bing Optimization Checks
 *
 * ChatGPT Search uses Bing's index, making Bing optimization crucial for AI search visibility.
 * These checks verify Bing-specific optimizations that improve AI search presence.
 */

import * as cheerio from 'cheerio';
import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface BingOptimizationData {
  hasBingSiteAuth: boolean;
  hasBingMetaTag: boolean;
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

  // Check for BingSiteAuth.xml
  let hasBingSiteAuth = false;
  try {
    const authResponse = await httpGet(`${baseUrl}/BingSiteAuth.xml`, { timeout: 5000 });
    hasBingSiteAuth = authResponse.status === 200 &&
      authResponse.data.includes('<?xml') &&
      authResponse.data.toLowerCase().includes('users');
  } catch {
    // File doesn't exist or not accessible
  }

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

  // No Bing verification
  if (!hasBingMetaTag && !hasBingSiteAuth) {
    detectedIssues.push('No Bing site verification');
    issues.push({
      code: 'BING_NOT_VERIFIED',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Site not verified with Bing Webmaster Tools',
      description: 'ChatGPT Search uses Bing\'s index. Verifying your site with Bing Webmaster Tools ensures proper indexing and access to Bing-specific SEO tools.',
      impact: 'May reduce visibility in ChatGPT Search results and miss Bing-specific optimization opportunities.',
      howToFix: 'Add Bing verification: 1) Go to Bing Webmaster Tools, 2) Add your site, 3) Choose verification method (meta tag or XML file), 4) Add the verification code to your site.',
      affectedUrls: [url],
      details: {
        hasBingMetaTag,
        hasBingSiteAuth,
        verificationMethods: [
          'Add <meta name="msvalidate.01" content="YOUR_CODE"> to <head>',
          'Upload BingSiteAuth.xml to root directory',
        ],
      },
    });
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
  const hasAddressOnPage = $('address').length > 0 ||
    html.toLowerCase().includes('street') ||
    /\d{5}(-\d{4})?/.test(html); // ZIP code pattern

  if (hasAddressOnPage && !hasLocalBusinessSchema) {
    detectedIssues.push('Local business may not be on Bing Places');
    issues.push({
      code: 'BING_PLACES_MISSING',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Local business not optimized for Bing Places',
      description: 'Your site appears to have a physical location but may not be listed on Bing Places. Bing Places listings appear in Bing Maps and can be referenced by AI assistants.',
      impact: 'Missing local search visibility in Bing and potential AI assistant recommendations for local queries.',
      howToFix: 'Claim your Bing Places listing: 1) Go to bingplaces.com, 2) Claim or add your business, 3) Verify ownership, 4) Add complete business information.',
      affectedUrls: [url],
      details: {
        bingPlacesUrl: 'https://www.bingplaces.com/',
        recommendation: 'Also add sameAs link to your Bing Places listing in Organization schema',
      },
    });
  }

  return {
    issues,
    data: {
      hasBingSiteAuth,
      hasBingMetaTag,
      hasBingIndexNowKey,
      bingPlacesDetected,
      bingSitemapAccessible,
      issues: detectedIssues,
    },
  };
}
