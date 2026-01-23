/**
 * Asset Minification Check
 *
 * Checks if CSS and JavaScript files are properly minified.
 * Unminified files contain unnecessary whitespace, comments, and long variable names
 * that increase file size and slow down page load times.
 *
 * Detection methods:
 * - Whitespace ratio (minified files have very low whitespace)
 * - Average line length (minified files have very long lines)
 * - Comment presence (minified files have no comments)
 */

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface MinificationData {
  cssFiles: AssetMinificationInfo[];
  jsFiles: AssetMinificationInfo[];
  totalCssFiles: number;
  totalJsFiles: number;
  unminifiedCss: number;
  unminifiedJs: number;
  potentialSavings: {
    css: number; // estimated bytes
    js: number;
  };
}

interface AssetMinificationInfo {
  url: string;
  size: number;
  isMinified: boolean;
  indicators: {
    avgLineLength: number;
    whitespaceRatio: number;
    hasComments: boolean;
  };
}

/**
 * Detect if content is minified
 */
function isMinified(content: string, type: 'css' | 'js'): { isMinified: boolean; indicators: AssetMinificationInfo['indicators'] } {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const avgLineLength = totalLines > 0 ? content.length / totalLines : 0;

  // Count whitespace characters (spaces, tabs, newlines)
  const whitespaceCount = (content.match(/\s/g) || []).length;
  const whitespaceRatio = content.length > 0 ? whitespaceCount / content.length : 0;

  // Check for comments
  let hasComments = false;
  if (type === 'css') {
    // CSS comments: /* ... */
    hasComments = /\/\*[\s\S]*?\*\//.test(content);
  } else {
    // JS comments: // ... or /* ... */
    hasComments = /\/\/[^\n]*|\/\*[\s\S]*?\*\//.test(content);
  }

  // Minification indicators:
  // - Average line length > 500 chars (minified = long lines)
  // - Whitespace ratio < 10% (minified = little whitespace)
  // - No comments
  const isMinifiedByLineLength = avgLineLength > 500;
  const isMinifiedByWhitespace = whitespaceRatio < 0.1;
  const isMinifiedByComments = !hasComments;

  // Consider minified if at least 2 of 3 indicators pass
  // OR if single-line file with reasonable length (common for small minified files)
  const score = (isMinifiedByLineLength ? 1 : 0) + (isMinifiedByWhitespace ? 1 : 0) + (isMinifiedByComments ? 1 : 0);
  const isSingleLineMinified = totalLines <= 2 && avgLineLength > 100;

  return {
    isMinified: score >= 2 || isSingleLineMinified,
    indicators: {
      avgLineLength: Math.round(avgLineLength),
      whitespaceRatio: Math.round(whitespaceRatio * 100) / 100,
      hasComments,
    },
  };
}

/**
 * Extract asset URLs from HTML
 */
function extractAssetUrls(html: string, baseUrl: string): { css: string[]; js: string[] } {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const css: string[] = [];
  const js: string[] = [];

  // Extract CSS files
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('data:')) {
      try {
        const fullUrl = new URL(href, base).href;
        // Only check first-party CSS
        if (new URL(fullUrl).hostname === base.hostname) {
          css.push(fullUrl);
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Extract JS files
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) {
      try {
        const fullUrl = new URL(src, base).href;
        // Only check first-party JS
        if (new URL(fullUrl).hostname === base.hostname) {
          js.push(fullUrl);
        }
      } catch {
        // Invalid URL
      }
    }
  });

  return { css, js };
}

/**
 * Analyze asset minification
 */
