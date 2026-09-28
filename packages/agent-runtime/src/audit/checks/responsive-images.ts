// Responsive Images Check - Essential for Core Web Vitals
// Reference: "Technical SEO for Developers - 17 Tips to Rank Higher"
// "Make sure your images are responsive for their screen size"
// "You should always, always, always lazy load off screen images"
// "Make sure you're setting height and width on your images" (for CLS)

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface ImageAnalysis {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: 'lazy' | 'eager' | null;
  decoding: 'async' | 'sync' | 'auto' | null;
  srcset: string | null;
  sizes: string | null;
  isAboveFold: boolean; // Estimated based on position
  hasExplicitDimensions: boolean;
  hasResponsiveSrcset: boolean;
  usesModernFormat: boolean;
  issues: string[];
}

export interface ResponsiveImageData {
  totalImages: number;
  imagesWithoutDimensions: number;
  imagesWithoutLazyLoad: number;
  imagesWithoutSrcset: number;
  imagesWithoutAlt: number;
  modernFormatCount: number;
  legacyFormatCount: number;
  images: ImageAnalysis[];
  recommendations: string[];
}

// Modern image formats
const MODERN_FORMATS = ['.webp', '.avif'];
const LEGACY_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

/**
 * Analyze individual image element
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function analyzeImage($: cheerio.CheerioAPI, img: any, index: number): ImageAnalysis {
  const $img = $(img);
  const issues: string[] = [];

  const src = $img.attr('src') || $img.attr('data-src') || '';
  const alt = $img.attr('alt');
  const width = $img.attr('width');
  const height = $img.attr('height');
  const loading = $img.attr('loading') as 'lazy' | 'eager' | null;
  const decoding = $img.attr('decoding') as 'async' | 'sync' | 'auto' | null;
  const srcset = $img.attr('srcset');
  const sizes = $img.attr('sizes');

  // Check for explicit dimensions
  const hasExplicitDimensions = !!(
    (width && height) ||
    $img.css('width') ||
    $img.css('height') ||
    $img.attr('style')?.includes('width') ||
    $img.attr('style')?.includes('height')
  );

  // Check for responsive srcset
  const hasResponsiveSrcset = !!(srcset && srcset.includes('w'));

  // Check for modern format
  const srcLower = src.toLowerCase();
  const usesModernFormat = MODERN_FORMATS.some(fmt => srcLower.includes(fmt));

  // Estimate if above fold (very rough - based on element order)
  // Images in first 3 <img> tags or in header/hero are likely above fold
  const isInHeader = $img.closest('header, [class*="hero"], [class*="banner"], [class*="jumbotron"]').length > 0;
  const isAboveFold = index < 3 || isInHeader;

  // Generate issues
  if (!hasExplicitDimensions) {
    issues.push('Missing width/height attributes (causes CLS)');
  }

  if (alt === undefined || alt === null) {
    issues.push('Missing alt attribute');
  } else if (alt === '') {
    // Empty alt is okay for decorative images but should be noted
  }

  if (!isAboveFold && loading !== 'lazy') {
    issues.push('Below-fold image without lazy loading');
  }

  if (isAboveFold && loading === 'lazy') {
    issues.push('Above-fold image with lazy loading (delays LCP)');
  }

  if (!hasResponsiveSrcset && src && !srcLower.includes('.svg')) {
    issues.push('No responsive srcset for different screen sizes');
  }

  if (srcset && !sizes) {
    issues.push('Has srcset but missing sizes attribute');
  }

  if (!usesModernFormat && src && !srcLower.includes('.svg')) {
    issues.push('Using legacy image format instead of WebP/AVIF');
  }

  return {
    src,
    alt: alt ?? null,
    width: width ?? null,
    height: height ?? null,
    loading: loading ?? null,
    decoding: decoding ?? null,
    srcset: srcset ?? null,
    sizes: sizes ?? null,
    isAboveFold,
    hasExplicitDimensions,
    hasResponsiveSrcset,
    usesModernFormat,
    issues,
  };
}

/**
 * Analyze <picture> elements for responsive patterns
 */
export function analyzePictureElements($: cheerio.CheerioAPI): {
  hasPictureElements: boolean;
  pictureCount: number;
  hasFormatFallbacks: boolean;
} {
  const pictures = $('picture');
  const pictureCount = pictures.length;
  let hasFormatFallbacks = false;

  pictures.each((_, pic) => {
    const sources = $(pic).find('source');
    const hasWebP = sources.filter((_, s) => {
      const type = $(s).attr('type') || '';
      const srcset = $(s).attr('srcset') || '';
      return type.includes('webp') || srcset.includes('.webp');
    }).length > 0;
    const hasAvif = sources.filter((_, s) => {
      const type = $(s).attr('type') || '';
      const srcset = $(s).attr('srcset') || '';
      return type.includes('avif') || srcset.includes('.avif');
    }).length > 0;

    if (hasWebP || hasAvif) {
      hasFormatFallbacks = true;
    }
  });

  return {
    hasPictureElements: pictureCount > 0,
    pictureCount,
    hasFormatFallbacks,
  };
}

