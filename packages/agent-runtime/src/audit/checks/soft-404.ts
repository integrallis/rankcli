import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface Soft404Data {
  isSoft404: boolean;
  confidence: number;
  signals: string[];
}

// Common error page phrases
const ERROR_PHRASES = [
  'page not found',
  '404',
  'not found',
  'page doesn\'t exist',
  'page does not exist',
  'no longer available',
  'has been removed',
  'has been deleted',
  'couldn\'t find',
  'could not find',
  'doesn\'t exist',
  'does not exist',
  'no results found',
  'nothing found',
  'sorry, we couldn\'t find',
  'oops',
  'error occurred',
  'something went wrong',
  'page you requested',
  'page you were looking for',
  'this page isn\'t available',
  'this page is not available',
  'we can\'t find',
  'we cannot find',
];

// Common error page title patterns
const ERROR_TITLE_PATTERNS = [
  /404/i,
  /not found/i,
  /page.*not.*found/i,
  /error/i,
  /oops/i,
];

export function detectSoft404(
  html: string,
  url: string,
  statusCode: number = 200
): { issues: AuditIssue[]; data: Soft404Data } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const signals: string[] = [];
  let score = 0;

  // Only check pages that return 200
  if (statusCode !== 200) {
    return {
      issues,
      data: { isSoft404: false, confidence: 0, signals: [] },
    };
  }

  const title = $('title').text().toLowerCase();
  const bodyText = $('body').text().toLowerCase().replace(/\s+/g, ' ');
  const h1 = $('h1').first().text().toLowerCase();

  // Check title for error patterns
  for (const pattern of ERROR_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      score += 30;
      signals.push(`Title matches error pattern: "${title.substring(0, 50)}"`);
      break;
    }
  }

  // Check H1 for error patterns
  for (const pattern of ERROR_TITLE_PATTERNS) {
    if (pattern.test(h1)) {
      score += 25;
      signals.push(`H1 matches error pattern: "${h1.substring(0, 50)}"`);
      break;
    }
  }

  // Check body text for error phrases
  let errorPhraseCount = 0;
  for (const phrase of ERROR_PHRASES) {
    if (bodyText.includes(phrase)) {
      errorPhraseCount++;
      if (errorPhraseCount <= 3) {
        signals.push(`Body contains error phrase: "${phrase}"`);
      }
    }
  }
  score += Math.min(errorPhraseCount * 10, 30);

  // Check for very thin content (common in error pages)
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 100) {
    score += 15;
    signals.push(`Very thin content: ${wordCount} words`);
  }

  // Check for search form on error-like pages (common pattern)
  const hasSearchForm = $('form[action*="search"]').length > 0 ||
                        $('input[type="search"]').length > 0 ||
                        $('input[name="q"]').length > 0 ||
                        $('input[name="search"]').length > 0;

  // Search form + error signals = higher soft 404 confidence
  if (hasSearchForm && score > 20) {
    score += 10;
    signals.push('Page has search form (common on 404 pages)');
  }

  // Check for common 404 page CSS classes
  const errorClasses = ['error', '404', 'not-found', 'notfound', 'page-error'];
  for (const cls of errorClasses) {
    if ($(`[class*="${cls}"]`).length > 0) {
      score += 10;
      signals.push(`Found error-related CSS class containing "${cls}"`);
      break;
    }
  }

  // Calculate confidence (0-100)
  const confidence = Math.min(score, 100);
  const isSoft404 = confidence >= 50;

  const data: Soft404Data = {
    isSoft404,
    confidence,
    signals,
  };

  if (isSoft404) {
    issues.push({
      ...ISSUE_DEFINITIONS.SOFT_404,
      affectedUrls: [url],
      details: {
        confidence: `${confidence}%`,
        signals: signals.slice(0, 5),
      },
    });
  }

  return { issues, data };
}
