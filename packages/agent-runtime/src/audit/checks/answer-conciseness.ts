/**
 * Answer Conciseness Checks
 *
 * AI systems prefer succinct, quotable answers. Content that provides
 * clear, direct answers to questions is more likely to be cited.
 * This check analyzes answer quality and quotability.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface AnswerConcisenessData {
  headings: {
    total: number;
    questions: number;
    withDirectAnswers: number;
  };
  answers: {
    averageFirstSentenceLength: number;
    shortAnswersCount: number;
    longAnswersCount: number;
    quotableAnswers: string[];
  };
  definitions: {
    count: number;
    examples: string[];
  };
  keyTakeaways: {
    hasSummary: boolean;
    hasTLDR: boolean;
    hasKeyPoints: boolean;
  };
  concisenessScore: number;
}

// Ideal answer lengths for AI
const IDEAL_ANSWER_LENGTH = { min: 40, max: 150 }; // Characters
const MAX_FIRST_SENTENCE = 200; // Characters

export function analyzeAnswerConciseness(
  html: string,
  url: string
): { issues: AuditIssue[]; data: AnswerConcisenessData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('nav, footer, aside, script, style, noscript, header').remove();

  const headings = $('h1, h2, h3, h4, h5, h6');
  let totalHeadings = 0;
  let questionHeadings = 0;
  let headingsWithDirectAnswers = 0;

  const firstSentenceLengths: number[] = [];
  let shortAnswersCount = 0;
  let longAnswersCount = 0;
  const quotableAnswers: string[] = [];

  // Question patterns
  const questionPatterns = [
    /\?$/,
    /^(what|how|why|when|where|who|which|can|does|is|are|should|will|would|could)\s/i,
  ];

  headings.each((_, heading) => {
    const $heading = $(heading);
    const headingText = $heading.text().trim();
    totalHeadings++;

    // Check if heading is a question
    const isQuestion = questionPatterns.some(p => p.test(headingText));

    if (isQuestion) {
      questionHeadings++;

      // Get the content after this heading until the next heading
      let $next = $heading.next();
      let answerText = '';

      while ($next.length && !$next.is('h1, h2, h3, h4, h5, h6')) {
        if ($next.is('p')) {
          answerText += $next.text().trim() + ' ';
        }
        $next = $next.next();
      }

      if (answerText) {
        // Get first sentence
        const firstSentenceMatch = answerText.match(/^[^.!?]+[.!?]/);
        const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : '';

        if (firstSentence) {
          firstSentenceLengths.push(firstSentence.length);

          // Check if it's a direct answer (short, complete, starts definitively)
          const isDirectAnswer =
            firstSentence.length <= MAX_FIRST_SENTENCE &&
            !firstSentence.toLowerCase().startsWith('well,') &&
            !firstSentence.toLowerCase().startsWith('so,') &&
            !firstSentence.toLowerCase().startsWith('basically,') &&
            (
              /^(yes|no|the|a|an|it|they|this|there|you|we)/i.test(firstSentence) ||
              /^[A-Z][a-z]+\s+(is|are|was|were|can|should|will)/i.test(firstSentence)
            );

          if (isDirectAnswer) {
            headingsWithDirectAnswers++;

            // Check if quotable (ideal length)
            if (firstSentence.length >= IDEAL_ANSWER_LENGTH.min &&
                firstSentence.length <= IDEAL_ANSWER_LENGTH.max) {
              shortAnswersCount++;
              quotableAnswers.push(firstSentence);
            } else if (firstSentence.length > IDEAL_ANSWER_LENGTH.max) {
              longAnswersCount++;
            }
          }
        }
      }
    }
  });

  // Detect definitions
  const definitions: string[] = [];
  $('p').each((_, p) => {
    const text = $(p).text().trim();

    // Definition patterns: "X is a...", "X refers to...", "X means..."
    const defMatch = text.match(/^([A-Z][^.]{0,50})\s+(is|are|refers to|means|describes|represents)\s+([^.]+\.)/);
    if (defMatch) {
      definitions.push(defMatch[0]);
    }
  });

  // Check for summary elements
  const bodyText = $('body').text().toLowerCase();
  const headingText = headings.map((_, h) => $(h).text().toLowerCase()).get().join(' ');

  const hasSummary =
    headingText.includes('summary') ||
    headingText.includes('conclusion') ||
    headingText.includes('key takeaways') ||
    $('[class*="summary"], [id*="summary"]').length > 0;

  const hasTLDR =
    bodyText.includes('tl;dr') ||
    bodyText.includes('tldr') ||
    bodyText.includes('in short') ||
    bodyText.includes('in summary') ||
    headingText.includes('tl;dr');

  const hasKeyPoints =
    headingText.includes('key points') ||
    headingText.includes('main points') ||
    headingText.includes('highlights') ||
    $('[class*="key-points"], [class*="highlights"]').length > 0;

  // Calculate average first sentence length
  const averageFirstSentenceLength = firstSentenceLengths.length > 0
    ? firstSentenceLengths.reduce((a, b) => a + b, 0) / firstSentenceLengths.length
    : 0;

  // Calculate conciseness score
  let concisenessScore = 50;

  // Question/answer quality
  if (questionHeadings > 0) {
    const answerRatio = headingsWithDirectAnswers / questionHeadings;
    concisenessScore += answerRatio * 20;
  }

  // Quotable answers bonus
  if (shortAnswersCount >= 3) concisenessScore += 15;
  else if (shortAnswersCount >= 1) concisenessScore += 10;

  // Long answers penalty
  if (longAnswersCount > shortAnswersCount) concisenessScore -= 10;

  // Definitions bonus
  if (definitions.length >= 2) concisenessScore += 10;
  else if (definitions.length === 1) concisenessScore += 5;

  // Summary elements bonus
  if (hasSummary) concisenessScore += 5;
  if (hasTLDR) concisenessScore += 5;
  if (hasKeyPoints) concisenessScore += 5;

  // Average sentence length
  if (averageFirstSentenceLength > 0 && averageFirstSentenceLength <= 150) {
    concisenessScore += 5;
  } else if (averageFirstSentenceLength > 200) {
    concisenessScore -= 10;
  }

  concisenessScore = Math.max(0, Math.min(100, concisenessScore));

  // Generate issues

  // Questions without direct answers
  if (questionHeadings > 0 && headingsWithDirectAnswers < questionHeadings * 0.5) {
    issues.push({
      code: 'AI_INDIRECT_ANSWERS',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Questions lack direct, quotable answers',
      description: `${questionHeadings} question headings found but only ${headingsWithDirectAnswers} have direct answers. AI prefers content that answers questions immediately.`,
      impact: 'AI may skip your content for sources with clearer, more direct answers.',
      howToFix: 'Start answer paragraphs with a direct 1-2 sentence answer. Avoid filler words like "Well," "So," "Basically." Lead with the answer, then explain.',
      affectedUrls: [url],
      details: {
        questionHeadings,
        directAnswers: headingsWithDirectAnswers,
        examples: quotableAnswers.slice(0, 3),
      },
    });
  }

  // Answers too long
  if (longAnswersCount > 0 && longAnswersCount > shortAnswersCount) {
    issues.push({
      code: 'AI_VERBOSE_ANSWERS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Answer opening sentences are too long',
      description: `Found ${longAnswersCount} answers with opening sentences over 150 characters. AI quotes shorter, punchier statements.`,
      impact: 'Long opening sentences are less likely to be quoted verbatim by AI.',
      howToFix: 'Keep first sentences under 150 characters. Move details to subsequent sentences. Think "tweet-length" for opening answers.',
      affectedUrls: [url],
      details: {
        averageLength: Math.round(averageFirstSentenceLength),
        idealLength: `${IDEAL_ANSWER_LENGTH.min}-${IDEAL_ANSWER_LENGTH.max} characters`,
      },
    });
  }

  // No definitions for definitional content
  const hasDefinitionalQueries =
    bodyText.includes('what is') ||
    bodyText.includes('what are') ||
    bodyText.includes('definition') ||
    bodyText.includes('meaning of');

  if (hasDefinitionalQueries && definitions.length === 0) {
    issues.push({
      code: 'AI_NO_CLEAR_DEFINITIONS',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Definitional content lacks clear definitions',
      description: 'Content discusses "what is" topics but lacks Wikipedia-style definitions. AI heavily favors clear "[Term] is a [definition]" patterns.',
      impact: 'Missing out on definitional search citations and AI answer boxes.',
      howToFix: 'Add clear definitions: "[Term] is a [category] that [key characteristics]." Place definitions early in content or in dedicated sections.',
      affectedUrls: [url],
      details: {
        suggestion: 'Example: "SEO is the practice of optimizing websites to rank higher in search engine results."',
      },
    });
  }

  // No summary or TLDR
  const wordCount = $('body').text().split(/\s+/).length;
  if (wordCount > 1500 && !hasSummary && !hasTLDR && !hasKeyPoints) {
    issues.push({
      code: 'AI_NO_SUMMARY',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Long content lacks summary or key takeaways',
      description: 'Content is over 1500 words but has no summary, TL;DR, or key points section. AI often pulls from summary sections.',
      impact: 'Harder for AI to extract key points; may cite competitors with better-structured summaries.',
      howToFix: 'Add a "Key Takeaways" section at the top or a "Summary" at the bottom. Use bullet points for scannable key points.',
      affectedUrls: [url],
    });
  }

  // Low conciseness score
  if (concisenessScore < 50) {
    issues.push({
      code: 'AI_LOW_CONCISENESS',
      severity: 'warning',
      category: 'ai-readiness',
      title: 'Content lacks concise, quotable answers',
      description: `Conciseness score: ${concisenessScore}/100. AI prefers content with clear, succinct answers it can quote directly.`,
      impact: 'Reduced likelihood of AI citing your content in direct answers.',
      howToFix: 'Restructure content: lead with direct answers, add definitions, include TL;DR sections, keep opening sentences short.',
      affectedUrls: [url],
      details: {
        concisenessScore,
        quotableAnswers: quotableAnswers.length,
        definitions: definitions.length,
        hasSummary,
        hasTLDR,
      },
    });
  }

  return {
    issues,
    data: {
      headings: {
        total: totalHeadings,
        questions: questionHeadings,
        withDirectAnswers: headingsWithDirectAnswers,
      },
      answers: {
        averageFirstSentenceLength: Math.round(averageFirstSentenceLength),
        shortAnswersCount,
        longAnswersCount,
        quotableAnswers: quotableAnswers.slice(0, 5),
      },
      definitions: {
        count: definitions.length,
        examples: definitions.slice(0, 3),
      },
      keyTakeaways: {
        hasSummary,
        hasTLDR,
        hasKeyPoints,
      },
      concisenessScore,
    },
  };
}
