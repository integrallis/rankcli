/**
 * vite-plugin-rankcli
 *
 * Vite plugin for SEO validation, sitemap generation, and meta tag injection.
 */

import type { Plugin, ResolvedConfig } from 'vite';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

export interface SEOConfig {
  /**
   * Site URL for sitemap and canonical URLs
   */
  siteUrl?: string;

  /**
   * Default meta tags to inject
   */
  defaultMeta?: MetaConfig;

  /**
   * Enable/disable sitemap generation
   */
  sitemap?: boolean | SitemapConfig;

  /**
   * Enable/disable robots.txt generation
   */
  robots?: boolean | RobotsConfig;

  /**
   * Enable/disable build-time SEO validation
   */
  validate?: boolean | ValidationConfig;

  /**
   * Enable/disable dev server warnings
   */
  devWarnings?: boolean;
}

export interface MetaConfig {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  twitterSite?: string;
  canonical?: string;
}

export interface SitemapConfig {
  /**
   * Routes to include in sitemap
   */
  routes?: string[];

  /**
   * Change frequency for all routes
   */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

  /**
   * Priority for all routes (0.0 - 1.0)
   */
  priority?: number;

  /**
   * Custom route configurations
   */
  customRoutes?: SitemapRoute[];
}

export interface SitemapRoute {
  path: string;
  changefreq?: string;
  priority?: number;
  lastmod?: string;
}

export interface RobotsConfig {
  /**
   * User-agent rules
   */
  rules?: RobotsRule[];

  /**
   * Additional sitemap URLs
   */
  sitemaps?: string[];
}

export interface RobotsRule {
  userAgent: string;
  allow?: string[];
  disallow?: string[];
  crawlDelay?: number;
}

export interface ValidationConfig {
  /**
   * Fail build on errors
   */
  failOnError?: boolean;

  /**
   * Checks to run
   */
  checks?: {
    title?: boolean;
    description?: boolean;
    ogTags?: boolean;
    twitterCard?: boolean;
    canonical?: boolean;
    headings?: boolean;
    images?: boolean;
  };
}

export interface SEOIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  file?: string;
}

/** How many HTML entry points the build has - more than one is a multi-page app. */
function htmlEntryCount(cfg: ResolvedConfig): number {
  const build = cfg.build as ResolvedConfig['build'] & { rolldownOptions?: { input?: unknown } };
  const input = build.rolldownOptions?.input ?? build.rollupOptions?.input;
  if (!input) return 1; // the default: a single index.html
  const values = typeof input === 'string' ? [input] : Array.isArray(input) ? input : Object.values(input as Record<string, string>);
  return values.filter(v => String(v).endsWith('.html')).length || 1;
}

/**
 * The URL path an HTML file is served at: /index.html -> /,
 * /about/index.html -> /about/, /about.html -> /about.html.
 */
export function pagePathFromHtml(htmlPath: string): string {
  const path = htmlPath.startsWith('/') ? htmlPath : `/${htmlPath}`;
  return path.replace(/(^|\/)index\.html$/, '$1');
}

/**
 * Create the RankCLI Vite plugin
 */
