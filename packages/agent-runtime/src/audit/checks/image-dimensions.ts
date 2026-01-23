/**
 * Image Dimensions Check
 *
 * Verifies that images have explicit width and height attributes.
 * This prevents Cumulative Layout Shift (CLS) - a Core Web Vital.
 *
 * When images don't have dimensions, the browser doesn't know how much
 * space to reserve, causing content to jump when images load.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface ImageDimensionsData {
  totalImages: number;
  withDimensions: number;
  withoutDimensions: number;
  missingDimensions: ImageInfo[];
  aspectRatioSet: number;
}

interface ImageInfo {
  src: string;
  hasWidth: boolean;
  hasHeight: boolean;
  hasAspectRatio: boolean;
  context: string;
}

export function analyzeImageDimensions(
  html: string,
  url: string
): { issues: AuditIssue[]; data: ImageDimensionsData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const images = $('img');
  const totalImages = images.length;

  let withDimensions = 0;
  let withoutDimensions = 0;
  let aspectRatioSet = 0;
  const missingDimensions: ImageInfo[] = [];

  images.each((_, img) => {
    const $img = $(img);
    const src = $img.attr('src') || $img.attr('data-src') || '';

    // Check for width attribute (HTML attribute or style)
    const widthAttr = $img.attr('width');
    const heightAttr = $img.attr('height');
    const style = $img.attr('style') || '';

    const hasWidthAttr = Boolean(widthAttr);
    const hasHeightAttr = Boolean(heightAttr);
    const hasStyleWidth = /width\s*:/i.test(style);
    const hasStyleHeight = /height\s*:/i.test(style);
    const hasAspectRatio = /aspect-ratio\s*:/i.test(style);

    // Check CSS classes that might set dimensions
    const className = $img.attr('class') || '';

    // Consider dimensions set if either HTML attributes or inline styles are present
    const hasWidth = hasWidthAttr || hasStyleWidth;
    const hasHeight = hasHeightAttr || hasStyleHeight;
    const hasBothDimensions = (hasWidth && hasHeight) || hasAspectRatio;

    if (hasBothDimensions) {
      withDimensions++;
      if (hasAspectRatio) {
        aspectRatioSet++;
      }
    } else {
      withoutDimensions++;

      // Only report visible images (not lazy-loaded placeholder images)
      if (src && !src.includes('data:image/') && !src.includes('placeholder')) {
        // Get context (parent element for identification)
        const parent = $img.parent();
        const parentTag = parent.length > 0 ? (parent[0] as cheerio.Element).name || '' : '';
        const parentClass = parent.attr('class')?.split(' ')[0] || '';
        const context = parentClass ? `${parentTag}.${parentClass}` : parentTag;

        missingDimensions.push({
          src: truncateSrc(src),
          hasWidth,
          hasHeight,
          hasAspectRatio,
          context,
        });
      }
    }
  });

  // Generate issues
  if (withoutDimensions > 0) {
    // Calculate percentage
    const percentage = Math.round((withoutDimensions / totalImages) * 100);

    if (percentage > 50) {
      issues.push({
        code: 'IMAGES_MANY_MISSING_DIMENSIONS',
        severity: 'warning',
        category: 'performance',
        title: 'Most images missing explicit dimensions',
        description: `${withoutDimensions} of ${totalImages} images (${percentage}%) don't have width and height attributes. This causes layout shifts.`,
        impact: 'High Cumulative Layout Shift (CLS). Content jumps around as images load, frustrating users.',
        howToFix: 'Add width and height attributes to all <img> tags. Use CSS aspect-ratio for responsive images. Example: <img src="..." width="800" height="600">',
        affectedUrls: [url],
        details: {
          totalImages,
          withDimensions,
          withoutDimensions,
          examples: missingDimensions.slice(0, 5),
        },
      });
    } else if (withoutDimensions > 0) {
      issues.push({
        code: 'IMAGES_MISSING_DIMENSIONS',
        severity: 'notice',
        category: 'performance',
        title: 'Some images missing explicit dimensions',
        description: `${withoutDimensions} of ${totalImages} image(s) don't have width and height attributes.`,
        impact: 'May cause layout shifts when images load, affecting CLS score.',
        howToFix: 'Add width and height attributes: <img src="..." width="800" height="600">. For responsive images, also use CSS: img { max-width: 100%; height: auto; }',
        affectedUrls: [url],
        details: {
          images: missingDimensions.slice(0, 10),
        },
      });
    }
  }

  // Check for aspect-ratio usage (modern approach)
  if (withDimensions > 0 && aspectRatioSet === 0) {
    issues.push({
      code: 'IMAGES_NO_ASPECT_RATIO',
      severity: 'notice',
      category: 'performance',
      title: 'Consider using CSS aspect-ratio for images',
      description: 'Images have width/height but no CSS aspect-ratio. The aspect-ratio property provides better responsive behavior.',
      impact: 'Minor - existing dimensions prevent CLS, but aspect-ratio offers better control.',
      howToFix: 'Add CSS aspect-ratio for responsive images: img { aspect-ratio: 16/9; width: 100%; height: auto; }',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      totalImages,
      withDimensions,
      withoutDimensions,
      missingDimensions: missingDimensions.slice(0, 20),
      aspectRatioSet,
    },
  };
}

function truncateSrc(src: string): string {
  // Remove query strings and truncate long URLs
  const cleanSrc = src.split('?')[0];
  if (cleanSrc.length > 60) {
    return cleanSrc.substring(0, 30) + '...' + cleanSrc.substring(cleanSrc.length - 25);
  }
  return cleanSrc;
}
