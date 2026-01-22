import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface SecurityData {
  isHttps: boolean;
  hasMixedContent: boolean;
  mixedContentUrls: string[];
  hasHsts: boolean;
  hstsMaxAge?: number;
  certificateExpiry?: Date;
  certificateIssuer?: string;
}

export async function analyzeSecurity(
  html: string,
  url: string,
  headers: Record<string, string>
): Promise<{ issues: AuditIssue[]; data: SecurityData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';

  // Check for HTTPS
  if (!isHttps) {
    issues.push({
      ...ISSUE_DEFINITIONS.NOT_HTTPS,
      affectedUrls: [url],
    });
  }

  // Check for mixed content (HTTP resources on HTTPS page)
  const mixedContentUrls: string[] = [];
  if (isHttps) {
    // Check scripts
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src?.startsWith('http://')) {
        mixedContentUrls.push(src);
      }
    });

    // Check stylesheets
    $('link[rel="stylesheet"][href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href?.startsWith('http://')) {
        mixedContentUrls.push(href);
      }
    });

    // Check images
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src?.startsWith('http://')) {
        mixedContentUrls.push(src);
      }
    });

    // Check iframes
    $('iframe[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src?.startsWith('http://')) {
        mixedContentUrls.push(src);
      }
    });

    if (mixedContentUrls.length > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.MIXED_CONTENT,
        affectedUrls: [url],
        details: {
          count: mixedContentUrls.length,
          resources: mixedContentUrls.slice(0, 5),
        },
      });
    }
  }

  // Check HSTS header
  const hstsHeader = headers['strict-transport-security'];
  const hasHsts = !!hstsHeader;
  let hstsMaxAge: number | undefined;

  if (hstsHeader) {
    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      hstsMaxAge = parseInt(maxAgeMatch[1], 10);
    }
  } else if (isHttps) {
    issues.push({
      ...ISSUE_DEFINITIONS.HSTS_MISSING,
      affectedUrls: [url],
    });
  }

  const data: SecurityData = {
    isHttps,
    hasMixedContent: mixedContentUrls.length > 0,
    mixedContentUrls,
    hasHsts,
    hstsMaxAge,
  };

  return { issues, data };
}

// Check SSL certificate
// Note: Using fetch for isomorphic support - detailed cert info (expiry, issuer)
// is not available via fetch API. This only verifies the cert is valid.
export async function checkCertificate(url: string): Promise<{
  valid: boolean;
  expiresAt?: Date;
  issuer?: string;
  daysUntilExpiry?: number;
  issues: AuditIssue[];
}> {
  const issues: AuditIssue[] = [];
  const parsedUrl = new URL(url);

  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, issues };
  }

  try {
    // Use fetch to verify the certificate is valid
    // This will throw if the certificate is invalid/expired
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Certificate is valid if we got here
    return { valid: true, issues };
  } catch (error) {
    // Connection failed - could be cert issue or network error
    return { valid: false, issues };
  }
}
