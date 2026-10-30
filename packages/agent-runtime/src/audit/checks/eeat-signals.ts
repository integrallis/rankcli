// E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) Signals Detection
// Based on Google's Quality Rater Guidelines and advanced SEO research

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface AuthorInfo {
  name: string | null;
  bio: string | null;
  credentials: string[];
  socialLinks: string[];
  hasSchema: boolean;
  photoPresent: boolean;
}

export interface OrganizationInfo {
  name: string | null;
  type: string | null;
  hasSchema: boolean;
  hasContactInfo: boolean;
  hasSocialProfiles: boolean;
  trustBadges: string[];
}

export interface ReviewInfo {
  hasReviewer: boolean;
  reviewerName: string | null;
  reviewerCredentials: string[];
  reviewDate: string | null;
  nextReviewDate: string | null;
  reviewType: 'medical' | 'expert' | 'fact-check' | 'editorial' | null;
}

export interface TrustBadgeInfo {
  pressFeatures: string[]; // "As seen in Forbes", "Featured in..."
  certifications: string[]; // "Clinically studied", "FDA approved"
  awards: string[];
  partnerships: string[];
}

export interface EEATData {
  author: AuthorInfo;
  organization: OrganizationInfo;
  reviewer: ReviewInfo;
  trustBadges: TrustBadgeInfo;
  experienceSignals: string[];
  expertiseSignals: string[];
  authoritySignals: string[];
  trustSignals: string[];
  citationCount: number;
  authoritativeSources: string[];
  contentDate: {
    published: string | null;
    modified: string | null;
  };
  hasVideoContent: boolean;
  videoExperienceSignals: string[];
  isYMYL: boolean;
}

// Credential patterns that indicate expertise
const CREDENTIAL_PATTERNS = [
  /\b(MD|M\.D\.|Dr\.|Doctor)\b/i,
  /\b(PhD|Ph\.D\.|Doctorate)\b/i,
  /\b(JD|J\.D\.|Attorney|Lawyer|Esq\.)\b/i,
  /\b(CPA|Certified Public Accountant)\b/i,
  /\b(CFP|Certified Financial Planner)\b/i,
  /\b(RN|Registered Nurse)\b/i,
  /\b(PE|Professional Engineer)\b/i,
  /\b(MBA|Master of Business)\b/i,
  /\b(Professor|Prof\.)\b/i,
  /\b(Licensed|Certified|Accredited)\b/i,
  /\b(\d+\+?\s*years?\s*(of\s+)?experience)\b/i,
];

// Trust badge patterns
const TRUST_BADGE_PATTERNS = [
  /BBB\s*(Accredited|A\+|Rating)/i,
  /Norton\s*Secure/i,
  /McAfee\s*Secure/i,
  /TRUSTe/i,
  /SSL\s*(Secure|Certified)/i,
  /Verified\s*(by|Business)/i,
  /Award[\-\s]*(Winning|Winner)/i,
  /ISO\s*\d+/i,
  /HIPAA\s*Compliant/i,
  /GDPR\s*Compliant/i,
  /PCI[\-\s]*(DSS|Compliant)/i,
  /SOC\s*2/i,
];

// Authoritative source domains
const AUTHORITATIVE_DOMAINS = [
  'wikipedia.org',
  'gov',
  'edu',
  'nytimes.com',
  'wsj.com',
  'bbc.com',
  'reuters.com',
  'nature.com',
  'science.org',
  'pubmed.ncbi.nlm.nih.gov',
  'who.int',
  'cdc.gov',
  'nih.gov',
  'harvard.edu',
  'stanford.edu',
  'mit.edu',
];

