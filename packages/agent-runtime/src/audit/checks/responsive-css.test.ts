import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeResponsiveCss } from './responsive-css.js';

const PAGE = 'https://example.com/';
const MEDIA_CSS = 'body{margin:0}@media (max-width: 768px){body{font-size:14px}}';
const FIXED_CSS = 'body{margin:0;width:1200px}.col{float:left;width:300px}';

type Answer = string | { status: number } | Error;

// fetch answers by URL; a URL with no entry fails like a dead server would.
function serve(answers: Record<string, Answer>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);
      const answer = answers[url];
      if (answer === undefined) throw new Error(`ECONNREFUSED ${url}`);
      if (answer instanceof Error) throw answer;
      if (typeof answer === 'string') return new Response(answer, { status: 200, headers: { 'content-type': 'text/css' } });
      return new Response('', { status: answer.status });
    })
  );
  return calls;
}

function page(head: string): string {
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body></body></html>`;
}

async function codes(html: string) {
  const { issues } = await analyzeResponsiveCss(html, PAGE);
  return issues.map((i) => i.code);
}

beforeEach(() => {
  serve({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RESPONSIVE_NO_MEDIA_QUERIES', () => {
  it('is quiet when an inline style has a media query, without fetching anything', async () => {
    const calls = serve({});
    expect(await codes(page(`<style>${MEDIA_CSS}</style>`))).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
    expect(calls).toEqual([]);
  });

  it('fires on a page with only fixed inline CSS and no stylesheets', async () => {
    expect(await codes(page(`<style>${FIXED_CSS}</style>`))).toContain('RESPONSIVE_NO_MEDIA_QUERIES');
  });

  // A Vite/Tailwind/Next page has no inline CSS at all: the verdict is in the stylesheet.
  it('reads a same-origin stylesheet and is quiet when it has media queries', async () => {
    const calls = serve({ 'https://example.com/assets/index-abc.css': MEDIA_CSS });
    const { issues, data } = await analyzeResponsiveCss(page('<link rel="stylesheet" crossorigin href="/assets/index-abc.css">'), PAGE);
    expect(issues.map((i) => i.code)).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
    expect(calls).toEqual(['https://example.com/assets/index-abc.css']);
    expect(data.mediaQuerySources.external).toEqual(['https://example.com/assets/index-abc.css']);
    expect(data.hasMobileBreakpoint).toBe(true);
  });

  it('fires when every same-origin stylesheet was read and none adapts', async () => {
    serve({ 'https://example.com/a.css': FIXED_CSS, 'https://example.com/b.css': FIXED_CSS });
    const { issues, data } = await analyzeResponsiveCss(page('<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">'), PAGE);
    expect(issues.map((i) => i.code)).toContain('RESPONSIVE_NO_MEDIA_QUERIES');
    expect(data.stylesheetsCovered).toBe(true);
  });

  it.each([
    ['@container', '.card{container-type:inline-size}@container (min-width: 400px){.card{display:flex}}'],
    ['clamp()', 'h1{font-size:clamp(1.5rem, 4vw, 3rem)}'],
    ['min()', '.wrap{width:min(100%, 60rem)}'],
    ['max()', '.wrap{padding:max(1rem, 3vw)}'],
  ])('accepts %s as a responsive signal', async (_, css) => {
    serve({ 'https://example.com/a.css': css });
    expect(await codes(page('<link rel="stylesheet" href="/a.css">'))).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
  });

  it('does not take min-width in a selector-less rule as min()', async () => {
    serve({ 'https://example.com/a.css': '.a{min-width:200px;max-width:800px}' });
    expect(await codes(page('<link rel="stylesheet" href="/a.css">'))).toContain('RESPONSIVE_NO_MEDIA_QUERIES');
  });

  // Silence beats a false positive: the stylesheet that could not be read may hold every
  // media query the site has.
  it('stays quiet when the stylesheet fetch fails', async () => {
    serve({});
    const { issues, data } = await analyzeResponsiveCss(page('<link rel="stylesheet" href="/a.css">'), PAGE);
    expect(issues.map((i) => i.code)).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
    expect(data.stylesheetsCovered).toBe(false);
  });

  it('stays quiet when the stylesheet answers 403', async () => {
    serve({ 'https://example.com/a.css': { status: 403 } });
    expect(await codes(page('<link rel="stylesheet" href="/a.css">'))).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
  });

  it('stays quiet when a stylesheet is cross-origin, and does not fetch it', async () => {
    const calls = serve({ 'https://example.com/a.css': FIXED_CSS });
    const html = page('<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="https://cdn.example.net/site.css">');
    expect(await codes(html)).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
    expect(calls).toEqual(['https://example.com/a.css']);
  });

  it('stays quiet when there are more same-origin stylesheets than it reads', async () => {
    const calls = serve({
      'https://example.com/1.css': FIXED_CSS,
      'https://example.com/2.css': FIXED_CSS,
      'https://example.com/3.css': FIXED_CSS,
      'https://example.com/4.css': MEDIA_CSS,
    });
    const html = page([1, 2, 3, 4].map((n) => `<link rel="stylesheet" href="/${n}.css">`).join(''));
    expect(await codes(html)).not.toContain('RESPONSIVE_NO_MEDIA_QUERIES');
    expect(calls).toHaveLength(3);
  });

  // The first three links used to be taken before the same-origin filter, so three font or
  // CDN links ahead of the site's own stylesheet hid it.
  it('still reads the site stylesheet when cross-origin links come first', async () => {
    const calls = serve({ 'https://example.com/a.css': MEDIA_CSS });
    const html = page(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">' +
        '<link rel="stylesheet" href="https://cdn.example.net/1.css">' +
        '<link rel="stylesheet" href="https://cdn.example.net/2.css">' +
        '<link rel="stylesheet" href="/a.css">'
    );
    const { data } = await analyzeResponsiveCss(html, PAGE);
    expect(calls).toEqual(['https://example.com/a.css']);
    expect(data.hasMediaQueries).toBe(true);
  });

  it('matches a link whose rel has more than one token', async () => {
    const calls = serve({ 'https://example.com/a.css': MEDIA_CSS });
    await analyzeResponsiveCss(page('<link rel="preload stylesheet" as="style" href="/a.css">'), PAGE);
    expect(calls).toEqual(['https://example.com/a.css']);
  });
});

describe('RESPONSIVE_NO_MOBILE_BREAKPOINT', () => {
  // Tailwind v4 writes range syntax in rem: (width >= 40rem) is the 640px breakpoint.
  it('reads range syntax and rem units', async () => {
    serve({ 'https://example.com/a.css': '@media (width >= 40rem){.sm\\:flex{display:flex}}@media (width < 64rem){.x{display:none}}' });
    const { issues, data } = await analyzeResponsiveCss(page('<link rel="stylesheet" href="/a.css">'), PAGE);
    expect(issues.map((i) => i.code)).not.toContain('RESPONSIVE_NO_MOBILE_BREAKPOINT');
    expect(data.breakpoints).toEqual(['640px', '1024px']);
  });

  it('still fires when every breakpoint is desktop-sized', async () => {
    serve({ 'https://example.com/a.css': '@media (min-width: 1200px){.x{display:none}}' });
    expect(await codes(page('<link rel="stylesheet" href="/a.css">'))).toContain('RESPONSIVE_NO_MOBILE_BREAKPOINT');
  });

  it('does not fire on a page whose only signal is fluid sizing', async () => {
    serve({ 'https://example.com/a.css': 'h1{font-size:clamp(1rem, 4vw, 3rem)}' });
    expect(await codes(page('<link rel="stylesheet" href="/a.css">'))).toEqual([]);
  });
});
