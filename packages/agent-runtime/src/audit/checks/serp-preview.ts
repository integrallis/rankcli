// SERP Preview and Pixel-based Meta Analysis
// Calculates pixel widths for title and description for accurate SERP display prediction

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

// Google's approximate character widths in pixels (based on their font)
// This is a simplified approximation - real pixel widths vary by character
const CHAR_WIDTHS: Record<string, number> = {
  // Lowercase letters
  a: 9, b: 9, c: 8, d: 9, e: 9, f: 5, g: 9, h: 9, i: 4, j: 4,
  k: 8, l: 4, m: 14, n: 9, o: 9, p: 9, q: 9, r: 6, s: 8, t: 5,
  u: 9, v: 8, w: 12, x: 8, y: 8, z: 7,
  // Uppercase letters
  A: 11, B: 10, C: 10, D: 11, E: 9, F: 9, G: 11, H: 11, I: 4, J: 8,
  K: 10, L: 8, M: 13, N: 11, O: 12, P: 10, Q: 12, R: 10, S: 10, T: 9,
  U: 11, V: 10, W: 14, X: 10, Y: 10, Z: 9,
  // Numbers
  '0': 9, '1': 9, '2': 9, '3': 9, '4': 9, '5': 9, '6': 9, '7': 9, '8': 9, '9': 9,
  // Common punctuation and spaces
  ' ': 4, '.': 4, ',': 4, '!': 4, '?': 8, '-': 5, '_': 8, ':': 4, ';': 4,
  "'": 3, '"': 6, '(': 5, ')': 5, '[': 5, ']': 5, '/': 5, '|': 4, '&': 10,
  '@': 14, '#': 9, '$': 9, '%': 12, '^': 7, '*': 6, '+': 9, '=': 9,
};

// Default width for unknown characters
const DEFAULT_CHAR_WIDTH = 9;

// SERP pixel limits
const TITLE_MAX_PIXELS = 580; // Google's title limit
const DESCRIPTION_MAX_PIXELS_DESKTOP = 920; // Desktop description limit
const DESCRIPTION_MAX_PIXELS_MOBILE = 680; // Mobile description limit

export interface SERPPreviewData {
  title: {
    text: string;
    charLength: number;
    pixelWidth: number;
    truncated: boolean;
    displayText: string;
  };
  description: {
    text: string;
    charLength: number;
    pixelWidthDesktop: number;
    pixelWidthMobile: number;
    truncatedDesktop: boolean;
    truncatedMobile: boolean;
    displayTextDesktop: string;
    displayTextMobile: string;
  };
  url: {
    display: string;
    breadcrumbs: string[];
  };
  preview: {
    desktop: string;
    mobile: string;
  };
}

/**
 * Calculate pixel width of a string
 */
function calculatePixelWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += CHAR_WIDTHS[char] ?? DEFAULT_CHAR_WIDTH;
  }
  return width;
}

/**
 * Truncate text to fit within pixel limit
 */
function truncateToPixels(text: string, maxPixels: number): { text: string; truncated: boolean } {
  let width = 0;
  let truncated = false;

  for (let i = 0; i < text.length; i++) {
    const charWidth = CHAR_WIDTHS[text[i]] ?? DEFAULT_CHAR_WIDTH;
    if (width + charWidth > maxPixels - 20) {
      // Leave room for "..."
      truncated = true;
      return { text: text.substring(0, i) + '...', truncated };
    }
    width += charWidth;
  }

  return { text, truncated };
}

/**
 * Format URL for SERP display
 */
function formatSERPUrl(url: string): { display: string; breadcrumbs: string[] } {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // Create breadcrumb-style path
    const breadcrumbs = [domain, ...pathParts];

    // SERP display format
    const display = breadcrumbs.join(' › ');

    return { display, breadcrumbs };
  } catch {
    return { display: url, breadcrumbs: [url] };
  }
}

/**
 * Analyze SERP preview and generate pixel-based issues
 */
