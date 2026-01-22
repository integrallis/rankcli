// Redirect Chain Detection - Multiple redirects hurt SEO
// Reference: "Technical SEO for Developers - 17 Tips to Rank Higher"
// "Managing redirects... Broken links can absolutely tank your SEO numbers"

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface RedirectHop {
  url: string;
  statusCode: number;
  statusText: string;
  redirectTo: string | null;
  responseTime: number;
}

export interface RedirectChainResult {
  originalUrl: string;
  finalUrl: string;
  hops: RedirectHop[];
  chainLength: number;
  totalTime: number;
  hasHttpsUpgrade: boolean;
  hasWwwNormalization: boolean;
  hasTrailingSlashIssue: boolean;
  isInternalLoop: boolean;
  issues: string[];
}

// Maximum redirects to follow before giving up
const MAX_REDIRECTS = 10;

/**
 * Follow redirects and build the chain
 */
export async function traceRedirectChain(
  url: string,
  options: { timeout?: number } = {}
): Promise<RedirectChainResult> {
  const hops: RedirectHop[] = [];
  let currentUrl = url;
  let chainLength = 0;
  let totalTime = 0;
  const visitedUrls = new Set<string>();

  const timeout = options.timeout || 10000;

  while (chainLength < MAX_REDIRECTS) {
    // Detect loops
    if (visitedUrls.has(currentUrl)) {
      break;
    }
    visitedUrls.add(currentUrl);

    try {
      const startTime = Date.now();

      const response = await httpGet<string>(currentUrl, {
        
        timeout,
        maxRedirects: 0, // Don't auto-follow, we want to trace manually
        validateStatus: () => true, // Accept all status codes
      });

      const responseTime = Date.now() - startTime;
      totalTime += responseTime;

      const statusCode = response.status;
      const locationHeader = response.headers.location;

      // Normalize the redirect location
      let redirectTo: string | null = null;
      if (locationHeader) {
        try {
          // Handle relative URLs
          redirectTo = new URL(locationHeader, currentUrl).toString();
        } catch {
          redirectTo = locationHeader;
        }
      }

      hops.push({
        url: currentUrl,
        statusCode,
        statusText: response.statusText || getStatusText(statusCode),
        redirectTo,
        responseTime,
      });

      // Check if this is a redirect
      if (statusCode >= 300 && statusCode < 400 && redirectTo) {
        chainLength++;
        currentUrl = redirectTo;
      } else {
        // Final destination reached
        break;
      }
    } catch (error) {
      // Network error or timeout
      hops.push({
        url: currentUrl,
        statusCode: 0,
        statusText: error instanceof Error ? error.message : 'Network error',
        redirectTo: null,
        responseTime: 0,
      });
      break;
    }
  }

  const finalUrl = hops.length > 0 ? hops[hops.length - 1].url : url;

  // Analyze the chain for common issues
  const issues = analyzeChainIssues(url, hops);

  return {
    originalUrl: url,
    finalUrl,
    hops,
    chainLength: hops.length - 1, // Number of redirects (not including final destination)
    totalTime,
    hasHttpsUpgrade: detectHttpsUpgrade(hops),
    hasWwwNormalization: detectWwwNormalization(hops),
    hasTrailingSlashIssue: detectTrailingSlashIssue(hops),
    isInternalLoop: visitedUrls.size !== hops.length,
    issues,
  };
}

function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    404: 'Not Found',
    500: 'Internal Server Error',
  };
  return statusTexts[code] || 'Unknown';
}

function detectHttpsUpgrade(hops: RedirectHop[]): boolean {
  for (let i = 0; i < hops.length - 1; i++) {
    const current = hops[i].url;
    const next = hops[i].redirectTo;
    if (current.startsWith('http://') && next?.startsWith('https://')) {
      return true;
    }
  }
  return false;
}

