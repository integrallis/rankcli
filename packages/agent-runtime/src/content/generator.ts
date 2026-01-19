/**
 * Content Generator Module
 *
 * Generates SEO-optimized content including blog posts, changelogs,
 * and README files. Supports GEO (Generative Engine Optimization)
 * for AI-friendly content.
 */

export interface BlogPostConfig {
  topic: string;
  keywords?: string[];
  tone?: 'technical' | 'educational' | 'casual' | 'professional';
  wordCount?: { min: number; max: number };
  includeFAQ?: boolean;
  geoOptimize?: boolean;
}

export interface ChangelogConfig {
  fromRef: string;
  toRef: string;
  groupByType?: boolean;
  seoKeywords?: string[];
  includeBreaking?: boolean;
}

export interface ReadmeConfig {
  currentContent: string;
  projectName: string;
  keywords?: string[];
  preserveCustomSections?: boolean;
}

export interface GeneratedContent {
  title: string;
  content: string;
  metaDescription: string;
  keywords: string[];
  readingTime?: string;
  wordCount?: number;
  hasFAQ?: boolean;
  error?: string;
}

export interface ChangelogResult {
  content: string;
  version?: string;
  date?: string;
  sections: {
    features?: string[];
    fixes?: string[];
    breaking?: string[];
    docs?: string[];
    other?: string[];
  };
  metaDescription?: string;
}

export interface ReadmeResult {
  content: string;
  metaDescription?: string;
  suggestions: string[];
}

export interface SEOScore {
  overall: number;
  headingScore: number;
  keywordScore: number;
  lengthScore: number;
  linkScore: number;
  mediaScore: number;
}

export interface ContentGeneratorOptions {
  llm?: LLMFunction;
  exec?: ExecFunction;
}

export type LLMFunction = (prompt: string) => Promise<any>;
export type ExecFunction = (cmd: string) => Promise<{ stdout: string; stderr?: string }>;

/**
 * Generate an SEO-optimized blog post
 */