// YMYL (Your Money Your Life) topic indicators
// YMYL (Your Money or Your Life): pages whose advice can affect health, finances, legal standing
// or safety. A page counts when it's *about* one of these - a term in its title or H1, or one
// topic's terms recurring through the body - not when a word appears once. Matching single words
// ("warning", "price", "health", "law") flagged nearly every page, SEO reports included.
const YMYL_TOPICS: RegExp[] = [
  /\b(medical|medicine|diseases?|treatments?|symptoms?|diagnos(?:is|ed|e)|medications?|prescriptions?|doctors?|patients?|therapy|clinical|mental health|nutrition|pregnan(?:cy|t))\b/gi,
  /\b(invest(?:ing|ments?)?|stocks?|taxes|tax (?:return|advice|filing)|insurance|mortgages?|loans?|credit (?:cards?|scores?)|retirement|pensions?|banking|cryptocurrenc(?:y|ies)|financial advice)\b/gi,
  /\b(attorneys?|lawyers?|lawsuits?|legal advice|divorce|custody|immigration|court cases?)\b/gi,
  /\b(first aid|poison(?:ing)?|suicide|overdose|crisis (?:line|hotline))\b/gi,
  /\b(voting|voter registration|elections?|ballots?)\b/gi,
];
// Tech phrases that reuse YMYL words.
const YMYL_FALSE_FRIENDS = /\b(?:site |seo |system |api )?health (?:scores?|checks?|status|endpoints?|reports?)\b|\bsite health\b/gi;
const YMYL_PATH = /\/(health|medical|finance|financial|legal|money|insurance|taxes|invest(?:ing|ment)?)(\/|$)/i;

/**
 * Extract author information from the page
 */
export function extractAuthorInfo(html: string): AuthorInfo {
  const $ = cheerio.load(html);
  const info: AuthorInfo = {
    name: null,
    bio: null,
    credentials: [],
    socialLinks: [],
    hasSchema: false,
    photoPresent: false,
  };

  // Check for author schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const checkAuthor = (obj: Record<string, unknown>) => {
        if (obj['@type'] === 'Person' || obj.author) {
          info.hasSchema = true;
          const author = obj.author || obj;
          if (typeof author === 'object' && author !== null) {
            info.name = (author as Record<string, string>).name || info.name;
          }
        }
      };

      if (Array.isArray(data)) {
        data.forEach(checkAuthor);
      } else {
        checkAuthor(data);
      }
    } catch {
      // Invalid JSON
    }
  });

  // Check for author meta tags
  const authorMeta = $('meta[name="author"]').attr('content');
  if (authorMeta) {
    info.name = info.name || authorMeta;
  }

  // Check for author link
  const authorLink = $('link[rel="author"]').attr('href');
  if (authorLink) {
    info.socialLinks.push(authorLink);
  }

  // Look for author byline patterns
  const bylineSelectors = [
    '.author',
    '.byline',
    '[rel="author"]',
    '.post-author',
    '.article-author',
    '.author-name',
    '.written-by',
    '[itemprop="author"]',
  ];

  for (const selector of bylineSelectors) {
    const el = $(selector).first();
    if (el.length) {
      const text = el.text().trim();
      if (text && text.length < 100) {
        info.name = info.name || text.replace(/^(by|written by|author:)\s*/i, '');
      }
      break;
    }
  }

  // Look for author bio
  const bioSelectors = ['.author-bio', '.author-description', '.about-author', '[itemprop="description"]'];
  for (const selector of bioSelectors) {
    const el = $(selector).first();
    if (el.length) {
      info.bio = el.text().trim().substring(0, 500);
      break;
    }
  }

  // Check for author photo
  info.photoPresent =
    $('img.author-photo, img.author-image, .author img, [itemprop="image"]').length > 0 ||
    $('img[alt*="author"], img[alt*="Author"]').length > 0;

  // Extract credentials from author name/bio
  const textToCheck = `${info.name || ''} ${info.bio || ''}`;
  for (const pattern of CREDENTIAL_PATTERNS) {
    const match = textToCheck.match(pattern);
    if (match) {
      info.credentials.push(match[0]);
    }
  }

  // Check for social profile links near author info
  $('.author a, .byline a, .author-social a').each((_, el) => {
    const href = $(el).attr('href');
    if (
      href &&
      (href.includes('linkedin.com') ||
        href.includes('twitter.com') ||
        href.includes('github.com') ||
        href.includes('medium.com'))
    ) {
      info.socialLinks.push(href);
    }
  });

  return info;
}