export default function seoAutopilot(config: SEOConfig = {}): Plugin {
  let resolvedConfig: ResolvedConfig;
  let issues: SEOIssue[] = [];

  return {
    name: 'vite-plugin-rankcli',

    configResolved(cfg) {
      resolvedConfig = cfg;
    },

    buildStart() {
      issues = [];
      if (resolvedConfig.command === 'serve' && config.devWarnings !== false) {
        console.log('\n🔍 RankCLI watching for issues...\n');
      }
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // Validate HTML
        if (config.validate !== false) {
          const validationIssues = validateHtml(html, config.validate, ctx.filename);
          issues.push(...validationIssues);

          // Log warnings in dev mode
          if (resolvedConfig.command === 'serve' && config.devWarnings !== false) {
            for (const issue of validationIssues) {
              const prefix = issue.severity === 'error' ? '❌' : '⚠️';
              console.warn(`${prefix} SEO: ${issue.message}`);
            }
          }
        }

        // Inject meta tags. A canonical derived from siteUrl is only right
        // for one page: in a multi-page build each HTML file gets its own
        // URL; in a single-page app index.html is served for every route,
        // so a static canonical would point every route at the homepage.
        // (It used to do exactly that.) SPAs must set it per route at runtime.
        if (config.defaultMeta) {
          const pagePath = htmlEntryCount(resolvedConfig) > 1 ? pagePathFromHtml(ctx.path) : undefined;
          html = injectMetaTags(html, config.defaultMeta, config.siteUrl, pagePath);
        }

        return html;
      },
    },

    generateBundle() {
      // A file the site already ships in public/ wins: emitting ours
      // replaced the user's robots.txt (and its Disallow rules) on every build.
      const shippedInPublic = (name: string) =>
        !!resolvedConfig.publicDir && existsSync(join(resolvedConfig.publicDir, name));

      // Generate sitemap
      if (config.sitemap !== false && config.siteUrl) {
        if (shippedInPublic('sitemap.xml')) {
          console.log('ℹ️  public/sitemap.xml exists - not generating one');
        } else {
          const sitemapConfig = typeof config.sitemap === 'object' ? config.sitemap : {};
          this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: generateSitemap(config.siteUrl, sitemapConfig),
          });
          console.log('✅ Generated sitemap.xml');
        }
      }

      // Generate robots.txt
      if (config.robots !== false) {
        if (shippedInPublic('robots.txt')) {
          console.log('ℹ️  public/robots.txt exists - not generating one');
        } else {
          const robotsConfig = typeof config.robots === 'object' ? config.robots : {};
          this.emitFile({
            type: 'asset',
            fileName: 'robots.txt',
            source: generateRobots(config.siteUrl, robotsConfig),
          });
          console.log('✅ Generated robots.txt');
        }
      }
    },

    closeBundle() {
      // Report issues
      if (issues.length > 0) {
        console.log(`\n🔍 RankCLI found ${issues.length} issue(s):\n`);
        for (const issue of issues) {
          const prefix = issue.severity === 'error' ? '❌' : '⚠️';
          console.log(`  ${prefix} [${issue.code}] ${issue.message}`);
        }
        console.log('');

        // Fail build if configured
        const validationConfig = typeof config.validate === 'object' ? config.validate : {};
        if (validationConfig.failOnError && issues.some(i => i.severity === 'error')) {
          throw new Error('SEO validation failed. Fix errors before building.');
        }
      } else if (resolvedConfig.command === 'build') {
        console.log('\n✅ RankCLI: No issues found\n');
      }
    },
  };
}

/**
 * Validate HTML for SEO issues
 */
export function validateHtml(
  html: string,
  config: boolean | ValidationConfig | undefined,
  filename?: string
): SEOIssue[] {
  const issues: SEOIssue[] = [];
  const checks = typeof config === 'object' ? config.checks || {} : {};

  // Check for title
  if (checks.title !== false && !/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    issues.push({
      code: 'MISSING_TITLE',
      message: 'Missing <title> tag',
      severity: 'error',
      file: filename,
    });
  }

  // Check for meta description
  if (checks.description !== false && !/<meta[^>]*name=["']description["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_META_DESCRIPTION',
      message: 'Missing meta description',
      severity: 'error',
      file: filename,
    });
  }

  // Check for Open Graph tags
  if (checks.ogTags !== false && !/<meta[^>]*property=["']og:title["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_OG_TAGS',
      message: 'Missing Open Graph tags (og:title)',
      severity: 'warning',
      file: filename,
    });
  }

  // Check for Twitter Card
  if (checks.twitterCard !== false && !/<meta[^>]*name=["']twitter:card["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_TWITTER_CARD',
      message: 'Missing Twitter Card meta tag',
      severity: 'warning',
      file: filename,
    });
  }

  // Check for canonical
  if (checks.canonical !== false && !/<link[^>]*rel=["']canonical["'][^>]*>/i.test(html)) {
    issues.push({
      code: 'MISSING_CANONICAL',
      message: 'Missing canonical URL',
      severity: 'warning',
      file: filename,
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
        file: filename,
      });
    } else if (h1Matches.length > 1) {
      issues.push({
        code: 'MULTIPLE_H1',
        message: `Found ${h1Matches.length} H1 headings (should be exactly 1)`,
        severity: 'warning',
        file: filename,
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
          file: filename,
        });
        break; // Only report once
      }
    }
  }

  return issues;
}

