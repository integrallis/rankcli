import { describe, it, expect } from 'vitest';
import { analyzeCoreWebVitals } from './core-web-vitals-analyzer.js';

describe('Core Web Vitals Analyzer', () => {
  describe('LCP Analysis', () => {
    it('detects lazy-loaded hero images', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <header>
    <img src="/hero.jpg" loading="lazy" width="1200" height="600">
  </header>
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.lcp.issues.some(i => i.includes('lazy'))).toBe(true);
    });

    it('detects render-blocking scripts', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="/app.js"></script>
  <script src="/vendor.js"></script>
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.lcp.issues.some(i => i.includes('render-blocking scripts'))).toBe(true);
    });

    it('accepts async/defer scripts', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="/app.js" async></script>
  <script src="/analytics.js" defer></script>
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.lcp.issues.some(i => i.includes('render-blocking scripts'))).toBe(false);
    });

    it('detects multiple render-blocking stylesheets', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/style1.css">
  <link rel="stylesheet" href="/style2.css">
  <link rel="stylesheet" href="/style3.css">
  <link rel="stylesheet" href="/style4.css">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.lcp.issues.some(i => i.includes('render-blocking stylesheets'))).toBe(true);
    });
  });

  describe('CLS Analysis', () => {
    it('detects images without dimensions', () => {
      const html = `
<!DOCTYPE html>
<html>
<body>
  <img src="/photo1.jpg">
  <img src="/photo2.jpg">
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.cls.issues.some(i => i.includes('without width/height'))).toBe(true);
    });

    it('passes images with dimensions', () => {
      const html = `
<!DOCTYPE html>
<html>
<body>
  <img src="/photo.jpg" width="800" height="600">
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.cls.issues.some(i => i.includes('without width/height'))).toBe(false);
    });

    it('detects iframes and videos without dimensions', () => {
      const html = `
<!DOCTYPE html>
<html>
<body>
  <iframe src="https://youtube.com/embed/123"></iframe>
  <video src="/video.mp4"></video>
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.cls.issues.some(i => i.includes('videos/iframes without dimensions'))).toBe(true);
    });

    it('detects web fonts without font-display', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans" rel="stylesheet">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.cls.issues.some(i => i.includes('font-display'))).toBe(true);
    });
  });

  describe('FID/INP Analysis', () => {
    it('detects many JavaScript bundles', () => {
      const html = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <script src="/bundle.1.js"></script>
  <script src="/bundle.2.js"></script>
  <script src="/vendor.bundle.js"></script>
  <script src="/chunk.1.js"></script>
  <script src="/chunk.2.js"></script>
  <script src="/chunk.3.js"></script>
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.fid.issues.some(i => i.includes('bundle files'))).toBe(true);
    });

    it('detects large inline JavaScript', () => {
      const largeScript = 'x'.repeat(15000);
      const html = `
<!DOCTYPE html>
<html>
<body>
  <script>${largeScript}</script>
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.fid.issues.some(i => i.includes('Large inline JavaScript'))).toBe(true);
    });

    it('detects many inline event handlers', () => {
      const handlers = Array(15).fill('<button onclick="doSomething()">Click</button>').join('');
      const html = `
<!DOCTYPE html>
<html>
<body>${handlers}</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.fid.issues.some(i => i.includes('inline event handlers'))).toBe(true);
    });
  });

  describe('TTFB Analysis', () => {
    it('detects missing preconnect hints', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.ttfb.issues.some(i => i.includes('preconnect'))).toBe(true);
    });

    it('passes with preconnect hints', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://api.example.com">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.ttfb.issues.some(i => i.includes('preconnect'))).toBe(false);
    });
  });

  describe('Overall Score', () => {
    it('calculates overall score', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
</head>
<body>
  <h1>Well Optimized Page</h1>
  <img src="/photo.jpg" width="800" height="600">
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('generates issues array', () => {
      const html = `
<!DOCTYPE html>
<html>
<body>
  <img src="/photo.jpg">
  <script src="/app.js"></script>
</body>
</html>
`;
      const result = analyzeCoreWebVitals(html, 'https://example.com');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });
});
