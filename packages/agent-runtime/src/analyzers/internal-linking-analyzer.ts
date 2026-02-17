/**
 * Internal Linking Analyzer
 * 
 * Analyzes internal link structure for SEO optimization.
 * Checks link distribution, anchor text, orphan pages, and link depth.
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../audit/types.js';

export interface InternalLinkingResult {
  score: number;
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  navigationLinks: number;
  contentLinks: number;
  uniqueInternalTargets: number;
  linksWithKeywords: number;
  linksWithGenericText: number;
  orphanRisk: boolean;
  linkDetails: LinkInfo[];
  anchorTextAnalysis: AnchorTextStats;
  issues: AuditIssue[];
  recommendations: string[];
}

export interface LinkInfo {
  href: string;
  text: string;
  isInternal: boolean;
  isNavigation: boolean;
  rel?: string;
  title?: string;
  issues: string[];
}

export interface AnchorTextStats {
  total: number;
  descriptive: number;
  generic: number;
  empty: number;
  tooLong: number;
  imageLinks: number;
  patterns: { text: string; count: number }[];
}

const GENERIC_ANCHOR_TEXTS = [
  'click here',
  'read more',
  'learn more',
  'here',
  'link',
  'this',
  'more',
  'continue',
  'see more',
  'view more',
  'details',
  'go',
  'continue reading',
  '>>',
  '→',
  'next',
  'previous',
];

/**
 * Check if URL is internal
 */
function isInternalUrl(href: string, baseUrl: string): boolean {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  
  if (href.startsWith('/') && !href.startsWith('//')) {
    return true;
  }
  
  try {
    const base = new URL(baseUrl);
    const link = new URL(href, baseUrl);
    return link.hostname === base.hostname;
  } catch {
    return false;
  }
}

/**
 * Check if link is in navigation
 */
function isNavigationLink($el: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): boolean {
  const parent = $el.parents('nav, header, footer, [role="navigation"], .nav, .navigation, .menu, .sidebar').first();
  return parent.length > 0;
}

/**
 * Analyze anchor text quality
 */
function analyzeAnchorText(text: string): { isGeneric: boolean; isTooLong: boolean; isEmpty: boolean } {
  const normalized = text.toLowerCase().trim();
  
  return {
    isEmpty: normalized.length === 0,
    isGeneric: GENERIC_ANCHOR_TEXTS.some(g => normalized === g || normalized.includes(g)),
    isTooLong: normalized.length > 100,
  };
}

/**
 * Analyze internal linking structure
 */
