import axios from 'axios';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface RedirectData {
  hasRedirect: boolean;
  redirectChain: RedirectHop[];
  isLoop: boolean;
  finalUrl?: string;
  totalHops: number;
}

export interface RedirectHop {
  url: string;
  statusCode: number;
  location?: string;
}

export async function analyzeRedirects(
  url: string,
  maxHops: number = 10
): Promise<{ issues: AuditIssue[]; data: RedirectData }> {
  const issues: AuditIssue[] = [];
  const chain: RedirectHop[] = [];
  const visitedUrls = new Set<string>();
  let currentUrl = url;
  let isLoop = false;

  while (chain.length < maxHops) {
    // Check for loop
    if (visitedUrls.has(currentUrl)) {
      isLoop = true;
      break;
    }
    visitedUrls.add(currentUrl);

    try {
      const response = await axios.head(currentUrl, {
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      const hop: RedirectHop = {
        url: currentUrl,
        statusCode: response.status,
      };

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers['location'];
        if (location) {
          hop.location = location;
          chain.push(hop);
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }
      }

      chain.push(hop);
      break;
    } catch (error) {
      chain.push({
        url: currentUrl,
        statusCode: 0,
      });
      break;
    }
  }

  const hasRedirect = chain.length > 1;
  const finalUrl = chain.length > 0 ? chain[chain.length - 1].url : url;

  const data: RedirectData = {
    hasRedirect,
    redirectChain: chain,
    isLoop,
    finalUrl,
    totalHops: chain.length - 1,
  };

  // ==================== Issue Detection ====================

  // Redirect loop
  if (isLoop) {
    issues.push({
      ...ISSUE_DEFINITIONS.REDIRECT_LOOP,
      affectedUrls: [url],
      details: {
        chain: chain.map(h => `${h.url} (${h.statusCode})`),
      },
    });
  }

  // Redirect chain (more than one redirect)
  if (!isLoop && chain.length > 2) {
    issues.push({
      ...ISSUE_DEFINITIONS.REDIRECT_CHAIN,
      affectedUrls: [url],
      details: {
        chain: chain.map(h => `${h.url} (${h.statusCode})`),
        hops: chain.length - 1,
        finalUrl,
      },
    });
  }

  return { issues, data };
}

// Check internal links for redirect targets
export async function checkInternalRedirects(
  internalLinks: string[],
  batchSize: number = 10
): Promise<{ redirectLinks: Array<{ source: string; target: string; statusCode: number }> }> {
  const redirectLinks: Array<{ source: string; target: string; statusCode: number }> = [];

  // Process in batches to avoid overwhelming the server
  for (let i = 0; i < internalLinks.length; i += batchSize) {
    const batch = internalLinks.slice(i, i + batchSize);
    const promises = batch.map(async (link) => {
      try {
        const response = await axios.head(link, {
          timeout: 5000,
          maxRedirects: 0,
          validateStatus: () => true,
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers['location'];
          if (location) {
            return {
              source: link,
              target: new URL(location, link).href,
              statusCode: response.status,
            };
          }
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result) {
        redirectLinks.push(result);
      }
    }
  }

  return { redirectLinks };
}
