// Featured Snippet Optimization Checks
// Based on advanced SEO research: optimizing content for featured snippets
// Includes: definition format, list format, table format, Q&A structure

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface SnippetOpportunity {
  type: 'definition' | 'list' | 'table' | 'paragraph' | 'qa';
  heading: string;
  score: number; // 0-100 optimization score
  issues: string[];
  suggestions: string[];
}

export interface FeaturedSnippetData {
  hasDefinitionFormat: boolean;
  hasListFormat: boolean;
  hasTableFormat: boolean;
  hasQAFormat: boolean;
  hasInvertedPyramid: boolean;
  opportunities: SnippetOpportunity[];
  faqSchemaPresent: boolean;
  howToSchemaPresent: boolean;
  questionHeadingsCount: number;
}

/**
 * Detect definition-style content (optimal for "what is" snippets)
 * Pattern: "X is a/an [noun] that..."
 */
export function detectDefinitionFormat(html: string): {
  found: boolean;
  definitions: Array<{ term: string; definition: string }>;
} {
  const $ = cheerio.load(html);
  const definitions: Array<{ term: string; definition: string }> = [];

  // Check for <dfn> tags
  $('dfn').each((_, el) => {
    const term = $(el).text().trim();
    const parent = $(el).parent().text().trim();
    if (term && parent) {
      definitions.push({ term, definition: parent });
    }
  });

  // Check for "X is a/an" patterns in paragraphs following H2/H3
  $('h2, h3').each((_, el) => {
    const heading = $(el).text().trim();
    const nextP = $(el).next('p').text().trim();

    // Pattern: starts with a noun phrase and "is a/an"
    const definitionPattern = /^([\w\s]+)\s+is\s+(?:a|an|the)\s+[\w\s]+(?:that|which|who)/i;
    const match = nextP.match(definitionPattern);

    if (match) {
      definitions.push({ term: match[1].trim(), definition: nextP.substring(0, 200) });
    }
  });

  return { found: definitions.length > 0, definitions };
}

/**
 * Detect list-format content (optimal for "how to" and "best X" snippets)
 */
export function detectListFormat(html: string): {
  found: boolean;
  lists: Array<{ type: 'ol' | 'ul'; itemCount: number; context: string }>;
} {
  const $ = cheerio.load(html);
  const lists: Array<{ type: 'ol' | 'ul'; itemCount: number; context: string }> = [];

  // Find ordered lists after headings
  $('h2, h3').each((_, el) => {
    const heading = $(el).text().trim();
    const nextEl = $(el).next();

    if (nextEl.is('ol')) {
      const items = nextEl.find('li').length;
      if (items >= 3 && items <= 10) {
        lists.push({ type: 'ol', itemCount: items, context: heading });
      }
    } else if (nextEl.is('ul')) {
      const items = nextEl.find('li').length;
      if (items >= 3 && items <= 10) {
        lists.push({ type: 'ul', itemCount: items, context: heading });
      }
    }
  });

  return { found: lists.length > 0, lists };
}

/**
 * Detect table-format content (optimal for comparison snippets)
 */
export function detectTableFormat(html: string): {
  found: boolean;
  tables: Array<{ hasHeaders: boolean; rows: number; cols: number }>;
} {
  const $ = cheerio.load(html);
  const tables: Array<{ hasHeaders: boolean; rows: number; cols: number }> = [];

  $('table').each((_, el) => {
    const $table = $(el);
    const hasHeaders = $table.find('th').length > 0 || $table.find('thead').length > 0;
    const rows = $table.find('tr').length;
    const cols = $table.find('tr').first().find('td, th').length;

    // Good snippet tables have 3-5 columns and 4-10 rows
    if (cols >= 2 && cols <= 6 && rows >= 3 && rows <= 15) {
      tables.push({ hasHeaders, rows, cols });
    }
  });

  return { found: tables.length > 0, tables };
}

/**
 * Detect Q&A format content (optimal for PAA boxes and FAQ snippets)
 */
export function detectQAFormat(html: string): {
  found: boolean;
  qaCount: number;
  questions: string[];
} {
  const $ = cheerio.load(html);
  const questions: string[] = [];

  // Question patterns in headings
  const questionPatterns = [
    /^what\s+/i,
    /^how\s+/i,
    /^why\s+/i,
    /^when\s+/i,
    /^where\s+/i,
    /^who\s+/i,
    /^which\s+/i,
    /^can\s+/i,
    /^does\s+/i,
    /^is\s+/i,
    /^are\s+/i,
    /^should\s+/i,
    /\?$/,
  ];

  // Check H2-H4 headings for questions
  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    for (const pattern of questionPatterns) {
      if (pattern.test(text)) {
        questions.push(text);
        break;
      }
    }
  });

  // Check for FAQ sections
  const hasFaqSection =
    $('section.faq, div.faq, #faq, .faqs, [data-faq]').length > 0 ||
    $('h2, h3').text().toLowerCase().includes('faq') ||
    $('h2, h3').text().toLowerCase().includes('frequently asked');

  // Check for details/summary elements (accordion FAQs)
  $('details summary').each((_, el) => {
    const text = $(el).text().trim();
    if (text.endsWith('?') || questionPatterns.some((p) => p.test(text))) {
      questions.push(text);
    }
  });

  return { found: questions.length > 0 || hasFaqSection, qaCount: questions.length, questions };
}