export async function analyzeAssetMinification(
  html: string,
  url: string
): Promise<{ issues: AuditIssue[]; data: MinificationData }> {
  const issues: AuditIssue[] = [];
  const assetUrls = extractAssetUrls(html, url);

  const cssFiles: AssetMinificationInfo[] = [];
  const jsFiles: AssetMinificationInfo[] = [];

  // Check CSS files (limit to 3, parallel with short timeout)
  const cssToCheck = assetUrls.css.slice(0, 3);
  const cssPromises = cssToCheck.map(async (cssUrl) => {
    try {
      const response = await httpGet<string>(cssUrl, {
        timeout: 3000, // Reduced timeout
        validateStatus: () => true,
      });

      if (response.status === 200 && typeof response.data === 'string') {
        const content = response.data;
        const { isMinified: minified, indicators } = isMinified(content, 'css');

        cssFiles.push({
          url: cssUrl,
          size: content.length,
          isMinified: minified,
          indicators,
        });
      }
    } catch {
      // Skip failed requests
    }
  });

  // Check JS files (limit to 3, parallel with short timeout)
  const jsToCheck = assetUrls.js.slice(0, 3);
  const jsPromises = jsToCheck.map(async (jsUrl) => {
    try {
      const response = await httpGet<string>(jsUrl, {
        timeout: 3000, // Reduced timeout
        validateStatus: () => true,
      });

      if (response.status === 200 && typeof response.data === 'string') {
        const content = response.data;
        const { isMinified: minified, indicators } = isMinified(content, 'js');

        jsFiles.push({
          url: jsUrl,
          size: content.length,
          isMinified: minified,
          indicators,
        });
      }
    } catch {
      // Skip failed requests
    }
  });

  // Run all checks in parallel with overall timeout
  await Promise.race([
    Promise.all([...cssPromises, ...jsPromises]),
    new Promise<void>((resolve) => setTimeout(resolve, 8000)), // 8s overall timeout
  ]);

  // Count unminified files
  const unminifiedCss = cssFiles.filter((f) => !f.isMinified);
  const unminifiedJs = jsFiles.filter((f) => !f.isMinified);

  // Estimate potential savings (minification typically saves 30-50%)
  const cssSavings = unminifiedCss.reduce((sum, f) => sum + Math.round(f.size * 0.4), 0);
  const jsSavings = unminifiedJs.reduce((sum, f) => sum + Math.round(f.size * 0.4), 0);

  // Generate issues
  if (unminifiedCss.length > 0) {
    issues.push({
      code: 'CSS_NOT_MINIFIED',
      severity: 'warning',
      category: 'performance',
      title: 'CSS files not minified',
      description: `${unminifiedCss.length} CSS file(s) appear to not be minified. Minification removes whitespace and comments to reduce file size.`,
      impact: `Unminified CSS increases page load time. Potential savings: ~${Math.round(cssSavings / 1024)}KB.`,
      howToFix:
        'Use a CSS minifier like cssnano, clean-css, or build tools (Vite, Webpack) to minify CSS files. Most bundlers do this automatically in production builds.',
      affectedUrls: unminifiedCss.map((f) => f.url),
      details: {
        files: unminifiedCss.map((f) => ({
          url: f.url,
          size: `${Math.round(f.size / 1024)}KB`,
          avgLineLength: f.indicators.avgLineLength,
          whitespaceRatio: `${Math.round(f.indicators.whitespaceRatio * 100)}%`,
          hasComments: f.indicators.hasComments,
        })),
      },
    });
  }

  if (unminifiedJs.length > 0) {
    issues.push({
      code: 'JS_NOT_MINIFIED',
      severity: 'warning',
      category: 'performance',
      title: 'JavaScript files not minified',
      description: `${unminifiedJs.length} JavaScript file(s) appear to not be minified. Minification removes whitespace, comments, and shortens variable names.`,
      impact: `Unminified JavaScript increases page load time and parsing time. Potential savings: ~${Math.round(jsSavings / 1024)}KB.`,
      howToFix:
        'Use a JS minifier like Terser, UglifyJS, or build tools (Vite, Webpack, esbuild) to minify JavaScript. Most bundlers do this automatically in production builds.',
      affectedUrls: unminifiedJs.map((f) => f.url),
      details: {
        files: unminifiedJs.map((f) => ({
          url: f.url,
          size: `${Math.round(f.size / 1024)}KB`,
          avgLineLength: f.indicators.avgLineLength,
          whitespaceRatio: `${Math.round(f.indicators.whitespaceRatio * 100)}%`,
          hasComments: f.indicators.hasComments,
        })),
      },
    });
  }

  return {
    issues,
    data: {
      cssFiles,
      jsFiles,
      totalCssFiles: assetUrls.css.length,
      totalJsFiles: assetUrls.js.length,
      unminifiedCss: unminifiedCss.length,
      unminifiedJs: unminifiedJs.length,
      potentialSavings: {
        css: cssSavings,
        js: jsSavings,
      },
    },
  };
}
