/**
 * llms.txt Check
 *
 * llms.txt is a proposed standard (https://llmstxt.org/) for providing
 * context to Large Language Models about a website.
 *
 * The file is a Markdown document at /llms.txt that contains:
 * - Brief description of the site/organization
 * - Links to important pages
 * - Optional detailed content at /llms-full.txt
 *
 * Format:
 * # Site Name
 * > Brief description
 *
 * ## Section
 * - [Link Text](url): Description
 */

import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface LlmsTxtData {
  exists: boolean;
  fullVersionExists: boolean;
  content?: string;
  structure: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasSections: boolean;
    hasLinks: boolean;
    linkCount: number;
  };
  contentLength: number;
  brokenLinks?: string[];
}

// Bounds how many links we probe per audit - llms.txt files are meant to be
// short curated indexes, not full sitemaps, so this should never legitimately
// truncate a well-formed file.
const MAX_LINKS_TO_CHECK = 20;

export function extractLlmsTxtLinks(content: string, baseUrl: string): string[] {
  const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  const urls: string[] = [];
  for (const match of linkMatches) {
    try {
      const resolved = new URL(match[2], baseUrl);
      // Skip mailto:, tel:, etc - only http(s) links are worth link-checking.
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        urls.push(resolved.href);
      }
    } catch {
      // Malformed link - skip.
    }
  }
  return urls;
}

async function findBrokenLinks(urls: string[]): Promise<string[]> {
  const toCheck = urls.slice(0, MAX_LINKS_TO_CHECK);
  const results = await Promise.all(
    toCheck.map(async (linkUrl) => {
      try {
        const response = await httpGet<string>(linkUrl, {
          timeout: 8000,
          validateStatus: () => true,
        });
        return response.status >= 400 ? linkUrl : null;
      } catch {
        return linkUrl;
      }
    })
  );
  return results.filter((url): url is string => url !== null);
}