function detectWwwNormalization(hops: RedirectHop[]): boolean {
  for (let i = 0; i < hops.length - 1; i++) {
    const currentHost = extractHost(hops[i].url);
    const nextHost = hops[i].redirectTo ? extractHost(hops[i].redirectTo!) : null;

    if (currentHost && nextHost) {
      const hasWwwChange =
        (currentHost.startsWith('www.') && !nextHost.startsWith('www.')) ||
        (!currentHost.startsWith('www.') && nextHost.startsWith('www.'));
      if (hasWwwChange) {
        return true;
      }
    }
  }
  return false;
}

function detectTrailingSlashIssue(hops: RedirectHop[]): boolean {
  for (let i = 0; i < hops.length - 1; i++) {
    const current = new URL(hops[i].url);
    const next = hops[i].redirectTo ? new URL(hops[i].redirectTo!) : null;

    if (next && current.pathname !== next.pathname) {
      const pathDiff =
        (current.pathname.endsWith('/') && !next.pathname.endsWith('/')) ||
        (!current.pathname.endsWith('/') && next.pathname.endsWith('/'));

      // Check if only difference is trailing slash
      const normalizedCurrent = current.pathname.replace(/\/$/, '');
      const normalizedNext = next.pathname.replace(/\/$/, '');

      if (pathDiff && normalizedCurrent === normalizedNext) {
        return true;
      }
    }
  }
  return false;
}

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function analyzeChainIssues(originalUrl: string, hops: RedirectHop[]): string[] {
  const issues: string[] = [];

  // Check for redirect chain
  const redirectCount = hops.filter(h => h.statusCode >= 300 && h.statusCode < 400).length;
  if (redirectCount > 1) {
    issues.push(`Redirect chain detected: ${redirectCount} hops`);
  }

  // Check for mixed 301/302
  const has301 = hops.some(h => h.statusCode === 301 || h.statusCode === 308);
  const has302 = hops.some(h => h.statusCode === 302 || h.statusCode === 307);
  if (has301 && has302) {
    issues.push('Mixed permanent and temporary redirects');
  }

  // Check for 302 being used where 301 should be
  const uses302 = hops.some(h => h.statusCode === 302);
  if (uses302 && redirectCount === 1) {
    issues.push('Consider using 301 (permanent) instead of 302 (temporary)');
  }

  // Check for slow redirects
  for (const hop of hops) {
    if (hop.responseTime > 500) {
      issues.push(`Slow redirect: ${hop.url} took ${hop.responseTime}ms`);
    }
  }

  // Check for HTTP to HTTPS upgrade in chain
  if (originalUrl.startsWith('http://')) {
    const finalHop = hops[hops.length - 1];
    if (finalHop && !finalHop.url.startsWith('https://')) {
      issues.push('HTTP URL does not redirect to HTTPS');
    }
  }

  // Check for unnecessary www/non-www redirect
  const httpAndWwwRedirects = hops.filter(h =>
    h.statusCode >= 300 && h.statusCode < 400
  );
  if (httpAndWwwRedirects.length > 1) {
    issues.push('Multiple normalizations (consider combining HTTPS + www redirects)');
  }

  return issues;
}

/**
 * Main function: Analyze redirects for SEO issues
 */
