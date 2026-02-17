/**
 * Mobile SEO Analyzer
 * 
 * Analyzes mobile-friendliness and mobile SEO best practices.
 * Critical for Google's mobile-first indexing.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../audit/types.js';

export interface MobileSEOResult {
  score: number;
  viewport: ViewportAnalysis;
  touchTargets: TouchTargetAnalysis;
  fontSizes: FontSizeAnalysis;
  contentWidth: ContentWidthAnalysis;
  mobileSpecific: MobileSpecificAnalysis;
  issues: AuditIssue[];
  recommendations: string[];
}

export interface ViewportAnalysis {
  hasViewport: boolean;
  isResponsive: boolean;
  viewportContent?: string;
  issues: string[];
}

export interface TouchTargetAnalysis {
  smallTargets: number;
  properTargets: number;
  issues: string[];
}

export interface FontSizeAnalysis {
  hasResponsiveFonts: boolean;
  smallFontIndicators: number;
  issues: string[];
}

export interface ContentWidthAnalysis {
  hasHorizontalScroll: boolean;
  fixedWidthElements: number;
  issues: string[];
}

export interface MobileSpecificAnalysis {
  hasAppleTouchIcon: boolean;
  hasThemeColor: boolean;
  hasManifest: boolean;
  hasMobileOptimizedImages: boolean;
  avoidsMobilePopups: boolean;
  issues: string[];
}

/**
 * Analyze viewport meta tag
 */
function analyzeViewport($: cheerio.CheerioAPI): ViewportAnalysis {
  const viewport = $('meta[name="viewport"]');
  const issues: string[] = [];
  
  if (viewport.length === 0) {
    return {
      hasViewport: false,
      isResponsive: false,
      issues: ['No viewport meta tag'],
    };
  }
  
  const content = viewport.attr('content') || '';
  
  // Check for responsive viewport
  const hasWidth = content.includes('width=');
  const hasDeviceWidth = content.includes('width=device-width');
  const hasInitialScale = content.includes('initial-scale=');
  const hasMaximumScale = content.includes('maximum-scale=1');
  const hasUserScalable = content.includes('user-scalable=no') || content.includes('user-scalable=0');
  
  let isResponsive = hasDeviceWidth;
  
  if (!hasDeviceWidth) {
    if (content.includes('width=') && !content.includes('width=device-width')) {
      issues.push('Fixed viewport width instead of device-width');
      isResponsive = false;
    }
  }
  
  if (hasUserScalable || hasMaximumScale) {
    issues.push('Viewport disables zooming - accessibility issue');
  }
  
  if (!hasInitialScale) {
    issues.push('Missing initial-scale=1');
  }
  
  return {
    hasViewport: true,
    isResponsive,
    viewportContent: content,
    issues,
  };
}

/**
 * Analyze touch targets
 */
function analyzeTouchTargets($: cheerio.CheerioAPI): TouchTargetAnalysis {
  const issues: string[] = [];
  let smallTargets = 0;
  let properTargets = 0;
  
  // Check interactive elements
  const interactiveElements = $('a, button, input, select, textarea, [role="button"], [onclick]');
  
  interactiveElements.each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    const className = $el.attr('class') || '';
    
    // Look for small sizing indicators
    const hasSmallClass = /\b(xs|tiny|small|mini)\b/i.test(className);
    const hasSmallInlineStyle = /(?:width|height)\s*:\s*(?:\d{1,2}(?:px|rem|em)|1\d{2}px)/i.test(style);
    
    // Check for proper padding (indicates larger touch target)
    const hasPadding = /padding/i.test(style) || /\bp-\d|\bpy-\d|\bpx-\d/i.test(className);
    
    if (hasSmallClass || hasSmallInlineStyle) {
      smallTargets++;
    } else if (hasPadding) {
      properTargets++;
    } else {
      // Default assumption: could be either
      properTargets++;
    }
  });
  
  if (smallTargets > 5) {
    issues.push(`${smallTargets} potentially small touch targets`);
  }
  
  return {
    smallTargets,
    properTargets,
    issues,
  };
}

/**
 * Analyze font sizes
 */
