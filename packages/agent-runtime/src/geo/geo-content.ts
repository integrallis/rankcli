/**
 * GEO Content Module
 *
 * Generate AI-citation-friendly content with structured data,
 * comparison tables, FAQs, and key facts formatted for LLM parsing.
 */

export interface KeyFact {
  label: string;
  value: string | number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ComparisonRow {
  feature: string;
  brand: string | boolean;
  competitor?: string | boolean;
  competitors?: Record<string, string | boolean>;
}

export interface ComparisonConfig {
  brandName: string;
  competitorName?: string;
  competitorNames?: string[];
  useCheckmarks?: boolean;
}

export interface AIContentConfig {
  productName: string;
  tagline?: string;
  description?: string;
  keyFacts?: KeyFact[];
  faqs?: FAQItem[];
  comparison?: {
    competitorName: string;
    rows: ComparisonRow[];
  };
}

export interface KeyFactsOptions {
  format?: 'bullets' | 'paragraph' | 'inline';
}

export interface FAQSchemaOptions {
  format?: 'json-ld' | 'markdown';
}

export interface OptimizeOptions {
  brandName?: string;
  highlightNumbers?: boolean;
  structureLists?: boolean;
  emphasizeBrand?: boolean;
  addSourcePlaceholder?: boolean;
}

/**
 * Generate formatted key facts for AI citation
 */
export function generateKeyFacts(
  facts: KeyFact[],
  options: KeyFactsOptions = {}
): string {
  const format = options.format || 'bullets';

  const formatted = facts.map(fact => `**${fact.label}:** ${fact.value}`);

  switch (format) {
    case 'bullets':
      return formatted.map(f => `- ${f}`).join('\n');
    case 'paragraph':
      return formatted.join('. ') + '.';
    case 'inline':
      return formatted.join(' | ');
    default:
      return formatted.join('\n');
  }
}

/**
 * Generate FAQ schema (JSON-LD or Markdown)
 */
export function generateFAQSchema(
  faqs: FAQItem[],
  options: FAQSchemaOptions = {}
): string {
  const format = options.format || 'json-ld';

  if (format === 'markdown') {
    const lines = ['## FAQ', ''];
    for (const faq of faqs) {
      lines.push(`### ${faq.question}`);
      lines.push('');
      lines.push(faq.answer);
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  // JSON-LD format
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return JSON.stringify(schema, null, 2);
}

/**
 * Generate comparison table in markdown
 */
export function generateComparisonTable(
  rows: ComparisonRow[],
  config: ComparisonConfig
): string {
  const { brandName, useCheckmarks } = config;

  // Determine competitor columns
  const competitorNames = config.competitorNames ||
    (config.competitorName ? [config.competitorName] : []);

  // Build header
  const headers = ['Feature', brandName, ...competitorNames];
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;

  // Build rows
  const dataRows = rows.map(row => {
    const brandValue = formatCellValue(row.brand, useCheckmarks);

    let competitorValues: string[];
    if (row.competitors) {
      competitorValues = competitorNames.map(name =>
        formatCellValue(row.competitors?.[name] ?? '-', useCheckmarks)
      );
    } else {
      competitorValues = [formatCellValue(row.competitor ?? '-', useCheckmarks)];
    }

    return `| ${row.feature} | ${brandValue} | ${competitorValues.join(' | ')} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * Format cell value for comparison table
 */
function formatCellValue(value: string | boolean | undefined, useCheckmarks?: boolean): string {
  if (typeof value === 'boolean') {
    if (useCheckmarks) {
      return value ? '✓' : '✗';
    }
    return value ? 'Yes' : 'No';
  }
  return String(value ?? '-');
}

/**
 * Generate complete AI-citable content block
 */
export function generateAICitableContent(config: AIContentConfig): string {
  const sections: string[] = [];

  // Header with product name
  sections.push(`# ${config.productName}`);
  sections.push('');

  // Tagline
  if (config.tagline) {
    sections.push(`**${config.tagline}**`);
    sections.push('');
  }

  // Description
  if (config.description) {
    sections.push(config.description);
    sections.push('');
  }

  // Key Facts
  if (config.keyFacts && config.keyFacts.length > 0) {
    sections.push('## Key Facts');
    sections.push('');
    sections.push(generateKeyFacts(config.keyFacts, { format: 'bullets' }));
    sections.push('');
  }

  // Comparison Table
  if (config.comparison) {
    sections.push(`## ${config.productName} vs ${config.comparison.competitorName}`);
    sections.push('');
    sections.push(generateComparisonTable(config.comparison.rows, {
      brandName: config.productName,
      competitorName: config.comparison.competitorName,
    }));
    sections.push('');
  }

  // FAQ Section
  if (config.faqs && config.faqs.length > 0) {
    sections.push(generateFAQSchema(config.faqs, { format: 'markdown' }));
    sections.push('');
  }

  return sections.join('\n').trim();
}

/**
 * Optimize existing content for AI citation
 */
export function optimizeForAI(
  content: string,
  options: OptimizeOptions = {}
): string {
  let optimized = content;

  // Highlight numbers
  if (options.highlightNumbers) {
    // Match numbers not already in bold/code and not part of dates
    optimized = optimized.replace(
      /(?<!\*\*)(?<![`\d])\b(\d+(?:,\d{3})*(?:\.\d+)?)\b(?!\*\*)(?![`\d])/g,
      '**$1**'
    );
  }

  // Structure comma-separated lists
  if (options.structureLists) {
    // Match patterns like "includes: x, y, and z"
    optimized = optimized.replace(
      /:\s*([^.]+),\s*([^.]+),\s*and\s+([^.]+)\./gi,
      ':\n- $1\n- $2\n- $3'
    );
  }

  // Emphasize brand name
  if (options.brandName && options.emphasizeBrand) {
    const brandRegex = new RegExp(`(?<!\\*\\*)\\b(${escapeRegex(options.brandName)})\\b(?!\\*\\*)`, 'g');
    optimized = optimized.replace(brandRegex, '**$1**');
  }

  // Add source placeholder
  if (options.addSourcePlaceholder) {
    optimized = optimized.trim() + '\n\n*Source: [Your Website URL]*';
  }

  return optimized;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
