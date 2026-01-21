// Freshness Signals & QDF Optimization
// Reference: "Query Deserves Freshness" Google algorithm
// AI assistants cite content 25.7% fresher than organic results
// dateModified in schema boosts AI citation odds by ~18%

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface FreshnessSignalsData {
  dateSignals: {
    hasDatePublished: boolean;
    hasDateModified: boolean;
    hasSchemaDatePublished: boolean;
    hasSchemaDateModified: boolean;
    visibleDateOnPage: string | null;
    schemaDatePublished: string | null;
    schemaDateModified: string | null;
    daysSincePublished: number | null;
    daysSinceModified: number | null;
  };
  freshnessIndicators: {
    hasCurrentYearMention: boolean;
    hasRecentDateReferences: boolean;
    hasUpdateNotice: boolean;
    hasChangeLog: boolean;
    hasVersionNumber: boolean;
    contentFreshnessSignal: 'fresh' | 'dated' | 'evergreen' | 'unknown';
  };
  qdfRelevance: {
    isLikelyQDFTopic: boolean;
    qdfIndicators: string[];
    updateFrequencyRecommendation: string;
  };
  aiCitationOptimization: {
    hasLastUpdatedMeta: boolean;
    hasClearDateFormat: boolean;
    freshnessSchemaComplete: boolean;
    aiCitationReadiness: 'high' | 'medium' | 'low';
  };
  freshnessScore: number; // 0-100
  recommendations: string[];
}

/**
 * Extract date signals from page
 */
function extractDateSignals($: cheerio.CheerioAPI, html: string): FreshnessSignalsData['dateSignals'] {
  const now = new Date();

  // Look for dates in schema
  let schemaDatePublished: string | null = null;
  let schemaDateModified: string | null = null;
  let hasSchemaDatePublished = false;
  let hasSchemaDateModified = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).html() || '';
      const data = JSON.parse(content);

      const processSchema = (schema: Record<string, unknown>) => {
        if (schema.datePublished) {
          hasSchemaDatePublished = true;
          schemaDatePublished = schema.datePublished as string;
        }
        if (schema.dateModified) {
          hasSchemaDateModified = true;
          schemaDateModified = schema.dateModified as string;
        }
      };

      if (Array.isArray(data)) {
        data.forEach(item => processSchema(item as Record<string, unknown>));
      } else if (data['@graph']) {
        (data['@graph'] as Record<string, unknown>[]).forEach(processSchema);
      } else {
        processSchema(data);
      }
    } catch {
      // Invalid JSON
    }
  });

  // Look for meta tags with dates
  const metaDatePublished = $('meta[property="article:published_time"], meta[name="date"], meta[name="pubdate"]').attr('content');
  const metaDateModified = $('meta[property="article:modified_time"], meta[name="lastmod"]').attr('content');

  // Look for visible date on page
  const datePatterns = [
    /(?:published|posted|written|created)(?:\s+on)?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i,
    /(?:updated|modified|last\s+updated|revised)(?:\s+on)?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  const bodyText = $('body').text();
  let visibleDateOnPage: string | null = null;

  for (const pattern of datePatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      visibleDateOnPage = match[1] || match[0];
      break;
    }
  }

  // Calculate days since dates
  let daysSincePublished: number | null = null;
  let daysSinceModified: number | null = null;

  const publishedDate = schemaDatePublished || metaDatePublished;
  if (publishedDate) {
    try {
      const date = new Date(publishedDate);
      daysSincePublished = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      // Invalid date
    }
  }

  const modifiedDate = schemaDateModified || metaDateModified;
  if (modifiedDate) {
    try {
      const date = new Date(modifiedDate);
      daysSinceModified = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      // Invalid date
    }
  }

  return {
    hasDatePublished: !!(metaDatePublished || schemaDatePublished),
    hasDateModified: !!(metaDateModified || schemaDateModified),
    hasSchemaDatePublished,
    hasSchemaDateModified,
    visibleDateOnPage,
    schemaDatePublished,
    schemaDateModified,
    daysSincePublished,
    daysSinceModified,
  };
}

