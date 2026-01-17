import { crawlUrl, extractMeta, analyzeHeadings, extractImages, extractLinks, extractSchema, checkRobots, checkSitemap } from './crawl.js';
import type { SEOIssue, SEOAnalysisResult, MetaData, HeadingStructure, ImageInfo, ToolResult } from '../types.js';

export async function analyzeUrl(params: { url: string }): Promise<ToolResult> {
  const { url } = params;
  const issues: SEOIssue[] = [];

  try {
    // Crawl the page
    const crawlResult = await crawlUrl({ url });
    if (!crawlResult.success || !crawlResult.data) {
      return { success: false, error: `Failed to crawl URL: ${crawlResult.error}` };
    }

    const { html, statusCode, loadTime } = crawlResult.data as { html: string; statusCode: number; loadTime: number };

    if (statusCode !== 200) {
      issues.push({
        severity: 'critical',
        category: 'technical',
        code: 'HTTP_ERROR',
        message: `Page returned HTTP ${statusCode}`,
        impact: 'Search engines cannot index pages that return error codes',
      });
    }

    // Extract meta tags
    const metaResult = await extractMeta({ html, url });
    if (metaResult.success && metaResult.data) {
      const meta = metaResult.data as MetaData;
      analyzeMeta(meta, url, issues);
    }

    // Analyze headings
    const headingsResult = await analyzeHeadings({ html });
    if (headingsResult.success && headingsResult.data) {
      const headings = headingsResult.data as HeadingStructure[];
      analyzeHeadingStructure(headings, issues);
    }

    // Extract and analyze images
    const imagesResult = await extractImages({ html });
    if (imagesResult.success && imagesResult.data) {
      const images = imagesResult.data as ImageInfo[];
      analyzeImages(images, issues);
    }

    // Extract schema
    const schemaResult = await extractSchema({ html });
    if (schemaResult.success) {
      const schemas = schemaResult.data as { type: string; data: unknown }[];
      if (!schemas || schemas.length === 0) {
        issues.push({
          severity: 'warning',
          category: 'schema',
          code: 'MISSING_SCHEMA',
          message: 'No JSON-LD structured data found',
          impact: 'Missing rich snippets in search results. Add Schema.org markup for your content type.',
        });
      }
    }

    // Check robots.txt
    const robotsResult = await checkRobots({ url });
    if (robotsResult.success) {
      const robots = robotsResult.data as { exists: boolean };
      if (!robots.exists) {
        issues.push({
          severity: 'warning',
          category: 'technical',
          code: 'MISSING_ROBOTS',
          message: 'No robots.txt file found',
          impact: 'Provide crawling instructions to search engines with robots.txt',
        });
      }
    }

    // Check sitemap
    const sitemapResult = await checkSitemap({ url });
    if (sitemapResult.success) {
      const sitemap = sitemapResult.data as { exists: boolean };
      if (!sitemap.exists) {
        issues.push({
          severity: 'warning',
          category: 'technical',
          code: 'MISSING_SITEMAP',
          message: 'No sitemap.xml found',
          impact: 'Sitemap helps search engines discover and index all your pages',
        });
      }
    }

    // Performance check
    if (loadTime > 3000) {
      issues.push({
        severity: loadTime > 5000 ? 'critical' : 'warning',
        category: 'performance',
        code: 'SLOW_LOAD_TIME',
        message: `Page load time is ${(loadTime / 1000).toFixed(1)}s`,
        impact: 'Slow pages hurt user experience and search rankings. Target <2.5s LCP.',
      });
    }

    // Calculate score
    const score = calculateScore(issues);

    const result: SEOAnalysisResult = {
      url,
      score,
      issues,
      recommendations: generateRecommendations(issues),
    };

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

function analyzeMeta(meta: MetaData, url: string, issues: SEOIssue[]): void {
  // Title
  if (!meta.title) {
    issues.push({
      severity: 'critical',
      category: 'meta',
      code: 'MISSING_TITLE',
      message: 'Missing title tag',
      impact: 'Title is the most important on-page SEO element. Every page needs a unique title.',
      fix: {
        file: 'index.html',
        before: null,
        after: '<title>Your Page Title - Brand Name</title>',
      }
    });
  } else if (meta.title.length < 30) {
    issues.push({
      severity: 'warning',
      category: 'meta',
      code: 'TITLE_TOO_SHORT',
      message: `Title too short (${meta.title.length} chars)`,
      impact: 'Longer titles provide more context. Aim for 50-60 characters.',
      element: meta.title,
    });
  } else if (meta.title.length > 60) {
    issues.push({
      severity: 'warning',
      category: 'meta',
      code: 'TITLE_TOO_LONG',
      message: `Title too long (${meta.title.length} chars)`,
      impact: 'Titles over 60 characters get truncated in search results.',
      element: meta.title.substring(0, 60) + '...',
    });
  }

  // Meta description
  if (!meta.description) {
    issues.push({
      severity: 'critical',
      category: 'meta',
      code: 'MISSING_META_DESC',
      message: 'Missing meta description',
      impact: 'Meta description appears in search results and affects click-through rate.',
      fix: {
        file: 'index.html',
        before: null,
        after: '<meta name="description" content="A compelling description of your page in 150-160 characters." />',
      }
    });
  } else if (meta.description.length < 120) {
    issues.push({
      severity: 'warning',
      category: 'meta',
      code: 'META_DESC_TOO_SHORT',
      message: `Meta description too short (${meta.description.length} chars)`,
      impact: 'Aim for 150-160 characters for optimal display in search results.',
    });
  } else if (meta.description.length > 160) {
    issues.push({
      severity: 'info',
      category: 'meta',
      code: 'META_DESC_TOO_LONG',
      message: `Meta description may be truncated (${meta.description.length} chars)`,
      impact: 'Descriptions over 160 characters may be cut off in search results.',
    });
  }

  // Canonical URL
  if (!meta.canonical) {
    issues.push({
      severity: 'warning',
      category: 'technical',
      code: 'MISSING_CANONICAL',
      message: 'No canonical URL specified',
      impact: 'Canonical tags prevent duplicate content issues.',
      fix: {
        file: 'index.html',
        before: null,
        after: `<link rel="canonical" href="${url}" />`,
      }
    });
  }

  // Viewport
  if (!meta.viewport) {
    issues.push({
      severity: 'critical',
      category: 'technical',
      code: 'MISSING_VIEWPORT',
      message: 'Missing viewport meta tag',
      impact: 'Required for mobile-friendly pages. Google uses mobile-first indexing.',
      fix: {
        file: 'index.html',
        before: null,
        after: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      }
    });
  }

  // Open Graph
  const missingOG: string[] = [];
  if (!meta.openGraph.title) missingOG.push('og:title');
  if (!meta.openGraph.description) missingOG.push('og:description');
  if (!meta.openGraph.image) missingOG.push('og:image');

  if (missingOG.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'social',
      code: 'MISSING_OG_TAGS',
      message: `Missing Open Graph tags: ${missingOG.join(', ')}`,
      impact: 'Open Graph tags control how your page appears when shared on social media.',
    });
  }

  // Twitter Card
  if (!meta.twitter.card) {
    issues.push({
      severity: 'info',
      category: 'social',
      code: 'MISSING_TWITTER_CARD',
      message: 'Missing Twitter Card meta tags',
      impact: 'Twitter/X cards improve visibility when your content is shared.',
    });
  }
}

