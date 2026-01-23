/**
 * URL Safety Check (Local Hash Database)
 *
 * Implements a Google Safe Browsing-style architecture:
 * 1. Maintains a local database of hash prefixes
 * 2. All URL checks happen locally against the hash database
 * 3. Database can be updated from open threat feeds (URLhaus, etc.)
 * 4. No external API calls during audit - fully offline capable
 *
 * Hash Database Format:
 * - URLs are canonicalized and hashed with FNV-1a
 * - 8-character hex prefixes are stored for space efficiency
 * - Prefixes are stored in a Set for O(1) lookup
 *
 * Data Sources for updates:
 * - URLhaus (abuse.ch) - https://urlhaus.abuse.ch/downloads/csv/
 * - PhishTank - https://data.phishtank.com/
 * - OpenPhish - https://openphish.com/
 */

import type { AuditIssue } from '../types.js';

// ============================================================================
// CROSS-PLATFORM HASHING (FNV-1a - Works in Node.js, Deno, and browsers)
// ============================================================================

/**
 * FNV-1a hash function - fast, simple, cross-platform
 * Returns a 32-bit hash as 8 hex characters
 */
function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  const FNV_PRIME = 0x01000193;

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to unsigned 32-bit and return as hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ============================================================================
// TYPES
// ============================================================================

export interface UrlSafetyData {
  checkedUrls: number;
  matchedUrls: UrlMatch[];
  databaseInfo: {
    prefixCount: number;
    lastUpdated?: string;
    sources: string[];
  };
  patternMatches: PatternMatch[];
}

interface UrlMatch {
  url: string;
  hashPrefix: string;
  matchType: 'exact' | 'domain' | 'pattern';
  threatType?: string;
}

interface PatternMatch {
  url: string;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// HASH DATABASE
// ============================================================================

/**
 * Local hash prefix database
 * Format: Set of 8-character hex strings (4-byte SHA256 prefixes)
 *
 * This is a bundled snapshot. In production, this would be:
 * 1. Loaded from a local file that gets periodic updates
 * 2. Updated via a background process from URLhaus/PhishTank
 *
 * The prefixes below are derived from known malicious patterns
 * and serve as examples of the format.
 */
class ThreatDatabase {
  private hashPrefixes: Set<string> = new Set();
  private domainPrefixes: Set<string> = new Set();
  private lastUpdated: string = new Date().toISOString();
  private sources: string[] = ['builtin-patterns'];

  constructor() {
    this.initializeBuiltinData();
  }

  /**
   * Initialize with built-in threat patterns
   * These are hashes of known malicious URL patterns
   */
  private initializeBuiltinData(): void {
    // Add known malicious domain patterns (hashed)
    // These would normally come from URLhaus CSV dump
    const knownBadPatterns: string[] = [
      // Example pattern hashes - in production, load from file or Supabase
      // Format: FNV-1a hash prefix of canonical URL
    ];

    for (const prefix of knownBadPatterns) {
      this.hashPrefixes.add(prefix);
    }
  }

  /**
   * Compute canonical form of URL (similar to Google Safe Browsing)
   * - Lowercase hostname
   * - Remove default ports
   * - Normalize path
   * - Remove fragments
   */
  canonicalizeUrl(urlString: string): string | null {
    try {
      const url = new URL(urlString);

      // Lowercase hostname
      let canonical = url.protocol + '//' + url.hostname.toLowerCase();

      // Remove default ports
      if (url.port && !((url.protocol === 'http:' && url.port === '80') ||
                        (url.protocol === 'https:' && url.port === '443'))) {
        canonical += ':' + url.port;
      }

      // Normalize path (remove trailing slash for root, keep for others)
      let path = url.pathname;
      if (path === '/') {
        canonical += '/';
      } else {
        // Remove duplicate slashes
        path = path.replace(/\/+/g, '/');
        canonical += path;
      }

      // Include query string but not fragment
      if (url.search) {
        canonical += url.search;
      }

      return canonical;
    } catch {
      return null;
    }
  }

  /**
   * Compute hash of URL and return prefix
   * Uses FNV-1a for cross-platform compatibility (Node.js, Deno, browser)
   */
  computeHashPrefix(url: string): string {
    return fnv1aHash(url);
  }

  /**
   * Compute hash prefix for domain only
   */
  computeDomainHashPrefix(hostname: string): string {
    return fnv1aHash(hostname.toLowerCase());
  }