/**
 * Check for inverted pyramid structure (key info first)
 */
export function detectInvertedPyramid(html: string): { found: boolean; score: number } {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, header, footer, aside').remove();

  // Get first paragraph after H1
  const h1 = $('h1').first();
  const firstContent = h1.nextAll('p').first().text().trim();

  if (!firstContent) {
    return { found: false, score: 0 };
  }

  // Check for answer patterns in first paragraph
  const answerPatterns = [
    /^the\s+answer\s+is/i,
    /^yes[,\s]/i,
    /^no[,\s]/i,
    /^in\s+short/i,
    /^to\s+summarize/i,
    /^([\w\s]+)\s+is\s+/i, // Definition pattern
    /^\d+/i, // Starts with number
    /^the\s+best\s+/i,
    /^you\s+(can|should|need)/i,
  ];

  let score = 0;

  // Check if first paragraph contains direct answer
  for (const pattern of answerPatterns) {
    if (pattern.test(firstContent)) {
      score += 30;
      break;
    }
  }

  // Check word count of first paragraph (should be concise: 40-80 words)
  const wordCount = firstContent.split(/\s+/).length;
  if (wordCount >= 40 && wordCount <= 100) {
    score += 30;
  } else if (wordCount > 0 && wordCount < 40) {
    score += 15;
  }

  // Check if key terms from title appear in first paragraph
  const title = $('title').text().toLowerCase();
  const titleWords = title
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const firstParaLower = firstContent.toLowerCase();
  const matchingWords = titleWords.filter((w) => firstParaLower.includes(w));
  const titleMatchRatio = titleWords.length > 0 ? matchingWords.length / titleWords.length : 0;

  if (titleMatchRatio > 0.5) {
    score += 40;
  } else if (titleMatchRatio > 0.25) {
    score += 20;
  }

  return { found: score >= 50, score: Math.min(score, 100) };
}

/**
 * Check for structured data that supports snippets
 */
export function detectSnippetSchema(html: string): {
  hasFaqSchema: boolean;
  hasHowToSchema: boolean;
  hasQASchema: boolean;
} {
  const $ = cheerio.load(html);

  let hasFaqSchema = false;
  let hasHowToSchema = false;
  let hasQASchema = false;

  // Check JSON-LD scripts
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      const types = Array.isArray(data) ? data.map((d) => d['@type']) : [data['@type']];

      if (types.includes('FAQPage') || types.some((t) => t?.includes?.('FAQPage'))) {
        hasFaqSchema = true;
      }
      if (types.includes('HowTo') || types.some((t) => t?.includes?.('HowTo'))) {
        hasHowToSchema = true;
      }
      if (types.includes('QAPage') || types.some((t) => t?.includes?.('QAPage'))) {
        hasQASchema = true;
      }
    } catch {
      // Invalid JSON
    }
  });

  return { hasFaqSchema, hasHowToSchema, hasQASchema };
}

/**
 * Analyze snippet bait headers (trigger words for featured snippets)
 */
export function analyzeSnippetBaitHeaders(html: string): string[] {
  const $ = cheerio.load(html);
  const snippetBaitHeaders: string[] = [];

  // High-value snippet trigger patterns
  const triggerPatterns = [
    /^what\s+is\s+/i,
    /^how\s+to\s+/i,
    /^how\s+do\s+/i,
    /^how\s+does\s+/i,
    /^why\s+is\s+/i,
    /^why\s+do\s+/i,
    /^why\s+does\s+/i,
    /^when\s+to\s+/i,
    /^where\s+to\s+/i,
    /^\d+\s+(ways|tips|steps|reasons|benefits|examples)/i,
    /^(best|top)\s+\d+/i,
    /^(guide|tutorial):/i,
    /\s+vs\s+/i,
    /^definition\s+of/i,
  ];

  $('h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    for (const pattern of triggerPatterns) {
      if (pattern.test(text)) {
        snippetBaitHeaders.push(text);
        break;
      }
    }
  });

  return snippetBaitHeaders;
}

/**
 * Main function: Analyze page for featured snippet optimization
 */
