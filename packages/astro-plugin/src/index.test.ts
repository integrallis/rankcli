import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import seoAutopilot, {
  generateSitemap,
  generateRobots,
  validatePage,
  createHeadContent,
  SEOConfig,
} from './index.js';

describe('astro-seo-autopilot', () => {
  describe('seoAutopilot integration', () => {
    it('returns valid Astro integration', () => {
      const integration = seoAutopilot({
        siteUrl: 'https://example.com',
      });

      expect(integration.name).toBe('astro-rankcli');
      expect(integration.hooks).toBeDefined();
      expect(integration.hooks['astro:build:done']).toBeInstanceOf(Function);
    });
  });

  describe('astro:build:done', () => {
    const GOOD = '<html><head><title>Home</title><meta name="description" content="d"><meta property="og:title" content="t"><link rel="canonical" href="https://example.com/"></head><body><h1>Hi</h1></body></html>';
    const BAD = '<html><head></head><body><h1>No title</h1></body></html>';
    let outDir: string;
    const logger = { info: () => {}, warn: () => {} };

    beforeEach(() => {
      outDir = mkdtempSync(join(tmpdir(), 'astro-rankcli-'));
      mkdirSync(join(outDir, 'about'));
      writeFileSync(join(outDir, 'index.html'), GOOD);
      writeFileSync(join(outDir, 'about', 'index.html'), GOOD);
      writeFileSync(join(outDir, '404.html'), BAD); // error pages aren't validated
    });

    afterEach(() => rmSync(outDir, { recursive: true, force: true }));

    const build = (config: Parameters<typeof seoAutopilot>[0]) =>
      seoAutopilot(config).hooks['astro:build:done']!({
        dir: pathToFileURL(outDir + '/'),
        pages: [{ pathname: '' }, { pathname: 'about/' }, { pathname: '404' }],
        logger,
      });

    it('writes sitemap.xml and robots.txt into the build output', async () => {
      await build({ siteUrl: 'https://example.com/' });
      const sitemap = readFileSync(join(outDir, 'sitemap.xml'), 'utf8');
      expect(sitemap).toContain('<loc>https://example.com</loc>');
      expect(sitemap).toContain('<loc>https://example.com/about/</loc>');
      expect(sitemap).not.toContain('404');
      expect(readFileSync(join(outDir, 'robots.txt'), 'utf8')).toContain('Sitemap: https://example.com/sitemap.xml');
    });

    it('never overwrites a robots.txt the site ships in public/', async () => {
      writeFileSync(join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /admin\n');
      await build({ siteUrl: 'https://example.com' });
      expect(readFileSync(join(outDir, 'robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /admin\n');
    });

    it('fails the build on page errors with failOnError', async () => {
      writeFileSync(join(outDir, 'about', 'index.html'), BAD);
      await expect(build({ siteUrl: 'https://example.com', validate: { failOnError: true } })).rejects.toThrow(/SEO validation failed/);
    });

    it('passes with failOnError when only the 404 page has problems', async () => {
      await expect(build({ siteUrl: 'https://example.com', validate: { failOnError: true } })).resolves.toBeUndefined();
    });
  });

  describe('generateSitemap', () => {
    it('generates valid sitemap XML', () => {
      const sitemap = generateSitemap(
        'https://example.com',
        ['/', '/about'],
        {}
      );

      expect(sitemap).toContain('<?xml version="1.0"');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(sitemap).toContain('<loc>https://example.com</loc>');
      expect(sitemap).toContain('<loc>https://example.com/about</loc>');
    });

    it('gives homepage highest priority', () => {
      const sitemap = generateSitemap(
        'https://example.com',
        ['/', '/about'],
        {}
      );

      expect(sitemap).toMatch(/<loc>https:\/\/example\.com<\/loc>\s*<changefreq>\w+<\/changefreq>\s*<priority>1<\/priority>/);
    });

    it('excludes specified routes', () => {
      const sitemap = generateSitemap(
        'https://example.com',
        ['/', '/about', '/admin', '/admin/users'],
        { exclude: ['/admin'] }
      );

      expect(sitemap).toContain('<loc>https://example.com</loc>');
      expect(sitemap).toContain('<loc>https://example.com/about</loc>');
      expect(sitemap).not.toContain('/admin');
    });

    it('includes custom routes', () => {
      const sitemap = generateSitemap(
        'https://example.com',
        ['/'],
        {
          customRoutes: [
            { path: '/blog/post-1', priority: 0.9, lastmod: '2024-01-15' },
          ],
        }
      );

      expect(sitemap).toContain('<loc>https://example.com/blog/post-1</loc>');
      expect(sitemap).toContain('<priority>0.9</priority>');
      expect(sitemap).toContain('<lastmod>2024-01-15</lastmod>');
    });

    it('uses custom changefreq and priority', () => {
      const sitemap = generateSitemap(
        'https://example.com',
        ['/about'],
        { changefreq: 'daily', priority: 0.9 }
      );

      expect(sitemap).toContain('<changefreq>daily</changefreq>');
      expect(sitemap).toContain('<priority>0.9</priority>');
    });
  });

  describe('generateRobots', () => {
    it('generates valid robots.txt', () => {
      const robots = generateRobots('https://example.com', {});

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
    });

    it('supports custom rules', () => {
      const robots = generateRobots('https://example.com', {
        rules: [
          { userAgent: '*', allow: ['/'], disallow: ['/admin', '/api'] },
        ],
      });

      expect(robots).toContain('Disallow: /admin');
      expect(robots).toContain('Disallow: /api');
    });

    it('supports crawl delay', () => {
      const robots = generateRobots('https://example.com', {
        rules: [
          { userAgent: 'Googlebot', allow: ['/'], crawlDelay: 5 },
        ],
      });

      expect(robots).toContain('User-agent: Googlebot');
      expect(robots).toContain('Crawl-delay: 5');
    });

    it('includes host directive', () => {
      const robots = generateRobots('https://example.com', {
        host: 'https://example.com',
      });

      expect(robots).toContain('Host: https://example.com');
    });
  });

  describe('validatePage', () => {
    it('detects missing title', () => {
      const html = '<html><head></head><body></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'MISSING_TITLE')).toBe(true);
    });

    it('passes when title present', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'MISSING_TITLE')).toBe(false);
    });

    it('detects missing meta description', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'MISSING_META_DESCRIPTION')).toBe(true);
    });

    it('detects missing OG tags', () => {
      const html = '<html><head><title>Test</title></head><body></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'MISSING_OG_TAGS')).toBe(true);
    });

    it('detects missing H1', () => {
      const html = '<html><head><title>Test</title></head><body><h2>Section</h2></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'MISSING_H1')).toBe(true);
    });

    it('detects multiple H1s', () => {
      const html = '<html><head><title>Test</title></head><body><h1>One</h1><h1>Two</h1></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'MULTIPLE_H1')).toBe(true);
    });

    it('detects images without alt', () => {
      const html = '<html><head><title>Test</title></head><body><img src="test.png"></body></html>';
      const issues = validatePage(html);

      expect(issues.some(i => i.code === 'IMG_MISSING_ALT')).toBe(true);
    });

    it('respects disabled checks', () => {
      const html = '<html><head></head><body></body></html>';
      const issues = validatePage(html, {
        checks: { title: false, description: false },
      });

      expect(issues.some(i => i.code === 'MISSING_TITLE')).toBe(false);
      expect(issues.some(i => i.code === 'MISSING_META_DESCRIPTION')).toBe(false);
    });

    it('includes page path in issues', () => {
      const html = '<html><head></head><body></body></html>';
      const issues = validatePage(html, {}, '/about');

      expect(issues[0].page).toBe('/about');
    });

    it('returns no issues for well-optimized page', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Page Title</title>
  <meta name="description" content="Description">
  <meta property="og:title" content="OG Title">
  <link rel="canonical" href="https://example.com">
</head>
<body>
  <h1>Heading</h1>
  <img src="test.png" alt="Test">
</body>
</html>`;

      const issues = validatePage(html);
      expect(issues).toHaveLength(0);
    });
  });

  describe('createHeadContent', () => {
    it('generates title tag', () => {
      const head = createHeadContent({
        title: 'Page Title',
        description: 'Description',
      });

      expect(head).toContain('<title>Page Title</title>');
    });

    it('generates meta description', () => {
      const head = createHeadContent({
        title: 'Title',
        description: 'Page description here',
      });

      expect(head).toContain('<meta name="description" content="Page description here">');
    });

    it('generates canonical link', () => {
      const head = createHeadContent({
        title: 'Title',
        description: 'Description',
        canonical: 'https://example.com/page',
      });

      expect(head).toContain('<link rel="canonical" href="https://example.com/page">');
    });

    it('generates Open Graph tags', () => {
      const head = createHeadContent({
        title: 'Title',
        description: 'Description',
        ogImage: 'https://example.com/image.png',
      });

      expect(head).toContain('<meta property="og:title" content="Title">');
      expect(head).toContain('<meta property="og:description" content="Description">');
      expect(head).toContain('<meta property="og:image" content="https://example.com/image.png">');
    });

    it('generates Twitter Card tags', () => {
      const head = createHeadContent({
        title: 'Title',
        description: 'Description',
        twitterCard: 'summary_large_image',
      });

      expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(head).toContain('<meta name="twitter:title" content="Title">');
    });

    it('generates noindex tag when specified', () => {
      const head = createHeadContent({
        title: 'Title',
        description: 'Description',
        noIndex: true,
      });

      expect(head).toContain('<meta name="robots" content="noindex, nofollow">');
    });

    it('escapes special characters', () => {
      const head = createHeadContent({
        title: 'Title with "quotes" & <special>',
        description: 'Description',
      });

      expect(head).toContain('&quot;');
      expect(head).toContain('&amp;');
      expect(head).toContain('&lt;');
    });
  });

  describe('integration scenarios', () => {
    it('generates complete SEO setup', () => {
      const config: SEOConfig = {
        siteUrl: 'https://example.com',
        sitemap: {
          exclude: ['/admin'],
          customRoutes: [
            { path: '/blog/featured', priority: 1.0 },
          ],
        },
        robots: {
          rules: [
            { userAgent: '*', allow: ['/'], disallow: ['/admin'] },
          ],
        },
      };

      const routes = ['/', '/about', '/blog', '/admin'];

      const sitemap = generateSitemap(
        config.siteUrl,
        routes,
        config.sitemap as any
      );
      const robots = generateRobots(config.siteUrl, config.robots as any);

      // Sitemap should exclude /admin
      expect(sitemap).not.toContain('/admin');
      expect(sitemap).toContain('/blog/featured');

      // Robots should disallow /admin
      expect(robots).toContain('Disallow: /admin');
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
    });
  });
});
