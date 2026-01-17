// Keyword Topic Grouping/Clustering
// Groups keywords by parent topic for content planning

import type { KeywordData } from './types.js';

export interface KeywordTopic {
  topic: string;
  keywords: KeywordData[];
  totalVolume: number;
  avgDifficulty: number;
  contentType: 'hub' | 'pillar' | 'cluster';
}

export interface TopicClusterResult {
  topics: KeywordTopic[];
  uncategorized: KeywordData[];
  contentStrategy: ContentRecommendation[];
}

export interface ContentRecommendation {
  topic: string;
  pageType: 'pillar-page' | 'blog-post' | 'faq-page' | 'landing-page';
  targetKeywords: string[];
  potentialTraffic: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Group keywords into topic clusters using multiple strategies:
 * 1. Shared root words
 * 2. Semantic similarity (common terms)
 * 3. Intent matching (questions, how-to, etc.)
 * 4. N-gram overlap
 */
export function groupKeywordsByTopic(keywords: KeywordData[]): TopicClusterResult {
  const topicMap = new Map<string, KeywordData[]>();
  const uncategorized: KeywordData[] = [];

  // Step 1: Extract potential topics from keywords
  const topicCandidates = extractTopicCandidates(keywords);

  // Step 2: Assign keywords to topics
  for (const kw of keywords) {
    const matchedTopic = findBestTopic(kw.keyword, topicCandidates);

    if (matchedTopic) {
      if (!topicMap.has(matchedTopic)) {
        topicMap.set(matchedTopic, []);
      }
      topicMap.get(matchedTopic)!.push(kw);
    } else {
      uncategorized.push(kw);
    }
  }

  // Step 3: Create topic objects with metrics
  const topics: KeywordTopic[] = [];

  for (const [topic, kwList] of topicMap) {
    if (kwList.length < 2) {
      // Move single-keyword topics to uncategorized
      uncategorized.push(...kwList);
      continue;
    }

    const totalVolume = kwList.reduce((sum, k) => sum + k.searchVolume, 0);
    const avgDifficulty = Math.round(
      kwList.reduce((sum, k) => sum + k.keywordDifficulty, 0) / kwList.length
    );

    // Determine content type based on cluster size and volume
    let contentType: 'hub' | 'pillar' | 'cluster';
    if (kwList.length >= 10 || totalVolume >= 5000) {
      contentType = 'hub';
    } else if (kwList.length >= 5 || totalVolume >= 1000) {
      contentType = 'pillar';
    } else {
      contentType = 'cluster';
    }

    topics.push({
      topic,
      keywords: kwList.sort((a, b) => b.searchVolume - a.searchVolume),
      totalVolume,
      avgDifficulty,
      contentType,
    });
  }

  // Sort topics by total volume
  topics.sort((a, b) => b.totalVolume - a.totalVolume);

  // Step 4: Generate content strategy recommendations
  const contentStrategy = generateContentStrategy(topics);

  return { topics, uncategorized, contentStrategy };
}

function extractTopicCandidates(keywords: KeywordData[]): Map<string, number> {
  const wordFrequency = new Map<string, number>();
  const bigramFrequency = new Map<string, number>();

  // Count word and bigram frequencies
  for (const kw of keywords) {
    const words = kw.keyword.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !isStopWord(w));

    // Single words
    for (const word of words) {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    }

    // Bigrams (2-word phrases)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigramFrequency.set(bigram, (bigramFrequency.get(bigram) || 0) + 1);
    }
  }

  // Combine and filter - prefer bigrams that appear frequently
  const candidates = new Map<string, number>();

  // Add frequent bigrams first (they make better topics)
  for (const [bigram, count] of bigramFrequency) {
    if (count >= 2) {
      candidates.set(bigram, count * 2); // Weight bigrams higher
    }
  }

  // Add frequent single words
  for (const [word, count] of wordFrequency) {
    if (count >= 3 && !candidates.has(word)) {
      candidates.set(word, count);
    }
  }

  return candidates;
}

function findBestTopic(keyword: string, topicCandidates: Map<string, number>): string | null {
  const kwLower = keyword.toLowerCase();
  let bestTopic: string | null = null;
  let bestScore = 0;

  for (const [topic, frequency] of topicCandidates) {
    if (kwLower.includes(topic)) {
      // Score based on how much of the keyword this topic covers
      const coverage = topic.length / kwLower.length;
      const score = frequency * coverage;

      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }
  }

  // Also check for intent-based grouping
  if (!bestTopic) {
    const intent = classifyIntent(keyword);
    if (intent !== 'other') {
      // Group questions together, how-tos together, etc.
      const intentTopics: Record<string, string> = {
        question: 'FAQ / Questions',
        'how-to': 'How-To Guides',
        comparison: 'Comparisons',
        best: 'Best / Top Lists',
        review: 'Reviews',
      };
      if (intentTopics[intent]) {
        return intentTopics[intent];
      }
    }
  }

  return bestTopic;
}

