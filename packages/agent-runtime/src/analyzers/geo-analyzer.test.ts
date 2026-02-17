import { describe, it, expect } from 'vitest';
import {
  analyzeRobotsTxtForAI,
  detectRenderingMode,
  analyzeContentStructure,
  analyzeCitationReadiness,
  analyzeGEO,
  generateAIFriendlyRobotsTxt,
} from './geo-analyzer.js';

describe('GEO Analyzer', () => {
  describe('analyzeRobotsTxtForAI', () => {
    it('detects blocked AI crawlers', () => {
      const robotsTxt = `
User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /
`;
      const result = analyzeRobotsTxtForAI(robotsTxt);
      expect(result.blocked).toContain('GPTBot');
      expect(result.blocked).toContain('PerplexityBot');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('detects allowed AI crawlers', () => {
      const robotsTxt = `
User-agent: *
Allow: /
`;
      const result = analyzeRobotsTxtForAI(robotsTxt);
      expect(result.allowed).toContain('GPTBot');
      expect(result.allowed).toContain('ClaudeBot');
      expect(result.blocked.length).toBe(0);
    });

    it('handles wildcard disallow', () => {
      const robotsTxt = `
User-agent: *
Disallow: /
`;
      const result = analyzeRobotsTxtForAI(robotsTxt);
      expect(result.blocked.length).toBeGreaterThan(0);
    });
  });

  describe('detectRenderingMode', () => {
    it('detects SSR with Next.js', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div id="__next">
    <h1>Hello World</h1>
    <p>This is content</p>
  </div>
  <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
</body>
</html>
`;
      const result = detectRenderingMode(html);
      expect(result.serverSideRendered).toBe(true);
      expect(result.contentInHTML).toBe(true);
    });

    it('detects client-side React app', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div id="root" data-reactroot></div>
  <script src="/bundle.js"></script>
</body>
</html>
`;
      const result = detectRenderingMode(html);
      expect(result.jsRenderingRequired).toBe(true);
    });

    it('detects substantial content', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>Main Title</h1>
  <h2>Section 1</h2>
  <p>Some content here</p>
  <h2>Section 2</h2>
  <p>More content</p>
  <h3>Subsection</h3>
  <p>Even more content</p>
</body>
</html>
`;
      const result = detectRenderingMode(html);
      expect(result.contentInHTML).toBe(true);
      expect(result.serverSideRendered).toBe(true);
    });
  });

  describe('analyzeContentStructure', () => {
    it('detects JSON-LD structured data', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type": "Article", "headline": "Test"}
  </script>
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeContentStructure(html);
      expect(result.hasStructuredData).toBe(true);
      expect(result.hasArticleSchema).toBe(true);
    });

    it('detects FAQ schema', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {"@type": "FAQPage", "mainEntity": []}
  </script>
</head>
<body><h1>FAQ</h1></body>
</html>
`;
      const result = analyzeContentStructure(html);
      expect(result.hasFAQSchema).toBe(true);
    });

    it('analyzes heading hierarchy', () => {
      const html = `
<html><body>
  <h1>Main</h1>
  <h2>Sub 1</h2>
  <h2>Sub 2</h2>
  <h3>Detail</h3>
</body></html>
`;
      const result = analyzeContentStructure(html);
      expect(result.headingHierarchy).toBe('good');
    });

    it('detects poor heading hierarchy', () => {
      const html = `<html><body><h3>Random</h3><h5>No structure</h5></body></html>`;
      const result = analyzeContentStructure(html);
      expect(result.headingHierarchy).toBe('poor');
    });

    it('counts lists and tables', () => {
      const html = `
<html><body>
  <ul><li>Item 1</li><li>Item 2</li></ul>
  <ol><li>First</li></ol>
  <table><tr><td>Data</td></tr></table>
</body></html>
`;
      const result = analyzeContentStructure(html);
      expect(result.listsAndTables).toBe(3);
    });
  });

  describe('analyzeCitationReadiness', () => {
    it('detects citations and references', () => {
      const html = `
<html><body>
  <p>According to research [1], this is true.</p>
  <cite>Smith et al., 2023</cite>
  <blockquote>An important quote</blockquote>
</body></html>
`;
      const result = analyzeCitationReadiness(html);
      expect(result.hasCitations).toBe(true);
      expect(result.hasQuotes).toBe(true);
    });

    it('detects statistics', () => {
      const html = `<html><body><p>Revenue increased by 50% in 2023.</p></body></html>`;
      const result = analyzeCitationReadiness(html);
      expect(result.hasStatistics).toBe(true);
    });

    it('detects author info', () => {
      const html = `
<html>
<head><meta name="author" content="John Doe"></head>
<body><p class="author">Written by John</p></body>
</html>
`;
      const result = analyzeCitationReadiness(html);
      expect(result.hasAuthorInfo).toBe(true);
    });

    it('detects publish dates', () => {
      const html = `
<html><body>
  <time datetime="2024-01-15">Jan 15, 2024</time>
</body></html>
`;
      const result = analyzeCitationReadiness(html);
      expect(result.hasPublishDate).toBe(true);
    });

    it('collects trust signals', () => {
      const html = `
<html>
<head><meta name="author" content="Expert"></head>
<body>
  <cite>Source</cite>
  <p>Studies show 80% improvement</p>
  <time datetime="2024-01-01">Published</time>
</body></html>
`;
      const result = analyzeCitationReadiness(html);
      expect(result.trustSignals.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('analyzeGEO', () => {
    it('returns comprehensive GEO analysis', async () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">{"@type": "Article", "headline": "Test"}</script>
</head>
<body>
  <h1>Test Article</h1>
  <h2>Section</h2>
  <p>Content with statistics: 50% increase.</p>
  <ul><li>Point 1</li><li>Point 2</li></ul>
  <cite>Source reference</cite>
</body>
</html>
`;
      const result = await analyzeGEO(html, 'https://example.com/article');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.aiCrawlerAccess).toBeDefined();
      expect(result.contentStructure).toBeDefined();
      expect(result.citationReadiness).toBeDefined();
      expect(result.llmSignals).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('penalizes JS-only sites', async () => {
      const spaHtml = `
<!DOCTYPE html>
<html>
<head><title>SPA</title></head>
<body><div id="root"></div><script src="/app.js"></script></body>
</html>
`;
      const ssrHtml = `
<!DOCTYPE html>
<html>
<head><title>SSR</title></head>
<body>
  <h1>Real Content</h1>
  <p>Lots of text here that crawlers can read.</p>
  <h2>Section</h2>
  <p>More content</p>
</body>
</html>
`;
      const spaResult = await analyzeGEO(spaHtml, 'https://example.com');
      const ssrResult = await analyzeGEO(ssrHtml, 'https://example.com');
      
      expect(ssrResult.score).toBeGreaterThan(spaResult.score);
    });

    it('includes blocked crawlers in issues', async () => {
      const html = `<html><body><h1>Test</h1><p>Content</p></body></html>`;
      const robotsTxt = `
User-agent: GPTBot
Disallow: /
`;
      const result = await analyzeGEO(html, 'https://example.com', robotsTxt);
      
      expect(result.aiCrawlerAccess.blockedCrawlers).toContain('GPTBot');
      expect(result.issues.some(i => i.code === 'GEO_AI_CRAWLERS_BLOCKED')).toBe(true);
    });
  });

  describe('generateAIFriendlyRobotsTxt', () => {
    it('generates robots.txt with AI crawler rules', () => {
      const result = generateAIFriendlyRobotsTxt('https://example.com');
      
      expect(result).toContain('GPTBot');
      expect(result).toContain('Claude-Web');
      expect(result).toContain('PerplexityBot');
      expect(result).toContain('Allow: /');
      expect(result).toContain('Sitemap: https://example.com/sitemap.xml');
    });
  });
});
