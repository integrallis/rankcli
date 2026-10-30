// NavBoost & User Signal Optimization
// Reference: Google Algorithm Leak 2024 + DOJ vs Google Antitrust Trial
// NavBoost uses memorized click data over 13 months
// "goodClicks", "badClicks", "lastLongestClicks" - confirmed ranking signals
// Bounce rate >70% + session <30 seconds = quality signal problem

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface NavBoostSignalsData {
  clickOptimization: {
    hasClearTitle: boolean;
    hasCompellingMetaDesc: boolean;
    titleTruncated: boolean;
    metaDescTruncated: boolean;
    estimatedCTRPotential: 'high' | 'medium' | 'low';
  };
  engagementSignals: {
    hasTableOfContents: boolean;
    hasJumpLinks: boolean;
    estimatedScrollDepth: 'deep' | 'medium' | 'shallow';
    hasProgressIndicator: boolean;
    hasStickyNavigation: boolean;
    contentSections: number;
  };
  bounceRiskFactors: {
    hasAboveFoldContent: boolean;
    hasSlowLoadingIndicators: boolean;
    hasPopupRisk: boolean;
    hasIntrusiveAds: boolean;
    contentMatchesTitle: boolean;
    hasImmediateValue: boolean;
  };
  dwellTimeFactors: {
    estimatedReadTime: number; // minutes
    hasVideo: boolean;
    hasInteractiveElements: boolean;
    contentDepth: 'comprehensive' | 'moderate' | 'thin';
    hasRelatedContent: boolean;
  };
  overallNavBoostScore: number; // 0-100
  recommendations: string[];
}

/**
 * Analyze title and meta description for CTR optimization
 */
function analyzeClickOptimization($: cheerio.CheerioAPI): NavBoostSignalsData['clickOptimization'] {
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';

  // Title analysis
  const hasClearTitle = title.length > 10 && title.length <= 60;
  const titleTruncated = title.length > 60;

  // Meta description analysis
  const hasCompellingMetaDesc = metaDesc.length >= 70 && metaDesc.length <= 160;
  const metaDescTruncated = metaDesc.length > 160;

  // CTR potential indicators
  const hasPowerWords = /free|best|guide|how to|ultimate|proven|secret|new|exclusive/i.test(title + ' ' + metaDesc);
  const hasNumbers = /\d+/.test(title);
  const hasYear = /202[4-9]|203\d/.test(title + ' ' + metaDesc);

  let ctrScore = 0;
  if (hasClearTitle) ctrScore += 2;
  if (hasCompellingMetaDesc) ctrScore += 2;
  if (hasPowerWords) ctrScore += 1;
  if (hasNumbers) ctrScore += 1;
  if (hasYear) ctrScore += 1;

  const estimatedCTRPotential = ctrScore >= 5 ? 'high' : ctrScore >= 3 ? 'medium' : 'low';

  return {
    hasClearTitle,
    hasCompellingMetaDesc,
    titleTruncated,
    metaDescTruncated,
    estimatedCTRPotential,
  };
}

/**
 * Analyze engagement signals that affect NavBoost
 */
function analyzeEngagementSignals($: cheerio.CheerioAPI, html: string): NavBoostSignalsData['engagementSignals'] {
  // Table of contents detection
  const hasTableOfContents =
    $('[class*="toc"], [id*="toc"], [class*="table-of-contents"], nav[aria-label*="content"]').length > 0 ||
    $('a[href^="#"]').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return /^(\d+\.?\s*)?[a-z]/i.test(text) && text.length > 3;
    }).length >= 3;

  // Jump links (in-page navigation)
  const hasJumpLinks = $('a[href^="#"]').length >= 3;

  // Count content sections (H2s as proxy)
  const contentSections = $('h2, h3').length;

  // Scroll depth estimation based on content length
  const bodyText = $('body').text();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
  const estimatedScrollDepth = wordCount > 2000 ? 'deep' : wordCount > 800 ? 'medium' : 'shallow';

  // Progress indicator
  const hasProgressIndicator =
    $('[class*="progress"], [class*="reading-progress"], [role="progressbar"]').length > 0;

  // Sticky navigation
  const hasStickyNavigation =
    $('[class*="sticky"], [class*="fixed"], [style*="position: sticky"], [style*="position: fixed"]').filter((_, el) => {
      return $(el).find('nav, a').length > 0;
    }).length > 0;

  return {
    hasTableOfContents,
    hasJumpLinks,
    estimatedScrollDepth,
    hasProgressIndicator,
    hasStickyNavigation,
    contentSections,
  };
}

/**
 * Analyze bounce risk factors
 */