/**
 * Analyze freshness indicators in content
 */
function analyzeFreshnessIndicators($: cheerio.CheerioAPI, html: string): FreshnessSignalsData['freshnessIndicators'] {
  const bodyText = $('body').text();
  const title = $('title').text();
  const currentYear = new Date().getFullYear();

  // Check for current year mention
  const hasCurrentYearMention =
    bodyText.includes(currentYear.toString()) ||
    title.includes(currentYear.toString());

  // Check for recent date references (within last 6 months)
  const recentDatePatterns = [
    new RegExp(`(${currentYear}|${currentYear - 1})`),
    /this year|this month|recently|latest|newest|updated/i,
  ];
  const hasRecentDateReferences = recentDatePatterns.some(p => p.test(bodyText));

  // Check for update notice
  const hasUpdateNotice =
    /updated?:?\s*(on|in)?\s*\w+\s+\d{1,2},?\s+\d{4}/i.test(bodyText) ||
    /last\s+(?:updated|modified|revised)/i.test(bodyText) ||
    $('[class*="update"], [class*="modified"]').length > 0;

  // Check for changelog
  const hasChangeLog =
    /changelog|change\s+log|revision\s+history|update\s+history/i.test(bodyText) ||
    $('[id*="changelog"], [class*="changelog"]').length > 0;

  // Check for version number
  const hasVersionNumber = /v?\d+\.\d+(\.\d+)?|version\s+\d+/i.test(bodyText);

  // Determine content freshness signal
  let contentFreshnessSignal: 'fresh' | 'dated' | 'evergreen' | 'unknown' = 'unknown';

  if (hasCurrentYearMention && hasRecentDateReferences) {
    contentFreshnessSignal = 'fresh';
  } else if (/\d{4}/.test(title) && !new RegExp(`(${currentYear}|${currentYear - 1})`).test(title)) {
    contentFreshnessSignal = 'dated';
  } else if (/guide|tutorial|how\s+to|tips|basics|fundamentals/i.test(title)) {
    contentFreshnessSignal = 'evergreen';
  }

  return {
    hasCurrentYearMention,
    hasRecentDateReferences,
    hasUpdateNotice,
    hasChangeLog,
    hasVersionNumber,
    contentFreshnessSignal,
  };
}

/**
 * Analyze QDF relevance
 */
function analyzeQDFRelevance($: cheerio.CheerioAPI, html: string): FreshnessSignalsData['qdfRelevance'] {
  const title = $('title').text().toLowerCase();
  const bodyText = $('body').text().toLowerCase();

  const qdfIndicators: string[] = [];
  let updateFrequency = 'monthly';

  // QDF topic patterns
  if (/news|breaking|announcement|release|launch/i.test(title)) {
    qdfIndicators.push('News/announcement topic');
    updateFrequency = 'daily';
  }
  if (/\d{4}|trends?|statistics?|data|report/i.test(title)) {
    qdfIndicators.push('Year-specific or data content');
    updateFrequency = 'quarterly';
  }
  if (/review|comparison|vs\.?|alternative/i.test(title)) {
    qdfIndicators.push('Review/comparison content');
    updateFrequency = 'monthly';
  }
  if (/price|pricing|cost/i.test(title)) {
    qdfIndicators.push('Pricing information');
    updateFrequency = 'monthly';
  }
  if (/best|top\s+\d+/i.test(title)) {
    qdfIndicators.push('Best-of list content');
    updateFrequency = 'quarterly';
  }
  if (/election|score|result|update/i.test(bodyText)) {
    qdfIndicators.push('Time-sensitive topic signals');
    updateFrequency = 'weekly';
  }

  return {
    isLikelyQDFTopic: qdfIndicators.length > 0,
    qdfIndicators,
    updateFrequencyRecommendation: updateFrequency,
  };
}

