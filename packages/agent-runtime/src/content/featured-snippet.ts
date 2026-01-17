// Featured Snippet Optimization
// Analyzes and optimizes content for Google's featured snippets

export type SnippetType = 'paragraph' | 'list' | 'table' | 'video' | 'none';

export interface FeaturedSnippetAnalysis {
  // Current snippet potential
  snippetPotential: number; // 0-100
  bestSnippetType: SnippetType;
  // Analysis
  hasDirectAnswer: boolean;
  hasNumberedSteps: boolean;
  hasBulletList: boolean;
  hasTable: boolean;
  hasDefinition: boolean;
  // Content recommendations
  recommendations: SnippetRecommendation[];
  // Optimized content suggestions
  suggestedParagraph?: string;
  suggestedListItems?: string[];
}

export interface SnippetRecommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  example?: string;
}

// Question patterns that often trigger featured snippets
const SNIPPET_TRIGGER_PATTERNS = [
  /^what (is|are)\b/i,
  /^how (to|do|does|can|much|many|long)\b/i,
  /^why (is|are|do|does)\b/i,
  /^when (to|should|do|does)\b/i,
  /^where (to|can|do|is)\b/i,
  /^who (is|are|was|were)\b/i,
  /\b(definition|meaning|example|vs|versus)\b/i,
  /\b(best|top|steps|ways|tips|types)\b/i,
];

/**
 * Analyze content for featured snippet optimization
 */
export function analyzeFeaturedSnippetPotential(
  query: string,
  content: string,
  headings: string[]
): FeaturedSnippetAnalysis {
  const recommendations: SnippetRecommendation[] = [];
  let snippetPotential = 0;

  // Check if query is snippet-worthy
  const isSnippetQuery = SNIPPET_TRIGGER_PATTERNS.some(p => p.test(query));
  if (isSnippetQuery) {
    snippetPotential += 20;
  } else {
    recommendations.push({
      priority: 'medium',
      action: 'This query may not trigger featured snippets. Consider targeting question-based keywords.',
    });
  }

  // Analyze content structure
  const hasDirectAnswer = checkForDirectAnswer(query, content);
  const hasNumberedSteps = /(\d+\.\s|\d+\)|\bstep\s+\d+)/i.test(content);
  const hasBulletList = /^[\s]*[-•*]\s/m.test(content) || /<li>/i.test(content);
  const hasTable = /<table/i.test(content) || /\|.*\|.*\|/m.test(content);
  const hasDefinition = checkForDefinition(query, content);

  // Score based on content elements
  if (hasDirectAnswer) {
    snippetPotential += 25;
  } else {
    recommendations.push({
      priority: 'high',
      action: 'Add a direct answer to the query in the first paragraph',
      example: generateDirectAnswer(query),
    });
  }

  if (hasNumberedSteps) {
    snippetPotential += 15;
  }

  if (hasBulletList) {
    snippetPotential += 10;
  }

  if (hasTable) {
    snippetPotential += 10;
  }

  if (hasDefinition) {
    snippetPotential += 15;
  }

  // Check heading structure
  const hasQueryInHeading = headings.some(h =>
    h.toLowerCase().includes(query.toLowerCase()) ||
    query.toLowerCase().includes(h.toLowerCase())
  );

  if (hasQueryInHeading) {
    snippetPotential += 10;
  } else {
    recommendations.push({
      priority: 'high',
      action: 'Include the target query in an H2 or H3 heading',
      example: `<h2>${capitalizeFirst(query)}</h2>`,
    });
  }

  // Determine best snippet type
  const bestSnippetType = determineBestSnippetType(query, content);

  // Add type-specific recommendations
  if (bestSnippetType === 'paragraph' && !hasDirectAnswer) {
    recommendations.push({
      priority: 'high',
      action: 'Write a 40-60 word paragraph that directly answers the query',
      example: generateParagraphSnippet(query),
    });
  }

  if (bestSnippetType === 'list' && !hasNumberedSteps && !hasBulletList) {
    recommendations.push({
      priority: 'high',
      action: 'Add a numbered or bulleted list with 5-8 items',
      example: 'Structure as: 1. Step one\n2. Step two\n3. Step three',
    });
  }

  if (bestSnippetType === 'table' && !hasTable) {
    recommendations.push({
      priority: 'medium',
      action: 'Consider adding a comparison table for this topic',
    });
  }

  // Content length check
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 300) {
    snippetPotential -= 10;
    recommendations.push({
      priority: 'medium',
      action: 'Expand content to at least 300 words for better snippet eligibility',
    });
  }

  // Generate suggested content
  const suggestedParagraph = generateParagraphSnippet(query);
  const suggestedListItems = generateListSnippet(query);

  return {
    snippetPotential: Math.max(0, Math.min(100, snippetPotential)),
    bestSnippetType,
    hasDirectAnswer,
    hasNumberedSteps,
    hasBulletList,
    hasTable,
    hasDefinition,
    recommendations,
    suggestedParagraph,
    suggestedListItems,
  };
}

function checkForDirectAnswer(query: string, content: string): boolean {
  // Look for patterns like "X is Y" or "X are Y" near the beginning
  const firstParagraph = content.split(/\n\n/)[0] || content.slice(0, 500);
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  // Check if query words appear in first paragraph with "is" or "are"
  const hasDefinitionPattern = queryWords.some(word =>
    new RegExp(`\\b${word}\\b.{0,50}\\b(is|are|refers to|means|defined as)\\b`, 'i').test(firstParagraph)
  );

  return hasDefinitionPattern;
}

function checkForDefinition(query: string, content: string): boolean {
  const definitionPatterns = [
    /\b(is defined as|refers to|is a|are a|means that|is the process of)\b/i,
    /\bdefinition:\s/i,
    /\bin other words,\s/i,
  ];

  return definitionPatterns.some(p => p.test(content));
}

