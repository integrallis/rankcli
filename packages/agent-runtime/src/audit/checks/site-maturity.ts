// Site Maturity Analysis - Different SEO Strategies for New vs Established Sites
// Based on Nathan Gotch's advice: New sites should focus on authority building, not content proliferation
// Reference: "How to do SEO when your website is new?"

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export type SiteMaturity = 'new' | 'growing' | 'established' | 'mature';
export type SEOStrategy = 'authority-first' | 'content-expansion' | 'optimization' | 'maintenance';

export interface SiteMaturityData {
  estimatedAge: {
    days: number | null;
    source: 'wayback' | 'whois' | 'ssl' | 'sitemap' | 'estimated';
    confidence: 'high' | 'medium' | 'low';
  };
  maturityLevel: SiteMaturity;
  authorityIndicators: {
    hasBacklinks: boolean;
    estimatedBacklinks: number;
    hasIndexedPages: boolean;
    indexedPagesEstimate: number;
    hasBrandMentions: boolean;
    sslAge: number | null; // days
  };
  contentMetrics: {
    pageCount: number;
    hasMultipleContentTypes: boolean;
    hasBlog: boolean;
    contentToAuthorityRatio: 'balanced' | 'content-heavy' | 'authority-heavy';
  };
  recommendedStrategy: SEOStrategy;
  strategicRecommendations: string[];
}

/**
 * Estimate domain age from SSL certificate issuance date
 */
export async function getSSLCertificateAge(url: string): Promise<number | null> {
  // Dynamically import https module (Node.js only)
  let https: typeof import('https');
  try {
    https = await import('https');
  } catch {
    // Not available in Deno/browser
    return null;
  }

  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        host: parsedUrl.hostname,
        port: 443,
        method: 'GET',
        rejectUnauthorized: false, // Accept self-signed for checking
      };

      const req = https.request(options, (res) => {
        const cert = (res.socket as any).getPeerCertificate?.();
        if (cert && cert.valid_from) {
          const validFrom = new Date(cert.valid_from);
          const now = new Date();
          const ageDays = Math.floor((now.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24));
          resolve(ageDays);
        } else {
          resolve(null);
        }
      });

      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

/**
 * Check Wayback Machine for earliest snapshot (approximate domain age)
 */
export async function checkWaybackMachine(domain: string): Promise<{ firstSeen: Date | null; snapshots: number }> {
  try {
    // Wayback CDX API - get earliest snapshot
    const response = await httpGet<string>(
      `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&limit=1&from=1990`,
      {
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status === 200 && Array.isArray(response.data) && response.data.length > 1) {
      // First row is headers, second is earliest snapshot
      const timestamp = response.data[1]?.[1];
      if (timestamp) {
        // Wayback timestamp format: YYYYMMDDHHmmss
        const year = parseInt(timestamp.substring(0, 4));
        const month = parseInt(timestamp.substring(4, 6)) - 1;
        const day = parseInt(timestamp.substring(6, 8));
        return { firstSeen: new Date(year, month, day), snapshots: response.data.length - 1 };
      }
    }

    return { firstSeen: null, snapshots: 0 };
  } catch {
    return { firstSeen: null, snapshots: 0 };
  }
}

/**
 * Estimate number of indexed pages using site: query approximation
 * (Without Google API, we use heuristics from sitemap)
 */
export async function estimateIndexedPages(url: string): Promise<number> {
  const origin = new URL(url).origin;

  try {
    // Check sitemap for page count
    const sitemapUrls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await httpGet<string>(sitemapUrl, {
          
          timeout: 10000,
          validateStatus: () => true,
        });

        if (response.status === 200) {
          const $ = cheerio.load(response.data, { xmlMode: true });

          // Check if it's a sitemap index
          const sitemaps = $('sitemap').length;
          if (sitemaps > 0) {
            // Estimate: each sub-sitemap typically has ~1000 URLs
            return sitemaps * 500; // Conservative estimate
          }

          // Regular sitemap - count URLs
          const urls = $('url').length;
          if (urls > 0) {
            return urls;
          }
        }
      } catch {
        // Try next sitemap URL
      }
    }

    return 0; // Unable to estimate
  } catch {
    return 0;
  }
}

/**
 * Analyze HTML for site maturity signals
 */