/**
 * Analyze AI citation optimization
 */
function analyzeAICitationOptimization(
  dateSignals: FreshnessSignalsData['dateSignals'],
  freshnessIndicators: FreshnessSignalsData['freshnessIndicators']
): FreshnessSignalsData['aiCitationOptimization'] {
  const hasLastUpdatedMeta = dateSignals.hasSchemaDateModified || dateSignals.hasDateModified;
  const hasClearDateFormat = !!(dateSignals.schemaDatePublished || dateSignals.schemaDateModified);
  const freshnessSchemaComplete = dateSignals.hasSchemaDatePublished && dateSignals.hasSchemaDateModified;

  let readinessScore = 0;
  if (hasLastUpdatedMeta) readinessScore += 30;
  if (hasClearDateFormat) readinessScore += 20;
  if (freshnessSchemaComplete) readinessScore += 30;
  if (freshnessIndicators.hasCurrentYearMention) readinessScore += 10;
  if (freshnessIndicators.hasUpdateNotice) readinessScore += 10;

  const aiCitationReadiness = readinessScore >= 70 ? 'high' : readinessScore >= 40 ? 'medium' : 'low';

  return {
    hasLastUpdatedMeta,
    hasClearDateFormat,
    freshnessSchemaComplete,
    aiCitationReadiness,
  };
}

/**
 * Calculate overall freshness score
 */
