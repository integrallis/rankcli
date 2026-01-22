// DOM Analysis Checks
// Checks for DOM size, depth, and render-blocking resources

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

const DOM_SIZE_WARNING = 1500;
const DOM_SIZE_ERROR = 3000;
const DOM_DEPTH_WARNING = 32;

export interface DOMAnalysisData {
  nodeCount: number;
  maxDepth: number;
  renderBlockingResources: {
    css: string[];
    js: string[];
  };
  totalRenderBlockingSize: number;
  criticalPathLength: number;
}

/**
 * Count total DOM nodes
 */
function countNodes($: cheerio.CheerioAPI): number {
  let count = 0;

  function traverse(element: unknown): void {
    count++;
    const el = element as { children?: unknown[] };
    if (el.children) {
      for (const child of el.children) {
        traverse(child);
      }
    }
  }

  const root = $.root();
  root.each((_, el) => traverse(el));

  return count;
}

/**
 * Calculate maximum DOM depth
 */
function calculateMaxDepth($: cheerio.CheerioAPI): number {
  let maxDepth = 0;

  function traverse(element: unknown, depth: number): void {
    maxDepth = Math.max(maxDepth, depth);
    const el = element as { children?: unknown[] };
    if (el.children) {
      for (const child of el.children) {
        traverse(child, depth + 1);
      }
    }
  }

  const root = $.root();
  root.each((_, el) => traverse(el, 0));

  return maxDepth;
}

/**
 * Find render-blocking resources
 */
function findRenderBlockingResources($: cheerio.CheerioAPI): { css: string[]; js: string[] } {
  const css: string[] = [];
  const js: string[] = [];

  // Find render-blocking CSS (in head, without media="print" or disabled)
  $('head link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    const media = $(el).attr('media');
    const disabled = $(el).attr('disabled');

    if (href && media !== 'print' && !disabled) {
      css.push(href);
    }
  });

  // Find inline style tags in head (blocking)
  $('head style').each((_, el) => {
    const content = $(el).html();
    if (content && content.trim().length > 100) {
      css.push('[inline-style]');
    }
  });

  // Find render-blocking JS (in head, without async/defer)
  $('head script[src]').each((_, el) => {
    const src = $(el).attr('src');
    const async = $(el).attr('async');
    const defer = $(el).attr('defer');
    const type = $(el).attr('type');

    // Skip module scripts (they're deferred by default) and non-JS
    if (type === 'module' || (type && !type.includes('javascript'))) {
      return;
    }

    if (src && !async && !defer) {
      js.push(src);
    }
  });

  return { css, js };
}

/**
 * Analyze DOM structure and render-blocking resources
 */
export function analyzeDOMStructure(html: string, url: string): { issues: AuditIssue[]; data: DOMAnalysisData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Count nodes
  const nodeCount = countNodes($);

  // Calculate depth
  const maxDepth = calculateMaxDepth($);

  // Find render-blocking resources
  const renderBlockingResources = findRenderBlockingResources($);
  const criticalPathLength = renderBlockingResources.css.length + renderBlockingResources.js.length;

  // Generate issues
  if (nodeCount > DOM_SIZE_ERROR) {
    issues.push({
      ...ISSUE_DEFINITIONS.DOM_SIZE_EXCESSIVE,
      severity: 'error',
      affectedUrls: [url],
      details: {
        nodeCount,
        threshold: DOM_SIZE_WARNING,
        recommendation: 'Reduce DOM size to under 1500 nodes',
      },
    });
  } else if (nodeCount > DOM_SIZE_WARNING) {
    issues.push({
      ...ISSUE_DEFINITIONS.DOM_SIZE_EXCESSIVE,
      affectedUrls: [url],
      details: {
        nodeCount,
        threshold: DOM_SIZE_WARNING,
        recommendation: 'Consider simplifying page structure',
      },
    });
  }

  if (maxDepth > DOM_DEPTH_WARNING) {
    issues.push({
      ...ISSUE_DEFINITIONS.DOM_DEPTH_EXCESSIVE,
      affectedUrls: [url],
      details: {
        maxDepth,
        threshold: DOM_DEPTH_WARNING,
      },
    });
  }

  if (criticalPathLength > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.RENDER_BLOCKING_RESOURCES,
      affectedUrls: [url],
      details: {
        cssFiles: renderBlockingResources.css,
        jsFiles: renderBlockingResources.js,
        totalCount: criticalPathLength,
        recommendation:
          criticalPathLength > 3
            ? 'Inline critical CSS and defer non-critical resources'
            : 'Consider using async/defer for scripts',
      },
    });
  }

  return {
    issues,
    data: {
      nodeCount,
      maxDepth,
      renderBlockingResources,
      totalRenderBlockingSize: 0, // Would need to fetch resources to calculate
      criticalPathLength,
    },
  };
}
