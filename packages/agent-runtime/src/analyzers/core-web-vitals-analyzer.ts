/**
 * Core Web Vitals Analyzer
 * 
 * Estimates Core Web Vitals from HTML analysis without actual page load.
 * Identifies common issues that impact LCP, FID, CLS, INP, and TTFB.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../audit/types.js';

export interface CoreWebVitalsEstimate {
  lcp: {
    estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    issues: string[];
    recommendations: string[];
  };
  fid: {
    estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    issues: string[];
    recommendations: string[];
  };
  cls: {
    estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    issues: string[];
    recommendations: string[];
  };
  inp: {
    estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    issues: string[];
    recommendations: string[];
  };
  ttfb: {
    estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
    issues: string[];
    recommendations: string[];
  };
  overallScore: number;
  issues: AuditIssue[];
}

/**
 * Analyze HTML for LCP (Largest Contentful Paint) issues
 */
function analyzeLCP(html: string, $: cheerio.CheerioAPI): {
  estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Check for hero images without optimization
  const heroImages = $('img').filter((_, el) => {
    const parent = $(el).parent();
    const isHero = parent.is('header, .hero, [class*="hero"], [class*="banner"], section:first-of-type');
    const isLarge = (parseInt($(el).attr('width') || '0') > 400) || 
                    ($(el).attr('class')?.includes('full') ?? false);
    return isHero || isLarge;
  });
  
  heroImages.each((_, img) => {
    const $img = $(img);
    const src = $img.attr('src') || '';
    
    // Check loading attribute
    if ($img.attr('loading') === 'lazy') {
      issues.push('Hero/LCP image has loading="lazy" - delays rendering');
      score -= 20;
    }
    
    // Check for preload
    const preloads = $('link[rel="preload"][as="image"]');
    const isPreloaded = preloads.toArray().some(p => 
      $(p).attr('href')?.includes(src.split('/').pop() || '')
    );
    if (!isPreloaded && src) {
      issues.push('Hero image not preloaded');
      recommendations.push(`Add: <link rel="preload" as="image" href="${src}">`);
      score -= 15;
    }
    
    // Check for width/height attributes (prevents layout shift)
    if (!$img.attr('width') || !$img.attr('height')) {
      issues.push('Hero image missing width/height attributes');
      score -= 10;
    }
    
    // Check for modern formats
    const format = src.split('.').pop()?.toLowerCase();
    if (format && !['webp', 'avif'].includes(format)) {
      recommendations.push('Consider using WebP or AVIF format for hero image');
      score -= 5;
    }
  });
  
  // Check for render-blocking resources
  const blockingCSS = $('link[rel="stylesheet"]').filter((_, el) => {
    const media = $(el).attr('media');
    return !media || media === 'all' || media === 'screen';
  });
  
  if (blockingCSS.length > 3) {
    issues.push(`${blockingCSS.length} render-blocking stylesheets`);
    recommendations.push('Inline critical CSS and defer non-critical stylesheets');
    score -= 15;
  }
  
  // Check for blocking scripts in head
  const blockingScripts = $('head script:not([async]):not([defer]):not([type="module"])').filter((_, el) => {
    return $(el).attr('src') !== undefined;
  });
  
  if (blockingScripts.length > 0) {
    issues.push(`${blockingScripts.length} render-blocking scripts in <head>`);
    recommendations.push('Add async or defer attribute to scripts');
    score -= 20;
  }
  
  // Check for web fonts
  const fontLinks = $('link[rel="preload"][as="font"], link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]');
  const fontPreconnects = $('link[rel="preconnect"][href*="fonts"]');
  
  if (fontLinks.length > 0 && fontPreconnects.length === 0) {
    issues.push('Web fonts without preconnect');
    recommendations.push('Add <link rel="preconnect" href="https://fonts.googleapis.com">');
    score -= 10;
  }
  
  // Check for large inline styles
  const inlineStyles = $('style').text();
  if (inlineStyles.length > 50000) {
    issues.push('Very large inline CSS (>50KB)');
    score -= 10;
  }
  
  let estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown' = 'unknown';
  if (score >= 80) estimate = 'good';
  else if (score >= 50) estimate = 'needs-improvement';
  else estimate = 'poor';
  
  return { estimate, issues, recommendations };
}

/**
 * Analyze HTML for FID (First Input Delay) / INP issues
 */
