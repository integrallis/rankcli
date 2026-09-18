/**
 * astro-rankcli
 *
 * Astro integration for SEO automation - sitemap, robots.txt, meta validation.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SEOConfig {
  /**
   * Site URL for sitemap and canonical URLs
   */
  siteUrl: string;

  /**
   * Generate sitemap.xml
   */
  sitemap?: boolean | SitemapConfig;

  /**
   * Generate robots.txt
   */
  robots?: boolean | RobotsConfig;

  /**
   * Validate pages during build
   */
  validate?: boolean | ValidationConfig;

  /**
   * Log validation issues
   */
  logIssues?: boolean;
}

export interface SitemapConfig {
  /**
   * Routes to include (auto-detected if not specified)
   */
  routes?: string[];

  /**
   * Routes to exclude
   */
  exclude?: string[];

  /**
   * Default change frequency
   */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

  /**
   * Default priority
   */
  priority?: number;

  /**
   * Custom route configurations
   */
  customRoutes?: SitemapRoute[];
}

export interface SitemapRoute {
  path: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  lastmod?: string;
}

export interface RobotsConfig {
  /**
   * User-agent rules
   */
  rules?: RobotsRule[];

  /**
   * Additional directives
   */
  host?: string;
}

export interface RobotsRule {
  userAgent: string;
  allow?: string[];
  disallow?: string[];
  crawlDelay?: number;
}

export interface ValidationConfig {
  /**
   * Fail build on SEO errors
   */
  failOnError?: boolean;

  /**
   * Checks to run
   */
  checks?: {
    title?: boolean;
    description?: boolean;
    ogTags?: boolean;
    canonical?: boolean;
    headings?: boolean;
    images?: boolean;
  };
}

export interface SEOIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  page?: string;
}

export interface AstroIntegration {
  name: string;
  hooks: {
    'astro:build:done'?: (options: any) => void | Promise<void>;
  };
}

// Error pages are not meant to rank; validating them would fail builds
// on a 404 page without a meta description.
const SKIP_VALIDATION = /(^|\/)(404|500)(\/index)?\.html$/;

function listHtmlFiles(dir: string, base = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listHtmlFiles(full, base));
    else if (entry.name.endsWith('.html')) files.push(relative(base, full).split(sep).join('/'));
  }
  return files;
}

/**
 * Write a generated file into the build output unless the site already
 * ships its own (Astro copies public/ into the output before build:done).
 */
function writeUnlessPresent(outDir: string, name: string, content: string, log: (msg: string) => void): void {
  const target = join(outDir, name);
  if (existsSync(target)) {
    log(`${name} already exists (from public/) - left untouched`);
    return;
  }
  writeFileSync(target, content);
  log(`Generated ${name}`);
}

/**
 * Create the RankCLI Astro integration.
 *
 * On `astro build` it writes sitemap.xml and robots.txt into the output
 * (never over files your public/ already provides), validates every built
 * page, and fails the build on error-level issues when
 * `validate: { failOnError: true }`. It used to write nothing and never
 * run the validation, so failOnError could not fire.
 */
export default function seoAutopilot(config: SEOConfig): AstroIntegration {
  return {
    name: 'astro-rankcli',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }: { dir: URL; pages?: { pathname: string }[]; logger?: { info(m: string): void; warn(m: string): void } }) => {
        const outDir = fileURLToPath(dir);
        const siteUrl = config.siteUrl.replace(/\/$/, '');
        const log = (msg: string) => (logger ? logger.info(msg) : console.log(`[astro-rankcli] ${msg}`));
        const warn = (msg: string) => (logger ? logger.warn(msg) : console.warn(`[astro-rankcli] ${msg}`));

        // Astro's pathnames have no leading slash ('' for the home page, 'about/').
        const pageRoutes = (pages?.length ? pages.map(p => '/' + (p.pathname || '').replace(/^\/+/, '')) : ['/'])
          .filter(route => !/^\/(404|500)\/?$/.test(route));

        if (config.sitemap !== false) {
          const sitemapConfig = typeof config.sitemap === 'object' ? config.sitemap : {};
          writeUnlessPresent(outDir, 'sitemap.xml', generateSitemap(siteUrl, pageRoutes, sitemapConfig), log);
        }

        if (config.robots !== false) {
          const robotsConfig = typeof config.robots === 'object' ? config.robots : {};
          writeUnlessPresent(outDir, 'robots.txt', generateRobots(siteUrl, robotsConfig), log);
        }

        if (config.validate === false) return;
        const validationConfig = typeof config.validate === 'object' ? config.validate : {};
        const issues: SEOIssue[] = [];
        for (const file of listHtmlFiles(outDir)) {
          if (SKIP_VALIDATION.test(file)) continue;
          issues.push(...validatePage(readFileSync(join(outDir, file), 'utf8'), validationConfig, file));
        }

        if (issues.length > 0 && config.logIssues !== false) {
          warn(`${issues.length} SEO issue(s):`);
          for (const issue of issues) {
            warn(`  ${issue.severity === 'error' ? 'error' : 'warn '} [${issue.code}] ${issue.page}: ${issue.message}`);
          }
        }

        const errors = issues.filter(i => i.severity === 'error');
        if (validationConfig.failOnError && errors.length > 0) {
          throw new Error(`SEO validation failed: ${errors.length} error(s) - see the list above`);
        }
      },
    },
  };
}

