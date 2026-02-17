import { describe, it, expect } from 'vitest';
import { analyzeInternalLinking, suggestInternalLinks } from './internal-linking-analyzer.js';

describe('Internal Linking Analyzer', () => {
  describe('analyzeInternalLinking', () => {
    it('counts internal and external links', () => {
      const html = `
<html><body>
  <a href="/about">About</a>
  <a href="/products">Products</a>
  <a href="https://external.com">External</a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com/page');
      expect(result.internalLinks).toBe(2);
      expect(result.externalLinks).toBe(1);
      expect(result.totalLinks).toBe(3);
    });

    it('distinguishes navigation from content links', () => {
      const html = `
<html><body>
  <nav>
    <a href="/home">Home</a>
    <a href="/about">About</a>
  </nav>
  <main>
    <a href="/products">See our products</a>
  </main>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.navigationLinks).toBe(2);
      expect(result.contentLinks).toBe(1);
    });

    it('detects generic anchor text', () => {
      const html = `
<html><body>
  <a href="/about">Click here</a>
  <a href="/products">Read more</a>
  <a href="/services">Learn more</a>
  <a href="/contact">here</a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.linksWithGenericText).toBe(4);
      expect(result.issues.some(i => i.code === 'LINK_GENERIC_ANCHOR')).toBe(true);
    });

    it('detects descriptive anchor text', () => {
      const html = `
<html><body>
  <a href="/about">About Our Company</a>
  <a href="/products">Our Product Catalog</a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.linksWithKeywords).toBe(2);
    });

    it('detects empty anchor text', () => {
      const html = `
<html><body>
  <a href="/about"></a>
  <a href="/products">   </a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.anchorTextAnalysis.empty).toBe(2);
      expect(result.issues.some(i => i.code === 'LINK_EMPTY_ANCHOR')).toBe(true);
    });

    it('detects nofollow on internal links', () => {
      const html = `
<html><body>
  <a href="/about" rel="nofollow">About</a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.issues.some(i => i.code === 'LINK_NOFOLLOW_INTERNAL')).toBe(true);
    });

    it('tracks unique internal targets', () => {
      const html = `
<html><body>
  <a href="/about">About</a>
  <a href="/about">About Us</a>
  <a href="/products">Products</a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.uniqueInternalTargets).toBe(2);
    });

    it('detects orphan risk', () => {
      const html = `
<html><body>
  <nav><a href="/home">Home</a></nav>
  <p>Content without links</p>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com/orphan');
      expect(result.orphanRisk).toBe(true);
    });

    it('handles image links', () => {
      const html = `
<html><body>
  <a href="/products"><img src="/logo.png" alt="Products"></a>
  <a href="/about"><img src="/icon.png"></a>
</body></html>
`;
      const result = analyzeInternalLinking(html, 'https://example.com');
      expect(result.anchorTextAnalysis.imageLinks).toBe(2);
    });
  });

  describe('suggestInternalLinks', () => {
    it('suggests links based on keyword matches', () => {
      const content = '<p>Learn about SEO optimization techniques.</p>';
      const pages = [
        { url: '/seo-guide', title: 'SEO Guide', keywords: ['seo', 'optimization'] },
        { url: '/about', title: 'About', keywords: ['company', 'team'] },
      ];
      
      const suggestions = suggestInternalLinks(content, pages);
      expect(suggestions.some(s => s.suggestedUrl === '/seo-guide')).toBe(true);
    });

    it('does not suggest already linked pages', () => {
      const content = '<p>Learn about SEO optimization. <a href="/seo-guide">Guide</a></p>';
      const pages = [
        { url: '/seo-guide', title: 'SEO Guide', keywords: ['seo'] },
      ];
      
      const suggestions = suggestInternalLinks(content, pages);
      expect(suggestions.length).toBe(0);
    });
  });
});
