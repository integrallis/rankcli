/**
 * AI Citation Worthiness Checks
 *
 * AI systems prefer to cite content that demonstrates originality and
 * human expertise - things AI can't easily fake. This check analyzes
 * signals that make content worthy of being cited as a source.
 *
 * Key insight: "If AI can easily create it, don't publish it.
 * Add what AI can't fake: original data, real experience, real
 * screenshots, real documentation, and real opinions."
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface AICitationWorthinessData {
  originalitySignals: {
    hasOriginalData: boolean;
    hasScreenshots: boolean;
    hasOriginalImages: boolean;
    hasDatedContent: boolean;
    hasFirstPersonExperience: boolean;
  };
  expertiseSignals: {
    hasAuthorByline: boolean;
    hasAuthorCredentials: boolean;
    hasExpertQuotes: boolean;
    hasMethodology: boolean;
    hasPrimaryResearch: boolean;
  };
  proofSignals: {
    hasSpecificNumbers: boolean;
    hasCaseStudies: boolean;
    hasBeforeAfter: boolean;
    hasDocumentation: boolean;
    hasRealExamples: boolean;
  };
  citationWorthinessScore: number;
  aiProofElements: string[];
}

// Patterns indicating original data/research
const ORIGINAL_DATA_PATTERNS = [
  /(?:our data|our research|our study|our analysis|we found|we discovered)/i,
  /(?:survey of|surveyed|interviewed|analyzed)\s+\d+/i,
  /(?:based on|from)\s+\d+[,\d]*\s+(?:data points|samples|responses|users|customers)/i,
  /(?:internal data|proprietary data|our database)/i,
];

// Patterns indicating first-person experience
const EXPERIENCE_PATTERNS = [
  /(?:in my experience|from my experience|i've found|i've seen|i've learned)/i,
  /(?:when i|after i|before i|i personally|i tested|i tried|i used)/i,
  /(?:our team|we tested|we tried|we implemented|we built)/i,
  /(?:case study|real example|actual example|here's what happened)/i,
];

// Patterns indicating expert quotes
const EXPERT_QUOTE_PATTERNS = [
  /(?:according to|says|said|explains|notes)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  /"[^"]{20,}"\s*[-–—]\s*[A-Z]/,
  /[A-Z][a-z]+\s+[A-Z][a-z]+,?\s+(?:CEO|CTO|founder|director|manager|expert|analyst|researcher)/i,
];

// Patterns for specific numbers (not generic)
const SPECIFIC_NUMBER_PATTERNS = [
  /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|k|m|b))?/i, // Dollar amounts
  /\d+(?:\.\d+)?%/,  // Percentages
  /\d{1,2}\/\d{1,2}\/\d{2,4}/, // Dates
  /(?:in|since|from)\s+(?:19|20)\d{2}/, // Years
  /\d+(?:,\d{3})+/, // Large numbers with commas
  /(?:increased|decreased|grew|dropped)\s+(?:by\s+)?\d+/i,
];

// Stock image domains to detect
const STOCK_IMAGE_DOMAINS = [
  'unsplash.com', 'pexels.com', 'shutterstock.com', 'istockphoto.com',
  'gettyimages.com', 'stock.adobe.com', 'depositphotos.com', 'pixabay.com',
  'freepik.com', 'rawpixel.com', '123rf.com', 'stocksy.com',
];

export function analyzeAICitationWorthiness(
  html: string,
  url: string
): { issues: AuditIssue[]; data: AICitationWorthinessData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Remove non-content elements
  const $content = $('body').clone();
  $content.find('nav, footer, script, style, noscript, aside').remove();
  const bodyText = $content.text();

  const aiProofElements: string[] = [];

  // === ORIGINALITY SIGNALS ===

  // Check for original data
  let hasOriginalData = false;
  for (const pattern of ORIGINAL_DATA_PATTERNS) {
    if (pattern.test(bodyText)) {
      hasOriginalData = true;
      aiProofElements.push('Original data/research');
      break;
    }
  }

  // Check for screenshots
  const images = $content.find('img');
  let hasScreenshots = false;
  let hasOriginalImages = false;
  let stockImageCount = 0;
  let totalImages = 0;

  images.each((_, img) => {
    const src = $(img).attr('src') || '';
    const alt = $(img).attr('alt') || '';
    const srcLower = src.toLowerCase();
    const altLower = alt.toLowerCase();
    totalImages++;

    // Check for screenshot patterns
    if (
      srcLower.includes('screenshot') ||
      srcLower.includes('screen-') ||
      altLower.includes('screenshot') ||
      srcLower.includes('capture') ||
      /screen[_-]?\d+/i.test(src)
    ) {
      hasScreenshots = true;
      aiProofElements.push('Screenshots');
    }

    // Check for stock images
    const isStockImage = STOCK_IMAGE_DOMAINS.some(domain => srcLower.includes(domain));
    if (isStockImage) {
      stockImageCount++;
    }
  });

  // If most images aren't stock photos, consider them original
  if (totalImages > 0 && stockImageCount < totalImages * 0.5) {
    hasOriginalImages = true;
    if (totalImages >= 3 && stockImageCount === 0) {
      aiProofElements.push('Original images');
    }
  }

  // Check for dated content (shows real experience over time)
  const datePatterns = [
    /(?:updated|published|written|posted)\s+(?:on\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /(?:last updated|originally published):\s*\d/i,
    /<time[^>]*datetime/i,
  ];
  const hasDatedContent = datePatterns.some(p => p.test(html));
  if (hasDatedContent) {
    aiProofElements.push('Dated/timestamped content');
  }

  // Check for first-person experience
  let hasFirstPersonExperience = false;
  for (const pattern of EXPERIENCE_PATTERNS) {
    if (pattern.test(bodyText)) {
      hasFirstPersonExperience = true;
      aiProofElements.push('First-person experience');
      break;
    }
  }

  // === EXPERTISE SIGNALS ===

  // Check for author byline
  const hasAuthorByline =
    $('[class*="author"], [rel="author"], [itemprop="author"], .byline').length > 0 ||
    /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i.test(bodyText);

  // Check for author credentials
  const credentialPatterns = [
    /(?:PhD|Ph\.D|MD|M\.D|MBA|CPA|JD|J\.D)/,
    /(?:certified|licensed|accredited)\s+\w+/i,
    /\d+\+?\s*years?\s+(?:of\s+)?experience/i,
    /(?:expert|specialist|professional)\s+in/i,
  ];
  const hasAuthorCredentials = credentialPatterns.some(p => p.test(bodyText));
  if (hasAuthorCredentials) {
    aiProofElements.push('Expert credentials');
  }

  // Check for expert quotes
  let hasExpertQuotes = false;
  for (const pattern of EXPERT_QUOTE_PATTERNS) {
    if (pattern.test(bodyText)) {
      hasExpertQuotes = true;
      aiProofElements.push('Expert quotes');
      break;
    }
  }

  // Check for methodology section
  const hasMethodology =
    /(?:methodology|method|approach|how we|our process)/i.test(
      $('h2, h3, h4').text()
    ) ||
    /(?:we measured|we calculated|we analyzed|data was collected)/i.test(bodyText);

  // Check for primary research indicators
  const hasPrimaryResearch =
    /(?:original research|primary research|we conducted|our study found)/i.test(bodyText) ||
    /(?:sample size|n\s*=\s*\d+|participants|respondents)/i.test(bodyText);

  if (hasPrimaryResearch) {
    aiProofElements.push('Primary research');
  }

  // === PROOF SIGNALS ===

  // Check for specific numbers
  let specificNumberCount = 0;
  for (const pattern of SPECIFIC_NUMBER_PATTERNS) {
    const matches = bodyText.match(pattern);
    if (matches) {
      specificNumberCount += matches.length;
    }
  }
  const hasSpecificNumbers = specificNumberCount >= 5;
  if (hasSpecificNumbers) {
    aiProofElements.push('Specific data points');
  }

  // Check for case studies
  const hasCaseStudies =
    /(?:case study|case studies|success story|client story)/i.test(bodyText) ||
    $('[class*="case-study"], [id*="case-study"]').length > 0;

  if (hasCaseStudies) {
    aiProofElements.push('Case studies');
  }

  // Check for before/after comparisons
  const hasBeforeAfter =
    /(?:before and after|before\/after|before vs|the results)/i.test(bodyText) ||
    $('[class*="before-after"], [class*="comparison"]').length > 0;

  // Check for documentation/code examples
  const hasDocumentation =
    $('pre code, .highlight, .code-block').length > 0 ||
    /```[\s\S]*?```/.test(bodyText) ||
    $('[class*="documentation"]').length > 0;

  if (hasDocumentation) {
    aiProofElements.push('Code/documentation');
  }

  // Check for real examples
  const hasRealExamples =
    /(?:for example|here's an example|real example|actual example|let me show)/i.test(bodyText) ||
    /(?:example:|e\.g\.,|such as:)/i.test(bodyText);

  // === CALCULATE SCORE ===
  let citationWorthinessScore = 20; // Base score

  // Originality signals (up to 35 points)
  if (hasOriginalData) citationWorthinessScore += 15;
  if (hasScreenshots) citationWorthinessScore += 5;
  if (hasOriginalImages) citationWorthinessScore += 5;
  if (hasDatedContent) citationWorthinessScore += 5;
  if (hasFirstPersonExperience) citationWorthinessScore += 5;

  // Expertise signals (up to 25 points)
  if (hasAuthorByline) citationWorthinessScore += 5;
  if (hasAuthorCredentials) citationWorthinessScore += 10;
  if (hasExpertQuotes) citationWorthinessScore += 5;
  if (hasMethodology) citationWorthinessScore += 5;
  if (hasPrimaryResearch) citationWorthinessScore += 10;

  // Proof signals (up to 20 points)
  if (hasSpecificNumbers) citationWorthinessScore += 5;
  if (hasCaseStudies) citationWorthinessScore += 5;
  if (hasBeforeAfter) citationWorthinessScore += 3;
  if (hasDocumentation) citationWorthinessScore += 4;
  if (hasRealExamples) citationWorthinessScore += 3;

  citationWorthinessScore = Math.min(100, Math.max(0, citationWorthinessScore));

  // === GENERATE ISSUES ===

  // No original data or research
  if (!hasOriginalData && !hasPrimaryResearch) {
    issues.push({
      code: 'AI_NO_ORIGINAL_DATA',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No original data or research signals',
      description: 'Content lacks original data, surveys, or research findings. AI prefers citing sources with unique, first-party data.',
      impact: 'Generic content without original data is less likely to be cited as a source.',
      howToFix: 'Add original data: survey results, internal analytics, case study numbers, or primary research findings. Use phrases like "Our data shows..." or "We surveyed X users...".',
      affectedUrls: [url],
    });
  }

  // No first-person experience
  if (!hasFirstPersonExperience && !hasCaseStudies) {
    issues.push({
      code: 'AI_NO_EXPERIENCE_SIGNALS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No first-hand experience signals',
      description: 'Content reads like it could be AI-generated. No "I tested...", "We implemented...", or case study language found.',
      impact: 'AI may prefer sources that demonstrate real-world experience over generic explanations.',
      howToFix: 'Add personal experience: "In my experience...", "When we tested...", "Here\'s what happened when...". Include specific scenarios you\'ve encountered.',
      affectedUrls: [url],
    });
  }

  // Stock images detected
  if (stockImageCount > 0 && stockImageCount >= totalImages * 0.5) {
    issues.push({
      code: 'AI_STOCK_IMAGE_HEAVY',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Heavy use of stock images',
      description: `${stockImageCount} of ${totalImages} images appear to be from stock photo sites. Original visuals signal authenticity.`,
      impact: 'Stock-heavy content appears less authentic and expert to both users and AI.',
      howToFix: 'Replace stock photos with original screenshots, diagrams, photos, or custom graphics that AI cannot easily replicate.',
      affectedUrls: [url],
      details: {
        stockImageCount,
        totalImages,
      },
    });
  }

  // No author credentials
  if (!hasAuthorByline && !hasAuthorCredentials) {
    issues.push({
      code: 'AI_NO_AUTHOR_EXPERTISE',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No author expertise signals',
      description: 'No author byline or credentials found. AI values content from identifiable experts.',
      impact: 'Anonymous content is less trustworthy for AI citation purposes.',
      howToFix: 'Add author byline with credentials: name, title, years of experience, certifications, or relevant expertise.',
      affectedUrls: [url],
    });
  }

  // Low citation worthiness
  if (citationWorthinessScore < 40) {
    issues.push({
      code: 'AI_LOW_CITATION_WORTHINESS',
      // A notice: a heuristic score, not a defect a crawler can see, and it fired on most sites.
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Content lacks AI-proof originality signals',
      description: `Citation worthiness score: ${citationWorthinessScore}/100. Content appears generic and could be easily replicated by AI.`,
      impact: 'AI may not cite this content as it lacks unique value that AI cannot generate itself.',
      howToFix: 'Add what AI can\'t fake: original data, real screenshots, dated experiences, expert quotes, case studies, and specific proof points.',
      affectedUrls: [url],
      details: {
        citationWorthinessScore,
        aiProofElements: aiProofElements.length > 0 ? aiProofElements : ['None detected'],
        missing: [
          !hasOriginalData && 'Original data/research',
          !hasFirstPersonExperience && 'First-person experience',
          !hasAuthorCredentials && 'Expert credentials',
          !hasSpecificNumbers && 'Specific data points',
        ].filter(Boolean),
      },
    });
  }

  return {
    issues,
    data: {
      originalitySignals: {
        hasOriginalData,
        hasScreenshots,
        hasOriginalImages,
        hasDatedContent,
        hasFirstPersonExperience,
      },
      expertiseSignals: {
        hasAuthorByline,
        hasAuthorCredentials,
        hasExpertQuotes,
        hasMethodology,
        hasPrimaryResearch,
      },
      proofSignals: {
        hasSpecificNumbers,
        hasCaseStudies,
        hasBeforeAfter,
        hasDocumentation,
        hasRealExamples,
      },
      citationWorthinessScore,
      aiProofElements,
    },
  };
}
