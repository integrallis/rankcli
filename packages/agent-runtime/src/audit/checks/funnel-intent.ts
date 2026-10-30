// Search Funnel Intent Analysis
// Reference: "6 Advanced SEO Tips for 2026"
// "Stop relying on top of funnel search terms"
// "TOFU, MOFU, BOFU - focus on middle and bottom of funnel"
// "AI overviews answer informational queries - focus on money keywords"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export type FunnelStage = 'tofu' | 'mofu' | 'bofu' | 'mixed';

export interface FunnelIntentData {
  detectedStage: FunnelStage;
  confidence: number; // 0-100
  signals: {
    tofu: string[];
    mofu: string[];
    bofu: string[];
  };
  metrics: {
    informationalScore: number;
    considerationScore: number;
    conversionScore: number;
  };
  pageType: string;
  aiOverviewRisk: 'high' | 'medium' | 'low';
  recommendations: string[];
}

// TOFU (Top of Funnel) - Informational intent patterns
const TOFU_PATTERNS = {
  url: [
    /\/blog\//i,
    /\/article/i,
    /\/guide/i,
    /\/tutorial/i,
    /\/how-to/i,
    /\/what-is/i,
    /\/learn/i,
    /\/tips/i,
    /\/explained/i,
    /\/introduction/i,
    /\/beginners?/i,
  ],
  title: [
    /^how to/i,
    /^what is/i,
    /^what are/i,
    /^why /i,
    /^when /i,
    /^guide to/i,
    /complete guide/i,
    /beginner'?s? guide/i,
    /ultimate guide/i,
    /\d+ tips/i,
    /\d+ ways/i,
    /\d+ things/i,
    /explained/i,
    /introduction to/i,
    /learn /i,
    /understanding/i,
  ],
  content: [
    /in this article/i,
    /in this guide/i,
    /we'll explain/i,
    /we'll cover/i,
    /you'll learn/i,
    /let's explore/i,
    /let's dive/i,
    /did you know/i,
    /according to/i,
    /research shows/i,
    /studies show/i,
  ],
};

// MOFU (Middle of Funnel) - Consideration/comparison intent patterns
const MOFU_PATTERNS = {
  url: [
    /\/compare/i,
    /\/comparison/i,
    /\/vs/i,
    /\/versus/i,
    /\/alternative/i,
    /\/review/i,
    /\/pros-cons/i,
    /\/features/i,
    /\/solutions/i,
    /\/case-stud/i,
  ],
  title: [
    /vs\.?$/i,
    /versus/i,
    /comparison/i,
    /compared/i,
    /alternative/i,
    /review/i,
    /pros and cons/i,
    /which is better/i,
    /best .* for/i,
    /top \d+/i,
    /\d+ best/i,
    /how .* compares/i,
    /should you/i,
  ],
  content: [
    /let'?s compare/i,
    /in comparison/i,
    /alternative to/i,
    /pros:/i,
    /cons:/i,
    /advantages:/i,
    /disadvantages:/i,
    /key features/i,
    /feature comparison/i,
    /case study/i,
    /our client/i,
    /we helped/i,
  ],
};

// BOFU (Bottom of Funnel) - Conversion/purchase intent patterns
const BOFU_PATTERNS = {
  url: [
    /\/pricing/i,
    /\/buy/i,
    /\/purchase/i,
    /\/order/i,
    /\/sign-?up/i,
    /\/register/i,
    /\/demo/i,
    /\/trial/i,
    /\/quote/i,
    /\/contact/i,
    /\/get-started/i,
    /\/checkout/i,
    /\/hire/i,
    /\/services?$/i,
  ],
  title: [
    /pricing/i,
    /buy /i,
    /purchase/i,
    /order /i,
    /sign up/i,
    /get started/i,
    /free trial/i,
    /request .* demo/i,
    /book .* call/i,
    /schedule/i,
    /get .* quote/i,
    /contact us/i,
    /hire /i,
    /\$\d+/,
    /per month/i,
    /\/mo\b/i,
  ],
  content: [
    /add to cart/i,
    /buy now/i,
    /purchase now/i,
    /sign up now/i,
    /get started/i,
    /start.*trial/i,
    /request.*demo/i,
    /book.*call/i,
    /schedule.*meeting/i,
    /contact.*today/i,
    /limited.*offer/i,
    /special.*price/i,
    /money.*back.*guarantee/i,
    /free.*shipping/i,
    /plans.*pricing/i,
    /per user/i,
    /per month/i,
    /billed annually/i,
    /\$\d+/,
  ],
  elements: [
    'form[action*="checkout"]',
    'form[action*="purchase"]',
    'form[action*="subscribe"]',
    'button[data-action="buy"]',
    '[class*="pricing-table"]',
    '[class*="price-card"]',
    '[class*="checkout"]',
    '[class*="add-to-cart"]',
  ],
};