function determineBestSnippetType(query: string, content: string): SnippetType {
  const q = query.toLowerCase();

  // How-to queries → List snippet
  if (/^how to\b/i.test(q) || /\b(steps|ways|tips|methods)\b/i.test(q)) {
    return 'list';
  }

  // Comparison queries → Table snippet
  if (/\b(vs|versus|compared to|difference between)\b/i.test(q)) {
    return 'table';
  }

  // What/definition queries → Paragraph snippet
  if (/^what (is|are)\b/i.test(q) || /\b(definition|meaning)\b/i.test(q)) {
    return 'paragraph';
  }

  // List-style queries
  if (/^(best|top)\s+\d+\b/i.test(q) || /\b(types of|examples of|list of)\b/i.test(q)) {
    return 'list';
  }

  // Default to paragraph
  return 'paragraph';
}

function generateDirectAnswer(query: string): string {
  const q = query.toLowerCase();

  if (q.startsWith('what is ')) {
    const topic = query.slice(8);
    return `${capitalizeFirst(topic)} is [brief definition]. It [key characteristic or function].`;
  }

  if (q.startsWith('how to ')) {
    const topic = query.slice(7);
    return `To ${topic}, follow these steps: 1) [First step], 2) [Second step], 3) [Third step].`;
  }

  return `[Direct answer to "${query}"] in 40-60 words.`;
}

function generateParagraphSnippet(query: string): string {
  const q = query.toLowerCase();

  if (q.startsWith('what is ')) {
    const topic = query.slice(8);
    return `${capitalizeFirst(topic)} is a [category] that [main function/purpose]. ` +
           `It is commonly used for [use case] and helps [benefit]. ` +
           `The key features include [feature 1], [feature 2], and [feature 3].`;
  }

  if (q.startsWith('why ')) {
    return `The main reason [topic] is because [primary reason]. ` +
           `Additionally, [secondary reason]. This leads to [outcome/benefit].`;
  }

  return `[Topic] refers to [definition]. It [main characteristic]. ` +
         `The most important aspects are [aspect 1] and [aspect 2].`;
}

function generateListSnippet(query: string): string[] {
  const q = query.toLowerCase();

  if (q.startsWith('how to ')) {
    return [
      'Identify your goal and requirements',
      'Research available options',
      'Prepare necessary tools or resources',
      'Follow the step-by-step process',
      'Test and verify results',
      'Make adjustments as needed',
      'Document your process for future reference',
    ];
  }

  if (/\b(best|top)\b/i.test(q)) {
    return [
      '[Option 1] - Best for [use case]',
      '[Option 2] - Best for [use case]',
      '[Option 3] - Best for [use case]',
      '[Option 4] - Best for [use case]',
      '[Option 5] - Best for [use case]',
    ];
  }

  return [
    'Key point or step 1',
    'Key point or step 2',
    'Key point or step 3',
    'Key point or step 4',
    'Key point or step 5',
  ];
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format featured snippet analysis report
 */
export function formatFeaturedSnippetReport(analysis: FeaturedSnippetAnalysis): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push('  FEATURED SNIPPET ANALYSIS');
  lines.push('═'.repeat(60));
  lines.push('');

  // Potential score
  const potentialIcon = analysis.snippetPotential >= 70 ? '🟢' :
                        analysis.snippetPotential >= 40 ? '🟡' : '🔴';
  lines.push(`${potentialIcon} Snippet Potential: ${analysis.snippetPotential}/100`);
  lines.push(`   Best Snippet Type: ${analysis.bestSnippetType}`);
  lines.push('');

  // Content elements
  lines.push('📋 CONTENT ELEMENTS');
  lines.push('─'.repeat(60));
  lines.push(`  Direct Answer:    ${analysis.hasDirectAnswer ? '✅ Yes' : '❌ No'}`);
  lines.push(`  Definition:       ${analysis.hasDefinition ? '✅ Yes' : '❌ No'}`);
  lines.push(`  Numbered Steps:   ${analysis.hasNumberedSteps ? '✅ Yes' : '❌ No'}`);
  lines.push(`  Bullet List:      ${analysis.hasBulletList ? '✅ Yes' : '❌ No'}`);
  lines.push(`  Table:            ${analysis.hasTable ? '✅ Yes' : '❌ No'}`);
  lines.push('');

  // Recommendations
  if (analysis.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(60));

    const highPriority = analysis.recommendations.filter(r => r.priority === 'high');
    const mediumPriority = analysis.recommendations.filter(r => r.priority === 'medium');

    if (highPriority.length > 0) {
      lines.push('  HIGH PRIORITY:');
      for (const rec of highPriority) {
        lines.push(`  🔴 ${rec.action}`);
        if (rec.example) {
          lines.push(`      Example: ${rec.example}`);
        }
      }
    }

    if (mediumPriority.length > 0) {
      lines.push('  MEDIUM PRIORITY:');
      for (const rec of mediumPriority) {
        lines.push(`  🟡 ${rec.action}`);
      }
    }
    lines.push('');
  }

  // Suggested content
  if (analysis.suggestedParagraph) {
    lines.push('📝 SUGGESTED PARAGRAPH SNIPPET');
    lines.push('─'.repeat(60));
    lines.push(`  ${analysis.suggestedParagraph}`);
    lines.push('');
  }

  if (analysis.suggestedListItems && analysis.suggestedListItems.length > 0) {
    lines.push('📝 SUGGESTED LIST SNIPPET');
    lines.push('─'.repeat(60));
    for (let i = 0; i < analysis.suggestedListItems.length; i++) {
      lines.push(`  ${i + 1}. ${analysis.suggestedListItems[i]}`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
