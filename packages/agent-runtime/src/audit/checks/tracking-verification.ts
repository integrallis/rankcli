/**
 * Tracking Verification Checks
 *
 * Verifies that essential tracking and verification codes are present:
 * - Google Analytics 4 (gtag.js)
 * - Google Search Console verification
 * - Bing Webmaster Tools verification
 * - Google Tag Manager
 * - Schema.org structured data
 */

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

// =============================================================================
// Local Check Types (for compatibility with check runner)
// =============================================================================
interface PageContext {
  url: string;
  html: string;
  $: cheerio.CheerioAPI;
}

interface CheckResult {
  id: string;
  checkId: string;
  type: string;
  category: string;
  title: string;
  description: string;
  affectedElement?: string;
  recommendation: string;
  impact: string;
  effort: string;
  learnMoreUrl?: string;
  autoFixable?: boolean;
  fixCode?: string;
}

interface AuditCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  impact: string;
  check(context: PageContext): Promise<CheckResult | null>;
}

// =============================================================================
// Tracking Data Interface
// =============================================================================
export interface TrackingData {
  ga4: {
    detected: boolean;
    measurementId?: string;
  };
  gtm: {
    detected: boolean;
    containerId?: string;
    hasNoscript: boolean;
  };
  gsc: {
    verified: boolean;
    verificationCode?: string;
  };
  bing: {
    verified: boolean;
    verificationCode?: string;
  };
  schemaOrg: {
    detected: boolean;
    types: string[];
    hasValidJson: boolean;
  };
  sitemap: {
    inRobotsTxt: boolean;
  };
}

// =============================================================================
// Main Analyze Function
// =============================================================================
export function analyzeTrackingVerification(
  html: string,
  url: string
): { issues: AuditIssue[]; data: TrackingData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Detect GA4
  const ga4Match = html.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/i) ||
                   html.match(/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/i);
  const hasGa4 = !!ga4Match;
  const ga4MeasurementId = ga4Match ? ga4Match[1] : undefined;

  // Detect GTM
  const gtmMatch = html.match(/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)/i);
  const hasGtm = !!gtmMatch;
  const gtmContainerId = gtmMatch ? gtmMatch[1] : undefined;
  const hasGtmNoscript = /googletagmanager\.com\/ns\.html\?id=GTM-[A-Z0-9]+/i.test(html);

  // Detect GSC verification
  const gscMeta = $('meta[name="google-site-verification"]').attr('content');
  const hasGscVerification = !!(gscMeta && gscMeta.length > 10);

  // Detect Bing verification
  const bingMeta = $('meta[name="msvalidate.01"]').attr('content');
  const hasBingVerification = !!(bingMeta && bingMeta.length > 10);

  // Detect Schema.org
  const jsonLdScripts = $('script[type="application/ld+json"]');
  const hasMicrodata = $('[itemtype*="schema.org"]').length > 0;
  const hasJsonLd = jsonLdScripts.length > 0;

  const schemaTypes: string[] = [];
  let hasValidJson = true;

  jsonLdScripts.each((_, el) => {
    try {
      const content = $(el).html();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed['@type']) {
          schemaTypes.push(parsed['@type']);
        }
      }
    } catch {
      hasValidJson = false;
    }
  });

  const data: TrackingData = {
    ga4: { detected: hasGa4, measurementId: ga4MeasurementId },
    gtm: { detected: hasGtm, containerId: gtmContainerId, hasNoscript: hasGtmNoscript },
    gsc: { verified: hasGscVerification, verificationCode: gscMeta },
    bing: { verified: hasBingVerification, verificationCode: bingMeta },
    schemaOrg: { detected: hasJsonLd || hasMicrodata, types: schemaTypes, hasValidJson },
    sitemap: { inRobotsTxt: false }, // Set later if we check robots.txt
  };

  // ==================== GA4 Check ====================
  if (!hasGa4 && !hasGtm) {
    issues.push({
      code: 'GA4_MISSING',
      severity: 'warning',
      category: 'on-page',
      title: 'Google Analytics 4 not detected',
      description:
        'No GA4 tracking code found. GA4 is essential for measuring organic traffic and conversions.',
      impact: 'Cannot measure SEO impact without analytics tracking.',
      howToFix:
        'Add GA4 tracking code to your site. Get your measurement ID from analytics.google.com.',
      affectedUrls: [url],
    });
  }

  // ==================== GSC Verification Check ====================
  if (!hasGscVerification) {
    issues.push({
      code: 'GSC_VERIFICATION_MISSING',
      severity: 'warning',
      category: 'on-page',
      title: 'Google Search Console verification not found',
      description:
        'No GSC verification meta tag detected. GSC provides essential data about your search performance.',
      impact: 'Missing critical insights into Google search visibility, impressions, and clicks.',
      howToFix:
        'Add your GSC verification meta tag to the <head> section. Get it from search.google.com/search-console.',
      affectedUrls: [url],
    });
  }

  // ==================== Bing Verification Check ====================
  if (!hasBingVerification) {
    issues.push({
      code: 'BING_VERIFICATION_MISSING',
      severity: 'notice',
      category: 'on-page',
      title: 'Bing Webmaster Tools verification not found',
      description:
        'No Bing verification meta tag detected. Bing/Yahoo account for 5-8% of search traffic.',
      impact: 'Missing insights on Bing/Yahoo search traffic.',
      howToFix:
        'Add Bing Webmaster Tools verification for insights on Bing/Yahoo traffic. Get it from bing.com/webmasters.',
      affectedUrls: [url],
    });
  }

  // ==================== GTM Check (informational) ====================
  if (!hasGtm) {
    issues.push({
      code: 'GTM_MISSING',
      severity: 'notice',
      category: 'on-page',
      title: 'Google Tag Manager not detected',
      description:
        'GTM not found. While not required, GTM makes it easier to manage tracking tags without code changes.',
      impact: 'Tag management requires developer involvement for each change.',
      howToFix:
        'Consider using GTM for easier tag management. It allows marketing to add tags without developer help.',
      affectedUrls: [url],
    });
  } else if (!hasGtmNoscript) {
    issues.push({
      code: 'GTM_NOSCRIPT_MISSING',
      severity: 'notice',
      category: 'on-page',
      title: 'GTM noscript fallback missing',
      description:
        'GTM is installed but the noscript fallback is missing. This is needed for users with JavaScript disabled.',
      impact: 'Users with JS disabled won\'t be tracked.',
      howToFix: 'Add the GTM noscript tag immediately after the opening <body> tag.',
      affectedUrls: [url],
    });
  }

  // ==================== Schema.org Check ====================
  if (!hasJsonLd && !hasMicrodata) {
    issues.push({
      code: 'SCHEMA_ORG_MISSING',
      severity: 'warning',
      category: 'structured-data',
      title: 'No structured data found',
      description:
        'No Schema.org structured data detected. Structured data helps search engines understand your content and can enable rich snippets.',
      impact: 'Missing opportunity for rich results in search (stars, images, FAQs, etc.).',
      howToFix:
        'Add JSON-LD structured data for your content type (Organization, Product, Article, etc.).',
      affectedUrls: [url],
    });
  } else if (hasJsonLd && !hasValidJson) {
    issues.push({
      code: 'SCHEMA_ORG_INVALID',
      severity: 'error',
      category: 'structured-data',
      title: 'Invalid JSON-LD structured data',
      description:
        'One or more JSON-LD scripts contain invalid JSON. This will prevent search engines from parsing your structured data.',
      impact: 'Structured data is being ignored due to syntax errors.',
      howToFix:
        'Fix the JSON syntax errors in your structured data. Use the Rich Results Test to validate.',
      affectedUrls: [url],
    });
  }

  return { issues, data };
}

