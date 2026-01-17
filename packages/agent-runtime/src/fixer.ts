import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SEOIssue, Fix, FrameworkInfo } from './types.js';
import { detectFramework, findHtmlEntry, readFile } from './tools/files.js';
import { generateH1Fix } from './tools/h1-fixer.js';

export interface FixGeneratorOptions {
  cwd: string;
  url?: string;
  framework?: FrameworkInfo;
}

export interface GeneratedFix extends Fix {
  applied?: boolean;
  skipped?: boolean;
  skipReason?: string;
}

// Generate fixes for SEO issues based on framework
export async function generateFixes(
  issues: SEOIssue[],
  options: FixGeneratorOptions
): Promise<GeneratedFix[]> {
  const { cwd, url } = options;

  // Detect framework if not provided
  let framework = options.framework;
  if (!framework) {
    const result = await detectFramework({ cwd });
    framework = result.success ? (result.data as FrameworkInfo) : { name: 'Unknown', metaPattern: 'html-head' as const };
  }

  const fixes: GeneratedFix[] = [];

  // Find the HTML entry point for Vite/React apps
  const htmlEntry = await findHtmlEntry({ cwd });
  const htmlPath = htmlEntry.success ? (htmlEntry.data as { path: string; content: string }).path : 'index.html';
  const htmlContent = htmlEntry.success ? (htmlEntry.data as { path: string; content: string }).content : '';

  for (const issue of issues) {
    const fix = await generateFixForIssue(issue, {
      cwd,
      url,
      framework,
      htmlPath,
      htmlContent,
    });

    if (fix) {
      fixes.push(fix);
    }
  }

  return fixes;
}

interface FixContext {
  cwd: string;
  url?: string;
  framework: FrameworkInfo;
  htmlPath: string;
  htmlContent: string;
}

async function generateFixForIssue(
  issue: SEOIssue,
  context: FixContext
): Promise<GeneratedFix | null> {
  const { cwd, url, framework, htmlPath, htmlContent } = context;
  const fullUrl = url || 'https://example.com';
  const siteName = new URL(fullUrl).hostname.replace('www.', '');

  switch (issue.code) {
    case 'MISSING_TITLE':
      return generateTitleFix(context, siteName);

    case 'MISSING_META_DESC':
      return generateMetaDescFix(context, siteName);

    case 'MISSING_CANONICAL':
      return generateCanonicalFix(context, fullUrl);

    case 'MISSING_VIEWPORT':
      return generateViewportFix(context);

    case 'MISSING_OG_TAGS':
      return generateOGFix(context, siteName, fullUrl);

    case 'MISSING_TWITTER_CARD':
      return generateTwitterFix(context, siteName);

    case 'MISSING_SCHEMA':
      return generateSchemaFix(context, siteName, fullUrl);

    case 'MISSING_ROBOTS':
      return generateRobotsFix(context, fullUrl);

    case 'MISSING_SITEMAP':
      return generateSitemapFix(context, fullUrl);

    case 'MISSING_H1':
      return await generateH1Fix({ cwd });

    default:
      return null;
  }
}

function generateTitleFix(context: FixContext, siteName: string): GeneratedFix {
  const { htmlPath, htmlContent, framework } = context;

  if (framework.metaPattern === 'html-head') {
    // Vite/React - modify index.html
    const titleTag = `<title>${siteName} - Your Product Tagline</title>`;

    if (htmlContent.includes('<title>')) {
      // Replace existing title
      const before = htmlContent.match(/<title>.*?<\/title>/)?.[0] || '';
      return {
        issue: { code: 'MISSING_TITLE', message: 'Missing or empty title tag', severity: 'critical' },
        file: htmlPath,
        before,
        after: titleTag,
        explanation: 'Updated the title tag with a descriptive title',
      };
    } else {
      // Add title after <head>
      return {
        issue: { code: 'MISSING_TITLE', message: 'Missing title tag', severity: 'critical' },
        file: htmlPath,
        before: '<head>',
        after: `<head>\n    ${titleTag}`,
        explanation: 'Added a title tag to the document head',
      };
    }
  }

  // For other frameworks, provide guidance
  return {
    issue: { code: 'MISSING_TITLE', message: 'Missing title tag', severity: 'critical' },
    file: htmlPath,
    before: null,
    after: `<title>${siteName} - Your Product Tagline</title>`,
    explanation: `Add title using ${framework.name} patterns`,
  };
}

