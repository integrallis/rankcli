import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface MobileData {
  hasViewport: boolean;
  viewportContent?: string;
  isResponsive: boolean;
  tapTargetIssues: number;
  fontSizeIssues: number;
}

export function analyzeMobile(html: string, url: string): { issues: AuditIssue[]; data: MobileData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Check viewport meta tag
  const viewportMeta = $('meta[name="viewport"]');
  const hasViewport = viewportMeta.length > 0;
  const viewportContent = viewportMeta.attr('content');

  if (!hasViewport) {
    issues.push({
      ...ISSUE_DEFINITIONS.VIEWPORT_MISSING,
      affectedUrls: [url],
    });
  } else if (viewportContent) {
    // Check if viewport is responsive
    const isResponsive = viewportContent.includes('width=device-width');

    if (!isResponsive) {
      // Check for fixed width
      const widthMatch = viewportContent.match(/width=(\d+)/);
      if (widthMatch) {
        issues.push({
          ...ISSUE_DEFINITIONS.VIEWPORT_NOT_RESPONSIVE,
          affectedUrls: [url],
          details: {
            viewport: viewportContent,
            fixedWidth: widthMatch[1],
          },
        });
      }
    }

    // Check for user-scalable=no (bad for accessibility)
    if (viewportContent.includes('user-scalable=no') || viewportContent.includes('user-scalable=0')) {
      issues.push({
        code: 'VIEWPORT_NO_ZOOM',
        severity: 'warning',
        category: 'mobile',
        title: 'Viewport prevents zooming',
        description: 'The viewport meta tag disables user scaling.',
        impact: 'Users with visual impairments cannot zoom the page.',
        howToFix: 'Remove user-scalable=no from the viewport meta tag.',
        affectedUrls: [url],
      });
    }
  }

  // Check for tap target issues (basic heuristic)
  // In a real implementation, this would analyze CSS computed styles
  let tapTargetIssues = 0;
  $('a, button, input, select, textarea').each((_, el) => {
    const style = $(el).attr('style') || '';
    // Basic check for very small explicit sizes
    const heightMatch = style.match(/height:\s*(\d+)px/);
    const widthMatch = style.match(/width:\s*(\d+)px/);

    if (heightMatch && parseInt(heightMatch[1], 10) < 44) {
      tapTargetIssues++;
    }
    if (widthMatch && parseInt(widthMatch[1], 10) < 44) {
      tapTargetIssues++;
    }
  });

  if (tapTargetIssues > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.TAP_TARGETS_TOO_SMALL,
      affectedUrls: [url],
      details: { count: tapTargetIssues },
    });
  }

  // Check for font size issues (basic heuristic)
  let fontSizeIssues = 0;
  $('body *').each((_, el) => {
    const style = $(el).attr('style') || '';
    const fontSizeMatch = style.match(/font-size:\s*(\d+)px/);
    if (fontSizeMatch && parseInt(fontSizeMatch[1], 10) < 12) {
      fontSizeIssues++;
    }
  });

  return {
    issues,
    data: {
      hasViewport,
      viewportContent,
      isResponsive: hasViewport && (viewportContent?.includes('width=device-width') || false),
      tapTargetIssues,
      fontSizeIssues,
    }
  };
}

// Additional mobile-specific checks
export function checkMobileResources(html: string, url: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Check for Flash content (obsolete)
  if ($('object[type*="flash"], embed[type*="flash"]').length > 0) {
    issues.push({
      code: 'FLASH_CONTENT',
      severity: 'error',
      category: 'mobile',
      title: 'Flash content detected',
      description: 'Page contains Flash content which is not supported on mobile devices.',
      impact: 'Content is inaccessible on mobile devices and most modern browsers.',
      howToFix: 'Replace Flash content with HTML5 alternatives.',
      affectedUrls: [url],
    });
  }

  // Check for plugins
  if ($('object, embed, applet').length > 0) {
    issues.push({
      code: 'PLUGINS_DETECTED',
      severity: 'notice',
      category: 'mobile',
      title: 'Plugins detected',
      description: 'Page uses plugins which may not work on mobile devices.',
      impact: 'Some content may not be accessible on mobile.',
      howToFix: 'Consider replacing plugins with standard web technologies.',
      affectedUrls: [url],
    });
  }

  // Check for horizontal scroll (indication of non-responsive design)
  // This is a heuristic based on fixed-width elements
  let fixedWidthElements = 0;
  $('*').each((_, el) => {
    const style = $(el).attr('style') || '';
    const widthMatch = style.match(/width:\s*(\d+)px/);
    if (widthMatch && parseInt(widthMatch[1], 10) > 320) {
      fixedWidthElements++;
    }
  });

  if (fixedWidthElements > 5) {
    issues.push({
      code: 'POSSIBLE_HORIZONTAL_SCROLL',
      severity: 'notice',
      category: 'mobile',
      title: 'Possible horizontal scrolling',
      description: 'Multiple elements have fixed widths that may cause horizontal scrolling on mobile.',
      impact: 'Poor mobile user experience.',
      howToFix: 'Use responsive widths (percentages, max-width) instead of fixed pixel widths.',
      affectedUrls: [url],
      details: { count: fixedWidthElements },
    });
  }

  return issues;
}