/**
 * Extract organization information
 */
export function extractOrganizationInfo(html: string): OrganizationInfo {
  const $ = cheerio.load(html);
  const info: OrganizationInfo = {
    name: null,
    type: null,
    hasSchema: false,
    hasContactInfo: false,
    hasSocialProfiles: false,
    trustBadges: [],
  };

  // Check for organization schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const checkOrg = (obj: Record<string, unknown>) => {
        const type = obj['@type'] as string;
        if (type === 'Organization' || type === 'LocalBusiness' || type === 'Corporation') {
          info.hasSchema = true;
          info.name = obj.name as string || info.name;
          info.type = type;
          if (obj.contactPoint || obj.telephone || obj.email) {
            info.hasContactInfo = true;
          }
          if (obj.sameAs && Array.isArray(obj.sameAs) && (obj.sameAs as string[]).length > 0) {
            info.hasSocialProfiles = true;
          }
        }
      };

      if (Array.isArray(data)) {
        data.forEach(checkOrg);
      } else {
        checkOrg(data);
      }
    } catch {
      // Invalid JSON
    }
  });

  // Check for contact information
  const hasContact =
    $('a[href^="tel:"]').length > 0 ||
    $('a[href^="mailto:"]').length > 0 ||
    $('.contact, #contact, [class*="contact"]').length > 0;
  info.hasContactInfo = info.hasContactInfo || hasContact;

  // Check for social profile links
  const socialLinks = $('a[href*="facebook.com"], a[href*="twitter.com"], a[href*="linkedin.com"], a[href*="instagram.com"]');
  info.hasSocialProfiles = info.hasSocialProfiles || socialLinks.length > 0;

  // Look for trust badges
  const pageText = $.text();
  for (const pattern of TRUST_BADGE_PATTERNS) {
    const match = pageText.match(pattern);
    if (match) {
      info.trustBadges.push(match[0]);
    }
  }

  return info;
}

/**
 * Detect experience signals (first-hand experience indicators)
 */
export function detectExperienceSignals(html: string): string[] {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const text = $('body').text();
  const signals: string[] = [];

  const experiencePatterns = [
    /\bI (tested|tried|used|reviewed|experienced|personally)\b/i,
    /\bin my experience\b/i,
    /\bwe (tested|tried|used|reviewed|found)\b/i,
    /\bfirst-hand\b/i,
    /\bhands-on\b/i,
    /\bI've been (using|doing|working)\b/i,
    /\bfor (\d+) years? I've\b/i,
    /\bour team (tested|reviewed|evaluated)\b/i,
  ];

  for (const pattern of experiencePatterns) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        signals.push(match[0]);
      }
    }
  }

  // Check for original images (simplified - checking for non-stock patterns)
  const hasOriginalImages =
    $('img[src*="author"], img[src*="team"], img[src*="review"], img[src*="test"]').length > 0;
  if (hasOriginalImages) {
    signals.push('Original images present');
  }

  // Check for user reviews/testimonials
  const hasReviews =
    $('[class*="review"], [class*="testimonial"], [itemtype*="Review"]').length > 0;
  if (hasReviews) {
    signals.push('User reviews/testimonials present');
  }

  return signals;
}

/**
 * Detect expertise signals
 */
export function detectExpertiseSignals(html: string): string[] {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const signals: string[] = [];

  // Check for technical depth
  const technicalPatterns = [
    /\b(methodology|analysis|research|study|data)\b/i,
    /\b(according to|based on|supported by)\b/i,
    /\b(statistics|metrics|measurements)\b/i,
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(text)) {
      signals.push('Technical/research depth');
      break;
    }
  }

  // Check for credentials in content
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        signals.push(`Credential: ${match[0]}`);
      }
    }
  }

  // Check for "reviewed by" or "medically reviewed"
  if (/\b(reviewed by|fact-checked by|medically reviewed|expert reviewed)\b/i.test(text)) {
    signals.push('Expert review indicated');
  }

  return signals;
}