function analyzeFontSizes($: cheerio.CheerioAPI, html: string): FontSizeAnalysis {
  const issues: string[] = [];
  let smallFontIndicators = 0;
  
  // Check for responsive font indicators
  const hasResponsiveFonts = 
    html.includes('@media') && html.includes('font-size') ||
    html.includes('clamp(') ||
    html.includes('vw') ||
    /text-(?:xs|sm|base|lg|xl)/i.test(html); // Tailwind
  
  // Look for small fixed font sizes in inline styles
  $('[style*="font-size"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/font-size\s*:\s*(\d+)(px|pt)?/i);
    if (match) {
      const size = parseInt(match[1]);
      const unit = match[2]?.toLowerCase() || 'px';
      
      // Check for too-small fonts
      if ((unit === 'px' && size < 12) || (unit === 'pt' && size < 9)) {
        smallFontIndicators++;
      }
    }
  });
  
  // Check CSS for small font declarations
  const smallFontPatterns = /font-size\s*:\s*(?:[0-9]|1[01])px/gi;
  const matches = html.match(smallFontPatterns);
  if (matches) {
    smallFontIndicators += matches.length;
  }
  
  if (smallFontIndicators > 3) {
    issues.push(`${smallFontIndicators} instances of small font sizes (<12px)`);
  }
  
  return {
    hasResponsiveFonts,
    smallFontIndicators,
    issues,
  };
}

/**
 * Analyze content width
 */
function analyzeContentWidth($: cheerio.CheerioAPI, html: string): ContentWidthAnalysis {
  const issues: string[] = [];
  let fixedWidthElements = 0;
  
  // Check for horizontal scroll indicators
  const hasOverflowHidden = html.includes('overflow-x: hidden') || html.includes('overflow-x:hidden');
  
  // Look for fixed width elements
  $('[style*="width"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const widthMatch = style.match(/width\s*:\s*(\d+)(px)?/i);
    
    if (widthMatch) {
      const width = parseInt(widthMatch[1]);
      // Fixed width > 500px could cause issues on mobile
      if (width > 500 && !style.includes('max-width')) {
        fixedWidthElements++;
      }
    }
  });
  
  // Check for tables without responsive wrapper
  const tables = $('table');
  const responsiveTables = $('table').filter((_, el) => {
    const parent = $(el).parent();
    const parentClass = parent.attr('class') || '';
    const parentStyle = parent.attr('style') || '';
    return parentClass.includes('overflow') || 
           parentStyle.includes('overflow') ||
           parentClass.includes('responsive');
  });
  
  if (tables.length > responsiveTables.length) {
    issues.push(`${tables.length - responsiveTables.length} tables without responsive wrapper`);
    fixedWidthElements += tables.length - responsiveTables.length;
  }
  
  // Check for iframes without responsive handling
  const iframes = $('iframe:not([style*="max-width"])');
  if (iframes.length > 0) {
    issues.push(`${iframes.length} iframes may cause horizontal scroll`);
    fixedWidthElements += iframes.length;
  }
  
  return {
    hasHorizontalScroll: !hasOverflowHidden && fixedWidthElements > 0,
    fixedWidthElements,
    issues,
  };
}

/**
 * Analyze mobile-specific optimizations
 */
function analyzeMobileSpecific($: cheerio.CheerioAPI): MobileSpecificAnalysis {
  const issues: string[] = [];
  
  // Apple touch icon
  const hasAppleTouchIcon = $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').length > 0;
  if (!hasAppleTouchIcon) {
    issues.push('Missing apple-touch-icon');
  }
  
  // Theme color
  const hasThemeColor = $('meta[name="theme-color"]').length > 0;
  if (!hasThemeColor) {
    issues.push('Missing theme-color meta tag');
  }
  
  // Web app manifest
  const hasManifest = $('link[rel="manifest"]').length > 0;
  if (!hasManifest) {
    issues.push('Missing web app manifest');
  }
  
  // Check for mobile-optimized images (srcset, picture)
  const responsiveImages = $('img[srcset], picture source[srcset]').length;
  const totalImages = $('img').length;
  const hasMobileOptimizedImages = responsiveImages > 0 || totalImages === 0;
  
  if (totalImages > 0 && responsiveImages === 0) {
    issues.push('No responsive images (srcset)');
  }
  
  // Check for intrusive interstitials (popups)
  const popupIndicators = $('[class*="popup"], [class*="modal"], [class*="overlay"], [id*="popup"], [id*="modal"]');
  const hasPopupTriggers = $('[data-popup], [data-modal], .popup-trigger, .modal-trigger').length > 0;
  
  // Having modals is okay, auto-showing them on mobile is the issue
  const avoidsMobilePopups = popupIndicators.filter((_, el) => {
    const style = $(el).attr('style') || '';
    return style.includes('display: block') || style.includes('display:block');
  }).length === 0;
  
  return {
    hasAppleTouchIcon,
    hasThemeColor,
    hasManifest,
    hasMobileOptimizedImages,
    avoidsMobilePopups,
    issues,
  };
}

/**
 * Main mobile SEO analysis
 */