export function analyzeInternalLinking(html: string, url: string): InternalLinkingResult {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  const linkDetails: LinkInfo[] = [];
  const anchorTextCounts: Record<string, number> = {};
  
  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  let navigationLinks = 0;
  let contentLinks = 0;
  let linksWithGenericText = 0;
  let linksWithKeywords = 0;
  let emptyAnchorLinks = 0;
  let tooLongAnchorLinks = 0;
  let imageLinks = 0;
  
  const internalTargets = new Set<string>();
  
  $('a[href]').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href') || '';
    const text = $link.text().trim();
    const rel = $link.attr('rel');
    const title = $link.attr('title');
    const hasImage = $link.find('img').length > 0;
    
    // Skip non-HTTP links
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return;
    }
    
    totalLinks++;
    const linkIssues: string[] = [];
    const isInternal = isInternalUrl(href, url);
    const isNav = isNavigationLink($link, $);
    
    if (isInternal) {
      internalLinks++;
      
      // Track unique targets
      try {
        const targetUrl = new URL(href, url).pathname;
        internalTargets.add(targetUrl);
      } catch {}
    } else if (href.startsWith('http')) {
      externalLinks++;
    }
    
    if (isNav) {
      navigationLinks++;
    } else {
      contentLinks++;
    }
    
    // Analyze anchor text
    const anchorAnalysis = analyzeAnchorText(text);
    
    if (hasImage && !text) {
      imageLinks++;
      const imgAlt = $link.find('img').attr('alt');
      if (!imgAlt) {
        linkIssues.push('Image link without alt text');
      }
    } else if (anchorAnalysis.isEmpty) {
      emptyAnchorLinks++;
      linkIssues.push('Empty anchor text');
    } else if (anchorAnalysis.isGeneric) {
      linksWithGenericText++;
      linkIssues.push('Generic anchor text');
    } else {
      linksWithKeywords++;
    }
    
    if (anchorAnalysis.isTooLong) {
      tooLongAnchorLinks++;
      linkIssues.push('Anchor text too long');
    }
    
    // Track anchor text patterns
    if (text) {
      const normalizedText = text.toLowerCase().substring(0, 50);
      anchorTextCounts[normalizedText] = (anchorTextCounts[normalizedText] || 0) + 1;
    }
    
    // Check for nofollow on internal links
    if (isInternal && rel?.includes('nofollow')) {
      linkIssues.push('nofollow on internal link');
    }
    
    // Check for sponsored/ugc on internal links
    if (isInternal && (rel?.includes('sponsored') || rel?.includes('ugc'))) {
      linkIssues.push('sponsored/ugc on internal link');
    }
    
    linkDetails.push({
      href: href.substring(0, 200),
      text: text.substring(0, 100),
      isInternal,
      isNavigation: isNav,
      rel,
      title,
      issues: linkIssues,
    });
  });
  
  // Generate anchor text patterns
  const anchorPatterns = Object.entries(anchorTextCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));
  
  // Analyze results
  const uniqueInternalTargets = internalTargets.size;
  
  // Check for orphan risk (very few internal links)
  const orphanRisk = internalLinks < 3 && contentLinks < 2;
  
  // Generate issues
  if (internalLinks === 0) {
    issues.push({
      code: 'LINK_NO_INTERNAL',
      severity: 'critical',
      category: 'content',
      title: 'No internal links found',
      description: 'This page has no internal links to other pages on your site.',
      impact: 'Poor link equity distribution, crawlability issues',
      howToFix: 'Add relevant internal links to other pages on your site.',
      affectedUrls: [url],
    });
    score -= 25;
  } else if (contentLinks === 0 && internalLinks < 5) {
    issues.push({
      code: 'LINK_LOW_INTERNAL',
      severity: 'warning',
      category: 'content',
      title: 'Very few internal links in content',
      description: `Only ${internalLinks} internal links found, all in navigation.`,
      impact: 'Limited topic relevance signals',
      howToFix: 'Add contextual internal links within your content.',
      affectedUrls: [url],
    });
    score -= 15;
  }
  
  if (linksWithGenericText > 3) {
    const percentage = Math.round((linksWithGenericText / totalLinks) * 100);
    issues.push({
      code: 'LINK_GENERIC_ANCHOR',
      severity: 'warning',
      category: 'content',
      title: `${linksWithGenericText} links with generic anchor text`,
      description: `${percentage}% of links use non-descriptive text like "click here" or "read more".`,
      impact: 'Missed keyword relevance signals',
      howToFix: 'Replace generic anchors with descriptive, keyword-rich text.',
      affectedUrls: [url],
    });
    score -= Math.min(linksWithGenericText * 2, 15);
  }
  
  if (emptyAnchorLinks > 0) {
    issues.push({
      code: 'LINK_EMPTY_ANCHOR',
      severity: 'warning',
      category: 'content',
      title: `${emptyAnchorLinks} links with empty anchor text`,
      description: 'Links without text or alt text are inaccessible and provide no SEO value.',
      impact: 'Accessibility issues, wasted link equity',
      howToFix: 'Add descriptive text or ensure image links have alt text.',
      affectedUrls: [url],
    });
    score -= Math.min(emptyAnchorLinks * 3, 15);
  }
  
  if (orphanRisk) {
    issues.push({
      code: 'LINK_ORPHAN_RISK',
      severity: 'info',
      category: 'content',
      title: 'Page may be an orphan',
      description: 'This page has very few internal links, which may indicate it\'s poorly connected in your site structure.',
      impact: 'Difficult for users and crawlers to find',
      howToFix: 'Link to this page from related content and relevant hub pages.',
      affectedUrls: [url],
    });
    score -= 10;
  }
  
  // Check internal link nofollow
  const nofollowInternalLinks = linkDetails.filter(l => l.isInternal && l.rel?.includes('nofollow'));
  if (nofollowInternalLinks.length > 0) {
    issues.push({
      code: 'LINK_NOFOLLOW_INTERNAL',
      severity: 'warning',
      category: 'technical',
      title: `${nofollowInternalLinks.length} internal links with nofollow`,
      description: 'Internal links should not have nofollow - it wastes PageRank.',
      impact: 'Reduced internal link equity flow',
      howToFix: 'Remove nofollow from internal links.',
      affectedUrls: [url],
    });
    score -= nofollowInternalLinks.length * 3;
  }
  
  // Check for excessive external links
  if (externalLinks > internalLinks && externalLinks > 10) {
    issues.push({
      code: 'LINK_EXTERNAL_HEAVY',
      severity: 'info',
      category: 'content',
      title: 'More external links than internal',
      description: `${externalLinks} external vs ${internalLinks} internal links.`,
      impact: 'May leak PageRank to external sites',
      howToFix: 'Consider adding more internal links or using nofollow/sponsored for some external links.',
      affectedUrls: [url],
    });
  }
  
  // Recommendations
  if (contentLinks < 3 && internalLinks > 0) {
    recommendations.push('Add 2-3 contextual internal links within your content');
  }
  
  if (linksWithKeywords / Math.max(totalLinks, 1) > 0.7) {
    recommendations.push('✓ Good use of descriptive anchor text');
  }
  
  if (uniqueInternalTargets > 5) {
    recommendations.push('✓ Good diversity of internal link targets');
  }
  
  // Suggest hub pages
  if (internalLinks > 10) {
    recommendations.push('Consider creating a hub/pillar page to consolidate topic authority');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    totalLinks,
    internalLinks,
    externalLinks,
    navigationLinks,
    contentLinks,
    uniqueInternalTargets,
    linksWithKeywords,
    linksWithGenericText,
    orphanRisk,
    linkDetails,
    anchorTextAnalysis: {
      total: totalLinks,
      descriptive: linksWithKeywords,
      generic: linksWithGenericText,
      empty: emptyAnchorLinks,
      tooLong: tooLongAnchorLinks,
      imageLinks,
      patterns: anchorPatterns,
    },
    issues,
    recommendations,
  };
}

