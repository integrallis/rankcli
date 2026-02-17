import { describe, it, expect } from 'vitest';
import { analyzeImages, generateResponsiveImage } from './image-optimization-analyzer.js';

describe('Image Optimization Analyzer', () => {
  describe('analyzeImages', () => {
    it('detects images with alt text', () => {
      const html = `
<html><body>
  <img src="/photo1.jpg" alt="A beautiful sunset">
  <img src="/photo2.jpg" alt="Mountain landscape">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.totalImages).toBe(2);
      expect(result.imagesWithAlt).toBe(2);
    });

    it('detects images without alt text', () => {
      const html = `
<html><body>
  <img src="/photo1.jpg">
  <img src="/photo2.jpg" alt="Has alt">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.missingAlt.length).toBe(1);
      expect(result.issues.some(i => i.code === 'IMG_MISSING_ALT')).toBe(true);
    });

    it('detects images with dimensions', () => {
      const html = `
<html><body>
  <img src="/photo.jpg" alt="Test" width="800" height="600">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.imagesWithDimensions).toBe(1);
    });

    it('detects images without dimensions', () => {
      const html = `
<html><body>
  <img src="/photo1.jpg" alt="Test">
  <img src="/photo2.jpg" alt="Test">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.issues.some(i => i.code === 'IMG_MISSING_DIMENSIONS')).toBe(true);
    });

    it('detects modern image formats', () => {
      const html = `
<html><body>
  <img src="/photo.webp" alt="Test" width="800" height="600">
  <img src="/photo.avif" alt="Test" width="800" height="600">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.modernFormats).toBe(2);
      expect(result.legacyFormats).toBe(0);
    });

    it('detects legacy image formats', () => {
      const html = `
<html><body>
  <img src="/photo.jpg" alt="Test" width="800" height="600">
  <img src="/photo.png" alt="Test" width="800" height="600">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.legacyFormats).toBe(2);
      expect(result.issues.some(i => i.code === 'IMG_NO_MODERN_FORMATS')).toBe(true);
    });

    it('detects lazy loading', () => {
      const html = `
<html><body>
  <img src="/photo1.jpg" alt="Test" loading="lazy">
  <img src="/photo2.jpg" alt="Test">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.imagesWithLazyLoading).toBe(1);
    });

    it('warns about lazy loading hero images', () => {
      const html = `
<html><body>
  <img src="/hero.jpg" alt="Hero" loading="lazy" width="1200" height="600">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.issues.some(i => i.code === 'IMG_HERO_LAZY')).toBe(true);
    });

    it('accepts decorative images with empty alt', () => {
      const html = `
<html><body>
  <img src="/decoration.png" alt="" role="presentation">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.imagesWithAlt).toBe(1);
      expect(result.decorativeWithoutRole.length).toBe(0);
    });

    it('warns decorative images without role', () => {
      const html = `
<html><body>
  <img src="/decoration.png" alt="">
</body></html>
`;
      const result = analyzeImages(html, 'https://example.com');
      expect(result.decorativeWithoutRole.length).toBe(1);
    });
  });

  describe('generateResponsiveImage', () => {
    it('generates responsive image HTML', () => {
      const html = generateResponsiveImage({
        src: '/images/hero.jpg',
        alt: 'Hero image',
        widths: [400, 800, 1200],
        sizes: '(max-width: 768px) 100vw, 50vw',
      });
      
      expect(html).toContain('<picture>');
      expect(html).toContain('srcset=');
      expect(html).toContain('type="image/webp"');
      expect(html).toContain('alt="Hero image"');
      expect(html).toContain('loading="lazy"');
    });

    it('respects loading option', () => {
      const html = generateResponsiveImage({
        src: '/images/hero.jpg',
        alt: 'Hero image',
        widths: [800],
        loading: 'eager',
      });
      
      expect(html).toContain('loading="eager"');
    });
  });
});