export function analyzeSERPPreview(html: string, url: string): { issues: AuditIssue[]; data: SERPPreviewData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Extract title
  const rawTitle = $('title').text().trim() || '';
  const titlePixels = calculatePixelWidth(rawTitle);
  const titleTruncated = truncateToPixels(rawTitle, TITLE_MAX_PIXELS);

  // Extract meta description
  const rawDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';
  const descPixelsDesktop = calculatePixelWidth(rawDescription);
  const descPixelsMobile = calculatePixelWidth(rawDescription);
  const descTruncatedDesktop = truncateToPixels(rawDescription, DESCRIPTION_MAX_PIXELS_DESKTOP);
  const descTruncatedMobile = truncateToPixels(rawDescription, DESCRIPTION_MAX_PIXELS_MOBILE);

  // Format URL
  const urlData = formatSERPUrl(url);

  // Generate issues
  if (titleTruncated.truncated) {
    issues.push({
      ...ISSUE_DEFINITIONS.TITLE_TRUNCATED_SERP,
      affectedUrls: [url],
      details: {
        pixelWidth: titlePixels,
        maxPixels: TITLE_MAX_PIXELS,
        charLength: rawTitle.length,
        displayPreview: titleTruncated.text,
      },
    });
  }

  if (descTruncatedDesktop.truncated) {
    issues.push({
      ...ISSUE_DEFINITIONS.META_DESC_TRUNCATED_SERP,
      affectedUrls: [url],
      details: {
        pixelWidth: descPixelsDesktop,
        maxPixels: DESCRIPTION_MAX_PIXELS_DESKTOP,
        charLength: rawDescription.length,
        displayPreview: descTruncatedDesktop.text,
      },
    });
  }

  // Build preview data
  const data: SERPPreviewData = {
    title: {
      text: rawTitle,
      charLength: rawTitle.length,
      pixelWidth: titlePixels,
      truncated: titleTruncated.truncated,
      displayText: titleTruncated.text,
    },
    description: {
      text: rawDescription,
      charLength: rawDescription.length,
      pixelWidthDesktop: descPixelsDesktop,
      pixelWidthMobile: descPixelsMobile,
      truncatedDesktop: descTruncatedDesktop.truncated,
      truncatedMobile: descTruncatedMobile.truncated,
      displayTextDesktop: descTruncatedDesktop.text,
      displayTextMobile: descTruncatedMobile.text,
    },
    url: urlData,
    preview: {
      desktop: generateDesktopPreview(titleTruncated.text, descTruncatedDesktop.text, urlData.display),
      mobile: generateMobilePreview(titleTruncated.text, descTruncatedMobile.text, urlData.display),
    },
  };

  return { issues, data };
}

/**
 * Generate ASCII art SERP preview for desktop
 */
function generateDesktopPreview(title: string, description: string, url: string): string {
  const maxWidth = 60;
  const titleLine = title.length > maxWidth ? title.substring(0, maxWidth - 3) + '...' : title;
  const urlLine = url.length > maxWidth ? url.substring(0, maxWidth - 3) + '...' : url;
  const descLines = wrapText(description, maxWidth);

  return [
    '┌' + '─'.repeat(maxWidth + 2) + '┐',
    '│ ' + titleLine.padEnd(maxWidth) + ' │',
    '│ ' + urlLine.padEnd(maxWidth) + ' │',
    ...descLines.map((line) => '│ ' + line.padEnd(maxWidth) + ' │'),
    '└' + '─'.repeat(maxWidth + 2) + '┘',
  ].join('\n');
}

/**
 * Generate ASCII art SERP preview for mobile
 */
function generateMobilePreview(title: string, description: string, url: string): string {
  const maxWidth = 40;
  const titleLine = title.length > maxWidth ? title.substring(0, maxWidth - 3) + '...' : title;
  const urlLine = url.length > maxWidth ? url.substring(0, maxWidth - 3) + '...' : url;
  const descLines = wrapText(description, maxWidth);

  return [
    '┌' + '─'.repeat(maxWidth + 2) + '┐',
    '│ ' + titleLine.padEnd(maxWidth) + ' │',
    '│ ' + urlLine.padEnd(maxWidth) + ' │',
    ...descLines.slice(0, 2).map((line) => '│ ' + line.padEnd(maxWidth) + ' │'),
    '└' + '─'.repeat(maxWidth + 2) + '┘',
  ].join('\n');
}

/**
 * Wrap text to specified width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}
