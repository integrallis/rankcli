// One test per signal, from minimal synthetic markup - deterministic, offline, and specific
// enough that a failure names the signal that broke.
//
// The live benchmark that produced these signals lives in scripts/benchmark-detection.mjs: 48
// real sites, 93% correct on the set the signals were tuned against and 94% on a hold-out,
// with no wrong answers on either. It needs the network, so it is a script rather than a test.
import { describe, it, expect } from 'vitest';
import { detectFromEvidence, SIGNALS, SCORE_FLOOR, WEIGHT } from './signals.js';

const html = (body: string) => detectFromEvidence({ html: body });
const headers = (h: Record<string, string>) => detectFromEvidence({ headers: h });

describe('detectFromEvidence', () => {
  describe('build artifacts settle it outright', () => {
    const cases: Array<[string, string, string]> = [
      ['nextjs', '<script src="/_next/static/chunks/main.js">', 'next-build-dir'],
      ['nuxt', '<link href="/_nuxt/entry.css">', 'nuxt-build-dir'],
      ['astro', '<link href="/_astro/index.abc123.css">', 'astro-build-dir'],
      ['sveltekit', '<link href="/_app/immutable/entry/start.js">', 'sveltekit-immutable'],
      ['gatsby', '<div id="___gatsby"></div>', 'gatsby-runtime'],
      ['qwik', '<div q:container="paused" q:base="/build/">', 'qwik-container'],
      ['fresh', '<script src="/_frsh/js/main.js">', 'fresh-build-dir'],
      ['angular', '<app-root ng-version="17.0.0"></app-root>', 'angular-version'],
      ['wordpress', '<link href="/wp-content/themes/x/style.css">', 'wp-paths'],
      ['remix', '<script>window.__remixContext = {};</script>', 'remix-context'],
      ['vue', '<script>window.__VP_HASH_MAP__={}</script>', 'vitepress-runtime'],
      ['sphinx', '<script src="_static/documentation_options.js">', 'sphinx-doc-options'],
    ];
    it.each(cases)('detects %s', (framework, markup, signal) => {
      const r = html(markup);
      expect(r.framework).toBe(framework);
      expect(r.confidence).toBe('high');
      expect(r.matched).toContain(signal);
    });
  });

  describe('generator meta tags, quoted or not', () => {
    it('reads an unquoted attribute value, which is how Hugo writes it', () => {
      expect(html('<meta name=generator content="Hugo 0.166.0">').framework).toBe('hugo');
    });
    it.each([
      ['jekyll', '<meta name="generator" content="Jekyll v4.4.1" />'],
      ['eleventy', '<meta name="generator" content="Eleventy v2.0.1">'],
      ['astro', '<meta name="generator" content="Astro v5.13.2">'],
      ['wordpress', '<meta name="generator" content="WordPress 6.5">'],
    ])('detects %s', (framework, markup) => {
      expect(html(markup).framework).toBe(framework);
    });
  });

  describe('the failures that motivated the rewrite', () => {
    // server.includes('gin') matched "nginx", so every nginx site was a Go app.
    it('does not call an nginx site a Go framework', () => {
      expect(headers({ server: 'nginx' }).framework).not.toBe('go');
      expect(headers({ server: 'nginx/1.24.0' }).framework).toBe('unknown');
    });

    it('still detects a real Go framework from the full server value', () => {
      expect(headers({ server: 'gin/1.9' }).framework).toBe('go');
    });

    // csrf-token is emitted by Rails, Laravel, Phoenix and Django alike.
    it('does not call a page with only a csrf-token meta Rails', () => {
      expect(html('<meta name="csrf-token" content="abc">').framework).not.toBe('rails');
    });

    it('does detect Rails from csrf-param, which only Rails emits', () => {
      expect(html('<meta name="csrf-param" content="authenticity_token">').framework).toBe('rails');
    });

    // "sf2" inside an asset hash used to be read as Symfony, and Symfony sat before Phoenix.
    it('is not confused by a framework name inside an asset hash', () => {
      const page = '<script src="/assets/app-8sf2kd91.js"></script><div phx-click="go"></div>';
      expect(html(page).framework).toBe('phoenix');
    });

    // The word "react" in prose used to be enough.
    it('does not detect a framework from prose that names one', () => {
      const page = '<p>Compared with React, Vue and Angular, our approach differs.</p>';
      expect(html(page).framework).toBe('unknown');
    });

    it('does not detect WordPress from a page that merely mentions it', () => {
      expect(html('<p>We support Rails, Django, Laravel and WordPress.</p>').framework).toBe('unknown');
    });
  });

  describe('scoring', () => {
    it('lets a meta-framework outrank the library it is built on, without a rule saying so', () => {
      const nextPage = '<div id="root"></div><script src="/_next/static/x.js"></script>';
      const r = html(nextPage);
      expect(r.framework).toBe('nextjs');
      expect(r.alternatives.some((a) => a.framework === 'react')).toBe(true);
    });

    it('does not decide on weak evidence alone', () => {
      const r = html('<div id="app"></div>');
      expect(r.framework).toBe('unknown');
      expect(r.score).toBeLessThan(SCORE_FLOOR);
    });

    it('reports medium confidence when only a convention matched', () => {
      const vitePage =
        '<script type="module" src="/assets/index-DKSmqLpC.js"></script><div id="root">prerendered</div>';
      const r = html(vitePage);
      expect(r.framework).toBe('react');
      expect(r.confidence).toBe('medium');
    });

    it('accumulates evidence and explains itself', () => {
      const r = html('<link href="/wp-content/x.css"><meta name="generator" content="WordPress 6.5">');
      expect(r.score).toBe(WEIGHT.DECISIVE * 2);
      expect(r.matched.sort()).toEqual(['wp-generator', 'wp-paths']);
    });

    it('combines html and header evidence', () => {
      const r = detectFromEvidence({
        html: '<div>nothing</div>',
        headers: { 'x-powered-by': 'Next.js' },
      });
      expect(r.framework).toBe('nextjs');
    });

    it('answers unknown for an empty page rather than guessing', () => {
      expect(html('').framework).toBe('unknown');
      expect(detectFromEvidence({}).framework).toBe('unknown');
    });
  });

  describe('the signal table itself', () => {
    it('gives every signal a unique name, so a wrong answer is traceable', () => {
      const names = SIGNALS.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('gives every signal something to match on', () => {
      for (const s of SIGNALS) {
        expect(Boolean(s.html || s.header || s.allHtml), `${s.name} has no pattern`).toBe(true);
      }
    });

    // A bare framework name is the bug this whole rewrite was about.
    it('has no signal that is just a framework name', () => {
      const bare = SIGNALS.filter((s) => {
        const src = s.html?.source ?? '';
        return /^[a-z]{3,12}$/i.test(src);
      });
      expect(bare.map((s) => s.name)).toEqual([]);
    });
  });
});
