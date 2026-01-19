import { describe, it, expect } from 'vitest';
import {
  validateHtml,
  injectMetaTags,
  generateSitemap,
  generateRobots,
  SEOConfig,
  MetaConfig,
} from './index.js';

describe('vite-plugin-seo-autopilot', () => {
  describe('validateHtml', () => {
    it('detects missing title', () => {
      const html = `<!DOCTYPE html>
<html>
<head></head>
<body></body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'MISSING_TITLE')).toBe(true);
    });

    it('passes when title present', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Page Title</title></head>
<body></body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'MISSING_TITLE')).toBe(false);
    });

    it('detects missing meta description', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body></body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'MISSING_META_DESCRIPTION')).toBe(true);
    });

    it('detects missing OG tags', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body></body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'MISSING_OG_TAGS')).toBe(true);
    });

    it('detects missing H1', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h2>Section</h2></body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'MISSING_H1')).toBe(true);
    });

    it('detects multiple H1s', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>First</h1>
  <h1>Second</h1>
</body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'MULTIPLE_H1')).toBe(true);
    });

    it('detects images without alt', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><img src="test.png"></body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues.some(i => i.code === 'IMG_MISSING_ALT')).toBe(true);
    });

    it('respects disabled checks', () => {
      const html = `<!DOCTYPE html>
<html>
<head></head>
<body></body>
</html>`;

      const issues = validateHtml(html, {
        checks: {
          title: false,
          description: false,
        },
      });

      expect(issues.some(i => i.code === 'MISSING_TITLE')).toBe(false);
      expect(issues.some(i => i.code === 'MISSING_META_DESCRIPTION')).toBe(false);
    });

    it('returns no issues for well-optimized HTML', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Page Title</title>
  <meta name="description" content="Description here">
  <meta property="og:title" content="OG Title">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="https://example.com">
</head>
<body>
  <h1>Main Heading</h1>
  <img src="test.png" alt="Test image">
</body>
</html>`;

      const issues = validateHtml(html, true);

      expect(issues).toHaveLength(0);
    });
  });

  describe('injectMetaTags', () => {
    it('injects meta description', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body></body>
</html>`;

      const meta: MetaConfig = {
        description: 'Test description',
      };

      const result = injectMetaTags(html, meta);

      expect(result).toContain('<meta name="description" content="Test description">');
    });

    it('injects Open Graph tags', () => {
      const html = `<head></head>`;

      const meta: MetaConfig = {
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: 'https://example.com/image.png',
      };

      const result = injectMetaTags(html, meta);

      expect(result).toContain('property="og:title"');
      expect(result).toContain('property="og:description"');
      expect(result).toContain('property="og:image"');
    });

    it('injects Twitter Card', () => {
      const html = `<head></head>`;

      const meta: MetaConfig = {
        twitterCard: 'summary_large_image',
        twitterSite: '@example',
      };

      const result = injectMetaTags(html, meta);

      expect(result).toContain('name="twitter:card" content="summary_large_image"');
      expect(result).toContain('name="twitter:site"');
    });

    it('injects canonical URL', () => {
      const html = `<head></head>`;

      const meta: MetaConfig = {
        canonical: 'https://example.com/page',
      };

      const result = injectMetaTags(html, meta);

      expect(result).toContain('rel="canonical" href="https://example.com/page"');
    });

    it('uses siteUrl as fallback for canonical', () => {
      const html = `<head></head>`;

      const result = injectMetaTags(html, {}, 'https://example.com');

      expect(result).toContain('rel="canonical" href="https://example.com"');
    });

    it('does not duplicate existing tags', () => {
      const html = `<head>
  <meta name="description" content="Existing">
</head>`;

      const meta: MetaConfig = {
        description: 'New description',
      };

      const result = injectMetaTags(html, meta);

      const descMatches = result.match(/name="description"/g);
      expect(descMatches).toHaveLength(1);
    });

    it('escapes special characters', () => {
      const html = `<head></head>`;

      const meta: MetaConfig = {
        description: 'Test "quotes" & <special>',
      };

      const result = injectMetaTags(html, meta);

      expect(result).toContain('&quot;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
    });
  });

  describe('generateSitemap', () => {
    it('generates valid sitemap XML', () => {
      const sitemap = generateSitemap('https://example.com', {});

      expect(sitemap).toContain('<?xml version="1.0"');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(sitemap).toContain('</urlset>');
    });

    it('includes default route', () => {
      const sitemap = generateSitemap('https://example.com', {});

      expect(sitemap).toContain('<loc>https://example.com/</loc>');
    });

    it('includes custom routes', () => {
      const sitemap = generateSitemap('https://example.com', {
        routes: ['/', '/about', '/contact'],
      });

      expect(sitemap).toContain('<loc>https://example.com/</loc>');
      expect(sitemap).toContain('<loc>https://example.com/about</loc>');
      expect(sitemap).toContain('<loc>https://example.com/contact</loc>');
    });

    it('includes changefreq and priority', () => {
      const sitemap = generateSitemap('https://example.com', {
        changefreq: 'daily',
        priority: 0.9,
      });

      expect(sitemap).toContain('<changefreq>daily</changefreq>');
      expect(sitemap).toContain('<priority>0.9</priority>');
    });

    it('supports custom route configurations', () => {
      const sitemap = generateSitemap('https://example.com', {
        customRoutes: [
          { path: '/blog', changefreq: 'daily', priority: 1.0 },
          { path: '/archive', changefreq: 'yearly', priority: 0.3, lastmod: '2024-01-01' },
        ],
      });

      expect(sitemap).toContain('<loc>https://example.com/blog</loc>');
      expect(sitemap).toContain('<priority>1</priority>');
      expect(sitemap).toContain('<lastmod>2024-01-01</lastmod>');
    });

    it('handles trailing slash in siteUrl', () => {
      const sitemap = generateSitemap('https://example.com/', {
        routes: ['/page'],
      });

      expect(sitemap).toContain('<loc>https://example.com/page</loc>');
      expect(sitemap).not.toContain('https://example.com//');
    });
  });

  describe('generateRobots', () => {
    it('generates valid robots.txt', () => {
      const robots = generateRobots('https://example.com');

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
    });

    it('includes sitemap reference', () => {
      const robots = generateRobots('https://example.com');

      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
    });

    it('supports custom rules', () => {
      const robots = generateRobots('https://example.com', {
        rules: [
          { userAgent: '*', allow: ['/'], disallow: ['/admin', '/private'] },
          { userAgent: 'Googlebot', allow: ['/'] },
        ],
      });

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Disallow: /admin');
      expect(robots).toContain('Disallow: /private');
      expect(robots).toContain('User-agent: Googlebot');
    });

    it('supports crawl delay', () => {
      const robots = generateRobots('https://example.com', {
        rules: [
          { userAgent: '*', allow: ['/'], crawlDelay: 10 },
        ],
      });

      expect(robots).toContain('Crawl-delay: 10');
    });

    it('supports multiple sitemaps', () => {
      const robots = generateRobots('https://example.com', {
        sitemaps: [
          'https://example.com/sitemap.xml',
          'https://example.com/sitemap-blog.xml',
        ],
      });

      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
      expect(robots).toContain('Sitemap: https://example.com/sitemap-blog.xml');
    });
  });

  describe('integration', () => {
    it('validates and injects in well-formed HTML', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Page</title>
</head>
<body>
  <h1>Welcome</h1>
  <img src="hero.jpg" alt="Hero image">
</body>
</html>`;

      // Validate first
      const issues = validateHtml(html, true);

      // Should only have warnings for missing OG/Twitter/canonical (not errors)
      const errors = issues.filter(i => i.severity === 'error');
      expect(errors).toHaveLength(1); // Only missing meta description

      // Inject meta tags
      const meta: MetaConfig = {
        description: 'Page description',
        ogTitle: 'My Page',
        ogDescription: 'Page description',
        twitterCard: 'summary',
      };

      const result = injectMetaTags(html, meta, 'https://example.com');

      // Re-validate
      const newIssues = validateHtml(result, true);
      expect(newIssues.filter(i => i.severity === 'error')).toHaveLength(0);
    });
  });
});
