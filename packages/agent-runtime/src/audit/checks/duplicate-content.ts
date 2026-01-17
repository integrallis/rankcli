import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface ContentHashData {
  url: string;
  contentHash: string;
  titleHash: string;
  title?: string;
  wordCount: number;
  textSample: string;
}

export interface DuplicateDetectionResult {
  duplicates: Array<{
    url1: string;
    url2: string;
    similarity: number;
    type: 'exact' | 'near-duplicate';
  }>;
  potentialCannibalization: Array<{
    pages: string[];
    keyword: string;
    similarity: number;
  }>;
}

// Extract content hash for a page
export function extractContentHash(html: string, url: string): ContentHashData {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, header, footer, aside, .nav, .header, .footer, .sidebar').remove();

  const title = $('title').text().trim();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  // Create normalized content for hashing
  const normalizedContent = bodyText.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const contentHash = createHash('md5').update(normalizedContent).digest('hex');
  const titleHash = createHash('md5').update(title.toLowerCase()).digest('hex');

  return {
    url,
    contentHash,
    titleHash,
    title,
    wordCount: normalizedContent.split(/\s+/).length,
    textSample: normalizedContent.substring(0, 200),
  };
}

// Calculate similarity between two strings using Jaccard index on shingles
function calculateSimilarity(text1: string, text2: string, shingleSize: number = 3): number {
  const getShingles = (text: string): Set<string> => {
    const shingles = new Set<string>();
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i <= words.length - shingleSize; i++) {
      shingles.add(words.slice(i, i + shingleSize).join(' '));
    }
    return shingles;
  };

  const shingles1 = getShingles(text1);
  const shingles2 = getShingles(text2);

  if (shingles1.size === 0 && shingles2.size === 0) return 1;
  if (shingles1.size === 0 || shingles2.size === 0) return 0;

  let intersection = 0;
  for (const shingle of shingles1) {
    if (shingles2.has(shingle)) intersection++;
  }

  const union = shingles1.size + shingles2.size - intersection;
  return intersection / union;
}

// Detect duplicates across multiple pages
export function detectDuplicates(pages: ContentHashData[]): DuplicateDetectionResult {
  const duplicates: DuplicateDetectionResult['duplicates'] = [];
  const titleGroups: Map<string, ContentHashData[]> = new Map();

  // Group by title hash for cannibalization detection
  for (const page of pages) {
    const existing = titleGroups.get(page.titleHash) || [];
    existing.push(page);
    titleGroups.set(page.titleHash, existing);
  }

  // Find exact duplicates (same content hash)
  const contentHashGroups: Map<string, ContentHashData[]> = new Map();
  for (const page of pages) {
    const existing = contentHashGroups.get(page.contentHash) || [];
    existing.push(page);
    contentHashGroups.set(page.contentHash, existing);
  }

  for (const [, group] of contentHashGroups) {
    if (group.length > 1) {
      for (let i = 0; i < group.length - 1; i++) {
        for (let j = i + 1; j < group.length; j++) {
          duplicates.push({
            url1: group[i].url,
            url2: group[j].url,
            similarity: 100,
            type: 'exact',
          });
        }
      }
    }
  }

  // Find near-duplicates (high similarity but not exact)
  for (let i = 0; i < pages.length - 1; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      // Skip if already found as exact duplicate
      if (pages[i].contentHash === pages[j].contentHash) continue;

      // Only compare if word counts are similar (within 30%)
      const wordDiff = Math.abs(pages[i].wordCount - pages[j].wordCount);
      const avgWords = (pages[i].wordCount + pages[j].wordCount) / 2;
      if (wordDiff / avgWords > 0.3) continue;

      const similarity = calculateSimilarity(pages[i].textSample, pages[j].textSample);
      if (similarity >= 0.9) {
        duplicates.push({
          url1: pages[i].url,
          url2: pages[j].url,
          similarity: Math.round(similarity * 100),
          type: 'near-duplicate',
        });
      }
    }
  }

  // Detect potential keyword cannibalization (same title)
  const potentialCannibalization: DuplicateDetectionResult['potentialCannibalization'] = [];
  for (const [, group] of titleGroups) {
    if (group.length > 1 && group[0].title) {
      potentialCannibalization.push({
        pages: group.map(p => p.url),
        keyword: group[0].title,
        similarity: 100,
      });
    }
  }

  return { duplicates, potentialCannibalization };
}

// Generate issues from detection results
export function generateDuplicateIssues(
  result: DuplicateDetectionResult,
  currentUrl: string
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Near-duplicate issues
  for (const dup of result.duplicates) {
    if (dup.url1 === currentUrl || dup.url2 === currentUrl) {
      issues.push({
        ...ISSUE_DEFINITIONS.NEAR_DUPLICATE,
        affectedUrls: [dup.url1, dup.url2],
        details: {
          similarity: `${dup.similarity}%`,
          type: dup.type,
          otherUrl: dup.url1 === currentUrl ? dup.url2 : dup.url1,
        },
      });
    }
  }

  // Cannibalization issues
  for (const cannibal of result.potentialCannibalization) {
    if (cannibal.pages.includes(currentUrl)) {
      issues.push({
        ...ISSUE_DEFINITIONS.KEYWORD_CANNIBALIZATION,
        affectedUrls: cannibal.pages,
        details: {
          keyword: cannibal.keyword,
          pageCount: cannibal.pages.length,
        },
      });
    }
  }

  return issues;
}
