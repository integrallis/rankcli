/**
 * Browser Caching Headers Check
 *
 * Validates HTTP caching headers for optimal performance:
 * - Cache-Control header
 * - Expires header
 * - ETag header
 * - Last-Modified header
 *
 * Proper caching improves page load times for repeat visitors
 * and reduces server load.
 */

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface CachingHeadersData {
  htmlCaching: {
    cacheControl?: string;
    expires?: string;
    etag?: string;
    lastModified?: string;
    maxAge?: number;
    isPublic: boolean;
    isPrivate: boolean;
    noStore: boolean;
    noCache: boolean;
  };
  staticAssets: AssetCachingInfo[];
  issues: {
    noCaching: number;
    shortTtl: number;
    properlyConfigured: number;
  };
}

interface AssetCachingInfo {
  url: string;
  type: string;
  cacheControl?: string;
  maxAge?: number;
  hasCaching: boolean;
}

// Recommended cache durations (in seconds)
const CACHE_RECOMMENDATIONS = {
  html: 0, // HTML should generally not be cached or have short TTL
  css: 31536000, // 1 year for versioned assets
  js: 31536000,
  images: 31536000,
  fonts: 31536000,
  minimum: 86400, // 1 day minimum for static assets
};

export async function analyzeCachingHeaders(
  url: string,
  headers?: Record<string, string>
): Promise<{ issues: AuditIssue[]; data: CachingHeadersData }> {
  const issues: AuditIssue[] = [];

  // Analyze HTML page headers
  let htmlHeaders = headers;
  if (!htmlHeaders) {
    try {
      const response = await httpGet<string>(url, {
        timeout: 10000,
        validateStatus: () => true,
      });
      htmlHeaders = response.headers as Record<string, string>;
    } catch {
      htmlHeaders = {};
    }
  }

  const htmlCaching = parseCacheHeaders(htmlHeaders);

  // Check HTML caching (should be minimal or no caching)
  if (htmlCaching.maxAge && htmlCaching.maxAge > 3600) {
    issues.push({
      code: 'CACHING_HTML_TOO_LONG',
      severity: 'notice',
      category: 'performance',
      title: 'HTML page has long cache duration',
      description: `HTML page has Cache-Control max-age of ${htmlCaching.maxAge} seconds (${Math.round(htmlCaching.maxAge / 3600)} hours). HTML content changes frequently.`,
      impact: 'Users may see stale content. Content updates may not appear immediately.',
      howToFix: 'Set shorter cache duration for HTML: Cache-Control: no-cache or max-age=0, must-revalidate',
      affectedUrls: [url],
    });
  }

  // Sample static assets to check their caching
  const staticAssets: AssetCachingInfo[] = [];
  const assetUrls = await getStaticAssetUrls(url);

  let noCaching = 0;
  let shortTtl = 0;
  let properlyConfigured = 0;

  // Check up to 5 static assets
  const assetsToCheck = assetUrls.slice(0, 5);

  for (const assetUrl of assetsToCheck) {
    try {
      const assetResponse = await httpGet<string>(assetUrl, {
        timeout: 5000,
        validateStatus: () => true,
      });

      const assetCaching = parseCacheHeaders(assetResponse.headers as Record<string, string>);
      const type = getAssetType(assetUrl);

      const assetInfo: AssetCachingInfo = {
        url: assetUrl,
        type,
        cacheControl: assetCaching.cacheControl,
        maxAge: assetCaching.maxAge,
        hasCaching: Boolean(assetCaching.cacheControl || assetCaching.expires),
      };

      staticAssets.push(assetInfo);

      if (!assetInfo.hasCaching) {
        noCaching++;
      } else if (assetCaching.maxAge && assetCaching.maxAge < CACHE_RECOMMENDATIONS.minimum) {
        shortTtl++;
      } else {
        properlyConfigured++;
      }
    } catch {
      // Asset check failed, skip
    }
  }

  // Generate issues for static assets
  if (noCaching > 0) {
    issues.push({
      code: 'CACHING_STATIC_NO_CACHE',
      severity: 'warning',
      category: 'performance',
      title: 'Static assets missing cache headers',
      description: `${noCaching} static asset(s) have no Cache-Control header. This forces browsers to re-download on every visit.`,
      impact: 'Slower page loads for repeat visitors. Increased bandwidth usage.',
      howToFix: 'Add Cache-Control headers to static assets. For versioned files (with hash in filename), use: Cache-Control: public, max-age=31536000, immutable',
      affectedUrls: staticAssets.filter(a => !a.hasCaching).map(a => a.url),
      details: {
        recommendation: {
          'versioned assets (with hash)': 'Cache-Control: public, max-age=31536000, immutable',
          'non-versioned assets': 'Cache-Control: public, max-age=86400',
        },
      },
    });
  }

  if (shortTtl > 0) {
    issues.push({
      code: 'CACHING_STATIC_SHORT_TTL',
      severity: 'notice',
      category: 'performance',
      title: 'Static assets have short cache duration',
      description: `${shortTtl} static asset(s) have cache duration under 1 day. Consider longer caching for better performance.`,
      impact: 'Assets are re-downloaded more often than necessary.',
      howToFix: 'Increase max-age for static assets. Use versioned filenames (hash in filename) to enable long-term caching.',
      affectedUrls: staticAssets.filter(a => a.maxAge && a.maxAge < CACHE_RECOMMENDATIONS.minimum).map(a => a.url),
    });
  }

  // Check for missing ETag or Last-Modified
  if (!htmlCaching.etag && !htmlCaching.lastModified) {
    issues.push({
      code: 'CACHING_NO_VALIDATORS',
      severity: 'notice',
      category: 'performance',
      title: 'Missing cache validators (ETag/Last-Modified)',
      description: 'Page is missing both ETag and Last-Modified headers. These allow efficient cache validation.',
      impact: 'Browsers cannot efficiently validate if cached content is still fresh.',
      howToFix: 'Configure your server to send ETag or Last-Modified headers. Most web servers do this automatically for static files.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      htmlCaching,
      staticAssets,
      issues: {
        noCaching,
        shortTtl,
        properlyConfigured,
      },
    },
  };
}

function parseCacheHeaders(headers: Record<string, string>): CachingHeadersData['htmlCaching'] {
  const cacheControl = headers['cache-control'] || headers['Cache-Control'];
  const expires = headers['expires'] || headers['Expires'];
  const etag = headers['etag'] || headers['ETag'];
  const lastModified = headers['last-modified'] || headers['Last-Modified'];

  let maxAge: number | undefined;
  let isPublic = false;
  let isPrivate = false;
  let noStore = false;
  let noCache = false;

  if (cacheControl) {
    // Parse max-age
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    if (maxAgeMatch) {
      maxAge = parseInt(maxAgeMatch[1], 10);
    }

    // Parse directives
    const lowerCC = cacheControl.toLowerCase();
    isPublic = lowerCC.includes('public');
    isPrivate = lowerCC.includes('private');
    noStore = lowerCC.includes('no-store');
    noCache = lowerCC.includes('no-cache');
  }

  return {
    cacheControl,
    expires,
    etag,
    lastModified,
    maxAge,
    isPublic,
    isPrivate,
    noStore,
    noCache,
  };
}

async function getStaticAssetUrls(pageUrl: string): Promise<string[]> {
  const assets: string[] = [];

  try {
    const response = await httpGet<string>(pageUrl, {
      timeout: 10000,
      validateStatus: () => true,
    });

    const html = response.data as string;
    const baseUrl = new URL(pageUrl);

    // Extract CSS files
    const cssMatches = html.match(/href="([^"]+\.css[^"]*)"/gi);
    if (cssMatches) {
      for (const match of cssMatches.slice(0, 2)) {
        const href = match.match(/href="([^"]+)"/)?.[1];
        if (href) {
          try {
            assets.push(new URL(href, baseUrl).href);
          } catch {
            // Invalid URL
          }
        }
      }
    }

    // Extract JS files
    const jsMatches = html.match(/src="([^"]+\.js[^"]*)"/gi);
    if (jsMatches) {
      for (const match of jsMatches.slice(0, 2)) {
        const src = match.match(/src="([^"]+)"/)?.[1];
        if (src) {
          try {
            assets.push(new URL(src, baseUrl).href);
          } catch {
            // Invalid URL
          }
        }
      }
    }

    // Extract image files
    const imgMatches = html.match(/src="([^"]+\.(png|jpg|jpeg|gif|webp|svg)[^"]*)"/gi);
    if (imgMatches) {
      for (const match of imgMatches.slice(0, 1)) {
        const src = match.match(/src="([^"]+)"/)?.[1];
        if (src) {
          try {
            assets.push(new URL(src, baseUrl).href);
          } catch {
            // Invalid URL
          }
        }
      }
    }
  } catch {
    // Failed to fetch page
  }

  return assets;
}

function getAssetType(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.css')) return 'css';
  if (lowerUrl.includes('.js')) return 'javascript';
  if (lowerUrl.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)/)) return 'image';
  if (lowerUrl.match(/\.(woff|woff2|ttf|otf|eot)/)) return 'font';
  return 'other';
}