function analyzeBounceRiskFactors($: cheerio.CheerioAPI, html: string): NavBoostSignalsData['bounceRiskFactors'] {
  const title = $('title').text().toLowerCase();
  const h1 = $('h1').first().text().toLowerCase();
  const firstParagraph = $('p').first().text().toLowerCase();

  // Above fold content check
  const hasAboveFoldContent =
    $('h1').length > 0 &&
    ($('p').first().text().length > 50 ||
     $('main, article, .content').first().text().length > 100);

  // Slow loading indicators (large images, heavy scripts)
  const hasSlowLoadingIndicators =
    $('script[src*="bundle"], script[src*="vendor"]').length > 5 ||
    $('img:not([loading="lazy"])').length > 10;

  // Popup risk
  const hasPopupRisk =
    html.includes('modal') ||
    html.includes('popup') ||
    html.includes('newsletter-overlay') ||
    $('[class*="popup"], [class*="modal"]').length > 0;

  // Intrusive ads
  const hasIntrusiveAds =
    $('[class*="ad-"], [id*="ad-"], [class*="advertisement"]').length > 3 ||
    html.includes('interstitial');

  // Content-title match (basic check)
  const titleWords = title.split(/\s+/).filter(w => w.length > 3);
  const matchingWords = titleWords.filter(w =>
    h1.includes(w) || firstParagraph.includes(w)
  );
  const contentMatchesTitle = matchingWords.length >= Math.ceil(titleWords.length * 0.5);

  // Immediate value (answer in first paragraph)
  const hasImmediateValue =
    firstParagraph.length > 100 ||
    $('main p, article p').first().text().length > 100;

  return {
    hasAboveFoldContent,
    hasSlowLoadingIndicators,
    hasPopupRisk,
    hasIntrusiveAds,
    contentMatchesTitle,
    hasImmediateValue,
  };
}

/**
 * Analyze dwell time factors
 */
function analyzeDwellTimeFactors($: cheerio.CheerioAPI, html: string): NavBoostSignalsData['dwellTimeFactors'] {
  const bodyText = $('main, article, .content, body').text();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Estimated read time (200 words per minute average)
  const estimatedReadTime = Math.ceil(wordCount / 200);

  // Video presence
  const hasVideo =
    $('video, iframe[src*="youtube"], iframe[src*="vimeo"], [class*="video"]').length > 0;

  // Interactive elements
  const hasInteractiveElements =
    $('form, [class*="calculator"], [class*="quiz"], [class*="interactive"], input, select').length > 0;

  // Content depth
  const contentDepth = wordCount > 2000 ? 'comprehensive' : wordCount > 800 ? 'moderate' : 'thin';

  // Related content
  const hasRelatedContent =
    $('[class*="related"], [class*="recommended"], [class*="similar"]').length > 0 ||
    $('a').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('related') || text.includes('see also') || text.includes('read next');
    }).length > 0;

  return {
    estimatedReadTime,
    hasVideo,
    hasInteractiveElements,
    contentDepth,
    hasRelatedContent,
  };
}

/**
 * Calculate overall NavBoost optimization score
 */
