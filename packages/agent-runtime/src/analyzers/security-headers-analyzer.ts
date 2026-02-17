/**
 * Security Headers Analyzer
 * 
 * Analyzes HTTP security headers that impact SEO and trust signals.
 * Many security headers are now considered ranking factors.
 */

import type { AuditIssue } from '../audit/types.js';

export interface SecurityHeadersResult {
  score: number;
  https: {
    enabled: boolean;
    hasHSTS: boolean;
    hstsMaxAge?: number;
    includesSubdomains: boolean;
    preload: boolean;
  };
  contentSecurity: {
    hasCSP: boolean;
    policy?: string;
    issues: string[];
  };
  frameOptions: {
    hasXFrameOptions: boolean;
    value?: string;
  };
  contentTypeOptions: {
    hasXContentTypeOptions: boolean;
  };
  xssProtection: {
    hasXXSSProtection: boolean;
    value?: string;
  };
  referrerPolicy: {
    hasReferrerPolicy: boolean;
    value?: string;
  };
  permissionsPolicy: {
    hasPermissionsPolicy: boolean;
    policy?: string;
  };
  issues: AuditIssue[];
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
}

const SECURITY_HEADERS = {
  'strict-transport-security': {
    name: 'HSTS',
    importance: 'critical',
    description: 'Enforces HTTPS connections',
  },
  'content-security-policy': {
    name: 'CSP',
    importance: 'high',
    description: 'Prevents XSS and injection attacks',
  },
  'x-frame-options': {
    name: 'X-Frame-Options',
    importance: 'medium',
    description: 'Prevents clickjacking',
  },
  'x-content-type-options': {
    name: 'X-Content-Type-Options',
    importance: 'medium',
    description: 'Prevents MIME sniffing',
  },
  'x-xss-protection': {
    name: 'X-XSS-Protection',
    importance: 'low',
    description: 'Legacy XSS filter (deprecated but still useful)',
  },
  'referrer-policy': {
    name: 'Referrer-Policy',
    importance: 'medium',
    description: 'Controls referrer information',
  },
  'permissions-policy': {
    name: 'Permissions-Policy',
    importance: 'medium',
    description: 'Controls browser features',
  },
};

/**
 * Analyze security headers
 */
