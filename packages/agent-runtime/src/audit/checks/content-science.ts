// Content Science Module - Novel SEO Checks Based on Academic Research
// Implements: Zipf's Law, Shannon Entropy, BM25 Scoring, Cosine Similarity
// These techniques differentiate RankCLI from competitors like Ahrefs/SEMrush

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

// ==================== ZIPF'S LAW ANALYSIS ====================
// Natural language follows Zipf's law: frequency ∝ 1/rank^α (α ≈ 1)
// Deviation from this indicates unnatural text (keyword stuffing)

export interface ZipfAnalysis {
  alpha: number; // Exponent - natural text ≈ 0.9-1.1
  isNatural: boolean;
  rSquared: number; // Goodness of fit
  stuffedKeywords: Array<{ word: string; deviation: number }>;
  missingMidTail: string[];
}

/**
 * Analyze keyword distribution against Zipf's law
 * Detects keyword stuffing through statistical distribution analysis
 */
export function analyzeZipfDistribution(html: string): ZipfAnalysis {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  const text = $('body').text().toLowerCase();

  // Extract words (min 3 chars to filter stopwords)
  const words = text.match(/\b[a-z]{3,}\b/g) || [];
  if (words.length < 100) {
    return {
      alpha: 1,
      isNatural: true,
      rSquared: 0,
      stuffedKeywords: [],
      missingMidTail: [],
    };
  }

  // Count word frequencies
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency (descending)
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

  // Take top 100 words for analysis
  const topWords = sorted.slice(0, Math.min(100, sorted.length));

  // Fit Zipf's law using log-log linear regression
  // log(freq) = log(C) - α * log(rank)
  const logRanks = topWords.map((_, i) => Math.log(i + 1));
  const logFreqs = topWords.map(([_, f]) => Math.log(f));

  const { slope, intercept, rSquared } = linearRegression(logRanks, logFreqs);
  const alpha = -slope; // α is negative of slope

  // Find deviations (potential keyword stuffing)
  const stuffedKeywords: Array<{ word: string; deviation: number }> = [];
  const expectedC = Math.exp(intercept);

  for (let i = 0; i < topWords.length; i++) {
    const [word, actualFreq] = topWords[i];
    const expectedFreq = expectedC * Math.pow(i + 1, -alpha);
    const deviation = (actualFreq - expectedFreq) / expectedFreq;

    // Flag words with >50% higher frequency than expected (excluding very common words)
    if (deviation > 0.5 && word.length > 4 && i > 5) {
      stuffedKeywords.push({ word, deviation: Math.round(deviation * 100) });
    }
  }

  // Find missing mid-tail terms (ranks 20-50 with lower than expected frequency)
  const missingMidTail: string[] = [];
  for (let i = 20; i < Math.min(50, topWords.length); i++) {
    const [word, actualFreq] = topWords[i];
    const expectedFreq = expectedC * Math.pow(i + 1, -alpha);
    const deviation = (actualFreq - expectedFreq) / expectedFreq;

    if (deviation < -0.3) {
      missingMidTail.push(word);
    }
  }

  return {
    alpha,
    isNatural: alpha >= 0.8 && alpha <= 1.2 && rSquared > 0.85,
    rSquared,
    stuffedKeywords: stuffedKeywords.slice(0, 10),
    missingMidTail: missingMidTail.slice(0, 5),
  };
}

// ==================== SHANNON ENTROPY ====================
// Information entropy measures vocabulary diversity
// Low entropy = repetitive content, High entropy = diverse vocabulary

export interface EntropyAnalysis {
  wordEntropy: number;
  normalizedEntropy: number; // 0-1 scale
  vocabularyRichness: number; // Type-token ratio
  repetitionScore: number; // 0-1, higher = more repetitive
  bigramEntropy: number;
  qualityIndicator: 'excellent' | 'good' | 'average' | 'poor';
}

/**
 * Calculate Shannon entropy for content quality assessment
 */
