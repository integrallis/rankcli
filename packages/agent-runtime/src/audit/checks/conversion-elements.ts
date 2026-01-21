// Conversion Elements & Above-the-Fold Analysis
// Reference: "4 Steps to Rank #1 in Google (2026 SEO Plan)" by Nathan Gotch
// "80% of people only read headlines" - above the fold is critical
// "97% of consumers look at reviews, testimonials can increase conversions by 34%"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface AboveFoldAnalysis {
  hasHeadline: boolean;
  headlineText: string | null;
  hasCTA: boolean;
  ctaCount: number;
  ctaTexts: string[];
  hasForm: boolean;
  formType: 'contact' | 'signup' | 'search' | 'calculator' | 'other' | null;
  hasSocialProof: boolean;
  socialProofTypes: string[];
  hasHeroImage: boolean;
  hasVideo: boolean;
  estimatedAboveFoldScore: number; // 0-100
}

export interface SocialProofAnalysis {
  hasTestimonials: boolean;
  testimonialCount: number;
  hasReviews: boolean;
  reviewCount: number;
  hasRatings: boolean;
  averageRating: number | null;
  hasClientLogos: boolean;
  clientLogoCount: number;
  hasCaseStudies: boolean;
  hasAwards: boolean;
  hasCertifications: boolean;
  hasTrustBadges: boolean;
  hasStatistics: boolean;
  statisticsFound: string[];
  socialProofScore: number; // 0-100
}

export interface EngagementTriggers {
  hasCalculator: boolean;
  calculatorTypes: string[];
  hasQuiz: boolean;
  hasInteractiveElement: boolean;
  interactiveTypes: string[];
  hasEmbeddedVideo: boolean;
  videoCount: number;
  hasExpandableContent: boolean;
  hasTabsOrAccordion: boolean;
  hasChatWidget: boolean;
  engagementScore: number; // 0-100
}

export interface ConversionElementsData {
  aboveFold: AboveFoldAnalysis;
  socialProof: SocialProofAnalysis;
  engagementTriggers: EngagementTriggers;
  pageType: 'commercial' | 'informational' | 'mixed' | 'unknown';
  recommendations: string[];
}

// CTA patterns
const CTA_PATTERNS = [
  /get (started|quote|help|access|now)/i,
  /start (now|free|today|here)/i,
  /sign up/i,
  /subscribe/i,
  /contact us/i,
  /book (a |now|today|call|demo|meeting)/i,
  /schedule/i,
  /request (a |quote|demo|call)/i,
  /free (trial|quote|consultation|estimate)/i,
  /buy now/i,
  /add to cart/i,
  /shop now/i,
  /learn more/i,
  /download/i,
  /try (it |now|free)/i,
  /call (us|now|today)/i,
  /chat (with us|now)/i,
];

// Social proof selectors and patterns
const TESTIMONIAL_SELECTORS = [
  '.testimonial', '.testimonials', '[class*="testimonial"]',
  '.review', '.reviews', '[class*="review"]',
  '.quote', '[class*="customer-quote"]',
  '.client-feedback', '[class*="feedback"]',
  'blockquote[class*="testimonial"]',
];

const CLIENT_LOGO_SELECTORS = [
  '.client-logos', '.clients', '[class*="client-logo"]',
  '.partner-logos', '.partners', '[class*="partner"]',
  '.trusted-by', '[class*="trusted"]',
  '.as-seen-in', '[class*="featured-in"]',
  '.logo-wall', '.logo-carousel',
];

/**
 * Analyze above-the-fold content
 */