// =============================================================================
// Google Analytics 4 Check
// =============================================================================
export const ga4TrackingCheck: AuditCheck = {
  id: 'ga4-tracking',
  name: 'Google Analytics 4 Tracking',
  description: 'Checks if GA4 tracking code is properly installed',
  category: 'on-page',
  severity: 'warning',
  impact: 'medium',

  async check(context: PageContext): Promise<CheckResult | null> {
    const { html } = context;

    // Look for GA4 patterns
    const ga4Patterns = [
      // gtag.js with G- measurement ID
      /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-[A-Z0-9]+['"]/i,
      // gtag.js script
      /googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+/i,
      // GA4 measurement protocol
      /G-[A-Z0-9]{10,}/,
    ];

    const hasGa4 = ga4Patterns.some((pattern) => pattern.test(html));

    // Also check for GTM (which might contain GA4)
    const hasGtm = /googletagmanager\.com\/gtm\.js/.test(html);

    if (!hasGa4 && !hasGtm) {
      return {
        id: 'ga4-tracking',
        checkId: 'ga4-tracking',
        type: 'warning',
        category: 'on-page',
        title: 'Google Analytics 4 not detected',
        description:
          'No GA4 tracking code found. GA4 is essential for measuring organic traffic and conversions.',
        affectedElement: '<head>',
        recommendation:
          'Add GA4 tracking code to your site. Get your measurement ID from analytics.google.com.',
        impact: 'medium',
        effort: 'low',
        learnMoreUrl: 'https://support.google.com/analytics/answer/9304153',
        autoFixable: true,
        fixCode: `<!-- Add to <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`,
      };
    }

    return null;
  },
};

// =============================================================================
// Google Search Console Verification Check
// =============================================================================
export const gscVerificationCheck: AuditCheck = {
  id: 'gsc-verification',
  name: 'Google Search Console Verification',
  description: 'Checks if GSC verification meta tag is present',
  category: 'on-page',
  severity: 'warning',
  impact: 'high',

  async check(context: PageContext): Promise<CheckResult | null> {
    const { $ } = context;

    // Check for GSC verification meta tag
    const gscMeta = $('meta[name="google-site-verification"]').attr('content');

    // Also check for other verification methods mentioned in HTML
    const hasGscVerification = gscMeta && gscMeta.length > 10;

    if (!hasGscVerification) {
      return {
        id: 'gsc-verification',
        checkId: 'gsc-verification',
        type: 'warning',
        category: 'on-page',
        title: 'Google Search Console verification not found',
        description:
          'No GSC verification meta tag detected. GSC provides essential data about your search performance.',
        affectedElement: '<head>',
        recommendation:
          'Add your GSC verification meta tag to the <head> section. Get it from search.google.com/search-console.',
        impact: 'high',
        effort: 'low',
        learnMoreUrl: 'https://support.google.com/webmasters/answer/9008080',
        autoFixable: true,
        fixCode: `<!-- Add to <head> -->
<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />`,
      };
    }

    return null;
  },
};

// =============================================================================
// Bing Webmaster Tools Verification Check
// =============================================================================
export const bingVerificationCheck: AuditCheck = {
  id: 'bing-verification',
  name: 'Bing Webmaster Tools Verification',
  description: 'Checks if Bing Webmaster Tools verification is present',
  category: 'on-page',
  severity: 'notice',
  impact: 'low',

  async check(context: PageContext): Promise<CheckResult | null> {
    const { $ } = context;

    // Check for Bing verification meta tag
    const bingMeta = $('meta[name="msvalidate.01"]').attr('content');

    const hasBingVerification = bingMeta && bingMeta.length > 10;

    if (!hasBingVerification) {
      return {
        id: 'bing-verification',
        checkId: 'bing-verification',
        type: 'notice',
        category: 'on-page',
        title: 'Bing Webmaster Tools verification not found',
        description:
          'No Bing verification meta tag detected. Bing/Yahoo account for 5-8% of search traffic.',
        affectedElement: '<head>',
        recommendation:
          'Add Bing Webmaster Tools verification for insights on Bing/Yahoo traffic. Get it from bing.com/webmasters.',
        impact: 'low',
        effort: 'low',
        learnMoreUrl: 'https://www.bing.com/webmasters/help/how-to-verify-ownership-of-your-site-afcfefc6',
        autoFixable: true,
        fixCode: `<!-- Add to <head> -->
<meta name="msvalidate.01" content="YOUR_BING_VERIFICATION_CODE" />`,
      };
    }

    return null;
  },
};

// =============================================================================
// Google Tag Manager Check
// =============================================================================
export const gtmCheck: AuditCheck = {
  id: 'gtm-installed',
  name: 'Google Tag Manager',
  description: 'Checks if GTM is installed for flexible tag management',
  category: 'on-page',
  severity: 'notice',
  impact: 'low',

  async check(context: PageContext): Promise<CheckResult | null> {
    const { html } = context;

    // Check for GTM
    const gtmPattern = /googletagmanager\.com\/gtm\.js\?id=GTM-[A-Z0-9]+/i;
    const hasGtm = gtmPattern.test(html);

    // Also check for noscript GTM
    const gtmNoscript = /googletagmanager\.com\/ns\.html\?id=GTM-[A-Z0-9]+/i;
    const hasGtmNoscript = gtmNoscript.test(html);

    if (!hasGtm) {
      return {
        id: 'gtm-installed',
        checkId: 'gtm-installed',
        type: 'notice',
        category: 'on-page',
        title: 'Google Tag Manager not detected',
        description:
          'GTM not found. While not required, GTM makes it easier to manage tracking tags without code changes.',
        affectedElement: '<head>',
        recommendation:
          'Consider using GTM for easier tag management. It allows marketing to add tags without developer help.',
        impact: 'low',
        effort: 'medium',
        learnMoreUrl: 'https://tagmanager.google.com/',
        autoFixable: true,
        fixCode: `<!-- Add to <head> -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>

<!-- Add immediately after opening <body> -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
      };
    }

    // Check if noscript fallback is present
    if (hasGtm && !hasGtmNoscript) {
      return {
        id: 'gtm-noscript-missing',
        checkId: 'gtm-installed',
        type: 'notice',
        category: 'on-page',
        title: 'GTM noscript fallback missing',
        description:
          'GTM is installed but the noscript fallback is missing. This is needed for users with JavaScript disabled.',
        affectedElement: '<body>',
        recommendation: 'Add the GTM noscript tag immediately after the opening <body> tag.',
        impact: 'low',
        effort: 'low',
        learnMoreUrl: 'https://developers.google.com/tag-manager/quickstart',
      };
    }

    return null;
  },
};

// =============================================================================
// Schema.org Structured Data Check
// =============================================================================
export const schemaOrgCheck: AuditCheck = {
  id: 'schema-org',
  name: 'Schema.org Structured Data',
  description: 'Checks for structured data markup',
  category: 'structured-data',
  severity: 'warning',
  impact: 'medium',

  async check(context: PageContext): Promise<CheckResult | null> {
    const { $ } = context;

    // Check for JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const hasJsonLd = jsonLdScripts.length > 0;

    // Check for microdata
    const hasMicrodata = $('[itemtype*="schema.org"]').length > 0;

    // Check for RDFa
    const hasRdfa = $('[typeof]').length > 0 || $('[property]').length > 0;

    if (!hasJsonLd && !hasMicrodata && !hasRdfa) {
      return {
        id: 'schema-org-missing',
        checkId: 'schema-org',
        type: 'warning',
        category: 'structured-data',
        title: 'No structured data found',
        description:
          'No Schema.org structured data detected. Structured data helps search engines understand your content and can enable rich snippets.',
        affectedElement: '<head>',
        recommendation:
          'Add JSON-LD structured data for your content type (Organization, Product, Article, etc.).',
        impact: 'medium',
        effort: 'medium',
        learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data',
        autoFixable: true,
        fixCode: `<!-- Add to <head> - Example Organization schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "https://your-domain.com",
  "logo": "https://your-domain.com/logo.png",
  "sameAs": [
    "https://twitter.com/yourcompany",
    "https://linkedin.com/company/yourcompany"
  ]
}
</script>`,
      };
    }

    // Validate JSON-LD syntax
    if (hasJsonLd) {
      let hasInvalidJsonLd = false;
      jsonLdScripts.each((_, el) => {
        try {
          const content = $(el).html();
          if (content) {
            JSON.parse(content);
          }
        } catch {
          hasInvalidJsonLd = true;
        }
      });

      if (hasInvalidJsonLd) {
        return {
          id: 'schema-org-invalid',
          checkId: 'schema-org',
          type: 'error',
          category: 'structured-data',
          title: 'Invalid JSON-LD structured data',
          description:
            'One or more JSON-LD scripts contain invalid JSON. This will prevent search engines from parsing your structured data.',
          affectedElement: 'script[type="application/ld+json"]',
          recommendation:
            'Fix the JSON syntax errors in your structured data. Use the Rich Results Test to validate.',
          impact: 'high',
          effort: 'low',
          learnMoreUrl: 'https://search.google.com/test/rich-results',
        };
      }
    }

    return null;
  },
};

// =============================================================================
// Sitemap Reference Check
// =============================================================================
export const sitemapReferenceCheck: AuditCheck = {
  id: 'sitemap-reference',
  name: 'Sitemap Reference',
  description: 'Checks if sitemap is referenced for search engines',
  category: 'crawlability',
  severity: 'warning',
  impact: 'medium',

  async check(context: PageContext): Promise<CheckResult | null> {
    const { url } = context;

    // Only check on homepage
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') {
      return null;
    }

    // Try to fetch robots.txt to check for sitemap reference
    try {
      const robotsUrl = new URL('/robots.txt', url).href;
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': 'RankCLI-Audit/1.0' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const robotsTxt = await response.text();
        const hasSitemapRef = /sitemap:/i.test(robotsTxt);

        if (!hasSitemapRef) {
          return {
            id: 'sitemap-not-in-robots',
            checkId: 'sitemap-reference',
            type: 'warning',
            category: 'crawlability',
            title: 'Sitemap not referenced in robots.txt',
            description:
              'Your robots.txt does not reference a sitemap. Adding a sitemap reference helps search engines discover all your pages.',
            affectedElement: '/robots.txt',
            recommendation: 'Add a Sitemap directive to your robots.txt file.',
            impact: 'medium',
            effort: 'low',
            learnMoreUrl: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
            autoFixable: true,
            fixCode: `# Add to robots.txt
Sitemap: ${new URL('/sitemap.xml', url).href}`,
          };
        }
      }
    } catch {
      // Ignore fetch errors
    }

    return null;
  },
};

// =============================================================================
// Export all tracking checks
// =============================================================================
export const trackingChecks: AuditCheck[] = [
  ga4TrackingCheck,
  gscVerificationCheck,
  bingVerificationCheck,
  gtmCheck,
  schemaOrgCheck,
  sitemapReferenceCheck,
];
