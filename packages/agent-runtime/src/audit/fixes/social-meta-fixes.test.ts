import { describe, it, expect } from 'vitest';
import {
  detectFramework,
  generateHTMLSocialMeta,
  generateReactHelmetSocialMeta,
  generateNextAppMetadata,
  generateNextPagesHead,
  generateAstroMeta,
  generateRemixMeta,
  generateSvelteKitMeta,
  generateSocialMetaFix,
  generateCompleteSocialMetaSetup,
  OG_IMAGE_SPECS,
  type SocialMetaConfig,
} from './social-meta-fixes.js';

describe('social-meta-fixes', () => {
  const defaultConfig: SocialMetaConfig = {
    title: 'Test Page',
    description: 'A test description for SEO',
    image: 'https://example.com/og.png',
    url: 'https://example.com',
    siteName: 'Example Site',
    twitterSite: '@example',
    twitterCreator: '@author',
    type: 'website',
    locale: 'en_US',
  };

  describe('detectFramework', () => {
    it('detects Next.js App Router', () => {
      // The path check looks for '/app/' or '\\app\\' in the file paths
      const files = ['next.config.js', 'src/app/page.tsx', 'src/app/layout.tsx'];
      expect(detectFramework(files)).toBe('nextjs-app');
    });

    it('detects Next.js Pages Router', () => {
      const files = ['next.config.js', 'pages/index.tsx', 'pages/_app.tsx'];
      expect(detectFramework(files)).toBe('nextjs-pages');
    });

    it('detects Astro', () => {
      const files = ['astro.config.mjs', 'src/pages/index.astro'];
      expect(detectFramework(files)).toBe('astro');
    });

    it('detects Remix', () => {
      const files = ['remix.config.js', 'app/root.tsx'];
      expect(detectFramework(files)).toBe('remix');
    });

    it('detects SvelteKit', () => {
      const files = ['svelte.config.js', 'src/routes/+page.svelte'];
      expect(detectFramework(files)).toBe('sveltekit');
    });

    it('detects Vite React', () => {
      const files = ['vite.config.ts', 'src/App.tsx', 'index.html'];
      expect(detectFramework(files)).toBe('vite-react');
    });

    it('detects plain React', () => {
      const files = ['src/App.tsx', 'src/index.tsx'];
      expect(detectFramework(files)).toBe('react');
    });

    it('defaults to HTML', () => {
      const files = ['index.html', 'styles.css'];
      expect(detectFramework(files)).toBe('html');
    });

    it('is case-insensitive for config files', () => {
      // Config files are lowercased, but path check needs /app/ or \\app\\
      const files = ['NEXT.CONFIG.JS', 'src/app/page.tsx'];
      expect(detectFramework(files)).toBe('nextjs-app');
    });
  });

  describe('generateHTMLSocialMeta', () => {
    it('generates complete HTML meta tags', () => {
      const result = generateHTMLSocialMeta(defaultConfig);

      // Primary meta tags
      expect(result).toContain('<title>Test Page</title>');
      expect(result).toContain('<meta name="title" content="Test Page" />');
      expect(result).toContain('<meta name="description" content="A test description for SEO" />');

      // Open Graph tags
      expect(result).toContain('<meta property="og:type" content="website" />');
      expect(result).toContain('<meta property="og:url" content="https://example.com" />');
      expect(result).toContain('<meta property="og:title" content="Test Page" />');
      expect(result).toContain('<meta property="og:image" content="https://example.com/og.png" />');
      expect(result).toContain('<meta property="og:site_name" content="Example Site" />');
      expect(result).toContain('<meta property="og:locale" content="en_US" />');

      // Twitter tags
      expect(result).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(result).toContain('<meta name="twitter:title" content="Test Page" />');
      expect(result).toContain('<meta name="twitter:site" content="@example" />');
      expect(result).toContain('<meta name="twitter:creator" content="@author" />');
    });

    it('omits optional fields when not provided', () => {
      const minimalConfig: SocialMetaConfig = {
        title: 'Minimal',
        description: 'Minimal description',
        image: 'https://example.com/og.png',
        url: 'https://example.com',
      };
      const result = generateHTMLSocialMeta(minimalConfig);

      expect(result).not.toContain('og:site_name');
      expect(result).not.toContain('twitter:site');
      expect(result).not.toContain('twitter:creator');
    });
  });

  describe('generateReactHelmetSocialMeta', () => {
    it('generates React Helmet component', () => {
      const result = generateReactHelmetSocialMeta(defaultConfig);

      expect(result).toContain("import { Helmet } from 'react-helmet-async'");
      expect(result).toContain('export function SEO');
      expect(result).toContain('<Helmet>');
      expect(result).toContain('<title>{title}</title>');
      expect(result).toContain('og:type');
      expect(result).toContain('twitter:card');
    });

    it('includes default props', () => {
      const result = generateReactHelmetSocialMeta(defaultConfig);

      expect(result).toContain('title = "Test Page"');
      expect(result).toContain('description = "A test description for SEO"');
    });
  });

  describe('generateNextAppMetadata', () => {
    it('generates Next.js App Router metadata', () => {
      const result = generateNextAppMetadata(defaultConfig);

      expect(result).toContain("import type { Metadata } from 'next'");
      expect(result).toContain('export const metadata: Metadata');
      expect(result).toContain('title: "Test Page"');
      expect(result).toContain('openGraph:');
      expect(result).toContain('twitter:');
      expect(result).toContain("card: 'summary_large_image'");
    });

    it('includes image dimensions', () => {
      const result = generateNextAppMetadata(defaultConfig);

      expect(result).toContain('width: 1200');
      expect(result).toContain('height: 630');
    });
  });

  describe('generateNextPagesHead', () => {
    it('generates Next.js Pages Router Head component', () => {
      const result = generateNextPagesHead(defaultConfig);

      expect(result).toContain("import Head from 'next/head'");
      expect(result).toContain('<Head>');
      expect(result).toContain('<title>Test Page</title>');
      expect(result).toContain('og:title');
      expect(result).toContain('twitter:card');
    });
  });

  describe('generateAstroMeta', () => {
    it('generates Astro component with frontmatter', () => {
      const result = generateAstroMeta(defaultConfig);

      expect(result).toContain('---');
      expect(result).toContain('export interface Props');
      expect(result).toContain('Astro.props');
      expect(result).toContain('<title>{title}</title>');
      expect(result).toContain('og:type');
      expect(result).toContain('twitter:card');
    });

    it('uses Astro.url for dynamic URL', () => {
      const result = generateAstroMeta(defaultConfig);

      expect(result).toContain('url = Astro.url.href');
    });
  });

  describe('generateRemixMeta', () => {
    it('generates Remix meta function', () => {
      const result = generateRemixMeta(defaultConfig);

      expect(result).toContain("import type { MetaFunction } from \"@remix-run/node\"");
      expect(result).toContain('export const meta: MetaFunction');
      expect(result).toContain('return [');
      expect(result).toContain('{ title: "Test Page" }');
      expect(result).toContain('{ property: "og:title"');
      expect(result).toContain('{ name: "twitter:card"');
    });
  });

  describe('generateSvelteKitMeta', () => {
    it('generates SvelteKit svelte:head', () => {
      const result = generateSvelteKitMeta(defaultConfig);

      expect(result).toContain('<svelte:head>');
      expect(result).toContain('<title>Test Page</title>');
      expect(result).toContain('og:type');
      expect(result).toContain('twitter:card');
    });
  });

  describe('generateSocialMetaFix', () => {
    const existingData = {
      openGraph: {},
      twitter: {},
      hasFavicon: false,
    };

    it('generates fix for missing OG title', () => {
      const fix = generateSocialMetaFix(
        'OG_TITLE_MISSING',
        'html',
        existingData,
        { url: 'https://example.com', title: 'My Page' }
      );

      expect(fix.issueCode).toBe('OG_TITLE_MISSING');
      expect(fix.framework).toBe('html');
      expect(fix.filePath).toBe('index.html');
      expect(fix.after).toContain('og:title');
      expect(fix.explanation).toContain('Open Graph title');
    });

    it('generates fix for missing Twitter Card', () => {
      const fix = generateSocialMetaFix(
        'TWITTER_CARD_MISSING',
        'react',
        existingData,
        { url: 'https://example.com' }
      );

      expect(fix.issueCode).toBe('TWITTER_CARD_MISSING');
      expect(fix.filePath).toBe('src/components/SEO.tsx');
      expect(fix.after).toContain('twitter:card');
      expect(fix.after).toContain('summary_large_image');
    });

    it('uses correct file paths for each framework', () => {
      const frameworks = [
        { framework: 'html' as const, expectedPath: 'index.html' },
        { framework: 'react' as const, expectedPath: 'src/components/SEO.tsx' },
        { framework: 'vite-react' as const, expectedPath: 'index.html' },
        { framework: 'nextjs-app' as const, expectedPath: 'app/layout.tsx' },
        { framework: 'nextjs-pages' as const, expectedPath: 'pages/_app.tsx' },
        { framework: 'astro' as const, expectedPath: 'src/components/BaseHead.astro' },
        { framework: 'remix' as const, expectedPath: 'app/root.tsx' },
        { framework: 'sveltekit' as const, expectedPath: 'src/routes/+layout.svelte' },
      ];

      frameworks.forEach(({ framework, expectedPath }) => {
        const fix = generateSocialMetaFix(
          'OG_TITLE_MISSING',
          framework,
          existingData,
          { url: 'https://example.com' }
        );
        expect(fix.filePath).toBe(expectedPath);
      });
    });

    it('throws error for unknown issue code', () => {
      expect(() =>
        generateSocialMetaFix(
          'UNKNOWN_ISSUE',
          'html',
          existingData,
          { url: 'https://example.com' }
        )
      ).toThrow('Unknown issue code: UNKNOWN_ISSUE');
    });
  });

  describe('generateCompleteSocialMetaSetup', () => {
    it('generates complete setup for each framework', () => {
      const frameworks = [
        'html',
        'react',
        'vite-react',
        'nextjs-app',
        'nextjs-pages',
        'astro',
        'remix',
        'sveltekit',
      ] as const;

      frameworks.forEach((framework) => {
        const result = generateCompleteSocialMetaSetup(framework, defaultConfig);

        expect(result).toHaveProperty('filePath');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('explanation');
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.explanation).toContain(framework);
      });
    });
  });

  describe('OG_IMAGE_SPECS', () => {
    it('has recommended dimensions', () => {
      expect(OG_IMAGE_SPECS.recommended.width).toBe(1200);
      expect(OG_IMAGE_SPECS.recommended.height).toBe(630);
    });

    it('has Twitter specs', () => {
      expect(OG_IMAGE_SPECS.twitter.summary_large_image.width).toBe(1200);
      expect(OG_IMAGE_SPECS.twitter.summary_large_image.height).toBe(600);
    });

    it('has Facebook specs', () => {
      expect(OG_IMAGE_SPECS.facebook.recommended.width).toBe(1200);
      expect(OG_IMAGE_SPECS.facebook.recommended.height).toBe(630);
    });

    it('has LinkedIn specs', () => {
      expect(OG_IMAGE_SPECS.linkedin.recommended.width).toBe(1200);
    });
  });
});
