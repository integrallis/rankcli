import { describe, it, expect } from 'vitest';
import { analyzeMobileSEO } from './mobile-seo-analyzer.js';

describe('Mobile SEO Analyzer', () => {
  describe('analyzeMobileSEO', () => {
    it('detects proper viewport', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.viewport.hasViewport).toBe(true);
      expect(result.viewport.isResponsive).toBe(true);
    });

    it('detects missing viewport', () => {
      const html = `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.viewport.hasViewport).toBe(false);
      expect(result.issues.some(i => i.code === 'MOBILE_NO_VIEWPORT')).toBe(true);
    });

    it('detects fixed viewport width', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=1024">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.viewport.isResponsive).toBe(false);
    });

    it('warns about disabled zooming', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, user-scalable=no">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.issues.some(i => i.code === 'MOBILE_ZOOM_DISABLED')).toBe(true);
    });

    it('detects apple touch icon', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.mobileSpecific.hasAppleTouchIcon).toBe(true);
    });

    it('detects theme color', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.mobileSpecific.hasThemeColor).toBe(true);
    });

    it('detects web app manifest', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="manifest" href="/manifest.json">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.mobileSpecific.hasManifest).toBe(true);
    });

    it('detects responsive images', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <img srcset="/image-400.jpg 400w, /image-800.jpg 800w" src="/image.jpg" alt="Test">
</body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.mobileSpecific.hasMobileOptimizedImages).toBe(true);
    });

    it('calculates overall score', () => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icon.png">
</head>
<body><h1>Test</h1></body>
</html>
`;
      const result = analyzeMobileSEO(html, 'https://example.com');
      expect(result.score).toBeGreaterThan(80);
    });
  });
});
