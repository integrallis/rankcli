/**
 * Review Ecosystem Checks
 *
 * AI systems use review signals from multiple platforms to assess brand trust.
 * This check analyzes integration with review platforms and testimonial presence.
 *
 * Key insight: "If you want visibility across AI platforms, you need review
 * diversity. That means building reviews on the platforms that matter in
 * your specific niche."
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface ReviewEcosystemData {
  reviewPlatforms: {
    linked: string[];
    embedded: string[];
    sameAsLinks: string[];
  };
  testimonials: {
    count: number;
    hasAttribution: boolean;
    hasPhotos: boolean;
    hasCompanyNames: boolean;
  };
  reviewSchema: {
    hasAggregateRating: boolean;
    hasReviewSchema: boolean;
    ratingValue?: number;
    reviewCount?: number;
  };
  trustSignals: {
    hasTrustBadges: boolean;
    hasCertifications: boolean;
    hasAwards: boolean;
    hasMediaMentions: boolean;
  };
  reviewEcosystemScore: number;
}

// Review platforms by category
const REVIEW_PLATFORMS = {
  general: [
    { name: 'Google Business', domain: 'google.com/maps', aliases: ['goo.gl/maps', 'maps.google'] },
    { name: 'Trustpilot', domain: 'trustpilot.com', aliases: [] },
    { name: 'BBB', domain: 'bbb.org', aliases: [] },
    { name: 'Yelp', domain: 'yelp.com', aliases: [] },
  ],
  saas: [
    { name: 'G2', domain: 'g2.com', aliases: ['g2crowd.com'] },
    { name: 'Capterra', domain: 'capterra.com', aliases: [] },
    { name: 'TrustRadius', domain: 'trustradius.com', aliases: [] },
    { name: 'GetApp', domain: 'getapp.com', aliases: [] },
    { name: 'Software Advice', domain: 'softwareadvice.com', aliases: [] },
    { name: 'Product Hunt', domain: 'producthunt.com', aliases: [] },
  ],
  professional: [
    { name: 'Clutch', domain: 'clutch.co', aliases: [] },
    { name: 'UpCity', domain: 'upcity.com', aliases: [] },
    { name: 'GoodFirms', domain: 'goodfirms.co', aliases: [] },
    { name: 'Expertise', domain: 'expertise.com', aliases: [] },
  ],
  local: [
    { name: 'Angi', domain: 'angi.com', aliases: ['angieslist.com'] },
    { name: 'HomeAdvisor', domain: 'homeadvisor.com', aliases: [] },
    { name: 'Thumbtack', domain: 'thumbtack.com', aliases: [] },
    { name: 'Houzz', domain: 'houzz.com', aliases: [] },
  ],
  healthcare: [
    { name: 'Healthgrades', domain: 'healthgrades.com', aliases: [] },
    { name: 'Zocdoc', domain: 'zocdoc.com', aliases: [] },
    { name: 'Vitals', domain: 'vitals.com', aliases: [] },
    { name: 'WebMD', domain: 'webmd.com', aliases: [] },
  ],
  legal: [
    { name: 'Avvo', domain: 'avvo.com', aliases: [] },
    { name: 'Martindale', domain: 'martindale.com', aliases: [] },
    { name: 'FindLaw', domain: 'findlaw.com', aliases: [] },
    { name: 'Justia', domain: 'justia.com', aliases: [] },
  ],
  hospitality: [
    { name: 'TripAdvisor', domain: 'tripadvisor.com', aliases: [] },
    { name: 'Booking.com', domain: 'booking.com', aliases: [] },
    { name: 'OpenTable', domain: 'opentable.com', aliases: [] },
    { name: 'Zomato', domain: 'zomato.com', aliases: [] },
  ],
  ecommerce: [
    { name: 'Amazon', domain: 'amazon.com', aliases: [] },
    { name: 'Shopify Reviews', domain: 'apps.shopify.com', aliases: [] },
    { name: 'Yotpo', domain: 'yotpo.com', aliases: [] },
    { name: 'Judge.me', domain: 'judge.me', aliases: [] },
  ],
};

// Trust badge patterns
const TRUST_BADGE_PATTERNS = [
  /ssl|secure|verified|certified|accredited|licensed/i,
  /money.back|guarantee|satisfaction/i,
  /bbb|iso|soc\s*2|hipaa|gdpr|pci/i,
];

export function analyzeReviewEcosystem(
  html: string,
  url: string
): { issues: AuditIssue[]; data: ReviewEcosystemData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const allLinks = $('a[href]').map((_, a) => $(a).attr('href') || '').get();
  const allLinksLower = allLinks.map(l => l.toLowerCase());

  // Find linked review platforms
  const linkedPlatforms: string[] = [];
  const allPlatforms = Object.values(REVIEW_PLATFORMS).flat();

  for (const platform of allPlatforms) {
    const isLinked = allLinksLower.some(href =>
      href.includes(platform.domain) ||
      platform.aliases.some(alias => href.includes(alias))
    );
    if (isLinked) {
      linkedPlatforms.push(platform.name);
    }
  }

  // Find embedded review widgets
  const embeddedPlatforms: string[] = [];
  const embedPatterns = [
    { name: 'Trustpilot', pattern: /trustpilot/i },
    { name: 'G2', pattern: /g2\.com|g2crowd/i },
    { name: 'Yotpo', pattern: /yotpo/i },
    { name: 'Judge.me', pattern: /judgeme|judge\.me/i },
    { name: 'Google Reviews', pattern: /google.*review|elfsight/i },
  ];

  const htmlLower = html.toLowerCase();
  for (const { name, pattern } of embedPatterns) {
    if (pattern.test(htmlLower) && !linkedPlatforms.includes(name)) {
      embeddedPlatforms.push(name);
    }
  }

  // Find sameAs links in structured data
  const sameAsLinks: string[] = [];
  const scripts = $('script[type="application/ld+json"]');
  scripts.each((_, script) => {
    try {
      const json = JSON.parse($(script).html() || '{}');
      const sameAs = json.sameAs || (json['@graph'] && json['@graph'][0]?.sameAs);
      if (Array.isArray(sameAs)) {
        for (const link of sameAs) {
          if (typeof link === 'string') {
            for (const platform of allPlatforms) {
              if (link.toLowerCase().includes(platform.domain)) {
                sameAsLinks.push(platform.name);
              }
            }
          }
        }
      }
    } catch {
      // Invalid JSON
    }
  });

  // Analyze testimonials
  const testimonialSelectors = [
    '[class*="testimonial"]',
    '[class*="review"]',
    '[class*="quote"]',
    '[id*="testimonial"]',
    'blockquote',
  ];

  let testimonialCount = 0;
  let hasAttribution = false;
  let hasPhotos = false;
  let hasCompanyNames = false;

  for (const selector of testimonialSelectors) {
    const elements = $(selector);
    elements.each((_, el) => {
      const text = $(el).text();
      if (text.length > 50 && text.length < 1000) {
        testimonialCount++;

        // Check for attribution (name)
        if (/[-–—]\s*[A-Z][a-z]+\s+[A-Z]/.test(text) ||
            $(el).find('[class*="name"], [class*="author"]').length > 0) {
          hasAttribution = true;
        }

        // Check for photos
        if ($(el).find('img').length > 0 ||
            $(el).siblings('img').length > 0) {
          hasPhotos = true;
        }

        // Check for company names
        if (/(?:CEO|CTO|founder|director|manager)\s+(?:at|of)\s+[A-Z]/i.test(text) ||
            $(el).find('[class*="company"], [class*="title"]').length > 0) {
          hasCompanyNames = true;
        }
      }
    });
  }

  // Check for review schema
  let hasAggregateRating = false;
  let hasReviewSchema = false;
  let ratingValue: number | undefined;
  let reviewCount: number | undefined;

  scripts.each((_, script) => {
    try {
      const json = JSON.parse($(script).html() || '{}');
      const checkSchema = (obj: Record<string, unknown>) => {
        if (obj['@type'] === 'AggregateRating' || obj.aggregateRating) {
          hasAggregateRating = true;
          const rating = obj.aggregateRating || obj;
          if (typeof rating === 'object' && rating !== null) {
            const r = rating as Record<string, unknown>;
            ratingValue = parseFloat(String(r.ratingValue)) || undefined;
            reviewCount = parseInt(String(r.reviewCount || r.ratingCount)) || undefined;
          }
        }
        if (obj['@type'] === 'Review' || Array.isArray(obj.review)) {
          hasReviewSchema = true;
        }
      };

      checkSchema(json);
      if (json['@graph'] && Array.isArray(json['@graph'])) {
        for (const item of json['@graph']) {
          checkSchema(item);
        }
      }
    } catch {
      // Invalid JSON
    }
  });

  // Check for trust signals
  const bodyText = $('body').text();
  const imgAlts = $('img').map((_, img) => $(img).attr('alt') || '').get().join(' ');
  const allText = bodyText + ' ' + imgAlts;

  const hasTrustBadges = TRUST_BADGE_PATTERNS.some(p => p.test(allText)) ||
    $('[class*="trust"], [class*="badge"], [class*="seal"]').length > 0;

  const hasCertifications =
    /(?:certified|certification|accredited|compliance)/i.test(allText) ||
    $('[class*="certification"], [class*="accredit"]').length > 0;

  const hasAwards =
    /(?:award|winner|recognized|featured in|as seen)/i.test(allText) ||
    $('[class*="award"], [class*="recognition"], [class*="featured"]').length > 0;

  const hasMediaMentions =
    /(?:featured in|as seen in|mentioned in|press|media)/i.test(allText) ||
    $('[class*="press"], [class*="media"], [class*="featured"]').length > 0;

  // Calculate score
  let reviewEcosystemScore = 20; // Base score

  // Review platform integration (up to 30 points)
  if (linkedPlatforms.length >= 3) reviewEcosystemScore += 15;
  else if (linkedPlatforms.length >= 1) reviewEcosystemScore += 10;

  if (embeddedPlatforms.length > 0) reviewEcosystemScore += 10;
  if (sameAsLinks.length > 0) reviewEcosystemScore += 5;

  // Testimonials (up to 25 points)
  if (testimonialCount >= 5) reviewEcosystemScore += 10;
  else if (testimonialCount >= 2) reviewEcosystemScore += 5;

  if (hasAttribution) reviewEcosystemScore += 5;
  if (hasPhotos) reviewEcosystemScore += 5;
  if (hasCompanyNames) reviewEcosystemScore += 5;

  // Review schema (up to 15 points)
  if (hasAggregateRating) reviewEcosystemScore += 10;
  if (hasReviewSchema) reviewEcosystemScore += 5;

  // Trust signals (up to 10 points)
  if (hasTrustBadges) reviewEcosystemScore += 3;
  if (hasCertifications) reviewEcosystemScore += 3;
  if (hasAwards) reviewEcosystemScore += 2;
  if (hasMediaMentions) reviewEcosystemScore += 2;

  reviewEcosystemScore = Math.min(100, Math.max(0, reviewEcosystemScore));

  // Generate issues

  // No review platform links
  if (linkedPlatforms.length === 0 && embeddedPlatforms.length === 0) {
    issues.push({
      code: 'AI_NO_REVIEW_PLATFORMS',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'No review platform integration',
      description: 'No links or embeds from review platforms detected. AI uses review signals from multiple platforms to assess brand trust.',
      impact: 'Missing review diversity signals that AI uses when recommending brands.',
      howToFix: 'Link to your profiles on 2-3 relevant review platforms. Consider embedding review widgets for social proof.',
      affectedUrls: [url],
      details: {
        suggestedPlatforms: {
          'All businesses': ['Google Business', 'Trustpilot', 'BBB'],
          'SaaS/Software': ['G2', 'Capterra', 'Product Hunt'],
          'Professional services': ['Clutch', 'UpCity'],
          'Local services': ['Angi', 'HomeAdvisor', 'Yelp'],
        },
      },
    });
  }

  // No testimonials
  if (testimonialCount === 0) {
    issues.push({
      code: 'AI_NO_TESTIMONIALS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No testimonials or reviews on page',
      description: 'No customer testimonials found on the page. AI looks for social proof when evaluating brand trustworthiness.',
      impact: 'Missing on-page social proof that strengthens brand authority.',
      howToFix: 'Add customer testimonials with: name attribution, company/title, and optionally photos. Use blockquote elements for semantic markup.',
      affectedUrls: [url],
    });
  }

  // Testimonials without attribution
  if (testimonialCount > 0 && !hasAttribution) {
    issues.push({
      code: 'AI_UNATTRIBUTED_TESTIMONIALS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Testimonials lack proper attribution',
      description: 'Testimonials found but missing name attribution. Anonymous testimonials have less trust weight.',
      impact: 'Unattributed reviews are less credible for AI trust assessment.',
      howToFix: 'Add author names to testimonials: "Great service! - John Smith, CEO at Acme Corp"',
      affectedUrls: [url],
      details: {
        testimonialCount,
        hasAttribution,
        hasPhotos,
        hasCompanyNames,
      },
    });
  }

  // No review schema
  if (!hasAggregateRating && testimonialCount > 0) {
    issues.push({
      code: 'AI_NO_REVIEW_SCHEMA',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Missing review/rating schema markup',
      description: 'Page has testimonials but no AggregateRating or Review schema. Structured data helps AI understand review context.',
      impact: 'Missing rich snippet opportunity and AI-readable review data.',
      howToFix: 'Add AggregateRating schema with ratingValue, ratingCount, and bestRating. This enables star ratings in search results.',
      affectedUrls: [url],
    });
  }

  // Low review ecosystem score
  if (reviewEcosystemScore < 40) {
    issues.push({
      code: 'AI_WEAK_REVIEW_ECOSYSTEM',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Weak review ecosystem integration',
      description: `Review ecosystem score: ${reviewEcosystemScore}/100. AI uses review diversity across platforms to assess brand trust.`,
      impact: 'Low review presence may result in AI recommending better-reviewed competitors.',
      howToFix: 'Build review diversity: 1) Link to review platforms, 2) Add testimonials with attribution, 3) Implement review schema, 4) Display trust badges.',
      affectedUrls: [url],
      details: {
        reviewEcosystemScore,
        linkedPlatforms,
        testimonialCount,
        hasAggregateRating,
      },
    });
  }

  return {
    issues,
    data: {
      reviewPlatforms: {
        linked: linkedPlatforms,
        embedded: embeddedPlatforms,
        sameAsLinks: [...new Set(sameAsLinks)],
      },
      testimonials: {
        count: testimonialCount,
        hasAttribution,
        hasPhotos,
        hasCompanyNames,
      },
      reviewSchema: {
        hasAggregateRating,
        hasReviewSchema,
        ratingValue,
        reviewCount,
      },
      trustSignals: {
        hasTrustBadges,
        hasCertifications,
        hasAwards,
        hasMediaMentions,
      },
      reviewEcosystemScore,
    },
  };
}