export function analyzeHTMLMaturitySignals(html: string, url: string): {
  hasBlog: boolean;
  hasMultipleContentTypes: boolean;
  hasEstablishedBrand: boolean;
  contentIndicators: string[];
} {
  const $ = cheerio.load(html);
  const text = $('body').text().toLowerCase();
  const htmlLower = html.toLowerCase();

  // Blog detection
  const hasBlog =
    $('a[href*="/blog"]').length > 0 ||
    $('a[href*="/posts"]').length > 0 ||
    $('a[href*="/articles"]').length > 0 ||
    htmlLower.includes('/blog') ||
    $('[class*="blog"]').length > 0;

  // Multiple content types
  const contentIndicators: string[] = [];
  if (hasBlog) contentIndicators.push('blog');
  if ($('a[href*="/products"], [class*="product"]').length > 0) contentIndicators.push('products');
  if ($('a[href*="/services"], [class*="service"]').length > 0) contentIndicators.push('services');
  if ($('a[href*="/portfolio"], [class*="portfolio"]').length > 0) contentIndicators.push('portfolio');
  if ($('a[href*="/case-stud"], [class*="case"]').length > 0) contentIndicators.push('case-studies');
  if ($('a[href*="/testimonial"], [class*="testimonial"]').length > 0) contentIndicators.push('testimonials');
  if ($('a[href*="/resource"], [class*="resource"]').length > 0) contentIndicators.push('resources');

  const hasMultipleContentTypes = contentIndicators.length >= 3;

  // Established brand signals
  const hasEstablishedBrand =
    // Social proof
    ($('[class*="trust"], [class*="partner"], [class*="client"]').length > 0 ||
      // Press/media mentions
      text.includes('featured in') ||
      text.includes('as seen') ||
      text.includes('trusted by') ||
      // Awards/certifications
      text.includes('award') ||
      text.includes('certified') ||
      // Copyright with year range
      /©\s*\d{4}\s*-\s*\d{4}/.test(text) ||
      // Multiple social links
      $('a[href*="linkedin.com"], a[href*="twitter.com"], a[href*="facebook.com"]').length >= 2);

  return {
    hasBlog,
    hasMultipleContentTypes,
    hasEstablishedBrand,
    contentIndicators,
  };
}

/**
 * Determine recommended SEO strategy based on site maturity
 */
export function determineStrategy(
  maturity: SiteMaturity,
  authorityIndicators: SiteMaturityData['authorityIndicators'],
  contentMetrics: SiteMaturityData['contentMetrics']
): { strategy: SEOStrategy; recommendations: string[] } {
  const recommendations: string[] = [];

  if (maturity === 'new') {
    // Nathan Gotch's advice: Focus on authority first
    recommendations.push(
      '🎯 PRIORITY: Build site authority before creating more content',
      '📝 Create ONE exceptional linkable asset (ultimate guide, original research, tool)',
      '🔗 Focus 80% of effort on link acquisition to your best page',
      '⏳ Wait until you have 10+ quality backlinks before content expansion',
      '❌ AVOID: Publishing lots of content that won\'t rank without authority'
    );
    return { strategy: 'authority-first', recommendations };
  }

  if (maturity === 'growing') {
    if (contentMetrics.contentToAuthorityRatio === 'content-heavy') {
      recommendations.push(
        '⚠️ Content-to-authority imbalance detected',
        '🔗 Pause content creation and focus on link building',
        '📊 Your content won\'t rank well without more domain authority',
        '🎯 Build 20-50 quality backlinks before adding more pages',
        '💡 Consider "Reverse Silo": Drive links to content assets, then internal link to money pages'
      );
      return { strategy: 'authority-first', recommendations };
    }

    recommendations.push(
      '🚀 You\'re in the growth phase - balance content and links',
      '📝 Create pillar content around 3-5 main topics',
      '🔗 Build 5-10 quality backlinks per month',
      '🏗️ Establish topic clusters with internal linking',
      '📈 Monitor rankings - optimize pages stuck on page 2'
    );
    return { strategy: 'content-expansion', recommendations };
  }

  if (maturity === 'established') {
    recommendations.push(
      '✅ Site has established authority - focus on optimization',
      '🔍 Audit existing content for improvement opportunities',
      '📊 Use data to find underperforming pages to refresh',
      '🎯 Target more competitive keywords',
      '💼 Consider merger technique: Acquire relevant expired domains',
      '🔗 Focus on earning links naturally through quality content'
    );
    return { strategy: 'optimization', recommendations };
  }

  // Mature sites
  recommendations.push(
    '👑 Mature site - maintain and defend rankings',
    '🔄 Regularly refresh top-performing content',
    '🛡️ Monitor for ranking drops and algorithm impacts',
    '📈 Expand into adjacent topics and markets',
    '🏆 Focus on brand building and E-E-A-T signals',
    '⚡ Optimize for Core Web Vitals and user experience'
  );
  return { strategy: 'maintenance', recommendations };
}

/**
 * Main function: Analyze site maturity and recommend strategy
 */