export function analyzeAboveFold(html: string): AboveFoldAnalysis {
  const $ = cheerio.load(html);

  // Get first significant elements (approximating above fold)
  // In a real browser, this would use viewport calculations
  const header = $('header').first();
  const hero = $('.hero, [class*="hero"], .banner, [class*="banner"], .jumbotron, [class*="landing"]').first();
  const firstSection = $('main > section, main > div, body > section').first();

  // Combine above-fold content
  const headerHtml = header.html() || '';
  const heroOrSectionHtml = hero.length ? (hero.html() || '') : (firstSection.html() || '');
  const aboveFoldHtml = headerHtml + heroOrSectionHtml;
  const $above = cheerio.load(aboveFoldHtml);

  // Check for headline
  const h1 = $('h1').first();
  const hasHeadline = h1.length > 0;
  const headlineText = h1.text().trim() || null;

  // Check for CTAs
  const ctaTexts: string[] = [];
  $('a, button').each((_, el) => {
    const text = $(el).text().trim();
    for (const pattern of CTA_PATTERNS) {
      if (pattern.test(text)) {
        ctaTexts.push(text);
        break;
      }
    }
  });

  // Check for forms
  const forms = $('form');
  let formType: AboveFoldAnalysis['formType'] = null;
  if (forms.length > 0) {
    const formHtml = forms.first().html()?.toLowerCase() || '';
    if (formHtml.includes('calculator') || formHtml.includes('estimate')) {
      formType = 'calculator';
    } else if (formHtml.includes('search') || formHtml.includes('query')) {
      formType = 'search';
    } else if (formHtml.includes('email') && formHtml.includes('subscribe')) {
      formType = 'signup';
    } else if (formHtml.includes('phone') || formHtml.includes('contact') || formHtml.includes('message')) {
      formType = 'contact';
    } else {
      formType = 'other';
    }
  }

  // Check for social proof in above fold
  const hasSocialProofAbove = $('[class*="testimonial"], [class*="review"], [class*="rating"], [class*="trust"]').length > 0;
  const socialProofTypes: string[] = [];
  if ($('[class*="rating"], [class*="star"]').length > 0) socialProofTypes.push('ratings');
  if ($('[class*="testimonial"]').length > 0) socialProofTypes.push('testimonials');
  if ($('[class*="client-logo"], [class*="trusted"]').length > 0) socialProofTypes.push('client-logos');

  // Hero image
  const hasHeroImage = hero.find('img').length > 0 || $('header img').length > 0;

  // Video
  const hasVideo = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;

  // Calculate score
  let score = 0;
  if (hasHeadline) score += 25;
  if (ctaTexts.length > 0) score += 25;
  if (forms.length > 0) score += 20;
  if (hasSocialProofAbove) score += 15;
  if (hasHeroImage || hasVideo) score += 15;

  return {
    hasHeadline,
    headlineText,
    hasCTA: ctaTexts.length > 0,
    ctaCount: ctaTexts.length,
    ctaTexts: [...new Set(ctaTexts)].slice(0, 5),
    hasForm: forms.length > 0,
    formType,
    hasSocialProof: hasSocialProofAbove,
    socialProofTypes,
    hasHeroImage,
    hasVideo,
    estimatedAboveFoldScore: score,
  };
}

/**
 * Analyze social proof elements
 */
export function analyzeSocialProof(html: string): SocialProofAnalysis {
  const $ = cheerio.load(html);
  const text = $('body').text().toLowerCase();

  // Testimonials
  let testimonialCount = 0;
  for (const selector of TESTIMONIAL_SELECTORS) {
    testimonialCount += $(selector).length;
  }
  const hasTestimonials = testimonialCount > 0;

  // Reviews
  const reviewElements = $('[class*="review"], [itemtype*="Review"]');
  const hasReviews = reviewElements.length > 0;
  const reviewCount = reviewElements.length;

  // Ratings
  const ratingElements = $('[class*="rating"], [class*="star"], [itemprop="ratingValue"]');
  const hasRatings = ratingElements.length > 0;
  let averageRating: number | null = null;
  const ratingValue = $('[itemprop="ratingValue"]').first().text();
  if (ratingValue) {
    const parsed = parseFloat(ratingValue);
    if (!isNaN(parsed)) averageRating = parsed;
  }

  // Client logos
  let clientLogoCount = 0;
  for (const selector of CLIENT_LOGO_SELECTORS) {
    const container = $(selector);
    if (container.length > 0) {
      clientLogoCount = container.find('img').length || 1;
      break;
    }
  }
  const hasClientLogos = clientLogoCount > 0;

  // Case studies
  const hasCaseStudies =
    $('a[href*="case-stud"], [class*="case-study"]').length > 0 ||
    text.includes('case study') || text.includes('case studies');

  // Awards
  const hasAwards =
    $('[class*="award"]').length > 0 ||
    text.includes('award-winning') || text.includes('winner');

  // Certifications
  const hasCertifications =
    $('[class*="certif"], [class*="accredit"]').length > 0 ||
    /certified|accredited|licensed/i.test(text);

  // Trust badges
  const hasTrustBadges =
    $('[class*="trust-badge"], [class*="security-badge"], [class*="guarantee"]').length > 0;

  // Statistics (numbers that prove credibility)
  const statisticsFound: string[] = [];
  const statPatterns = [
    /(\d+(?:,\d{3})*\+?)\s*(customers?|clients?|users?|businesses?)/gi,
    /(\d+(?:,\d{3})*\+?)\s*(years?)\s*(of experience|in business)/gi,
    /(\d+)%\s*(satisfaction|success|increase|growth)/gi,
    /\$(\d+(?:,\d{3})*(?:\.\d+)?[MBK]?)\s*(saved|recovered|generated)/gi,
  ];
  for (const pattern of statPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      statisticsFound.push(...matches.slice(0, 3));
    }
  }
  const hasStatistics = statisticsFound.length > 0;

  // Calculate score
  let score = 0;
  if (hasTestimonials) score += 20;
  if (hasReviews) score += 15;
  if (hasRatings) score += 10;
  if (hasClientLogos) score += 15;
  if (hasCaseStudies) score += 15;
  if (hasAwards || hasCertifications) score += 10;
  if (hasTrustBadges) score += 5;
  if (hasStatistics) score += 10;

  return {
    hasTestimonials,
    testimonialCount,
    hasReviews,
    reviewCount,
    hasRatings,
    averageRating,
    hasClientLogos,
    clientLogoCount,
    hasCaseStudies,
    hasAwards,
    hasCertifications,
    hasTrustBadges,
    hasStatistics,
    statisticsFound: [...new Set(statisticsFound)].slice(0, 5),
    socialProofScore: Math.min(100, score),
  };
}

