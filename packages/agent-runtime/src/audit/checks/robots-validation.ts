/**
 * robots.txt Syntax Validation
 *
 * Validates robots.txt according to Google's specification:
 * https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
 *
 * Valid directives:
 * - User-agent: <bot-name>
 * - Disallow: <path>
 * - Allow: <path>
 * - Sitemap: <url>
 *
 * Common extensions (non-standard but widely supported):
 * - Crawl-delay: <seconds>
 * - Host: <domain> (Yandex)
 */

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface RobotsValidationData {
  exists: boolean;
  isValid: boolean;
  lineCount: number;
  errors: RobotsError[];
  warnings: RobotsWarning[];
  directives: {
    userAgents: string[];
    sitemaps: string[];
    hasWildcardAgent: boolean;
    hasCrawlDelay: boolean;
  };
}

interface RobotsError {
  line: number;
  content: string;
  message: string;
}

interface RobotsWarning {
  line: number;
  content: string;
  message: string;
}

// Standard directives (case-insensitive)
const STANDARD_DIRECTIVES = [
  'user-agent',
  'disallow',
  'allow',
  'sitemap',
];

// Common non-standard but accepted directives
const EXTENDED_DIRECTIVES = [
  'crawl-delay',
  'host',
  'clean-param', // Yandex
  'request-rate', // Some crawlers
];

// All recognized directives
const ALL_DIRECTIVES = [...STANDARD_DIRECTIVES, ...EXTENDED_DIRECTIVES];

export async function validateRobotsTxt(
  url: string
): Promise<{ issues: AuditIssue[]; data: RobotsValidationData }> {
  const issues: AuditIssue[] = [];
  const parsedUrl = new URL(url);
  const robotsUrl = new URL('/robots.txt', parsedUrl.origin).href;

  try {
    const response = await httpGet<string>(robotsUrl, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 404) {
      return {
        issues,
        data: {
          exists: false,
          isValid: true, // Missing is not invalid
          lineCount: 0,
          errors: [],
          warnings: [],
          directives: {
            userAgents: [],
            sitemaps: [],
            hasWildcardAgent: false,
            hasCrawlDelay: false,
          },
        },
      };
    }

    const content = response.data as string;
    const validation = parseAndValidate(content);

    // Generate issues based on validation
    if (validation.errors.length > 0) {
      issues.push({
        code: 'ROBOTS_TXT_INVALID_SYNTAX',
        severity: 'warning',
        category: 'crawlability',
        title: 'robots.txt contains syntax errors',
        description: `Found ${validation.errors.length} syntax error(s) in robots.txt. Invalid syntax may cause crawlers to misinterpret your rules.`,
        impact: 'Search engines may not properly understand your crawling rules, potentially blocking or allowing unintended pages.',
        howToFix: 'Fix the syntax errors in robots.txt. Each directive should be on its own line with format "Directive: value".',
        affectedUrls: [robotsUrl],
        details: {
          errors: validation.errors.map(e => ({
            line: e.line,
            content: e.content,
            message: e.message,
          })),
        },
      });
    }

    if (validation.warnings.length > 0) {
      issues.push({
        code: 'ROBOTS_TXT_WARNINGS',
        severity: 'notice',
        category: 'crawlability',
        title: 'robots.txt has potential issues',
        description: `Found ${validation.warnings.length} warning(s) in robots.txt.`,
        impact: 'Some crawlers may not recognize non-standard directives.',
        howToFix: 'Review the warnings and update if needed.',
        affectedUrls: [robotsUrl],
        details: {
          warnings: validation.warnings.map(w => ({
            line: w.line,
            content: w.content,
            message: w.message,
          })),
        },
      });
    }

    return {
      issues,
      data: {
        exists: true,
        isValid: validation.errors.length === 0,
        lineCount: content.split('\n').length,
        errors: validation.errors,
        warnings: validation.warnings,
        directives: validation.directives,
      },
    };
  } catch (error) {
    return {
      issues,
      data: {
        exists: false,
        isValid: true,
        lineCount: 0,
        errors: [],
        warnings: [],
        directives: {
          userAgents: [],
          sitemaps: [],
          hasWildcardAgent: false,
          hasCrawlDelay: false,
        },
      },
    };
  }
}

