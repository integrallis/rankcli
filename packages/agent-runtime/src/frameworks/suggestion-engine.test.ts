import { describe, it, expect } from 'vitest';
import { getFrameworkIssues } from './suggestion-engine.js';
import type { FrameworkInfo } from './detector.js';

function info(framework: FrameworkInfo['framework']): FrameworkInfo {
  return { framework, language: 'javascript', confidence: 'high', detected_from: 'html' };
}

const url = 'https://example.com/';

describe('getFrameworkIssues - detection wiring', () => {
  it('flags REACT_CSR_DETECTED for a thin-body CSR shell (pre-existing detection)', async () => {
    const html = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
    const issues = await getFrameworkIssues(info('react'), html, url);
    expect(issues.map(i => i.code)).toContain('REACT_CSR_DETECTED');
  });

  it('flags ANGULAR_NO_UNIVERSAL for a thin-body <app-root> shell', async () => {
    const html = '<html><body><app-root></app-root><script src="/main.js"></script></body></html>';
    const issues = await getFrameworkIssues(info('angular'), html, url);
    expect(issues.map(i => i.code)).toContain('ANGULAR_NO_UNIVERSAL');
  });

  it('flags VUE_CSR_DETECTED for a thin-body #app shell', async () => {
    const html = '<html><body><div id="app"></div><script src="/main.js"></script></body></html>';
    const issues = await getFrameworkIssues(info('vue'), html, url);
    expect(issues.map(i => i.code)).toContain('VUE_CSR_DETECTED');
  });

  it('flags NUXT_SPA_MODE for a thin-body #__nuxt shell', async () => {
    const html = '<html><body><div id="__nuxt"></div><script src="/entry.js"></script></body></html>';
    const issues = await getFrameworkIssues(info('nuxt'), html, url);
    expect(issues.map(i => i.code)).toContain('NUXT_SPA_MODE');
  });

  it('flags WORDPRESS_NO_SEO_PLUGIN when no known plugin signature is present', async () => {
    const html = '<html><head><meta name="generator" content="WordPress 6.5"></head><body>Hello</body></html>';
    const issues = await getFrameworkIssues(info('wordpress'), html, url);
    expect(issues.map(i => i.code)).toContain('WORDPRESS_NO_SEO_PLUGIN');
  });

  it('does not flag WORDPRESS_NO_SEO_PLUGIN when Yoast is present', async () => {
    const html = '<html><head><!-- This site is optimized with the Yoast SEO plugin --></head><body>Hello</body></html>';
    const issues = await getFrameworkIssues(info('wordpress'), html, url);
    expect(issues.map(i => i.code)).not.toContain('WORDPRESS_NO_SEO_PLUGIN');
  });

  it('flags NEXTJS_NO_METADATA_API on App Router HTML missing OG tags', async () => {
    // App Router never renders a <div id="__next"> hydration root - that's
    // the Pages Router signal.
    const html = '<html><head><title>Home</title></head><body>content</body></html>';
    const issues = await getFrameworkIssues(info('nextjs'), html, url);
    expect(issues.map(i => i.code)).toContain('NEXTJS_NO_METADATA_API');
  });

  it('does not flag the App-Router-only check on Pages Router HTML', async () => {
    // Router-scoping guard regression test: this check is app_router_only,
    // so it must never fire on genuine Pages Router HTML (id="__next"),
    // even though it's also missing OG tags here.
    const html = '<html><head><title>Home</title></head><body><div id="__next">content</div></body></html>';
    const issues = await getFrameworkIssues(info('nextjs'), html, url);
    expect(issues.map(i => i.code)).not.toContain('NEXTJS_NO_METADATA_API');
  });

  it('does not flag NEXTJS_NO_METADATA_API when OG tags are present', async () => {
    const html = '<html><head><title>Home</title><meta property="og:title" content="Home"></head><body>content</body></html>';
    const issues = await getFrameworkIssues(info('nextjs'), html, url);
    expect(issues.map(i => i.code)).not.toContain('NEXTJS_NO_METADATA_API');
  });
});