/**
 * Detect engagement triggers (interactive elements)
 */
export function detectEngagementTriggers(html: string): EngagementTriggers {
  const $ = cheerio.load(html);
  const htmlLower = html.toLowerCase();

  // Calculators
  const calculatorTypes: string[] = [];
  const calcPatterns = [
    { pattern: /calculator/i, type: 'calculator' },
    { pattern: /estimator/i, type: 'estimator' },
    { pattern: /roi.*calculator|calculator.*roi/i, type: 'ROI calculator' },
    { pattern: /price.*calculator|cost.*calculator/i, type: 'price calculator' },
    { pattern: /mortgage.*calculator/i, type: 'mortgage calculator' },
    { pattern: /loan.*calculator/i, type: 'loan calculator' },
    { pattern: /bmi.*calculator/i, type: 'BMI calculator' },
    { pattern: /quote.*tool|instant.*quote/i, type: 'quote tool' },
  ];

  for (const { pattern, type } of calcPatterns) {
    if (pattern.test(htmlLower)) {
      calculatorTypes.push(type);
    }
  }
  const hasCalculator = calculatorTypes.length > 0;

  // Quiz
  const hasQuiz =
    $('[class*="quiz"], [id*="quiz"]').length > 0 ||
    /quiz|assessment|self-test/i.test(htmlLower);

  // Interactive elements
  const interactiveTypes: string[] = [];
  if ($('input[type="range"], .slider, [class*="slider"]').length > 0) interactiveTypes.push('slider');
  if ($('[class*="configurator"], [class*="customizer"]').length > 0) interactiveTypes.push('configurator');
  if ($('canvas, [class*="chart"], [class*="graph"]').length > 0) interactiveTypes.push('charts/graphs');
  if ($('[class*="map"], #map, .map').length > 0) interactiveTypes.push('interactive map');
  if ($('[class*="filter"], [class*="sort"]').length > 0) interactiveTypes.push('filters');

  const hasInteractiveElement = interactiveTypes.length > 0;

  // Embedded video
  const videos = $('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"], [class*="video-embed"]');
  const hasEmbeddedVideo = videos.length > 0;
  const videoCount = videos.length;

  // Expandable content
  const hasExpandableContent =
    $('details, [class*="accordion"], [class*="collapsible"], [class*="expandable"]').length > 0;

  // Tabs
  const hasTabsOrAccordion =
    $('[role="tablist"], [class*="tabs"], [class*="tab-content"]').length > 0;

  // Chat widget
  const hasChatWidget =
    $('[class*="chat-widget"], [class*="live-chat"], [id*="chat"]').length > 0 ||
    /intercom|drift|crisp|zendesk|livechat|tidio/i.test(html);

  // Calculate score
  let score = 0;
  if (hasCalculator) score += 25;
  if (hasQuiz) score += 20;
  if (hasInteractiveElement) score += 15;
  if (hasEmbeddedVideo) score += 20;
  if (hasExpandableContent || hasTabsOrAccordion) score += 10;
  if (hasChatWidget) score += 10;

  return {
    hasCalculator,
    calculatorTypes,
    hasQuiz,
    hasInteractiveElement,
    interactiveTypes,
    hasEmbeddedVideo,
    videoCount,
    hasExpandableContent,
    hasTabsOrAccordion,
    hasChatWidget,
    engagementScore: Math.min(100, score),
  };
}

/**
 * Detect page type (commercial vs informational)
 */
export function detectPageType(html: string, url: string): 'commercial' | 'informational' | 'mixed' | 'unknown' {
  const $ = cheerio.load(html);
  const text = $('body').text().toLowerCase();
  const urlLower = url.toLowerCase();

  let commercialSignals = 0;
  let informationalSignals = 0;

  // URL signals
  if (/\/product|\/service|\/pricing|\/buy|\/shop|\/contact/i.test(urlLower)) commercialSignals += 2;
  if (/\/blog|\/article|\/guide|\/how-to|\/what-is|\/learn/i.test(urlLower)) informationalSignals += 2;

  // Content signals
  if (/buy now|add to cart|get quote|contact us|free consultation/i.test(text)) commercialSignals += 2;
  if ($('form').length > 0) commercialSignals += 1;
  if (/pricing|price|\$\d+/i.test(text)) commercialSignals += 1;

  if (/table of contents|in this article|what you.ll learn/i.test(text)) informationalSignals += 2;
  if ($('article').length > 0) informationalSignals += 1;
  if (text.length > 3000) informationalSignals += 1; // Long content is usually informational

  if (commercialSignals > informationalSignals + 1) return 'commercial';
  if (informationalSignals > commercialSignals + 1) return 'informational';
  if (commercialSignals > 0 && informationalSignals > 0) return 'mixed';
  return 'unknown';
}

