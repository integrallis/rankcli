/**
 * Comprehensive tests for all framework-specific SEO fix generators
 * 
 * Tests 25+ frameworks across JavaScript, Ruby, Python, PHP, Java, C#, Go, and Elixir
 */

import { describe, it, expect } from 'vitest';
import {
  generateReactSEOHead,
  generateNextJsAppRouterMetadata,
  generateNextJsPagesRouterHead,
  generateNuxtSEOHead,
  generateVueSEOHead,
  generateAstroBaseHead,
  generateSvelteKitSEOHead,
  generateAngularSEOService,
  generateRailsSEOHelper,
  generateDjangoSEOHelper,
  generateLaravelSEOHelper,
  generateSpringBootSEO,
  generatePhoenixSEO,
  generateGoSEO,
  generateAspNetCoreSEO,
  generateHTMXSEO,
  generateHugoSEO,
  generateJekyllSEO,
  generateEleventySEO,
  generateRemixSEO,
  getFrameworkSpecificFixExtended,
  type MetaFixOptions,
  type GeneratedCode,
} from './framework-fixes.js';
import type { FrameworkInfo } from '../types.js';

const TEST_OPTIONS: MetaFixOptions = {
  siteName: 'TestSite',
  siteUrl: 'https://example.com',
  title: 'Test Page',
  description: 'A test description for SEO purposes.',
  image: 'https://example.com/og-image.png',
  twitterHandle: '@testsite',
  locale: 'en_US',
};

// Frameworks that use template variables instead of hardcoded values
const TEMPLATE_FRAMEWORKS = ['Hugo', 'Jekyll', 'Eleventy', 'Go'];

// Helper to validate generated code structure
function validateGeneratedCode(result: GeneratedCode, framework: string) {
  // Must have a file path
  expect(result.file, `${framework}: file path`).toBeTruthy();
  expect(typeof result.file).toBe('string');
  
  // Must have code content
  expect(result.code, `${framework}: code content`).toBeTruthy();
  expect(result.code.length, `${framework}: code length`).toBeGreaterThan(100);
  
  // Must have explanation
  expect(result.explanation, `${framework}: explanation`).toBeTruthy();
  
  // Template-based frameworks store site name in config files, not templates
  if (TEMPLATE_FRAMEWORKS.includes(framework)) {
    // Check if site name is in additional files (config.toml, _config.yml, metadata.json)
    const allCode = result.code + (result.additionalFiles?.map(f => f.code).join('') || '');
    expect(allCode, `${framework}: contains site name or URL somewhere`).toMatch(/TestSite|example\.com/);
  } else {
    // Code should contain site name
    expect(result.code, `${framework}: contains site name`).toContain('TestSite');
    // Code should contain site URL
    expect(result.code, `${framework}: contains site URL`).toContain('example.com');
  }
}

// Helper to validate SEO features in generated code
function validateSEOFeatures(code: string, framework: string, additionalFiles?: { code: string }[]) {
  // Combine main code with additional files for template frameworks
  const allCode = code + (additionalFiles?.map(f => f.code).join('') || '');
  
  // Should have Open Graph tags or references
  const hasOG = allCode.includes('og:') || 
                allCode.includes('openGraph') || 
                allCode.includes('og_') ||
                allCode.includes('Open Graph') ||
                allCode.includes('property="og') ||
                allCode.includes("property='og") ||
                allCode.includes('og:type') ||
                allCode.includes('OG');
  expect(hasOG, `${framework}: has Open Graph`).toBe(true);
  
  // Should have Twitter Card tags or references
  const hasTwitter = allCode.includes('twitter:') || 
                     allCode.includes('twitter') ||
                     allCode.includes('Twitter');
  expect(hasTwitter, `${framework}: has Twitter`).toBe(true);
  
  // Should have JSON-LD or schema references
  const hasSchema = allCode.includes('schema.org') || 
                    allCode.includes('json-ld') ||
                    allCode.includes('JSON-LD') ||
                    allCode.includes('application/ld+json') ||
                    allCode.includes('jsonLd') ||
                    allCode.includes('json_ld') ||
                    allCode.includes('Schema');
  expect(hasSchema, `${framework}: has JSON-LD schema`).toBe(true);
}