/**
 * Count and categorize external citations
 */
export function analyzeCitations(html: string): { count: number; authoritativeSources: string[] } {
  const $ = cheerio.load(html);
  const authoritativeSources: string[] = [];
  let citationCount = 0;

  $('a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const url = new URL(href);
      const hostname = url.hostname.toLowerCase();

      // Check if it's an authoritative source
      for (const domain of AUTHORITATIVE_DOMAINS) {
        if (hostname.includes(domain) || hostname.endsWith(`.${domain}`)) {
          authoritativeSources.push(hostname);
          citationCount++;
          break;
        }
      }
    } catch {
      // Invalid URL
    }
  });

  return { count: citationCount, authoritativeSources: [...new Set(authoritativeSources)] };
}

/**
 * Extract reviewer information (medically reviewed, fact-checked, etc.)
 */
export function extractReviewerInfo(html: string): ReviewInfo {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const info: ReviewInfo = {
    hasReviewer: false,
    reviewerName: null,
    reviewerCredentials: [],
    reviewDate: null,
    nextReviewDate: null,
    reviewType: null,
  };

  // Check for "reviewed by" patterns
  const reviewPatterns = [
    /medically reviewed by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /reviewed by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /fact[- ]checked by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /verified by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /expert reviewed by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];

  for (const pattern of reviewPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.hasReviewer = true;
      info.reviewerName = match[1];

      // Determine review type
      if (/medical/i.test(match[0])) {
        info.reviewType = 'medical';
      } else if (/fact[- ]check/i.test(match[0])) {
        info.reviewType = 'fact-check';
      } else if (/expert/i.test(match[0])) {
        info.reviewType = 'expert';
      } else {
        info.reviewType = 'editorial';
      }

      // Extract credentials if present near the name
      for (const credPattern of CREDENTIAL_PATTERNS) {
        const credMatch = text.substring(match.index || 0, (match.index || 0) + 200).match(credPattern);
        if (credMatch) {
          info.reviewerCredentials.push(credMatch[0]);
        }
      }
      break;
    }
  }

  // Check for review date patterns
  const reviewDatePatterns = [
    /last reviewed[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /reviewed on[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /review date[:\s]+(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of reviewDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.reviewDate = match[1];
      break;
    }
  }

  // Check for next review date (important for health content freshness)
  const nextReviewPatterns = [
    /next review[:\s]+(\w+\s+\d{4})/i,
    /due for review[:\s]+(\w+\s+\d{4})/i,
    /review due[:\s]+(\w+\s+\d{4})/i,
  ];

  for (const pattern of nextReviewPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.nextReviewDate = match[1];
      break;
    }
  }

  // Check for reviewer elements
  const reviewerSelectors = [
    '.reviewed-by', '.fact-checker', '.medical-reviewer',
    '[class*="reviewer"]', '[class*="fact-check"]',
  ];
  for (const selector of reviewerSelectors) {
    const el = $(selector).first();
    if (el.length) {
      info.hasReviewer = true;
      const elText = el.text().trim();
      if (elText.length < 100 && !info.reviewerName) {
        info.reviewerName = elText.replace(/^(reviewed by|fact-checked by|verified by)\s*/i, '');
      }
      break;
    }
  }

  return info;
}

/**
 * Extract trust badges ("As seen in", "Clinically studied", awards, etc.)
 */
