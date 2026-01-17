import * as cheerio from 'cheerio';
import axios from 'axios';
import * as https from 'https';
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

  return new Promise((resolve) => {
    const req = https.request({
      host: parsedUrl.hostname,
      port: 443,
      method: 'HEAD',
      rejectUnauthorized: true,
    }, (res) => {
      const cert = (res.socket as any).getPeerCertificate?.();
      if (cert && cert.valid_to) {
        const expiresAt = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 30) {
          issues.push({
            ...ISSUE_DEFINITIONS.CERT_EXPIRING,
            affectedUrls: [url],
            details: {
              expiresAt: expiresAt.toISOString(),
              daysUntilExpiry,
            },
          });
        }

        resolve({
          valid: true,
          expiresAt,
          issuer: cert.issuer?.O,
          daysUntilExpiry,
          issues,
        });
      } else {
        resolve({ valid: true, issues });
      }
    });

    req.on('error', () => {
      resolve({ valid: false, issues });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ valid: false, issues });
    });

    req.end();
  });
}