export async function generateBlogPost(
  config: BlogPostConfig,
  options: ContentGeneratorOptions = {}
): Promise<GeneratedContent> {
  const llm = options.llm;

  if (!llm) {
    return {
      title: '',
      content: '',
      metaDescription: '',
      keywords: [],
      error: 'LLM function not provided',
    };
  }

  try {
    const prompt = buildBlogPrompt(config);
    const result = await llm(prompt);

    return {
      title: result.title || '',
      content: result.content || '',
      metaDescription: (result.metaDescription || '').substring(0, 160),
      keywords: result.keywords || [],
      readingTime: result.readingTime,
      wordCount: result.wordCount,
      hasFAQ: result.hasFAQ,
    };
  } catch (error) {
    return {
      title: '',
      content: '',
      metaDescription: '',
      keywords: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build the prompt for blog post generation
 */
function buildBlogPrompt(config: BlogPostConfig): string {
  let prompt = `Generate an SEO-optimized blog post about: ${config.topic}

Requirements:
- Create an engaging title
- Write comprehensive content`;

  if (config.keywords && config.keywords.length > 0) {
    prompt += `\n- Include these keywords naturally: ${config.keywords.join(', ')}`;
  }

  if (config.tone) {
    prompt += `\n- Use a ${config.tone} tone`;
  }

  if (config.wordCount) {
    prompt += `\n- Target ${config.wordCount.min}-${config.wordCount.max} words`;
  }

  if (config.includeFAQ) {
    prompt += `\n- Include an FAQ section`;
  }

  if (config.geoOptimize) {
    prompt += `\n- Structure content for AI citation with bold key facts
- Use clear, citable statements
- Include structured data-friendly formatting`;
  }

  prompt += `\n- Generate a meta description under 160 characters
- Return as JSON with: title, content, metaDescription, keywords`;

  return prompt;
}

/**
 * Generate a changelog from git commits
 */
export async function generateChangelog(
  config: ChangelogConfig,
  options: ContentGeneratorOptions = {}
): Promise<ChangelogResult> {
  const exec = options.exec;

  if (!exec) {
    return {
      content: '',
      sections: {},
    };
  }

  try {
    const result = await exec(
      `git log ${config.fromRef}..${config.toRef} --pretty=format:"%s"`
    );

    const commits = result.stdout.trim().split('\n').filter(Boolean);

    if (commits.length === 0) {
      return {
        content: '',
        sections: {},
      };
    }

    const sections = categorizeCommits(commits);
    const content = formatChangelog(sections, config);
    const version = extractVersion(config.toRef);

    return {
      content,
      version,
      date: new Date().toISOString().split('T')[0],
      sections,
      metaDescription: config.seoKeywords
        ? `Release notes including ${config.seoKeywords.join(', ')}`
        : undefined,
    };
  } catch (error) {
    return {
      content: '',
      sections: {},
    };
  }
}

/**
 * Categorize commits by conventional commit type
 */
function categorizeCommits(commits: string[]): ChangelogResult['sections'] {
  const sections: ChangelogResult['sections'] = {
    features: [],
    fixes: [],
    breaking: [],
    docs: [],
    other: [],
  };

  for (const commit of commits) {
    const lowerCommit = commit.toLowerCase();

    if (lowerCommit.startsWith('feat')) {
      sections.features!.push(commit);
    } else if (lowerCommit.startsWith('fix')) {
      sections.fixes!.push(commit);
    } else if (lowerCommit.includes('breaking') || lowerCommit.startsWith('!')) {
      sections.breaking!.push(commit);
    } else if (lowerCommit.startsWith('docs')) {
      sections.docs!.push(commit);
    } else {
      sections.other!.push(commit);
    }
  }

  // Remove empty sections
  for (const key of Object.keys(sections) as Array<keyof typeof sections>) {
    if (sections[key]?.length === 0) {
      delete sections[key];
    }
  }

  return sections;
}

/**
 * Format changelog sections into markdown
 */
function formatChangelog(
  sections: ChangelogResult['sections'],
  config: ChangelogConfig
): string {
  const lines: string[] = [];

  if (sections.breaking && sections.breaking.length > 0) {
    lines.push('## ⚠️ Breaking Changes\n');
    for (const commit of sections.breaking) {
      lines.push(`- ${commit}`);
    }
    lines.push('');
  }

  if (sections.features && sections.features.length > 0) {
    lines.push('## ✨ Features\n');
    for (const commit of sections.features) {
      lines.push(`- ${commit}`);
    }
    lines.push('');
  }

  if (sections.fixes && sections.fixes.length > 0) {
    lines.push('## 🐛 Bug Fixes\n');
    for (const commit of sections.fixes) {
      lines.push(`- ${commit}`);
    }
    lines.push('');
  }

  if (sections.docs && sections.docs.length > 0) {
    lines.push('## 📚 Documentation\n');
    for (const commit of sections.docs) {
      lines.push(`- ${commit}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Extract version from git ref
 */
function extractVersion(ref: string): string | undefined {
  const match = ref.match(/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : undefined;
}

/**
 * Optimize a README file for SEO
 */
export async function optimizeReadme(
  config: ReadmeConfig,
  options: ContentGeneratorOptions = {}
): Promise<ReadmeResult> {
  const llm = options.llm;

  if (!llm) {
    return {
      content: config.currentContent,
      suggestions: ['LLM function not provided'],
    };
  }

  try {
    const prompt = buildReadmePrompt(config);
    const result = await llm(prompt);

    return {
      content: result.content || config.currentContent,
      metaDescription: result.metaDescription,
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    return {
      content: config.currentContent,
      suggestions: ['Error optimizing README'],
    };
  }
}

/**
 * Build the prompt for README optimization
 */
function buildReadmePrompt(config: ReadmeConfig): string {
  let prompt = `Optimize this README for SEO and developer experience.

Project Name: ${config.projectName}

Current README:
${config.currentContent || '(empty)'}

Requirements:
- Add standard sections if missing (Installation, Usage, License)
- Make description SEO-friendly`;

  if (config.keywords && config.keywords.length > 0) {
    prompt += `\n- Include keywords: ${config.keywords.join(', ')}`;
  }

  if (config.preserveCustomSections) {
    prompt += `\n- Preserve existing custom sections`;
  }

  prompt += `\n- Suggest improvements
- Return as JSON with: content, metaDescription, suggestions`;

  return prompt;
}

/**
 * Score content for SEO quality
 */
export function scoreContentSEO(
  content: string,
  options: { targetKeywords?: string[] } = {}
): SEOScore {
  const headingScore = scoreHeadings(content);
  const keywordScore = scoreKeywords(content, options.targetKeywords || []);
  const lengthScore = scoreLength(content);
  const linkScore = scoreLinks(content);
  const mediaScore = scoreMedia(content);

  const overall = Math.round(
    headingScore * 0.2 +
    keywordScore * 0.25 +
    lengthScore * 0.25 +
    linkScore * 0.15 +
    mediaScore * 0.15
  );

  return {
    overall,
    headingScore,
    keywordScore,
    lengthScore,
    linkScore,
    mediaScore,
  };
}

/**
 * Score heading structure
 */
function scoreHeadings(content: string): number {
  let score = 0;

  // Check for H1
  if (content.match(/^#\s+/m)) {
    score += 40;
  }

  // Check for H2s
  const h2Count = (content.match(/^##\s+/gm) || []).length;
  if (h2Count >= 1) score += 20;
  if (h2Count >= 2) score += 20;

  // Check for proper hierarchy (H1 before H2)
  const h1Index = content.search(/^#\s+/m);
  const h2Index = content.search(/^##\s+/m);
  if (h1Index !== -1 && (h2Index === -1 || h1Index < h2Index)) {
    score += 20;
  }

  return Math.min(100, score);
}

/**
 * Score keyword usage
 */
function scoreKeywords(content: string, keywords: string[]): number {
  if (keywords.length === 0) {
    return 50; // Neutral score if no keywords specified
  }

  const lowerContent = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;
  let score = 0;

  for (const keyword of keywords) {
    const regex = new RegExp(keyword.toLowerCase(), 'gi');
    const matches = lowerContent.match(regex) || [];
    const density = (matches.length / wordCount) * 100;

    // Ideal keyword density is 1-3%
    if (density >= 0.5 && density <= 3) {
      score += 100 / keywords.length;
    } else if (density > 0 && density < 0.5) {
      score += 50 / keywords.length;
    } else if (density > 3) {
      score += 30 / keywords.length; // Keyword stuffing penalty
    }
  }

  return Math.min(100, Math.round(score));
}

/**
 * Score content length
 */
function scoreLength(content: string): number {
  const wordCount = content.split(/\s+/).length;

  // Ideal blog post length: 1500-2500 words
  // Minimum effective: 300 words
  if (wordCount < 100) return 10;
  if (wordCount < 300) return 30;
  if (wordCount < 500) return 50;
  if (wordCount < 1000) return 70;
  if (wordCount < 1500) return 85;
  if (wordCount <= 2500) return 100;
  return 90; // Slightly penalize very long content
}

/**
 * Score internal links
 */
function scoreLinks(content: string): number {
  // Match markdown links
  const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  const internalLinks = links.filter(link => {
    const url = link.match(/\]\(([^)]+)\)/)?.[1] || '';
    return url.startsWith('/') || url.startsWith('#') || url.startsWith('./');
  });

  if (internalLinks.length === 0) return 20;
  if (internalLinks.length === 1) return 50;
  if (internalLinks.length === 2) return 75;
  return 100;
}

/**
 * Score media usage (images with alt text)
 */
function scoreMedia(content: string): number {
  // Match markdown images with alt text
  const images = content.match(/!\[([^\]]+)\]\(([^)]+)\)/g) || [];
  const imagesWithAlt = images.filter(img => {
    const alt = img.match(/!\[([^\]]+)\]/)?.[1] || '';
    return alt.length > 0;
  });

  if (images.length === 0) return 30; // No images
  if (imagesWithAlt.length === 0) return 10; // Images without alt
  if (imagesWithAlt.length < images.length) return 50; // Some missing alt
  return 100; // All images have alt text
}