function analyzeHeadingStructure(headings: HeadingStructure[], issues: SEOIssue[]): void {
  const h1s = headings.filter(h => h.level === 1);

  if (h1s.length === 0) {
    issues.push({
      severity: 'critical',
      category: 'content',
      code: 'MISSING_H1',
      message: 'No H1 heading found',
      impact: 'Every page should have exactly one H1 that describes the main content.',
    });
  } else if (h1s.length > 1) {
    issues.push({
      severity: 'warning',
      category: 'content',
      code: 'MULTIPLE_H1',
      message: `Multiple H1 headings found (${h1s.length})`,
      impact: 'Best practice is one H1 per page. Use H2-H6 for subsections.',
      element: h1s.map(h => h.text).join(', '),
    });
  }

  // Check for skipped heading levels
  let prevLevel = 0;
  for (const h of headings) {
    if (h.level > prevLevel + 1 && prevLevel > 0) {
      issues.push({
        severity: 'info',
        category: 'content',
        code: 'SKIPPED_HEADING_LEVEL',
        message: `Skipped heading level: H${prevLevel} to H${h.level}`,
        impact: 'Maintain proper heading hierarchy for accessibility and SEO.',
      });
      break; // Only report once
    }
    prevLevel = h.level;
  }
}

function analyzeImages(images: ImageInfo[], issues: SEOIssue[]): void {
  const missingAlt = images.filter(img => !img.alt);

  if (missingAlt.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'accessibility',
      code: 'IMAGES_MISSING_ALT',
      message: `${missingAlt.length} image(s) missing alt text`,
      impact: 'Alt text is essential for accessibility and helps search engines understand images.',
      element: missingAlt.slice(0, 3).map(i => i.src).join(', '),
    });
  }

  const missingDimensions = images.filter(img => !img.width || !img.height);
  if (missingDimensions.length > 0) {
    issues.push({
      severity: 'info',
      category: 'performance',
      code: 'IMAGES_MISSING_DIMENSIONS',
      message: `${missingDimensions.length} image(s) missing width/height`,
      impact: 'Specifying dimensions prevents layout shift (CLS).',
    });
  }
}

function calculateScore(issues: SEOIssue[]): number {
  const weights = {
    critical: 15,
    warning: 5,
    info: 1,
  };

  let totalDeduction = 0;
  for (const issue of issues) {
    totalDeduction += weights[issue.severity];
  }

  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

function generateRecommendations(issues: SEOIssue[]) {
  const recommendations = [];

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  if (criticalCount > 0) {
    recommendations.push({
      priority: 'high' as const,
      category: 'immediate',
      message: `Fix ${criticalCount} critical issue(s) first`,
      impact: 'Critical issues directly impact search visibility',
    });
  }

  if (issues.some(i => i.code === 'MISSING_SCHEMA')) {
    recommendations.push({
      priority: 'high' as const,
      category: 'schema',
      message: 'Add JSON-LD structured data',
      impact: 'Enable rich snippets in search results',
    });
  }

  if (issues.some(i => i.code.includes('OG') || i.code.includes('TWITTER'))) {
    recommendations.push({
      priority: 'medium' as const,
      category: 'social',
      message: 'Complete social media meta tags',
      impact: 'Improve appearance when shared on social platforms',
    });
  }

  if (warningCount > 3) {
    recommendations.push({
      priority: 'medium' as const,
      category: 'optimization',
      message: `Address ${warningCount} warnings to improve score`,
      impact: 'Each fix improves overall SEO health',
    });
  }

  return recommendations;
}
