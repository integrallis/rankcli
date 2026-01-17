// Search Intent Classification
// Categorizes queries as informational, navigational, transactional, or commercial

export type SearchIntent = 'informational' | 'navigational' | 'transactional' | 'commercial';

export interface IntentAnalysis {
  intent: SearchIntent;
  confidence: number; // 0-100
  signals: string[];
  recommendedContentFormat: string;
  contentSuggestions: string[];
}

/**
 * Classify search intent for a keyword/query
 */
export function classifyIntent(query: string): IntentAnalysis {
  const q = query.toLowerCase().trim();
  const signals: string[] = [];
  const scores: Record<SearchIntent, number> = {
    informational: 0,
    navigational: 0,
    transactional: 0,
    commercial: 0,
  };

  // Informational signals (user wants to learn)
  const informationalPatterns = [
    { pattern: /^(what|who|why|when|where|which)\b/, weight: 30, signal: 'Question word (what/who/why)' },
    { pattern: /^how (to|do|does|can|should)\b/, weight: 35, signal: 'How-to question' },
    { pattern: /\b(guide|tutorial|learn|understand|explain)\b/, weight: 25, signal: 'Learning intent' },
    { pattern: /\b(definition|meaning|example|history)\b/, weight: 25, signal: 'Definition/meaning query' },
    { pattern: /\b(tips|ideas|ways to|steps)\b/, weight: 20, signal: 'Tips/ideas request' },
    { pattern: /^(is|are|can|does|do)\b/, weight: 15, signal: 'Yes/no question' },
    { pattern: /\b(vs|versus|difference between|compared to)\b/, weight: 20, signal: 'Comparison query' },
  ];

  // Navigational signals (user wants to go somewhere specific)
  const navigationalPatterns = [
    { pattern: /\b(login|sign in|log in|signin)\b/, weight: 40, signal: 'Login intent' },
    { pattern: /\b(\.com|\.org|\.net|\.io)\b/, weight: 35, signal: 'Domain in query' },
    { pattern: /\b(official|website|homepage|site)\b/, weight: 30, signal: 'Website reference' },
    { pattern: /\b(facebook|twitter|instagram|youtube|linkedin|github)\b/, weight: 40, signal: 'Social platform' },
    { pattern: /\b(amazon|google|apple|microsoft)\b/, weight: 25, signal: 'Brand name' },
    { pattern: /\b(app|download|install)\b/, weight: 20, signal: 'App/download intent' },
  ];

  // Transactional signals (user wants to take action/buy)
  const transactionalPatterns = [
    { pattern: /\b(buy|purchase|order|shop)\b/, weight: 40, signal: 'Purchase intent' },
    { pattern: /\b(price|pricing|cost|cheap|discount|deal|sale|coupon)\b/, weight: 35, signal: 'Price interest' },
    { pattern: /\b(free trial|free download|download free)\b/, weight: 30, signal: 'Free trial/download' },
    { pattern: /\b(subscribe|sign up|signup|register)\b/, weight: 30, signal: 'Signup intent' },
    { pattern: /\b(book|reserve|schedule|appointment)\b/, weight: 30, signal: 'Booking intent' },
    { pattern: /\b(hire|service|quote)\b/, weight: 25, signal: 'Service request' },
    { pattern: /\b(near me|nearby|local)\b/, weight: 25, signal: 'Local intent' },
  ];

  // Commercial investigation signals (user researching before purchase)
  const commercialPatterns = [
    { pattern: /\b(best|top|review|reviews)\b/, weight: 35, signal: 'Review/best-of query' },
    { pattern: /\b(comparison|compare|vs|versus|or)\b/, weight: 30, signal: 'Comparison shopping' },
    { pattern: /\b(alternative|alternatives to)\b/, weight: 30, signal: 'Alternative search' },
    { pattern: /\b(pros and cons|advantages|disadvantages)\b/, weight: 25, signal: 'Evaluation query' },
    { pattern: /\b(worth it|should i|is it good)\b/, weight: 25, signal: 'Purchase consideration' },
    { pattern: /\b(for (small business|enterprise|startups|developers))\b/, weight: 20, signal: 'Segment-specific' },
    { pattern: /\b20\d{2}\b/, weight: 15, signal: 'Year reference (recency)' },
  ];

  // Calculate scores
  for (const p of informationalPatterns) {
    if (p.pattern.test(q)) {
      scores.informational += p.weight;
      signals.push(`[INFO] ${p.signal}`);
    }
  }

  for (const p of navigationalPatterns) {
    if (p.pattern.test(q)) {
      scores.navigational += p.weight;
      signals.push(`[NAV] ${p.signal}`);
    }
  }

  for (const p of transactionalPatterns) {
    if (p.pattern.test(q)) {
      scores.transactional += p.weight;
      signals.push(`[TRANS] ${p.signal}`);
    }
  }

  for (const p of commercialPatterns) {
    if (p.pattern.test(q)) {
      scores.commercial += p.weight;
      signals.push(`[COMM] ${p.signal}`);
    }
  }

  // Determine winner
  const maxScore = Math.max(...Object.values(scores));
  let intent: SearchIntent = 'informational'; // Default

  if (maxScore === 0) {
    // No clear signals, use heuristics
    const wordCount = q.split(/\s+/).length;
    if (wordCount <= 2) {
      intent = 'navigational';
      signals.push('[DEFAULT] Short query - likely navigational');
    } else {
      intent = 'informational';
      signals.push('[DEFAULT] No clear signals - defaulting to informational');
    }
  } else {
    intent = (Object.entries(scores) as [SearchIntent, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0
    ? Math.min(100, Math.round((scores[intent] / totalScore) * 100))
    : 50;

  // Get recommendations
  const { recommendedContentFormat, contentSuggestions } = getContentRecommendations(intent);

  return {
    intent,
    confidence,
    signals,
    recommendedContentFormat,
    contentSuggestions,
  };
}

function getContentRecommendations(intent: SearchIntent): {
  recommendedContentFormat: string;
  contentSuggestions: string[];
} {
  switch (intent) {
    case 'informational':
      return {
        recommendedContentFormat: 'Long-form blog post, guide, or tutorial',
        contentSuggestions: [
          'Create comprehensive how-to content',
          'Include step-by-step instructions',
          'Add FAQ section for related questions',
          'Use clear headings (H2, H3) for scanability',
          'Include images/diagrams to illustrate concepts',
          'Target featured snippet with direct answers',
        ],
      };

    case 'navigational':
      return {
        recommendedContentFormat: 'Brand landing page or homepage',
        contentSuggestions: [
          'Ensure brand name is in title and H1',
          'Include clear navigation to key sections',
          'Add structured data for organization/website',
          'Optimize for brand + product variations',
          'Include social proof and trust signals',
        ],
      };

    case 'transactional':
      return {
        recommendedContentFormat: 'Product page or service landing page',
        contentSuggestions: [
          'Include clear CTA (Buy, Sign Up, Download)',
          'Show pricing information prominently',
          'Add product schema markup',
          'Include trust signals (reviews, testimonials)',
          'Optimize for "buy", "price", "discount" variations',
          'Add urgency elements (limited time, stock)',
        ],
      };

    case 'commercial':
      return {
        recommendedContentFormat: 'Comparison page, review, or buying guide',
        contentSuggestions: [
          'Create detailed comparison tables',
          'Include pros and cons lists',
          'Add expert opinions or user reviews',
          'Compare features, pricing, use cases',
          'Include clear recommendation/winner',
          'Add affiliate-friendly product links',
        ],
      };
  }
}

/**
 * Batch classify multiple keywords
 */
export function classifyIntents(keywords: string[]): Map<string, IntentAnalysis> {
  const results = new Map<string, IntentAnalysis>();
  for (const kw of keywords) {
    results.set(kw, classifyIntent(kw));
  }
  return results;
}

/**
 * Format intent analysis report
 */
export function formatIntentReport(query: string, analysis: IntentAnalysis): string {
  const lines: string[] = [];

  const intentIcons: Record<SearchIntent, string> = {
    informational: '📚',
    navigational: '🧭',
    transactional: '💰',
    commercial: '🔍',
  };

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('  SEARCH INTENT ANALYSIS');
  lines.push('═'.repeat(60));
  lines.push('');

  lines.push(`Query: "${query}"`);
  lines.push('');

  lines.push(`${intentIcons[analysis.intent]} Intent: ${analysis.intent.toUpperCase()}`);
  lines.push(`   Confidence: ${analysis.confidence}%`);
  lines.push('');

  // Signals
  if (analysis.signals.length > 0) {
    lines.push('📊 SIGNALS DETECTED');
    lines.push('─'.repeat(60));
    for (const signal of analysis.signals) {
      lines.push(`  • ${signal}`);
    }
    lines.push('');
  }

  // Content format
  lines.push('📝 RECOMMENDED CONTENT');
  lines.push('─'.repeat(60));
  lines.push(`  Format: ${analysis.recommendedContentFormat}`);
  lines.push('');

  // Suggestions
  lines.push('💡 CONTENT SUGGESTIONS');
  lines.push('─'.repeat(60));
  for (const suggestion of analysis.contentSuggestions) {
    lines.push(`  • ${suggestion}`);
  }
  lines.push('');

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