function analyzeFID_INP(html: string, $: cheerio.CheerioAPI): {
  fidEstimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  inpEstimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Count total JavaScript size (approximate from script tags)
  let totalJSIndicators = 0;
  
  // Check for large JS bundles
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('bundle') || src.includes('vendor') || src.includes('chunk')) {
      totalJSIndicators++;
    }
  });
  
  if (totalJSIndicators > 5) {
    issues.push('Many JavaScript bundle files detected');
    recommendations.push('Consider code splitting and lazy loading');
    score -= 15;
  }
  
  // Check for heavy frameworks
  const hasHeavyFramework = html.includes('angular') || 
                            html.includes('__NUXT__') ||
                            (html.includes('react') && !html.includes('preact'));
  
  // Check for inline scripts (potential long tasks)
  const inlineScriptContent = $('script:not([src])').text();
  if (inlineScriptContent.length > 10000) {
    issues.push('Large inline JavaScript (>10KB)');
    recommendations.push('Move large scripts to external files with async/defer');
    score -= 15;
  }
  
  // Check for event handlers in HTML
  const inlineHandlers = $('[onclick], [onchange], [onsubmit], [onload], [onerror]');
  if (inlineHandlers.length > 10) {
    issues.push(`${inlineHandlers.length} inline event handlers`);
    recommendations.push('Use addEventListener instead of inline handlers');
    score -= 10;
  }
  
  // Check for third-party scripts
  const thirdPartyScripts = $('script[src]').filter((_, el) => {
    const src = $(el).attr('src') || '';
    return src.includes('//') && !src.includes('localhost');
  });
  
  const heavyThirdParties = ['analytics', 'facebook', 'twitter', 'linkedin', 'hotjar', 'intercom', 'drift', 'hubspot'];
  let heavyScriptCount = 0;
  
  thirdPartyScripts.each((_, el) => {
    const src = $(el).attr('src') || '';
    if (heavyThirdParties.some(tp => src.toLowerCase().includes(tp))) {
      heavyScriptCount++;
    }
  });
  
  if (heavyScriptCount > 3) {
    issues.push(`${heavyScriptCount} heavy third-party scripts`);
    recommendations.push('Lazy load third-party scripts after page interaction');
    score -= 20;
  }
  
  // Check for synchronous XHR patterns
  if (html.includes('XMLHttpRequest') && !html.includes('async')) {
    issues.push('Potential synchronous XHR detected');
    score -= 10;
  }
  
  let estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown' = 'unknown';
  if (score >= 80) estimate = 'good';
  else if (score >= 50) estimate = 'needs-improvement';
  else estimate = 'poor';
  
  return { 
    fidEstimate: estimate, 
    inpEstimate: estimate, // Similar factors affect both
    issues, 
    recommendations 
  };
}

/**
 * Analyze HTML for CLS (Cumulative Layout Shift) issues
 */
function analyzeCLS(html: string, $: cheerio.CheerioAPI): {
  estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Check images without dimensions
  const imagesWithoutDimensions = $('img').filter((_, el) => {
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    const style = $(el).attr('style') || '';
    const hasStyleDimensions = style.includes('width') && style.includes('height');
    return !width || !height || (!hasStyleDimensions && width === 'auto');
  });
  
  if (imagesWithoutDimensions.length > 0) {
    issues.push(`${imagesWithoutDimensions.length} images without width/height`);
    recommendations.push('Add explicit width and height attributes to all images');
    score -= Math.min(imagesWithoutDimensions.length * 5, 25);
  }
  
  // Check videos/iframes without dimensions
  const mediaWithoutDimensions = $('video, iframe').filter((_, el) => {
    const width = $(el).attr('width');
    const height = $(el).attr('height');
    return !width || !height;
  });
  
  if (mediaWithoutDimensions.length > 0) {
    issues.push(`${mediaWithoutDimensions.length} videos/iframes without dimensions`);
    recommendations.push('Add explicit width and height to all video and iframe elements');
    score -= Math.min(mediaWithoutDimensions.length * 10, 20);
  }
  
  // Check for ads (common CLS culprit)
  const adContainers = $('[class*="ad-"], [class*="ads-"], [id*="ad-"], [data-ad], ins.adsbygoogle');
  if (adContainers.length > 0) {
    const hasReservedSpace = adContainers.filter((_, el) => {
      const style = $(el).attr('style') || '';
      return style.includes('min-height') || style.includes('height');
    });
    
    if (hasReservedSpace.length < adContainers.length) {
      issues.push('Ad containers without reserved space');
      recommendations.push('Reserve space for ads with min-height CSS');
      score -= 20;
    }
  }
  
  // Check for dynamic content insertion points
  const dynamicContainers = $('[data-loading], [class*="skeleton"], [class*="placeholder"]');
  if (dynamicContainers.length > 0) {
    // This is actually good - they're using skeletons
    score += 5;
  }
  
  // Check for web fonts with potential FOUT
  const webFonts = $('link[href*="fonts"], style').filter((_, el) => {
    const content = $(el).attr('href') || $(el).text();
    return content.includes('font-face') || content.includes('fonts.googleapis');
  });
  
  if (webFonts.length > 0) {
    const hasFontDisplay = html.includes('font-display');
    if (!hasFontDisplay) {
      issues.push('Web fonts without font-display property');
      recommendations.push('Add font-display: swap or optional to prevent FOUT');
      score -= 10;
    }
  }
  
  // Check for fixed headers/footers that might cause shifts
  const stickyElements = $('[class*="sticky"], [class*="fixed"], [style*="position: fixed"], [style*="position: sticky"]');
  // This is informational - sticky headers are common and acceptable
  
  // Check for aspect ratio containers
  const aspectRatioContainers = $('[style*="aspect-ratio"], [class*="aspect-"]');
  if (aspectRatioContainers.length > 0) {
    score += 5; // Good practice
  }
  
  let estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown' = 'unknown';
  if (score >= 80) estimate = 'good';
  else if (score >= 50) estimate = 'needs-improvement';
  else estimate = 'poor';
  
  return { estimate, issues, recommendations };
}

