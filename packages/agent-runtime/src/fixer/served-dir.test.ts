// Tested against the real file lists of the official starters, fetched from GitHub and stored in
// __fixtures__/framework-layouts.json. Hand-written fixtures would have agreed with whatever I
// assumed; the real ones are what showed that a fresh Next.js app, a fresh Nuxt app and a
// Docusaurus site all resolved to the repository root under the previous heuristic.
import { describe, it, expect } from 'vitest';
import { servedDir } from './served-dir.js';
import { findAppRoot } from './app-root.js';
import layouts from './__fixtures__/framework-layouts.json';

describe('servedDir', () => {
  describe('the framework decides, even before the directory exists', () => {
    it.each([
      ['nextjs', 'public/'],
      ['nuxt', 'public/'],
      ['react', 'public/'],
      ['astro', 'public/'],
      ['sveltekit', 'static/'],
      ['gatsby', 'static/'],
      ['hugo', 'static/'],
      ['docusaurus', 'static/'],
      ['rails', 'public/'],
      ['laravel', 'public/'],
      ['aspnet', 'wwwroot/'],
      ['phoenix', 'priv/static/'],
      ['jekyll', ''],
      ['pelican', ''],
    ] as const)('%s serves from %s', (framework, expected) => {
      // Empty tree on purpose: the answer must not depend on the directory already existing.
      expect(servedDir(framework, [])).toBe(expected);
    });
  });

  describe('an unknown framework falls back to the repository', () => {
    it('uses public/ when the repository has one', () => {
      expect(servedDir('unknown', ['index.html', 'public/favicon.ico'])).toBe('public/');
    });

    it('uses static/ when that is what exists', () => {
      expect(servedDir('unknown', ['index.html', 'static/logo.svg'])).toBe('static/');
    });

    it('serves from the app root when there is no such directory', () => {
      expect(servedDir('unknown', ['index.html', 'style.css'])).toBe('');
    });

    it('honours the app root when looking', () => {
      expect(servedDir('unknown', ['docs/index.html', 'docs/public/x.png'], 'docs/')).toBe('public/');
      expect(servedDir('unknown', ['docs/index.html', 'docs/CNAME'], 'docs/')).toBe('');
    });
  });

  // The regression that prompted this file: integrallis.com serves docs/ as-is, and the first
  // version of the fixer wrote docs/public/robots.txt.
  it('does not invent a public/ directory for a site served as-is', () => {
    const pagesSite = ['docs/index.html', 'docs/CNAME', 'docs/.nojekyll', 'docs/robots.txt'];
    const appRoot = findAppRoot(pagesSite);
    expect(appRoot).toBe('docs/');
    expect(servedDir('unknown', pagesSite, appRoot)).toBe('');
  });

  describe('against the real starter layouts', () => {
    const expected: Record<string, { framework: string; target: string }> = {
      'vite-react': { framework: 'react', target: 'public/robots.txt' },
      'nextjs-app': { framework: 'nextjs', target: 'public/robots.txt' },
      astro: { framework: 'astro', target: 'public/robots.txt' },
      nuxt: { framework: 'nuxt', target: 'public/robots.txt' },
      docusaurus: { framework: 'docusaurus', target: 'static/robots.txt' },
    };

    for (const [name, { framework, target }] of Object.entries(expected)) {
      it(`${name} (${(layouts as never as Record<string, { source: string }>)[name].source}) -> ${target}`, () => {
        const files = (layouts as never as Record<string, { files: string[] }>)[name].files;
        const appRoot = findAppRoot(files);
        const dir = servedDir(framework as never, files, appRoot);
        expect(`${appRoot}${dir}robots.txt`).toBe(target);
      });
    }
  });
});