function calculateFreshnessScore(
  dateSignals: FreshnessSignalsData['dateSignals'],
  freshnessIndicators: FreshnessSignalsData['freshnessIndicators'],
  aiOptimization: FreshnessSignalsData['aiCitationOptimization']
): number {
  let score = 50; // Baseline

  // Date signals (max +30)
  if (dateSignals.hasSchemaDatePublished) score += 10;
  if (dateSignals.hasSchemaDateModified) score += 15;
  if (dateSignals.visibleDateOnPage) score += 5;

  // Freshness indicators (max +30)
  if (freshnessIndicators.hasCurrentYearMention) score += 10;
  if (freshnessIndicators.hasUpdateNotice) score += 10;
  if (freshnessIndicators.contentFreshnessSignal === 'fresh') score += 10;
  else if (freshnessIndicators.contentFreshnessSignal === 'dated') score -= 20;

  // Recency penalty/boost
  if (dateSignals.daysSinceModified !== null) {
    if (dateSignals.daysSinceModified < 30) score += 10;
    else if (dateSignals.daysSinceModified < 90) score += 5;
    else if (dateSignals.daysSinceModified > 365) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Main function: Analyze freshness signals
 */
export function analyzeFreshnessSignals(
  html: string,
  url: string
): { issues: AuditIssue[]; data: FreshnessSignalsData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];

  // Run all analyses
  const dateSignals = extractDateSignals($, html);
  const freshnessIndicators = analyzeFreshnessIndicators($, html);
  const qdfRelevance = analyzeQDFRelevance($, html);
  const aiCitationOptimization = analyzeAICitationOptimization(dateSignals, freshnessIndicators);

  // Calculate score
  const freshnessScore = calculateFreshnessScore(
    dateSignals,
    freshnessIndicators,
    aiCitationOptimization
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (!dateSignals.hasSchemaDateModified) {
    recommendations.push('Add dateModified to schema - boosts AI citation odds by ~18%');
  }
  if (qdfRelevance.isLikelyQDFTopic && !freshnessIndicators.hasUpdateNotice) {
    recommendations.push(`This QDF topic should be updated ${qdfRelevance.updateFrequencyRecommendation}`);
  }
  if (!freshnessIndicators.hasCurrentYearMention && /\d{4}/.test($('title').text())) {
    recommendations.push('Update year references in title and content for freshness signals');
  }

  // Generate issues

  // No dateModified schema
  if (!dateSignals.hasSchemaDateModified) {
    issues.push({
      code: 'NO_DATE_MODIFIED_SCHEMA',
      severity: 'warning',
      category: 'structured-data',
      title: 'Missing dateModified in schema',
      description: 'Schema markup lacks dateModified property.',
      impact: 'dateModified signals content freshness to search engines and AI assistants, boosting citation odds by ~18%.',
      howToFix: 'Add dateModified property to your Article/WebPage schema with ISO 8601 format.',
      affectedUrls: [url],
      details: {
        hasDatePublished: dateSignals.hasSchemaDatePublished,
      },
    });
  }

  // Dated content on QDF topic
  if (qdfRelevance.isLikelyQDFTopic && dateSignals.daysSinceModified && dateSignals.daysSinceModified > 180) {
    issues.push({
      code: 'STALE_QDF_CONTENT',
      severity: 'warning',
      category: 'content',
      title: 'Time-sensitive content may be stale',
      description: `Content was last modified ${dateSignals.daysSinceModified} days ago on a topic that benefits from freshness.`,
      impact: 'Query Deserves Freshness (QDF) prioritizes fresh content for this topic type.',
      howToFix: `Update this content ${qdfRelevance.updateFrequencyRecommendation}. Add new data, stats, or insights.`,
      affectedUrls: [url],
      details: {
        daysSinceModified: dateSignals.daysSinceModified,
        qdfIndicators: qdfRelevance.qdfIndicators,
        updateFrequency: qdfRelevance.updateFrequencyRecommendation,
      },
    });
  }

  // Outdated year in title
  const title = $('title').text();
  const currentYear = new Date().getFullYear();
  const yearMatch = title.match(/20\d{2}/);
  if (yearMatch && parseInt(yearMatch[0]) < currentYear - 1) {
    issues.push({
      code: 'OUTDATED_YEAR_IN_TITLE',
      severity: 'warning',
      category: 'on-page',
      title: 'Title contains outdated year',
      description: `Title mentions ${yearMatch[0]} but current year is ${currentYear}.`,
      impact: 'Outdated years in titles signal stale content and reduce CTR.',
      howToFix: `Update title to ${currentYear} and refresh the content to match.`,
      affectedUrls: [url],
      details: {
        yearInTitle: yearMatch[0],
        currentYear,
      },
    });
  }

  // No visible date on content page
  if (!dateSignals.visibleDateOnPage && /blog|article|post|news/i.test(url)) {
    issues.push({
      code: 'NO_VISIBLE_DATE',
      severity: 'notice',
      category: 'content',
      title: 'No visible publish/update date',
      description: 'Content page lacks a visible date for users.',
      impact: 'Users prefer seeing when content was published/updated for credibility.',
      howToFix: 'Display publish date and last updated date on the page.',
      affectedUrls: [url],
    });
  }

  // Low AI citation readiness
  if (aiCitationOptimization.aiCitationReadiness === 'low' && qdfRelevance.isLikelyQDFTopic) {
    issues.push({
      code: 'LOW_AI_CITATION_READINESS',
      severity: 'notice',
      category: 'content',
      title: 'Low AI citation readiness for fresh content',
      description: 'This page lacks freshness signals that AI assistants prioritize.',
      impact: 'AI assistants cite content 25.7% fresher than organic results. Missing signals reduce citation odds.',
      howToFix: 'Add dateModified schema, visible update date, and current year mentions.',
      affectedUrls: [url],
      details: {
        aiCitationReadiness: aiCitationOptimization.aiCitationReadiness,
        missingSignals: [
          !dateSignals.hasSchemaDateModified && 'dateModified schema',
          !freshnessIndicators.hasUpdateNotice && 'visible update notice',
          !freshnessIndicators.hasCurrentYearMention && 'current year mention',
        ].filter(Boolean),
      },
    });
  }

  return {
    issues,
    data: {
      dateSignals,
      freshnessIndicators,
      qdfRelevance,
      aiCitationOptimization,
      freshnessScore,
      recommendations,
    },
  };
}
