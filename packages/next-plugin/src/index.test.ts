import { describe, it, expect } from 'vitest';
import {
  withSEO,
  generateSitemapEntries,
  generateSitemapXml,
  generateRobotsTxt,
  validateMetadata,
  createRobotsHandler,
  SEOConfig,
} from './index.js';
import {
  createMetadataGenerator,
  mergeMetadata,
  createJsonLd,
  createWebsiteJsonLd,
  createArticleJsonLd,
  createSoftwareJsonLd,
} from './metadata.js';

describe('next-seo-autopilot', () => {
  const baseConfig: SEOConfig = {
    siteUrl: 'https://example.com',
  };

  describe('withSEO', () => {
    it('returns a function that enhances Next.js config', () => {
      const enhance = withSEO(baseConfig);
      expect(typeof enhance).toBe('function');
    });

    it('adds publicRuntimeConfig with SEO settings', () => {
      const enhance = withSEO({
        ...baseConfig,
        defaultMetadata: {
          title: 'My Site',
          description: 'Site description',
        },
      });

      const config = enhance({});

      expect(config.publicRuntimeConfig?.seoAutopilot).toBeDefined();
      expect(config.publicRuntimeConfig?.seoAutopilot.siteUrl).toBe('https://example.com');
    });

    it('preserves existing Next.js config', () => {
      const enhance = withSEO(baseConfig);
      const config = enhance({
        reactStrictMode: true,
        images: { domains: ['example.com'] },
      });

      expect(config.reactStrictMode).toBe(true);
      expect(config.images?.domains).toContain('example.com');
    });

    it('adds security headers', async () => {
      const enhance = withSEO(baseConfig);
      const config = enhance({});

      const headers = await config.headers!();

      expect(headers).toHaveLength(1);
      expect(headers[0].headers).toContainEqual({
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      });
    });
  });

  describe('generateSitemapEntries', () => {
    it('generates entries from routes', () => {
      const entries = generateSitemapEntries(
        ['/', '/about', '/contact'],
        baseConfig
      );

      expect(entries).toHaveLength(3);
      expect(entries[0].url).toBe('https://example.com/');
      expect(entries[1].url).toBe('https://example.com/about');
    });

    it('gives homepage highest priority', () => {
      const entries = generateSitemapEntries(['/', '/other'], baseConfig);

      expect(entries[0].priority).toBe(1.0);
      expect(entries[1].priority).toBe(0.8);
    });

    it('excludes specified routes', () => {
      const entries = generateSitemapEntries(
        ['/', '/about', '/admin', '/admin/users'],
        { ...baseConfig, excludeRoutes: ['/admin'] }
      );

      expect(entries).toHaveLength(2);
      expect(entries.some(e => e.url.includes('/admin'))).toBe(false);
    });

    it('includes additional URLs', () => {
      const entries = generateSitemapEntries(
        ['/'],
        {
          ...baseConfig,
          additionalSitemapUrls: [
            { url: 'https://example.com/blog/post-1', priority: 0.9 },
          ],
        }
      );

      expect(entries).toHaveLength(2);
      expect(entries[1].url).toBe('https://example.com/blog/post-1');
    });
  });

  describe('generateSitemapXml', () => {
    it('generates valid XML', () => {
      const xml = generateSitemapXml([
        { url: 'https://example.com/', priority: 1.0 },
      ]);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(xml).toContain('</urlset>');
    });

    it('includes all entry properties', () => {
      const xml = generateSitemapXml([
        {
          url: 'https://example.com/page',
          lastModified: '2024-01-15',
          changeFrequency: 'daily',
          priority: 0.9,
        },
      ]);

      expect(xml).toContain('<loc>https://example.com/page</loc>');
      expect(xml).toContain('<lastmod>2024-01-15</lastmod>');
      expect(xml).toContain('<changefreq>daily</changefreq>');
      expect(xml).toContain('<priority>0.9</priority>');
    });

    it('handles Date objects for lastModified', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const xml = generateSitemapXml([
        { url: 'https://example.com/', lastModified: date },
      ]);

      expect(xml).toContain('<lastmod>2024-01-15');
    });

    it('escapes special characters', () => {
      const xml = generateSitemapXml([
        { url: 'https://example.com/search?q=test&page=1' },
      ]);

      expect(xml).toContain('&amp;');
    });
  });

  describe('generateRobotsTxt', () => {
    it('generates valid robots.txt', () => {
      const robots = generateRobotsTxt(baseConfig);

      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Allow: /');
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
    });

    it('supports custom rules', () => {
      const robots = generateRobotsTxt({
        ...baseConfig,
        robotsConfig: {
          rules: [
            { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
            { userAgent: 'Googlebot', allow: '/' },
          ],
        },
      });

      expect(robots).toContain('Disallow: /admin');
      expect(robots).toContain('Disallow: /api');
      expect(robots).toContain('User-agent: Googlebot');
    });

    it('supports crawl delay', () => {
      const robots = generateRobotsTxt({
        ...baseConfig,
        robotsConfig: {
          rules: [{ userAgent: '*', allow: '/', crawlDelay: 10 }],
        },
      });

      expect(robots).toContain('Crawl-delay: 10');
    });

    it('includes host directive', () => {
      const robots = generateRobotsTxt({
        ...baseConfig,
        robotsConfig: {
          host: 'https://example.com',
        },
      });

      expect(robots).toContain('Host: https://example.com');
    });
  });

  describe('validateMetadata', () => {
    it('returns valid for complete metadata', () => {
      const result = validateMetadata({
        title: 'Page Title',
        description: 'Page description',
        openGraph: { title: 'OG Title', images: [{ url: '/image.png' }] },
        twitter: { card: 'summary' },
      });

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('detects missing title', () => {
      const result = validateMetadata({
        description: 'Has description',
      });

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === 'MISSING_TITLE')).toBe(true);
    });

    it('detects missing description', () => {
      const result = validateMetadata({
        title: 'Has title',
      });

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === 'MISSING_DESCRIPTION')).toBe(true);
    });

    it('warns about missing OG tags', () => {
      const result = validateMetadata({
        title: 'Title',
        description: 'Description',
      });

      expect(result.issues.some(i => i.code === 'MISSING_OG_TITLE')).toBe(true);
      expect(result.issues.some(i => i.code === 'MISSING_OG_IMAGE')).toBe(true);
    });
  });

  describe('createMetadataGenerator', () => {
    it('generates metadata with defaults', () => {
      const generate = createMetadataGenerator({
        siteUrl: 'https://example.com',
        siteName: 'My Site',
        defaultTitle: 'My Site',
        defaultDescription: 'Welcome to my site',
      });

      const metadata = generate();

      expect(metadata.title).toBe('My Site');
      expect(metadata.description).toBe('Welcome to my site');
    });

    it('applies title template', () => {
      const generate = createMetadataGenerator({
        siteUrl: 'https://example.com',
        titleTemplate: '%s | My Site',
      });

      const metadata = generate({ title: 'About' });

      expect(metadata.title).toBe('About | My Site');
    });

    it('generates canonical URL from path', () => {
      const generate = createMetadataGenerator({
        siteUrl: 'https://example.com',
      });

      const metadata = generate({ path: '/about' });

      expect(metadata.alternates?.canonical).toBe('https://example.com/about');
    });

    it('generates Open Graph metadata', () => {
      const generate = createMetadataGenerator({
        siteUrl: 'https://example.com',
        siteName: 'My Site',
      });

      const metadata = generate({
        title: 'Page Title',
        description: 'Page description',
        image: '/og-image.png',
      });

      expect(metadata.openGraph?.title).toBe('Page Title');
      expect(metadata.openGraph?.siteName).toBe('My Site');
      expect(metadata.openGraph?.images?.[0].url).toBe('https://example.com/og-image.png');
    });

    it('generates Twitter metadata', () => {
      const generate = createMetadataGenerator({
        siteUrl: 'https://example.com',
        twitterHandle: '@example',
      });

      const metadata = generate({
        title: 'Page',
        image: '/image.png',
      });

      expect(metadata.twitter?.card).toBe('summary_large_image');
      expect(metadata.twitter?.site).toBe('@example');
    });

    it('handles noIndex', () => {
      const generate = createMetadataGenerator({
        siteUrl: 'https://example.com',
      });

      const metadata = generate({ noIndex: true });

      expect(metadata.robots).toEqual({ index: false, follow: false });
    });
  });

  describe('mergeMetadata', () => {
    it('merges simple properties', () => {
      const result = mergeMetadata(
        { title: 'Original' },
        { title: 'Override', description: 'New description' }
      );

      expect(result.title).toBe('Override');
      expect(result.description).toBe('New description');
    });

    it('merges nested objects', () => {
      const result = mergeMetadata(
        { openGraph: { title: 'OG Title' } },
        { openGraph: { description: 'OG Description' } }
      );

      expect(result.openGraph?.title).toBe('OG Title');
      expect(result.openGraph?.description).toBe('OG Description');
    });

    it('handles undefined values', () => {
      const result = mergeMetadata(
        { title: 'Title' },
        undefined,
        { description: 'Description' }
      );

      expect(result.title).toBe('Title');
      expect(result.description).toBe('Description');
    });
  });

  describe('JSON-LD helpers', () => {
    it('createJsonLd generates valid JSON', () => {
      const jsonLd = createJsonLd('WebSite', { name: 'My Site' });
      const parsed = JSON.parse(jsonLd);

      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('WebSite');
      expect(parsed.name).toBe('My Site');
    });

    it('cannot break out of the <script> tag it is rendered into', () => {
      const hostile = '</script><script>alert(1)</script> & <!--';
      const jsonLd = createArticleJsonLd({
        headline: hostile,
        description: hostile,
        datePublished: '2026-01-01',
        author: { name: hostile },
      });

      expect(jsonLd).not.toMatch(/<\/script/i);
      expect(jsonLd).not.toContain('<');
      expect(jsonLd).not.toContain('>');
      // Still the same data to any JSON parser.
      expect(JSON.parse(jsonLd).headline).toBe(hostile);
      expect(JSON.parse(jsonLd).author.name).toBe(hostile);
    });

    it('createWebsiteJsonLd includes search action', () => {
      const jsonLd = createWebsiteJsonLd({
        name: 'My Site',
        url: 'https://example.com',
        searchUrl: 'https://example.com/search?q={search_term_string}',
      });
      const parsed = JSON.parse(jsonLd);

      expect(parsed.potentialAction['@type']).toBe('SearchAction');
    });

    it('createArticleJsonLd includes author', () => {
      const jsonLd = createArticleJsonLd({
        headline: 'Article Title',
        author: { name: 'John Doe', url: 'https://example.com/john' },
      });
      const parsed = JSON.parse(jsonLd);

      expect(parsed.author['@type']).toBe('Person');
      expect(parsed.author.name).toBe('John Doe');
    });

    it('createSoftwareJsonLd includes offers', () => {
      const jsonLd = createSoftwareJsonLd({
        name: 'SEO Autopilot',
        offers: { price: '29', priceCurrency: 'USD' },
      });
      const parsed = JSON.parse(jsonLd);

      expect(parsed['@type']).toBe('SoftwareApplication');
      expect(parsed.offers['@type']).toBe('Offer');
      expect(parsed.offers.price).toBe('29');
    });
  });
});