export function extractTrustBadges(html: string): TrustBadgeInfo {
  const $ = cheerio.load(html);
  const text = $('body').text().toLowerCase();
  const htmlLower = html.toLowerCase();

  const info: TrustBadgeInfo = {
    pressFeatures: [],
    certifications: [],
    awards: [],
    partnerships: [],
  };

  // Press/media features ("As seen in", "Featured in")
  const pressPatterns = [
    /as seen (?:in|on)\s+([^.]+)/gi,
    /featured (?:in|on)\s+([^.]+)/gi,
    /covered by\s+([^.]+)/gi,
    /mentioned (?:in|by)\s+([^.]+)/gi,
  ];

  for (const pattern of pressPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Extract publication names
      const publications = match[1]
        .split(/,|\band\b/)
        .map(p => p.trim())
        .filter(p => p.length > 2 && p.length < 50);
      info.pressFeatures.push(...publications);
    }
  }

  // Check for press logo sections
  const pressSelectors = [
    '.as-seen-in', '.featured-in', '.press-logos', '.media-logos',
    '[class*="press"]', '[class*="featured"]', '.trust-badges',
  ];
  for (const selector of pressSelectors) {
    if ($(selector).length > 0) {
      // Check for common press outlet names in images
      $(`${selector} img`).each((_, el) => {
        const alt = $(el).attr('alt') || '';
        const src = $(el).attr('src') || '';
        const combined = (alt + src).toLowerCase();
        const outlets = ['forbes', 'nytimes', 'wsj', 'bbc', 'cnn', 'techcrunch', 'wired', 'bloomberg'];
        for (const outlet of outlets) {
          if (combined.includes(outlet) && !info.pressFeatures.includes(outlet)) {
            info.pressFeatures.push(outlet);
          }
        }
      });
    }
  }

  // Certifications and research backing
  const certPatterns = [
    { pattern: /clinically (?:studied|proven|tested)/gi, type: 'Clinically studied' },
    { pattern: /fda[- ](?:approved|cleared|registered)/gi, type: 'FDA approved' },
    { pattern: /dermatologist[- ](?:tested|recommended)/gi, type: 'Dermatologist tested' },
    { pattern: /doctor[- ](?:recommended|approved)/gi, type: 'Doctor recommended' },
    { pattern: /lab[- ]tested/gi, type: 'Lab tested' },
    { pattern: /third[- ]party[- ]tested/gi, type: 'Third-party tested' },
    { pattern: /scientifically[- ](?:proven|backed)/gi, type: 'Scientifically proven' },
    { pattern: /peer[- ]reviewed/gi, type: 'Peer reviewed' },
    { pattern: /iso[- ]\d+[- ]certified/gi, type: 'ISO certified' },
    { pattern: /organic[- ]certified/gi, type: 'Organic certified' },
    { pattern: /usda[- ]organic/gi, type: 'USDA Organic' },
  ];

  for (const { pattern, type } of certPatterns) {
    if (pattern.test(text)) {
      info.certifications.push(type);
    }
  }

  // Awards
  const awardPatterns = [
    /(?:won|received|awarded)\s+(?:the\s+)?([^.]+award)/gi,
    /award[- ]winning/gi,
    /best (?:of|in) \d{4}/gi,
    /editor'?s? choice/gi,
    /top[- ]rated/gi,
    /#1 (?:rated|ranked|best)/gi,
  ];

  for (const pattern of awardPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.awards.push(match[0]);
    }
  }

  // Partnerships ("Trusted by", "Used by")
  const partnerPatterns = [
    /trusted by\s+([^.]+)/gi,
    /used by\s+([^.]+)/gi,
    /partnered? with\s+([^.]+)/gi,
    /official partner/gi,
  ];

  for (const pattern of partnerPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.partnerships.push(match[0].substring(0, 100));
    }
  }

  // Deduplicate
  info.pressFeatures = [...new Set(info.pressFeatures)].slice(0, 10);
  info.certifications = [...new Set(info.certifications)];
  info.awards = [...new Set(info.awards)].slice(0, 5);
  info.partnerships = [...new Set(info.partnerships)].slice(0, 5);

  return info;
}

/**
 * Detect video content and video experience signals
 */
