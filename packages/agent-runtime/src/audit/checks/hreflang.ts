import * as cheerio from 'cheerio';
import { httpHead, httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface HreflangData {
  hasHreflang: boolean;
  entries: HreflangEntry[];
  hasSelfReference: boolean;
  hasXDefault: boolean;
}

export interface HreflangEntry {
  lang: string;
  href: string;
  isValid: boolean;
  isSelfReference: boolean;
  statusCode?: number;
}

// Valid ISO 639-1 language codes (subset of most common)
const VALID_LANG_CODES = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar', 'hi', 'nl', 'sv',
  'pl', 'tr', 'da', 'fi', 'no', 'cs', 'el', 'he', 'hu', 'id', 'ms', 'th', 'vi', 'uk',
  'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'sr', 'ca', 'eu', 'gl', 'af', 'sw',
  'x-default'
]);

function isValidHreflang(lang: string): boolean {
  const parts = lang.toLowerCase().split('-');
  if (parts[0] === 'x' && parts[1] === 'default') return true;
  if (!VALID_LANG_CODES.has(parts[0])) return false;
  // Region codes are optional, just check length if present
  if (parts[1] && parts[1].length !== 2) return false;
  return true;
}

export async function analyzeHreflang(
  html: string,
  url: string,
  options: { validateUrls?: boolean } = {}
): Promise<{ issues: AuditIssue[]; data: HreflangData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const entries: HreflangEntry[] = [];

  // Extract hreflang from link tags
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang') || '';
    const href = $(el).attr('href') || '';
    const isValid = isValidHreflang(lang);
    const isSelfReference = normalizeUrl(href) === normalizeUrl(url);

    entries.push({ lang, href, isValid, isSelfReference });
  });

  // Also check for hreflang in HTTP headers (would need to be passed in)

  const hasHreflang = entries.length > 0;
  const hasSelfReference = entries.some(e => e.isSelfReference);
  const hasXDefault = entries.some(e => e.lang.toLowerCase() === 'x-default');

  const data: HreflangData = {
    hasHreflang,
    entries,
    hasSelfReference,
    hasXDefault,
  };

  if (!hasHreflang) {
    // No hreflang is not necessarily an issue for single-language sites
    return { issues, data };
  }

  // Check for invalid hreflang values
  const invalidEntries = entries.filter(e => !e.isValid);
  if (invalidEntries.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.HREFLANG_INVALID,
      affectedUrls: [url],
      details: { invalidLanguages: invalidEntries.map(e => e.lang) },
    });
  }

  // Check for missing self-reference
  if (!hasSelfReference) {
    issues.push({
      ...ISSUE_DEFINITIONS.HREFLANG_SELF_MISSING,
      affectedUrls: [url],
    });
  }

  // Check for missing x-default
  if (!hasXDefault && entries.length > 1) {
    issues.push({
      ...ISSUE_DEFINITIONS.HREFLANG_X_DEFAULT_MISSING,
      affectedUrls: [url],
    });
  }

  // Validate hreflang URLs if enabled
  if (options.validateUrls) {
    for (const entry of entries) {
      if (!entry.isSelfReference && entry.href) {
        try {
          const response = await httpHead(entry.href, {
            timeout: 5000,
            maxRedirects: 0,
            validateStatus: () => true,
          });
          entry.statusCode = response.status;

          if (response.status >= 300) {
            issues.push({
              ...ISSUE_DEFINITIONS.HREFLANG_TO_NON_200,
              affectedUrls: [url],
              details: {
                targetUrl: entry.href,
                lang: entry.lang,
                statusCode: response.status
              },
            });
          }
        } catch {
          entry.statusCode = 0;
          issues.push({
            ...ISSUE_DEFINITIONS.HREFLANG_TO_NON_200,
            affectedUrls: [url],
            details: {
              targetUrl: entry.href,
              lang: entry.lang,
              statusCode: 'unreachable'
            },
          });
        }
      }
    }

    // Check for reciprocal links
    for (const entry of entries) {
      if (!entry.isSelfReference && entry.href && entry.statusCode === 200) {
        try {
          const response = await httpGet<string>(entry.href, { timeout: 5000 });
          const $target = cheerio.load(response.data);
          const hasReturnLink = $target(`link[rel="alternate"][hreflang][href*="${new URL(url).hostname}"]`).length > 0;

          if (!hasReturnLink) {
            issues.push({
              ...ISSUE_DEFINITIONS.HREFLANG_NO_RETURN,
              affectedUrls: [url],
              details: {
                targetUrl: entry.href,
                lang: entry.lang
              },
            });
          }
        } catch {
          // Skip if can't fetch
        }
      }
    }
  }

  return { issues, data };
}

function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return urlStr;
  }
}
