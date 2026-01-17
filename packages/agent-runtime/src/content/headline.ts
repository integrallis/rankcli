// Headline Analysis & Optimization
// Scores headlines for SEO and engagement effectiveness

export interface HeadlineAnalysis {
  headline: string;
  score: number; // 0-100
  wordCount: number;
  charCount: number;
  // Score breakdown
  breakdown: {
    length: number;
    powerWords: number;
    emotionalWords: number;
    numbers: number;
    readability: number;
    uniqueness: number;
  };
  // Issues and suggestions
  issues: string[];
  suggestions: string[];
  // Classification
  type: 'how-to' | 'list' | 'question' | 'statement' | 'guide' | 'other';
  sentiment: 'positive' | 'negative' | 'neutral';
}

// Power words that drive engagement
const POWER_WORDS = new Set([
  'ultimate', 'essential', 'proven', 'powerful', 'incredible', 'amazing',
  'exclusive', 'secret', 'free', 'new', 'best', 'top', 'complete', 'simple',
  'easy', 'quick', 'fast', 'instant', 'guaranteed', 'effective', 'brilliant',
  'stunning', 'remarkable', 'exceptional', 'revolutionary', 'breakthrough',
  'transform', 'discover', 'unlock', 'master', 'boost', 'skyrocket', 'crush',
]);

// Emotional trigger words
const EMOTIONAL_WORDS = new Set([
  'love', 'hate', 'fear', 'anxiety', 'stress', 'happy', 'sad', 'angry',
  'frustrated', 'excited', 'thrilled', 'terrified', 'worried', 'confident',
  'surprising', 'shocking', 'devastating', 'inspiring', 'heartwarming',
  'painful', 'embarrassing', 'awkward', 'dangerous', 'risky', 'safe',
]);

// Common/weak words to avoid
const WEAK_WORDS = new Set([
  'things', 'stuff', 'very', 'really', 'just', 'actually', 'basically',
  'literally', 'nice', 'good', 'great', 'awesome', 'cool', 'interesting',
]);

/**
 * Analyze headline effectiveness
 */
export function analyzeHeadline(headline: string): HeadlineAnalysis {
  const words = headline.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const charCount = headline.length;

  const issues: string[] = [];
  const suggestions: string[] = [];

  // Score components
  const breakdown = {
    length: 0,
    powerWords: 0,
    emotionalWords: 0,
    numbers: 0,
    readability: 0,
    uniqueness: 0,
  };

  // 1. Length score (ideal: 6-12 words, 50-60 chars for SEO)
  if (wordCount >= 6 && wordCount <= 12) {
    breakdown.length = 25;
  } else if (wordCount >= 4 && wordCount <= 15) {
    breakdown.length = 15;
  } else if (wordCount < 4) {
    breakdown.length = 5;
    issues.push('Too short - aim for 6-12 words');
    suggestions.push('Add more descriptive words to convey value');
  } else {
    breakdown.length = 10;
    issues.push('Too long - may get truncated in SERPs');
    suggestions.push('Trim to under 60 characters for display');
  }

  if (charCount <= 60) {
    breakdown.length += 5;
  } else if (charCount <= 70) {
    breakdown.length += 2;
  } else {
    issues.push(`Title is ${charCount} chars (${charCount - 60} over limit)`);
  }

  // 2. Power words
  const powerWordCount = words.filter(w => POWER_WORDS.has(w.replace(/[^a-z]/g, ''))).length;
  if (powerWordCount >= 2) {
    breakdown.powerWords = 20;
  } else if (powerWordCount === 1) {
    breakdown.powerWords = 15;
    suggestions.push('Add another power word for more impact');
  } else {
    breakdown.powerWords = 0;
    suggestions.push('Include power words like: ultimate, proven, essential, free');
  }

  // 3. Emotional words
  const emotionalCount = words.filter(w => EMOTIONAL_WORDS.has(w.replace(/[^a-z]/g, ''))).length;
  if (emotionalCount >= 1) {
    breakdown.emotionalWords = 15;
  } else {
    breakdown.emotionalWords = 5;
    suggestions.push('Consider adding emotional trigger words for engagement');
  }

  // 4. Numbers (lists perform well)
  const hasNumber = /\d+/.test(headline);
  if (hasNumber) {
    breakdown.numbers = 15;
    // Odd numbers perform better
    const numbers = headline.match(/\d+/g) || [];
    const hasOddNumber = numbers.some(n => parseInt(n) % 2 !== 0);
    if (hasOddNumber) {
      breakdown.numbers += 5;
    }
  } else {
    breakdown.numbers = 0;
    suggestions.push('Consider adding a number (e.g., "7 Ways to...", "5 Tips for...")');
  }

  // 5. Readability
  const weakWordCount = words.filter(w => WEAK_WORDS.has(w)).length;
  if (weakWordCount === 0) {
    breakdown.readability = 15;
  } else {
    breakdown.readability = Math.max(0, 15 - weakWordCount * 5);
    issues.push(`Contains weak/vague words: ${words.filter(w => WEAK_WORDS.has(w)).join(', ')}`);
  }

  // Check for sentence case (Title Case vs sentence case)
  const titleCaseWords = words.filter((w, i) => i > 0 && /^[A-Z]/.test(headline.split(/\s+/)[i]));
  if (titleCaseWords.length > words.length * 0.7) {
    suggestions.push('Consider sentence case instead of Title Case for better readability');
  }

  // 6. Uniqueness (check for clichés)
  const cliches = [
    'you need to know',
    'you won\'t believe',
    'the truth about',
    'everything you need',
    'game changer',
    'must read',
  ];
  const hasCliche = cliches.some(c => headline.toLowerCase().includes(c));
  if (hasCliche) {
    breakdown.uniqueness = 5;
    issues.push('Contains overused phrases/clichés');
    suggestions.push('Try a more original angle or phrasing');
  } else {
    breakdown.uniqueness = 10;
  }

  // Classify headline type
  const type = classifyHeadlineType(headline);

  // Determine sentiment
  const sentiment = analyzeSentiment(words);

  // Calculate total score
  const score = Math.min(100,
    breakdown.length +
    breakdown.powerWords +
    breakdown.emotionalWords +
    breakdown.numbers +
    breakdown.readability +
    breakdown.uniqueness
  );

  // Add type-specific suggestions
  if (type === 'question' && !headline.endsWith('?')) {
    suggestions.push('Question headlines should end with a question mark');
  }

  if (type === 'how-to' && !headline.toLowerCase().startsWith('how to')) {
    suggestions.push('Ensure "How to" appears at the beginning for clarity');
  }

  return {
    headline,
    score,
    wordCount,
    charCount,
    breakdown,
    issues,
    suggestions,
    type,
    sentiment,
  };
}

