/**
 * Color Contrast Accessibility Check
 *
 * Analyzes color contrast for WCAG 2.1 compliance.
 *
 * WCAG Requirements:
 * - AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt bold)
 * - AAA: 7:1 for normal text, 4.5:1 for large text
 *
 * Note: Full contrast checking requires rendering the page and computing
 * styles. This check analyzes inline styles and common patterns as a
 * heuristic approach.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface ColorContrastData {
  elementsAnalyzed: number;
  potentialIssues: ContrastIssue[];
  passedChecks: number;
  failedChecks: number;
  cannotDetermine: number;
}

interface ContrastIssue {
  selector: string;
  foreground: string;
  background: string;
  contrastRatio: number;
  wcagLevel: 'AA' | 'AAA' | 'none';
  isLargeText: boolean;
}

// Common problematic color combinations
const KNOWN_LOW_CONTRAST_PAIRS: Array<{ fg: string; bg: string; ratio: number }> = [
  { fg: '#999999', bg: '#ffffff', ratio: 2.85 },
  { fg: '#888888', bg: '#ffffff', ratio: 3.54 },
  { fg: '#aaaaaa', bg: '#ffffff', ratio: 2.32 },
  { fg: '#cccccc', bg: '#ffffff', ratio: 1.61 },
  { fg: '#666666', bg: '#000000', ratio: 5.74 },
  { fg: '#777777', bg: '#000000', ratio: 4.48 },
  { fg: 'gray', bg: 'white', ratio: 3.95 },
  { fg: 'silver', bg: 'white', ratio: 1.77 },
  { fg: 'lightgray', bg: 'white', ratio: 1.46 },
];

// Named colors to RGB mapping (common ones)
const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
  navy: [0, 0, 128],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  transparent: [255, 255, 255], // Treat as white for calculation
};

export function analyzeColorContrast(
  html: string,
  url: string
): { issues: AuditIssue[]; data: ColorContrastData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const potentialIssues: ContrastIssue[] = [];
  let elementsAnalyzed = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let cannotDetermine = 0;

  // Elements that typically contain text
  const textElements = $('p, span, a, button, h1, h2, h3, h4, h5, h6, li, td, th, label, div');

  textElements.each((_, element) => {
    const $el = $(element);
    const style = $el.attr('style') || '';

    // Skip elements without inline styles (we can't determine their computed styles)
    if (!style) {
      cannotDetermine++;
      return;
    }

    elementsAnalyzed++;

    // Extract colors from inline style
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const bgMatch = style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);

    const foreground = colorMatch ? colorMatch[1].trim() : null;
    const background = bgMatch ? bgMatch[1].trim() : null;

    // Skip if we can't determine both colors
    if (!foreground) {
      cannotDetermine++;
      return;
    }

    // Default background to white if not specified
    const bgColor = background || 'white';

    // Parse colors
    const fgRgb = parseColor(foreground);
    const bgRgb = parseColor(bgColor);

    if (!fgRgb || !bgRgb) {
      cannotDetermine++;
      return;
    }

    // Calculate contrast ratio
    const ratio = calculateContrastRatio(fgRgb, bgRgb);

    // Determine if large text
    const fontSize = style.match(/font-size\s*:\s*(\d+)(?:px|pt)?/i);
    const fontWeight = style.match(/font-weight\s*:\s*(\d+|bold)/i);
    const isLargeText =
      (fontSize && parseInt(fontSize[1]) >= 18) ||
      (fontSize && parseInt(fontSize[1]) >= 14 && fontWeight && (fontWeight[1] === 'bold' || parseInt(fontWeight[1]) >= 700));

    // Check WCAG compliance
    const aaThreshold = isLargeText ? 3.0 : 4.5;
    const aaaThreshold = isLargeText ? 4.5 : 7.0;

    let wcagLevel: 'AA' | 'AAA' | 'none' = 'none';
    if (ratio >= aaaThreshold) {
      wcagLevel = 'AAA';
      passedChecks++;
    } else if (ratio >= aaThreshold) {
      wcagLevel = 'AA';
      passedChecks++;
    } else {
      failedChecks++;

      // Create selector for identification
      const tagName = (element as cheerio.Element).name;
      const id = $el.attr('id');
      const className = $el.attr('class')?.split(' ')[0];
      const selector = id ? `#${id}` : (className ? `${tagName}.${className}` : tagName);

      potentialIssues.push({
        selector,
        foreground,
        background: bgColor,
        contrastRatio: Math.round(ratio * 100) / 100,
        wcagLevel,
        isLargeText: isLargeText || false,
      });
    }
  });

  // Also check for known problematic color classes
  const styleTag = $('style').text();
  for (const pair of KNOWN_LOW_CONTRAST_PAIRS) {
    if (styleTag.includes(pair.fg) && styleTag.includes(pair.bg)) {
      // Potential issue in stylesheet
    }
  }

  // Generate issues
  if (potentialIssues.length > 0) {
    const criticalIssues = potentialIssues.filter(i => i.contrastRatio < 3);
    const moderateIssues = potentialIssues.filter(i => i.contrastRatio >= 3 && i.contrastRatio < 4.5);

    if (criticalIssues.length > 0) {
      issues.push({
        code: 'A11Y_CONTRAST_CRITICAL',
        severity: 'error',
        category: 'accessibility',
        title: 'Critical color contrast issues',
        description: `Found ${criticalIssues.length} element(s) with very low contrast (below 3:1). This text may be unreadable for many users.`,
        impact: 'Users with low vision or color blindness cannot read this content. Fails WCAG accessibility requirements.',
        howToFix: 'Increase contrast by using darker text on light backgrounds or lighter text on dark backgrounds. Use a contrast checker tool to verify 4.5:1 ratio minimum.',
        affectedUrls: [url],
        details: {
          issues: criticalIssues.slice(0, 5),
          recommendation: 'WCAG AA requires 4.5:1 contrast for normal text, 3:1 for large text.',
        },
      });
    }

    if (moderateIssues.length > 0) {
      issues.push({
        code: 'A11Y_CONTRAST_LOW',
        severity: 'warning',
        category: 'accessibility',
        title: 'Low color contrast detected',
        description: `Found ${moderateIssues.length} element(s) with contrast below WCAG AA standard (4.5:1).`,
        impact: 'May be difficult to read for users with visual impairments.',
        howToFix: 'Adjust colors to achieve at least 4.5:1 contrast ratio for normal text.',
        affectedUrls: [url],
        details: {
          issues: moderateIssues.slice(0, 5),
        },
      });
    }
  }

  // Note about limitations
  if (cannotDetermine > elementsAnalyzed * 0.8) {
    issues.push({
      code: 'A11Y_CONTRAST_UNDETERMINED',
      severity: 'notice',
      category: 'accessibility',
      title: 'Color contrast could not be fully analyzed',
      description: 'Most text colors are set via CSS stylesheets rather than inline styles. Full contrast checking requires browser rendering.',
      impact: 'Potential contrast issues may exist that were not detected.',
      howToFix: 'Use browser DevTools (Lighthouse accessibility audit) or dedicated tools like axe-core for comprehensive contrast checking.',
      affectedUrls: [url],
      details: {
        elementsAnalyzed,
        cannotDetermine,
        recommendation: 'Run Lighthouse accessibility audit for complete contrast analysis.',
      },
    });
  }

  return {
    issues,
    data: {
      elementsAnalyzed,
      potentialIssues,
      passedChecks,
      failedChecks,
      cannotDetermine,
    },
  };
}

/**
 * Parse a CSS color value to RGB
 */
function parseColor(color: string): [number, number, number] | null {
  const trimmed = color.trim().toLowerCase();

  // Named colors
  if (NAMED_COLORS[trimmed]) {
    return NAMED_COLORS[trimmed];
  }

  // Hex colors
  const hexMatch = trimmed.match(/^#?([a-f0-9]{3}|[a-f0-9]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  // RGB/RGBA
  const rgbMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3]),
    ];
  }

  // HSL (simplified conversion)
  const hslMatch = trimmed.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]) / 360;
    const s = parseInt(hslMatch[2]) / 100;
    const l = parseInt(hslMatch[3]) / 100;
    return hslToRgb(h, s, l);
  }

  return null;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Calculate relative luminance according to WCAG 2.1
 */
function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio according to WCAG 2.1
 */
function calculateContrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bg);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}