export async function analyzeRedirectChain(
  url: string
): Promise<{ issues: AuditIssue[]; data: RedirectChainResult }> {
  const issues: AuditIssue[] = [];
  const result = await traceRedirectChain(url);

  // Critical: Redirect loop detected
  if (result.isInternalLoop) {
    issues.push({
      code: 'REDIRECT_LOOP',
      severity: 'error',
      category: 'crawlability',
      title: 'Redirect loop detected',
      description: 'The URL redirects to itself or creates a circular redirect chain.',
      impact: 'Search engines cannot index pages with redirect loops. Users will see an error.',
      howToFix: 'Review redirect rules and ensure each URL points to a single final destination.',
      affectedUrls: [url],
      details: {
        chain: result.hops.map(h => h.url),
      },
    });
  }

  // Error: Long redirect chain (3+ hops)
  if (result.chainLength >= 3) {
    issues.push({
      code: 'LONG_REDIRECT_CHAIN',
      severity: 'error',
      category: 'crawlability',
      title: `Long redirect chain (${result.chainLength} hops)`,
      description: `URL requires ${result.chainLength} redirects before reaching the final destination.`,
      impact: 'Long redirect chains slow page load, waste crawl budget, and may lose link equity.',
      howToFix: 'Update internal links to point directly to the final URL. Combine redirect rules.',
      affectedUrls: [url],
      details: {
        chain: result.hops.map(h => ({ url: h.url, status: h.statusCode })),
        totalTime: result.totalTime,
      },
    });
  }
  // Warning: Redirect chain (2 hops)
  else if (result.chainLength === 2) {
    issues.push({
      code: 'REDIRECT_CHAIN',
      severity: 'warning',
      category: 'crawlability',
      title: 'Redirect chain detected (2 hops)',
      description: 'URL has an intermediate redirect before reaching the final destination.',
      impact: 'Each redirect adds latency and may dilute link equity slightly.',
      howToFix: 'Combine redirects into a single hop from source to final destination.',
      affectedUrls: [url],
      details: {
        chain: result.hops.map(h => ({ url: h.url, status: h.statusCode })),
      },
    });
  }

  // Warning: Temporary redirect (302) used
  const uses302 = result.hops.some(h => h.statusCode === 302 || h.statusCode === 307);
  if (uses302 && result.chainLength > 0) {
    issues.push({
      code: 'TEMPORARY_REDIRECT',
      severity: 'warning',
      category: 'crawlability',
      title: 'Temporary redirect (302/307) used',
      description: 'URL uses a temporary redirect instead of a permanent redirect.',
      impact: 'Temporary redirects may not pass full link equity. Use 301/308 for permanent moves.',
      howToFix: 'Change 302/307 redirects to 301/308 if the redirect is permanent.',
      affectedUrls: [url],
      details: {
        redirectType: result.hops.find(h => h.statusCode === 302 || h.statusCode === 307)?.statusCode,
      },
    });
  }

  // Notice: HTTPS upgrade happening
  if (result.hasHttpsUpgrade && result.chainLength === 1) {
    // This is expected and not an issue, but we note it
  }

  // Notice: Inefficient www normalization
  if (result.hasWwwNormalization && result.hasHttpsUpgrade && result.chainLength > 1) {
    issues.push({
      code: 'INEFFICIENT_NORMALIZATION',
      severity: 'notice',
      category: 'crawlability',
      title: 'Inefficient HTTP/www normalization',
      description: 'Multiple redirects for HTTPS upgrade and www normalization that could be combined.',
      impact: 'Extra redirect adds unnecessary latency and server load.',
      howToFix: 'Configure server to redirect directly from http://domain to https://www.domain (or vice versa) in one hop.',
      affectedUrls: [url],
    });
  }

  // Notice: Slow redirect chain
  if (result.totalTime > 1000 && result.chainLength > 0) {
    issues.push({
      code: 'SLOW_REDIRECTS',
      severity: 'notice',
      category: 'performance',
      title: `Slow redirect chain (${result.totalTime}ms total)`,
      description: `Redirect chain took ${result.totalTime}ms to complete.`,
      impact: 'Slow redirects negatively impact Time to First Byte and user experience.',
      howToFix: 'Optimize server response times and reduce redirect chain length.',
      affectedUrls: [url],
      details: {
        totalTime: result.totalTime,
        hops: result.hops.map(h => ({ url: h.url, time: h.responseTime })),
      },
    });
  }

  return { issues, data: result };
}

/**
 * Batch check multiple URLs for redirect chains
 */
export async function batchAnalyzeRedirects(
  urls: string[]
): Promise<Map<string, RedirectChainResult>> {
  const results = new Map<string, RedirectChainResult>();

  // Process in parallel with concurrency limit
  const concurrency = 5;
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => traceRedirectChain(url).then(result => ({ url, result })))
    );

    for (const { url, result } of batchResults) {
      results.set(url, result);
    }
  }

  return results;
}