  /**
   * Check if URL matches any hash in the database
   */
  checkUrl(urlString: string): { matched: boolean; prefix?: string; matchType?: 'exact' | 'domain' } {
    const canonical = this.canonicalizeUrl(urlString);
    if (!canonical) {
      return { matched: false };
    }

    // Check full URL hash
    const urlPrefix = this.computeHashPrefix(canonical);
    if (this.hashPrefixes.has(urlPrefix)) {
      return { matched: true, prefix: urlPrefix, matchType: 'exact' };
    }

    // Check domain hash
    try {
      const url = new URL(urlString);
      const domainPrefix = this.computeDomainHashPrefix(url.hostname);
      if (this.domainPrefixes.has(domainPrefix)) {
        return { matched: true, prefix: domainPrefix, matchType: 'domain' };
      }
    } catch {
      // Invalid URL
    }

    return { matched: false };
  }

  /**
   * Add hashes from URLhaus CSV data
   * Format: id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
   */
  loadFromUrlhausCsv(csvData: string): number {
    const lines = csvData.split('\n');
    let added = 0;

    for (const line of lines) {
      // Skip comments and header
      if (line.startsWith('#') || line.startsWith('id,')) continue;

      const parts = line.split(',');
      if (parts.length >= 3) {
        const url = parts[2].replace(/"/g, '');
        const canonical = this.canonicalizeUrl(url);
        if (canonical) {
          const prefix = this.computeHashPrefix(canonical);
          this.hashPrefixes.add(prefix);
          added++;
        }
      }
    }

    this.lastUpdated = new Date().toISOString();
    if (!this.sources.includes('urlhaus')) {
      this.sources.push('urlhaus');
    }

    return added;
  }

  /**
   * Add a list of URLs to the database
   */
  addUrls(urls: string[]): number {
    let added = 0;
    for (const url of urls) {
      const canonical = this.canonicalizeUrl(url);
      if (canonical) {
        const prefix = this.computeHashPrefix(canonical);
        if (!this.hashPrefixes.has(prefix)) {
          this.hashPrefixes.add(prefix);
          added++;
        }
      }
    }
    return added;
  }

  /**
   * Add domains to the blocklist
   */
  addDomains(domains: string[]): number {
    let added = 0;
    for (const domain of domains) {
      const prefix = this.computeDomainHashPrefix(domain);
      if (!this.domainPrefixes.has(prefix)) {
        this.domainPrefixes.add(prefix);
        added++;
      }
    }
    return added;
  }

  /**
   * Bulk load hash prefixes directly (for Supabase integration)
   * This is used when loading from the threat_hashes table
   */
  loadHashPrefixes(hashes: Array<{ hash_prefix: string; hash_type: 'url' | 'domain' }>): number {
    let added = 0;
    for (const hash of hashes) {
      if (hash.hash_type === 'url') {
        if (!this.hashPrefixes.has(hash.hash_prefix)) {
          this.hashPrefixes.add(hash.hash_prefix);
          added++;
        }
      } else if (hash.hash_type === 'domain') {
        if (!this.domainPrefixes.has(hash.hash_prefix)) {
          this.domainPrefixes.add(hash.hash_prefix);
          added++;
        }
      }
    }

    this.lastUpdated = new Date().toISOString();
    if (!this.sources.includes('supabase')) {
      this.sources.push('supabase');
    }

    return added;
  }

  /**
   * Clear all hashes (useful before reloading)
   */
  clear(): void {
    this.hashPrefixes.clear();
    this.domainPrefixes.clear();
    this.sources = [];
  }

  /**
   * Check if database has been populated
   */
  isPopulated(): boolean {
    return this.hashPrefixes.size > 0 || this.domainPrefixes.size > 0;
  }

  /**
   * Get database statistics
   */
  getStats(): { prefixCount: number; lastUpdated: string; sources: string[] } {
    return {
      prefixCount: this.hashPrefixes.size + this.domainPrefixes.size,
      lastUpdated: this.lastUpdated,
      sources: this.sources,
    };
  }
}

// Global database instance
const threatDb = new ThreatDatabase();

// ============================================================================
// PATTERN-BASED DETECTION (Local, no external calls)
// ============================================================================

// Popular domains that are commonly typosquatted
const POPULAR_DOMAINS = [
  'google', 'facebook', 'amazon', 'apple', 'microsoft', 'paypal',
  'netflix', 'instagram', 'twitter', 'linkedin', 'youtube', 'github',
  'dropbox', 'adobe', 'salesforce', 'stripe', 'shopify', 'wordpress',
  'cloudflare', 'aws', 'azure', 'slack', 'zoom', 'docusign',
];

// Suspicious TLDs often used in phishing/malware
const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq', // Free TLDs abused for phishing
  '.xyz', '.top', '.work', '.click', '.link', '.download',
  '.zip', '.mov', // New TLDs that can be confusing
];

// File extensions that are suspicious in URLs
const SUSPICIOUS_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs',
  '.jar', '.scr', '.pif', '.application',
  '.hta', '.cpl', '.msc', '.wsf',
];