export function analyzeEntropy(html: string): EntropyAnalysis {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  const text = $('body').text().toLowerCase();

  const words = text.match(/\b[a-z]{2,}\b/g) || [];
  if (words.length < 50) {
    return {
      wordEntropy: 0,
      normalizedEntropy: 0,
      vocabularyRichness: 0,
      repetitionScore: 1,
      bigramEntropy: 0,
      qualityIndicator: 'poor',
    };
  }

  // Word frequency
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // Bigram frequency
  const bigramFreq = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
  }

  // Shannon entropy: H = -Σ p(x) * log2(p(x))
  const wordEntropy = calculateShannonEntropy(wordFreq, words.length);
  const bigramEntropy = calculateShannonEntropy(bigramFreq, words.length - 1);

  // Maximum possible entropy (uniform distribution)
  const maxEntropy = Math.log2(wordFreq.size);
  const normalizedEntropy = maxEntropy > 0 ? wordEntropy / maxEntropy : 0;

  // Type-token ratio (unique words / total words)
  const vocabularyRichness = wordFreq.size / words.length;

  // Repetition score (inverse of normalized entropy)
  const repetitionScore = 1 - normalizedEntropy;

  // Quality indicator
  let qualityIndicator: EntropyAnalysis['qualityIndicator'];
  if (normalizedEntropy > 0.85 && vocabularyRichness > 0.4) {
    qualityIndicator = 'excellent';
  } else if (normalizedEntropy > 0.75 && vocabularyRichness > 0.3) {
    qualityIndicator = 'good';
  } else if (normalizedEntropy > 0.6 && vocabularyRichness > 0.2) {
    qualityIndicator = 'average';
  } else {
    qualityIndicator = 'poor';
  }

  return {
    wordEntropy,
    normalizedEntropy,
    vocabularyRichness,
    repetitionScore,
    bigramEntropy,
    qualityIndicator,
  };
}

function calculateShannonEntropy(freq: Map<string, number>, total: number): number {
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

// ==================== BM25 SCORING ====================
// Okapi BM25 is the ranking function used by Elasticsearch/Lucene
// More accurate than keyword density for relevance scoring

export interface BM25Analysis {
  keyword: string;
  score: number;
  termFrequency: number;
  saturationPoint: boolean; // TF above optimal
  lengthPenalty: number;
  recommendation: string;
}

/**
 * Calculate BM25 relevance score for target keywords
 * Parameters tuned for web content (k1=1.5, b=0.75)
 */
export function calculateBM25(
  html: string,
  keywords: string[],
  avgDocLength: number = 1500, // Average web page word count
  k1: number = 1.5,
  b: number = 0.75
): BM25Analysis[] {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const text = $('body').text().toLowerCase();
  const words = text.match(/\b[a-z]+\b/g) || [];
  const docLength = words.length;

  const results: BM25Analysis[] = [];

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const keywordWords = keywordLower.split(/\s+/);

    // Count exact phrase or individual word matches
    let tf: number;
    if (keywordWords.length > 1) {
      // Phrase matching
      const regex = new RegExp(keywordLower.replace(/\s+/g, '\\s+'), 'gi');
      tf = (text.match(regex) || []).length;
    } else {
      // Single word
      tf = words.filter((w) => w === keywordLower).length;
    }

    // BM25 formula (IDF = 1 for single document analysis)
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    const score = numerator / denominator;

    // Check if additional occurrences would help (saturation check)
    const nextTF = tf + 1;
    const nextScore = (nextTF * (k1 + 1)) / (nextTF + k1 * (1 - b + b * (docLength / avgDocLength)));
    const marginalGain = (nextScore - score) / (score || 1);
    const saturationPoint = marginalGain < 0.1; // Less than 10% improvement

    // Length penalty
    const lengthPenalty = b * (docLength / avgDocLength - 1);

    // Generate recommendation
    let recommendation: string;
    if (tf === 0) {
      recommendation = `Add "${keyword}" to your content`;
    } else if (saturationPoint) {
      recommendation = `Keyword "${keyword}" is saturated (${tf} occurrences). Focus on semantic variations.`;
    } else if (lengthPenalty > 0.3) {
      recommendation = `Content is ${Math.round(lengthPenalty * 100)}% longer than average. Consider tightening.`;
    } else if (tf < 3) {
      recommendation = `Consider adding 1-2 more natural mentions of "${keyword}"`;
    } else {
      recommendation = `Good keyword presence for "${keyword}"`;
    }

    results.push({
      keyword,
      score: Math.round(score * 100) / 100,
      termFrequency: tf,
      saturationPoint,
      lengthPenalty: Math.round(lengthPenalty * 100) / 100,
      recommendation,
    });
  }

  return results;
}

// ==================== COSINE SIMILARITY ====================
// Better duplicate/cannibalization detection than exact matching

export interface SimilarityAnalysis {
  similarity: number; // 0-1
  sharedTerms: string[];
  uniqueToA: string[];
  uniqueToB: string[];
  recommendation: 'duplicate' | 'cannibalization' | 'related' | 'distinct';
}