/**
 * Suggest internal linking opportunities
 */
export function suggestInternalLinks(content: string, availablePages: { url: string; title: string; keywords: string[] }[]): {
  keyword: string;
  suggestedUrl: string;
  suggestedTitle: string;
  relevance: number;
}[] {
  const suggestions: { keyword: string; suggestedUrl: string; suggestedTitle: string; relevance: number }[] = [];
  const contentLower = content.toLowerCase();
  
  for (const page of availablePages) {
    for (const keyword of page.keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        // Check if not already linked
        const alreadyLinked = content.includes(`href="${page.url}"`) || 
                              content.includes(`href='${page.url}'`);
        
        if (!alreadyLinked) {
          // Simple relevance: keyword length + position
          const position = contentLower.indexOf(keyword.toLowerCase());
          const relevance = (keyword.length * 2) + (1000 - Math.min(position, 1000)) / 100;
          
          suggestions.push({
            keyword,
            suggestedUrl: page.url,
            suggestedTitle: page.title,
            relevance,
          });
        }
      }
    }
  }
  
  // Sort by relevance and dedupe
  return suggestions
    .sort((a, b) => b.relevance - a.relevance)
    .filter((s, i, arr) => arr.findIndex(x => x.suggestedUrl === s.suggestedUrl) === i)
    .slice(0, 10);
}