/**
 * Generate sitemap XML
 */
export function generateSitemap(
  siteUrl: string,
  routes: string[],
  config: SitemapConfig
): string {
  const exclude = config.exclude || [];
  const changefreq = config.changefreq || 'weekly';
  const priority = config.priority || 0.8;

  // Filter and map routes
  const entries = routes
    .filter(route => !exclude.some(ex =>
      route === ex || route.startsWith(ex + '/')
    ))
    .map(route => ({
      path: route,
      changefreq,
      priority: route === '/' ? 1.0 : priority,
    }));

  // Add custom routes
  if (config.customRoutes) {
    entries.push(...config.customRoutes.map(r => ({
      path: r.path,
      changefreq: r.changefreq || changefreq,
      priority: r.priority || priority,
      lastmod: r.lastmod,
    })));
  }

  const urls = entries.map(entry => {
    const loc = `${siteUrl}${entry.path === '/' ? '' : entry.path}`;
    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${(entry as any).lastmod ? `
    <lastmod>${(entry as any).lastmod}</lastmod>` : ''}
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Generate robots.txt
 */
export function generateRobots(siteUrl: string, config: RobotsConfig): string {
  const lines: string[] = [];

  const rules = config.rules || [
    { userAgent: '*', allow: ['/'] },
  ];

  for (const rule of rules) {
    lines.push(`User-agent: ${rule.userAgent}`);

    if (rule.allow) {
      for (const path of rule.allow) {
        lines.push(`Allow: ${path}`);
      }
    }

    if (rule.disallow) {
      for (const path of rule.disallow) {
        lines.push(`Disallow: ${path}`);
      }
    }

    if (rule.crawlDelay) {
      lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    }

    lines.push('');
  }

  // Add sitemap
  lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);

  if (config.host) {
    lines.push(`Host: ${config.host}`);
  }

  return lines.join('\n');
}

/**
 * Validate HTML content for SEO issues
 */
export function validatePage(
  html: string,
  config: ValidationConfig = {},
  pagePath?: string
): SEOIssue[] {
  const issues: SEOIssue[] = [];
  const checks = config.checks || {};

  // Check for title
  if (checks.title !== false && !/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    issues.push({
      code: 'MISSING_TITLE',
      message: 'Missing <title> tag',
      severity: 'error',
      page: pagePath,
    });
  }

  // Check for meta description
  if (checks.description !== false && !/<meta[^>]*name=["']description["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_META_DESCRIPTION',
      message: 'Missing meta description',
      severity: 'error',
      page: pagePath,
    });
  }

  // Check for Open Graph tags
  if (checks.ogTags !== false && !/<meta[^>]*property=["']og:title["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_OG_TAGS',
      message: 'Missing Open Graph tags',
      severity: 'warning',
      page: pagePath,
    });
  }

  // Check for canonical
  if (checks.canonical !== false && !/<link[^>]*rel=["']canonical["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_CANONICAL',
      message: 'Missing canonical URL',
      severity: 'warning',
      page: pagePath,
    });
  }

  // Check for H1
  if (checks.headings !== false) {
    const h1Matches = html.match(/<h1[^>]*>/gi);
    if (!h1Matches) {
      issues.push({
        code: 'MISSING_H1',
        message: 'Missing H1 heading',
        severity: 'warning',
        page: pagePath,
      });
    } else if (h1Matches.length > 1) {
      issues.push({
        code: 'MULTIPLE_H1',
        message: `Found ${h1Matches.length} H1 headings`,
        severity: 'warning',
        page: pagePath,
      });
    }
  }

  // Check for images without alt
  if (checks.images !== false) {
    const imgRegex = /<img[^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      if (!match[0].match(/alt=["'][^"']+["']/i)) {
        issues.push({
          code: 'IMG_MISSING_ALT',
          message: 'Image missing alt text',
          severity: 'warning',
          page: pagePath,
        });
        break;
      }
    }
  }

  return issues;
}

/**
 * Create SEO-optimized head content for Astro
 */
export function createHeadContent(options: {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
}): string {
  const tags: string[] = [];

  tags.push(`<title>${escapeHtml(options.title)}</title>`);
  tags.push(`<meta name="description" content="${escapeHtml(options.description)}">`);

  if (options.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(options.canonical)}">`);
  }

  // Open Graph
  tags.push(`<meta property="og:title" content="${escapeHtml(options.title)}">`);
  tags.push(`<meta property="og:description" content="${escapeHtml(options.description)}">`);
  if (options.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(options.ogImage)}">`);
  }

  // Twitter
  tags.push(`<meta name="twitter:card" content="${options.twitterCard || 'summary'}">`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(options.title)}">`);
  tags.push(`<meta name="twitter:description" content="${escapeHtml(options.description)}">`);

  // Robots
  if (options.noIndex) {
    tags.push(`<meta name="robots" content="noindex, nofollow">`);
  }

  return tags.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Named export
export { seoAutopilot };