/**
 * Inject meta tags into HTML
 */
export function injectMetaTags(
  html: string,
  meta: MetaConfig,
  siteUrl?: string,
  /** URL path of this page (multi-page builds). Without it, siteUrl never becomes a canonical. */
  pagePath?: string
): string {
  const tags: string[] = [];

  if (meta.description && !/<meta[^>]*name=["']description["']/i.test(html)) {
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
  }

  if (meta.ogTitle && !/<meta[^>]*property=["']og:title["']/i.test(html)) {
    tags.push(`<meta property="og:title" content="${escapeHtml(meta.ogTitle)}">`);
  }

  if (meta.ogDescription && !/<meta[^>]*property=["']og:description["']/i.test(html)) {
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.ogDescription)}">`);
  }

  if (meta.ogImage && !/<meta[^>]*property=["']og:image["']/i.test(html)) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.ogImage)}">`);
  }

  if (meta.twitterCard && !/<meta[^>]*name=["']twitter:card["']/i.test(html)) {
    tags.push(`<meta name="twitter:card" content="${meta.twitterCard}">`);
  }

  if (meta.twitterSite && !/<meta[^>]*name=["']twitter:site["']/i.test(html)) {
    tags.push(`<meta name="twitter:site" content="${escapeHtml(meta.twitterSite)}">`);
  }

  const canonicalUrl = meta.canonical
    || (siteUrl && pagePath !== undefined ? `${siteUrl.replace(/\/$/, '')}${pagePath}` : undefined);
  if (canonicalUrl && !/<link[^>]*rel=["']canonical["']/i.test(html)) {
    tags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`);
  }

  if (tags.length === 0) {
    return html;
  }

  // Inject after <head> or at start of document
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertPos = headMatch.index! + headMatch[0].length;
    return html.slice(0, insertPos) + '\n  ' + tags.join('\n  ') + html.slice(insertPos);
  }

  return tags.join('\n') + '\n' + html;
}

/**
 * Generate sitemap.xml
 */
export function generateSitemap(siteUrl: string, config: SitemapConfig): string {
  const routes = config.routes || ['/'];
  const changefreq = config.changefreq || 'weekly';
  const priority = config.priority || 0.8;

  // Combine default routes with custom routes
  const allRoutes: SitemapRoute[] = routes.map(path => ({
    path,
    changefreq,
    priority,
  }));

  if (config.customRoutes) {
    allRoutes.push(...config.customRoutes);
  }

  const urls = allRoutes.map(route => {
    const loc = `${siteUrl.replace(/\/$/, '')}${route.path}`;
    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${route.changefreq || changefreq}</changefreq>
    <priority>${route.priority || priority}</priority>${route.lastmod ? `\n    <lastmod>${route.lastmod}</lastmod>` : ''}
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
export function generateRobots(siteUrl?: string, config: RobotsConfig = {}): string {
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

  // Add sitemap references
  const sitemaps = config.sitemaps || (siteUrl ? [`${siteUrl.replace(/\/$/, '')}/sitemap.xml`] : []);
  for (const sitemap of sitemaps) {
    lines.push(`Sitemap: ${sitemap}`);
  }

  return lines.join('\n').trim() + '\n';
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

// Named export for ESM
export { seoAutopilot };