/**
 * Build TF-IDF vector for document
 */
export function buildTFIDFVector(text: string, vocabulary: string[]): number[] {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  const wordCount = new Map<string, number>();

  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }

  const docLength = words.length || 1;
  const vector: number[] = [];

  for (const term of vocabulary) {
    const tf = (wordCount.get(term) || 0) / docLength;
    // IDF approximation: log(2) for present terms, 0 for absent
    const idf = wordCount.has(term) ? Math.log(2) : 0;
    vector.push(tf * idf);
  }

  return vector;
}

/**
 * Calculate cosine similarity between two content pieces
 */
export function calculateCosineSimilarity(textA: string, textB: string): SimilarityAnalysis {
  const wordsA = new Set((textA.toLowerCase().match(/\b[a-z]{3,}\b/g) || []));
  const wordsB = new Set((textB.toLowerCase().match(/\b[a-z]{3,}\b/g) || []));

  // Build combined vocabulary
  const vocabulary = [...new Set([...wordsA, ...wordsB])];

  // Build TF-IDF vectors
  const vectorA = buildTFIDFVector(textA, vocabulary);
  const vectorB = buildTFIDFVector(textB, vocabulary);

  // Cosine similarity
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vocabulary.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  const similarity = normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;

  // Find shared and unique terms
  const sharedTerms = [...wordsA].filter((w) => wordsB.has(w)).slice(0, 20);
  const uniqueToA = [...wordsA].filter((w) => !wordsB.has(w)).slice(0, 10);
  const uniqueToB = [...wordsB].filter((w) => !wordsA.has(w)).slice(0, 10);

  // Recommendation based on similarity
  let recommendation: SimilarityAnalysis['recommendation'];
  if (similarity > 0.95) {
    recommendation = 'duplicate';
  } else if (similarity > 0.75) {
    recommendation = 'cannibalization';
  } else if (similarity > 0.5) {
    recommendation = 'related';
  } else {
    recommendation = 'distinct';
  }

  return {
    similarity: Math.round(similarity * 100) / 100,
    sharedTerms,
    uniqueToA,
    uniqueToB,
    recommendation,
  };
}

// ==================== INFORMATION GAIN ====================
// Identifies keywords that differentiate top-ranking content

export interface InformationGainResult {
  keyword: string;
  informationGain: number;
  presentInTopContent: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Calculate information gain for keywords (simplified for single-document analysis)
 * Compares content against expected term distribution
 */
export function calculateInformationGain(
  html: string,
  topicKeywords: string[]
): InformationGainResult[] {
  const $ = cheerio.load(html);
  $('script, style').remove();
  const text = $('body').text().toLowerCase();

  const results: InformationGainResult[] = [];

  for (const keyword of topicKeywords) {
    const keywordLower = keyword.toLowerCase();
    const isPresent = text.includes(keywordLower);

    // Simple information gain approximation
    // Higher IG for important topic keywords that are missing
    const wordLength = keywordLower.split(/\s+/).length;
    const baseIG = wordLength > 1 ? 0.5 : 0.3; // Phrases are more specific

    const informationGain = isPresent ? baseIG * 0.8 : baseIG;

    let priority: InformationGainResult['priority'];
    if (!isPresent && informationGain > 0.4) {
      priority = 'critical';
    } else if (!isPresent && informationGain > 0.3) {
      priority = 'high';
    } else if (!isPresent) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    results.push({
      keyword,
      informationGain: Math.round(informationGain * 100) / 100,
      presentInTopContent: isPresent,
      priority,
    });
  }

  return results.sort((a, b) => b.informationGain - a.informationGain);
}

// ==================== HELPER FUNCTIONS ====================

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = x.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0,
    sumYY = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  let ssRes = 0,
    ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared };
}

// ==================== MAIN ANALYSIS FUNCTION ====================

export interface ContentScienceData {
  zipf: ZipfAnalysis;
  entropy: EntropyAnalysis;
  bm25: BM25Analysis[];
  overallQuality: 'excellent' | 'good' | 'needs-work' | 'poor';
}

/**
 * Run comprehensive content science analysis
 */