function classifyIntent(keyword: string): string {
  const kw = keyword.toLowerCase();

  if (/^(what|why|when|where|who|which|how|can|is|are|does|do)\b/.test(kw)) {
    return 'question';
  }
  if (kw.startsWith('how to ')) {
    return 'how-to';
  }
  if (/\b(vs|versus|compared|comparison|alternative)\b/.test(kw)) {
    return 'comparison';
  }
  if (/^(best|top|greatest)\b/.test(kw)) {
    return 'best';
  }
  if (/\b(review|reviews)\b/.test(kw)) {
    return 'review';
  }

  return 'other';
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'new', 'first', 'last', 'long', 'great', 'little',
    'own', 'other', 'old', 'right', 'big', 'high', 'different', 'small',
    'large', 'next', 'early', 'young', 'important', 'public', 'bad', 'same',
  ]);
  return stopWords.has(word);
}

function generateContentStrategy(topics: KeywordTopic[]): ContentRecommendation[] {
  const recommendations: ContentRecommendation[] = [];

  for (const topic of topics.slice(0, 10)) {
    // Determine page type based on topic characteristics
    let pageType: ContentRecommendation['pageType'];
    let targetKeywords: string[] = [];

    if (topic.topic === 'FAQ / Questions') {
      pageType = 'faq-page';
      targetKeywords = topic.keywords.slice(0, 10).map(k => k.keyword);
    } else if (topic.topic === 'How-To Guides') {
      pageType = 'blog-post';
      targetKeywords = topic.keywords.slice(0, 5).map(k => k.keyword);
    } else if (topic.contentType === 'hub') {
      pageType = 'pillar-page';
      targetKeywords = topic.keywords.slice(0, 8).map(k => k.keyword);
    } else if (topic.avgDifficulty < 20) {
      pageType = 'blog-post';
      targetKeywords = topic.keywords.slice(0, 5).map(k => k.keyword);
    } else {
      pageType = 'landing-page';
      targetKeywords = topic.keywords.slice(0, 3).map(k => k.keyword);
    }

    // Determine difficulty
    let difficulty: ContentRecommendation['difficulty'];
    if (topic.avgDifficulty < 20) {
      difficulty = 'easy';
    } else if (topic.avgDifficulty < 40) {
      difficulty = 'medium';
    } else {
      difficulty = 'hard';
    }

    recommendations.push({
      topic: topic.topic,
      pageType,
      targetKeywords,
      potentialTraffic: topic.totalVolume,
      difficulty,
    });
  }

  return recommendations;
}

/**
 * Format topic grouping report
 */
export function formatTopicReport(result: TopicClusterResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(70));
  lines.push('  KEYWORD TOPIC CLUSTERS');
  lines.push('═'.repeat(70));
  lines.push('');

  for (const topic of result.topics.slice(0, 8)) {
    const icon = topic.contentType === 'hub' ? '📚' :
                 topic.contentType === 'pillar' ? '📄' : '📝';

    lines.push(`${icon} TOPIC: ${topic.topic.toUpperCase()}`);
    lines.push('─'.repeat(70));
    lines.push(`  Type: ${topic.contentType.toUpperCase()} | Keywords: ${topic.keywords.length} | Volume: ${topic.totalVolume} | Avg KD: ${topic.avgDifficulty}`);
    lines.push('');
    lines.push('  Top Keywords:');

    for (const kw of topic.keywords.slice(0, 5)) {
      const vol = String(kw.searchVolume).padStart(6);
      const kd = String(kw.keywordDifficulty).padStart(3);
      lines.push(`    • ${kw.keyword.substring(0, 40).padEnd(42)} Vol: ${vol}  KD: ${kd}`);
    }

    if (topic.keywords.length > 5) {
      lines.push(`    ... and ${topic.keywords.length - 5} more keywords`);
    }
    lines.push('');
  }

  // Content strategy recommendations
  if (result.contentStrategy.length > 0) {
    lines.push('📋 CONTENT STRATEGY RECOMMENDATIONS');
    lines.push('─'.repeat(70));
    lines.push('');

    for (const rec of result.contentStrategy.slice(0, 5)) {
      const diffIcon = rec.difficulty === 'easy' ? '🟢' :
                       rec.difficulty === 'medium' ? '🟡' : '🔴';

      lines.push(`  ${diffIcon} Create a ${rec.pageType.replace('-', ' ').toUpperCase()} for "${rec.topic}"`);
      lines.push(`     Potential traffic: ~${rec.potentialTraffic}/month`);
      lines.push(`     Target keywords: ${rec.targetKeywords.slice(0, 3).join(', ')}`);
      lines.push('');
    }
  }

  // Uncategorized
  if (result.uncategorized.length > 0) {
    lines.push(`📌 ${result.uncategorized.length} keywords didn't fit into topic clusters`);
    lines.push('');
  }

  lines.push('═'.repeat(70));

  return lines.join('\n');
}