/**
 * Main function: Analyze conversion elements
 */
export function analyzeConversionElements(
  html: string,
  url: string
): { issues: AuditIssue[]; data: ConversionElementsData } {
  const issues: AuditIssue[] = [];

  const aboveFold = analyzeAboveFold(html);
  const socialProof = analyzeSocialProof(html);
  const engagementTriggers = detectEngagementTriggers(html);
  const pageType = detectPageType(html, url);

  const recommendations: string[] = [];

  // Above-the-fold issues for commercial pages
  if (pageType === 'commercial' || pageType === 'mixed') {
    if (!aboveFold.hasCTA) {
      issues.push({
        code: 'COMMERCIAL_NO_CTA',
        severity: 'warning',
        category: 'content',
        title: 'Commercial page without clear CTA',
        description: 'This appears to be a commercial page but has no clear call-to-action.',
        impact: 'Without a CTA, visitors have no clear next step. 80% of users only see above-the-fold content.',
        howToFix: 'Add a prominent CTA button above the fold (e.g., "Get Free Quote", "Contact Us", "Start Free Trial").',
        affectedUrls: [url],
        details: { pageType },
      });
      recommendations.push('Add prominent CTA button above the fold');
    }

    if (!aboveFold.hasForm && pageType === 'commercial') {
      issues.push({
        code: 'COMMERCIAL_NO_FORM',
        severity: 'notice',
        category: 'content',
        title: 'Commercial page without lead capture form',
        description: 'This commercial page lacks a visible form for lead capture.',
        impact: 'Forms above the fold significantly increase conversion rates.',
        howToFix: 'Add a contact form, quote request, or signup form visible without scrolling.',
        affectedUrls: [url],
      });
      recommendations.push('Add lead capture form above the fold');
    }

    if (!socialProof.hasTestimonials && !socialProof.hasReviews) {
      issues.push({
        code: 'NO_SOCIAL_PROOF',
        severity: 'warning',
        category: 'content',
        title: 'No testimonials or reviews found',
        description: 'Page lacks testimonials, reviews, or other social proof.',
        impact: '97% of consumers look at reviews. Testimonials can increase conversions by 34%.',
        howToFix: 'Add customer testimonials, reviews, ratings, or case studies to build trust.',
        affectedUrls: [url],
        details: { socialProofScore: socialProof.socialProofScore },
      });
      recommendations.push('Add customer testimonials or reviews');
    }

    if (!socialProof.hasClientLogos && pageType === 'commercial') {
      recommendations.push('Add client/partner logos for credibility ("Trusted by...")');
    }
  }

  // Engagement triggers for any page type
  if (!engagementTriggers.hasEmbeddedVideo && !engagementTriggers.hasInteractiveElement) {
    issues.push({
      code: 'NO_ENGAGEMENT_TRIGGERS',
      severity: 'notice',
      category: 'content',
      title: 'No engagement triggers found',
      description: 'Page lacks interactive elements, videos, or calculators.',
      impact: 'Interactive content increases dwell time, a user signal that influences rankings.',
      howToFix: 'Add video content, calculators, interactive tools, or expandable sections.',
      affectedUrls: [url],
      details: { engagementScore: engagementTriggers.engagementScore },
    });
    recommendations.push('Add video or interactive elements to increase engagement');
  }

  // Calculator suggestion for service pages
  if (pageType === 'commercial' && !engagementTriggers.hasCalculator) {
    const isServicePage = /service|pricing|quote|cost|estimate/i.test(url + html);
    if (isServicePage) {
      recommendations.push('Consider adding a calculator or instant quote tool');
    }
  }

  // Headline check
  if (!aboveFold.hasHeadline) {
    issues.push({
      code: 'NO_VISIBLE_HEADLINE',
      severity: 'warning',
      category: 'on-page',
      title: 'No H1 headline visible',
      description: 'Page appears to lack a visible H1 headline above the fold.',
      impact: '80% of visitors only read headlines. A strong headline is critical for engagement.',
      howToFix: 'Add a clear, compelling H1 headline that communicates the page value proposition.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      aboveFold,
      socialProof,
      engagementTriggers,
      pageType,
      recommendations,
    },
  };
}
