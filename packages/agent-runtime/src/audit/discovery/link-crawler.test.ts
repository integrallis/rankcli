import { describe, it, expect } from 'vitest';
import { extractLinks } from './link-crawler.js';

describe('extractLinks', () => {
  // rankcli #23: a flat static site links between pages with document-relative hrefs.
  // These were skipped outright, so the whole link graph came back empty and
  // NAV_NOT_IN_HTML reported "the homepage links to 0 pages" for a page full of links.
  it('resolves document-relative hrefs against the page URL', () => {
    const html = `
      <a href="research.html">Research</a>
      <a href="products.html">Products</a>
      <a href="open-source.html">Open source</a>
    `;
    const links = extractLinks(html, 'https://example.com/');
    expect(links).toEqual([
      'https://example.com/research.html',
      'https://example.com/products.html',
      'https://example.com/open-source.html',
    ]);
  });

  it('resolves a relative href against the directory of a nested page', () => {
    const links = extractLinks('<a href="b.html">b</a>', 'https://example.com/docs/a.html');
    expect(links).toEqual(['https://example.com/docs/b.html']);
  });

  it('still handles absolute and root-relative hrefs', () => {
    const html = `
      <a href="https://example.com/abs.html">abs</a>
      <a href="/root.html">root</a>
    `;
    expect(extractLinks(html, 'https://example.com/')).toEqual([
      'https://example.com/abs.html',
      'https://example.com/root.html',
    ]);
  });

  it('still drops off-site, non-HTTP and asset links', () => {
    const html = `
      <a href="https://other.example/x.html">off site</a>
      <a href="mailto:hi@example.com">mail</a>
      <a href="tel:+15551234">phone</a>
      <a href="#section">fragment</a>
      <a href="logo.png">image</a>
      <a href="feed.xml">data file</a>
      <a href="keep.html">keep</a>
    `;
    expect(extractLinks(html, 'https://example.com/')).toEqual(['https://example.com/keep.html']);
  });

  it('deduplicates one page reached by two spellings', () => {
    const html = `
      <a href="a.html">one</a>
      <a href="/a.html">two</a>
      <a href="https://example.com/a.html">three</a>
    `;
    expect(extractLinks(html, 'https://example.com/')).toEqual(['https://example.com/a.html']);
  });
});