function parseAndValidate(content: string): {
  errors: RobotsError[];
  warnings: RobotsWarning[];
  directives: RobotsValidationData['directives'];
} {
  const errors: RobotsError[] = [];
  const warnings: RobotsWarning[] = [];
  const userAgents: string[] = [];
  const sitemaps: string[] = [];
  let hasWildcardAgent = false;
  let hasCrawlDelay = false;

  const lines = content.split('\n');
  let currentUserAgent: string | null = null;
  let hasDirectiveAfterUserAgent = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip empty lines
    if (line === '') {
      continue;
    }

    // Skip comments
    if (line.startsWith('#')) {
      continue;
    }

    // Handle inline comments
    const commentIndex = line.indexOf('#');
    const effectiveLine = commentIndex > 0 ? line.substring(0, commentIndex).trim() : line;

    if (effectiveLine === '') {
      continue;
    }

    // Check for colon (required separator)
    const colonIndex = effectiveLine.indexOf(':');
    if (colonIndex === -1) {
      errors.push({
        line: lineNum,
        content: rawLine,
        message: 'Missing colon separator. Format should be "Directive: value"',
      });
      continue;
    }

    const directive = effectiveLine.substring(0, colonIndex).trim().toLowerCase();
    const value = effectiveLine.substring(colonIndex + 1).trim();

    // Check if directive is recognized
    if (!ALL_DIRECTIVES.includes(directive)) {
      errors.push({
        line: lineNum,
        content: rawLine,
        message: `Unknown directive "${directive}". Valid directives: User-agent, Disallow, Allow, Sitemap`,
      });
      continue;
    }

    // Check for non-standard directives
    if (EXTENDED_DIRECTIVES.includes(directive) && !STANDARD_DIRECTIVES.includes(directive)) {
      warnings.push({
        line: lineNum,
        content: rawLine,
        message: `"${directive}" is a non-standard directive. Not all crawlers support it.`,
      });
    }

    // Directive-specific validation
    switch (directive) {
      case 'user-agent':
        if (value === '') {
          errors.push({
            line: lineNum,
            content: rawLine,
            message: 'User-agent value cannot be empty',
          });
        } else {
          currentUserAgent = value;
          hasDirectiveAfterUserAgent = false;
          if (!userAgents.includes(value)) {
            userAgents.push(value);
          }
          if (value === '*') {
            hasWildcardAgent = true;
          }
        }
        break;

      case 'disallow':
      case 'allow':
        if (currentUserAgent === null) {
          errors.push({
            line: lineNum,
            content: rawLine,
            message: `${directive} must come after a User-agent directive`,
          });
        } else {
          hasDirectiveAfterUserAgent = true;
          // Value can be empty for Disallow (means allow all)
          // Check for invalid characters in path
          if (value && !isValidPath(value)) {
            warnings.push({
              line: lineNum,
              content: rawLine,
              message: `Path "${value}" contains unusual characters`,
            });
          }
        }
        break;

      case 'sitemap':
        // Sitemap can appear anywhere
        if (value === '') {
          errors.push({
            line: lineNum,
            content: rawLine,
            message: 'Sitemap URL cannot be empty',
          });
        } else if (!isValidUrl(value)) {
          errors.push({
            line: lineNum,
            content: rawLine,
            message: `Invalid sitemap URL: "${value}"`,
          });
        } else {
          sitemaps.push(value);
        }
        break;

      case 'crawl-delay':
        hasCrawlDelay = true;
        if (currentUserAgent === null) {
          warnings.push({
            line: lineNum,
            content: rawLine,
            message: 'Crawl-delay should come after a User-agent directive',
          });
        }
        if (value === '' || isNaN(parseFloat(value))) {
          errors.push({
            line: lineNum,
            content: rawLine,
            message: 'Crawl-delay must be a number',
          });
        }
        break;

      case 'host':
        // Yandex-specific, should be a valid domain
        if (value === '') {
          errors.push({
            line: lineNum,
            content: rawLine,
            message: 'Host value cannot be empty',
          });
        }
        break;
    }
  }

  return {
    errors,
    warnings,
    directives: {
      userAgents,
      sitemaps,
      hasWildcardAgent,
      hasCrawlDelay,
    },
  };
}

function isValidPath(path: string): boolean {
  // Basic path validation
  // Paths should start with / or be * or $
  if (path === '' || path === '*' || path === '$') {
    return true;
  }
  if (!path.startsWith('/') && !path.startsWith('*')) {
    return false;
  }
  // Check for obviously invalid characters
  if (/[\x00-\x1f]/.test(path)) {
    return false;
  }
  return true;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