/**
 * Analyze for TTFB (Time to First Byte) indicators
 */
function analyzeTTFB($: cheerio.CheerioAPI, headers?: Record<string, string>): {
  estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Check for caching headers (if provided)
  if (headers) {
    const cacheControl = headers['cache-control'];
    if (!cacheControl) {
      issues.push('No Cache-Control header');
      recommendations.push('Add Cache-Control header for static assets');
      score -= 10;
    }
    
    const hasCompression = headers['content-encoding']?.includes('gzip') || 
                          headers['content-encoding']?.includes('br');
    if (!hasCompression) {
      issues.push('Response not compressed (no gzip/brotli)');
      recommendations.push('Enable Brotli or Gzip compression');
      score -= 15;
    }
  }
  
  // Check for hints that suggest server-side processing
  const hasDynamicIndicators = $('[data-server-rendered], [data-user-id], [data-session]').length > 0;
  if (hasDynamicIndicators) {
    recommendations.push('Consider edge caching or CDN for dynamic pages');
  }
  
  // Check for preconnect/dns-prefetch hints
  const preconnects = $('link[rel="preconnect"], link[rel="dns-prefetch"]');
  if (preconnects.length === 0) {
    issues.push('No preconnect hints for external origins');
    recommendations.push('Add preconnect for critical external origins (fonts, CDN, API)');
    score -= 10;
  }
  
  // Check for early hints / resource hints
  const resourceHints = $('link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"]');
  if (resourceHints.length === 0) {
    recommendations.push('Consider adding preload hints for critical resources');
    score -= 5;
  }
  
  let estimate: 'good' | 'needs-improvement' | 'poor' | 'unknown' = 'unknown';
  if (score >= 80) estimate = 'good';
  else if (score >= 50) estimate = 'needs-improvement';
  else estimate = 'poor';
  
  return { estimate, issues, recommendations };
}

/**
 * Generate audit issues from Core Web Vitals analysis
 */