export function detectVideoExperienceSignals(html: string): { hasVideo: boolean; signals: string[] } {
  const $ = cheerio.load(html);
  const signals: string[] = [];

  // Check for video elements
  const hasVideoElement = $('video').length > 0;
  const hasYouTubeEmbed = $('iframe[src*="youtube"], iframe[src*="youtu.be"]').length > 0;
  const hasVimeoEmbed = $('iframe[src*="vimeo"]').length > 0;
  const hasWistiaEmbed = $('script[src*="wistia"], [class*="wistia"]').length > 0;
  const hasVideoSchema = html.includes('"@type":"VideoObject"') || html.includes('"@type": "VideoObject"');

  const hasVideo = hasVideoElement || hasYouTubeEmbed || hasVimeoEmbed || hasWistiaEmbed;

  if (hasVideo) {
    signals.push('Video content present');

    if (hasVideoSchema) {
      signals.push('VideoObject schema present');
    }

    // Check for video context suggesting experience
    const videoContextSelectors = [
      '.video-demo', '.product-video', '.review-video', '.tutorial-video',
      '[class*="demo"]', '[class*="walkthrough"]', '[class*="how-to"]',
    ];

    for (const selector of videoContextSelectors) {
      if ($(selector).length > 0) {
        signals.push('Demonstration/tutorial video present');
        break;
      }
    }

    // Check video titles/descriptions for experience indicators
    const videoTitles = $('video, iframe').map((_, el) => {
      return $(el).attr('title') || $(el).attr('aria-label') || '';
    }).get().join(' ').toLowerCase();

    if (/review|test|demo|hands-on|unboxing|how-to|tutorial/.test(videoTitles)) {
      signals.push('Experience-based video content');
    }
  }

  // Check for video testimonials
  if ($('[class*="video-testimonial"], [class*="video-review"]').length > 0) {
    signals.push('Video testimonials present');
  }

  return { hasVideo, signals };
}

/**
 * Extract content dates
 */
export function extractContentDates(html: string): { published: string | null; modified: string | null } {
  const $ = cheerio.load(html);
  let published: string | null = null;
  let modified: string | null = null;

  // Check schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const checkDates = (obj: Record<string, unknown>) => {
        published = published || (obj.datePublished as string) || null;
        modified = modified || (obj.dateModified as string) || null;
      };

      if (Array.isArray(data)) {
        data.forEach(checkDates);
      } else {
        checkDates(data);
      }
    } catch {
      // Invalid JSON
    }
  });

  // Check meta tags
  published = published || $('meta[property="article:published_time"]').attr('content') || null;
  modified = modified || $('meta[property="article:modified_time"]').attr('content') || null;

  // Check time elements
  if (!published) {
    const timeEl = $('time[datetime]').first();
    published = timeEl.attr('datetime') || null;
  }

  return { published, modified };
}

/**
 * Detect if content is YMYL (Your Money Your Life)
 */
