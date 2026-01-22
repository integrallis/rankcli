// Modern Image Format Checks
// Checks for WebP/AVIF usage and image optimization

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

// File extensions for modern formats
const MODERN_FORMATS = ['.webp', '.avif'];
const LEGACY_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

export interface ImageInfo {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  format: string;
  isModernFormat: boolean;
  hasDimensions: boolean;
  isLazyLoaded: boolean;
}

export interface ModernImagesData {
  totalImages: number;
  modernFormatCount: number;
  legacyFormatCount: number;
  modernFormatPercentage: number;
  images: ImageInfo[];
  hasSourceSet: boolean;
  hasPictureElements: boolean;
}

/**
 * Extract format from URL
 */
function getImageFormat(url: string): string {
  try {
    const pathname = new URL(url, 'https://example.com').pathname.toLowerCase();

    // Check for format in query string (common with CDNs)
    const formatMatch = url.match(/[?&](?:format|f)=(\w+)/i);
    if (formatMatch) {
      return '.' + formatMatch[1].toLowerCase();
    }

    // Check file extension
    const extMatch = pathname.match(/\.([a-z0-9]+)$/i);
    if (extMatch) {
      return '.' + extMatch[1].toLowerCase();
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if format is modern
 */
function isModernFormat(format: string): boolean {
  return MODERN_FORMATS.includes(format.toLowerCase());
}

/**
 * Extract image information from HTML
 */
function extractImages($: cheerio.CheerioAPI, baseUrl: string): ImageInfo[] {
  const images: ImageInfo[] = [];

  // Process img tags
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const srcset = $(el).attr('srcset') || '';
    const alt = $(el).attr('alt') || null;
    const width = $(el).attr('width') ? parseInt($(el).attr('width')!, 10) : null;
    const height = $(el).attr('height') ? parseInt($(el).attr('height')!, 10) : null;
    const loading = $(el).attr('loading') || null;

    // Skip data URIs and empty sources
    if (!src || src.startsWith('data:')) return;

    // Resolve relative URLs
    let fullSrc = src;
    try {
      fullSrc = new URL(src, baseUrl).href;
    } catch {
      // Keep original if URL parsing fails
    }

    const format = getImageFormat(fullSrc);

    images.push({
      src: fullSrc,
      alt,
      width,
      height,
      loading,
      format,
      isModernFormat: isModernFormat(format),
      hasDimensions: width !== null && height !== null,
      isLazyLoaded: loading === 'lazy' || $(el).attr('data-src') !== undefined,
    });

    // Check srcset for modern formats
    if (srcset) {
      const srcsetUrls = srcset.split(',').map((s) => s.trim().split(' ')[0]);
      for (const srcsetUrl of srcsetUrls) {
        const srcsetFormat = getImageFormat(srcsetUrl);
        if (isModernFormat(srcsetFormat) && !images.some((img) => img.src === srcsetUrl)) {
          images.push({
            src: srcsetUrl,
            alt,
            width: null,
            height: null,
            loading,
            format: srcsetFormat,
            isModernFormat: true,
            hasDimensions: false,
            isLazyLoaded: loading === 'lazy',
          });
        }
      }
    }
  });

  // Check picture elements for modern format sources
  $('picture source').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    const type = $(el).attr('type') || '';

    if (type.includes('webp') || type.includes('avif')) {
      const srcsetUrls = srcset.split(',').map((s) => s.trim().split(' ')[0]);
      for (const srcsetUrl of srcsetUrls) {
        if (!images.some((img) => img.src === srcsetUrl)) {
          images.push({
            src: srcsetUrl,
            alt: null,
            width: null,
            height: null,
            loading: null,
            format: type.includes('webp') ? '.webp' : '.avif',
            isModernFormat: true,
            hasDimensions: false,
            isLazyLoaded: false,
          });
        }
      }
    }
  });

  return images;
}

/**
 * Analyze image formats and optimization
 */
export function analyzeModernImages(html: string, url: string): { issues: AuditIssue[]; data: ModernImagesData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Extract images
  const images = extractImages($, url);

  // Filter to unique images by src
  const uniqueImages = images.filter((img, idx, arr) => arr.findIndex((i) => i.src === img.src) === idx);

  // Count formats
  const modernFormatCount = uniqueImages.filter((img) => img.isModernFormat).length;
  const legacyFormatCount = uniqueImages.filter(
    (img) => !img.isModernFormat && LEGACY_FORMATS.includes(img.format)
  ).length;

  // Check for picture elements and srcset
  const hasPictureElements = $('picture').length > 0;
  const hasSourceSet = $('img[srcset]').length > 0 || $('picture source[srcset]').length > 0;

  // Calculate percentage
  const totalRelevantImages = modernFormatCount + legacyFormatCount;
  const modernFormatPercentage = totalRelevantImages > 0 ? Math.round((modernFormatCount / totalRelevantImages) * 100) : 100;

  // Generate issues
  if (legacyFormatCount > 0 && !hasPictureElements && !hasSourceSet) {
    const legacyImages = uniqueImages.filter((img) => !img.isModernFormat && LEGACY_FORMATS.includes(img.format));

    issues.push({
      ...ISSUE_DEFINITIONS.IMAGE_NOT_WEBP_AVIF,
      affectedUrls: legacyImages.slice(0, 10).map((img) => img.src),
      details: {
        legacyImageCount: legacyFormatCount,
        modernImageCount: modernFormatCount,
        modernFormatPercentage,
        recommendation: 'Convert images to WebP or AVIF format for 25-50% smaller file sizes',
      },
    });
  }

  // Check for images without dimensions (causes CLS)
  const imagesWithoutDimensions = uniqueImages.filter(
    (img) => !img.hasDimensions && !img.isLazyLoaded && LEGACY_FORMATS.includes(img.format)
  );

  if (imagesWithoutDimensions.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.IMG_NO_DIMENSIONS,
      affectedUrls: imagesWithoutDimensions.slice(0, 10).map((img) => img.src),
      details: {
        count: imagesWithoutDimensions.length,
      },
    });
  }

  return {
    issues,
    data: {
      totalImages: uniqueImages.length,
      modernFormatCount,
      legacyFormatCount,
      modernFormatPercentage,
      images: uniqueImages,
      hasSourceSet,
      hasPictureElements,
    },
  };
}
