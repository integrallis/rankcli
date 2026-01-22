// IndexNow Protocol Implementation Check
// IndexNow enables instant indexing by Bing, Yandex, Seznam, Naver, and other participating search engines

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface IndexNowData {
  hasKey: boolean;
  keyFileUrl: string | null;
  keyValue: string | null;
  keyValid: boolean;
  hasLinkTag: boolean;
  inRobotsTxt: boolean;
  cmsPlugin: string | null;
}

// Common IndexNow key file locations
const KEY_FILE_PATTERNS = [
  // Standard pattern: /{key}.txt
  /^[a-f0-9]{32}\.txt$/i,
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.txt$/i,
];

// CMS plugins that implement IndexNow
const CMS_PLUGINS: Record<string, string[]> = {
  WordPress: ['IndexNow', 'Yoast SEO Premium', 'Rank Math SEO', 'All in One SEO'],
  Wix: ['IndexNow built-in'],
  Cloudflare: ['Cloudflare IndexNow'],
};

/**
 * Check for IndexNow key in robots.txt
 */
export async function checkRobotsTxtForIndexNow(
  baseUrl: string
): Promise<{ found: boolean; key: string | null }> {
  try {
    const response = await httpGet<string>(`${new URL(baseUrl).origin}/robots.txt`, {
      
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status !== 200) {
      return { found: false, key: null };
    }

    const content = response.data as string;

    // Look for IndexNow comment or directive
    const indexNowPattern = /indexnow[:\s]+([a-f0-9-]+)/i;
    const match = content.match(indexNowPattern);

    if (match) {
      return { found: true, key: match[1] };
    }

    return { found: false, key: null };
  } catch {
    return { found: false, key: null };
  }
}

/**
 * Validate IndexNow key format
 */
export function isValidIndexNowKey(key: string): boolean {
  // Key should be 8-128 characters, hexadecimal or UUID format
  if (key.length < 8 || key.length > 128) return false;

  // UUID format
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)) {
    return true;
  }

  // Hex format (32 chars)
  if (/^[a-f0-9]{32}$/i.test(key)) {
    return true;
  }

  // Other alphanumeric formats
  if (/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return true;
  }

  return false;
}

/**
 * Try to find and validate IndexNow key file
 */
