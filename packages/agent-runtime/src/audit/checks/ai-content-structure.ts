/**
 * AI Content Structure Checks
 *
 * AI systems prefer well-structured content that's easy to parse and quote.
 * These checks verify content is formatted optimally for AI consumption:
 * - Tables for comparisons/data
 * - Numbered lists for steps/procedures
 * - Bullet points for features/benefits
 * - Clear Q&A format for direct answers
 * - Concise, quotable statements
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface AIContentStructureData {
  tables: {
    count: number;
    hasComparisonTable: boolean;
    hasDataTable: boolean;
  };
  lists: {
    orderedLists: number;
    unorderedLists: number;
    hasStepByStep: boolean;
    hasBulletedFeatures: boolean;
  };
  qaFormat: {
    hasExplicitQA: boolean;
    questionCount: number;
    hasDirectAnswers: boolean;
  };
  quotability: {
    hasDefinitions: boolean;
    hasConciseStatements: boolean;
    shortParagraphRatio: number;
  };
  structureScore: number;
}

export function analyzeAIContentStructure(
  html: string,
  url: string
): { issues: AuditIssue[]; data: AIContentStructureData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Remove nav, footer, aside, scripts, styles for content analysis
  $('nav, footer, aside, script, style, noscript, header').remove();

  // Analyze tables
  const tables = $('table');
  const tableCount = tables.length;
  let hasComparisonTable = false;
  let hasDataTable = false;

  tables.each((_, table) => {
    const $table = $(table);
    const headers = $table.find('th').length;
    const rows = $table.find('tr').length;
    const cells = $table.find('td').length;

    // Comparison table: multiple columns with headers
    if (headers >= 2 && rows >= 3) {
      hasComparisonTable = true;
    }

    // Data table: has numeric data
    const cellTexts = $table.find('td').map((_, td) => $(td).text()).get();
    const hasNumbers = cellTexts.some(text => /\d+/.test(text));
    if (hasNumbers && cells >= 4) {
      hasDataTable = true;
    }
  });

  // Analyze lists
  const orderedLists = $('ol').length;
  const unorderedLists = $('ul').not('nav ul').length;

  // Check for step-by-step content
  let hasStepByStep = false;
  $('ol').each((_, ol) => {
    const items = $(ol).find('> li').length;
    if (items >= 3) {
      hasStepByStep = true;
    }
  });

  // Check for bulleted features/benefits
  let hasBulletedFeatures = false;
  $('ul').not('nav ul').each((_, ul) => {
    const items = $(ul).find('> li').length;
    if (items >= 3) {
      hasBulletedFeatures = true;
    }
  });

  // Analyze Q&A format
  const bodyText = $('body').text().toLowerCase();
  const headings = $('h1, h2, h3, h4, h5, h6');
  let questionCount = 0;
  let hasDirectAnswers = false;

  headings.each((_, heading) => {
    const text = $(heading).text();
    // Check if heading is a question
    if (text.includes('?') || /^(what|how|why|when|where|who|which|can|does|is|are|should|will)\s/i.test(text)) {
      questionCount++;

      // Check if followed by a direct answer (short paragraph)
      const nextP = $(heading).next('p');
      if (nextP.length) {
        const answerText = nextP.text();
        if (answerText.length > 20 && answerText.length < 300) {
          hasDirectAnswers = true;
        }
      }
    }
  });

  // Check for explicit Q&A format (FAQ style)
  const hasExplicitQA =
    $('[itemtype*="FAQPage"]').length > 0 ||
    $('[itemtype*="Question"]').length > 0 ||
    $('.faq, #faq, [class*="faq"], [id*="faq"]').length > 0 ||
    $('details summary').length >= 2 ||
    $('dt').length >= 2; // Definition lists often used for Q&A

  // Analyze quotability
  const paragraphs = $('p');
  let shortParagraphCount = 0;
  let totalParagraphs = 0;
  let hasDefinitions = false;
  let hasConciseStatements = false;

  paragraphs.each((_, p) => {
    const text = $(p).text().trim();
    if (text.length < 20) return; // Skip very short paragraphs

    totalParagraphs++;

    // Short paragraphs (under 150 chars) are more quotable
    if (text.length < 150) {
      shortParagraphCount++;
    }

    // Check for definition patterns ("X is a...", "X refers to...")
    if (/^[A-Z][^.]+\s+(is|are|refers to|means|describes)\s+/i.test(text)) {
      hasDefinitions = true;
    }

    // Concise statements with clear structure
    if (text.length < 200 && (
      text.includes(':') ||
      /^(The|A|An)\s+\w+/.test(text) ||
      /^\d+\.?\s+/.test(text)
    )) {
      hasConciseStatements = true;
    }
  });

  const shortParagraphRatio = totalParagraphs > 0
    ? shortParagraphCount / totalParagraphs
    : 0;

  // Calculate structure score (0-100)
  let structureScore = 50; // Base score

  // Tables bonus
  if (hasComparisonTable) structureScore += 10;
  if (hasDataTable) structureScore += 5;

  // Lists bonus
  if (hasStepByStep) structureScore += 10;
  if (hasBulletedFeatures) structureScore += 5;

  // Q&A bonus
  if (hasExplicitQA) structureScore += 10;
  if (questionCount >= 3) structureScore += 5;
  if (hasDirectAnswers) structureScore += 5;

  // Quotability bonus
  if (hasDefinitions) structureScore += 5;
  if (hasConciseStatements) structureScore += 5;
  if (shortParagraphRatio > 0.3) structureScore += 5;

  // Penalties
  if (tableCount === 0 && orderedLists === 0 && unorderedLists === 0) {
    structureScore -= 15; // No structured content at all
  }
  if (questionCount === 0) {
    structureScore -= 5; // No question-based headings
  }

  structureScore = Math.max(0, Math.min(100, structureScore));

  // Generate issues

  // No tables for comparisons
  if (!hasComparisonTable && bodyText.includes('compar') || bodyText.includes('vs') || bodyText.includes('versus')) {
    issues.push({
      code: 'AI_NO_COMPARISON_TABLE',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Comparison content without table format',
      description: 'Your content mentions comparisons but doesn\'t use a table format. AI systems can easily parse and quote table data.',
      impact: 'AI may not accurately extract comparison data, reducing chances of being cited in AI-generated comparisons.',
      howToFix: 'Convert comparison content to HTML tables with clear headers. Example: Feature | Option A | Option B',
      affectedUrls: [url],
    });
  }

  // No numbered lists for procedural content
  if (!hasStepByStep && (bodyText.includes('step') || bodyText.includes('how to') || bodyText.includes('guide'))) {
    issues.push({
      code: 'AI_NO_NUMBERED_STEPS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Procedural content without numbered steps',
      description: 'Your content appears to be a guide or how-to but doesn\'t use numbered lists. AI prefers numbered lists for step-by-step content.',
      impact: 'AI may not accurately quote your steps in order, or may skip your content for better-structured alternatives.',
      howToFix: 'Convert step-by-step instructions to <ol> (ordered list) format with clear, actionable items.',
      affectedUrls: [url],
    });
  }

  // No Q&A format
  if (!hasExplicitQA && questionCount === 0) {
    issues.push({
      code: 'AI_NO_QA_FORMAT',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No question-and-answer format detected',
      description: 'Content lacks explicit Q&A structure. AI systems often look for clear question-answer pairs to provide direct responses.',
      impact: 'Lower chance of being featured in AI direct answers or FAQ-style responses.',
      howToFix: 'Add FAQ section with common questions as headings (H2/H3) followed by concise answers. Implement FAQ schema markup.',
      affectedUrls: [url],
      details: {
        suggestions: [
          'Use question words in headings (What, How, Why, etc.)',
          'Follow questions with short, direct answer paragraphs',
          'Add FAQ schema markup for structured data',
          'Consider using <details>/<summary> for expandable Q&A',
        ],
      },
    });
  }

  // Questions without direct answers
  if (questionCount >= 2 && !hasDirectAnswers) {
    issues.push({
      code: 'AI_QUESTIONS_NO_DIRECT_ANSWERS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Questions in headings lack direct answers',
      description: `Found ${questionCount} question-style headings but answers are too long or not immediately following. AI prefers concise answers right after questions.`,
      impact: 'AI may struggle to extract clear answers, reducing citation likelihood.',
      howToFix: 'Start each answer section with a 1-2 sentence direct answer, then expand with details. First sentence should standalone as a complete answer.',
      affectedUrls: [url],
    });
  }

  // No definitions
  if (!hasDefinitions && (bodyText.includes('what is') || bodyText.includes('definition'))) {
    issues.push({
      code: 'AI_NO_DEFINITIONS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Missing clear definitions',
      description: 'Content discusses concepts but lacks Wikipedia-style definitions. AI loves clear "X is a..." statements.',
      impact: 'Less likely to be cited for definitional queries in AI search.',
      howToFix: 'Add clear definitions early in content: "[Term] is a [category] that [distinguishing features]." Make first paragraph a complete definition.',
      affectedUrls: [url],
    });
  }

  // Low quotability
  if (structureScore < 50) {
    issues.push({
      code: 'AI_LOW_STRUCTURE_SCORE',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Content structure not optimized for AI parsing',
      description: `AI structure score: ${structureScore}/100. Content lacks structured elements that AI can easily parse and quote.`,
      impact: 'Lower likelihood of being cited in AI-generated answers due to poor content structure.',
      howToFix: 'Improve content structure: add tables for data, numbered lists for steps, bullet points for features, Q&A sections for common questions.',
      affectedUrls: [url],
      details: {
        structureScore,
        hasTable: tableCount > 0,
        hasOrderedList: orderedLists > 0,
        hasUnorderedList: unorderedLists > 0,
        hasQAFormat: hasExplicitQA || questionCount > 0,
      },
    });
  }

  return {
    issues,
    data: {
      tables: {
        count: tableCount,
        hasComparisonTable,
        hasDataTable,
      },
      lists: {
        orderedLists,
        unorderedLists,
        hasStepByStep,
        hasBulletedFeatures,
      },
      qaFormat: {
        hasExplicitQA,
        questionCount,
        hasDirectAnswers,
      },
      quotability: {
        hasDefinitions,
        hasConciseStatements,
        shortParagraphRatio,
      },
      structureScore,
    },
  };
}
