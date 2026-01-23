/**
 * DOM Size Check
 *
 * Analyzes DOM complexity which affects:
 * - Memory usage
 * - JavaScript performance
 * - Style calculations
 * - Layout/reflow operations
 *
 * Google Lighthouse thresholds:
 * - Total elements: >1500 triggers warning, >3000 fails
 * - Maximum depth: >32 triggers warning
 * - Maximum children: >60 triggers warning
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface DomSizeData {
  totalElements: number;
  maxDepth: number;
  maxChildren: number;
  deepestPath: string[];
  widestElement: {
    selector: string;
    childCount: number;
  };
  elementBreakdown: {
    divs: number;
    spans: number;
    tables: number;
    lists: number;
    forms: number;
    inputs: number;
    images: number;
    scripts: number;
    svgs: number;
  };
}

// Lighthouse thresholds
const THRESHOLDS = {
  totalElements: {
    warning: 1500,
    error: 3000,
  },
  maxDepth: {
    warning: 32,
    error: 64,
  },
  maxChildren: {
    warning: 60,
    error: 120,
  },
};

export function analyzeDomSize(
  html: string,
  url: string
): { issues: AuditIssue[]; data: DomSizeData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Count total elements
  const allElements = $('*');
  const totalElements = allElements.length;

  // Calculate max depth and find deepest path
  let maxDepth = 0;
  let deepestPath: string[] = [];

  function getDepth(element: cheerio.Cheerio<cheerio.Element>, path: string[]): number {
    const children = element.children();
    if (children.length === 0) {
      if (path.length > maxDepth) {
        maxDepth = path.length;
        deepestPath = [...path];
      }
      return path.length;
    }

    let maxChildDepth = path.length;
    children.each((_, child) => {
      const $child = $(child);
      const tagName = child.type === 'tag' ? child.name : '';
      if (tagName) {
        const childPath = [...path, tagName];
        const childDepth = getDepth($child, childPath);
        if (childDepth > maxChildDepth) {
          maxChildDepth = childDepth;
        }
      }
    });

    return maxChildDepth;
  }

  // Start from body
  const $body = $('body');
  if ($body.length > 0) {
    getDepth($body, ['body']);
  }

  // Find element with most children
  let maxChildren = 0;
  let widestSelector = '';

  allElements.each((_, element) => {
    const $el = $(element);
    const directChildren = $el.children().length;
    if (directChildren > maxChildren) {
      maxChildren = directChildren;
      // Create a simple selector
      const tagName = element.type === 'tag' ? element.name : '';
      const id = $el.attr('id');
      const className = $el.attr('class')?.split(' ')[0];
      widestSelector = id ? `#${id}` : (className ? `${tagName}.${className}` : tagName);
    }
  });

  // Element breakdown
  const elementBreakdown = {
    divs: $('div').length,
    spans: $('span').length,
    tables: $('table').length,
    lists: $('ul, ol, li').length,
    forms: $('form').length,
    inputs: $('input, select, textarea').length,
    images: $('img').length,
    scripts: $('script').length,
    svgs: $('svg').length,
  };

  // Generate issues

  // Total elements check
  if (totalElements > THRESHOLDS.totalElements.error) {
    issues.push({
      code: 'DOM_SIZE_EXCESSIVE',
      severity: 'error',
      category: 'performance',
      title: 'Excessive DOM size',
      description: `Page has ${totalElements.toLocaleString()} DOM elements (threshold: ${THRESHOLDS.totalElements.error.toLocaleString()}). This severely impacts performance.`,
      impact: 'Significantly slower rendering, increased memory usage, and degraded interactivity. Users on low-end devices will experience major lag.',
      howToFix: 'Reduce DOM complexity: virtualize long lists, lazy-load content, remove unnecessary wrapper elements, use CSS instead of extra markup.',
      affectedUrls: [url],
      details: {
        totalElements,
        breakdown: elementBreakdown,
        suggestions: getDomReductionSuggestions(elementBreakdown),
      },
    });
  } else if (totalElements > THRESHOLDS.totalElements.warning) {
    issues.push({
      code: 'DOM_SIZE_LARGE',
      severity: 'warning',
      category: 'performance',
      title: 'Large DOM size',
      description: `Page has ${totalElements.toLocaleString()} DOM elements (recommended: <${THRESHOLDS.totalElements.warning.toLocaleString()}).`,
      impact: 'Slower style calculations, layout operations, and JavaScript performance.',
      howToFix: 'Consider reducing DOM size: remove unnecessary elements, lazy-load off-screen content, virtualize long lists.',
      affectedUrls: [url],
      details: {
        totalElements,
        threshold: THRESHOLDS.totalElements.warning,
      },
    });
  }

  // Max depth check
  if (maxDepth > THRESHOLDS.maxDepth.warning) {
    issues.push({
      code: 'DOM_DEPTH_EXCESSIVE',
      severity: maxDepth > THRESHOLDS.maxDepth.error ? 'error' : 'warning',
      category: 'performance',
      title: 'Excessive DOM depth',
      description: `Maximum DOM depth is ${maxDepth} levels (recommended: <${THRESHOLDS.maxDepth.warning}).`,
      impact: 'Deep nesting increases style calculation time and can cause stack overflow in some browsers.',
      howToFix: 'Flatten your HTML structure. Remove unnecessary wrapper divs. Use CSS flexbox/grid instead of nested containers.',
      affectedUrls: [url],
      details: {
        maxDepth,
        deepestPath: deepestPath.slice(0, 10).join(' > ') + (deepestPath.length > 10 ? '...' : ''),
      },
    });
  }

  // Max children check
  if (maxChildren > THRESHOLDS.maxChildren.warning) {
    issues.push({
      code: 'DOM_CHILDREN_EXCESSIVE',
      severity: maxChildren > THRESHOLDS.maxChildren.error ? 'error' : 'warning',
      category: 'performance',
      title: 'Element has too many children',
      description: `An element has ${maxChildren} direct children (recommended: <${THRESHOLDS.maxChildren.warning}).`,
      impact: 'Adding/removing children triggers expensive layout recalculations.',
      howToFix: 'Break large lists into smaller chunks. Use virtual scrolling for long lists. Group items into sections.',
      affectedUrls: [url],
      details: {
        maxChildren,
        element: widestSelector,
      },
    });
  }

  return {
    issues,
    data: {
      totalElements,
      maxDepth,
      maxChildren,
      deepestPath,
      widestElement: {
        selector: widestSelector,
        childCount: maxChildren,
      },
      elementBreakdown,
    },
  };
}

function getDomReductionSuggestions(breakdown: DomSizeData['elementBreakdown']): string[] {
  const suggestions: string[] = [];

  if (breakdown.divs > 500) {
    suggestions.push(`High div count (${breakdown.divs}): Review wrapper divs that may be unnecessary`);
  }

  if (breakdown.spans > 200) {
    suggestions.push(`High span count (${breakdown.spans}): Consider if all spans are needed for styling`);
  }

  if (breakdown.tables > 10) {
    suggestions.push(`Multiple tables (${breakdown.tables}): Consider CSS grid/flexbox for layouts`);
  }

  if (breakdown.lists > 100) {
    suggestions.push(`Many list items (${breakdown.lists}): Consider virtualizing long lists`);
  }

  if (breakdown.svgs > 50) {
    suggestions.push(`Many SVGs (${breakdown.svgs}): Consider SVG sprites or icon fonts`);
  }

  return suggestions;
}