export function analyzeFeaturedSnippet(
  html: string,
  url: string
): { issues: AuditIssue[]; data: FeaturedSnippetData } {
  const issues: AuditIssue[] = [];

  const definitions = detectDefinitionFormat(html);
  const lists = detectListFormat(html);
  const tables = detectTableFormat(html);
  const qa = detectQAFormat(html);
  const invertedPyramid = detectInvertedPyramid(html);
  const schema = detectSnippetSchema(html);
  const snippetBaitHeaders = analyzeSnippetBaitHeaders(html);

  const opportunities: SnippetOpportunity[] = [];

  // Analyze definition opportunities
  if (!definitions.found) {
    opportunities.push({
      type: 'definition',
      heading: 'Missing definition format',
      score: 0,
      issues: ['No clear definition patterns found'],
      suggestions: [
        'Add a paragraph starting with "[Topic] is a [noun] that..." after your main heading',
        'Use <dfn> tags for key term definitions',
        'Keep definitions concise (40-60 words)',
      ],
    });
  }

  // Analyze list opportunities
  if (lists.found) {
    for (const list of lists.lists) {
      if (!list.context.toLowerCase().match(/^\d+|^(how|steps|tips|ways)/)) {
        opportunities.push({
          type: 'list',
          heading: list.context,
          score: 70,
          issues: ['List heading could be more snippet-friendly'],
          suggestions: [
            'Consider rephrasing to "X Steps to..." or "Top X Tips for..."',
            'Ensure list items are parallel in structure',
          ],
        });
      }
    }
  } else {
    opportunities.push({
      type: 'list',
      heading: 'Missing list content',
      score: 0,
      issues: ['No optimized lists found for snippet targeting'],
      suggestions: [
        'Add numbered or bulleted lists with 4-8 items',
        'Use headers like "Steps to...", "Ways to...", or "Top X..."',
        'Keep list items concise and parallel in structure',
      ],
    });
  }

  // Analyze table opportunities
  if (!tables.found) {
    opportunities.push({
      type: 'table',
      heading: 'No comparison tables',
      score: 0,
      issues: ['No tables optimized for comparison snippets'],
      suggestions: [
        'Add comparison tables with clear headers',
        'Use 3-5 columns and 4-10 rows for optimal snippet display',
        'Include thead with th elements for proper table structure',
      ],
    });
  }

  // Analyze Q&A opportunities
  if (qa.found && qa.qaCount > 0) {
    if (!schema.hasFaqSchema && qa.qaCount >= 3) {
      issues.push({
        code: 'FAQ_SCHEMA_MISSING',
        severity: 'warning',
        category: 'structured-data',
        title: 'FAQ content without FAQPage schema',
        description: `Found ${qa.qaCount} question-format headings but no FAQPage schema markup.`,
        impact: 'Missing out on FAQ rich results and PAA box opportunities.',
        howToFix: 'Add FAQPage structured data for your Q&A content.',
        affectedUrls: [url],
        details: { questions: qa.questions.slice(0, 5) },
      });
    }
  } else {
    opportunities.push({
      type: 'qa',
      heading: 'Missing Q&A content',
      score: 0,
      issues: ['No question-format headers found'],
      suggestions: [
        'Add H2/H3 headings in question format (What is..., How to..., Why does...)',
        'Follow each question heading with a direct answer paragraph',
        'Consider adding a FAQ section with 3-5 common questions',
      ],
    });
  }

  // Analyze inverted pyramid
  if (!invertedPyramid.found) {
    issues.push({
      code: 'INVERTED_PYRAMID_MISSING',
      severity: 'notice',
      category: 'content',
      title: 'Content not structured for featured snippets',
      description: 'First paragraph does not contain a direct answer or summary.',
      impact: 'Featured snippets pull from early content; burying answers reduces snippet capture rate.',
      howToFix: 'Start with a concise answer (40-80 words) that directly addresses the page topic.',
      affectedUrls: [url],
      details: { invertedPyramidScore: invertedPyramid.score },
    });
  }

  // Check for snippet bait headers
  if (snippetBaitHeaders.length === 0) {
    issues.push({
      code: 'NO_SNIPPET_BAIT_HEADERS',
      severity: 'notice',
      category: 'on-page',
      title: 'No snippet-targeting headers found',
      description: 'Headings do not use patterns that commonly trigger featured snippets.',
      impact: 'Missing opportunities for high-visibility snippet placements.',
      howToFix:
        'Use headers like "What is [topic]?", "How to [action]", or "X Ways to [achieve goal]".',
      affectedUrls: [url],
      details: { suggestedPatterns: ['What is X?', 'How to X', 'X Steps to Y', 'Best X for Y'] },
    });
  }

  return {
    issues,
    data: {
      hasDefinitionFormat: definitions.found,
      hasListFormat: lists.found,
      hasTableFormat: tables.found,
      hasQAFormat: qa.found,
      hasInvertedPyramid: invertedPyramid.found,
      opportunities,
      faqSchemaPresent: schema.hasFaqSchema,
      howToSchemaPresent: schema.hasHowToSchema,
      questionHeadingsCount: qa.qaCount,
    },
  };
}
