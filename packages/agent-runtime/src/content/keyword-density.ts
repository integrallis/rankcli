// Keyword Density Analysis & LSI Keyword Detection
// Analyzes keyword usage and detects semantically related terms

export interface KeywordDensityAnalysis {
  primaryKeyword: string;
  // Density metrics
  density: number; // Percentage
  occurrences: number;
  wordCount: number;
  // Placement analysis
  inTitle: boolean;
  inH1: boolean;
  inFirstParagraph: boolean;
  inLastParagraph: boolean;
  inHeadings: number; // Count of H2-H6 with keyword
  // Warnings
  isKeywordStuffing: boolean;
  isUnderOptimized: boolean;
  // Related terms found
  lsiKeywords: LSIKeyword[];
  // Recommendations
  recommendations: string[];
}

export interface LSIKeyword {
  keyword: string;
  occurrences: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface ContentElements {
  title?: string;
  h1?: string;
  headings: string[];
  body: string;
  firstParagraph?: string;
  lastParagraph?: string;
}

// Common LSI/semantic relations for various topics
const LSI_PATTERNS: Record<string, string[]> = {
  // Generic patterns
  'software': ['application', 'tool', 'platform', 'solution', 'program', 'app'],
  'website': ['site', 'webpage', 'page', 'web application', 'portal'],
  'seo': ['search engine optimization', 'ranking', 'serp', 'google', 'keywords', 'backlinks'],
  'marketing': ['advertising', 'promotion', 'campaign', 'strategy', 'content', 'audience'],
  'business': ['company', 'enterprise', 'organization', 'startup', 'firm'],
  'tutorial': ['guide', 'how-to', 'instructions', 'steps', 'learn'],
  'best': ['top', 'leading', 'recommended', 'popular', 'favorite'],
};

/**
 * Analyze keyword density in content
 */
export function analyzeKeywordDensity(
  primaryKeyword: string,
  content: ContentElements
): KeywordDensityAnalysis {
  const keyword = primaryKeyword.toLowerCase();
  const keywordWords = keyword.split(/\s+/);
  const isPhrase = keywordWords.length > 1;

  const recommendations: string[] = [];

  // Count occurrences in body
  const bodyText = content.body.toLowerCase();
  const words = bodyText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Count exact phrase/word occurrences
  let occurrences = 0;
  if (isPhrase) {
    // Count phrase occurrences
    const regex = new RegExp(escapeRegex(keyword), 'gi');
    const matches = bodyText.match(regex);
    occurrences = matches ? matches.length : 0;
  } else {
    // Count word occurrences
    occurrences = words.filter(w => w.replace(/[^a-z]/g, '') === keyword).length;
  }

  // Calculate density
  const density = (occurrences / Math.max(wordCount, 1)) * 100;

  // Check placement
  const inTitle = content.title ? content.title.toLowerCase().includes(keyword) : false;
  const inH1 = content.h1 ? content.h1.toLowerCase().includes(keyword) : false;
  const inFirstParagraph = content.firstParagraph
    ? content.firstParagraph.toLowerCase().includes(keyword)
    : false;
  const inLastParagraph = content.lastParagraph
    ? content.lastParagraph.toLowerCase().includes(keyword)
    : false;
  const inHeadings = content.headings.filter(h => h.toLowerCase().includes(keyword)).length;

  // Check for keyword stuffing (> 3% is generally considered stuffing)
  const isKeywordStuffing = density > 3;
  if (isKeywordStuffing) {
    recommendations.push(`Keyword density (${density.toFixed(2)}%) is too high. Reduce to 1-2% to avoid penalties`);
  }

  // Check for under-optimization
  const isUnderOptimized = density < 0.5 || occurrences < 2;
  if (isUnderOptimized && wordCount > 100) {
    recommendations.push(`Keyword density (${density.toFixed(2)}%) is low. Consider adding more natural mentions`);
  }

  // Placement recommendations
  if (!inTitle) {
    recommendations.push('Add primary keyword to the page title');
  }
  if (!inH1) {
    recommendations.push('Add primary keyword to the H1 heading');
  }
  if (!inFirstParagraph) {
    recommendations.push('Include keyword in the first 100 words of content');
  }
  if (inHeadings < 2 && wordCount > 500) {
    recommendations.push('Add keyword to at least 2 subheadings (H2/H3)');
  }

  // Find LSI keywords
  const lsiKeywords = findLSIKeywords(keyword, bodyText);

  // LSI recommendations
  const highRelevanceLSI = lsiKeywords.filter(l => l.relevance === 'high' && l.occurrences === 0);
  if (highRelevanceLSI.length > 0) {
    recommendations.push(`Consider adding related terms: ${highRelevanceLSI.slice(0, 3).map(l => l.keyword).join(', ')}`);
  }

  return {
    primaryKeyword,
    density: Math.round(density * 100) / 100,
    occurrences,
    wordCount,
    inTitle,
    inH1,
    inFirstParagraph,
    inLastParagraph,
    inHeadings,
    isKeywordStuffing,
    isUnderOptimized,
    lsiKeywords,
    recommendations,
  };
}

/**
 * Find LSI (Latent Semantic Indexing) keywords in content
 */
export function findLSIKeywords(primaryKeyword: string, content: string): LSIKeyword[] {
  const keyword = primaryKeyword.toLowerCase();
  const contentLower = content.toLowerCase();
  const results: LSIKeyword[] = [];

  // Get semantically related terms based on keyword components
  const relatedTerms = new Set<string>();

  // Check against known LSI patterns
  for (const [pattern, related] of Object.entries(LSI_PATTERNS)) {
    if (keyword.includes(pattern) || pattern.includes(keyword)) {
      related.forEach(term => relatedTerms.add(term));
    }
  }

  // Add common modifiers and variations
  const modifiers = [
    'best', 'top', 'free', 'online', 'guide', 'tutorial', 'how to',
    'tips', 'examples', 'review', 'vs', 'alternative',
  ];
  modifiers.forEach(mod => {
    relatedTerms.add(`${mod} ${keyword}`);
    relatedTerms.add(`${keyword} ${mod}`);
  });

  // Add word variations
  const keywordWords = keyword.split(/\s+/);
  keywordWords.forEach(word => {
    // Plural/singular variations
    if (word.endsWith('s')) {
      relatedTerms.add(word.slice(0, -1));
    } else {
      relatedTerms.add(word + 's');
    }
    // -ing/-ed variations
    if (word.endsWith('ing')) {
      relatedTerms.add(word.slice(0, -3));
      relatedTerms.add(word.slice(0, -3) + 'ed');
    }
  });

  // Analyze content for related terms
  for (const term of relatedTerms) {
    if (term === keyword) continue;

    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
    const matches = contentLower.match(regex);
    const occurrences = matches ? matches.length : 0;

    // Determine relevance
    let relevance: 'high' | 'medium' | 'low' = 'low';
    if (term.includes(keyword) || keyword.includes(term)) {
      relevance = 'high';
    } else if (term.split(/\s+/).some(w => keyword.includes(w))) {
      relevance = 'medium';
    }

    results.push({ keyword: term, occurrences, relevance });
  }

  // Sort by relevance and occurrences
  results.sort((a, b) => {
    const relevanceOrder = { high: 0, medium: 1, low: 2 };
    if (relevanceOrder[a.relevance] !== relevanceOrder[b.relevance]) {
      return relevanceOrder[a.relevance] - relevanceOrder[b.relevance];
    }
    return b.occurrences - a.occurrences;
  });

  return results.slice(0, 20);
}

/**
 * Calculate TF-IDF score for keywords in content
 */
export function calculateTFIDF(
  content: string,
  documentCount: number = 100
): Map<string, number> {
  const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const wordCount = words.length;
  const termFrequency = new Map<string, number>();

  // Count term frequency
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (clean.length > 3 && !isStopWord(clean)) {
      termFrequency.set(clean, (termFrequency.get(clean) || 0) + 1);
    }
  }