export async function analyzeLlmsTxt(
  url: string
): Promise<{ issues: AuditIssue[]; data: LlmsTxtData }> {
  const issues: AuditIssue[] = [];
  const parsedUrl = new URL(url);
  const baseUrl = parsedUrl.origin;

  // Check for llms.txt
  const llmsTxtUrl = new URL('/llms.txt', baseUrl).href;
  const llmsFullUrl = new URL('/llms-full.txt', baseUrl).href;

  let exists = false;
  let fullVersionExists = false;
  let content: string | undefined;
  let structure = {
    hasTitle: false,
    hasDescription: false,
    hasSections: false,
    hasLinks: false,
    linkCount: 0,
  };
  let contentLength = 0;
  let brokenLinks: string[] = [];

  try {
    // Check main llms.txt
    const response = await httpGet<string>(llmsTxtUrl, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 200) {
      exists = true;
      content = response.data as string;
      contentLength = content.length;
      structure = analyzeStructure(content);
    }

    // Check for full version
    const fullResponse = await httpGet<string>(llmsFullUrl, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (fullResponse.status === 200) {
      fullVersionExists = true;
    }
  } catch {
    // Network error, treat as not existing
  }

  // Generate issues
  if (!exists) {
    issues.push({
      code: 'AI_NO_LLMS_TXT',
      severity: 'notice',
      category: 'ai-readiness',
      title: 'No llms.txt file found',
      description: 'llms.txt is a proposed standard for providing context to LLMs about your website. Having one helps AI systems better understand and represent your site.',
      impact: 'AI systems may have less context about your site, potentially leading to less accurate representations.',
      howToFix: 'Create an /llms.txt file with a Markdown description of your site. Include: site name, brief description, and links to key pages. See https://llmstxt.org/ for the specification.',
      affectedUrls: [llmsTxtUrl],
      details: {
        specification: 'https://llmstxt.org/',
        exampleFormat: `# Site Name

> Brief description of your site

## About
- [About Us](/about): Learn more about our company

## Products
- [Product A](/products/a): Description of product A
- [Product B](/products/b): Description of product B

## Documentation
- [Docs](/docs): Full documentation`,
      },
    });
  } else {
    // Check structure quality
    if (!structure.hasTitle) {
      issues.push({
        code: 'AI_LLMS_TXT_NO_TITLE',
        severity: 'notice',
        category: 'ai-readiness',
        title: 'llms.txt missing title heading',
        description: 'Your llms.txt file should start with a # heading containing your site/organization name.',
        impact: 'LLMs may not properly identify your site.',
        howToFix: 'Add a title heading at the top: # Your Site Name',
        affectedUrls: [llmsTxtUrl],
      });
    }

    if (!structure.hasDescription) {
      issues.push({
        code: 'AI_LLMS_TXT_NO_DESCRIPTION',
        severity: 'notice',
        category: 'ai-readiness',
        title: 'llms.txt missing description',
        description: 'Your llms.txt should include a brief description (blockquote starting with >) explaining what your site/organization does.',
        impact: 'LLMs may not understand your site\'s purpose.',
        howToFix: 'Add a description blockquote after the title: > Brief description of your site',
        affectedUrls: [llmsTxtUrl],
      });
    }

    if (!structure.hasLinks || structure.linkCount < 3) {
      issues.push({
        code: 'AI_LLMS_TXT_FEW_LINKS',
        severity: 'notice',
        category: 'ai-readiness',
        title: 'llms.txt has few navigation links',
        description: `Your llms.txt only has ${structure.linkCount} link(s). Include links to your most important pages to help LLMs navigate your content.`,
        impact: 'LLMs may miss important content on your site.',
        howToFix: 'Add more links in Markdown format: - [Page Title](/path): Brief description',
        affectedUrls: [llmsTxtUrl],
      });
    }

    if (contentLength < 200) {
      issues.push({
        code: 'AI_LLMS_TXT_TOO_SHORT',
        severity: 'notice',
        category: 'ai-readiness',
        title: 'llms.txt content is very short',
        description: `Your llms.txt is only ${contentLength} characters. Consider adding more context about your site.`,
        impact: 'LLMs may not have enough context to properly represent your site.',
        howToFix: 'Expand your llms.txt with more sections, descriptions, and links to key content.',
        affectedUrls: [llmsTxtUrl],
      });
    }

    if (structure.hasLinks && content) {
      brokenLinks = await findBrokenLinks(extractLlmsTxtLinks(content, baseUrl));
      if (brokenLinks.length > 0) {
        issues.push({
          code: 'AI_LLMS_TXT_BROKEN_LINKS',
          severity: 'warning',
          category: 'ai-readiness',
          title: 'llms.txt links to broken pages',
          description: `${brokenLinks.length} of the links in your llms.txt return an error or don't resolve: ${brokenLinks.slice(0, 5).join(', ')}${brokenLinks.length > 5 ? ', ...' : ''}`,
          impact: 'LLMs following these links to understand your site will hit dead ends, undermining the whole point of curating this file.',
          howToFix: 'Fix or remove the broken links so llms.txt stays an accurate, trustworthy index of your content.',
          affectedUrls: brokenLinks,
        });
      }
    }
  }

  return {
    issues,
    data: {
      exists,
      fullVersionExists,
      content: content?.substring(0, 1000), // Truncate for data
      structure,
      contentLength,
      ...(brokenLinks.length > 0 ? { brokenLinks } : {}),
    },
  };
}

function analyzeStructure(content: string): LlmsTxtData['structure'] {
  const lines = content.split('\n');

  let hasTitle = false;
  let hasDescription = false;
  let hasSections = false;
  let hasLinks = false;
  let linkCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for title (# heading at start)
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      hasTitle = true;
    }

    // Check for description (blockquote)
    if (trimmed.startsWith('>')) {
      hasDescription = true;
    }

    // Check for sections (## headings)
    if (trimmed.startsWith('## ')) {
      hasSections = true;
    }

    // Check for Markdown links
    const linkMatches = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (linkMatches) {
      hasLinks = true;
      linkCount += linkMatches.length;
    }
  }

  return {
    hasTitle,
    hasDescription,
    hasSections,
    hasLinks,
    linkCount,
  };
}