describe('Framework SEO Fix Generators', () => {
  describe('JavaScript/TypeScript Frameworks', () => {
    it('React (react-helmet-async)', () => {
      const result = generateReactSEOHead(TEST_OPTIONS);
      validateGeneratedCode(result, 'React');
      validateSEOFeatures(result.code, 'React');
      
      expect(result.code).toContain('Helmet');
      expect(result.code).toContain('react-helmet-async');
      expect(result.installCommands).toContain('npm install react-helmet-async');
    });

    it('Next.js App Router (metadata export)', () => {
      const result = generateNextJsAppRouterMetadata(TEST_OPTIONS);
      validateGeneratedCode(result, 'Next.js App Router');
      validateSEOFeatures(result.code, 'Next.js App Router');
      
      expect(result.code).toContain('Metadata');
      expect(result.code).toContain('metadataBase');
      expect(result.additionalFiles?.length).toBeGreaterThan(0);
      
      // Should have robots.ts
      const robotsFile = result.additionalFiles?.find(f => f.file.includes('robots'));
      expect(robotsFile).toBeTruthy();
      
      // Should have sitemap.ts
      const sitemapFile = result.additionalFiles?.find(f => f.file.includes('sitemap'));
      expect(sitemapFile).toBeTruthy();
    });

    it('Next.js Pages Router (Head component)', () => {
      const result = generateNextJsPagesRouterHead(TEST_OPTIONS);
      validateGeneratedCode(result, 'Next.js Pages Router');
      validateSEOFeatures(result.code, 'Next.js Pages Router');
      
      expect(result.code).toContain('next/head');
      expect(result.code).toContain('<Head>');
    });

    it('Nuxt (useHead composable)', () => {
      const result = generateNuxtSEOHead(TEST_OPTIONS);
      validateGeneratedCode(result, 'Nuxt');
      validateSEOFeatures(result.code, 'Nuxt');
      
      expect(result.code).toContain('useHead');
      expect(result.code).toContain('useSEO');
    });

    it('Vue.js (@unhead/vue)', () => {
      const result = generateVueSEOHead(TEST_OPTIONS);
      validateGeneratedCode(result, 'Vue.js');
      validateSEOFeatures(result.code, 'Vue.js');
      
      expect(result.code).toContain('@unhead/vue');
      expect(result.installCommands).toContain('npm install @unhead/vue');
    });

    it('Astro (BaseHead component)', () => {
      const result = generateAstroBaseHead(TEST_OPTIONS);
      validateGeneratedCode(result, 'Astro');
      validateSEOFeatures(result.code, 'Astro');
      
      expect(result.file).toContain('.astro');
      expect(result.code).toContain('Astro.props');
    });

    it('SvelteKit (svelte:head)', () => {
      const result = generateSvelteKitSEOHead(TEST_OPTIONS);
      validateGeneratedCode(result, 'SvelteKit');
      validateSEOFeatures(result.code, 'SvelteKit');
      
      expect(result.code).toContain('svelte:head');
      expect(result.code).toContain('$app/stores');
    });

    it('Angular (SEO Service)', () => {
      const result = generateAngularSEOService(TEST_OPTIONS);
      validateGeneratedCode(result, 'Angular');
      validateSEOFeatures(result.code, 'Angular');
      
      expect(result.code).toContain('@Injectable');
      expect(result.code).toContain('Meta');
      expect(result.code).toContain('Title');
    });

    it('Remix (meta function)', () => {
      const result = generateRemixSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Remix');
      validateSEOFeatures(result.code, 'Remix');
      
      expect(result.code).toContain('V2_MetaFunction');
      expect(result.code).toContain('generateMeta');
    });
  });

  describe('Backend Frameworks', () => {
    it('Ruby on Rails (meta-tags gem)', () => {
      const result = generateRailsSEOHelper(TEST_OPTIONS);
      validateGeneratedCode(result, 'Rails');
      validateSEOFeatures(result.code, 'Rails');
      
      expect(result.file).toContain('.rb');
      expect(result.code).toContain('module SeoHelper');
      expect(result.code).toContain('set_meta_tags');
      expect(result.code).toContain('json_ld_tags');
      expect(result.installCommands).toContain('bundle add meta-tags');
      
      // Should have layout file
      const layoutFile = result.additionalFiles?.find(f => f.file.includes('application.html.erb'));
      expect(layoutFile).toBeTruthy();
    });

    it('Django (django-meta)', () => {
      const result = generateDjangoSEOHelper(TEST_OPTIONS);
      validateGeneratedCode(result, 'Django');
      validateSEOFeatures(result.code, 'Django');
      
      expect(result.file).toContain('.py');
      expect(result.code).toContain('class SEOMeta');
      expect(result.code).toContain('SEOContextMixin');
      expect(result.code).toContain('def article_schema');
      expect(result.installCommands).toContain('pip install django-meta');
      
      // Should have base.html template
      const templateFile = result.additionalFiles?.find(f => f.file.includes('base.html'));
      expect(templateFile).toBeTruthy();
    });

    it('Laravel (Blade + SEOService)', () => {
      const result = generateLaravelSEOHelper(TEST_OPTIONS);
      validateGeneratedCode(result, 'Laravel');
      validateSEOFeatures(result.code, 'Laravel');
      
      expect(result.file).toContain('.php');
      expect(result.code).toContain('class SEOService');
      expect(result.code).toContain('namespace App\\Services');
      expect(result.code).toContain('public function setMeta');
      
      // Should have Blade component
      const bladeFile = result.additionalFiles?.find(f => f.file.includes('.blade.php'));
      expect(bladeFile).toBeTruthy();
    });

    it('Spring Boot (Thymeleaf)', () => {
      const result = generateSpringBootSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Spring Boot');
      validateSEOFeatures(result.code, 'Spring Boot');
      
      expect(result.file).toContain('.java');
      expect(result.code).toContain('public class SEOService');
      expect(result.code).toContain('@Service');
      expect(result.code).toContain('Map<String, Object>');
      
      // Should have Thymeleaf fragment
      const thymeleafFile = result.additionalFiles?.find(f => f.file.includes('.html'));
      expect(thymeleafFile).toBeTruthy();
      expect(thymeleafFile?.code).toContain('th:');
    });

    it('Phoenix/Elixir (HEEx)', () => {
      const result = generatePhoenixSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Phoenix');
      validateSEOFeatures(result.code, 'Phoenix');
      
      expect(result.file).toContain('.ex');
      expect(result.code).toContain('defmodule');
      expect(result.code).toContain('use Phoenix.Component');
      expect(result.code).toContain('def seo_meta');
      expect(result.code).toContain('~H"""');
    });

    it('Go (Gin/Echo/Fiber templates)', () => {
      const result = generateGoSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Go');
      validateSEOFeatures(result.code, 'Go', result.additionalFiles);
      
      expect(result.file).toContain('.go');
      expect(result.code).toContain('package seo');
      expect(result.code).toContain('type Meta struct');
      expect(result.code).toContain('func WebsiteSchema');
      
      // Should have Go template
      const templateFile = result.additionalFiles?.find(f => f.file.includes('.html'));
      expect(templateFile).toBeTruthy();
      expect(templateFile?.code).toContain('{{');
    });

    it('ASP.NET Core (Razor)', () => {
      const result = generateAspNetCoreSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'ASP.NET Core');
      validateSEOFeatures(result.code, 'ASP.NET Core');
      
      expect(result.file).toContain('.cs');
      expect(result.code).toContain('public class SEOService');
      expect(result.code).toContain('namespace');
      expect(result.code).toContain('public class SEOMeta');
      
      // Should have Razor partial
      const razorFile = result.additionalFiles?.find(f => f.file.includes('.cshtml'));
      expect(razorFile).toBeTruthy();
    });
  });

  describe('Hypermedia Frameworks', () => {
    it('HTMX (server-rendered)', () => {
      const result = generateHTMXSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'HTMX');
      validateSEOFeatures(result.code, 'HTMX');
      
      expect(result.code).toContain('HTMX');
      expect(result.code).toContain('server-rendered');
      
      // Should have base template
      const baseFile = result.additionalFiles?.find(f => f.file.includes('base.html'));
      expect(baseFile).toBeTruthy();
      expect(baseFile?.code).toContain('hx-boost');
    });
  });

  describe('Static Site Generators', () => {
    it('Hugo (Go templates)', () => {
      const result = generateHugoSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Hugo');
      validateSEOFeatures(result.code, 'Hugo', result.additionalFiles);
      
      expect(result.file).toContain('partials');
      expect(result.code).toContain('{{-');
      expect(result.code).toContain('.Title');
      expect(result.code).toContain('site.Title');
      
      // Should have config.toml
      const configFile = result.additionalFiles?.find(f => f.file.includes('config.toml'));
      expect(configFile).toBeTruthy();
    });

    it('Jekyll (Liquid templates)', () => {
      const result = generateJekyllSEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Jekyll');
      validateSEOFeatures(result.code, 'Jekyll', result.additionalFiles);
      
      expect(result.file).toContain('_includes');
      expect(result.code).toContain('{%');
      expect(result.code).toContain('page.title');
      expect(result.code).toContain('site.title');
      
      // Should have _config.yml
      const configFile = result.additionalFiles?.find(f => f.file.includes('_config.yml'));
      expect(configFile).toBeTruthy();
    });

    it('Eleventy (Nunjucks templates)', () => {
      const result = generateEleventySEO(TEST_OPTIONS);
      validateGeneratedCode(result, 'Eleventy');
      validateSEOFeatures(result.code, 'Eleventy', result.additionalFiles);
      
      expect(result.file).toContain('.njk');
      expect(result.code).toContain('{%');
      expect(result.code).toContain('metadata');
      
      // Should have metadata.json
      const metadataFile = result.additionalFiles?.find(f => f.file.includes('metadata.json'));
      expect(metadataFile).toBeTruthy();
    });
  });

  describe('Framework Detection Integration', () => {
    const frameworks: Array<{ name: string; info: FrameworkInfo }> = [
      { name: 'React', info: { name: 'react', metaPattern: 'head-component' } },
      { name: 'Next.js App', info: { name: 'nextjs', router: 'app', metaPattern: 'metadata-export' } },
      { name: 'Next.js Pages', info: { name: 'nextjs', router: 'pages', metaPattern: 'head-component' } },
      { name: 'Vue', info: { name: 'vue', metaPattern: 'head-component' } },
      { name: 'Nuxt', info: { name: 'nuxt', metaPattern: 'head-component' } },
      { name: 'Angular', info: { name: 'angular', metaPattern: 'head-component' } },
      { name: 'Svelte', info: { name: 'svelte', metaPattern: 'head-component' } },
      { name: 'SvelteKit', info: { name: 'sveltekit', metaPattern: 'head-component' } },
      { name: 'Astro', info: { name: 'astro', metaPattern: 'frontmatter' } },
      { name: 'Remix', info: { name: 'remix', metaPattern: 'meta-function' } },
      { name: 'Rails', info: { name: 'rails', language: 'ruby', metaPattern: 'erb-helpers' } },
      { name: 'Django', info: { name: 'django', language: 'python', metaPattern: 'django-templates' } },
      { name: 'Laravel', info: { name: 'laravel', language: 'php', metaPattern: 'blade-components' } },
      { name: 'Spring', info: { name: 'spring', language: 'java', metaPattern: 'thymeleaf' } },
      { name: 'ASP.NET', info: { name: 'aspnet', language: 'csharp', metaPattern: 'razor' } },
      { name: 'Phoenix', info: { name: 'phoenix', language: 'elixir', metaPattern: 'heex' } },
      { name: 'Go', info: { name: 'go', language: 'go', metaPattern: 'go-templates' } },
      { name: 'HTMX', info: { name: 'htmx', metaPattern: 'server-rendered' } },
      { name: 'Hugo', info: { name: 'hugo', metaPattern: 'frontmatter' } },
      { name: 'Jekyll', info: { name: 'jekyll', metaPattern: 'frontmatter' } },
      { name: 'Eleventy', info: { name: 'eleventy', metaPattern: 'frontmatter' } },
    ];

    for (const { name, info } of frameworks) {
      it(`getFrameworkSpecificFixExtended returns valid code for ${name}`, () => {
        const result = getFrameworkSpecificFixExtended(info, TEST_OPTIONS);
        validateGeneratedCode(result, name);
        validateSEOFeatures(result.code, name, result.additionalFiles);
      });
    }
  });

  describe('Generated Code Quality', () => {
    it('all generators include robots.txt', () => {
      const generators = [
        generateNextJsAppRouterMetadata,
        generateNuxtSEOHead,
        generateRailsSEOHelper,
        generateDjangoSEOHelper,
        generateLaravelSEOHelper,
        generateSpringBootSEO,
        generatePhoenixSEO,
        generateGoSEO,
        generateAspNetCoreSEO,
        generateHTMXSEO,
        generateHugoSEO,
        generateJekyllSEO,
        generateEleventySEO,
      ];

      for (const generator of generators) {
        const result = generator(TEST_OPTIONS);
        const hasRobots = result.additionalFiles?.some(f => 
          f.file.includes('robots') || f.code.includes('User-agent')
        );
        expect(hasRobots, `${generator.name}: has robots.txt`).toBe(true);
      }
    });

    it('all generators include AI crawler support (GPTBot)', () => {
      const generators = [
        generateNextJsAppRouterMetadata,
        generateNuxtSEOHead,
        generateRailsSEOHelper,
        generateDjangoSEOHelper,
        generateLaravelSEOHelper,
        generateSpringBootSEO,
        generatePhoenixSEO,
        generateGoSEO,
        generateAspNetCoreSEO,
        generateHTMXSEO,
        generateHugoSEO,
        generateJekyllSEO,
        generateEleventySEO,
      ];

      for (const generator of generators) {
        const result = generator(TEST_OPTIONS);
        const robotsFile = result.additionalFiles?.find(f => 
          f.file.includes('robots') || f.code.includes('User-agent')
        );
        expect(robotsFile?.code, `${generator.name}: GPTBot support`).toContain('GPTBot');
      }
    });

    it('all generators produce valid schema generators', () => {
      const generators = [
        generateReactSEOHead,
        generateNextJsAppRouterMetadata,
        generateNuxtSEOHead,
        generateAngularSEOService,
        generateRailsSEOHelper,
        generateDjangoSEOHelper,
        generateLaravelSEOHelper,
        generateSpringBootSEO,
        generatePhoenixSEO,
        generateGoSEO,
        generateAspNetCoreSEO,
        generateRemixSEO,
      ];

      for (const generator of generators) {
        const result = generator(TEST_OPTIONS);
        const allCode = result.code + (result.additionalFiles?.map(f => f.code).join('') || '');
        
        // Should have article schema generator
        expect(allCode, `${generator.name}: article schema`).toMatch(/article|Article/);
        
        // Should have product schema generator (most frameworks)
        if (!['generateHTMXSEO'].includes(generator.name)) {
          expect(allCode, `${generator.name}: product schema`).toMatch(/product|Product/i);
        }
      }
    });
  });
});