// Homograph characters (look-alike Unicode)
const HOMOGRAPH_CHARS: Record<string, string[]> = {
  'a': ['а', 'ɑ', 'α'], // Cyrillic а, Latin alpha
  'c': ['с', 'ϲ'],      // Cyrillic с
  'e': ['е', 'ё'],      // Cyrillic е
  'o': ['о', 'ο'],      // Cyrillic о, Greek omicron
  'p': ['р'],           // Cyrillic р
  'x': ['х'],           // Cyrillic х
  'y': ['у'],           // Cyrillic у
};

/**
 * Check if a string contains homograph characters
 */
function containsHomographs(str: string): boolean {
  for (const [_, lookalikes] of Object.entries(HOMOGRAPH_CHARS)) {
    for (const char of lookalikes) {
      if (str.includes(char)) return true;
    }
  }
  return false;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Check for typosquatting of popular domains
 */
function checkTyposquatting(hostname: string): string | null {
  const parts = hostname.toLowerCase().split('.');
  const mainDomain = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

  for (const popular of POPULAR_DOMAINS) {
    if (mainDomain === popular) continue;

    // Levenshtein distance check
    const distance = levenshteinDistance(mainDomain, popular);
    if (distance > 0 && distance <= 2) {
      return `Possible typosquat of "${popular}"`;
    }

    // Suspicious variations
    if (mainDomain.includes(popular) && mainDomain !== popular) {
      if (mainDomain.includes('-') || mainDomain.includes('secure') ||
          mainDomain.includes('login') || mainDomain.includes('account')) {
        return `Suspicious variation of "${popular}"`;
      }
    }
  }
  return null;
}

/**
 * Analyze URL for suspicious patterns (local analysis only)
 */
function analyzeUrlPatterns(urlString: string): PatternMatch | null {
  const reasons: string[] = [];

  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // IP address instead of domain
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      reasons.push('Uses IP address instead of domain');
    }

    // Suspicious TLDs
    for (const tld of SUSPICIOUS_TLDS) {
      if (hostname.endsWith(tld)) {
        reasons.push(`Suspicious TLD: ${tld}`);
        break;
      }
    }

    // Excessive subdomains
    if (hostname.split('.').length > 4) {
      reasons.push('Excessive subdomains');
    }

    // Typosquatting
    const typosquat = checkTyposquatting(hostname);
    if (typosquat) reasons.push(typosquat);

    // Homograph attack
    if (containsHomographs(hostname)) {
      reasons.push('Contains look-alike Unicode characters');
    }

    // Suspicious file extensions
    for (const ext of SUSPICIOUS_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        reasons.push(`Dangerous file type: ${ext}`);
        break;
      }
    }

    // @ symbol in URL
    if (urlString.includes('@')) {
      reasons.push('Contains @ symbol (may obscure destination)');
    }

    // URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd'];
    if (shorteners.some(s => hostname === s || hostname.endsWith('.' + s))) {
      reasons.push('URL shortener (destination hidden)');
    }

  } catch {
    reasons.push('Malformed URL');
  }

  if (reasons.length === 0) return null;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  const highRisk = ['homograph', 'IP address', 'typosquat', 'Dangerous file'];
  if (reasons.some(r => highRisk.some(h => r.toLowerCase().includes(h.toLowerCase())))) {
    riskLevel = 'high';
  }
  if (reasons.length >= 3) riskLevel = 'high';

  return { url: urlString, reasons, riskLevel };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Analyze URL safety using local hash database and pattern matching
 *
 * This function performs two types of checks:
 * 1. Hash-based lookup against the local threat database
 * 2. Pattern-based detection for suspicious URL characteristics
 *
 * No external API calls are made - all checks are local.
 */