export function analyzeContentScience(
  html: string,
  url: string,
  targetKeywords: string[] = []
): { issues: AuditIssue[]; data: ContentScienceData } {
  const issues: AuditIssue[] = [];

  // Zipf's Law Analysis
  const zipf = analyzeZipfDistribution(html);

  if (!zipf.isNatural && zipf.stuffedKeywords.length > 0) {
    issues.push({
      code: 'ZIPF_KEYWORD_STUFFING',
      severity: 'warning',
      category: 'content',
      title: 'Unnatural keyword distribution detected',
      description: `Content deviates from natural language patterns (Zipf α=${zipf.alpha.toFixed(2)}, expected ~1.0). Possible keyword stuffing detected.`,
      impact: 'Search engines can detect unnatural text patterns, potentially triggering spam filters.',
      howToFix: `Reduce repetition of: ${zipf.stuffedKeywords.map((k) => `"${k.word}" (+${k.deviation}%)`).join(', ')}`,
      affectedUrls: [url],
      details: {
        alpha: zipf.alpha,
        rSquared: zipf.rSquared,
        stuffedKeywords: zipf.stuffedKeywords,
      },
    });
  }

  // Entropy Analysis
  const entropy = analyzeEntropy(html);

  if (entropy.qualityIndicator === 'poor') {
    issues.push({
      code: 'LOW_CONTENT_ENTROPY',
      severity: 'warning',
      category: 'content',
      title: 'Low vocabulary diversity (thin content signal)',
      description: `Content entropy is low (${entropy.normalizedEntropy.toFixed(2)}). This indicates repetitive or thin content.`,
      impact: 'Low diversity content may be seen as low-quality by search engines.',
      howToFix: 'Expand vocabulary, add more unique insights, and reduce repetitive phrases.',
      affectedUrls: [url],
      details: {
        normalizedEntropy: entropy.normalizedEntropy,
        vocabularyRichness: entropy.vocabularyRichness,
        repetitionScore: entropy.repetitionScore,
      },
    });
  }

  if (entropy.repetitionScore > 0.7) {
    issues.push({
      code: 'HIGH_CONTENT_REPETITION',
      severity: 'notice',
      category: 'content',
      title: 'High content repetition detected',
      description: `Content shows ${Math.round(entropy.repetitionScore * 100)}% repetition pattern.`,
      impact: 'Highly repetitive content provides less value and may hurt engagement.',
      howToFix: 'Vary your vocabulary and sentence structures. Avoid repeating the same phrases.',
      affectedUrls: [url],
    });
  }

  // BM25 Analysis (if keywords provided)
  const bm25 = targetKeywords.length > 0 ? calculateBM25(html, targetKeywords) : [];

  for (const result of bm25) {
    if (result.termFrequency === 0) {
      issues.push({
        code: 'BM25_KEYWORD_MISSING',
        severity: 'warning',
        category: 'on-page',
        title: `Target keyword "${result.keyword}" not found`,
        description: 'This keyword is not present in your content at all.',
        impact: 'Page unlikely to rank for this keyword without any mention of it.',
        howToFix: `Add natural mentions of "${result.keyword}" in your content.`,
        affectedUrls: [url],
        details: { keyword: result.keyword, bm25Score: 0 },
      });
    } else if (result.saturationPoint && result.termFrequency > 10) {
      issues.push({
        code: 'BM25_KEYWORD_SATURATED',
        severity: 'notice',
        category: 'on-page',
        title: `Keyword "${result.keyword}" over-optimized`,
        description: `Found ${result.termFrequency} times. Additional mentions provide diminishing returns.`,
        impact: 'Over-optimization can trigger spam signals.',
        howToFix: 'Use semantic variations and related terms instead of exact repetition.',
        affectedUrls: [url],
        details: { keyword: result.keyword, termFrequency: result.termFrequency },
      });
    }
  }

  // Overall quality assessment
  let overallQuality: ContentScienceData['overallQuality'];
  const qualityScore =
    (zipf.isNatural ? 30 : 0) +
    (entropy.qualityIndicator === 'excellent' ? 40 : entropy.qualityIndicator === 'good' ? 30 : entropy.qualityIndicator === 'average' ? 20 : 0) +
    (bm25.filter((b) => b.termFrequency > 0 && !b.saturationPoint).length / Math.max(bm25.length, 1)) * 30;

  if (qualityScore >= 80) {
    overallQuality = 'excellent';
  } else if (qualityScore >= 60) {
    overallQuality = 'good';
  } else if (qualityScore >= 40) {
    overallQuality = 'needs-work';
  } else {
    overallQuality = 'poor';
  }

  return {
    issues,
    data: {
      zipf,
      entropy,
      bm25,
      overallQuality,
    },
  };
}
