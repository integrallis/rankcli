import { describe, it, expect } from 'vitest';
import { analyzeStructuredData, generateSchemaTemplate } from './structured-data-analyzer.js';

describe('Structured Data Analyzer', () => {
  describe('analyzeStructuredData', () => {
    it('detects valid Article schema', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Test Article",
      "author": {"@type": "Person", "name": "John Doe"},
      "datePublished": "2024-01-15"
    }
  </script>
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com/article');
      expect(result.hasArticle).toBe(true);
      expect(result.schemas.some(s => s.type === 'Article')).toBe(true);
    });

    it('validates required properties', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Test Article"
    }
  </script>
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com/article');
      const articleSchema = result.schemas.find(s => s.type === 'Article');
      expect(articleSchema?.isValid).toBe(false);
      expect(articleSchema?.errors.some(e => e.includes('author'))).toBe(true);
    });

    it('detects FAQPage schema', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is SEO?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SEO stands for Search Engine Optimization."
          }
        }
      ]
    }
  </script>
</head>
<body><h1>FAQ</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com/faq');
      expect(result.hasFAQ).toBe(true);
    });

    it('detects Product schema', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Test Product",
      "offers": {
        "@type": "Offer",
        "price": "29.99",
        "priceCurrency": "USD"
      }
    }
  </script>
</head>
<body><h1>Product</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com/product');
      expect(result.hasProduct).toBe(true);
    });

    it('detects BreadcrumbList schema', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "/"},
        {"@type": "ListItem", "position": 2, "name": "Products", "item": "/products"}
      ]
    }
  </script>
</head>
<body><h1>Product</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com/product');
      expect(result.hasBreadcrumb).toBe(true);
    });

    it('handles @graph format', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {"@type": "Organization", "name": "Test Org", "url": "https://example.com"},
        {"@type": "WebSite", "name": "Test Site", "url": "https://example.com"}
      ]
    }
  </script>
</head>
<body><h1>Home</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com');
      expect(result.hasOrganization).toBe(true);
      expect(result.hasWebSite).toBe(true);
    });

    it('reports invalid JSON', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
    {invalid json here}
  </script>
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com');
      expect(result.issues.some(i => i.code === 'SCHEMA_INVALID_JSON')).toBe(true);
    });

    it('reports when no schema is found', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>No Schema</h1></body>
</html>
`;
      const result = analyzeStructuredData(html, 'https://example.com');
      expect(result.issues.some(i => i.code === 'SCHEMA_NONE_FOUND')).toBe(true);
    });
  });

  describe('generateSchemaTemplate', () => {
    it('generates article schema template', () => {
      const schema = generateSchemaTemplate('article', {
        siteName: 'Test Site',
        siteUrl: 'https://example.com',
        authorName: 'John Doe',
      });
      expect(schema).toContain('Article');
      expect(schema).toContain('John Doe');
      expect(schema).toContain('https://example.com');
    });

    it('generates product schema template', () => {
      const schema = generateSchemaTemplate('product', {
        siteName: 'Test Store',
        siteUrl: 'https://store.example.com',
      });
      expect(schema).toContain('Product');
      expect(schema).toContain('Offer');
    });

    it('generates FAQ schema template', () => {
      const schema = generateSchemaTemplate('faq', {
        siteName: 'Help Center',
        siteUrl: 'https://help.example.com',
      });
      expect(schema).toContain('FAQPage');
      expect(schema).toContain('Question');
    });
  });
});