function classifyHeadlineType(headline: string): HeadlineAnalysis['type'] {
  const h = headline.toLowerCase();

  if (h.startsWith('how to') || h.includes('how to')) return 'how-to';
  if (/^\d+\s/.test(h) || /\btop\s+\d+\b/.test(h)) return 'list';
  if (h.endsWith('?') || h.startsWith('what') || h.startsWith('why') || h.startsWith('when')) return 'question';
  if (h.includes('guide') || h.includes('tutorial')) return 'guide';
  if (/^(the|a|an)\s/i.test(h)) return 'statement';

  return 'other';
}

function analyzeSentiment(words: string[]): HeadlineAnalysis['sentiment'] {
  const positiveWords = new Set(['best', 'top', 'amazing', 'great', 'success', 'win', 'boost', 'improve', 'easy', 'free', 'new']);
  const negativeWords = new Set(['worst', 'bad', 'fail', 'mistake', 'avoid', 'stop', 'never', 'wrong', 'problem', 'risk', 'danger']);

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    const w = word.replace(/[^a-z]/g, '');
    if (positiveWords.has(w)) positiveCount++;
    if (negativeWords.has(w)) negativeCount++;
  }

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Generate headline variations
 */
export function generateHeadlineVariations(topic: string, keywords: string[]): string[] {
  const variations: string[] = [];
  const mainKeyword = keywords[0] || topic;

  // How-to format
  variations.push(`How to ${topic} in ${Math.floor(Math.random() * 5) + 3} Simple Steps`);
  variations.push(`How to ${topic}: A Complete Guide`);

  // List format (odd numbers perform better)
  const oddNumbers = [3, 5, 7, 9, 11, 13];
  const num = oddNumbers[Math.floor(Math.random() * oddNumbers.length)];
  variations.push(`${num} Proven Ways to ${topic}`);
  variations.push(`${num} ${mainKeyword} Tips That Actually Work`);

  // Question format
  variations.push(`What Is ${topic}? Everything You Need to Know`);
  variations.push(`Why ${topic} Matters More Than Ever in ${new Date().getFullYear()}`);

  // Statement with power words
  variations.push(`The Ultimate Guide to ${topic}`);
  variations.push(`${topic}: The Complete ${new Date().getFullYear()} Guide`);

  // Problem/solution
  variations.push(`${topic} Made Simple: A Beginner's Guide`);
  variations.push(`Master ${topic} Without the Confusion`);

  return variations;
}

/**
 * Format headline analysis report
 */
export function formatHeadlineReport(analysis: HeadlineAnalysis): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('  HEADLINE ANALYSIS');
  lines.push('═'.repeat(60));
  lines.push('');

  // Headline and score
  lines.push(`"${analysis.headline}"`);
  lines.push('');

  const scoreIcon = analysis.score >= 70 ? '🟢' : analysis.score >= 50 ? '🟡' : '🔴';
  lines.push(`${scoreIcon} Score: ${analysis.score}/100`);
  lines.push(`   Type: ${analysis.type} | Sentiment: ${analysis.sentiment}`);
  lines.push(`   Length: ${analysis.wordCount} words, ${analysis.charCount} chars`);
  lines.push('');

  // Score breakdown
  lines.push('📊 SCORE BREAKDOWN');
  lines.push('─'.repeat(60));
  lines.push(`  Length:        ${analysis.breakdown.length}/30`);
  lines.push(`  Power Words:   ${analysis.breakdown.powerWords}/20`);
  lines.push(`  Emotion:       ${analysis.breakdown.emotionalWords}/15`);
  lines.push(`  Numbers:       ${analysis.breakdown.numbers}/20`);
  lines.push(`  Readability:   ${analysis.breakdown.readability}/15`);
  lines.push('');

  // Issues
  if (analysis.issues.length > 0) {
    lines.push('⚠️ ISSUES');
    lines.push('─'.repeat(60));
    for (const issue of analysis.issues) {
      lines.push(`  • ${issue}`);
    }
    lines.push('');
  }

  // Suggestions
  if (analysis.suggestions.length > 0) {
    lines.push('💡 SUGGESTIONS');
    lines.push('─'.repeat(60));
    for (const suggestion of analysis.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
