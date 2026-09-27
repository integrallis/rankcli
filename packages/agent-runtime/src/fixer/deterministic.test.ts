import { describe, it, expect } from 'vitest';
import { buildDeterministicFixes } from './deterministic.js';

const base = {
  siteUrl: 'https://example.com',
  siteName: 'Example',
  appRoot: '',
  existing: {},
};

describe('buildDeterministicFixes', () => {
  it('says whether each file was created or edited', () => {
    const { files, summary } = buildDeterministicFixes({
      ...base,
      issueCodes: ['ROBOTS_TXT_MISSING', 'SCHEMA_MISSING'],
      existing: { indexHtml: '<head><title>x</title></head>' },
    });
    expect(files.map((f) => f.action)).toEqual(['created', 'edited']);
    expect(summary).toContain('Added robots.txt');
    expect(summary).toContain('updated index.html');
    expect(summary).not.toContain('Added index.html');
  });

  it('adds nothing when nothing was reported', () => {
    const { files, addressed } = buildDeterministicFixes({ ...base, issueCodes: [] });
    expect(files).toEqual([]);
    expect(addressed).toEqual([]);
  });

  it('writes robots.txt, sitemap.xml and llms.txt when they are missing and reported', () => {
    const { files } = buildDeterministicFixes({
      ...base,
      issueCodes: ['ROBOTS_TXT_MISSING', 'SITEMAP_MISSING', 'LLMS_TXT_MISSING'],
    });
    expect(files.map((f) => f.path)).toEqual([
      'public/robots.txt',
      'public/sitemap.xml',
      'public/llms.txt',
    ]);
    expect(files[0].content).toContain('GPTBot');
    expect(files[1].content).toContain('<loc>https://example.com/</loc>');
  });

  // Never overwrite what is already there - the file existing is the answer.
  it('leaves existing files alone', () => {
    const { files } = buildDeterministicFixes({
      ...base,
      issueCodes: ['ROBOTS_TXT_MISSING', 'SITEMAP_MISSING', 'LLMS_TXT_MISSING'],
      existing: { robotsTxt: 'User-agent: *', sitemapXml: '<urlset/>', llmsTxt: '# Example' },
    });
    expect(files).toEqual([]);
  });

  it('honours a monorepo app root on every path', () => {
    const { files } = buildDeterministicFixes({
      ...base,
      appRoot: 'apps/web/',
      issueCodes: ['ROBOTS_TXT_MISSING'],
    });
    expect(files[0].path).toBe('apps/web/public/robots.txt');
  });

  it('lists the audited pages in the sitemap', () => {
    const { files } = buildDeterministicFixes({
      ...base,
      issueCodes: ['SITEMAP_MISSING'],
      pages: ['https://example.com/', 'https://example.com/pricing'],
    });
    expect(files[0].content).toContain('https://example.com/pricing');
  });

  it('escapes URLs in the sitemap', () => {
    const { files } = buildDeterministicFixes({
      ...base,
      issueCodes: ['SITEMAP_MISSING'],
      pages: ['https://example.com/?a=1&b=2'],
    });
    expect(files[0].content).toContain('?a=1&amp;b=2');
    expect(files[0].content).not.toContain('&b=2');
  });

  describe('JSON-LD insertion', () => {
    const html = '<html><head><title>Example</title></head><body>hi</body></html>';

    it('inserts a block before </head> and keeps the rest byte-for-byte', () => {
      const { files } = buildDeterministicFixes({
        ...base,
        issueCodes: ['SCHEMA_MISSING'],
        existing: { indexHtml: html },
      });
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('index.html');
      expect(files[0].content).toContain('application/ld+json');
      expect(files[0].content).toContain('<title>Example</title>');
      expect(files[0].content).toContain('<body>hi</body>');
      // Valid JSON, and only the facts we were given.
      const json = files[0].content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      const graph = JSON.parse(json!);
      expect(graph.map((n: { '@type': string }) => n['@type'])).toEqual(['WebSite', 'Organization']);
      expect(JSON.stringify(graph)).toContain('Example');
    });

    it('leaves a page that already has JSON-LD alone', () => {
      const withLd = '<head><script type="application/ld+json">{}</script></head>';
      const { files } = buildDeterministicFixes({
        ...base,
        issueCodes: ['SCHEMA_MISSING'],
        existing: { indexHtml: withLd },
      });
      expect(files).toEqual([]);
    });

    it('does nothing without a </head> to insert before', () => {
      const { files } = buildDeterministicFixes({
        ...base,
        issueCodes: ['SCHEMA_MISSING'],
        existing: { indexHtml: '<html><body>no head</body></html>' },
      });
      expect(files).toEqual([]);
    });

    it('omits description rather than inventing one', () => {
      const { files } = buildDeterministicFixes({
        ...base,
        issueCodes: ['SCHEMA_MISSING'],
        existing: { indexHtml: html },
      });
      expect(files[0].content).not.toContain('"description"');
    });
  });
});
