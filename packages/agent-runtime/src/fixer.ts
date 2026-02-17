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
    // Title issues
    case 'MISSING_TITLE':
    case 'TITLE_MISSING':  // Full audit code
    case 'TITLE_KEYWORD_MISMATCH':
    case 'TITLE_H1_KEYWORD_MISMATCH':
    case 'OUTDATED_YEAR_IN_TITLE':
      return generateTitleFix(context, siteName);

    // Meta description issues
    case 'MISSING_META_DESC':
    case 'META_DESC_MISSING':  // Full audit code
      return generateMetaDescFix(context, siteName);

    // Canonical issues
    case 'MISSING_CANONICAL':
    case 'CANONICAL_MISSING':  // Full audit code
    case 'CANONICAL_NO_HTTPS_REDIRECT':
      return generateCanonicalFix(context, fullUrl);

    // Viewport issues
    case 'MISSING_VIEWPORT':
    case 'HTML_NO_VIEWPORT':
    case 'RESPONSIVE_NO_VIEWPORT':
    case 'VIEWPORT_MISSING':  // Full audit code
      return generateViewportFix(context);

    // Open Graph issues
    case 'MISSING_OG_TAGS':
    case 'OG_TITLE_MISSING':
    case 'OG_DESC_MISSING':
    case 'OG_DESCRIPTION_MISSING':  // Full audit code
    case 'OG_IMAGE_MISSING':
    case 'OG_URL_MISSING':
    case 'OG_TYPE_MISSING':
      return generateOGFix(context, siteName, fullUrl);

    // Twitter Card issues
    case 'MISSING_TWITTER_CARD':
    case 'TWITTER_CARD_MISSING':
    case 'TWITTER_TITLE_MISSING':
    case 'TWITTER_DESC_MISSING':
    case 'TWITTER_DESCRIPTION_MISSING':  // Full audit code
    case 'TWITTER_IMAGE_MISSING':
      return generateTwitterFix(context, siteName);

    // Schema/structured data issues
    case 'MISSING_SCHEMA':
    case 'SCHEMA_MISSING':  // Full audit code
    case 'SCHEMA_ORG_MISSING':
    case 'NO_ORGANIZATION_SCHEMA':
    case 'NO_ENTITY_SCHEMA':
    case 'FAQ_SCHEMA_MISSING':
      return generateSchemaFix(context, siteName, fullUrl);

    // Robots.txt issues
    case 'MISSING_ROBOTS':
    case 'ROBOTS_TXT_MISSING':  // Full audit code
    case 'ROBOTS_TXT_WARNINGS':
    case 'ROBOTS_TXT_INVALID_SYNTAX':
      return generateRobotsFix(context, fullUrl);

    // Sitemap issues
    case 'MISSING_SITEMAP':
    case 'SITEMAP_MISSING':  // Full audit code
    case 'BING_SITEMAP_MISSING':
      return generateSitemapFix(context, fullUrl);

    // H1 issues
    case 'MISSING_H1':
    case 'H1_MISSING':  // Full audit code
    case 'NO_VISIBLE_HEADLINE':
    case 'H1_MISSING_KEYWORD':
      return await generateH1Fix({ cwd });

    // SPA-specific: add meta management library recommendation
    case 'SPA_NO_META_MANAGEMENT':
    case 'SPA_WITHOUT_SSR':
    case 'CLIENT_SIDE_RENDERING':
      return generateSPAMetaFix(context, framework);

    // Internal links - suggest adding links
    case 'NO_INTERNAL_LINKS':
    case 'LINKS_NO_INTERNAL':
    case 'NO_CONTENT_INTERNAL_LINKS':
      return {
        issue: { code: issue.code, message: 'No internal links found', severity: 'warning' },
        file: 'src/components/Footer.tsx',
        before: null,
        after: `// Add internal navigation links to your footer or content
// Example: <Link to="/about">About</Link>`,
        explanation: 'Add internal links to help search engines discover your content',
        skipped: true,
        skipReason: 'Requires manual content updates - add links to your navigation and content',
      };

    // Preconnect issues
    case 'GOOGLE_FONTS_NO_PRECONNECT':
    case 'MISSING_PRECONNECT':
      return generatePreconnectFix(context);

    // Favicon/icons
    case 'HTML_NO_FAVICON':
    case 'HTML_NO_APPLE_TOUCH_ICON':
    case 'FAVICON_MISSING':  // Full audit code
      return generateFaviconFix(context);

    // Charset/lang
    case 'HTML_NO_CHARSET':
    case 'HTML_NOT_UTF8':
      return generateCharsetFix(context);

    case 'HTML_NO_LANG':
    case 'LANG_ATTR_MISSING':  // Full audit code
      return generateLangFix(context);

    // AI/LLMs.txt
    case 'AI_NO_LLMS_TXT':
      return generateLlmsTxtFix(context, siteName, fullUrl);

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