function generateCWVIssues(
  lcp: ReturnType<typeof analyzeLCP>,
  fidInp: ReturnType<typeof analyzeFID_INP>,
  cls: ReturnType<typeof analyzeCLS>,
  ttfb: ReturnType<typeof analyzeTTFB>,
  url: string
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // LCP Issues
  if (lcp.estimate === 'poor') {
    issues.push({
      code: 'CWV_LCP_POOR',
      severity: 'critical',
      category: 'performance',
      title: 'Largest Contentful Paint likely poor',
      description: `LCP issues detected: ${lcp.issues.join('; ')}`,
      impact: 'Poor LCP hurts rankings and user experience. Google uses LCP as a ranking factor.',
      howToFix: lcp.recommendations.join('\n'),
      affectedUrls: [url],
    });
  } else if (lcp.estimate === 'needs-improvement' && lcp.issues.length > 0) {
    issues.push({
      code: 'CWV_LCP_NEEDS_IMPROVEMENT',
      severity: 'warning',
      category: 'performance',
      title: 'Largest Contentful Paint needs improvement',
      description: `LCP issues: ${lcp.issues.join('; ')}`,
      impact: 'LCP affects Core Web Vitals score and rankings',
      howToFix: lcp.recommendations.join('\n'),
      affectedUrls: [url],
    });
  }
  
  // FID/INP Issues
  if (fidInp.fidEstimate === 'poor') {
    issues.push({
      code: 'CWV_INP_POOR',
      severity: 'critical',
      category: 'performance',
      title: 'Interaction to Next Paint likely poor',
      description: `INP/FID issues detected: ${fidInp.issues.join('; ')}`,
      impact: 'Poor interactivity hurts user experience and rankings',
      howToFix: fidInp.recommendations.join('\n'),
      affectedUrls: [url],
    });
  } else if (fidInp.fidEstimate === 'needs-improvement' && fidInp.issues.length > 0) {
    issues.push({
      code: 'CWV_INP_NEEDS_IMPROVEMENT',
      severity: 'warning',
      category: 'performance',
      title: 'Interaction responsiveness needs improvement',
      description: `INP issues: ${fidInp.issues.join('; ')}`,
      impact: 'Affects user experience and Core Web Vitals',
      howToFix: fidInp.recommendations.join('\n'),
      affectedUrls: [url],
    });
  }
  
  // CLS Issues
  if (cls.estimate === 'poor') {
    issues.push({
      code: 'CWV_CLS_POOR',
      severity: 'critical',
      category: 'performance',
      title: 'Cumulative Layout Shift likely poor',
      description: `CLS issues detected: ${cls.issues.join('; ')}`,
      impact: 'Visual instability frustrates users and hurts rankings',
      howToFix: cls.recommendations.join('\n'),
      affectedUrls: [url],
    });
  } else if (cls.estimate === 'needs-improvement' && cls.issues.length > 0) {
    issues.push({
      code: 'CWV_CLS_NEEDS_IMPROVEMENT',
      severity: 'warning',
      category: 'performance',
      title: 'Layout stability needs improvement',
      description: `CLS issues: ${cls.issues.join('; ')}`,
      impact: 'Layout shifts degrade user experience',
      howToFix: cls.recommendations.join('\n'),
      affectedUrls: [url],
    });
  }
  
  // TTFB Issues
  if (ttfb.issues.length > 0) {
    issues.push({
      code: 'CWV_TTFB_ISSUES',
      severity: 'info',
      category: 'performance',
      title: 'Server response optimizations available',
      description: `TTFB issues: ${ttfb.issues.join('; ')}`,
      impact: 'Slow server response delays all other metrics',
      howToFix: ttfb.recommendations.join('\n'),
      affectedUrls: [url],
    });
  }
  
  return issues;
}

/**
 * Main Core Web Vitals analysis function
 */
export function analyzeCoreWebVitals(
  html: string,
  url: string,
  headers?: Record<string, string>
): CoreWebVitalsEstimate {
  const $ = cheerio.load(html);
  
  const lcp = analyzeLCP(html, $);
  const fidInp = analyzeFID_INP(html, $);
  const cls = analyzeCLS(html, $);
  const ttfb = analyzeTTFB($, headers);
  
  const issues = generateCWVIssues(lcp, fidInp, cls, ttfb, url);
  
  // Calculate overall score
  const scores = {
    lcp: lcp.estimate === 'good' ? 100 : lcp.estimate === 'needs-improvement' ? 60 : 30,
    fid: fidInp.fidEstimate === 'good' ? 100 : fidInp.fidEstimate === 'needs-improvement' ? 60 : 30,
    cls: cls.estimate === 'good' ? 100 : cls.estimate === 'needs-improvement' ? 60 : 30,
    ttfb: ttfb.estimate === 'good' ? 100 : ttfb.estimate === 'needs-improvement' ? 60 : 30,
  };
  
  // Weighted average (LCP and CLS are most impactful)
  const overallScore = Math.round(
    (scores.lcp * 0.30) +
    (scores.fid * 0.20) +
    (scores.cls * 0.30) +
    (scores.ttfb * 0.20)
  );
  
  return {
    lcp: {
      estimate: lcp.estimate,
      issues: lcp.issues,
      recommendations: lcp.recommendations,
    },
    fid: {
      estimate: fidInp.fidEstimate,
      issues: fidInp.issues,
      recommendations: fidInp.recommendations,
    },
    cls: {
      estimate: cls.estimate,
      issues: cls.issues,
      recommendations: cls.recommendations,
    },
    inp: {
      estimate: fidInp.inpEstimate,
      issues: fidInp.issues,
      recommendations: fidInp.recommendations,
    },
    ttfb: {
      estimate: ttfb.estimate,
      issues: ttfb.issues,
      recommendations: ttfb.recommendations,
    },
    overallScore,
    issues,
  };
}
