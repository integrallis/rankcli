/**
 * Image Optimization Analyzer
 * 
 * Analyzes images for SEO and performance optimization.
 * Checks formats, dimensions, alt text, lazy loading, and compression indicators.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../audit/types.js';

export interface ImageAnalysisResult {
  score: number;
  totalImages: number;
  imagesWithAlt: number;
  imagesWithDimensions: number;
  imagesWithLazyLoading: number;
  modernFormats: number;
  legacyFormats: number;
  oversizedImages: ImageInfo[];
  missingAlt: ImageInfo[];
  decorativeWithoutRole: ImageInfo[];
  issues: AuditIssue[];
  recommendations: string[];
}

export interface ImageInfo {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  format?: string;
  loading?: string;
  issues: string[];
}

const MODERN_FORMATS = ['webp', 'avif'];
const LEGACY_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
const MAX_RECOMMENDED_DIMENSION = 2000;

/**
 * Extract format from image URL
 */
function getImageFormat(src: string): string | undefined {
  // Handle data URLs
  if (src.startsWith('data:image/')) {
    const match = src.match(/data:image\/(\w+)/);
    return match ? match[1] : undefined;
  }
  
  // Handle regular URLs
  try {
    const url = new URL(src, 'https://example.com');
    const pathname = url.pathname.toLowerCase();
    const ext = pathname.split('.').pop();
    return ext && ext.length <= 5 ? ext : undefined;
  } catch {
    const ext = src.split('.').pop()?.toLowerCase();
    return ext && ext.length <= 5 ? ext : undefined;
  }
}

/**
 * Analyze all images on a page
 */