function generateSPAMetaFix(context: FixContext, framework: FrameworkInfo): GeneratedFix {
  const { htmlPath } = context;
  const frameworkLower = framework.name.toLowerCase();

  // For React/Vite apps, recommend react-helmet-async
  if (frameworkLower.includes('react') || frameworkLower.includes('vite') || framework.name === 'Unknown') {
    return {
      issue: { code: 'SPA_NO_META_MANAGEMENT', message: 'SPA without dynamic meta tag management', severity: 'warning' },
      file: 'src/components/SEOHead.tsx',
      before: null,
      after: `import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export function SEOHead({ 
  title = 'Your Site Name',
  description = 'Your site description',
  image = '/og-image.png',
  url = window.location.href,
}: SEOHeadProps) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}`,
      explanation: 'Created SEOHead component using react-helmet-async for dynamic meta tags. Install: npm install react-helmet-async',
    };
  }

  return {
    issue: { code: 'SPA_NO_META_MANAGEMENT', message: 'SPA without meta management', severity: 'warning' },
    file: htmlPath,
    before: null,
    after: '<!-- Add a meta management library for your framework -->',
    explanation: `Add dynamic meta tag management for ${framework.name}`,
    skipped: true,
    skipReason: `Framework-specific solution needed for ${framework.name}`,
  };
}

function generatePreconnectFix(context: FixContext): GeneratedFix {
  const { htmlPath, htmlContent } = context;

  const preconnects = `<!-- Preconnect to external origins -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`;

  return {
    issue: { code: 'MISSING_PRECONNECT', message: 'Missing preconnect hints', severity: 'info' },
    file: htmlPath,
    before: '<head>',
    after: `<head>\n    ${preconnects}`,
    explanation: 'Added preconnect hints to speed up loading of external resources',
  };
}

function generateFaviconFix(context: FixContext): GeneratedFix {
  const { htmlPath } = context;

  const faviconTags = `<!-- Favicons -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`;

  return {
    issue: { code: 'HTML_NO_FAVICON', message: 'Missing favicon', severity: 'info' },
    file: htmlPath,
    before: '<head>',
    after: `<head>\n    ${faviconTags}`,
    explanation: 'Added favicon links. Create favicon files in public/ directory.',
  };
}

function generateCharsetFix(context: FixContext): GeneratedFix {
  const { htmlPath, htmlContent } = context;

  if (htmlContent.includes('charset')) {
    return {
      issue: { code: 'HTML_NO_CHARSET', message: 'Missing charset', severity: 'warning' },
      file: htmlPath,
      before: null,
      after: '<meta charset="UTF-8" />',
      skipped: true,
      skipReason: 'Charset already defined',
      explanation: 'Charset is already present',
    };
  }

  return {
    issue: { code: 'HTML_NO_CHARSET', message: 'Missing charset declaration', severity: 'warning' },
    file: htmlPath,
    before: '<head>',
    after: '<head>\n    <meta charset="UTF-8" />',
    explanation: 'Added UTF-8 charset declaration as first element in head',
  };
}

function generateLangFix(context: FixContext): GeneratedFix {
  const { htmlPath, htmlContent } = context;

  if (htmlContent.includes('<html') && !htmlContent.includes('lang=')) {
    return {
      issue: { code: 'HTML_NO_LANG', message: 'Missing lang attribute', severity: 'warning' },
      file: htmlPath,
      before: '<html>',
      after: '<html lang="en">',
      explanation: 'Added lang attribute for accessibility and SEO',
    };
  }

  return {
    issue: { code: 'HTML_NO_LANG', message: 'Missing lang attribute', severity: 'warning' },
    file: htmlPath,
    before: '<html',
    after: '<html lang="en"',
    explanation: 'Added lang attribute for accessibility and SEO',
  };
}

function generateLlmsTxtFix(context: FixContext, siteName: string, url: string): GeneratedFix {
  const llmsTxt = `# ${siteName}
> ${siteName} - A brief description of your product/service

## About
${siteName} is... [Add your description here]

## Features
- Feature 1
- Feature 2
- Feature 3

## Links
- Homepage: ${url}
- Documentation: ${url}/docs
- API: ${url}/api

## Contact
- Email: hello@${new URL(url).hostname}
`;

  return {
    issue: { code: 'AI_NO_LLMS_TXT', message: 'No llms.txt file for AI crawlers', severity: 'info' },
    file: 'public/llms.txt',
    before: null,
    after: llmsTxt,
    explanation: 'Created llms.txt to help AI systems understand your site. Customize the content.',
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
