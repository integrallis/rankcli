/**
 * next-seo-autopilot
 *
 * Next.js plugin for SEO automation - config helpers, sitemap, robots.txt generation.
 */

// Type-only import - next is a peer dependency
interface NextConfig {
  reactStrictMode?: boolean;
  images?: { domains?: string[] };
  trailingSlash?: boolean;
  publicRuntimeConfig?: Record<string, any>;
  headers?: () => Promise<any[]>;
  [key: string]: any;
}

export interface SEOConfig {
  /**
   * Site URL for sitemap and canonical URLs
   */
  siteUrl: string;

  /**
   * Generate sitemap.xml
   */
  generateSitemap?: boolean;

  /**
   * Generate robots.txt
   */
  generateRobots?: boolean;

  /**
   * Default metadata for all pages
   */
  defaultMetadata?: DefaultMetadata;

  /**
   * Routes to exclude from sitemap
   */
  excludeRoutes?: string[];

  /**
   * Additional sitemap entries
   */
  additionalSitemapUrls?: SitemapUrl[];

  /**
   * Robots.txt configuration
   */
  robotsConfig?: RobotsConfig;
}

export interface DefaultMetadata {
  title?: string;
  titleTemplate?: string;
  description?: string;
  keywords?: string[];
  authors?: { name: string; url?: string }[];
  creator?: string;
  publisher?: string;
  openGraph?: OpenGraphConfig;
  twitter?: TwitterConfig;
}

export interface OpenGraphConfig {
  type?: 'website' | 'article' | 'book' | 'profile';
  siteName?: string;
  locale?: string;
  images?: { url: string; width?: number; height?: number; alt?: string }[];
}

export interface TwitterConfig {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  site?: string;
  creator?: string;
}

export interface SitemapUrl {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface RobotsConfig {
  rules?: RobotsRule[];
  host?: string;
}

export interface RobotsRule {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
}

/**
 * Create SEO-enhanced Next.js config
 */
export function withSEO(seoConfig: SEOConfig) {
  return (nextConfig: NextConfig = {}): NextConfig => {
    return {
      ...nextConfig,

      // Add SEO config to publicRuntimeConfig for client access
      publicRuntimeConfig: {
        ...nextConfig.publicRuntimeConfig,
        seoAutopilot: {
          siteUrl: seoConfig.siteUrl,
          defaultMetadata: seoConfig.defaultMetadata,
        },
      },

      // Ensure trailing slashes are consistent for SEO
      trailingSlash: nextConfig.trailingSlash ?? false,

      // Add headers for SEO
      async headers() {
        const existingHeaders = nextConfig.headers ? await nextConfig.headers() : [];
        return [
          ...existingHeaders,
          {
            source: '/:path*',
            headers: [
              {
                key: 'X-Content-Type-Options',
                value: 'nosniff',
              },
              {
                key: 'X-Frame-Options',
                value: 'DENY',
              },
              {
                key: 'X-XSS-Protection',
                value: '1; mode=block',
              },
            ],
          },
        ];
      },
    };
  };
}

/**
 * Generate sitemap entries for app router
 */
export function generateSitemapEntries(
  routes: string[],
  config: SEOConfig
): SitemapUrl[] {
  const { siteUrl, excludeRoutes = [], additionalSitemapUrls = [] } = config;
  const baseUrl = siteUrl.replace(/\/$/, '');

  const entries: SitemapUrl[] = routes
    .filter(route => !excludeRoutes.some(exclude =>
      route === exclude || route.startsWith(exclude + '/')
    ))
    .map(route => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly' as const,
      priority: route === '/' ? 1.0 : 0.8,
    }));

  return [...entries, ...additionalSitemapUrls];
}

/**
 * Generate sitemap.xml content
 */
export function generateSitemapXml(entries: SitemapUrl[]): string {
  const urls = entries.map(entry => {
    const lastMod = entry.lastModified instanceof Date
      ? entry.lastModified.toISOString()
      : entry.lastModified;

    return `  <url>
    <loc>${escapeXml(entry.url)}</loc>${lastMod ? `
    <lastmod>${lastMod}</lastmod>` : ''}${entry.changeFrequency ? `
    <changefreq>${entry.changeFrequency}</changefreq>` : ''}${entry.priority !== undefined ? `
    <priority>${entry.priority}</priority>` : ''}
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(config: SEOConfig): string {
  const { siteUrl, robotsConfig = {} } = config;
  const lines: string[] = [];

  const rules = robotsConfig.rules || [
    { userAgent: '*', allow: '/' },
  ];

  for (const rule of rules) {
    const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];

    for (const agent of agents) {
      lines.push(`User-agent: ${agent}`);
    }

    if (rule.allow) {
      const allows = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
      for (const path of allows) {
        lines.push(`Allow: ${path}`);
      }
    }

    if (rule.disallow) {
      const disallows = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
      for (const path of disallows) {
        lines.push(`Disallow: ${path}`);
      }
    }

    if (rule.crawlDelay) {
      lines.push(`Crawl-delay: ${rule.crawlDelay}`);
    }

    lines.push('');
  }

  // Add sitemap
  const baseUrl = siteUrl.replace(/\/$/, '');
  lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);

  if (robotsConfig.host) {
    lines.push(`Host: ${robotsConfig.host}`);
  }

  return lines.join('\n');
}

/**
 * Create sitemap route handler for app router
 */
export function createSitemapHandler(config: SEOConfig) {
  return async function sitemap() {
    // This would be called with actual routes in a real app
    // For now, return the additional URLs configured
    return config.additionalSitemapUrls || [];
  };
}

/**
 * Create robots.txt route handler for app router
 */
export function createRobotsHandler(config: SEOConfig) {
  return function robots() {
    const { siteUrl, robotsConfig = {} } = config;
    const baseUrl = siteUrl.replace(/\/$/, '');

    const rules = robotsConfig.rules || [
      { userAgent: '*', allow: '/' },
    ];

    return {
      rules: rules.map(rule => ({
        userAgent: rule.userAgent,
        allow: rule.allow,
        disallow: rule.disallow,
      })),
      sitemap: `${baseUrl}/sitemap.xml`,
      host: robotsConfig.host,
    };
  };
}

/**
 * Validate page metadata
 */
export function validateMetadata(metadata: Record<string, any>): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!metadata.title) {
    issues.push({
      code: 'MISSING_TITLE',
      message: 'Page is missing a title',
      severity: 'error',
    });
  }

  if (!metadata.description) {
    issues.push({
      code: 'MISSING_DESCRIPTION',
      message: 'Page is missing a meta description',
      severity: 'error',
    });
  }

  if (!metadata.openGraph?.title) {
    issues.push({
      code: 'MISSING_OG_TITLE',
      message: 'Page is missing Open Graph title',
      severity: 'warning',
    });
  }

  if (!metadata.openGraph?.images?.length) {
    issues.push({
      code: 'MISSING_OG_IMAGE',
      message: 'Page is missing Open Graph image',
      severity: 'warning',
    });
  }

  if (!metadata.twitter?.card) {
    issues.push({
      code: 'MISSING_TWITTER_CARD',
      message: 'Page is missing Twitter Card',
      severity: 'warning',
    });
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
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

// Re-export metadata utilities
export * from './metadata.js';
