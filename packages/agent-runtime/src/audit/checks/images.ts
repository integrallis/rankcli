import * as cheerio from 'cheerio';
import axios from 'axios';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

const USER_AGENT = 'SEO-Autopilot/1.0 (+https://seo-autopilot.dev)';

export interface ImageData {
  total: number;
  missingAlt: { src: string }[];
  emptyAlt: { src: string }[];
  missingDimensions: { src: string }[];
  largImages: { src: string; size?: number }[];
  brokenImages: { src: string }[];
  lazyLoaded: number;
  withDimensions: number;
}

export async function analyzeImages(
  html: string,
  baseUrl: string,
  checkBroken: boolean = false
): Promise<{ issues: AuditIssue[]; data: ImageData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const missingAlt: ImageData['missingAlt'] = [];
  const emptyAlt: ImageData['emptyAlt'] = [];
  const missingDimensions: ImageData['missingDimensions'] = [];
  const largeImages: ImageData['largImages'] = [];
  const brokenImages: ImageData['brokenImages'] = [];
  let lazyLoaded = 0;
  let withDimensions = 0;
  let total = 0;

  const images: { src: string; alt: string | null; width: string | undefined; height: string | undefined; loading: string | undefined }[] = [];

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const alt = $(el).attr('alt');
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    const loading = $(el).attr('loading');

    if (!src || src.startsWith('data:')) return; // Skip data URIs

    total++;
    images.push({ src, alt: alt === undefined ? null : alt, width, height, loading });

    // Check alt text
    if (alt === undefined || alt === null) {
      missingAlt.push({ src });
    } else if (alt === '') {
      emptyAlt.push({ src });
    }

    // Check dimensions
    if (!width || !height) {
      missingDimensions.push({ src });
    } else {
      withDimensions++;
    }

    // Check lazy loading
    if (loading === 'lazy') {
      lazyLoaded++;
    }
  });

  // Check for broken images and large images (limited)
  if (checkBroken) {
    const imagesToCheck = images.slice(0, 10);
    for (const img of imagesToCheck) {
      try {
        const fullUrl = new URL(img.src, baseUrl).href;
        const response = await axios.head(fullUrl, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 5000,
          validateStatus: () => true,
        });

        if (response.status >= 400) {
          brokenImages.push({ src: img.src });
        } else {
          // Check file size
          const contentLength = parseInt(response.headers['content-length'] || '0', 10);
          if (contentLength > 200 * 1024) { // > 200KB
            largeImages.push({ src: img.src, size: contentLength });
          }
        }
      } catch {
        // Don't mark as broken for network errors
      }
    }
  }

  // Generate issues
  if (missingAlt.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.IMG_ALT_MISSING,
      affectedUrls: [baseUrl],
      details: {
        count: missingAlt.length,
        images: missingAlt.slice(0, 5).map(i => i.src),
      },
    });
  }

  if (emptyAlt.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.IMG_ALT_EMPTY,
      affectedUrls: [baseUrl],
      details: {
        count: emptyAlt.length,
        images: emptyAlt.slice(0, 5).map(i => i.src),
      },
    });
  }

  if (missingDimensions.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.IMG_NO_DIMENSIONS,
      affectedUrls: [baseUrl],
      details: {
        count: missingDimensions.length,
        images: missingDimensions.slice(0, 5).map(i => i.src),
      },
    });
  }

  for (const img of largeImages) {
    issues.push({
      ...ISSUE_DEFINITIONS.IMG_TOO_LARGE,
      affectedUrls: [baseUrl],
      details: {
        src: img.src,
        size: img.size ? `${(img.size / 1024).toFixed(0)}KB` : 'Unknown',
      },
    });
  }

  for (const img of brokenImages) {
    issues.push({
      ...ISSUE_DEFINITIONS.IMG_BROKEN,
      affectedUrls: [baseUrl],
      details: { src: img.src },
    });
  }

  return {
    issues,
    data: {
      total,
      missingAlt,
      emptyAlt,
      missingDimensions,
      largImages: largeImages,
      brokenImages,
      lazyLoaded,
      withDimensions,
    }
  };
}