/**
 * Calculate score for a funnel stage based on pattern matches
 */
function calculateStageScore(
  url: string,
  title: string,
  content: string,
  $: cheerio.CheerioAPI,
  patterns: {
    url: RegExp[];
    title: RegExp[];
    content: RegExp[];
    elements?: string[];
  }
): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // URL patterns (weighted highest)
  for (const pattern of patterns.url) {
    if (pattern.test(url)) {
      score += 15;
      signals.push(`URL: ${pattern.source}`);
    }
  }

  // Title patterns (high weight)
  for (const pattern of patterns.title) {
    if (pattern.test(title)) {
      score += 12;
      signals.push(`Title: ${pattern.source}`);
    }
  }

  // Content patterns (medium weight)
  for (const pattern of patterns.content) {
    if (pattern.test(content)) {
      score += 5;
      signals.push(`Content: ${pattern.source}`);
    }
  }

  // Element patterns (BOFU only)
  if (patterns.elements) {
    for (const selector of patterns.elements) {
      if ($(selector).length > 0) {
        score += 10;
        signals.push(`Element: ${selector}`);
      }
    }
  }

  return { score, signals: signals.slice(0, 5) }; // Limit signals for readability
}

/**
 * Determine page type based on content
 */
function determinePageType($: cheerio.CheerioAPI, url: string): string {
  // Check URL first
  if (/\/blog\//i.test(url)) return 'blog-post';
  if (/\/product/i.test(url)) return 'product-page';
  if (/\/services?/i.test(url)) return 'service-page';
  if (/\/pricing/i.test(url)) return 'pricing-page';
  if (/\/about/i.test(url)) return 'about-page';
  if (/\/contact/i.test(url)) return 'contact-page';
  if (/\/case-stud/i.test(url)) return 'case-study';

  // Check content
  if ($('[class*="pricing"]').length > 0) return 'pricing-page';
  if ($('[class*="product"]').length > 0) return 'product-page';
  if ($('article').length > 0) return 'article';
  if ($('[class*="blog"]').length > 0) return 'blog-post';

  // Check for e-commerce
  if ($('[class*="cart"]').length > 0 || $('[class*="checkout"]').length > 0) return 'e-commerce';

  return 'general';
}

/**
 * Calculate AI overview risk (likelihood of being replaced by AI-generated answer)
 */
function calculateAIOverviewRisk(stage: FunnelStage, pageType: string): FunnelIntentData['aiOverviewRisk'] {
  // TOFU informational content is most at risk
  if (stage === 'tofu') {
    return 'high';
  }

  // Blog posts and articles are at risk
  if (pageType === 'blog-post' || pageType === 'article') {
    return 'high';
  }

  // MOFU comparison content is medium risk
  if (stage === 'mofu') {
    return 'medium';
  }

  // BOFU transactional content is least at risk
  return 'low';
}

/**
 * Main function: Analyze search funnel intent
 */
export function analyzeFunnelIntent(
  html: string,
  url: string
): { issues: AuditIssue[]; data: FunnelIntentData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];

  // Extract text content
  const title = $('title').text().trim() + ' ' + $('h1').first().text().trim();
  const bodyText = $('body').text().toLowerCase();

  // Calculate scores for each funnel stage
  const tofuResult = calculateStageScore(url, title, bodyText, $, TOFU_PATTERNS);
  const mofuResult = calculateStageScore(url, title, bodyText, $, MOFU_PATTERNS);
  const bofuResult = calculateStageScore(url, title, bodyText, $, BOFU_PATTERNS);

  // Normalize scores
  const totalScore = tofuResult.score + mofuResult.score + bofuResult.score || 1;
  const informationalScore = Math.round((tofuResult.score / totalScore) * 100);
  const considerationScore = Math.round((mofuResult.score / totalScore) * 100);
  const conversionScore = Math.round((bofuResult.score / totalScore) * 100);

  // Determine primary funnel stage
  let detectedStage: FunnelStage;
  let confidence: number;

  if (bofuResult.score > tofuResult.score && bofuResult.score > mofuResult.score) {
    detectedStage = 'bofu';
    confidence = conversionScore;
  } else if (mofuResult.score > tofuResult.score) {
    detectedStage = 'mofu';
    confidence = considerationScore;
  } else if (tofuResult.score > 0) {
    detectedStage = 'tofu';
    confidence = informationalScore;
  } else {
    detectedStage = 'mixed';
    confidence = 50;
  }

  // Determine page type
  const pageType = determinePageType($, url);

  // Calculate AI overview risk
  const aiOverviewRisk = calculateAIOverviewRisk(detectedStage, pageType);

  // Generate recommendations
  const recommendations: string[] = [];

  if (detectedStage === 'tofu') {
    recommendations.push('Consider adding conversion elements (CTAs, forms) to capture leads');
    recommendations.push('Link to MOFU/BOFU pages (comparisons, pricing) to guide users down the funnel');
    if (aiOverviewRisk === 'high') {
      recommendations.push('Add unique data, case studies, or expert opinions that AI cannot replicate');
    }
  }

  if (detectedStage === 'mofu') {
    recommendations.push('Add clear CTAs to BOFU pages (pricing, demos, trials)');
    recommendations.push('Include social proof (testimonials, case studies) to build trust');
  }

  if (detectedStage === 'mixed') {
    recommendations.push('Clarify the page\'s primary intent - is this informational, comparison, or conversion focused?');
    recommendations.push('Consider splitting into multiple focused pages for better SEO');
  }

  // Generate issues

  // High AI overview risk on TOFU content
  if (aiOverviewRisk === 'high' && detectedStage === 'tofu') {
    issues.push({
      code: 'TOFU_AI_OVERVIEW_RISK',
      severity: 'notice',
      category: 'content',
      title: 'Content at risk of AI overview displacement',
      description: 'This informational content may be answered directly by AI overviews, reducing click-through.',
      impact: 'Google AI overviews are increasingly answering informational queries directly in SERPs.',
      howToFix: 'Add unique value: original data, expert opinions, case studies, or interactive tools that AI cannot replicate.',
      affectedUrls: [url],
      details: {
        funnelStage: 'tofu',
        aiOverviewRisk,
        recommendation: 'Focus on MOFU/BOFU content or add unique differentiating content',
      },
    });
  }

  // TOFU without BOFU links
  if (detectedStage === 'tofu') {
    const hasConversionLinks = $('a[href*="pricing"], a[href*="demo"], a[href*="trial"], a[href*="contact"], a[href*="buy"]').length > 0;
    if (!hasConversionLinks) {
      issues.push({
        code: 'TOFU_NO_FUNNEL_LINKS',
        severity: 'notice',
        category: 'content',
        title: 'Informational page lacks conversion path',
        description: 'This TOFU content has no links to pricing, demo, trial, or contact pages.',
        impact: 'Users may leave without entering the sales funnel. Missing revenue opportunity.',
        howToFix: 'Add contextual CTAs linking to MOFU/BOFU pages (comparisons, pricing, demos).',
        affectedUrls: [url],
      });
    }
  }

  // BOFU page without social proof
  if (detectedStage === 'bofu') {
    const hasSocialProof = $('[class*="testimonial"], [class*="review"], [class*="case-study"], [class*="trust"]').length > 0 ||
      bodyText.includes('testimonial') || bodyText.includes('customer said');

    if (!hasSocialProof) {
      issues.push({
        code: 'BOFU_NO_SOCIAL_PROOF',
        severity: 'warning',
        category: 'content',
        title: 'Conversion page lacks social proof',
        description: 'This pricing/sales page has no visible testimonials, reviews, or case studies.',
        impact: '97% of consumers look at reviews before buying. Social proof can increase conversions by 34%.',
        howToFix: 'Add customer testimonials, case study results, trust badges, or review ratings.',
        affectedUrls: [url],
        details: {
          funnelStage: 'bofu',
          pageType,
        },
      });
    }
  }

  // Mixed intent page
  if (detectedStage === 'mixed' && confidence < 40) {
    issues.push({
      code: 'MIXED_FUNNEL_INTENT',
      severity: 'notice',
      category: 'content',
      title: 'Unclear page intent',
      description: 'This page has mixed signals - unclear if informational, comparison, or conversion focused.',
      impact: 'Mixed intent pages may rank poorly because search engines cannot determine primary purpose.',
      howToFix: 'Focus on one primary intent per page. Create separate pages for different funnel stages.',
      affectedUrls: [url],
      details: {
        scores: { tofu: informationalScore, mofu: considerationScore, bofu: conversionScore },
      },
    });
  }

  return {
    issues,
    data: {
      detectedStage,
      confidence,
      signals: {
        tofu: tofuResult.signals,
        mofu: mofuResult.signals,
        bofu: bofuResult.signals,
      },
      metrics: {
        informationalScore,
        considerationScore,
        conversionScore,
      },
      pageType,
      aiOverviewRisk,
      recommendations,
    },
  };
}