export function analyzeUrlSafety(
  url: string,
  externalLinks: string[] = []
): { issues: AuditIssue[]; data: UrlSafetyData } {
  const issues: AuditIssue[] = [];
  const matchedUrls: UrlMatch[] = [];
  const patternMatches: PatternMatch[] = [];
  const allUrls = [url, ...externalLinks];

  // Check each URL against the hash database
  for (const checkUrl of allUrls) {
    // Hash-based check
    const hashResult = threatDb.checkUrl(checkUrl);
    if (hashResult.matched) {
      matchedUrls.push({
        url: checkUrl,
        hashPrefix: hashResult.prefix!,
        matchType: hashResult.matchType!,
      });
    }

    // Pattern-based check
    const patternResult = analyzeUrlPatterns(checkUrl);
    if (patternResult) {
      patternMatches.push(patternResult);
    }
  }

  // Generate issues for hash matches (known threats)
  if (matchedUrls.length > 0) {
    const mainSiteMatched = matchedUrls.some(m => m.url === url);

    if (mainSiteMatched) {
      issues.push({
        code: 'URL_SAFETY_KNOWN_THREAT',
        severity: 'error',
        category: 'security',
        title: 'Website URL matches known threat database',
        description: 'Your website URL matches entries in the threat database. This indicates your site may have been compromised or flagged.',
        impact: 'Browsers and security tools will block access to your site. Search engines will remove you from results.',
        howToFix: 'Scan your site for malware, remove any malicious content, and request removal from threat databases.',
        affectedUrls: [url],
        details: {
          matchedHash: matchedUrls.find(m => m.url === url)?.hashPrefix,
        },
      });
    }

    const externalMatches = matchedUrls.filter(m => m.url !== url);
    if (externalMatches.length > 0) {
      issues.push({
        code: 'URL_SAFETY_EXTERNAL_THREAT',
        severity: 'error',
        category: 'security',
        title: 'External links to known malicious URLs',
        description: `${externalMatches.length} external link(s) point to URLs in the threat database.`,
        impact: 'Linking to malicious sites harms visitors and damages your reputation and rankings.',
        howToFix: 'Remove all links to flagged URLs immediately.',
        affectedUrls: externalMatches.map(m => m.url),
      });
    }
  }

  // Generate issues for pattern matches (suspicious characteristics)
  const highRiskPatterns = patternMatches.filter(p => p.riskLevel === 'high');

  if (highRiskPatterns.some(p => p.url === url)) {
    const mainPattern = highRiskPatterns.find(p => p.url === url)!;
    issues.push({
      code: 'URL_SAFETY_SUSPICIOUS_DOMAIN',
      severity: 'warning',
      category: 'security',
      title: 'Website URL has suspicious characteristics',
      description: `Your URL shows patterns associated with malicious sites: ${mainPattern.reasons.join('; ')}`,
      impact: 'Users and security tools may distrust your site.',
      howToFix: 'Use a trustworthy domain structure. Avoid patterns that mimic other brands.',
      affectedUrls: [url],
      details: { reasons: mainPattern.reasons },
    });
  }

  const suspiciousExternal = highRiskPatterns.filter(p => p.url !== url);
  if (suspiciousExternal.length > 0) {
    issues.push({
      code: 'URL_SAFETY_SUSPICIOUS_EXTERNAL',
      severity: 'warning',
      category: 'security',
      title: 'External links with suspicious characteristics',
      description: `${suspiciousExternal.length} external link(s) show suspicious patterns.`,
      impact: 'Linking to suspicious sites can harm visitors and rankings.',
      howToFix: 'Review and remove or replace suspicious external links.',
      affectedUrls: suspiciousExternal.map(p => p.url),
      details: {
        suspiciousLinks: suspiciousExternal.map(p => ({
          url: p.url,
          reasons: p.reasons,
        })),
      },
    });
  }

  // URL shortener notice
  const shortenerMatches = patternMatches.filter(p =>
    p.reasons.some(r => r.includes('shortener'))
  );
  if (shortenerMatches.length > 0) {
    issues.push({
      code: 'URL_SAFETY_SHORTENERS',
      severity: 'notice',
      category: 'security',
      title: 'External links use URL shorteners',
      description: `${shortenerMatches.length} link(s) use URL shorteners, hiding destinations.`,
      impact: 'URL shorteners reduce trust and SEO link value.',
      howToFix: 'Replace shortened URLs with direct links.',
      affectedUrls: shortenerMatches.map(p => p.url),
    });
  }

  return {
    issues,
    data: {
      checkedUrls: allUrls.length,
      matchedUrls,
      databaseInfo: threatDb.getStats(),
      patternMatches,
    },
  };
}

/**
 * Export the threat database for external updates
 */
export const urlSafetyDatabase = {
  /**
   * Load URLs from URLhaus CSV format
   */
  loadFromUrlhausCsv: (csv: string) => threatDb.loadFromUrlhausCsv(csv),

  /**
   * Add URLs to the blocklist
   */
  addUrls: (urls: string[]) => threatDb.addUrls(urls),

  /**
   * Add domains to the blocklist
   */
  addDomains: (domains: string[]) => threatDb.addDomains(domains),

  /**
   * Bulk load hash prefixes (for Supabase integration)
   * Call this with data from: SELECT hash_prefix, hash_type FROM threat_hashes WHERE is_active = TRUE
   */
  loadHashPrefixes: (hashes: Array<{ hash_prefix: string; hash_type: 'url' | 'domain' }>) =>
    threatDb.loadHashPrefixes(hashes),

  /**
   * Clear all hashes (useful before reloading from fresh data)
   */
  clear: () => threatDb.clear(),

  /**
   * Check if database has been populated with threat data
   */
  isPopulated: () => threatDb.isPopulated(),

  /**
   * Get database statistics
   */
  getStats: () => threatDb.getStats(),
};
