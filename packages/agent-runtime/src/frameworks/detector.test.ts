import { describe, it, expect } from 'vitest';
import {
  detectFromHtml,
  detectFromPackageJson,
  detectFromHeaders,
  detectFramework,
  getFrameworkDisplayName,
} from './detector.js';

describe('Framework Detector', () => {
  describe('detectFromHtml', () => {
    it('detects Next.js from __next data', () => {
      const html = '<div id="__next"><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('nextjs');
      expect(result?.confidence).toBe('high');
    });

    it('detects Next.js from _next scripts', () => {
      const html = '<script src="/_next/static/chunks/main.js"></script>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('nextjs');
    });

    it('detects Nuxt from __nuxt data', () => {
      const html = '<div id="__nuxt"><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('nuxt');
    });

    it('detects Gatsby from ___gatsby', () => {
      const html = '<div id="___gatsby"><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('gatsby');
    });

    it('detects Astro from data-astro attributes', () => {
      const html = '<div data-astro-cid-xyz><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('astro');
    });

    it('detects SvelteKit from __sveltekit', () => {
      const html = '<div id="__sveltekit"><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('sveltekit');
    });

    it('detects React from data-reactroot', () => {
      const html = '<div data-reactroot><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('react');
    });

    it('detects React 18+ (createRoot) from an empty #root div', () => {
      // React 18's createRoot() never adds data-reactroot - a modern
      // CRA/Vite React app's unhydrated HTML is just an empty root div.
      const html = '<html><body><div id="root"></div><script src="/assets/index.js"></script></body></html>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('react');
    });

    it('detects Vue from data-v- attributes', () => {
      const html = '<div data-v-abc123><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('vue');
    });

    it('detects Angular from ng-version', () => {
      const html = '<app-root ng-version="17.0.0"><h1>Hello</h1></app-root>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('angular');
    });

    it('detects Angular from _ngcontent', () => {
      const html = '<div _ngcontent-abc-c123><h1>Hello</h1></div>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('angular');
    });

    it('detects WordPress from wp-content', () => {
      const html = '<link rel="stylesheet" href="/wp-content/themes/theme/style.css">';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('wordpress');
    });

    it('detects WordPress from a generator meta tag', () => {
      const html = '<meta name="generator" content="WordPress 6.5.2">';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('wordpress');
    });

    // rankcli.dev's own copy lists the frameworks it supports, which used to be enough
    // to detect a React SPA as WordPress and advise it to install an SEO plugin.
    it('does not detect WordPress, Laravel or Symfony from prose that names them', () => {
      const html =
        '<div id="root"></div><p>Detects Next.js, Astro, Rails, Django, Laravel, Symfony and WordPress.</p>';
      const result = detectFromHtml(html);
      expect(result?.framework).not.toBe('wordpress');
      expect(result?.framework).not.toBe('laravel');
      expect(result?.framework).not.toBe('symfony');
    });

    it('detects Rails from turbolinks', () => {
      const html = '<script src="/assets/turbolinks.js"></script>';
      const result = detectFromHtml(html);
      expect(result?.framework).toBe('rails');
    });

    it('returns null for unknown HTML', () => {
      const html = '<html><body><h1>Hello</h1></body></html>';
      const result = detectFromHtml(html);
      expect(result).toBeNull();
    });
  });

  describe('detectFromPackageJson', () => {
    it('detects Next.js from dependencies', () => {
      const packageJson = {
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      };
      const result = detectFromPackageJson(packageJson);
      expect(result?.framework).toBe('nextjs');
      expect(result?.version).toBe('^14.0.0');
      expect(result?.meta_framework).toBe('react');
    });

    it('detects Nuxt from dependencies', () => {
      const packageJson = {
        dependencies: { nuxt: '^3.0.0', vue: '^3.0.0' },
      };
      const result = detectFromPackageJson(packageJson);
      expect(result?.framework).toBe('nuxt');
      expect(result?.meta_framework).toBe('vue');
    });

    it('detects React from devDependencies', () => {
      const packageJson = {
        devDependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      };
      const result = detectFromPackageJson(packageJson);
      expect(result?.framework).toBe('react');
    });

    it('detects Astro', () => {
      const packageJson = {
        dependencies: { astro: '^4.0.0' },
      };
      const result = detectFromPackageJson(packageJson);
      expect(result?.framework).toBe('astro');
    });

    it('detects SvelteKit', () => {
      const packageJson = {
        devDependencies: { '@sveltejs/kit': '^2.0.0' },
      };
      const result = detectFromPackageJson(packageJson);
      expect(result?.framework).toBe('sveltekit');
      expect(result?.meta_framework).toBe('svelte');
    });

    it('detects Angular', () => {
      const packageJson = {
        dependencies: { '@angular/core': '^17.0.0' },
      };
      const result = detectFromPackageJson(packageJson);
      expect(result?.framework).toBe('angular');
    });

    it('returns null for empty package.json', () => {
      const packageJson = {};
      const result = detectFromPackageJson(packageJson);
      expect(result).toBeNull();
    });
  });

  describe('detectFromHeaders', () => {
    it('detects Next.js from X-Powered-By', () => {
      const headers = { 'x-powered-by': 'Next.js' };
      const result = detectFromHeaders(headers);
      expect(result?.framework).toBe('nextjs');
    });

    it('detects Nuxt from X-Powered-By', () => {
      const headers = { 'x-powered-by': 'Nuxt' };
      const result = detectFromHeaders(headers);
      expect(result?.framework).toBe('nuxt');
    });

    it('detects Rails from Phusion Passenger', () => {
      const headers = { 'x-powered-by': 'Phusion Passenger' };
      const result = detectFromHeaders(headers);
      expect(result?.framework).toBe('rails');
    });

    it('returns null for generic headers', () => {
      const headers = { 'x-powered-by': 'Express' };
      const result = detectFromHeaders(headers);
      expect(result).toBeNull();
    });
  });

  describe('detectFramework', () => {
    it('prioritizes package.json over HTML', () => {
      const result = detectFramework({
        packageJson: { dependencies: { next: '^14.0.0' } },
        html: '<div data-reactroot>',
      });
      expect(result.framework).toBe('nextjs');
    });

    it('falls back to HTML when no package.json', () => {
      const result = detectFramework({
        html: '<div id="__nuxt">',
      });
      expect(result.framework).toBe('nuxt');
    });

    it('detects from file patterns', () => {
      const result = detectFramework({
        files: ['next.config.js', 'pages/index.tsx'],
      });
      expect(result.framework).toBe('nextjs');
    });

    it('detects WordPress from wp-config.php', () => {
      const result = detectFramework({
        files: ['wp-config.php', 'wp-content/themes/theme'],
      });
      expect(result.framework).toBe('wordpress');
    });

    it('detects Django from manage.py', () => {
      const result = detectFramework({
        files: ['manage.py', 'myapp/settings.py'],
      });
      expect(result.framework).toBe('django');
    });

    it('detects Rails from Gemfile + routes.rb', () => {
      const result = detectFramework({
        files: ['Gemfile', 'config/routes.rb'],
      });
      expect(result.framework).toBe('rails');
    });

    it('detects Laravel from artisan', () => {
      const result = detectFramework({
        files: ['artisan', 'app/Http/Controllers'],
      });
      expect(result.framework).toBe('laravel');
    });

    it('returns unknown for unrecognized input', () => {
      const result = detectFramework({});
      expect(result.framework).toBe('unknown');
      expect(result.confidence).toBe('low');
    });
  });

  describe('getFrameworkDisplayName', () => {
    it('returns correct display names', () => {
      expect(getFrameworkDisplayName('react')).toBe('React');
      expect(getFrameworkDisplayName('nextjs')).toBe('Next.js');
      expect(getFrameworkDisplayName('vue')).toBe('Vue.js');
      expect(getFrameworkDisplayName('nuxt')).toBe('Nuxt');
      expect(getFrameworkDisplayName('angular')).toBe('Angular');
      expect(getFrameworkDisplayName('rails')).toBe('Ruby on Rails');
      expect(getFrameworkDisplayName('wordpress')).toBe('WordPress');
      expect(getFrameworkDisplayName('unknown')).toBe('Unknown');
    });
  });
});
