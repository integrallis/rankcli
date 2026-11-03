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

  // No tables for comparisons. Word-bounded: "vs" as a substring matched canvas, cvs and svs,
  // and the old operator precedence fired this on any page containing them, table or no table.
  const comparesThings = /\b(compar(e|es|ed|ing|ison|isons)|versus|vs\.?)\b/.test(bodyText);
  if (!hasComparisonTable && comparesThings) {
    issues.push({
      code: 'AI_NO_COMPARISON_TABLE',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Comparison content without a table',
      description: 'The page compares things in prose. In a 193,507-answer study of AI assistants, pages with tables had 69 percent higher odds of being cited; a table is also the unit an assistant can quote whole.',
      impact: 'A comparison in prose gets paraphrased or skipped; one in a table gets quoted.',
      howToFix: 'Put the comparison in an HTML table with header cells: one row per option, one column per criterion.',
      affectedUrls: [url],
    });
  }

  // No numbered lists for procedural content
  if (!hasStepByStep && /\b(steps?|how to|guide|tutorial|walkthrough)\b/.test(bodyText)) {
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

  // Low quotability
  if (structureScore < 50) {
    issues.push({
      code: 'AI_LOW_STRUCTURE_SCORE',
      // A heuristic score, not a defect a crawler can see: never a failed build.
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Content structure not optimized for AI parsing',
      description: `AI structure score: ${structureScore}/100. Content lacks structured elements that AI can easily parse and quote.`,
      impact: 'Lower likelihood of being cited in AI-generated answers due to poor content structure.',
      howToFix: 'Give the assistant something to quote whole: a table for data or comparisons, a numbered list for steps, and a short paragraph that answers each question heading.',
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