export async function findIndexNowKeyFile(
  baseUrl: string,
  possibleKeys: string[]
): Promise<{ found: boolean; url: string | null; key: string | null }> {
  const origin = new URL(baseUrl).origin;

  for (const key of possibleKeys) {
    if (!isValidIndexNowKey(key)) continue;

    const keyUrl = `${origin}/${key}.txt`;

    try {
      const response = await httpGet<string>(keyUrl, {
        
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        const content = (response.data as string).trim();
        if (content === key) {
          return { found: true, url: keyUrl, key };
        }
      }
    } catch {
      // Key file not found
    }
  }

  return { found: false, url: null, key: null };
}

/**
 * Check for IndexNow link tag in HTML
 */
export function checkIndexNowLinkTag(html: string): { found: boolean; href: string | null } {
  const $ = cheerio.load(html);

  // Check for indexnow link tag (non-standard but sometimes used)
  const indexNowLink =
    $('link[rel="indexnow"]').attr('href') ||
    $('link[rel="index-now"]').attr('href') ||
    $('meta[name="indexnow-key"]').attr('content') ||
    null;

  return { found: !!indexNowLink, href: indexNowLink };
}

/**
 * Detect CMS/framework and potential IndexNow plugin
 */
export function detectIndexNowCMSSupport(html: string, headers: Record<string, string>): string | null {
  const $ = cheerio.load(html);

  // Check for WordPress
  const isWordPress =
    html.includes('wp-content') ||
    html.includes('wp-includes') ||
    $('meta[name="generator"][content*="WordPress"]').length > 0;

  if (isWordPress) {
    // Check for known IndexNow plugins
    if (html.includes('yoast-seo') || html.includes('wordpress-seo')) {
      return 'WordPress + Yoast SEO (may have IndexNow)';
    }
    if (html.includes('rank-math') || html.includes('rankmath')) {
      return 'WordPress + Rank Math (has IndexNow)';
    }
    return 'WordPress (IndexNow plugins available)';
  }

  // Check for Wix
  if (html.includes('wix.com') || html.includes('_wix_browser_sess')) {
    return 'Wix (IndexNow built-in)';
  }

  // Check for Cloudflare
  if (headers['cf-ray'] || headers['server']?.includes('cloudflare')) {
    return 'Cloudflare (IndexNow integration available)';
  }

  return null;
}

/**
 * Main function: Analyze IndexNow implementation
 */
export async function analyzeIndexNow(
  html: string,
  url: string,
  headers: Record<string, string> = {}
): Promise<{ issues: AuditIssue[]; data: IndexNowData }> {
  const issues: AuditIssue[] = [];
  const origin = new URL(url).origin;

  // Check for link tag
  const linkTag = checkIndexNowLinkTag(html);

  // Check robots.txt
  const robotsCheck = await checkRobotsTxtForIndexNow(url);

  // Try to find key file with any discovered keys
  const possibleKeys: string[] = [];
  if (linkTag.href) possibleKeys.push(linkTag.href);
  if (robotsCheck.key) possibleKeys.push(robotsCheck.key);

  // Also try common key patterns
  // Note: In a real implementation, you might crawl the root directory
  // For now, we'll just check if the key file exists with discovered keys

  const keyFile = await findIndexNowKeyFile(url, possibleKeys);

  // Detect CMS support
  const cmsPlugin = detectIndexNowCMSSupport(html, headers);

  const data: IndexNowData = {
    hasKey: keyFile.found,
    keyFileUrl: keyFile.url,
    keyValue: keyFile.key,
    keyValid: keyFile.key ? isValidIndexNowKey(keyFile.key) : false,
    hasLinkTag: linkTag.found,
    inRobotsTxt: robotsCheck.found,
    cmsPlugin,
  };

  // Generate issues
  if (!keyFile.found && !linkTag.found && !robotsCheck.found) {
    const suggestion = cmsPlugin
      ? `Your platform (${cmsPlugin}) may support IndexNow. Check for built-in support or plugins.`
      : 'Create a key at indexnow.org, add the key file to your root directory, and submit URLs via the IndexNow API.';

    issues.push({
      code: 'INDEXNOW_NOT_IMPLEMENTED',
      severity: 'notice',
      category: 'crawlability',
      title: 'IndexNow not implemented',
      description: 'Site does not appear to have IndexNow instant indexing set up.',
      impact: 'Content changes may take longer to appear in Bing, Yandex, and other IndexNow-supporting search engines.',
      howToFix: suggestion,
      affectedUrls: [url],
      details: { cmsPlugin },
    });
  } else if (keyFile.found && !data.keyValid) {
    issues.push({
      code: 'INDEXNOW_INVALID_KEY',
      severity: 'warning',
      category: 'crawlability',
      title: 'IndexNow key format invalid',
      description: `The IndexNow key "${keyFile.key}" does not match expected formats.`,
      impact: 'IndexNow submissions may fail with invalid key format.',
      howToFix: 'Use a valid key format: 32-character hex or UUID format.',
      affectedUrls: [keyFile.url || url],
    });
  }

  // Informational notice if IndexNow is implemented
  if (keyFile.found && data.keyValid) {
    // This is good! No issue needed, but we track the data
  }

  return { issues, data };
}

/**
 * Generate IndexNow submission URL for a page
 */
export function generateIndexNowSubmitUrl(
  pageUrl: string,
  key: string,
  searchEngine: 'bing' | 'yandex' | 'seznam' | 'naver' = 'bing'
): string {
  const endpoints: Record<string, string> = {
    bing: 'https://www.bing.com/indexnow',
    yandex: 'https://yandex.com/indexnow',
    seznam: 'https://search.seznam.cz/indexnow',
    naver: 'https://searchadvisor.naver.com/indexnow',
  };

  const endpoint = endpoints[searchEngine];
  const parsedUrl = new URL(pageUrl);

  return `${endpoint}?url=${encodeURIComponent(pageUrl)}&key=${key}&keyLocation=${encodeURIComponent(`${parsedUrl.origin}/${key}.txt`)}`;
}