/**
 * Check for image CDN usage
 */
export function detectImageCDN(html: string): { detected: boolean; cdns: string[] } {
  const cdnPatterns = [
    { name: 'Cloudinary', pattern: /cloudinary\.com|res\.cloudinary/i },
    { name: 'imgix', pattern: /imgix\.net/i },
    { name: 'Cloudflare Images', pattern: /imagedelivery\.net|cloudflare-images/i },
    { name: 'AWS CloudFront', pattern: /cloudfront\.net/i },
    { name: 'Fastly', pattern: /fastly\.net/i },
    { name: 'ImageKit', pattern: /imagekit\.io|ik\.imagekit/i },
    { name: 'Vercel Image Optimization', pattern: /_next\/image/i },
    { name: 'Prismic', pattern: /images\.prismic\.io/i },
    { name: 'Contentful', pattern: /images\.ctfassets\.net/i },
    { name: 'Sanity', pattern: /cdn\.sanity\.io/i },
    { name: 'Shopify CDN', pattern: /cdn\.shopify\.com/i },
    { name: 'WordPress Jetpack', pattern: /i\d\.wp\.com/i },
  ];

  const detectedCDNs: string[] = [];

  for (const { name, pattern } of cdnPatterns) {
    if (pattern.test(html)) {
      detectedCDNs.push(name);
    }
  }

  return {
    detected: detectedCDNs.length > 0,
    cdns: detectedCDNs,
  };
}

/**
 * Main function: Analyze responsive image best practices
 */
