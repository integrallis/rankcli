// Content Freshness Checks
// Checks for Last-Modified header, article:modified_time, and content staleness

import { httpHead } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface ContentFreshnessData {
  lastModified: Date | null;
  articleModifiedTime: Date | null;
  articlePublishedTime: Date | null;
  ogUpdatedTime: Date | null;
  ageInDays: number | null;
  isStale: boolean;
  source: 'last-modified' | 'og-updated-time' | 'article-modified-time' | 'none';
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch {
    // Invalid date
  }
  return null;
}

/**
 * Calculate age in days from a date
 */
function calculateAgeInDays(date: Date | null): number | null {
  if (!date) return null;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/**
 * Extract date signals from HTML
 */
function extractDatesFromHtml(
  html: string
): Pick<ContentFreshnessData, 'articleModifiedTime' | 'articlePublishedTime' | 'ogUpdatedTime'> {
  const $ = cheerio.load(html);

  const articleModifiedTime = parseDate(
    $('meta[property="article:modified_time"]').attr('content') ||
      $('meta[name="article:modified_time"]').attr('content')
  );

  const articlePublishedTime = parseDate(
    $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="article:published_time"]').attr('content')
  );

  const ogUpdatedTime = parseDate(
    $('meta[property="og:updated_time"]').attr('content') || $('meta[name="og:updated_time"]').attr('content')
  );

  return {
    articleModifiedTime,
    articlePublishedTime,
    ogUpdatedTime,
  };
}

/**
 * Analyze content freshness
 */
export async function analyzeContentFreshness(
  url: string,
  html: string
): Promise<{ issues: AuditIssue[]; data: ContentFreshnessData }> {
  const issues: AuditIssue[] = [];

  // Get Last-Modified from headers
  let lastModified: Date | null = null;

  try {
    const response = await httpHead(url, {
      
      timeout: 10000,
      validateStatus: () => true,
    });

    const lastModifiedHeader = response.headers['last-modified'];
    lastModified = parseDate(lastModifiedHeader);
  } catch {
    // Couldn't fetch headers
  }

  // Extract dates from HTML
  const htmlDates = extractDatesFromHtml(html);

  // Determine the most recent date and its source
  const dates: { date: Date; source: ContentFreshnessData['source'] }[] = [];

  if (lastModified) {
    dates.push({ date: lastModified, source: 'last-modified' });
  }
  if (htmlDates.articleModifiedTime) {
    dates.push({ date: htmlDates.articleModifiedTime, source: 'article-modified-time' });
  }
  if (htmlDates.ogUpdatedTime) {
    dates.push({ date: htmlDates.ogUpdatedTime, source: 'og-updated-time' });
  }

  // Sort by date descending
  dates.sort((a, b) => b.date.getTime() - a.date.getTime());

  const mostRecent = dates[0] || null;
  const ageInDays = mostRecent ? calculateAgeInDays(mostRecent.date) : null;
  const isStale = ageInDays !== null && ageInDays > 365;

  // Generate issues
  if (!lastModified) {
    issues.push({
      ...ISSUE_DEFINITIONS.NO_LAST_MODIFIED,
      affectedUrls: [url],
    });
  }

  if (isStale) {
    issues.push({
      ...ISSUE_DEFINITIONS.CONTENT_STALE,
      affectedUrls: [url],
      details: {
        ageInDays,
        lastModified: mostRecent?.date.toISOString(),
        source: mostRecent?.source,
      },
    });
  }

  // Check for article:modified_time on article pages
  const $ = cheerio.load(html);
  const isArticle =
    $('article').length > 0 ||
    $('meta[property="og:type"][content="article"]').length > 0 ||
    $('meta[property="article:published_time"]').length > 0;

  if (isArticle && !htmlDates.articleModifiedTime && !htmlDates.ogUpdatedTime) {
    issues.push({
      ...ISSUE_DEFINITIONS.OG_UPDATED_TIME_MISSING,
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      lastModified,
      articleModifiedTime: htmlDates.articleModifiedTime,
      articlePublishedTime: htmlDates.articlePublishedTime,
      ogUpdatedTime: htmlDates.ogUpdatedTime,
      ageInDays,
      isStale,
      source: mostRecent?.source || 'none',
    },
  };
}
