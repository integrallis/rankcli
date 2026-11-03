import { describe, it, expect } from 'vitest';
import { analyzeTopicalClusters } from './topical-clusters.js';

const page = '<html><body><nav><a href="/a">a</a></nav><main><h1>Title</h1><p>Some words on the page, enough to be a page.</p></main></body></html>';
const codes = (html: string, url: string) => analyzeTopicalClusters(html, url).issues.map((i) => i.code);

describe('breadcrumbs', () => {
  // On the 400-site corpus NO_BREADCRUMBS fired on 98 percent of homepages: the check was
  // describing the page type. A homepage has nothing to lead back to.
  it('never asks the homepage for breadcrumbs', () => {
    expect(codes(page, 'https://example.com/')).not.toContain('NO_BREADCRUMBS');
    expect(codes(page, 'https://example.com')).not.toContain('NO_BREADCRUMBS');
  });

  it('still asks an inner page without them', () => {
    expect(codes(page, 'https://example.com/docs/getting-started')).toContain('NO_BREADCRUMBS');
  });
});