  // Calculate TF-IDF (simplified - assume inverse document frequency)
  const tfidf = new Map<string, number>();
  for (const [term, freq] of termFrequency) {
    const tf = freq / wordCount;
    // Simplified IDF - assume rare terms have higher value
    const idf = Math.log(documentCount / (1 + Math.min(freq, 10)));
    tfidf.set(term, tf * idf);
  }

  return tfidf;
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'same', 'than', 'too', 'very',
    'just', 'also', 'now', 'here', 'there', 'then', 'once', 'your', 'their',
  ]);
  return stopWords.has(word);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format keyword density report
 */
export function formatKeywordDensityReport(analysis: KeywordDensityAnalysis): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('  KEYWORD DENSITY ANALYSIS');
  lines.push('═'.repeat(60));
  lines.push('');

  // Primary keyword stats
  lines.push(`Primary Keyword: "${analysis.primaryKeyword}"`);
  lines.push('');

  // Density metrics
  const densityIcon = analysis.isKeywordStuffing ? '🔴' :
                      analysis.isUnderOptimized ? '🟡' : '🟢';
  lines.push(`${densityIcon} Density: ${analysis.density}%`);
  lines.push(`   Occurrences: ${analysis.occurrences} times in ${analysis.wordCount} words`);

  if (analysis.isKeywordStuffing) {
    lines.push('   ⚠️ WARNING: Possible keyword stuffing detected');
  }
  if (analysis.isUnderOptimized) {
    lines.push('   ⚠️ WARNING: Keyword may be under-optimized');
  }
  lines.push('');

  // Placement analysis
  lines.push('📍 KEYWORD PLACEMENT');
  lines.push('─'.repeat(60));
  lines.push(`  In Title:           ${analysis.inTitle ? '✅ Yes' : '❌ No'}`);
  lines.push(`  In H1:              ${analysis.inH1 ? '✅ Yes' : '❌ No'}`);
  lines.push(`  In First Paragraph: ${analysis.inFirstParagraph ? '✅ Yes' : '❌ No'}`);
  lines.push(`  In Subheadings:     ${analysis.inHeadings > 0 ? `✅ ${analysis.inHeadings} times` : '❌ No'}`);
  lines.push(`  In Last Paragraph:  ${analysis.inLastParagraph ? '✅ Yes' : '❌ No'}`);
  lines.push('');

  // LSI Keywords
  const presentLSI = analysis.lsiKeywords.filter(l => l.occurrences > 0);
  const missingLSI = analysis.lsiKeywords.filter(l => l.occurrences === 0 && l.relevance !== 'low');

  if (presentLSI.length > 0) {
    lines.push('🔗 LSI KEYWORDS FOUND');
    lines.push('─'.repeat(60));
    for (const lsi of presentLSI.slice(0, 8)) {
      const relevanceIcon = lsi.relevance === 'high' ? '🟢' :
                           lsi.relevance === 'medium' ? '🟡' : '⚪';
      lines.push(`  ${relevanceIcon} "${lsi.keyword}" - ${lsi.occurrences} occurrences`);
    }
    lines.push('');
  }

  if (missingLSI.length > 0) {
    lines.push('📝 SUGGESTED LSI KEYWORDS TO ADD');
    lines.push('─'.repeat(60));
    for (const lsi of missingLSI.slice(0, 5)) {
      lines.push(`  • ${lsi.keyword}`);
    }
    lines.push('');
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(60));
    for (const rec of analysis.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
