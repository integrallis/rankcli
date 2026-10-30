/**
 * Brand Mention Optimization Checks
 *
 * AI systems extract and quote brand information when answering queries.
 * This check analyzes whether your brand is clearly defined in a way
 * that AI can extract, quote, and recommend.
 *
 * Key insight: "AI doesn't decide who you are. It mostly just repeats
 * what it finds on the internet." - Control your brand narrative.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface BrandMentionData {
  brandSignals: {
    hasBrandDefinition: boolean;
    hasUSP: boolean;
    hasValueProposition: boolean;
    hasBrandStatement: boolean;
    brandMentionCount: number;
  };
  brandCoverage: {
    hasPricingInfo: boolean;
    hasAboutSection: boolean;
    hasFAQSection: boolean;
    hasTestimonials: boolean;
    hasProofPoints: boolean;
  };
  brandConsistency: {
    hasConsistentNaming: boolean;
    hasContactInfo: boolean;
    hasSocialLinks: boolean;
    hasReviewLinks: boolean;
  };
  quotableBrandStatements: string[];
  brandScore: number;
}

// Patterns for brand-defining statements
const BRAND_DEFINITION_PATTERNS = [
  /(?:we are|we're|is a|is the|is an)\s+(?:leading|premier|top|best|trusted|innovative|professional)/i,
  /(?:our mission|our vision|we help|we provide|we offer|we specialize)/i,
  /(?:founded in|established in|since \d{4}|for over \d+)/i,
];

// USP (Unique Selling Proposition) patterns
const USP_PATTERNS = [
  /(?:only|unique|exclusive|proprietary|patented|first|original)/i,
  /(?:unlike|different from|better than|compared to)/i,
  /(?:guarantee|warranty|promise|commitment)/i,
  /(?:free|no cost|complimentary|included)/i,
  /(?:\d+%|\d+x|\d+ times|faster|cheaper|easier)/i,
];

// Value proposition patterns
const VALUE_PROP_PATTERNS = [
  /(?:save|reduce|increase|improve|boost|grow|maximize|minimize)/i,
  /(?:get|achieve|reach|attain|unlock|discover)/i,
  /(?:without|no need|don't have to|eliminates|removes)/i,
];

// Review platform domains
const REVIEW_PLATFORMS = [
  'trustpilot.com', 'g2.com', 'capterra.com', 'yelp.com',
  'bbb.org', 'glassdoor.com', 'indeed.com', 'tripadvisor.com',
  'angi.com', 'homeadvisor.com', 'avvo.com', 'healthgrades.com',
  'zocdoc.com', 'clutch.co', 'producthunt.com', 'getapp.com',
];

export function analyzeBrandMentionOptimization(
  html: string,
  url: string
): { issues: AuditIssue[]; data: BrandMentionData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const parsedUrl = new URL(url);

  // Remove non-content elements
  const $content = $('body').clone();
  $content.find('nav, footer, script, style, noscript').remove();
  const bodyText = $content.text();
  const bodyHtml = $content.html() || '';

  // Extract potential brand name from domain or title
  const domainParts = parsedUrl.hostname.replace('www.', '').split('.');
  const potentialBrandName = domainParts[0];
  const title = $('title').text();
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';

  // Count brand mentions
  const brandNameRegex = new RegExp(potentialBrandName, 'gi');
  const brandMentionCount = (bodyText.match(brandNameRegex) || []).length;

  // Check for brand definition patterns
  let hasBrandDefinition = false;
  let hasUSP = false;
  let hasValueProposition = false;
  let hasBrandStatement = false;
  const quotableBrandStatements: string[] = [];

  // "<Brand> is a <category> ..." is the definition this check's own advice asks
  // for, and it needs no superlative: "RankCLI is a free SEO tool" counts, the
  // generic patterns above only matched "is a leading ..." style puffery.
  const brandDefinition = new RegExp(
    `\\b${potentialBrandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(?:is|are)\\s+(?:a|an|the)\\b`,
    'i'
  );

  // Analyze paragraphs for brand statements
  $content.find('p, li, h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length < 20 || text.length > 300) return;

    // Check for brand definitions
    for (const pattern of [brandDefinition, ...BRAND_DEFINITION_PATTERNS]) {
      if (pattern.test(text)) {
        hasBrandDefinition = true;
        if (text.length <= 200 && quotableBrandStatements.length < 5) {
          quotableBrandStatements.push(text);
        }
        break;
      }
    }

    // Check for USPs
    for (const pattern of USP_PATTERNS) {
      if (pattern.test(text)) {
        hasUSP = true;
        break;
      }
    }

    // Check for value propositions
    for (const pattern of VALUE_PROP_PATTERNS) {
      if (pattern.test(text)) {
        hasValueProposition = true;
        break;
      }
    }
  });

  // Check for explicit brand statement (often in hero or about section)
  hasBrandStatement =
    $('[class*="hero"] p, [class*="about"] p, [id*="hero"] p, [id*="about"] p').length > 0 ||
    $('main > section:first-child p').length > 0;

  // Check brand topic coverage
  const headingText = $('h1, h2, h3, h4').map((_, h) => $(h).text().toLowerCase()).get().join(' ');
  const linkText = $('a').map((_, a) => $(a).text().toLowerCase()).get().join(' ');
  const allLinks = $('a[href]').map((_, a) => $(a).attr('href') || '').get();

  const hasPricingInfo =
    headingText.includes('pricing') ||
    headingText.includes('plans') ||
    headingText.includes('cost') ||
    linkText.includes('pricing') ||
    allLinks.some(href => href.includes('pricing') || href.includes('plans'));

  const hasAboutSection =
    headingText.includes('about') ||
    headingText.includes('who we are') ||
    headingText.includes('our story') ||
    allLinks.some(href => href.includes('about'));

  const hasFAQSection =
    headingText.includes('faq') ||
    headingText.includes('frequently asked') ||
    headingText.includes('questions') ||
    $('[itemtype*="FAQPage"]').length > 0 ||
    $('details summary').length >= 2;

  const hasTestimonials =
    headingText.includes('testimonial') ||
    headingText.includes('review') ||
    headingText.includes('what our') ||
    headingText.includes('customer') ||
    $('[class*="testimonial"], [class*="review"], [id*="testimonial"]').length > 0 ||
    $('blockquote').length >= 2;

  const hasProofPoints =
    headingText.includes('case stud') ||
    headingText.includes('success') ||
    headingText.includes('results') ||
    /\d+\+?\s*(customers|clients|users|companies|businesses)/i.test(bodyText) ||
    /\d+%\s*(increase|decrease|improvement|growth)/i.test(bodyText);

  // Check brand consistency signals
  const hasConsistentNaming = brandMentionCount >= 3 && ogSiteName.length > 0;

  const hasContactInfo =
    $('a[href^="tel:"], a[href^="mailto:"]').length > 0 ||
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(bodyText) ||
    bodyText.toLowerCase().includes('contact');

  const socialLinks = $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]');
  const hasSocialLinks = socialLinks.length >= 2;

  // Check for review platform links
  const hasReviewLinks = allLinks.some(href => {
    const lowerHref = href.toLowerCase();
    return REVIEW_PLATFORMS.some(platform => lowerHref.includes(platform));
  });

  // Calculate brand score
  let brandScore = 30; // Base score

  // Brand signals
  if (hasBrandDefinition) brandScore += 15;
  if (hasUSP) brandScore += 10;
  if (hasValueProposition) brandScore += 10;
  if (brandMentionCount >= 5) brandScore += 5;

  // Brand coverage
  if (hasPricingInfo) brandScore += 5;
  if (hasAboutSection) brandScore += 5;
  if (hasFAQSection) brandScore += 5;
  if (hasTestimonials) brandScore += 10;
  if (hasProofPoints) brandScore += 10;

  // Brand consistency
  if (hasConsistentNaming) brandScore += 5;
  if (hasContactInfo) brandScore += 3;
  if (hasSocialLinks) brandScore += 3;
  if (hasReviewLinks) brandScore += 5;

  brandScore = Math.min(100, Math.max(0, brandScore));

  // Generate issues

  // No clear brand definition
  if (!hasBrandDefinition) {
    issues.push({
      code: 'AI_NO_BRAND_DEFINITION',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'No clear brand definition for AI to extract',
      description: 'AI systems look for clear "Brand X is..." statements to quote when recommending brands. Your page lacks quotable brand definitions.',
      impact: 'AI cannot accurately describe your brand, reducing recommendation likelihood.',
      howToFix: 'Add a clear brand definition early in your content: "[Brand] is a [category] that [key benefit]." Make it quotable (under 200 characters).',
      affectedUrls: [url],
      details: {
        suggestion: `Example: "${potentialBrandName.charAt(0).toUpperCase() + potentialBrandName.slice(1)} is a [category] that helps [audience] [achieve benefit]."`,
      },
    });
  }

  // No USP
  if (!hasUSP) {
    issues.push({
      code: 'AI_NO_USP',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No unique selling proposition (USP) detected',
      description: 'AI needs clear differentiators to recommend your brand over competitors. No USP patterns found.',
      impact: 'AI may not distinguish your brand from competitors when making recommendations.',
      howToFix: 'Add clear differentiators: "The only...", "Unlike competitors...", "Guaranteed...", specific numbers (e.g., "50% faster").',
      affectedUrls: [url],
    });
  }

  // Missing brand topic coverage
  const missingTopics: string[] = [];
  if (!hasPricingInfo) missingTopics.push('pricing');
  if (!hasFAQSection) missingTopics.push('FAQ');
  if (!hasTestimonials) missingTopics.push('testimonials/reviews');
  if (!hasProofPoints) missingTopics.push('proof points/case studies');

  if (missingTopics.length >= 2) {
    issues.push({
      code: 'AI_INCOMPLETE_BRAND_COVERAGE',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Incomplete brand topic coverage',
      description: `Missing key brand topics that AI uses to answer queries: ${missingTopics.join(', ')}. AI may rely on third-party sources instead.`,
      impact: 'Third-party sites may define your brand narrative instead of you.',
      howToFix: 'Cover key brand topics on your site: pricing, positioning, proof (testimonials, case studies), and FAQs.',
      affectedUrls: [url],
      details: {
        missingTopics,
        recommendation: 'Control your brand narrative by having authoritative content on these topics on your own site.',
      },
    });
  }

  // No review platform integration
  if (!hasReviewLinks && !hasTestimonials) {
    issues.push({
      code: 'AI_NO_REVIEW_INTEGRATION',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No review platform integration',
      description: 'No links to review platforms or testimonial sections found. AI uses review signals from multiple platforms for trust.',
      impact: 'Missing review diversity signals that AI uses for brand trust assessment.',
      howToFix: 'Link to your profiles on relevant review platforms (G2, Capterra, Trustpilot, etc.) and display testimonials with attribution.',
      affectedUrls: [url],
      details: {
        relevantPlatforms: [
          'B2B SaaS: G2, Capterra, TrustRadius',
          'Local: Google Business, Yelp, BBB',
          'Professional: Clutch, UpCity',
        ],
      },
    });
  }

  // Low brand score
  if (brandScore < 50) {
    issues.push({
      code: 'AI_LOW_BRAND_SCORE',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Brand is not well-optimized for AI extraction',
      description: `Brand optimization score: ${brandScore}/100. AI may struggle to accurately describe and recommend your brand.`,
      impact: 'Low likelihood of being recommended in AI answers for brand-related queries.',
      howToFix: 'Improve brand clarity: add quotable definitions, USPs, testimonials, proof points, and link to review platforms.',
      affectedUrls: [url],
      details: {
        brandScore,
        hasBrandDefinition,
        hasUSP,
        hasTestimonials,
        hasProofPoints,
        hasReviewLinks,
        quotableBrandStatements: quotableBrandStatements.slice(0, 3),
      },
    });
  }

  return {
    issues,
    data: {
      brandSignals: {
        hasBrandDefinition,
        hasUSP,
        hasValueProposition,
        hasBrandStatement,
        brandMentionCount,
      },
      brandCoverage: {
        hasPricingInfo,
        hasAboutSection,
        hasFAQSection,
        hasTestimonials,
        hasProofPoints,
      },
      brandConsistency: {
        hasConsistentNaming,
        hasContactInfo,
        hasSocialLinks,
        hasReviewLinks,
      },
      quotableBrandStatements,
      brandScore,
    },
  };
}