export function detectYMYL(html: string, url: string): boolean {
  const $ = cheerio.load(html);
  const heading = `${$('title').text()} ${$('h1').text()}`.replace(YMYL_FALSE_FRIENDS, ' ');
  const body = $('body').text().replace(YMYL_FALSE_FRIENDS, ' ');
  const words = Math.max(1, body.split(/\s+/).filter(Boolean).length);

  for (const topic of YMYL_TOPICS) {
    if ((heading.match(topic) ?? []).length > 0) return true; // the page is about it
    const hits = (body.match(topic) ?? []).length;
    if (hits >= 5 && (hits / words) * 1000 >= 4) return true; // or keeps coming back to it
  }

  try {
    return YMYL_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Main function: Analyze E-E-A-T signals
 */
export function analyzeEEATSignals(
  html: string,
  url: string
): { issues: AuditIssue[]; data: EEATData } {
  const issues: AuditIssue[] = [];

  const author = extractAuthorInfo(html);
  const organization = extractOrganizationInfo(html);
  const reviewer = extractReviewerInfo(html);
  const trustBadges = extractTrustBadges(html);
  const experienceSignals = detectExperienceSignals(html);
  const expertiseSignals = detectExpertiseSignals(html);
  const citations = analyzeCitations(html);
  const contentDate = extractContentDates(html);
  const videoExperience = detectVideoExperienceSignals(html);
  const isYMYL = detectYMYL(html, url);

  // Build authority signals list
  const authoritySignals: string[] = [];
  if (organization.hasSchema) authoritySignals.push('Organization schema present');
  if (author.hasSchema) authoritySignals.push('Author schema present');
  if (citations.authoritativeSources.length > 0) {
    authoritySignals.push(`Citations to ${citations.authoritativeSources.length} authoritative sources`);
  }

  // Build trust signals list
  const trustSignals: string[] = [];
  if (organization.hasContactInfo) trustSignals.push('Contact information present');
  if (organization.trustBadges.length > 0) {
    trustSignals.push(`Trust badges: ${organization.trustBadges.join(', ')}`);
  }
  if (url.startsWith('https://')) trustSignals.push('HTTPS enabled');

  // Generate issues for YMYL content with missing E-E-A-T signals
  if (isYMYL) {
    if (!author.name && !author.hasSchema) {
      issues.push({
        code: 'YMYL_NO_AUTHOR',
        severity: 'warning',
        category: 'content',
        title: 'YMYL content without author information',
        description: 'This appears to be YMYL (Your Money Your Life) content but has no visible author.',
        impact: 'Google prioritizes E-E-A-T signals heavily for YMYL topics.',
        howToFix: 'Add author byline with credentials, bio, and author schema.',
        affectedUrls: [url],
      });
    }

    if (author.credentials.length === 0 && expertiseSignals.length === 0) {
      issues.push({
        code: 'YMYL_NO_EXPERTISE',
        severity: 'warning',
        category: 'content',
        title: 'YMYL content without expertise signals',
        description: 'YMYL content lacks visible expertise indicators (credentials, qualifications).',
        impact: 'Expertise is crucial for YMYL content ranking.',
        howToFix: 'Include author credentials, "reviewed by" statements, or cite expert sources.',
        affectedUrls: [url],
      });
    }

    if (citations.authoritativeSources.length === 0) {
      issues.push({
        code: 'YMYL_NO_CITATIONS',
        severity: 'warning',
        category: 'content',
        title: 'YMYL content without authoritative citations',
        description: 'YMYL content has no links to authoritative sources (.gov, .edu, etc.).',
        impact: 'Citing authoritative sources builds trust for sensitive topics.',
        howToFix: 'Add citations to government, academic, or recognized industry sources.',
        affectedUrls: [url],
      });
    }
  }

  // General E-E-A-T recommendations
  if (!author.name && !organization.name) {
    issues.push({
      code: 'NO_ENTITY_IDENTIFIED',
      severity: 'notice',
      category: 'content',
      title: 'No author or organization identified',
      description: 'Page lacks clear attribution to an author or organization.',
      impact: 'Anonymous content may be seen as less trustworthy.',
      howToFix: 'Add author byline or organization information with structured data.',
      affectedUrls: [url],
    });
  }

  if (!organization.hasSchema) {
    issues.push({
      code: 'NO_ORGANIZATION_SCHEMA',
      severity: 'notice',
      category: 'structured-data',
      title: 'Missing Organization schema',
      description: 'No Organization structured data found.',
      impact: 'Missed opportunity to establish organizational identity for E-E-A-T.',
      howToFix: 'Add Organization schema with name, logo, contact, and social profiles.',
      affectedUrls: [url],
    });
  }

  if (!author.hasSchema && author.name) {
    issues.push({
      code: 'AUTHOR_NO_SCHEMA',
      severity: 'notice',
      category: 'structured-data',
      title: 'Author without Person schema',
      description: 'Author name is present but no Person structured data.',
      impact: 'Person schema helps Google understand author entity relationships.',
      howToFix: 'Add Person schema with sameAs links to author profiles.',
      affectedUrls: [url],
    });
  }

  if (!contentDate.modified && contentDate.published) {
    issues.push({
      code: 'NO_MODIFIED_DATE',
      severity: 'notice',
      category: 'content',
      title: 'No content modification date',
      description: 'Content has published date but no last-modified date.',
      impact: 'Modified dates signal content freshness to search engines.',
      howToFix: 'Add article:modified_time meta tag or dateModified in schema.',
      affectedUrls: [url],
    });
  }

  if (experienceSignals.length === 0 && !isYMYL) {
    issues.push({
      code: 'NO_EXPERIENCE_SIGNALS',
      severity: 'notice',
      category: 'content',
      title: 'No first-hand experience signals detected',
      description: 'Content lacks indicators of personal/first-hand experience.',
      impact: 'The "Experience" in E-E-A-T values authentic, first-hand knowledge.',
      howToFix: 'Add personal insights, original photos, or hands-on testing details.',
      affectedUrls: [url],
    });
  }

  // Additional issues for enhanced E-E-A-T signals (2025 best practices)

  // YMYL content without medical/expert reviewer
  if (isYMYL && !reviewer.hasReviewer) {
    const $ = cheerio.load(html);
    const isHealthContent = /health|medical|disease|symptom|treatment/i.test($('title').text() + $('h1').text());

    if (isHealthContent) {
      issues.push({
        code: 'YMYL_NO_MEDICAL_REVIEWER',
        severity: 'warning',
        category: 'content',
        title: 'Health content without medical reviewer',
        description: 'Health-related content lacks "medically reviewed by" or expert reviewer information.',
        impact: 'Google strongly prefers health content reviewed by qualified medical professionals.',
        howToFix: 'Add "Medically reviewed by [Name, Credentials]" with reviewer bio and review date.',
        affectedUrls: [url],
      });
    }
  }

  // Content with reviewer but no review date
  if (reviewer.hasReviewer && !reviewer.reviewDate) {
    issues.push({
      code: 'REVIEWER_NO_DATE',
      severity: 'notice',
      category: 'content',
      title: 'Reviewer present but no review date',
      description: 'Content shows a reviewer but does not display when the review was conducted.',
      impact: 'Review dates help establish content freshness and credibility.',
      howToFix: 'Add "Last reviewed: [Date]" near the reviewer attribution.',
      affectedUrls: [url],
    });
  }

  // Commercial and review pages are recognised by what the page says about itself, not by
  // any of "best", "review", "price" or "service" appearing anywhere in the HTML (which made
  // REVIEW_NO_VIDEO fire on every site audited).
  const $$ = cheerio.load(html);
  const headline = `${$$('title').text()} ${$$('h1').text()}`.toLowerCase();
  const bodyText = $$('body').text();
  const isCommercial = /\b(add to cart|buy now|checkout|order now|pricing)\b/i.test(bodyText) || /[$€£]\s?\d/.test(bodyText);
  if (isCommercial && trustBadges.pressFeatures.length === 0 && trustBadges.certifications.length === 0) {
    issues.push({
      code: 'COMMERCIAL_NO_TRUST_BADGES',
      severity: 'notice',
      category: 'content',
      title: 'Commercial content without trust signals',
      description: 'Product/service page lacks "As seen in", certifications, or trust badges.',
      impact: 'Trust badges and press features build credibility and influence AI recommendations.',
      howToFix: 'Add "As seen in [Press]" logos, certifications, or customer testimonials with ratings.',
      affectedUrls: [url],
    });
  }

  // Video experience for product/review content
  const isReviewContent = /\b(review|reviews|reviewed|comparison|compared|vs\.?|best \w+|top \d+)\b/.test(headline);
  if (isReviewContent && !videoExperience.hasVideo) {
    issues.push({
      code: 'REVIEW_NO_VIDEO',
      severity: 'notice',
      category: 'content',
      title: 'Review content without video',
      description: 'Product review or comparison content lacks video demonstrations.',
      impact: 'Video content signals first-hand experience, highly valued by Google and AI tools.',
      howToFix: 'Add hands-on video reviews showing actual product testing and demonstration.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      author,
      organization,
      reviewer,
      trustBadges,
      experienceSignals: [...experienceSignals, ...videoExperience.signals],
      expertiseSignals,
      authoritySignals,
      trustSignals,
      citationCount: citations.count,
      authoritativeSources: citations.authoritativeSources,
      contentDate,
      hasVideoContent: videoExperience.hasVideo,
      videoExperienceSignals: videoExperience.signals,
      isYMYL,
    },
  };
}
