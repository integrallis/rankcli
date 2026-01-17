// Content Readability Analysis
// Implements Flesch Reading Ease, Flesch-Kincaid, and other readability metrics

export interface ReadabilityResult {
  // Flesch Reading Ease (0-100, higher = easier)
  fleschReadingEase: number;
  fleschGrade: string;
  // Flesch-Kincaid Grade Level (US school grade)
  fleschKincaidGrade: number;
  // Additional metrics
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  avgWordsPerParagraph: number;
  // Content stats
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  syllableCount: number;
  // Quality indicators
  passiveVoicePercentage: number;
  complexWordPercentage: number; // Words with 3+ syllables
  // Recommendations
  recommendations: string[];
  score: number; // 0-100 composite score
}

/**
 * Analyze content readability
 */
export function analyzeReadability(text: string): ReadabilityResult {
  // Clean and normalize text
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  // Count elements
  const words = getWords(cleanText);
  const sentences = getSentences(cleanText);
  const paragraphs = getParagraphs(cleanText);
  const syllables = countTotalSyllables(words);

  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const paragraphCount = Math.max(paragraphs.length, 1);

  // Calculate averages
  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllables / Math.max(wordCount, 1);
  const avgWordsPerParagraph = wordCount / paragraphCount;

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const fleschReadingEase = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
  ));

  // Flesch-Kincaid Grade Level: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
  const fleschKincaidGrade = Math.max(0,
    (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59
  );

  // Passive voice detection
  const passiveVoiceCount = countPassiveVoice(sentences);
  const passiveVoicePercentage = (passiveVoiceCount / sentenceCount) * 100;

  // Complex words (3+ syllables)
  const complexWords = words.filter(w => countSyllables(w) >= 3);
  const complexWordPercentage = (complexWords.length / Math.max(wordCount, 1)) * 100;

  // Generate recommendations
  const recommendations: string[] = [];

  if (avgSentenceLength > 20) {
    recommendations.push(`Shorten sentences. Average is ${avgSentenceLength.toFixed(1)} words (target: <20)`);
  }

  if (fleschReadingEase < 60) {
    recommendations.push('Simplify language. Content may be too difficult for general audiences');
  }

  if (passiveVoicePercentage > 15) {
    recommendations.push(`Reduce passive voice (${passiveVoicePercentage.toFixed(1)}%). Use active voice for clarity`);
  }

  if (complexWordPercentage > 25) {
    recommendations.push(`Reduce complex words (${complexWordPercentage.toFixed(1)}%). Use simpler alternatives`);
  }

  if (avgWordsPerParagraph > 150) {
    recommendations.push('Break up long paragraphs. Target 50-150 words per paragraph');
  }

  // Composite score
  const score = calculateReadabilityScore({
    fleschReadingEase,
    avgSentenceLength,
    passiveVoicePercentage,
    complexWordPercentage,
  });

  return {
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschGrade: getFleschGrade(fleschReadingEase),
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    avgWordsPerParagraph: Math.round(avgWordsPerParagraph),
    wordCount,
    sentenceCount,
    paragraphCount,
    syllableCount: syllables,
    passiveVoicePercentage: Math.round(passiveVoicePercentage * 10) / 10,
    complexWordPercentage: Math.round(complexWordPercentage * 10) / 10,
    recommendations,
    score,
  };
}

function getWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
}

function getSentences(text: string): string[] {
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
}

function getParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0);
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  // Count vowel groups
  const vowels = 'aeiouy';
  let count = 0;
  let prevWasVowel = false;

  for (const char of word) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevWasVowel) {
      count++;
    }
    prevWasVowel = isVowel;
  }

  // Adjust for silent e
  if (word.endsWith('e') && count > 1) {
    count--;
  }

  // Adjust for common endings
  if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) {
    count++;
  }

  return Math.max(1, count);
}

function countTotalSyllables(words: string[]): number {
  return words.reduce((sum, word) => sum + countSyllables(word), 0);
}

function countPassiveVoice(sentences: string[]): number {
  const passivePatterns = [
    /\b(am|is|are|was|were|been|being)\s+\w+ed\b/i,
    /\b(am|is|are|was|were|been|being)\s+\w+en\b/i,
    /\b(get|gets|got|gotten|getting)\s+\w+ed\b/i,
  ];

  return sentences.filter(sentence =>
    passivePatterns.some(pattern => pattern.test(sentence))
  ).length;
}

function getFleschGrade(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Difficult (College Graduate)';
}

function calculateReadabilityScore(metrics: {
  fleschReadingEase: number;
  avgSentenceLength: number;
  passiveVoicePercentage: number;
  complexWordPercentage: number;
}): number {
  // Weight factors
  const weights = {
    flesch: 0.4,
    sentenceLength: 0.25,
    passiveVoice: 0.2,
    complexity: 0.15,
  };

  // Score components (0-100)
  const fleschScore = metrics.fleschReadingEase;
  const sentenceLengthScore = Math.max(0, 100 - Math.abs(metrics.avgSentenceLength - 15) * 3);
  const passiveVoiceScore = Math.max(0, 100 - metrics.passiveVoicePercentage * 5);
  const complexityScore = Math.max(0, 100 - metrics.complexWordPercentage * 2);

  const totalScore =
    fleschScore * weights.flesch +
    sentenceLengthScore * weights.sentenceLength +
    passiveVoiceScore * weights.passiveVoice +
    complexityScore * weights.complexity;

  return Math.round(totalScore);
}

/**
 * Format readability report
 */
export function formatReadabilityReport(result: ReadabilityResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('  READABILITY ANALYSIS');
  lines.push('═'.repeat(60));
  lines.push('');

  // Score overview
  const scoreIcon = result.score >= 70 ? '🟢' : result.score >= 50 ? '🟡' : '🔴';
  lines.push(`${scoreIcon} Readability Score: ${result.score}/100`);
  lines.push('');

  // Key metrics
  lines.push('📊 KEY METRICS');
  lines.push('─'.repeat(60));
  lines.push(`  Flesch Reading Ease:  ${result.fleschReadingEase} (${result.fleschGrade})`);
  lines.push(`  Flesch-Kincaid Grade: ${result.fleschKincaidGrade}`);
  lines.push(`  Avg Sentence Length:  ${result.avgSentenceLength} words`);
  lines.push(`  Passive Voice:        ${result.passiveVoicePercentage}%`);
  lines.push(`  Complex Words:        ${result.complexWordPercentage}%`);
  lines.push('');

  // Content stats
  lines.push('📝 CONTENT STATS');
  lines.push('─'.repeat(60));
  lines.push(`  Words:       ${result.wordCount}`);
  lines.push(`  Sentences:   ${result.sentenceCount}`);
  lines.push(`  Paragraphs:  ${result.paragraphCount}`);
  lines.push(`  Syllables:   ${result.syllableCount}`);
  lines.push('');

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(60));
    for (const rec of result.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
