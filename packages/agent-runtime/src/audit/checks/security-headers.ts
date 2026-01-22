// Security Headers Checks
// Checks for CSP, X-Frame-Options, HSTS, and other security headers

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface SecurityHeadersData {
  https: boolean;
  headers: {
    hsts: string | null;
    csp: string | null;
    xFrameOptions: string | null;
    xContentTypeOptions: string | null;
    referrerPolicy: string | null;
    permissionsPolicy: string | null;
  };
  hstsMaxAge: number | null;
  hstsIncludesSubdomains: boolean;
  hstsPreload: boolean;
}

/**
 * Parse HSTS header
 */
function parseHSTS(header: string | null): {
  maxAge: number | null;
  includeSubdomains: boolean;
  preload: boolean;
} {
  if (!header) {
    return { maxAge: null, includeSubdomains: false, preload: false };
  }

  const result = { maxAge: null as number | null, includeSubdomains: false, preload: false };

  const maxAgeMatch = header.match(/max-age=(\d+)/i);
  if (maxAgeMatch) {
    result.maxAge = parseInt(maxAgeMatch[1], 10);
  }

  result.includeSubdomains = /includesubdomains/i.test(header);
  result.preload = /preload/i.test(header);

  return result;
}

/**
 * Analyze security headers
 */
export async function analyzeSecurityHeaders(url: string): Promise<{ issues: AuditIssue[]; data: SecurityHeadersData }> {
  const issues: AuditIssue[] = [];

  try {
    const response = await httpGet<string>(url, {
      timeout: 15000,
      validateStatus: () => true,
      maxRedirects: 5,
    });

    const headers = response.headers;
    const isHttps = url.startsWith('https://');

    // Extract security headers (case-insensitive)
    const getHeader = (name: string): string | null => {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? (headers[key] as string) : null;
    };

    const hsts = getHeader('strict-transport-security');
    const csp = getHeader('content-security-policy');
    const xFrameOptions = getHeader('x-frame-options');
    const xContentTypeOptions = getHeader('x-content-type-options');
    const referrerPolicy = getHeader('referrer-policy');
    const permissionsPolicy = getHeader('permissions-policy') || getHeader('feature-policy');

    // Parse HSTS
    const hstsData = parseHSTS(hsts);

    // Check for HTTPS
    if (!isHttps) {
      issues.push({
        ...ISSUE_DEFINITIONS.NOT_HTTPS,
        affectedUrls: [url],
      });
    }

    // Check for HSTS
    if (isHttps && !hsts) {
      issues.push({
        ...ISSUE_DEFINITIONS.HSTS_MISSING,
        affectedUrls: [url],
      });
    }

    // Check for CSP
    if (!csp) {
      issues.push({
        ...ISSUE_DEFINITIONS.CSP_MISSING,
        affectedUrls: [url],
      });
    }

    // Check for X-Frame-Options
    if (!xFrameOptions) {
      issues.push({
        ...ISSUE_DEFINITIONS.X_FRAME_OPTIONS_MISSING,
        affectedUrls: [url],
      });
    }

    // Check for X-Content-Type-Options
    if (!xContentTypeOptions) {
      issues.push({
        ...ISSUE_DEFINITIONS.X_CONTENT_TYPE_OPTIONS_MISSING,
        affectedUrls: [url],
      });
    }

    // Check for Referrer-Policy
    if (!referrerPolicy) {
      issues.push({
        ...ISSUE_DEFINITIONS.REFERRER_POLICY_MISSING,
        affectedUrls: [url],
      });
    }

    // Check for Permissions-Policy
    if (!permissionsPolicy) {
      issues.push({
        ...ISSUE_DEFINITIONS.PERMISSIONS_POLICY_MISSING,
        affectedUrls: [url],
      });
    }

    return {
      issues,
      data: {
        https: isHttps,
        headers: {
          hsts,
          csp,
          xFrameOptions,
          xContentTypeOptions,
          referrerPolicy,
          permissionsPolicy,
        },
        hstsMaxAge: hstsData.maxAge,
        hstsIncludesSubdomains: hstsData.includeSubdomains,
        hstsPreload: hstsData.preload,
      },
    };
  } catch (error) {
    return {
      issues,
      data: {
        https: url.startsWith('https://'),
        headers: {
          hsts: null,
          csp: null,
          xFrameOptions: null,
          xContentTypeOptions: null,
          referrerPolicy: null,
          permissionsPolicy: null,
        },
        hstsMaxAge: null,
        hstsIncludesSubdomains: false,
        hstsPreload: false,
      },
    };
  }
}