function generateMetaDescFix(context: FixContext, siteName: string): GeneratedFix {
  const { htmlPath, htmlContent, framework } = context;
  const description = `${siteName} - A brief, compelling description of your product or service. Include key features and benefits.`;

  if (framework.metaPattern === 'html-head') {
    const metaTag = `<meta name="description" content="${description}" />`;

    if (htmlContent.includes('<title>')) {
      return {
        issue: { code: 'MISSING_META_DESC', message: 'Missing meta description', severity: 'critical' },
        file: htmlPath,
        before: '</title>',
        after: `</title>\n    ${metaTag}`,
        explanation: 'Added meta description after the title tag',
      };
    } else {
      return {
        issue: { code: 'MISSING_META_DESC', message: 'Missing meta description', severity: 'critical' },
        file: htmlPath,
        before: '<head>',
        after: `<head>\n    ${metaTag}`,
        explanation: 'Added meta description to the document head',
      };
    }
  }

  return {
    issue: { code: 'MISSING_META_DESC', message: 'Missing meta description', severity: 'critical' },
    file: htmlPath,
    before: null,
    after: `<meta name="description" content="${description}" />`,
    explanation: `Add meta description using ${framework.name} patterns`,
  };
}

function generateCanonicalFix(context: FixContext, url: string): GeneratedFix {
  const { htmlPath, htmlContent, framework } = context;
  const canonicalTag = `<link rel="canonical" href="${url}" />`;

  // Check if canonical already exists
  if (htmlContent.includes('rel="canonical"') || htmlContent.includes("rel='canonical'")) {
    return {
      issue: { code: 'MISSING_CANONICAL', message: 'No canonical URL specified', severity: 'warning' },
      file: htmlPath,
      before: null,
      after: canonicalTag,
      explanation: 'Canonical URL already exists',
      skipped: true,
      skipReason: 'Canonical tag already present',
    };
  }

  if (framework.metaPattern === 'html-head') {
    return {
      issue: { code: 'MISSING_CANONICAL', message: 'No canonical URL specified', severity: 'warning' },
      file: htmlPath,
      before: '</head>',
      after: `    ${canonicalTag}\n  </head>`,
      explanation: 'Added canonical URL to prevent duplicate content issues',
    };
  }

  return {
    issue: { code: 'MISSING_CANONICAL', message: 'No canonical URL specified', severity: 'warning' },
    file: htmlPath,
    before: null,
    after: canonicalTag,
    explanation: `Add canonical URL using ${framework.name} patterns`,
  };
}

function generateViewportFix(context: FixContext): GeneratedFix {
  const { htmlPath, htmlContent, framework } = context;
  const viewportTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';

  if (framework.metaPattern === 'html-head' && !htmlContent.includes('viewport')) {
    return {
      issue: { code: 'MISSING_VIEWPORT', message: 'Missing viewport meta tag', severity: 'critical' },
      file: htmlPath,
      before: '<head>',
      after: `<head>\n    ${viewportTag}`,
      explanation: 'Added viewport meta tag for mobile responsiveness',
    };
  }

  return {
    issue: { code: 'MISSING_VIEWPORT', message: 'Missing viewport meta tag', severity: 'critical' },
    file: htmlPath,
    before: null,
    after: viewportTag,
    explanation: 'Add viewport meta tag for mobile-first indexing',
  };
}

function generateOGFix(context: FixContext, siteName: string, url: string): GeneratedFix {
  const { htmlPath, htmlContent } = context;

  // Check which OG tags are missing
  const missingTags: string[] = [];
  if (!htmlContent.includes('og:image')) {
    missingTags.push(`<meta property="og:image" content="${url}/og-image.png" />`);
  }
  if (!htmlContent.includes('og:url')) {
    missingTags.push(`<meta property="og:url" content="${url}" />`);
  }

  if (missingTags.length === 0) {
    return {
      issue: { code: 'MISSING_OG_TAGS', message: 'Missing Open Graph tags', severity: 'warning' },
      file: htmlPath,
      before: null,
      after: '',
      explanation: 'All essential OG tags are present',
      skipped: true,
      skipReason: 'OG tags already exist',
    };
  }

  const ogTags = `<!-- SEO Autopilot: Missing OG tags -->\n    ${missingTags.join('\n    ')}`;

  return {
    issue: { code: 'MISSING_OG_TAGS', message: 'Missing Open Graph tags', severity: 'warning' },
    file: htmlPath,
    before: '</head>',
    after: `    ${ogTags}\n  </head>`,
    explanation: `Added missing Open Graph meta tags: ${missingTags.length} tag(s)`,
  };
}