export function analyzeImages(html: string, url: string): ImageAnalysisResult {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  const allImages: ImageInfo[] = [];
  const missingAlt: ImageInfo[] = [];
  const oversizedImages: ImageInfo[] = [];
  const decorativeWithoutRole: ImageInfo[] = [];
  
  let imagesWithAlt = 0;
  let imagesWithDimensions = 0;
  let imagesWithLazyLoading = 0;
  let modernFormats = 0;
  let legacyFormats = 0;
  
  // Analyze each image
  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') || $img.attr('data-src') || '';
    const alt = $img.attr('alt');
    const width = parseInt($img.attr('width') || '0');
    const height = parseInt($img.attr('height') || '0');
    const loading = $img.attr('loading');
    const role = $img.attr('role');
    const format = getImageFormat(src);
    
    const imageIssues: string[] = [];
    
    const imgInfo: ImageInfo = {
      src: src.substring(0, 200), // Truncate long data URLs
      alt,
      width: width || undefined,
      height: height || undefined,
      format,
      loading,
      issues: imageIssues,
    };
    
    // Check alt attribute
    if (alt === undefined) {
      imageIssues.push('Missing alt attribute');
      missingAlt.push(imgInfo);
    } else if (alt === '') {
      // Empty alt is valid for decorative images, but should have role="presentation"
      if (role !== 'presentation' && role !== 'none') {
        imageIssues.push('Empty alt without role="presentation"');
        decorativeWithoutRole.push(imgInfo);
      }
      imagesWithAlt++; // Empty alt still counts as having alt
    } else {
      imagesWithAlt++;
      
      // Check for poor alt text patterns
      if (alt.toLowerCase().includes('image') || 
          alt.toLowerCase().includes('picture') ||
          alt.toLowerCase().includes('photo')) {
        imageIssues.push('Alt text contains generic terms');
      }
      
      if (alt.length > 125) {
        imageIssues.push('Alt text too long (>125 chars)');
      }
      
      // Check for filename-like alt
      if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(alt)) {
        imageIssues.push('Alt text appears to be a filename');
      }
    }
    
    // Check dimensions
    if (width > 0 && height > 0) {
      imagesWithDimensions++;
      
      // Check for oversized images
      if (width > MAX_RECOMMENDED_DIMENSION || height > MAX_RECOMMENDED_DIMENSION) {
        imageIssues.push(`Dimensions too large (${width}x${height})`);
        oversizedImages.push(imgInfo);
      }
    } else {
      imageIssues.push('Missing width/height attributes');
    }
    
    // Check lazy loading
    if (loading === 'lazy') {
      imagesWithLazyLoading++;
    }
    
    // Check format
    if (format) {
      if (MODERN_FORMATS.includes(format)) {
        modernFormats++;
      } else if (LEGACY_FORMATS.includes(format)) {
        legacyFormats++;
      }
    }
    
    allImages.push(imgInfo);
  });
  
  const totalImages = allImages.length;
  
  // Generate issues
  if (missingAlt.length > 0) {
    const percentage = Math.round((missingAlt.length / totalImages) * 100);
    const severity = percentage > 50 ? 'critical' : percentage > 20 ? 'warning' : 'info';
    
    issues.push({
      code: 'IMG_MISSING_ALT',
      severity,
      category: 'content',
      title: `${missingAlt.length} images missing alt attribute`,
      description: `${percentage}% of images lack alt text, hurting accessibility and SEO.`,
      impact: 'Screen readers cannot describe images; search engines lose context',
      howToFix: 'Add descriptive alt text to all images. Use alt="" for decorative images.',
      affectedUrls: [url],
    });
    score -= Math.min(missingAlt.length * 3, 25);
  }
  
  const missingDimensions = totalImages - imagesWithDimensions;
  if (missingDimensions > 0) {
    issues.push({
      code: 'IMG_MISSING_DIMENSIONS',
      severity: 'warning',
      category: 'performance',
      title: `${missingDimensions} images missing width/height`,
      description: 'Images without explicit dimensions cause layout shifts (CLS).',
      impact: 'Poor Core Web Vitals, degraded user experience',
      howToFix: 'Add width and height attributes to all images.',
      affectedUrls: [url],
    });
    score -= Math.min(missingDimensions * 2, 20);
  }
  
  if (legacyFormats > 0 && modernFormats === 0) {
    issues.push({
      code: 'IMG_NO_MODERN_FORMATS',
      severity: 'warning',
      category: 'performance',
      title: 'No modern image formats (WebP/AVIF)',
      description: `All ${legacyFormats} images use legacy formats (JPEG/PNG).`,
      impact: 'Larger file sizes, slower page load',
      howToFix: 'Convert images to WebP or AVIF format. Use <picture> element for fallbacks.',
      affectedUrls: [url],
    });
    score -= 10;
    recommendations.push('Convert images to WebP/AVIF for 30-50% smaller file sizes');
  }
  
  if (oversizedImages.length > 0) {
    issues.push({
      code: 'IMG_OVERSIZED',
      severity: 'warning',
      category: 'performance',
      title: `${oversizedImages.length} images have excessive dimensions`,
      description: `Images larger than ${MAX_RECOMMENDED_DIMENSION}px may be wasteful on most screens.`,
      impact: 'Unnecessary bandwidth usage, slower loading',
      howToFix: 'Resize images to match their display size. Use srcset for responsive images.',
      affectedUrls: [url],
    });
    score -= Math.min(oversizedImages.length * 3, 15);
  }
  
  // Check hero/above-fold images with lazy loading
  const firstImage = allImages[0];
  if (firstImage?.loading === 'lazy') {
    issues.push({
      code: 'IMG_HERO_LAZY',
      severity: 'warning',
      category: 'performance',
      title: 'First image has loading="lazy"',
      description: 'Above-the-fold images should not be lazy-loaded as it delays LCP.',
      impact: 'Slower Largest Contentful Paint',
      howToFix: 'Remove loading="lazy" from hero/above-fold images. Keep it for below-fold images.',
      affectedUrls: [url],
    });
    score -= 10;
  }
  
  // Check for images without lazy loading (below potential fold)
  const belowFoldWithoutLazy = allImages.slice(3).filter(img => img.loading !== 'lazy');
  if (belowFoldWithoutLazy.length > 5) {
    recommendations.push(`Consider adding loading="lazy" to ${belowFoldWithoutLazy.length} below-fold images`);
  }
  
  // Check for decorative images without proper role
  if (decorativeWithoutRole.length > 0) {
    issues.push({
      code: 'IMG_DECORATIVE_NO_ROLE',
      severity: 'info',
      category: 'content',
      title: `${decorativeWithoutRole.length} decorative images without role`,
      description: 'Images with empty alt should have role="presentation" for accessibility.',
      impact: 'Minor accessibility issue',
      howToFix: 'Add role="presentation" to decorative images with empty alt.',
      affectedUrls: [url],
    });
  }
  
  // Check for background images (informational)
  const elementsWithBgImage = $('[style*="background-image"], [style*="background:"]').length;
  if (elementsWithBgImage > 3) {
    recommendations.push(`${elementsWithBgImage} CSS background images detected - ensure they're not content images`);
  }
  
  // Check for SVG images (good for icons)
  const svgImages = $('svg, img[src$=".svg"]').length;
  if (svgImages > 0) {
    // This is positive, no action needed
  }
  
  // Positive recommendations
  if (totalImages > 0 && imagesWithAlt === totalImages) {
    recommendations.push('✓ All images have alt attributes');
  }
  
  if (modernFormats > legacyFormats) {
    recommendations.push('✓ Majority of images use modern formats');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    totalImages,
    imagesWithAlt,
    imagesWithDimensions,
    imagesWithLazyLoading,
    modernFormats,
    legacyFormats,
    oversizedImages,
    missingAlt,
    decorativeWithoutRole,
    issues,
    recommendations,
  };
}

/**
 * Generate responsive image HTML
 */
export function generateResponsiveImage(options: {
  src: string;
  alt: string;
  widths: number[];
  sizes?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
}): string {
  const { src, alt, widths, sizes = '100vw', loading = 'lazy', className } = options;
  
  // Assume src is the largest size
  const basename = src.replace(/\.[^.]+$/, '');
  const ext = src.split('.').pop() || 'jpg';
  
  const srcset = widths
    .map(w => `${basename}-${w}w.webp ${w}w`)
    .join(', ');
  
  const fallbackSrcset = widths
    .map(w => `${basename}-${w}w.${ext} ${w}w`)
    .join(', ');
  
  return `<picture>
  <source
    type="image/webp"
    srcset="${srcset}"
    sizes="${sizes}"
  />
  <source
    type="image/${ext === 'jpg' ? 'jpeg' : ext}"
    srcset="${fallbackSrcset}"
    sizes="${sizes}"
  />
  <img
    src="${src}"
    alt="${alt}"
    width="${widths[widths.length - 1]}"
    height="auto"
    loading="${loading}"${className ? `\n    class="${className}"` : ''}
    decoding="async"
  />
</picture>`;
}