export function analyzeMobileSEO(html: string, url: string): MobileSEOResult {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Run all analyses
  const viewport = analyzeViewport($);
  const touchTargets = analyzeTouchTargets($);
  const fontSizes = analyzeFontSizes($, html);
  const contentWidth = analyzeContentWidth($, html);
  const mobileSpecific = analyzeMobileSpecific($);
  
  // Generate issues
  if (!viewport.hasViewport) {
    issues.push({
      code: 'MOBILE_NO_VIEWPORT',
      severity: 'critical',
      category: 'technical',
      title: 'Missing viewport meta tag',
      description: 'The page lacks a viewport meta tag, critical for mobile rendering.',
      impact: 'Page will not render properly on mobile devices',
      howToFix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
      affectedUrls: [url],
    });
    score -= 30;
  } else if (!viewport.isResponsive) {
    issues.push({
      code: 'MOBILE_FIXED_VIEWPORT',
      severity: 'warning',
      category: 'technical',
      title: 'Non-responsive viewport',
      description: viewport.issues.join('. '),
      impact: 'Page may not scale properly on all devices',
      howToFix: 'Use width=device-width instead of fixed width',
      affectedUrls: [url],
    });
    score -= 15;
  }
  
  if (viewport.issues.includes('Viewport disables zooming - accessibility issue')) {
    issues.push({
      code: 'MOBILE_ZOOM_DISABLED',
      severity: 'warning',
      category: 'technical',
      title: 'Pinch-to-zoom disabled',
      description: 'The viewport prevents users from zooming, which is an accessibility violation.',
      impact: 'Fails WCAG accessibility guidelines',
      howToFix: 'Remove maximum-scale=1 and user-scalable=no from viewport',
      affectedUrls: [url],
    });
    score -= 10;
  }
  
  if (touchTargets.smallTargets > 5) {
    issues.push({
      code: 'MOBILE_SMALL_TOUCH_TARGETS',
      severity: 'warning',
      category: 'technical',
      title: `${touchTargets.smallTargets} small touch targets`,
      description: 'Interactive elements may be too small to tap easily on mobile.',
      impact: 'Poor mobile usability, user frustration',
      howToFix: 'Ensure touch targets are at least 48x48px with adequate spacing',
      affectedUrls: [url],
    });
    score -= Math.min(touchTargets.smallTargets * 2, 15);
  }
  
  if (fontSizes.smallFontIndicators > 3) {
    issues.push({
      code: 'MOBILE_SMALL_FONTS',
      severity: 'warning',
      category: 'technical',
      title: 'Small font sizes detected',
      description: `${fontSizes.smallFontIndicators} instances of fonts smaller than 12px.`,
      impact: 'Text difficult to read on mobile without zooming',
      howToFix: 'Use minimum 16px for body text, 12px absolute minimum',
      affectedUrls: [url],
    });
    score -= 10;
  }
  
  if (contentWidth.fixedWidthElements > 2) {
    issues.push({
      code: 'MOBILE_HORIZONTAL_SCROLL',
      severity: 'warning',
      category: 'technical',
      title: 'Content wider than screen',
      description: `${contentWidth.fixedWidthElements} elements may cause horizontal scrolling.`,
      impact: 'Horizontal scrolling is frustrating on mobile',
      howToFix: 'Use max-width: 100% and avoid fixed widths >320px',
      affectedUrls: [url],
    });
    score -= Math.min(contentWidth.fixedWidthElements * 3, 15);
  }
  
  // Mobile-specific issues
  if (!mobileSpecific.hasManifest) {
    issues.push({
      code: 'MOBILE_NO_MANIFEST',
      severity: 'info',
      category: 'technical',
      title: 'Missing web app manifest',
      description: 'No manifest.json linked for PWA capabilities.',
      impact: 'Cannot be installed as PWA',
      howToFix: 'Add <link rel="manifest" href="/manifest.json">',
      affectedUrls: [url],
    });
    score -= 5;
  }
  
  if (!mobileSpecific.hasThemeColor) {
    recommendations.push('Add theme-color meta tag for mobile browser UI customization');
    score -= 2;
  }
  
  if (!mobileSpecific.hasAppleTouchIcon) {
    recommendations.push('Add apple-touch-icon for iOS home screen');
    score -= 2;
  }
  
  if (!mobileSpecific.hasMobileOptimizedImages) {
    recommendations.push('Use srcset for responsive images');
    score -= 5;
  }
  
  // Positive recommendations
  if (viewport.hasViewport && viewport.isResponsive && viewport.issues.length === 0) {
    recommendations.push('✓ Proper responsive viewport configuration');
  }
  
  if (fontSizes.hasResponsiveFonts) {
    recommendations.push('✓ Responsive font sizing detected');
  }
  
  if (mobileSpecific.hasManifest && mobileSpecific.hasAppleTouchIcon && mobileSpecific.hasThemeColor) {
    recommendations.push('✓ Good PWA/mobile app configuration');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    viewport,
    touchTargets,
    fontSizes,
    contentWidth,
    mobileSpecific,
    issues,
    recommendations,
  };
}