function generateTwitterFix(context: FixContext, siteName: string): GeneratedFix {
  const { htmlPath } = context;

  const twitterTags = `<!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${siteName} - Your Product Tagline" />
    <meta name="twitter:description" content="A compelling description for Twitter sharing." />
    <meta name="twitter:image" content="/og-image.png" />`;

  return {
    issue: { code: 'MISSING_TWITTER_CARD', message: 'Missing Twitter Card meta tags', severity: 'info' },
    file: htmlPath,
    before: '</head>',
    after: `    ${twitterTags}\n  </head>`,
    explanation: 'Added Twitter Card meta tags for better X/Twitter sharing',
  };
}

function generateSchemaFix(context: FixContext, siteName: string, url: string): GeneratedFix {
  const { htmlPath, framework } = context;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': siteName,
    'url': url,
    'applicationCategory': 'WebApplication',
    'operatingSystem': 'Web Browser',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD',
    },
  };

  const schemaScript = `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
    </script>`;

  return {
    issue: { code: 'MISSING_SCHEMA', message: 'No JSON-LD structured data found', severity: 'warning' },
    file: htmlPath,
    before: '</head>',
    after: `    ${schemaScript}\n  </head>`,
    explanation: 'Added JSON-LD structured data for rich search results',
  };
}

function generateRobotsFix(context: FixContext, url: string): GeneratedFix {
  const robotsTxt = `# robots.txt for ${new URL(url).hostname}
User-agent: *
Allow: /

# Sitemap
Sitemap: ${url}/sitemap.xml`;

  return {
    issue: { code: 'MISSING_ROBOTS', message: 'No robots.txt file found', severity: 'warning' },
    file: 'public/robots.txt',
    before: null,
    after: robotsTxt,
    explanation: 'Created robots.txt to provide crawling instructions to search engines',
  };
}

function generateSitemapFix(context: FixContext, url: string): GeneratedFix {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;

  return {
    issue: { code: 'MISSING_SITEMAP', message: 'No sitemap.xml found', severity: 'warning' },
    file: 'public/sitemap.xml',
    before: null,
    after: sitemap,
    explanation: 'Created sitemap.xml to help search engines discover all pages',
  };
}

// Apply fixes to the codebase
export async function applyFixes(
  fixes: GeneratedFix[],
  options: { cwd: string; dryRun?: boolean }
): Promise<{ applied: GeneratedFix[]; skipped: GeneratedFix[] }> {
  const { cwd, dryRun = false } = options;
  const applied: GeneratedFix[] = [];
  const skipped: GeneratedFix[] = [];

  for (const fix of fixes) {
    if (fix.skipped) {
      skipped.push(fix);
      continue;
    }

    try {
      const filePath = join(cwd, fix.file);

      if (dryRun) {
        applied.push({ ...fix, applied: false });
        continue;
      }

      if (fix.before === null) {
        // Create new file
        const dir = join(cwd, fix.file.split('/').slice(0, -1).join('/'));
        if (dir !== cwd && !existsSync(dir)) {
          const { mkdirSync } = await import('fs');
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, fix.after, 'utf-8');
        applied.push({ ...fix, applied: true });
      } else if (existsSync(filePath)) {
        // Modify existing file
        let content = readFileSync(filePath, 'utf-8');
        if (content.includes(fix.before)) {
          content = content.replace(fix.before, fix.after);
          writeFileSync(filePath, content, 'utf-8');
          applied.push({ ...fix, applied: true });
        } else {
          skipped.push({ ...fix, skipped: true, skipReason: 'Pattern not found in file' });
        }
      } else {
        skipped.push({ ...fix, skipped: true, skipReason: 'File not found' });
      }
    } catch (error) {
      skipped.push({
        ...fix,
        skipped: true,
        skipReason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { applied, skipped };
}
