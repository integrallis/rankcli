/**
 * Canonical Domain Check
 *
 * Verifies that the site properly handles www vs non-www versions
 * to avoid duplicate content issues.
 *
 * Best practice: One version should redirect to the other (301 redirect).
 * Both versions serving content = duplicate content problem.
 */

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface CanonicalDomainData {
  primaryDomain: string;
  wwwVersion: {
    url: string;
    status: number | null;
    redirectsTo?: string;
    accessible: boolean;
  };
  nonWwwVersion: {
    url: string;
    status: number | null;
    redirectsTo?: string;
    accessible: boolean;
  };
  hasProperRedirect: boolean;
  preferredVersion: 'www' | 'non-www' | 'unknown';
  httpsRedirect: {
    httpToHttps: boolean;
    httpsStatus: number | null;
  };
}

export async function analyzeCanonicalDomain(
  url: string
): Promise<{ issues: AuditIssue[]; data: CanonicalDomainData }> {
  const issues: AuditIssue[] = [];
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;

  // Determine www and non-www versions
  const isWww = hostname.startsWith('www.');
  const wwwHostname = isWww ? hostname : `www.${hostname}`;
  const nonWwwHostname = isWww ? hostname.substring(4) : hostname;

  // Skip if hostname has multiple subdomains (e.g., api.staging.example.com)
  const parts = nonWwwHostname.split('.');
  if (parts.length > 2 && !nonWwwHostname.match(/\.(co|com|org|net|gov)\.[a-z]{2}$/i)) {
    // This is a subdomain, not a main domain
    return {
      issues: [],
      data: {
        primaryDomain: hostname,
        wwwVersion: { url: '', status: null, accessible: false },
        nonWwwVersion: { url: '', status: null, accessible: false },
        hasProperRedirect: true, // N/A for subdomains
        preferredVersion: 'unknown',
        httpsRedirect: { httpToHttps: false, httpsStatus: null },
      },
    };
  }

  const wwwUrl = `https://${wwwHostname}${parsedUrl.pathname}`;
  const nonWwwUrl = `https://${nonWwwHostname}${parsedUrl.pathname}`;

  // Test both versions
  const [wwwResult, nonWwwResult] = await Promise.all([
    testUrl(wwwUrl),
    testUrl(nonWwwUrl),
  ]);

  // Determine if proper redirect exists
  let hasProperRedirect = false;
  let preferredVersion: 'www' | 'non-www' | 'unknown' = 'unknown';

  // Check if www redirects to non-www
  if (wwwResult.status && wwwResult.status >= 300 && wwwResult.status < 400) {
    if (wwwResult.redirectsTo?.includes(nonWwwHostname)) {
      hasProperRedirect = true;
      preferredVersion = 'non-www';
    }
  }

  // Check if non-www redirects to www
  if (nonWwwResult.status && nonWwwResult.status >= 300 && nonWwwResult.status < 400) {
    if (nonWwwResult.redirectsTo?.includes(wwwHostname)) {
      hasProperRedirect = true;
      preferredVersion = 'www';
    }
  }

  // Both accessible without redirect = problem
  const bothAccessible =
    wwwResult.accessible &&
    nonWwwResult.accessible &&
    wwwResult.status === 200 &&
    nonWwwResult.status === 200;

  if (bothAccessible && !hasProperRedirect) {
    issues.push({
      code: 'CANONICAL_WWW_DUPLICATE',
      severity: 'warning',
      category: 'crawlability',
      title: 'Both www and non-www versions accessible',
      description: `Both ${wwwUrl} and ${nonWwwUrl} return 200 OK. This creates duplicate content.`,
      impact: 'Search engines may index both versions, diluting page authority and causing ranking issues.',
      howToFix: 'Set up a 301 redirect from one version to the other. Most sites prefer non-www, but either works. Configure at server/CDN level.',
      affectedUrls: [wwwUrl, nonWwwUrl],
      details: {
        wwwStatus: wwwResult.status,
        nonWwwStatus: nonWwwResult.status,
        recommendation: 'Choose one version as canonical and 301 redirect the other.',
      },
    });
  }

  // Check HTTP to HTTPS redirect
  const httpUrl = `http://${hostname}${parsedUrl.pathname}`;
  const httpResult = await testUrl(httpUrl);

  let httpToHttps = false;
  if (httpResult.status && httpResult.status >= 300 && httpResult.status < 400) {
    if (httpResult.redirectsTo?.startsWith('https://')) {
      httpToHttps = true;
    }
  }

  if (!httpToHttps && httpResult.accessible && httpResult.status === 200) {
    issues.push({
      code: 'CANONICAL_NO_HTTPS_REDIRECT',
      severity: 'warning',
      category: 'security',
      title: 'HTTP does not redirect to HTTPS',
      description: 'The HTTP version of the site is accessible without redirecting to HTTPS.',
      impact: 'Duplicate content issues and security concerns. Users may access insecure version.',
      howToFix: 'Configure a 301 redirect from HTTP to HTTPS at the server or CDN level.',
      affectedUrls: [httpUrl],
    });
  }

  return {
    issues,
    data: {
      primaryDomain: hostname,
      wwwVersion: {
        url: wwwUrl,
        status: wwwResult.status,
        redirectsTo: wwwResult.redirectsTo,
        accessible: wwwResult.accessible,
      },
      nonWwwVersion: {
        url: nonWwwUrl,
        status: nonWwwResult.status,
        redirectsTo: nonWwwResult.redirectsTo,
        accessible: nonWwwResult.accessible,
      },
      hasProperRedirect,
      preferredVersion,
      httpsRedirect: {
        httpToHttps,
        httpsStatus: httpResult.status,
      },
    },
  };
}

async function testUrl(url: string): Promise<{
  status: number | null;
  redirectsTo?: string;
  accessible: boolean;
}> {
  try {
    const response = await httpGet<string>(url, {
      timeout: 10000,
      maxRedirects: 0, // Don't follow redirects
      validateStatus: () => true,
    });

    const status = response.status;
    const location = response.headers.location || response.headers.Location;

    return {
      status,
      redirectsTo: location,
      accessible: status !== null && status < 500,
    };
  } catch (error) {
    // DNS resolution failure, connection refused, etc.
    return {
      status: null,
      accessible: false,
    };
  }
}