export async function analyzeSiteMaturity(
  html: string,
  url: string
): Promise<{ issues: AuditIssue[]; data: SiteMaturityData }> {
  const issues: AuditIssue[] = [];
  const domain = new URL(url).hostname;

  // Gather maturity signals
  const [sslAge, wayback, indexedPages] = await Promise.all([
    getSSLCertificateAge(url),
    checkWaybackMachine(domain),
    estimateIndexedPages(url),
  ]);

  const htmlSignals = analyzeHTMLMaturitySignals(html, url);

  // Estimate age (prefer Wayback, fallback to SSL)
  let estimatedAgeDays: number | null = null;
  let ageSource: 'wayback' | 'ssl' | 'estimated' = 'estimated';
  let ageConfidence: 'high' | 'medium' | 'low' = 'low';

  if (wayback.firstSeen) {
    estimatedAgeDays = Math.floor((Date.now() - wayback.firstSeen.getTime()) / (1000 * 60 * 60 * 24));
    ageSource = 'wayback';
    ageConfidence = wayback.snapshots > 10 ? 'high' : 'medium';
  } else if (sslAge !== null && sslAge > 0) {
    estimatedAgeDays = sslAge;
    ageSource = 'ssl';
    ageConfidence = 'low'; // SSL can be renewed, not reliable for age
  }

  // Determine maturity level
  let maturityLevel: SiteMaturity;
  if (estimatedAgeDays === null || estimatedAgeDays < 90) {
    maturityLevel = 'new';
  } else if (estimatedAgeDays < 365) {
    maturityLevel = 'growing';
  } else if (estimatedAgeDays < 730) {
    maturityLevel = 'established';
  } else {
    maturityLevel = 'mature';
  }

  // Override based on other signals
  if (htmlSignals.hasEstablishedBrand && indexedPages > 100) {
    if (maturityLevel === 'new') maturityLevel = 'growing';
    if (maturityLevel === 'growing') maturityLevel = 'established';
  }

  // Authority indicators (simplified without external API)
  const authorityIndicators = {
    hasBacklinks: wayback.snapshots > 5, // Rough proxy
    estimatedBacklinks: wayback.snapshots * 2, // Very rough estimate
    hasIndexedPages: indexedPages > 0,
    indexedPagesEstimate: indexedPages,
    hasBrandMentions: htmlSignals.hasEstablishedBrand,
    sslAge,
  };

  // Content metrics
  const contentToAuthorityRatio: 'balanced' | 'content-heavy' | 'authority-heavy' =
    indexedPages > 50 && !authorityIndicators.hasBacklinks
      ? 'content-heavy'
      : indexedPages < 10 && authorityIndicators.hasBacklinks
        ? 'authority-heavy'
        : 'balanced';

  const contentMetrics: SiteMaturityData['contentMetrics'] = {
    pageCount: indexedPages,
    hasMultipleContentTypes: htmlSignals.hasMultipleContentTypes,
    hasBlog: htmlSignals.hasBlog,
    contentToAuthorityRatio,
  };

  // Get strategy recommendations
  const { strategy, recommendations } = determineStrategy(maturityLevel, authorityIndicators, contentMetrics);

  // Generate issues based on maturity. Only the Wayback Machine dates a site; a certificate's
  // age is its last renewal (Let's Encrypt renews every 60 to 90 days), so rankcli.dev was
  // reported as 35 days old on evidence of nothing. With no snapshot, age is unknown, not new.
  if (maturityLevel === 'new' && ageSource === 'wayback' && estimatedAgeDays !== null) {
    issues.push({
      code: 'NEW_SITE_STRATEGY',
      severity: 'notice',
      category: 'content',
      title: 'New website detected - Authority-first strategy recommended',
      description:
        `The Wayback Machine first saw this site ${estimatedAgeDays} days ago. Standard SEO advice won't work well for a site under 90 days old.`,
      impact:
        'Creating lots of content without authority is wasted effort. Content from new sites rarely ranks.',
      howToFix:
        'Focus on building 10+ quality backlinks to ONE great page before expanding content. See strategic recommendations.',
      affectedUrls: [url],
      details: {
        estimatedAge: estimatedAgeDays,
        recommendedStrategy: strategy,
        recommendations,
      },
    });
  }

  // CONTENT_AUTHORITY_IMBALANCE used to be reported here ("~1,608 pages but limited backlink
  // signals") on no backlink data at all: the proxy was Wayback snapshot count. The ratio stays
  // in the data for callers that want the heuristic; it is not a finding.

  if (maturityLevel === 'growing' && ageSource === 'wayback' && !htmlSignals.hasBlog) {
    issues.push({
      code: 'GROWING_SITE_NO_BLOG',
      severity: 'notice',
      category: 'content',
      title: 'Growing site without blog/content hub',
      description: 'Site is in growth phase but lacks a blog or content section.',
      impact: 'Blog content is essential for attracting backlinks and building topical authority.',
      howToFix: 'Create a blog section with linkable content assets (guides, research, tools).',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      estimatedAge: {
        days: estimatedAgeDays,
        source: ageSource,
        confidence: ageConfidence,
      },
      maturityLevel,
      authorityIndicators,
      contentMetrics,
      recommendedStrategy: strategy,
      strategicRecommendations: recommendations,
    },
  };
}

/**
 * Quick check for site age category (for conditional audit logic)
 */
export function getSiteAgeCategory(
  estimatedAgeDays: number | null
): 'brand-new' | 'new' | 'adolescent' | 'established' | 'veteran' {
  if (estimatedAgeDays === null || estimatedAgeDays < 30) return 'brand-new';
  if (estimatedAgeDays < 180) return 'new';
  if (estimatedAgeDays < 365) return 'adolescent';
  if (estimatedAgeDays < 1095) return 'established'; // 3 years
  return 'veteran';
}