export function analyzeSecurityHeaders(
  headers: Record<string, string>,
  url: string
): SecurityHeadersResult {
  const issues: AuditIssue[] = [];
  let score = 100;
  
  // Normalize headers to lowercase
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
  
  // Check HTTPS
  const isHTTPS = url.startsWith('https://');
  if (!isHTTPS) {
    score -= 30;
    issues.push({
      code: 'SEC_NO_HTTPS',
      severity: 'critical',
      category: 'technical',
      title: 'Site not using HTTPS',
      description: 'HTTPS is required for security and is a confirmed Google ranking factor.',
      impact: 'Major negative ranking impact and browser security warnings',
      howToFix: 'Install SSL certificate and redirect all HTTP traffic to HTTPS',
      affectedUrls: [url],
    });
  }
  
  // Check HSTS
  const hsts = normalizedHeaders['strict-transport-security'];
  let hasHSTS = false;
  let hstsMaxAge: number | undefined;
  let includesSubdomains = false;
  let preload = false;
  
  if (hsts) {
    hasHSTS = true;
    const maxAgeMatch = hsts.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      hstsMaxAge = parseInt(maxAgeMatch[1]);
      if (hstsMaxAge < 31536000) { // Less than 1 year
        score -= 5;
        issues.push({
          code: 'SEC_HSTS_SHORT',
          severity: 'info',
          category: 'technical',
          title: 'HSTS max-age is less than 1 year',
          description: `Current max-age is ${hstsMaxAge} seconds. Recommended: 31536000 (1 year) or more.`,
          impact: 'Reduced protection window',
          howToFix: 'Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
          affectedUrls: [url],
        });
      }
    }
    includesSubdomains = hsts.toLowerCase().includes('includesubdomains');
    preload = hsts.toLowerCase().includes('preload');
  } else if (isHTTPS) {
    score -= 15;
    issues.push({
      code: 'SEC_NO_HSTS',
      severity: 'warning',
      category: 'technical',
      title: 'Missing HSTS header',
      description: 'HTTP Strict Transport Security (HSTS) header is not set.',
      impact: 'Users may access site over insecure HTTP',
      howToFix: 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
      affectedUrls: [url],
    });
  }
  
  // Check CSP
  const csp = normalizedHeaders['content-security-policy'];
  const cspIssues: string[] = [];
  
  if (csp) {
    // Check for unsafe directives
    if (csp.includes("'unsafe-inline'")) {
      cspIssues.push("Contains 'unsafe-inline' - reduces XSS protection");
      score -= 5;
    }
    if (csp.includes("'unsafe-eval'")) {
      cspIssues.push("Contains 'unsafe-eval' - allows eval()");
      score -= 5;
    }
    if (csp.includes('*') && !csp.includes('*.')) {
      cspIssues.push("Contains wildcard (*) - too permissive");
      score -= 3;
    }
  } else {
    score -= 10;
    issues.push({
      code: 'SEC_NO_CSP',
      severity: 'warning',
      category: 'technical',
      title: 'Missing Content-Security-Policy header',
      description: 'CSP helps prevent XSS attacks and is a security best practice.',
      impact: 'Vulnerable to cross-site scripting attacks',
      howToFix: "Add Content-Security-Policy header with appropriate directives. Start with: default-src 'self'",
      affectedUrls: [url],
    });
  }
  
  // Check X-Frame-Options
  const xFrameOptions = normalizedHeaders['x-frame-options'];
  if (!xFrameOptions) {
    score -= 5;
    issues.push({
      code: 'SEC_NO_XFRAME',
      severity: 'info',
      category: 'technical',
      title: 'Missing X-Frame-Options header',
      description: 'X-Frame-Options prevents clickjacking attacks.',
      impact: 'Site can be embedded in malicious iframes',
      howToFix: 'Add header: X-Frame-Options: SAMEORIGIN (or DENY)',
      affectedUrls: [url],
    });
  }
  
  // Check X-Content-Type-Options
  const xContentTypeOptions = normalizedHeaders['x-content-type-options'];
  if (!xContentTypeOptions) {
    score -= 5;
    issues.push({
      code: 'SEC_NO_XCONTENT_TYPE',
      severity: 'info',
      category: 'technical',
      title: 'Missing X-Content-Type-Options header',
      description: 'Prevents browsers from MIME-sniffing responses.',
      impact: 'Potential for MIME confusion attacks',
      howToFix: 'Add header: X-Content-Type-Options: nosniff',
      affectedUrls: [url],
    });
  }
  
  // Check Referrer-Policy
  const referrerPolicy = normalizedHeaders['referrer-policy'];
  if (!referrerPolicy) {
    score -= 3;
    issues.push({
      code: 'SEC_NO_REFERRER_POLICY',
      severity: 'info',
      category: 'technical',
      title: 'Missing Referrer-Policy header',
      description: 'Controls how much referrer information is sent with requests.',
      impact: 'May leak sensitive URL information',
      howToFix: 'Add header: Referrer-Policy: strict-origin-when-cross-origin',
      affectedUrls: [url],
    });
  }
  
  // Check Permissions-Policy
  const permissionsPolicy = normalizedHeaders['permissions-policy'] || 
                           normalizedHeaders['feature-policy']; // Legacy name
  if (!permissionsPolicy) {
    score -= 3;
    issues.push({
      code: 'SEC_NO_PERMISSIONS_POLICY',
      severity: 'info',
      category: 'technical',
      title: 'Missing Permissions-Policy header',
      description: 'Controls which browser features can be used.',
      impact: 'All browser features enabled by default',
      howToFix: 'Add header: Permissions-Policy: geolocation=(), microphone=(), camera=()',
      affectedUrls: [url],
    });
  }
  
  // Calculate grade
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 95) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';
  
  return {
    score: Math.max(0, score),
    https: {
      enabled: isHTTPS,
      hasHSTS,
      hstsMaxAge,
      includesSubdomains,
      preload,
    },
    contentSecurity: {
      hasCSP: !!csp,
      policy: csp,
      issues: cspIssues,
    },
    frameOptions: {
      hasXFrameOptions: !!xFrameOptions,
      value: xFrameOptions,
    },
    contentTypeOptions: {
      hasXContentTypeOptions: !!xContentTypeOptions,
    },
    xssProtection: {
      hasXXSSProtection: !!normalizedHeaders['x-xss-protection'],
      value: normalizedHeaders['x-xss-protection'],
    },
    referrerPolicy: {
      hasReferrerPolicy: !!referrerPolicy,
      value: referrerPolicy,
    },
    permissionsPolicy: {
      hasPermissionsPolicy: !!permissionsPolicy,
      policy: permissionsPolicy,
    },
    issues,
    grade,
  };
}

/**
 * Generate recommended security headers
 */
export function generateSecurityHeaders(siteUrl: string): Record<string, string> {
  const domain = new URL(siteUrl).hostname;
  
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.${domain}`,
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    'X-XSS-Protection': '1; mode=block',
  };
}
