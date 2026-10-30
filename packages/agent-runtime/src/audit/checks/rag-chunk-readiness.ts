/**
 * RAG Chunk Readiness
 *
 * How AI answer engines actually retrieve content: RAG (Retrieval-Augmented
 * Generation) systems chunk a page into pieces — the 2026 convergence
 * benchmark is roughly 400-512 tokens per chunk, 10-25% overlap — then
 * retrieve whichever chunk(s) best match a query, not the whole page. A page
 * whose own heading-delimited sections are naturally chunk-sized, with clear
 * headings and paragraphs that don't lean on the previous section's context
 * to make sense, is less likely to get split mid-thought by a RAG chunker —
 * preserving the semantic boundaries the author actually wrote, which is
 * what the RAG-chunking literature credits with better retrieval recall.
 *
 * This is a genuinely different angle from ai-content-structure.ts (tables/
 * lists/Q&A formatting): that's about FORMAT, this is about SECTION SIZE
 * and SELF-CONTAINMENT. Novel enough that no dedicated site-auditing tool
 * for it was found as of this writing — RAG-chunking guidance that exists
 * targets people building RAG systems, not people writing web content.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface ChunkSection {
  heading: string;
  headingLevel: number;
  wordCount: number;
  estimatedTokens: number;
  sizeQuality: 'too-short' | 'good' | 'too-long';
  startsWithDanglingReference: boolean;
}

export interface RAGChunkReadinessData {
  sections: ChunkSection[];
  totalSections: number;
  wellSizedSectionCount: number;
  danglingReferenceCount: number;
  chunkReadinessScore: number; // 0-100
}

// 400-512 tokens is the 2026 RAG-chunking convergence benchmark. English
// prose runs roughly 1.3 words per token (~0.75 tokens/word), so that's
// roughly 300-385 words — widened to 150-450 here since this measures how
// naturally an AUTHOR sectioned their content, not what a chunker itself
// targets; a section in this band is unlikely to need mid-thought splitting
// either way, which is the property that actually matters.
const MIN_GOOD_WORDS = 150;
const MAX_GOOD_WORDS = 450;
const TOKENS_PER_WORD = 1.33;

// A section opening on a bare pronoun/demonstrative reference ("This
// approach...", "It also...") reads fine in place but loses its antecedent
// the moment a RAG system retrieves it standalone — a real self-containment
// signal, not a grammar nitpick.
const DANGLING_OPENERS = /^(this|it|these|that|they|such|those|the former|the latter)\b/i;

function classifySize(wordCount: number): ChunkSection['sizeQuality'] {
  if (wordCount < MIN_GOOD_WORDS) return 'too-short';
  if (wordCount > MAX_GOOD_WORDS) return 'too-long';
  return 'good';
}

/**
 * Splits content into heading-delimited sections by walking all
 * heading/content elements in DOCUMENT ORDER (a single multi-tag cheerio
 * selector), rather than via sibling traversal — sibling-only walks break
 * on the wrapper-div-heavy DOM nesting common in modern frameworks, where
 * a heading and "its" paragraphs aren't actually direct siblings. Document
 * order is robust to arbitrary nesting depth.
 */
function extractSections($: cheerio.CheerioAPI): Array<{ heading: string; headingLevel: number; text: string }> {
  const elements = $('h1, h2, h3, p, li, blockquote').toArray();
  const sections: Array<{ heading: string; headingLevel: number; text: string }> = [];
  let current: { heading: string; headingLevel: number; text: string } | null = null;

  for (const el of elements) {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      if (current) sections.push(current);
      current = { heading: $(el).text().trim(), headingLevel: parseInt(tag.slice(1), 10), text: '' };
    } else if (current) {
      current.text += ' ' + $(el).text();
    }
    // Content before the first heading has no section to attribute it to —
    // intentionally skipped rather than inventing a synthetic "intro" chunk.
  }
  if (current) sections.push(current);
  return sections;
}

export function analyzeRAGChunkReadiness(
  html: string,
  url: string
): { issues: AuditIssue[]; data: RAGChunkReadinessData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  $('nav, footer, aside, script, style, noscript, header').remove();

  const rawSections = extractSections($);

  const sections: ChunkSection[] = rawSections.map((s) => {
    const words = s.text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const estimatedTokens = Math.round(wordCount * TOKENS_PER_WORD);
    const firstSentence = s.text.trim().split(/[.!?]/)[0] || '';
    return {
      heading: s.heading,
      headingLevel: s.headingLevel,
      wordCount,
      estimatedTokens,
      sizeQuality: classifySize(wordCount),
      startsWithDanglingReference: DANGLING_OPENERS.test(firstSentence.trim()),
    };
  });

  const totalSections = sections.length;
  const wellSizedSectionCount = sections.filter((s) => s.sizeQuality === 'good').length;
  const danglingReferenceCount = sections.filter((s) => s.startsWithDanglingReference).length;

  const chunkReadinessScore =
    totalSections === 0
      ? 0
      : Math.round(
          ((wellSizedSectionCount / totalSections) * 0.7 +
            ((totalSections - danglingReferenceCount) / totalSections) * 0.3) *
            100
        );

  if (totalSections >= 3 && wellSizedSectionCount / totalSections < 0.5) {
    const tooLong = sections.filter((s) => s.sizeQuality === 'too-long').length;
    const tooShort = sections.filter((s) => s.sizeQuality === 'too-short').length;
    issues.push({
      code: 'RAG_CHUNK_SIZE_MISMATCH',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Most sections are poorly sized for AI retrieval chunking',
      description: `${wellSizedSectionCount} of ${totalSections} sections fall in a well-sized range for RAG retrieval (roughly 150-450 words); ${tooLong} are too long and likely to get split mid-thought, ${tooShort} are too short and likely to get merged with unrelated neighbors.`,
      impact: 'When an AI answer engine retrieves a chunk of this page in response to a query, oversized sections risk being cut off mid-point and undersized ones risk losing standalone context — both reduce the odds the retrieved chunk reads coherently in an AI-generated answer.',
      howToFix: 'Break up long sections (450+ words) with an additional H2/H3 subheading roughly every 300-400 words. Merge very short sections (under 150 words) into a neighboring section or expand them with enough context to stand alone.',
      affectedUrls: [url],
      details: { wellSizedSectionCount, totalSections, tooLong, tooShort },
    });
  }

  if (totalSections >= 3 && danglingReferenceCount / totalSections > 0.3) {
    issues.push({
      code: 'RAG_CHUNK_DANGLING_REFERENCES',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'Several sections open with a reference to prior context',
      description: `${danglingReferenceCount} of ${totalSections} sections start with a pronoun or demonstrative ("This...", "It...", "These...") that depends on the previous section to make sense.`,
      impact: 'A RAG system that retrieves one of these sections on its own — which is exactly how retrieval works, one chunk at a time — surfaces a sentence whose subject is undefined, reading as broken or confusing in an AI-generated answer.',
      howToFix: 'Open each section by naming its actual subject instead of referring back to the previous one — e.g. "This approach reduces cost" becomes "Caching reduces cost."',
      affectedUrls: [url],
      details: { danglingReferenceCount, totalSections },
    });
  }

  return {
    issues,
    data: { sections, totalSections, wellSizedSectionCount, danglingReferenceCount, chunkReadinessScore },
  };
}
