/**
 * Directory Listing Security Check
 *
 * Checks if the web server is configured to allow directory listing.
 * When enabled, accessing a directory without an index file shows
 * all files in that directory - a security risk.
 *
 * Detection methods:
 * - Check common directories (/images/, /assets/, /uploads/, etc.)
 * - Look for Apache/Nginx directory listing HTML patterns
 * - Check response headers
 */

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface DirectoryListingData {
  directoryListingEnabled: boolean;
  vulnerableDirectories: string[];
  checkedDirectories: string[];
  serverType?: string;
}

// Common directories to check for directory listing
const COMMON_DIRECTORIES = [
  '/images/',
  '/img/',
  '/assets/',
  '/static/',
  '/uploads/',
  '/files/',
  '/media/',
  '/css/',
  '/js/',
  '/scripts/',
  '/fonts/',
  '/backup/',
  '/temp/',
  '/tmp/',
];

// Patterns that indicate directory listing is enabled
const DIRECTORY_LISTING_PATTERNS = [
  // Apache
  /<title>Index of/i,
  /Parent Directory/i,
  /<h1>Index of/i,
  /\[DIR\]/i,
  /\[PARENTDIR\]/i,
  // Nginx
  /<title>Index of.*<\/title>/i,
  /autoindex/i,
  // IIS
  /\[To Parent Directory\]/i,
  /<title>.*- \/<\/title>/i,
  // Generic
  /Directory listing for/i,
  /<pre>.*<a href="[^"]*">[^<]*<\/a>.*<\/pre>/is,
];

/**
 * Check if HTML content indicates directory listing
 */
function isDirectoryListing(html: string): boolean {
  return DIRECTORY_LISTING_PATTERNS.some((pattern) => pattern.test(html));
}

/**
 * Detect server type from response
 */
function detectServerType(headers: Record<string, string>): string | undefined {
  const server = headers.server || headers.Server;
  if (server) {
    if (/apache/i.test(server)) return 'Apache';
    if (/nginx/i.test(server)) return 'Nginx';
    if (/iis/i.test(server)) return 'IIS';
    if (/cloudflare/i.test(server)) return 'Cloudflare';
    return server;
  }
  return undefined;
}

/**
 * Analyze directory listing security
 */
export async function analyzeDirectoryListing(url: string): Promise<{ issues: AuditIssue[]; data: DirectoryListingData }> {
  const issues: AuditIssue[] = [];
  const baseUrl = new URL(url);
  const baseOrigin = baseUrl.origin;

  const vulnerableDirectories: string[] = [];
  const checkedDirectories: string[] = [];
  let serverType: string | undefined;

  // Check each common directory (parallel with short timeout)
  const directoriesToCheck = COMMON_DIRECTORIES.slice(0, 6); // Limit to 6 directories

  // Run all directory checks in parallel with 3s timeout each
  const checkPromises = directoriesToCheck.map(async (dir) => {
    const dirUrl = `${baseOrigin}${dir}`;
    checkedDirectories.push(dir);

    try {
      const response = await httpGet<string>(dirUrl, {
        timeout: 3000, // Reduced timeout
        validateStatus: () => true,
      });

      // Get server type from response
      if (response.headers) {
        const detectedServer = detectServerType(response.headers as Record<string, string>);
        if (detectedServer && !serverType) {
          serverType = detectedServer;
        }
      }

      // Check if response indicates directory listing
      if (response.status === 200 && typeof response.data === 'string') {
        if (isDirectoryListing(response.data)) {
          vulnerableDirectories.push(dir);
        }
      }
    } catch {
      // Skip failed requests (directory doesn't exist or blocked)
    }
  });

  // Wait for all checks with overall timeout
  await Promise.race([
    Promise.all(checkPromises),
    new Promise<void>((resolve) => setTimeout(resolve, 8000)), // 8s overall timeout
  ]);

  const directoryListingEnabled = vulnerableDirectories.length > 0;

  // Generate issues
  if (directoryListingEnabled) {
    issues.push({
      code: 'DIRECTORY_LISTING_ENABLED',
      severity: 'warning',
      category: 'security',
      title: 'Directory listing enabled',
      description: `${vulnerableDirectories.length} director${vulnerableDirectories.length === 1 ? 'y' : 'ies'} expose file listings. This reveals your site structure and potentially sensitive files.`,
      impact:
        'Attackers can discover backup files, configuration files, or hidden content. This is a security vulnerability and information disclosure risk.',
      howToFix:
        serverType === 'Apache'
          ? 'Add "Options -Indexes" to your .htaccess file or Apache configuration.'
          : serverType === 'Nginx'
            ? 'Remove or set "autoindex off" in your Nginx configuration.'
            : 'Disable directory listing in your web server configuration. Add index files to directories.',
      affectedUrls: vulnerableDirectories.map((dir) => `${baseOrigin}${dir}`),
      details: {
        vulnerableDirectories,
        serverType,
        checkedCount: checkedDirectories.length,
        recommendation:
          'Ensure all directories have an index.html or index.php, or disable directory listing at the server level.',
      },
    });
  }

  return {
    issues,
    data: {
      directoryListingEnabled,
      vulnerableDirectories,
      checkedDirectories,
      serverType,
    },
  };
}