function calculateNavBoostScore(
  click: NavBoostSignalsData['clickOptimization'],
  engagement: NavBoostSignalsData['engagementSignals'],
  bounce: NavBoostSignalsData['bounceRiskFactors'],
  dwell: NavBoostSignalsData['dwellTimeFactors']
): number {
  let score = 50; // Start at baseline

  // Click optimization (max +20)
  if (click.estimatedCTRPotential === 'high') score += 20;
  else if (click.estimatedCTRPotential === 'medium') score += 10;
  if (click.titleTruncated) score -= 5;
  if (click.metaDescTruncated) score -= 3;

  // Engagement signals (max +20)
  if (engagement.hasTableOfContents) score += 10;
  if (engagement.hasJumpLinks) score += 5;
  if (engagement.contentSections >= 5) score += 5;

  // Bounce risk (max -20)
  if (!bounce.hasAboveFoldContent) score -= 10;
  if (bounce.hasPopupRisk) score -= 5;
  if (bounce.hasIntrusiveAds) score -= 10;
  if (!bounce.contentMatchesTitle) score -= 5;
  if (bounce.hasImmediateValue) score += 5;

  // Dwell time factors (max +20)
  if (dwell.hasVideo) score += 10;
  if (dwell.hasInteractiveElements) score += 5;
  if (dwell.contentDepth === 'comprehensive') score += 5;
  else if (dwell.contentDepth === 'thin') score -= 5;
  if (dwell.hasRelatedContent) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Main function: Analyze NavBoost optimization signals
 */
export function analyzeNavBoostSignals(
  html: string,
  url: string
): { issues: AuditIssue[]; data: NavBoostSignalsData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];

  // Run all analyses
  const clickOptimization = analyzeClickOptimization($);
  const engagementSignals = analyzeEngagementSignals($, html);
  const bounceRiskFactors = analyzeBounceRiskFactors($, html);
  const dwellTimeFactors = analyzeDwellTimeFactors($, html);

  // Calculate overall score
  const overallNavBoostScore = calculateNavBoostScore(
    clickOptimization,
    engagementSignals,
    bounceRiskFactors,
    dwellTimeFactors
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (clickOptimization.estimatedCTRPotential !== 'high') {
    recommendations.push('Optimize title/meta for higher CTR: use power words, numbers, or current year');
  }
  if (!engagementSignals.hasTableOfContents && engagementSignals.contentSections >= 5) {
    recommendations.push('Add table of contents for long-form content to improve engagement');
  }
  if (bounceRiskFactors.hasPopupRisk) {
    recommendations.push('Delay or remove popup modals to reduce bounce rate');
  }
  if (!dwellTimeFactors.hasRelatedContent) {
    recommendations.push('Add related content section to increase session duration');
  }

  // Generate issues

  // Low CTR potential
  if (clickOptimization.estimatedCTRPotential === 'low') {
    issues.push({
      code: 'LOW_CTR_POTENTIAL',
      severity: 'warning',
      category: 'on-page',
      title: 'Title and meta description have low CTR potential',
      description: 'The title and meta description lack compelling elements that drive clicks.',
      impact: 'NavBoost uses click data as a ranking signal. Higher CTR improves rankings over time.',
      howToFix: 'Add power words (free, best, ultimate), numbers, or current year to increase CTR.',
      affectedUrls: [url],
      details: {
        ctrPotential: clickOptimization.estimatedCTRPotential,
        titleTruncated: clickOptimization.titleTruncated,
      },
    });
  }

  // High bounce risk
  if (!bounceRiskFactors.hasAboveFoldContent || !bounceRiskFactors.hasImmediateValue) {
    issues.push({
      code: 'HIGH_BOUNCE_RISK',
      // A notice: a heuristic score, not a defect a crawler can see, and it fired on most sites.
      severity: 'notice',
      category: 'content',
      title: 'Page has high bounce risk signals',
      description: 'The page lacks above-fold content or immediate value for visitors.',
      impact: 'NavBoost tracks bounce rate. >70% bounce with <30s sessions hurts rankings.',
      howToFix: 'Add compelling content above the fold that delivers immediate value to visitors.',
      affectedUrls: [url],
      details: {
        hasAboveFoldContent: bounceRiskFactors.hasAboveFoldContent,
        hasImmediateValue: bounceRiskFactors.hasImmediateValue,
      },
    });
  }

  // Popup/interstitial risk
  if (bounceRiskFactors.hasPopupRisk) {
    issues.push({
      code: 'POPUP_BOUNCE_RISK',
      severity: 'notice',
      category: 'content',
      title: 'Popup/modal detected - potential bounce risk',
      description: 'Popups detected that may cause visitors to leave immediately.',
      impact: 'Intrusive interstitials increase bounce rate and hurt NavBoost signals.',
      howToFix: 'Delay popups by 30+ seconds, or use exit-intent only. Avoid fullscreen overlays.',
      affectedUrls: [url],
    });
  }

  // Thin content with low dwell time
  if (dwellTimeFactors.contentDepth === 'thin' && dwellTimeFactors.estimatedReadTime < 3) {
    issues.push({
      code: 'LOW_DWELL_TIME_CONTENT',
      severity: 'notice',
      category: 'content',
      title: 'Thin content may result in low dwell time',
      description: `Estimated read time is only ${dwellTimeFactors.estimatedReadTime} minute(s).`,
      impact: 'Google tracks "lastLongestClicks" - longer sessions signal quality content.',
      howToFix: 'Add comprehensive content, videos, or interactive elements to increase time on page.',
      affectedUrls: [url],
      details: {
        estimatedReadTime: dwellTimeFactors.estimatedReadTime,
        contentDepth: dwellTimeFactors.contentDepth,
      },
    });
  }

  // Long content without navigation aids
  if (engagementSignals.estimatedScrollDepth === 'deep' && !engagementSignals.hasTableOfContents) {
    issues.push({
      code: 'LONG_CONTENT_NO_TOC',
      severity: 'notice',
      category: 'content',
      title: 'Long content lacks table of contents',
      description: 'Long-form content without navigation aids may cause users to abandon the page.',
      impact: 'Table of contents improves engagement signals by helping users find relevant sections.',
      howToFix: 'Add a table of contents with jump links to major sections.',
      affectedUrls: [url],
      details: {
        contentSections: engagementSignals.contentSections,
        scrollDepth: engagementSignals.estimatedScrollDepth,
      },
    });
  }

  return {
    issues,
    data: {
      clickOptimization,
      engagementSignals,
      bounceRiskFactors,
      dwellTimeFactors,
      overallNavBoostScore,
      recommendations,
    },
  };
}
