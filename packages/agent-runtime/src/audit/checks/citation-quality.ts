/**
 * Citation Quality Checks
 *
 * AI prioritizes content that cites reputable sources. Well-cited content
 * demonstrates expertise and trustworthiness (E-E-A-T signals).
 * These checks verify proper citation practices.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

// Reputable source domains by category
const REPUTABLE_SOURCES = {
  academic: [
    'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov',
    'arxiv.org', 'jstor.org', 'researchgate.net', 'sciencedirect.com',
    'nature.com', 'science.org', 'springer.com', 'wiley.com',
  ],
  government: [
    'gov', 'gov.uk', 'europa.eu', 'un.org', 'who.int', 'cdc.gov',
    'nih.gov', 'fda.gov', 'epa.gov', 'sec.gov', 'ftc.gov',
  ],
  educational: [
    '.edu', 'mit.edu', 'stanford.edu', 'harvard.edu', 'oxford.ac.uk',
    'cambridge.org', 'coursera.org', 'khanacademy.org',
  ],
  authoritative: [
    'wikipedia.org', 'britannica.com', 'statista.com', 'pewresearch.org',
    'gallup.com', 'mckinsey.com', 'hbr.org', 'forbes.com', 'reuters.com',
    'apnews.com', 'bbc.com', 'nytimes.com', 'wsj.com', 'economist.com',
  ],
  technical: [
    'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'w3.org',
    'ietf.org', 'rfc-editor.org', 'docs.google.com', 'developers.google.com',
  ],
};

export interface CitationQualityData {
  totalLinks: number;
  externalLinks: number;
  citationLinks: number;
  reputableSources: {
    academic: string[];
    government: string[];
    educational: string[];
    authoritative: string[];
    technical: string[];
  };
  citationPatterns: {
    hasInlineCitations: boolean;
    hasReferencesSection: boolean;
    hasStatistics: boolean;
    statisticsWithSources: number;
    statisticsWithoutSources: number;
  };
  citationScore: number;
}

export function analyzeCitationQuality(
  html: string,
  url: string
): { issues: AuditIssue[]; data: CitationQualityData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const parsedUrl = new URL(url);
  const currentDomain = parsedUrl.hostname;

  // Remove nav, footer, aside for content analysis
  const $content = $('body').clone();
  $content.find('nav, footer, aside, script, style, noscript').remove();

  // Collect all links
  const links = $content.find('a[href]');
  let totalLinks = 0;
  let externalLinks = 0;
  let citationLinks = 0;

  const reputableSources: CitationQualityData['reputableSources'] = {
    academic: [],
    government: [],
    educational: [],
    authoritative: [],
    technical: [],
  };

  links.each((_, link) => {
    const href = $(link).attr('href');
    if (!href) return;

    totalLinks++;

    try {
      const linkUrl = new URL(href, url);

      // Skip internal links
      if (linkUrl.hostname === currentDomain || linkUrl.hostname.endsWith(`.${currentDomain}`)) {
        return;
      }

      // Skip common non-citation links
      if (linkUrl.hostname.includes('facebook.com') ||
          linkUrl.hostname.includes('twitter.com') ||
          linkUrl.hostname.includes('instagram.com') ||
          linkUrl.hostname.includes('linkedin.com/share') ||
          linkUrl.hostname.includes('pinterest.com')) {
        return;
      }

      externalLinks++;

      // Check if it's a reputable source
      const hostname = linkUrl.hostname.toLowerCase();

      for (const source of REPUTABLE_SOURCES.academic) {
        if (hostname.includes(source)) {
          reputableSources.academic.push(hostname);
          citationLinks++;
          return;
        }
      }

      for (const source of REPUTABLE_SOURCES.government) {
        if (hostname.endsWith(source) || hostname.includes(`.${source}`)) {
          reputableSources.government.push(hostname);
          citationLinks++;
          return;
        }
      }

      for (const source of REPUTABLE_SOURCES.educational) {
        if (hostname.endsWith(source) || hostname.includes(source)) {
          reputableSources.educational.push(hostname);
          citationLinks++;
          return;
        }
      }

      for (const source of REPUTABLE_SOURCES.authoritative) {
        if (hostname.includes(source)) {
          reputableSources.authoritative.push(hostname);
          citationLinks++;
          return;
        }
      }

      for (const source of REPUTABLE_SOURCES.technical) {
        if (hostname.includes(source)) {
          reputableSources.technical.push(hostname);
          citationLinks++;
          return;
        }
      }

    } catch {
      // Invalid URL
    }
  });

  // Check for citation patterns
  const bodyText = $content.text();
  const bodyHtml = $content.html() || '';

  // Inline citations like [1], (Source: X), (2023), etc.
  const hasInlineCitations =
    /\[\d+\]/.test(bodyText) ||
    /\(Source:/i.test(bodyText) ||
    /\(Citation:/i.test(bodyText) ||
    /according to/i.test(bodyText) ||
    /study (by|from|shows|found)/i.test(bodyText);

  // References section
  const hasReferencesSection =
    /(references|sources|citations|bibliography|works cited)/i.test(
      $('h2, h3, h4, h5, h6').text()
    ) ||
    $('#references, .references, #sources, .sources, #citations').length > 0;

  // Statistics detection
  const statisticPatterns = [
    /(\d+(?:\.\d+)?)\s*%/g, // Percentages
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(million|billion|trillion)/gi, // Large numbers
    /\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, // Dollar amounts
    /(\d+)\s*out of\s*(\d+)/gi, // Ratios
    /(\d+)x\s/gi, // Multipliers
  ];

  let statisticsWithSources = 0;
  let statisticsWithoutSources = 0;

  // Find paragraphs with statistics
  $content.find('p').each((_, p) => {
    const pText = $(p).text();
    const pHtml = $(p).html() || '';

    let hasStatistic = false;
    for (const pattern of statisticPatterns) {
      if (pattern.test(pText)) {
        hasStatistic = true;
        pattern.lastIndex = 0; // Reset regex
        break;
      }
    }

    if (hasStatistic) {
      // Check if paragraph has a citation link
      const hasLink = $(p).find('a[href]').length > 0;
      const hasCitationText = /\(.*\d{4}\)|according to|source:|study/i.test(pText);

      if (hasLink || hasCitationText) {
        statisticsWithSources++;
      } else {
        statisticsWithoutSources++;
      }
    }
  });

  const hasStatistics = statisticsWithSources + statisticsWithoutSources > 0;

  // Calculate citation score (0-100)
  let citationScore = 30; // Base score

  // Reputable source bonuses
  if (reputableSources.academic.length > 0) citationScore += 15;
  if (reputableSources.government.length > 0) citationScore += 15;
  if (reputableSources.educational.length > 0) citationScore += 10;
  if (reputableSources.authoritative.length > 0) citationScore += 10;
  if (reputableSources.technical.length > 0) citationScore += 5;

  // Citation pattern bonuses
  if (hasInlineCitations) citationScore += 10;
  if (hasReferencesSection) citationScore += 10;

  // Statistics citation bonus/penalty
  if (hasStatistics) {
    const citedRatio = statisticsWithSources / (statisticsWithSources + statisticsWithoutSources);
    if (citedRatio >= 0.8) citationScore += 10;
    else if (citedRatio >= 0.5) citationScore += 5;
    else if (citedRatio < 0.3) citationScore -= 10;
  }

  // Penalty for no external links at all
  if (externalLinks === 0) citationScore -= 20;

  citationScore = Math.max(0, Math.min(100, citationScore));

  // Generate issues

  // No reputable sources cited
  const totalReputable = Object.values(reputableSources).flat().length;
  if (totalReputable === 0 && externalLinks > 0) {
    issues.push({
      code: 'AI_NO_REPUTABLE_CITATIONS',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'No reputable sources cited',
      description: 'Content has external links but none to recognized authoritative sources. AI prioritizes content that cites reputable sources.',
      impact: 'Lower E-E-A-T signals and reduced likelihood of AI citing your content.',
      howToFix: 'Add citations to reputable sources: academic papers, government sites (.gov), educational institutions (.edu), or established publications.',
      affectedUrls: [url],
      details: {
        externalLinks,
        reputableLinks: 0,
        suggestedSources: [
          'Academic: scholar.google.com, pubmed.ncbi.nlm.nih.gov',
          'Government: .gov, who.int, cdc.gov',
          'Technical: developer.mozilla.org, w3.org',
        ],
      },
    });
  }

  // No external links at all
  if (externalLinks === 0 && totalLinks > 0) {
    issues.push({
      code: 'AI_NO_EXTERNAL_CITATIONS',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'No external sources linked',
      description: 'Content has no external links. AI values content that references and links to authoritative sources.',
      impact: 'Appears self-contained without external validation, reducing trust signals for AI.',
      howToFix: 'Add relevant external links to support your claims. Link to studies, official documentation, or authoritative sources.',
      affectedUrls: [url],
    });
  }

  // Statistics without sources
  if (statisticsWithoutSources > 0) {
    issues.push({
      code: 'AI_UNCITED_STATISTICS',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Statistics without source citations',
      description: `Found ${statisticsWithoutSources} statistic(s) without linked sources. AI is trained to prefer claims backed by citations.`,
      impact: 'Uncited statistics reduce content credibility and E-E-A-T signals.',
      howToFix: 'Add source links or citations for all statistics. Include the source name and year when possible (e.g., "according to [Source, 2024]").',
      affectedUrls: [url],
      details: {
        statisticsWithSources,
        statisticsWithoutSources,
        citedRatio: statisticsWithSources / (statisticsWithSources + statisticsWithoutSources),
      },
    });
  }

  // No references section for content-heavy pages
  const wordCount = bodyText.split(/\s+/).length;
  if (wordCount > 1000 && !hasReferencesSection && citationLinks > 0) {
    issues.push({
      code: 'AI_NO_REFERENCES_SECTION',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No dedicated references section',
      description: 'Long-form content with citations but no dedicated references section. A references section signals academic rigor.',
      impact: 'Missing opportunity to demonstrate comprehensive research and boost E-E-A-T.',
      howToFix: 'Add a "References" or "Sources" section at the end listing all cited sources with full attribution.',
      affectedUrls: [url],
    });
  }

  // Low citation score
  if (citationScore < 40) {
    issues.push({
      code: 'AI_LOW_CITATION_QUALITY',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Content citation quality needs improvement',
      description: `Citation quality score: ${citationScore}/100. Well-cited content ranks higher in AI search results.`,
      impact: 'Low citation quality signals reduce E-E-A-T and AI citation likelihood.',
      howToFix: 'Improve citations: 1) Link to reputable sources, 2) Cite statistics with sources, 3) Add a references section, 4) Use inline citations for claims.',
      affectedUrls: [url],
      details: {
        citationScore,
        externalLinks,
        reputableSources: totalReputable,
        statisticsWithSources,
        statisticsWithoutSources,
      },
    });
  }

  return {
    issues,
    data: {
      totalLinks,
      externalLinks,
      citationLinks,
      reputableSources,
      citationPatterns: {
        hasInlineCitations,
        hasReferencesSection,
        hasStatistics,
        statisticsWithSources,
        statisticsWithoutSources,
      },
      citationScore,
    },
  };
}