export function analyzeResponsiveImages(
  html: string,
  url: string
): { issues: AuditIssue[]; data: ResponsiveImageData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];
  const images: ImageAnalysis[] = [];

  // Analyze all images
  const imgElements = $('img');
  imgElements.each((index, img) => {
    const analysis = analyzeImage($, img, index);
    images.push(analysis);
  });

  // Analyze picture elements
  const pictureData = analyzePictureElements($);

  // Detect image CDN usage
  const cdnData = detectImageCDN(html);

  // Calculate statistics
  const totalImages = images.length;
  const imagesWithoutDimensions = images.filter(i => !i.hasExplicitDimensions).length;
  const imagesWithoutLazyLoad = images.filter(i => !i.isAboveFold && i.loading !== 'lazy').length;
  const imagesWithoutSrcset = images.filter(i => !i.hasResponsiveSrcset && i.src && !i.src.includes('.svg')).length;
  const imagesWithoutAlt = images.filter(i => i.alt === null).length;
  const modernFormatCount = images.filter(i => i.usesModernFormat).length;
  const legacyFormatCount = images.filter(i =>
    !i.usesModernFormat && i.src && !i.src.includes('.svg')
  ).length;

  // Generate recommendations
  const recommendations: string[] = [];

  if (!cdnData.detected && totalImages > 3) {
    recommendations.push('Consider using an image CDN (Cloudinary, imgix, Vercel) for automatic optimization');
  }

  if (!pictureData.hasPictureElements && legacyFormatCount > 0) {
    recommendations.push('Use <picture> elements with WebP/AVIF sources and JPEG/PNG fallbacks');
  }

  if (imagesWithoutDimensions > 0) {
    recommendations.push('Add width and height attributes to all images to prevent layout shift');
  }

  if (imagesWithoutLazyLoad > 0) {
    recommendations.push('Add loading="lazy" to below-fold images');
  }

  if (imagesWithoutSrcset > 0) {
    recommendations.push('Add srcset with multiple sizes for responsive images');
  }

  // Generate issues

  // Not an error, deliberately. `--fail-on error` exits 1, so this severity decides whether a
  // build breaks - and measured on 2026-09-28 it fired at error for svelte.dev, tailwindcss.com,
  // rust-lang.org, laravel.com and fastapi.tiangolo.com. Breaking the build of five
  // professionally built sites over missing width/height is what gets a linter uninstalled.
  //
  // It is a real CLS cost and still worth reporting; it is not "your site is broken". The other
  // two emitters of this code already treat it as notice (image-dimensions.ts) and info
  // (tools/analyzer.ts), so error was the outlier rather than the consensus.
  if (imagesWithoutDimensions >= 3) {
    issues.push({
      code: 'IMAGES_MISSING_DIMENSIONS',
      severity: 'warning',
      category: 'performance',
      title: `${imagesWithoutDimensions} images missing width/height attributes`,
      description: `Found ${imagesWithoutDimensions} images without explicit dimensions.`,
      impact: 'Missing dimensions cause Cumulative Layout Shift (CLS) when images load.',
      howToFix: 'Add width and height attributes to all <img> tags, even with CSS sizing.',
      affectedUrls: [url],
      details: {
        count: imagesWithoutDimensions,
        images: images.filter(i => !i.hasExplicitDimensions).slice(0, 5).map(i => i.src),
      },
    });
  } else if (imagesWithoutDimensions > 0) {
    issues.push({
      code: 'IMAGES_MISSING_DIMENSIONS',
      // One or two keeps a gradient below the >=3 case rather than flattening both to warning.
      severity: 'notice',
      category: 'performance',
      title: `${imagesWithoutDimensions} image(s) missing width/height attributes`,
      description: `Found ${imagesWithoutDimensions} images without explicit dimensions.`,
      impact: 'Missing dimensions cause Cumulative Layout Shift (CLS) when images load.',
      howToFix: 'Add width and height attributes to all <img> tags.',
      affectedUrls: [url],
      details: {
        images: images.filter(i => !i.hasExplicitDimensions).map(i => i.src),
      },
    });
  }

  // Warning: Images without lazy loading
  if (imagesWithoutLazyLoad >= 3) {
    issues.push({
      code: 'IMAGES_WITHOUT_LAZY_LOAD',
      severity: 'warning',
      category: 'performance',
      title: `${imagesWithoutLazyLoad} below-fold images without lazy loading`,
      description: `Found ${imagesWithoutLazyLoad} images below the fold that load immediately.`,
      impact: 'Eager-loading all images delays initial page load and wastes bandwidth.',
      howToFix: 'Add loading="lazy" to images below the fold. Keep loading="eager" for hero images.',
      affectedUrls: [url],
      details: {
        count: imagesWithoutLazyLoad,
        images: images.filter(i => !i.isAboveFold && i.loading !== 'lazy').slice(0, 5).map(i => i.src),
      },
    });
  }

  // Warning: No responsive images
  if (imagesWithoutSrcset >= 5 && totalImages >= 5) {
    issues.push({
      code: 'NO_RESPONSIVE_IMAGES',
      severity: 'warning',
      category: 'performance',
      title: 'Images lack responsive srcset',
      description: `${imagesWithoutSrcset} of ${totalImages} images don't have srcset for different screen sizes.`,
      impact: 'Mobile users download full-size images, wasting bandwidth and slowing load.',
      howToFix: 'Add srcset attribute with multiple image sizes (e.g., 320w, 640w, 1280w).',
      affectedUrls: [url],
      details: {
        withoutSrcset: imagesWithoutSrcset,
        total: totalImages,
      },
    });
  }

  // Warning: Missing alt text
  if (imagesWithoutAlt > 0) {
    issues.push({
      code: 'IMAGES_MISSING_ALT',
      severity: 'warning',
      category: 'on-page', // Alt text impacts both accessibility and SEO
      title: `${imagesWithoutAlt} image(s) missing alt attribute`,
      description: `Found ${imagesWithoutAlt} images without alt text.`,
      impact: 'Missing alt text hurts accessibility and SEO. Screen readers cannot describe the image.',
      howToFix: 'Add descriptive alt text to all images. Use alt="" only for purely decorative images.',
      affectedUrls: [url],
      details: {
        count: imagesWithoutAlt,
        images: images.filter(i => i.alt === null).slice(0, 5).map(i => i.src),
      },
    });
  }

  // Notice: Not using modern formats
  if (legacyFormatCount > 3 && modernFormatCount === 0 && !pictureData.hasFormatFallbacks) {
    issues.push({
      code: 'NO_MODERN_IMAGE_FORMATS',
      severity: 'notice',
      category: 'performance',
      title: 'Not using modern image formats (WebP/AVIF)',
      description: `All ${legacyFormatCount} images use legacy formats (JPEG/PNG) instead of WebP/AVIF.`,
      impact: 'WebP is 25-35% smaller than JPEG. AVIF is up to 50% smaller.',
      howToFix: 'Use <picture> element to serve WebP/AVIF with JPEG fallback, or use an image CDN.',
      affectedUrls: [url],
      details: {
        legacyCount: legacyFormatCount,
        suggestion: cdnData.detected
          ? `Your CDN (${cdnData.cdns.join(', ')}) likely supports format conversion.`
          : 'Consider using Cloudinary, imgix, or Vercel Image Optimization.',
      },
    });
  }

  // Notice: Above-fold images with lazy loading
  const aboveFoldLazy = images.filter(i => i.isAboveFold && i.loading === 'lazy');
  if (aboveFoldLazy.length > 0) {
    issues.push({
      code: 'HERO_IMAGE_LAZY',
      severity: 'notice',
      category: 'performance',
      title: 'Above-fold images have lazy loading',
      description: `${aboveFoldLazy.length} hero/above-fold image(s) use loading="lazy" which delays LCP.`,
      impact: 'Lazy loading above-fold images increases Largest Contentful Paint time.',
      howToFix: 'Remove loading="lazy" from images visible on initial page load.',
      affectedUrls: [url],
      details: {
        images: aboveFoldLazy.map(i => i.src),
      },
    });
  }

  return {
    issues,
    data: {
      totalImages,
      imagesWithoutDimensions,
      imagesWithoutLazyLoad,
      imagesWithoutSrcset,
      imagesWithoutAlt,
      modernFormatCount,
      legacyFormatCount,
      images,
      recommendations,
    },
  };
}
