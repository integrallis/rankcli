// Comprehensive SEO Audit Types - Matching Ahrefs 170+ checks

export type IssueSeverity = 'critical' | 'error' | 'warning' | 'info' | 'notice';

export type IssueCategory =
  | 'crawlability'
  | 'indexability'
  | 'on-page'
  | 'content'
  | 'links'
  | 'images'
  | 'structured-data'
  | 'performance'
  | 'security'
  | 'mobile'
  | 'international'
  | 'ai-readiness'
  | 'social'
  | 'local-seo'
  | 'accessibility'
  | 'framework'
  | 'technical';

export interface AuditIssue {
  code: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  impact: string;
  howToFix: string;
  affectedUrls?: string[];
  details?: Record<string, unknown>;
}

export interface PageData {
  url: string;
  statusCode: number;
  redirectChain?: string[];
  html: string;
  loadTime: number;
  size: number;
  headers: Record<string, string>;
}

export interface CrawlStats {
  totalUrls: number;
  crawledUrls: number;
  errorUrls: number;
  redirectUrls: number;
  blockedUrls: number;
}

export interface HealthScore {
  overall: number; // 0-100
  crawlability: number;
  indexability: number;
  onPage: number;
  content: number;
  links: number;
  performance: number;
  security: number;
  aiReadiness: number;
  social: number;
  localSeo: number;
  accessibility: number;
}

export interface AuditReport {
  url: string;
  domain: string;
  timestamp: string;
  crawlStats: CrawlStats;
  healthScore: HealthScore;
  issues: AuditIssue[];
  pages: PageAudit[];
  summary: {
    errors: number;
    warnings: number;
    notices: number;
    passed: number;
  };
}

export interface PageAudit {
  url: string;
  statusCode: number;
  title?: string;
  description?: string;
  canonical?: string;
  h1?: string[];
  wordCount: number;
  loadTime: number;
  issues: string[]; // Issue codes
}

// Issue definitions
export interface IssueDefinition {
  code: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  impact: string;
  howToFix: string;
}

// All 100+ issue definitions
export const ISSUE_DEFINITIONS: Record<string, IssueDefinition> = {
  // ==================== CRAWLABILITY ====================
  ROBOTS_TXT_MISSING: {
    code: 'ROBOTS_TXT_MISSING',
    severity: 'warning',
    category: 'crawlability',
    title: 'Missing robots.txt',
    description: 'No robots.txt file found at the root of the domain.',
    impact: 'Search engines cannot determine crawling rules for your site.',
    howToFix: 'Create a robots.txt file at the root of your domain with appropriate directives.',
  },
  ROBOTS_TXT_BLOCKS_ALL: {
    code: 'ROBOTS_TXT_BLOCKS_ALL',
    severity: 'error',
    category: 'crawlability',
    title: 'robots.txt blocks all crawlers',
    description: 'The robots.txt file contains "Disallow: /" which blocks all search engines.',
    impact: 'Your entire site will not be indexed by search engines.',
    howToFix: 'Update robots.txt to allow crawling of important pages.',
  },
  SITEMAP_MISSING: {
    code: 'SITEMAP_MISSING',
    severity: 'warning',
    category: 'crawlability',
    title: 'Missing XML sitemap',
    description: 'No sitemap.xml found at standard locations.',
    impact: 'Search engines may not discover all your pages efficiently.',
    howToFix: 'Create an XML sitemap and submit it to search engines.',
  },
  SITEMAP_NOT_IN_ROBOTS: {
    code: 'SITEMAP_NOT_IN_ROBOTS',
    severity: 'notice',
    category: 'crawlability',
    title: 'Sitemap not referenced in robots.txt',
    description: 'The sitemap URL is not listed in robots.txt.',
    impact: 'Search engines may not find your sitemap automatically.',
    howToFix: 'Add "Sitemap: https://yoursite.com/sitemap.xml" to robots.txt.',
  },
  REDIRECT_CHAIN: {
    code: 'REDIRECT_CHAIN',
    severity: 'warning',
    category: 'crawlability',
    title: 'Redirect chain detected',
    description: 'Multiple redirects before reaching the final destination.',
    impact: 'Wastes crawl budget and reduces link equity passed to the final page.',
    howToFix: 'Update redirects to point directly to the final destination URL.',
  },
  REDIRECT_LOOP: {
    code: 'REDIRECT_LOOP',
    severity: 'error',
    category: 'crawlability',
    title: 'Redirect loop detected',
    description: 'Redirects create an infinite loop.',
    impact: 'Page is completely inaccessible to users and search engines.',
    howToFix: 'Fix the redirect configuration to break the loop.',
  },
  ORPHAN_PAGE: {
    code: 'ORPHAN_PAGE',
    severity: 'warning',
    category: 'crawlability',
    title: 'Orphan page (no internal links)',
    description: 'This page has no internal links pointing to it.',
    impact: 'Search engines may not discover this page, and it receives no link equity.',
    howToFix: 'Add internal links from relevant pages to this page.',
  },

  // ==================== INDEXABILITY ====================
  NOINDEX_TAG: {
    code: 'NOINDEX_TAG',
    severity: 'notice',
    category: 'indexability',
    title: 'Page has noindex tag',
    description: 'The page contains a noindex meta tag or X-Robots-Tag header.',
    impact: 'This page will not appear in search results.',
    howToFix: 'Remove the noindex tag if you want this page indexed.',
  },
  CANONICAL_MISSING: {
    code: 'CANONICAL_MISSING',
    severity: 'warning',
    category: 'indexability',
    title: 'Missing canonical tag',
    description: 'No canonical URL specified for this page.',
    impact: 'May cause duplicate content issues if the page is accessible via multiple URLs.',
    howToFix: 'Add a self-referencing canonical tag or point to the preferred URL.',
  },
  CANONICAL_POINTS_TO_REDIRECT: {
    code: 'CANONICAL_POINTS_TO_REDIRECT',
    severity: 'error',
    category: 'indexability',
    title: 'Canonical points to redirect',
    description: 'The canonical URL redirects to a different page.',
    impact: 'Confuses search engines and may cause indexing issues.',
    howToFix: 'Update the canonical to point to the final destination URL.',
  },
  CANONICAL_POINTS_TO_4XX: {
    code: 'CANONICAL_POINTS_TO_4XX',
    severity: 'error',
    category: 'indexability',
    title: 'Canonical points to 4XX page',
    description: 'The canonical URL returns a 4XX error.',
    impact: 'Search engines cannot index this page properly.',
    howToFix: 'Update the canonical to point to a valid URL.',
  },
  MULTIPLE_CANONICALS: {
    code: 'MULTIPLE_CANONICALS',
    severity: 'error',
    category: 'indexability',
    title: 'Multiple canonical tags',
    description: 'Page has more than one canonical tag.',
    impact: 'Search engines may ignore all canonical hints.',
    howToFix: 'Remove duplicate canonical tags, keeping only one.',
  },

  // ==================== ON-PAGE SEO ====================
  TITLE_MISSING: {
    code: 'TITLE_MISSING',
    severity: 'error',
    category: 'on-page',
    title: 'Missing title tag',
    description: 'The page has no title tag.',
    impact: 'Critical ranking factor missing. Page will have poor search visibility.',
    howToFix: 'Add a descriptive title tag (50-60 characters).',
  },
  TITLE_TOO_SHORT: {
    code: 'TITLE_TOO_SHORT',
    severity: 'warning',
    category: 'on-page',
    title: 'Title tag too short',
    description: 'Title tag is less than 30 characters.',
    impact: 'Not utilizing the full space available in search results.',
    howToFix: 'Expand the title to 50-60 characters with relevant keywords.',
  },
  TITLE_TOO_LONG: {
    code: 'TITLE_TOO_LONG',
    severity: 'warning',
    category: 'on-page',
    title: 'Title tag too long',
    description: 'Title tag exceeds 60 characters.',
    impact: 'Title will be truncated in search results.',
    howToFix: 'Shorten the title to under 60 characters.',
  },
  TITLE_DUPLICATE: {
    code: 'TITLE_DUPLICATE',
    severity: 'warning',
    category: 'on-page',
    title: 'Duplicate title tag',
    description: 'Multiple pages have the same title.',
    impact: 'Can cause keyword cannibalization and confuse search engines.',
    howToFix: 'Ensure each page has a unique, descriptive title.',
  },
  META_DESC_MISSING: {
    code: 'META_DESC_MISSING',
    severity: 'warning',
    category: 'on-page',
    title: 'Missing meta description',
    description: 'No meta description tag found.',
    impact: 'Search engines may use random page content as the snippet.',
    howToFix: 'Add a compelling meta description (150-160 characters).',
  },
  META_DESC_TOO_SHORT: {
    code: 'META_DESC_TOO_SHORT',
    severity: 'notice',
    category: 'on-page',
    title: 'Meta description too short',
    description: 'Meta description is less than 120 characters.',
    impact: 'Not fully utilizing the snippet space in search results.',
    howToFix: 'Expand to 150-160 characters with a compelling call-to-action.',
  },
  META_DESC_TOO_LONG: {
    code: 'META_DESC_TOO_LONG',
    severity: 'notice',
    category: 'on-page',
    title: 'Meta description too long',
    description: 'Meta description exceeds 160 characters.',
    impact: 'Description may be truncated in search results.',
    howToFix: 'Shorten to under 160 characters.',
  },
  META_DESC_DUPLICATE: {
    code: 'META_DESC_DUPLICATE',
    severity: 'warning',
    category: 'on-page',
    title: 'Duplicate meta description',
    description: 'Multiple pages have the same meta description.',
    impact: 'Reduces the uniqueness of your pages in search results.',
    howToFix: 'Write unique meta descriptions for each page.',
  },
  H1_MISSING: {
    code: 'H1_MISSING',
    severity: 'error',
    category: 'on-page',
    title: 'Missing H1 heading',
    description: 'No H1 tag found on the page.',
    impact: 'Search engines use H1 to understand the main topic of the page.',
    howToFix: 'Add exactly one H1 tag that describes the main content.',
  },
  H1_MULTIPLE: {
    code: 'H1_MULTIPLE',
    severity: 'warning',
    category: 'on-page',
    title: 'Multiple H1 headings',
    description: 'Page has more than one H1 tag.',
    impact: 'Can dilute the topical focus of the page.',
    howToFix: 'Use only one H1 per page. Use H2-H6 for subheadings.',
  },
  H1_DUPLICATE_OF_TITLE: {
    code: 'H1_DUPLICATE_OF_TITLE',
    severity: 'notice',
    category: 'on-page',
    title: 'H1 identical to title tag',
    description: 'The H1 heading is exactly the same as the title tag.',
    impact: 'Missed opportunity to target additional keywords.',
    howToFix: 'Consider varying the H1 to cover related keywords.',
  },
  HEADING_SKIP: {
    code: 'HEADING_SKIP',
    severity: 'notice',
    category: 'on-page',
    title: 'Skipped heading level',
    description: 'Heading hierarchy skips levels (e.g., H1 to H3).',
    impact: 'May confuse screen readers and reduce content structure clarity.',
    howToFix: 'Maintain proper heading hierarchy (H1 > H2 > H3, etc.).',
  },
  H2_MISSING: {
    code: 'H2_MISSING',
    severity: 'warning',
    category: 'on-page',
    title: 'No H2 headings found',
    description: 'No H2 tags were found on the page.',
    impact: 'H2 headings help structure content and are important for SEO and readability.',
    howToFix: 'Break your content into sections using H2 headings with relevant keywords.',
  },

  // ==================== CONTENT ====================
  THIN_CONTENT: {
    code: 'THIN_CONTENT',
    severity: 'warning',
    category: 'content',
    title: 'Thin content',
    description: 'Page has less than 300 words of text content.',
    impact: 'May be seen as low-quality by search engines.',
    howToFix: 'Add more valuable, relevant content to the page.',
  },
  DUPLICATE_CONTENT: {
    code: 'DUPLICATE_CONTENT',
    severity: 'warning',
    category: 'content',
    title: 'Duplicate content detected',
    description: 'Significant content overlap with other pages.',
    impact: 'Search engines may filter out duplicate pages from results.',
    howToFix: 'Use canonical tags or differentiate the content.',
  },
  LOW_TEXT_HTML_RATIO: {
    code: 'LOW_TEXT_HTML_RATIO',
    severity: 'notice',
    category: 'content',
    title: 'Low text-to-HTML ratio',
    description: 'Text content is less than 10% of total HTML.',
    impact: 'May indicate poor content or bloated HTML.',
    howToFix: 'Add more text content or reduce unnecessary HTML/scripts.',
  },

  // ==================== LINKS ====================
  BROKEN_INTERNAL_LINK: {
    code: 'BROKEN_INTERNAL_LINK',
    severity: 'error',
    category: 'links',
    title: 'Broken internal link',
    description: 'Internal link points to a page that returns 4XX error.',
    impact: 'Poor user experience and wasted crawl budget.',
    howToFix: 'Fix the broken link or remove it.',
  },
  BROKEN_EXTERNAL_LINK: {
    code: 'BROKEN_EXTERNAL_LINK',
    severity: 'warning',
    category: 'links',
    title: 'Broken external link',
    description: 'External link points to a page that returns 4XX error.',
    impact: 'Poor user experience and potential trust issues.',
    howToFix: 'Update or remove the broken external link.',
  },
  JS_ONLY_NAVIGATION: {
    code: 'JS_ONLY_NAVIGATION',
    severity: 'warning',
    category: 'links',
    title: 'JavaScript-only navigation detected',
    description: 'Navigation elements use onClick handlers without proper <a href> links.',
    impact: 'Search engine crawlers cannot follow JavaScript-only navigation. These links are invisible to crawlers, preventing page discovery and indexing.',
    howToFix: 'Replace onClick navigation with proper <a href> or <Link> components. In React, use react-router Link instead of navigate() in onClick handlers. Ensure all navigation renders as real anchor tags with href attributes.',
  },
  TOO_MANY_LINKS: {
    code: 'TOO_MANY_LINKS',
    severity: 'notice',
    category: 'links',
    title: 'Too many on-page links',
    description: 'Page has more than 100 links.',
    impact: 'Dilutes PageRank passed to each linked page.',
    howToFix: 'Reduce the number of links to the most important ones.',
  },
  NOFOLLOW_INTERNAL: {
    code: 'NOFOLLOW_INTERNAL',
    severity: 'notice',
    category: 'links',
    title: 'Nofollow on internal link',
    description: 'Internal link has rel="nofollow" attribute.',
    impact: 'Prevents PageRank from flowing to important pages.',
    howToFix: 'Remove nofollow from internal links unless intentional.',
  },

  // ==================== IMAGES ====================
  IMG_ALT_MISSING: {
    code: 'IMG_ALT_MISSING',
    severity: 'warning',
    category: 'images',
    title: 'Image missing alt text',
    description: 'Image has no alt attribute.',
    impact: 'Poor accessibility and missed SEO opportunity.',
    howToFix: 'Add descriptive alt text to all images.',
  },
  IMG_ALT_EMPTY: {
    code: 'IMG_ALT_EMPTY',
    severity: 'notice',
    category: 'images',
    title: 'Image has empty alt text',
    description: 'Image has alt="" (empty alt attribute).',
    impact: 'Acceptable for decorative images but not for content images.',
    howToFix: 'Add descriptive alt text if the image conveys information.',
  },
  IMG_NO_DIMENSIONS: {
    code: 'IMG_NO_DIMENSIONS',
    severity: 'notice',
    category: 'images',
    title: 'Image missing dimensions',
    description: 'Image lacks width and height attributes.',
    impact: 'Causes layout shift (CLS) when image loads.',
    howToFix: 'Add width and height attributes to all images.',
  },
  IMG_TOO_LARGE: {
    code: 'IMG_TOO_LARGE',
    severity: 'warning',
    category: 'images',
    title: 'Image file too large',
    description: 'Image file size exceeds 200KB.',
    impact: 'Slows down page load time.',
    howToFix: 'Compress and optimize images. Consider WebP format.',
  },
  IMG_BROKEN: {
    code: 'IMG_BROKEN',
    severity: 'error',
    category: 'images',
    title: 'Broken image',
    description: 'Image URL returns 4XX error.',
    impact: 'Poor user experience with missing images.',
    howToFix: 'Fix the image URL or replace with a working image.',
  },

  // ==================== STRUCTURED DATA ====================
  SCHEMA_MISSING: {
    code: 'SCHEMA_MISSING',
    severity: 'warning',
    category: 'structured-data',
    title: 'No structured data found',
    description: 'Page has no JSON-LD or microdata.',
    impact: 'Missing opportunity for rich snippets in search results.',
    howToFix: 'Add appropriate Schema.org markup for your content type.',
  },
  SCHEMA_INVALID: {
    code: 'SCHEMA_INVALID',
    severity: 'error',
    category: 'structured-data',
    title: 'Invalid structured data',
    description: 'JSON-LD contains syntax errors.',
    impact: 'Search engines cannot parse the structured data.',
    howToFix: 'Fix JSON syntax errors and validate with Google Rich Results Test.',
  },
  SCHEMA_MISSING_REQUIRED: {
    code: 'SCHEMA_MISSING_REQUIRED',
    severity: 'warning',
    category: 'structured-data',
    title: 'Missing required schema properties',
    description: 'Schema markup is missing required properties.',
    impact: 'May not qualify for rich snippets.',
    howToFix: 'Add all required properties for the schema type.',
  },

  // ==================== PERFORMANCE ====================
  SLOW_PAGE: {
    code: 'SLOW_PAGE',
    severity: 'warning',
    category: 'performance',
    title: 'Slow page load time',
    description: 'Page takes more than 3 seconds to load.',
    impact: 'High bounce rates and potential ranking penalty.',
    howToFix: 'Optimize images, enable caching, minimize CSS/JS.',
  },
  SLOW_TTFB: {
    code: 'SLOW_TTFB',
    severity: 'warning',
    category: 'performance',
    title: 'Slow Time to First Byte (TTFB)',
    description: 'Server response time exceeds 600ms.',
    impact: 'Delays entire page load and affects Core Web Vitals.',
    howToFix: 'Optimize server configuration, use caching, consider CDN.',
  },
  LCP_POOR: {
    code: 'LCP_POOR',
    severity: 'error',
    category: 'performance',
    title: 'Poor Largest Contentful Paint (LCP)',
    description: 'LCP exceeds 2.5 seconds.',
    impact: 'Direct Core Web Vitals ranking factor.',
    howToFix: 'Optimize hero images, preload critical resources.',
  },
  CLS_POOR: {
    code: 'CLS_POOR',
    severity: 'error',
    category: 'performance',
    title: 'Poor Cumulative Layout Shift (CLS)',
    description: 'CLS exceeds 0.1.',
    impact: 'Direct Core Web Vitals ranking factor.',
    howToFix: 'Set image dimensions, avoid inserting content above existing content.',
  },
  HTML_TOO_LARGE: {
    code: 'HTML_TOO_LARGE',
    severity: 'warning',
    category: 'performance',
    title: 'HTML document too large',
    description: 'HTML size exceeds 100KB.',
    impact: 'Increases load time and memory usage.',
    howToFix: 'Reduce inline CSS/JS, remove unnecessary HTML.',
  },
  UNCOMPRESSED: {
    code: 'UNCOMPRESSED',
    severity: 'warning',
    category: 'performance',
    title: 'Uncompressed resources',
    description: 'Page is not served with gzip/brotli compression.',
    impact: 'Larger file transfer sizes slow down the page.',
    howToFix: 'Enable gzip or brotli compression on your server.',
  },
  NO_CACHE: {
    code: 'NO_CACHE',
    severity: 'notice',
    category: 'performance',
    title: 'Missing cache headers',
    description: 'Page lacks Cache-Control or Expires headers.',
    impact: 'Browser cannot cache resources, causing repeated downloads.',
    howToFix: 'Add appropriate cache headers for static resources.',
  },

  // ==================== SECURITY ====================
  NOT_HTTPS: {
    code: 'NOT_HTTPS',
    severity: 'error',
    category: 'security',
    title: 'Page not served over HTTPS',
    description: 'Page is accessible via HTTP instead of HTTPS.',
    impact: 'Browser warnings, user distrust, and ranking penalty.',
    howToFix: 'Install SSL certificate and redirect HTTP to HTTPS.',
  },
  MIXED_CONTENT: {
    code: 'MIXED_CONTENT',
    severity: 'error',
    category: 'security',
    title: 'Mixed content',
    description: 'HTTPS page loads resources over HTTP.',
    impact: 'Browser may block resources or show security warnings.',
    howToFix: 'Update all resource URLs to use HTTPS.',
  },
  CERT_EXPIRING: {
    code: 'CERT_EXPIRING',
    severity: 'warning',
    category: 'security',
    title: 'SSL certificate expiring soon',
    description: 'SSL certificate expires within 30 days.',
    impact: 'Site will become insecure when certificate expires.',
    howToFix: 'Renew your SSL certificate before expiration.',
  },
  HSTS_MISSING: {
    code: 'HSTS_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing HSTS header',
    description: 'Strict-Transport-Security header not set.',
    impact: 'Users may be vulnerable to downgrade attacks.',
    howToFix: 'Add HSTS header to enforce HTTPS.',
  },

  // ==================== MOBILE ====================
  VIEWPORT_MISSING: {
    code: 'VIEWPORT_MISSING',
    severity: 'error',
    category: 'mobile',
    title: 'Missing viewport meta tag',
    description: 'No viewport meta tag found.',
    impact: 'Page will not render properly on mobile devices.',
    howToFix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
  },
  VIEWPORT_NOT_RESPONSIVE: {
    code: 'VIEWPORT_NOT_RESPONSIVE',
    severity: 'warning',
    category: 'mobile',
    title: 'Non-responsive viewport',
    description: 'Viewport uses fixed width instead of device-width.',
    impact: 'Page may not adapt to different screen sizes.',
    howToFix: 'Use width=device-width in viewport meta tag.',
  },
  TAP_TARGETS_TOO_SMALL: {
    code: 'TAP_TARGETS_TOO_SMALL',
    severity: 'warning',
    category: 'mobile',
    title: 'Tap targets too small',
    description: 'Clickable elements are smaller than 48x48 pixels.',
    impact: 'Difficult for mobile users to tap links/buttons.',
    howToFix: 'Increase the size of tap targets to at least 48x48 pixels.',
  },

  // ==================== INTERNATIONAL ====================
  HREFLANG_MISSING: {
    code: 'HREFLANG_MISSING',
    severity: 'notice',
    category: 'international',
    title: 'Missing hreflang tags',
    description: 'Multi-language site without hreflang annotations.',
    impact: 'Search engines may show wrong language version to users.',
    howToFix: 'Add hreflang tags to specify language/region versions.',
  },
  HREFLANG_INVALID: {
    code: 'HREFLANG_INVALID',
    severity: 'warning',
    category: 'international',
    title: 'Invalid hreflang value',
    description: 'Hreflang contains invalid language or region code.',
    impact: 'Search engines will ignore the hreflang directive.',
    howToFix: 'Use valid ISO 639-1 language and ISO 3166-1 Alpha-2 region codes.',
  },
  HREFLANG_NO_RETURN: {
    code: 'HREFLANG_NO_RETURN',
    severity: 'warning',
    category: 'international',
    title: 'Missing hreflang return link',
    description: 'Hreflang page does not link back to this page.',
    impact: 'Hreflang signals may be ignored by search engines.',
    howToFix: 'Ensure all hreflang pages have reciprocal links.',
  },
  HREFLANG_SELF_MISSING: {
    code: 'HREFLANG_SELF_MISSING',
    severity: 'notice',
    category: 'international',
    title: 'Missing self-referencing hreflang',
    description: 'Page does not include hreflang pointing to itself.',
    impact: 'Best practice to include self-referencing hreflang.',
    howToFix: 'Add hreflang for the current page language/region.',
  },
  HREFLANG_X_DEFAULT_MISSING: {
    code: 'HREFLANG_X_DEFAULT_MISSING',
    severity: 'notice',
    category: 'international',
    title: 'Missing x-default hreflang',
    description: 'Multi-language page missing x-default fallback.',
    impact: 'Users with unsupported language may not see appropriate version.',
    howToFix: 'Add hreflang="x-default" pointing to your default language page.',
  },
  HREFLANG_TO_NON_200: {
    code: 'HREFLANG_TO_NON_200',
    severity: 'error',
    category: 'international',
    title: 'Hreflang points to non-200 page',
    description: 'Hreflang URL returns error or redirect.',
    impact: 'Search engines cannot serve the alternate language version.',
    howToFix: 'Update hreflang to point to valid, accessible URLs.',
  },

  // ==================== SOFT 404 ====================
  SOFT_404: {
    code: 'SOFT_404',
    severity: 'error',
    category: 'content',
    title: 'Soft 404 detected',
    description: 'Page returns 200 but appears to be an error page.',
    impact: 'Wastes crawl budget and may index low-value error pages.',
    howToFix: 'Return proper 404 status for error pages or add meaningful content.',
  },

  // ==================== OPEN GRAPH / SOCIAL ====================
  OG_TITLE_MISSING: {
    code: 'OG_TITLE_MISSING',
    severity: 'warning',
    category: 'on-page',
    title: 'Missing Open Graph title',
    description: 'No og:title meta tag found.',
    impact: 'Social shares may display incorrect or missing title.',
    howToFix: 'Add <meta property="og:title" content="Your Title">',
  },
  OG_DESCRIPTION_MISSING: {
    code: 'OG_DESCRIPTION_MISSING',
    severity: 'warning',
    category: 'on-page',
    title: 'Missing Open Graph description',
    description: 'No og:description meta tag found.',
    impact: 'Social shares may display incorrect or missing description.',
    howToFix: 'Add <meta property="og:description" content="Your description">',
  },
  OG_IMAGE_MISSING: {
    code: 'OG_IMAGE_MISSING',
    severity: 'warning',
    category: 'on-page',
    title: 'Missing Open Graph image',
    description: 'No og:image meta tag found.',
    impact: 'Social shares will not display a preview image.',
    howToFix: 'Add <meta property="og:image" content="https://yoursite.com/image.jpg">',
  },
  OG_IMAGE_TOO_SMALL: {
    code: 'OG_IMAGE_TOO_SMALL',
    severity: 'notice',
    category: 'on-page',
    title: 'Open Graph image too small',
    description: 'OG image should be at least 1200x630 pixels.',
    impact: 'Image may appear low quality on social platforms.',
    howToFix: 'Use an image at least 1200x630 pixels for optimal display.',
  },
  OG_URL_MISSING: {
    code: 'OG_URL_MISSING',
    severity: 'notice',
    category: 'on-page',
    title: 'Missing Open Graph URL',
    description: 'No og:url meta tag found.',
    impact: 'Social platforms may use inconsistent URL for shares.',
    howToFix: 'Add <meta property="og:url" content="https://yoursite.com/page">',
  },
  OG_TYPE_MISSING: {
    code: 'OG_TYPE_MISSING',
    severity: 'notice',
    category: 'on-page',
    title: 'Missing Open Graph type',
    description: 'No og:type meta tag found.',
    impact: 'Social platforms default to "website" type.',
    howToFix: 'Add <meta property="og:type" content="website"> (or article, product, etc.)',
  },
  TWITTER_CARD_MISSING: {
    code: 'TWITTER_CARD_MISSING',
    severity: 'notice',
    category: 'on-page',
    title: 'Missing Twitter Card tags',
    description: 'No twitter:card meta tag found.',
    impact: 'Twitter shares may not display optimally.',
    howToFix: 'Add <meta name="twitter:card" content="summary_large_image">',
  },
  TWITTER_IMAGE_MISSING: {
    code: 'TWITTER_IMAGE_MISSING',
    severity: 'notice',
    category: 'on-page',
    title: 'Missing Twitter Card image',
    description: 'No twitter:image meta tag found.',
    impact: 'Twitter shares will not display a preview image.',
    howToFix: 'Add <meta name="twitter:image" content="https://yoursite.com/image.jpg">',
  },

  // ==================== CANONICAL ADVANCED ====================
  CANONICAL_CHAIN: {
    code: 'CANONICAL_CHAIN',
    severity: 'warning',
    category: 'indexability',
    title: 'Canonical chain detected',
    description: 'Canonical URL points to a page with a different canonical.',
    impact: 'Creates confusion for search engines about the preferred URL.',
    howToFix: 'Update canonical to point directly to the final preferred URL.',
  },
  CANONICAL_CROSS_DOMAIN: {
    code: 'CANONICAL_CROSS_DOMAIN',
    severity: 'warning',
    category: 'indexability',
    title: 'Cross-domain canonical',
    description: 'Canonical points to a different domain.',
    impact: 'Transfers ranking signals to another domain. Ensure this is intentional.',
    howToFix: 'Verify cross-domain canonical is intentional or update to same domain.',
  },
  CANONICAL_MISMATCH_SITEMAP: {
    code: 'CANONICAL_MISMATCH_SITEMAP',
    severity: 'warning',
    category: 'indexability',
    title: 'Canonical URL not in sitemap',
    description: 'The canonical URL differs from the sitemap URL.',
    impact: 'Conflicting signals about which URL should be indexed.',
    howToFix: 'Ensure sitemap contains only canonical URLs.',
  },

  // ==================== ANCHOR TEXT ====================
  ANCHOR_TEXT_GENERIC: {
    code: 'ANCHOR_TEXT_GENERIC',
    severity: 'notice',
    category: 'links',
    title: 'Generic anchor text detected',
    description: 'Many internal links use generic text like "click here" or "read more".',
    impact: 'Misses opportunity to provide context to search engines.',
    howToFix: 'Use descriptive anchor text that indicates the target page content.',
  },
  ANCHOR_TEXT_OVER_OPTIMIZED: {
    code: 'ANCHOR_TEXT_OVER_OPTIMIZED',
    severity: 'warning',
    category: 'links',
    title: 'Over-optimized anchor text',
    description: 'Excessive exact-match keyword anchor text detected.',
    impact: 'May trigger spam filters and algorithmic penalties.',
    howToFix: 'Diversify anchor text with natural variations.',
  },
  ANCHOR_TEXT_EMPTY: {
    code: 'ANCHOR_TEXT_EMPTY',
    severity: 'warning',
    category: 'links',
    title: 'Empty anchor text',
    description: 'Link has no text content (empty anchor).',
    impact: 'Provides no context for users or search engines.',
    howToFix: 'Add descriptive text to the link or use aria-label for icon links.',
  },

  // ==================== PAGINATION ====================
  PAGINATION_NO_LINKS: {
    code: 'PAGINATION_NO_LINKS',
    severity: 'warning',
    category: 'crawlability',
    title: 'Pagination without HTML links',
    description: 'Paginated content uses JavaScript without HTML fallback links.',
    impact: 'Search engines cannot discover paginated content.',
    howToFix: 'Add <a href> links for pagination alongside JavaScript.',
  },
  PAGINATION_CANONICAL_ISSUE: {
    code: 'PAGINATION_CANONICAL_ISSUE',
    severity: 'error',
    category: 'indexability',
    title: 'Pagination canonical points to page 1',
    description: 'Paginated pages have canonical pointing to page 1.',
    impact: 'Paginated content may not be indexed properly.',
    howToFix: 'Each paginated page should self-reference or use View All canonical.',
  },
  INFINITE_SCROLL_NO_FALLBACK: {
    code: 'INFINITE_SCROLL_NO_FALLBACK',
    severity: 'warning',
    category: 'crawlability',
    title: 'Infinite scroll without fallback',
    description: 'Infinite scroll detected without pagination links.',
    impact: 'Search engines cannot access content loaded via infinite scroll.',
    howToFix: 'Implement replaceState/pushState and provide pagination links.',
  },

  // ==================== DUPLICATE/CANNIBALIZATION ====================
  NEAR_DUPLICATE: {
    code: 'NEAR_DUPLICATE',
    severity: 'warning',
    category: 'content',
    title: 'Near-duplicate content',
    description: 'Page has 90%+ content similarity with another page.',
    impact: 'May cause keyword cannibalization and dilute ranking signals.',
    howToFix: 'Consolidate pages, differentiate content, or use canonical tags.',
  },
  KEYWORD_CANNIBALIZATION: {
    code: 'KEYWORD_CANNIBALIZATION',
    severity: 'warning',
    category: 'content',
    title: 'Potential keyword cannibalization',
    description: 'Multiple pages target the same primary keyword.',
    impact: 'Pages compete against each other in search results.',
    howToFix: 'Consolidate pages or differentiate keyword targeting.',
  },

  // ==================== LINK ANALYSIS ADVANCED ====================
  LINK_DEPTH_TOO_DEEP: {
    code: 'LINK_DEPTH_TOO_DEEP',
    severity: 'warning',
    category: 'links',
    title: 'Page too deep in site structure',
    description: 'Page requires more than 3 clicks from homepage.',
    impact: 'Deep pages receive less link equity and may be crawled less frequently.',
    howToFix: 'Improve internal linking to reduce click depth.',
  },
  INTERNAL_REDIRECT: {
    code: 'INTERNAL_REDIRECT',
    severity: 'notice',
    category: 'links',
    title: 'Internal link to redirect',
    description: 'Internal link points to a URL that redirects.',
    impact: 'Wastes crawl budget and dilutes link equity.',
    howToFix: 'Update internal links to point directly to final URLs.',
  },

  // ==================== JAVASCRIPT SEO ====================
  JS_RENDERED_CONTENT: {
    code: 'JS_RENDERED_CONTENT',
    severity: 'notice',
    category: 'content',
    title: 'JavaScript-rendered content detected',
    description: 'Significant content only visible after JavaScript execution.',
    impact: 'Search engines may not see all content or delay indexing.',
    howToFix: 'Consider server-side rendering or prerendering for critical content.',
  },
  JS_LINKS_ONLY: {
    code: 'JS_LINKS_ONLY',
    severity: 'warning',
    category: 'links',
    title: 'Links only in JavaScript',
    description: 'Internal links exist only in rendered DOM, not in source HTML.',
    impact: 'Search engines may not discover these links.',
    howToFix: 'Ensure important links are in static HTML or use server-side rendering.',
  },

  // ==================== FAVICON & MISC ====================
  FAVICON_MISSING: {
    code: 'FAVICON_MISSING',
    severity: 'notice',
    category: 'on-page',
    title: 'Missing favicon',
    description: 'No favicon.ico or link rel="icon" found.',
    impact: 'Browser tabs show generic icon; poor brand presence.',
    howToFix: 'Add a favicon.ico or link rel="icon" to your pages.',
  },
  LANG_ATTR_MISSING: {
    code: 'LANG_ATTR_MISSING',
    severity: 'notice',
    category: 'on-page',
    title: 'Missing lang attribute',
    description: 'HTML tag lacks lang attribute.',
    impact: 'Accessibility issue; browsers/screen readers may use wrong language.',
    howToFix: 'Add lang attribute to HTML tag (e.g., <html lang="en">).',
  },

  // ==================== AI/LLM READINESS ====================
  LLMS_TXT_MISSING: {
    code: 'LLMS_TXT_MISSING',
    severity: 'notice',
    category: 'ai-readiness',
    title: 'Missing llms.txt file',
    description: 'No llms.txt file found at the root of the domain.',
    impact: 'AI crawlers like ChatGPT and Claude may not understand how to best use your content.',
    howToFix: 'Create an llms.txt file at your domain root with guidance for AI systems. See llmstxt.org for format.',
  },
  LLMS_TXT_INVALID: {
    code: 'LLMS_TXT_INVALID',
    severity: 'warning',
    category: 'ai-readiness',
    title: 'Invalid llms.txt format',
    description: 'The llms.txt file exists but has invalid format or syntax.',
    impact: 'AI crawlers may not be able to parse your AI guidance properly.',
    howToFix: 'Validate your llms.txt file format against the specification at llmstxt.org.',
  },
  AI_BOT_BLOCKED_ALL: {
    code: 'AI_BOT_BLOCKED_ALL',
    severity: 'notice',
    category: 'ai-readiness',
    title: 'All AI bots blocked in robots.txt',
    description: 'robots.txt blocks all major AI crawlers (GPTBot, Claude-Web, PerplexityBot, etc.).',
    impact: 'Your content will not appear in AI-powered search and assistants.',
    howToFix: 'Consider allowing some AI bots if you want visibility in AI-generated responses.',
  },
  AI_BOT_GPTBOT_BLOCKED: {
    code: 'AI_BOT_GPTBOT_BLOCKED',
    severity: 'notice',
    category: 'ai-readiness',
    title: 'GPTBot blocked in robots.txt',
    description: 'robots.txt blocks OpenAI\'s GPTBot crawler.',
    impact: 'Your content will not be used to train or cited by ChatGPT.',
    howToFix: 'Remove "User-agent: GPTBot Disallow: /" if you want ChatGPT visibility.',
  },
  AI_BOT_CLAUDEBOT_BLOCKED: {
    code: 'AI_BOT_CLAUDEBOT_BLOCKED',
    severity: 'notice',
    category: 'ai-readiness',
    title: 'ClaudeBot blocked in robots.txt',
    description: 'robots.txt blocks Anthropic\'s ClaudeBot crawler.',
    impact: 'Your content will not be used by Claude AI.',
    howToFix: 'Remove "User-agent: ClaudeBot Disallow: /" if you want Claude visibility.',
  },
  AI_BOT_PERPLEXITY_BLOCKED: {
    code: 'AI_BOT_PERPLEXITY_BLOCKED',
    severity: 'notice',
    category: 'ai-readiness',
    title: 'PerplexityBot blocked in robots.txt',
    description: 'robots.txt blocks Perplexity AI\'s crawler.',
    impact: 'Your content will not appear in Perplexity AI search results.',
    howToFix: 'Remove "User-agent: PerplexityBot Disallow: /" if you want Perplexity visibility.',
  },
  AI_BOT_GOOGLE_EXTENDED_BLOCKED: {
    code: 'AI_BOT_GOOGLE_EXTENDED_BLOCKED',
    severity: 'notice',
    category: 'ai-readiness',
    title: 'Google-Extended blocked in robots.txt',
    description: 'robots.txt blocks Google\'s AI training crawler (Google-Extended).',
    impact: 'Your content will not be used for Bard/Gemini AI training (regular search unaffected).',
    howToFix: 'Remove "User-agent: Google-Extended Disallow: /" if you want Google AI visibility.',
  },
  HIGH_JS_RENDERING_RATIO: {
    code: 'HIGH_JS_RENDERING_RATIO',
    severity: 'warning',
    category: 'ai-readiness',
    title: 'High JavaScript rendering required',
    description: 'More than 50% of page content requires JavaScript to render.',
    impact: 'AI crawlers may not see all content; they often use static HTML only.',
    howToFix: 'Implement server-side rendering or prerendering for critical content.',
  },

  // ==================== PIXEL-BASED META CHECKS ====================
  TITLE_TRUNCATED_SERP: {
    code: 'TITLE_TRUNCATED_SERP',
    severity: 'warning',
    category: 'on-page',
    title: 'Title will be truncated in SERP',
    description: 'Title exceeds 580 pixels and will be cut off in Google search results.',
    impact: 'Important information at the end of your title will not be visible.',
    howToFix: 'Shorten title to fit within 580 pixel width (approximately 50-60 characters).',
  },
  META_DESC_TRUNCATED_SERP: {
    code: 'META_DESC_TRUNCATED_SERP',
    severity: 'notice',
    category: 'on-page',
    title: 'Meta description will be truncated in SERP',
    description: 'Meta description exceeds 920 pixels on desktop.',
    impact: 'Your description may be cut off in search results.',
    howToFix: 'Shorten description to fit within 920 pixels (approximately 150-160 characters).',
  },

  // ==================== SOCIAL META TAGS (Enhanced) ====================
  TWITTER_TITLE_MISSING: {
    code: 'TWITTER_TITLE_MISSING',
    severity: 'notice',
    category: 'social',
    title: 'Missing Twitter Card title',
    description: 'No twitter:title meta tag found.',
    impact: 'Twitter/X shares will use og:title or page title as fallback.',
    howToFix: 'Add <meta name="twitter:title" content="Your Title">',
  },
  TWITTER_DESCRIPTION_MISSING: {
    code: 'TWITTER_DESCRIPTION_MISSING',
    severity: 'notice',
    category: 'social',
    title: 'Missing Twitter Card description',
    description: 'No twitter:description meta tag found.',
    impact: 'Twitter/X shares will use og:description or meta description as fallback.',
    howToFix: 'Add <meta name="twitter:description" content="Your description">',
  },
  OG_IMAGE_WRONG_DIMENSIONS: {
    code: 'OG_IMAGE_WRONG_DIMENSIONS',
    severity: 'notice',
    category: 'social',
    title: 'Open Graph image wrong aspect ratio',
    description: 'OG image is not the recommended 1.91:1 aspect ratio (1200x630).',
    impact: 'Image may be cropped awkwardly on social platforms.',
    howToFix: 'Use an image with 1200x630 pixels (1.91:1 aspect ratio).',
  },
  OG_IMAGE_TOO_LARGE: {
    code: 'OG_IMAGE_TOO_LARGE',
    severity: 'warning',
    category: 'social',
    title: 'Open Graph image file too large',
    description: 'OG image exceeds 5MB file size limit.',
    impact: 'Social platforms may not display the image.',
    howToFix: 'Compress the image to under 5MB while maintaining quality.',
  },
  SOCIAL_PROFILES_NOT_LINKED: {
    code: 'SOCIAL_PROFILES_NOT_LINKED',
    severity: 'notice',
    category: 'social',
    title: 'No social profile links found',
    description: 'Page has no links to social media profiles.',
    impact: 'Missed opportunity for social proof and brand presence.',
    howToFix: 'Add links to your social media profiles (Facebook, Twitter, LinkedIn, etc.).',
  },

  // ==================== LOCAL SEO ====================
  LOCAL_BUSINESS_SCHEMA_MISSING: {
    code: 'LOCAL_BUSINESS_SCHEMA_MISSING',
    severity: 'notice',
    category: 'local-seo',
    title: 'Missing LocalBusiness schema',
    description: 'No LocalBusiness structured data found.',
    impact: 'Local business information won\'t appear in Google\'s local knowledge panel.',
    howToFix: 'Add LocalBusiness schema with name, address, phone, and hours.',
  },
  ORGANIZATION_SCHEMA_MISSING: {
    code: 'ORGANIZATION_SCHEMA_MISSING',
    severity: 'notice',
    category: 'local-seo',
    title: 'Missing Organization schema',
    description: 'No Organization or Person structured data found.',
    impact: 'Search engines may not understand your brand identity.',
    howToFix: 'Add Organization schema with logo, contact info, and social profiles.',
  },
  NAP_INCONSISTENT: {
    code: 'NAP_INCONSISTENT',
    severity: 'warning',
    category: 'local-seo',
    title: 'Inconsistent NAP information',
    description: 'Name, Address, Phone detected in multiple formats on page.',
    impact: 'Inconsistent business info can hurt local search rankings.',
    howToFix: 'Use consistent NAP format across all pages and match your Google Business Profile.',
  },
  ADDRESS_NOT_DETECTED: {
    code: 'ADDRESS_NOT_DETECTED',
    severity: 'notice',
    category: 'local-seo',
    title: 'No business address detected',
    description: 'Could not find a physical address on this page.',
    impact: 'Local businesses should display their address for local SEO.',
    howToFix: 'Add your business address in a visible location and in LocalBusiness schema.',
  },
  PHONE_NOT_DETECTED: {
    code: 'PHONE_NOT_DETECTED',
    severity: 'notice',
    category: 'local-seo',
    title: 'No phone number detected',
    description: 'Could not find a phone number on this page.',
    impact: 'Contact information helps with local SEO and user trust.',
    howToFix: 'Add your phone number in visible location and in LocalBusiness schema.',
  },

  // ==================== SECURITY HEADERS ====================
  CSP_MISSING: {
    code: 'CSP_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing Content-Security-Policy header',
    description: 'No Content-Security-Policy (CSP) header found.',
    impact: 'Site is more vulnerable to XSS and code injection attacks.',
    howToFix: 'Add a Content-Security-Policy header to control which resources can be loaded.',
  },
  X_FRAME_OPTIONS_MISSING: {
    code: 'X_FRAME_OPTIONS_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing X-Frame-Options header',
    description: 'No X-Frame-Options header found.',
    impact: 'Site may be vulnerable to clickjacking attacks.',
    howToFix: 'Add X-Frame-Options: DENY or SAMEORIGIN header.',
  },
  X_CONTENT_TYPE_OPTIONS_MISSING: {
    code: 'X_CONTENT_TYPE_OPTIONS_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing X-Content-Type-Options header',
    description: 'No X-Content-Type-Options header found.',
    impact: 'Browser may MIME-sniff content types, potentially executing malicious files.',
    howToFix: 'Add X-Content-Type-Options: nosniff header.',
  },
  REFERRER_POLICY_MISSING: {
    code: 'REFERRER_POLICY_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing Referrer-Policy header',
    description: 'No Referrer-Policy header found.',
    impact: 'Browser may leak referrer information to third-party sites.',
    howToFix: 'Add Referrer-Policy: strict-origin-when-cross-origin header.',
  },
  PERMISSIONS_POLICY_MISSING: {
    code: 'PERMISSIONS_POLICY_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing Permissions-Policy header',
    description: 'No Permissions-Policy (formerly Feature-Policy) header found.',
    impact: 'Cannot control which browser features your site can use.',
    howToFix: 'Add Permissions-Policy header to control camera, microphone, geolocation, etc.',
  },

  // ==================== CONTENT FRESHNESS ====================
  CONTENT_STALE: {
    code: 'CONTENT_STALE',
    severity: 'notice',
    category: 'content',
    title: 'Content appears stale',
    description: 'Last-Modified header shows content over 1 year old.',
    impact: 'Search engines may prioritize fresher content in results.',
    howToFix: 'Update content regularly and ensure Last-Modified header is accurate.',
  },
  NO_LAST_MODIFIED: {
    code: 'NO_LAST_MODIFIED',
    severity: 'notice',
    category: 'content',
    title: 'No Last-Modified header',
    description: 'Server does not send Last-Modified header.',
    impact: 'Browsers and CDNs cannot efficiently cache content.',
    howToFix: 'Configure your server to send Last-Modified headers.',
  },
  OG_UPDATED_TIME_MISSING: {
    code: 'OG_UPDATED_TIME_MISSING',
    severity: 'notice',
    category: 'content',
    title: 'Missing article:modified_time',
    description: 'No article:modified_time Open Graph tag found.',
    impact: 'Social platforms may not show content update dates.',
    howToFix: 'Add <meta property="article:modified_time" content="2024-01-01T12:00:00Z">',
  },

  // ==================== PERFORMANCE (Enhanced) ====================
  RENDER_BLOCKING_RESOURCES: {
    code: 'RENDER_BLOCKING_RESOURCES',
    severity: 'warning',
    category: 'performance',
    title: 'Render-blocking resources detected',
    description: 'CSS or JavaScript files block initial page render.',
    impact: 'Delays First Contentful Paint and user perception of speed.',
    howToFix: 'Inline critical CSS, defer non-critical JS, or use async/defer attributes.',
  },
  DOM_SIZE_EXCESSIVE: {
    code: 'DOM_SIZE_EXCESSIVE',
    severity: 'warning',
    category: 'performance',
    title: 'Excessive DOM size',
    description: 'Page has more than 1500 DOM nodes.',
    impact: 'Large DOM increases memory usage and slows style calculations.',
    howToFix: 'Simplify page structure, lazy-load content, or paginate long lists.',
  },
  DOM_DEPTH_EXCESSIVE: {
    code: 'DOM_DEPTH_EXCESSIVE',
    severity: 'notice',
    category: 'performance',
    title: 'Excessive DOM depth',
    description: 'DOM tree is more than 32 levels deep.',
    impact: 'Deep nesting slows CSS selector matching and layout calculations.',
    howToFix: 'Flatten your HTML structure where possible.',
  },
  IMAGE_NOT_WEBP_AVIF: {
    code: 'IMAGE_NOT_WEBP_AVIF',
    severity: 'notice',
    category: 'images',
    title: 'Images not using modern formats',
    description: 'Images use JPEG/PNG instead of WebP/AVIF.',
    impact: 'Modern formats provide 25-50% smaller file sizes.',
    howToFix: 'Convert images to WebP or AVIF format with fallbacks.',
  },
  NO_CDN_DETECTED: {
    code: 'NO_CDN_DETECTED',
    severity: 'notice',
    category: 'performance',
    title: 'No CDN detected',
    description: 'Static resources are not served from a CDN.',
    impact: 'Users far from your server experience slower load times.',
    howToFix: 'Use a CDN like Cloudflare, Fastly, or AWS CloudFront.',
  },

  // ==================== TECHNOLOGY DETECTION ====================
  WORDPRESS_DETECTED: {
    code: 'WORDPRESS_DETECTED',
    severity: 'notice',
    category: 'on-page',
    title: 'WordPress detected',
    description: 'Site is built with WordPress CMS.',
    impact: 'Informational - WordPress powers 40% of the web.',
    howToFix: 'Ensure WordPress core, themes, and plugins are up to date.',
  },
  OUTDATED_JQUERY: {
    code: 'OUTDATED_JQUERY',
    severity: 'warning',
    category: 'security',
    title: 'Outdated jQuery version detected',
    description: 'Page uses a jQuery version with known vulnerabilities.',
    impact: 'Site may be vulnerable to security exploits.',
    howToFix: 'Update jQuery to the latest version (3.x or higher).',
  },
  OUTDATED_FRAMEWORK: {
    code: 'OUTDATED_FRAMEWORK',
    severity: 'warning',
    category: 'security',
    title: 'Outdated JavaScript framework detected',
    description: 'Page uses an outdated version of a JavaScript framework.',
    impact: 'May have security vulnerabilities or performance issues.',
    howToFix: 'Update to the latest stable version of the framework.',
  },

  // ==================== KEYWORD DENSITY ====================
  KEYWORD_STUFFING: {
    code: 'KEYWORD_STUFFING',
    severity: 'warning',
    category: 'content',
    title: 'Potential keyword stuffing detected',
    description: 'A keyword appears more than 3% of total word count.',
    impact: 'May trigger search engine spam filters.',
    howToFix: 'Write naturally and use keyword variations instead of repetition.',
  },
  NO_KEYWORDS_IN_TITLE: {
    code: 'NO_KEYWORDS_IN_TITLE',
    severity: 'warning',
    category: 'on-page',
    title: 'Top keywords not in title',
    description: 'Most common page keywords are not present in the title tag.',
    impact: 'Title may not accurately reflect page content for search engines.',
    howToFix: 'Include your primary keyword in the title tag.',
  },
  NO_KEYWORDS_IN_H1: {
    code: 'NO_KEYWORDS_IN_H1',
    severity: 'notice',
    category: 'on-page',
    title: 'Top keywords not in H1',
    description: 'Most common page keywords are not present in the H1 heading.',
    impact: 'H1 may not signal page topic effectively.',
    howToFix: 'Include your primary keyword in the H1 heading.',
  },

  // ==================== ADDITIONAL CHECKS ====================
  AMP_MISSING: {
    code: 'AMP_MISSING',
    severity: 'notice',
    category: 'mobile',
    title: 'No AMP version detected',
    description: 'Page does not have an Accelerated Mobile Page version.',
    impact: 'May load slower on mobile and miss Top Stories carousel eligibility.',
    howToFix: 'Consider implementing AMP for content-heavy pages.',
  },
  AMP_INVALID: {
    code: 'AMP_INVALID',
    severity: 'warning',
    category: 'mobile',
    title: 'Invalid AMP markup',
    description: 'AMP page contains validation errors.',
    impact: 'Invalid AMP pages may not be served from Google AMP cache.',
    howToFix: 'Validate and fix AMP errors using the AMP Validator.',
  },
  ADS_TXT_MISSING: {
    code: 'ADS_TXT_MISSING',
    severity: 'notice',
    category: 'crawlability',
    title: 'Missing ads.txt file',
    description: 'No ads.txt file found for ad inventory authorization.',
    impact: 'If running ads, unauthorized sellers may claim your inventory.',
    howToFix: 'Create an ads.txt file listing authorized ad sellers.',
  },
  ADS_TXT_INVALID: {
    code: 'ADS_TXT_INVALID',
    severity: 'warning',
    category: 'crawlability',
    title: 'Invalid ads.txt format',
    description: 'ads.txt file contains syntax errors.',
    impact: 'Ad platforms may not recognize your authorized sellers.',
    howToFix: 'Validate ads.txt format using IAB ads.txt validator.',
  },
  DMARC_MISSING: {
    code: 'DMARC_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing DMARC record',
    description: 'No DMARC DNS record found for email authentication.',
    impact: 'Emails from your domain may be spoofed or marked as spam.',
    howToFix: 'Add a DMARC record to your DNS: _dmarc.yourdomain.com TXT "v=DMARC1; p=none"',
  },
  SPF_MISSING: {
    code: 'SPF_MISSING',
    severity: 'notice',
    category: 'security',
    title: 'Missing SPF record',
    description: 'No SPF DNS record found for email authentication.',
    impact: 'Emails from your domain may be marked as spam.',
    howToFix: 'Add an SPF record to your DNS with authorized mail servers.',
  },
  SAFE_BROWSING_FLAGGED: {
    code: 'SAFE_BROWSING_FLAGGED',
    severity: 'error',
    category: 'security',
    title: 'Site flagged by Google Safe Browsing',
    description: 'Google has flagged this site for malware or phishing.',
    impact: 'Browsers will show warnings and traffic will plummet.',
    howToFix: 'Remove malware/phishing content and request review in Search Console.',
  },
  PLAINTEXT_EMAIL: {
    code: 'PLAINTEXT_EMAIL',
    severity: 'notice',
    category: 'security',
    title: 'Email addresses in plain text',
    description: 'Email addresses found in page HTML without obfuscation.',
    impact: 'Email addresses can be harvested by spam bots.',
    howToFix: 'Use contact forms or obfuscate emails (e.g., name[at]domain.com).',
  },
  DIRECTORY_LISTING_ENABLED: {
    code: 'DIRECTORY_LISTING_ENABLED',
    severity: 'warning',
    category: 'security',
    title: 'Directory listing enabled',
    description: 'Web server is configured to list directory contents.',
    impact: 'Exposes file structure and potentially sensitive files.',
    howToFix: 'Disable directory listing in your web server configuration.',
  },
  FAVICON_NOT_ICO: {
    code: 'FAVICON_NOT_ICO',
    severity: 'notice',
    category: 'on-page',
    title: 'Favicon not in ICO format',
    description: 'Favicon is not in the traditional .ico format.',
    impact: 'Some older browsers may not display the favicon.',
    howToFix: 'Provide favicon.ico at site root in addition to PNG/SVG versions.',
  },
  APPLE_TOUCH_ICON_MISSING: {
    code: 'APPLE_TOUCH_ICON_MISSING',
    severity: 'notice',
    category: 'mobile',
    title: 'Missing Apple Touch Icon',
    description: 'No apple-touch-icon link found.',
    impact: 'iOS users adding site to home screen will see a generic icon.',
    howToFix: 'Add <link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  },

  // ==================== ADVANCED SEO CHECKS ====================

  // Featured Snippet Optimization
  FAQ_SCHEMA_MISSING: {
    code: 'FAQ_SCHEMA_MISSING',
    severity: 'warning',
    category: 'structured-data',
    title: 'FAQ content without FAQPage schema',
    description: 'Question-format headings found but no FAQPage schema markup.',
    impact: 'Missing out on FAQ rich results and PAA box opportunities.',
    howToFix: 'Add FAQPage structured data for your Q&A content.',
  },
  INVERTED_PYRAMID_MISSING: {
    code: 'INVERTED_PYRAMID_MISSING',
    severity: 'notice',
    category: 'content',
    title: 'Content not structured for featured snippets',
    description: 'First paragraph does not contain a direct answer or summary.',
    impact: 'Featured snippets pull from early content; burying answers reduces snippet capture rate.',
    howToFix: 'Start with a concise answer (40-80 words) that directly addresses the page topic.',
  },
  NO_SNIPPET_BAIT_HEADERS: {
    code: 'NO_SNIPPET_BAIT_HEADERS',
    severity: 'notice',
    category: 'on-page',
    title: 'No snippet-targeting headers found',
    description: 'Headings do not use patterns that commonly trigger featured snippets.',
    impact: 'Missing opportunities for high-visibility snippet placements.',
    howToFix: 'Use headers like "What is [topic]?", "How to [action]", or "X Ways to [achieve goal]".',
  },

  // Internal Link Graph
  NO_CONTEXTUAL_INTERNAL_LINKS: {
    code: 'NO_CONTEXTUAL_INTERNAL_LINKS',
    severity: 'warning',
    category: 'links',
    title: 'No contextual internal links',
    description: 'All internal links are in navigation/footer. No editorial links in content.',
    impact: 'Editorial links in content pass more SEO value than navigational links.',
    howToFix: 'Add relevant internal links within your main content to related pages.',
  },
  LOW_EDITORIAL_LINKS: {
    code: 'LOW_EDITORIAL_LINKS',
    severity: 'notice',
    category: 'links',
    title: 'Few editorial internal links',
    description: 'Only a few editorial (in-content) internal links found.',
    impact: 'Editorial links with surrounding context provide stronger topical signals.',
    howToFix: 'Add 2-5 relevant internal links within your body content.',
  },
  FIRST_LINK_GENERIC_ANCHOR: {
    code: 'FIRST_LINK_GENERIC_ANCHOR',
    severity: 'notice',
    category: 'links',
    title: 'First link uses generic anchor text',
    description: 'First link to a page uses generic anchor like "click here" or "read more".',
    impact: 'Google may prioritize first link anchor for topic signals.',
    howToFix: 'Use descriptive, keyword-relevant anchor text for internal links.',
  },
  TOO_MANY_INTERNAL_LINKS: {
    code: 'TOO_MANY_INTERNAL_LINKS',
    severity: 'warning',
    category: 'links',
    title: 'Excessive internal links',
    description: 'Page has over 100 internal links, which may dilute PageRank distribution.',
    impact: 'Too many links reduce the value passed to each linked page.',
    howToFix: 'Reduce internal links to the most important and relevant pages.',
  },
  NO_INTERNAL_LINKS: {
    code: 'NO_INTERNAL_LINKS',
    severity: 'error',
    category: 'links',
    title: 'No internal links found',
    description: 'Page has no internal links to other pages on the site.',
    impact: 'Creates a dead end for users and search engine crawlers.',
    howToFix: 'Add relevant internal links to related content.',
  },

  // Resource Hints
  MISSING_PRECONNECT: {
    code: 'MISSING_PRECONNECT',
    severity: 'warning',
    category: 'performance',
    title: 'Missing preconnect hints for third-party origins',
    description: 'Third-party origins used without preconnect hints.',
    impact: 'Connection setup to third-party origins adds latency to resource loading.',
    howToFix: 'Add preconnect hints for critical third-party origins.',
  },
  GOOGLE_FONTS_NO_PRECONNECT: {
    code: 'GOOGLE_FONTS_NO_PRECONNECT',
    severity: 'warning',
    category: 'performance',
    title: 'Google Fonts without preconnect',
    description: 'Google Fonts are used but preconnect hints are missing.',
    impact: 'Adds significant latency to font loading, affecting LCP.',
    howToFix: 'Add preconnect hints for fonts.googleapis.com and fonts.gstatic.com.',
  },
  HERO_IMAGE_NOT_PRELOADED: {
    code: 'HERO_IMAGE_NOT_PRELOADED',
    severity: 'notice',
    category: 'performance',
    title: 'Hero image not preloaded',
    description: 'Page has images but none are preloaded for faster LCP.',
    impact: 'Preloading LCP images can improve Largest Contentful Paint.',
    howToFix: 'Add <link rel="preload" href="hero-image.jpg" as="image"> for your LCP image.',
  },
  NO_CRITICAL_RESOURCE_PRELOAD: {
    code: 'NO_CRITICAL_RESOURCE_PRELOAD',
    severity: 'notice',
    category: 'performance',
    title: 'No critical resources preloaded',
    description: 'Page has render-blocking resources but no preload hints.',
    impact: 'Preloading critical resources can improve initial render time.',
    howToFix: 'Consider preloading critical CSS, fonts, or hero images.',
  },
  EXCESSIVE_PRELOADS: {
    code: 'EXCESSIVE_PRELOADS',
    severity: 'warning',
    category: 'performance',
    title: 'Too many preload hints',
    description: 'Page has more than 10 preload hints.',
    impact: 'Preloading too many resources competes for bandwidth and can delay critical resources.',
    howToFix: 'Limit preloads to truly critical resources (2-5 maximum).',
  },
  ES_MODULES_NO_MODULEPRELOAD: {
    code: 'ES_MODULES_NO_MODULEPRELOAD',
    severity: 'notice',
    category: 'performance',
    title: 'ES modules without modulepreload',
    description: 'Page uses ES modules but no modulepreload hints are present.',
    impact: 'Modulepreload can parallelize module loading for faster execution.',
    howToFix: 'Add <link rel="modulepreload" href="critical-module.js"> for critical modules.',
  },

  // E-E-A-T Signals
  YMYL_NO_AUTHOR: {
    code: 'YMYL_NO_AUTHOR',
    severity: 'warning',
    category: 'content',
    title: 'YMYL content without author information',
    description: 'This appears to be YMYL (Your Money Your Life) content but has no visible author.',
    impact: 'Google prioritizes E-E-A-T signals heavily for YMYL topics.',
    howToFix: 'Add author byline with credentials, bio, and author schema.',
  },
  YMYL_NO_EXPERTISE: {
    code: 'YMYL_NO_EXPERTISE',
    severity: 'warning',
    category: 'content',
    title: 'YMYL content without expertise signals',
    description: 'YMYL content lacks visible expertise indicators (credentials, qualifications).',
    impact: 'Expertise is crucial for YMYL content ranking.',
    howToFix: 'Include author credentials, "reviewed by" statements, or cite expert sources.',
  },
  YMYL_NO_CITATIONS: {
    code: 'YMYL_NO_CITATIONS',
    severity: 'warning',
    category: 'content',
    title: 'YMYL content without authoritative citations',
    description: 'YMYL content has no links to authoritative sources (.gov, .edu, etc.).',
    impact: 'Citing authoritative sources builds trust for sensitive topics.',
    howToFix: 'Add citations to government, academic, or recognized industry sources.',
  },
  NO_ENTITY_IDENTIFIED: {
    code: 'NO_ENTITY_IDENTIFIED',
    severity: 'notice',
    category: 'content',
    title: 'No author or organization identified',
    description: 'Page lacks clear attribution to an author or organization.',
    impact: 'Anonymous content may be seen as less trustworthy.',
    howToFix: 'Add author byline or organization information with structured data.',
  },
  NO_ORGANIZATION_SCHEMA: {
    code: 'NO_ORGANIZATION_SCHEMA',
    severity: 'notice',
    category: 'structured-data',
    title: 'Missing Organization schema',
    description: 'No Organization structured data found.',
    impact: 'Missed opportunity to establish organizational identity for E-E-A-T.',
    howToFix: 'Add Organization schema with name, logo, contact, and social profiles.',
  },
  AUTHOR_NO_SCHEMA: {
    code: 'AUTHOR_NO_SCHEMA',
    severity: 'notice',
    category: 'structured-data',
    title: 'Author without Person schema',
    description: 'Author name is present but no Person structured data.',
    impact: 'Person schema helps Google understand author entity relationships.',
    howToFix: 'Add Person schema with sameAs links to author profiles.',
  },
  NO_MODIFIED_DATE: {
    code: 'NO_MODIFIED_DATE',
    severity: 'notice',
    category: 'content',
    title: 'No content modification date',
    description: 'Content has published date but no last-modified date.',
    impact: 'Modified dates signal content freshness to search engines.',
    howToFix: 'Add article:modified_time meta tag or dateModified in schema.',
  },
  NO_EXPERIENCE_SIGNALS: {
    code: 'NO_EXPERIENCE_SIGNALS',
    severity: 'notice',
    category: 'content',
    title: 'No first-hand experience signals detected',
    description: 'Content lacks indicators of personal/first-hand experience.',
    impact: 'The "Experience" in E-E-A-T values authentic, first-hand knowledge.',
    howToFix: 'Add personal insights, original photos, or hands-on testing details.',
  },

  // IndexNow
  INDEXNOW_NOT_IMPLEMENTED: {
    code: 'INDEXNOW_NOT_IMPLEMENTED',
    severity: 'notice',
    category: 'crawlability',
    title: 'IndexNow not implemented',
    description: 'Site does not appear to have IndexNow instant indexing set up.',
    impact: 'Content changes may take longer to appear in Bing, Yandex, and other search engines.',
    howToFix: 'Create a key at indexnow.org and implement the IndexNow protocol.',
  },
  INDEXNOW_INVALID_KEY: {
    code: 'INDEXNOW_INVALID_KEY',
    severity: 'warning',
    category: 'crawlability',
    title: 'IndexNow key format invalid',
    description: 'The IndexNow key does not match expected formats.',
    impact: 'IndexNow submissions may fail with invalid key format.',
    howToFix: 'Use a valid key format: 32-character hex or UUID format.',
  },

  // Content Science (Novel Checks)
  ZIPF_KEYWORD_STUFFING: {
    code: 'ZIPF_KEYWORD_STUFFING',
    severity: 'warning',
    category: 'content',
    title: 'Unnatural keyword distribution detected',
    description: 'Content deviates from natural language patterns (Zipf\'s law). Possible keyword stuffing.',
    impact: 'Search engines can detect unnatural text patterns, potentially triggering spam filters.',
    howToFix: 'Reduce repetition of over-used keywords and use more natural language.',
  },
  LOW_CONTENT_ENTROPY: {
    code: 'LOW_CONTENT_ENTROPY',
    severity: 'warning',
    category: 'content',
    title: 'Low vocabulary diversity (thin content signal)',
    description: 'Content entropy is low, indicating repetitive or thin content.',
    impact: 'Low diversity content may be seen as low-quality by search engines.',
    howToFix: 'Expand vocabulary, add more unique insights, and reduce repetitive phrases.',
  },
  HIGH_CONTENT_REPETITION: {
    code: 'HIGH_CONTENT_REPETITION',
    severity: 'notice',
    category: 'content',
    title: 'High content repetition detected',
    description: 'Content shows high repetition pattern.',
    impact: 'Highly repetitive content provides less value and may hurt engagement.',
    howToFix: 'Vary your vocabulary and sentence structures. Avoid repeating the same phrases.',
  },
  BM25_KEYWORD_MISSING: {
    code: 'BM25_KEYWORD_MISSING',
    severity: 'warning',
    category: 'on-page',
    title: 'Target keyword not found',
    description: 'A target keyword is not present in your content at all.',
    impact: 'Page unlikely to rank for this keyword without any mention of it.',
    howToFix: 'Add natural mentions of the target keyword in your content.',
  },
  BM25_KEYWORD_SATURATED: {
    code: 'BM25_KEYWORD_SATURATED',
    severity: 'notice',
    category: 'on-page',
    title: 'Keyword over-optimized',
    description: 'Keyword found many times. Additional mentions provide diminishing returns.',
    impact: 'Over-optimization can trigger spam signals.',
    howToFix: 'Use semantic variations and related terms instead of exact repetition.',
  },

  // Site Maturity
  NEW_SITE_STRATEGY: {
    code: 'NEW_SITE_STRATEGY',
    severity: 'notice',
    category: 'content',
    title: 'New website detected - Authority-first strategy recommended',
    description: 'Your site appears to be new (<90 days). Standard SEO advice won\'t work well.',
    impact: 'Creating lots of content without authority is wasted effort.',
    howToFix: 'Focus on building 10+ quality backlinks to ONE great page before expanding content.',
  },
  CONTENT_AUTHORITY_IMBALANCE: {
    code: 'CONTENT_AUTHORITY_IMBALANCE',
    severity: 'warning',
    category: 'content',
    title: 'Content-to-authority imbalance',
    description: 'Site has many pages but limited backlink signals. Content is unlikely to rank.',
    impact: 'Most of your content may be invisible to search engines due to low domain authority.',
    howToFix: 'Stop publishing new content. Focus 100% on link building until you see ranking improvements.',
  },
  GROWING_SITE_NO_BLOG: {
    code: 'GROWING_SITE_NO_BLOG',
    severity: 'notice',
    category: 'content',
    title: 'Growing site without blog/content hub',
    description: 'Site is in growth phase but lacks a blog or content section.',
    impact: 'Blog content is essential for attracting backlinks and building topical authority.',
    howToFix: 'Create a blog section with linkable content assets (guides, research, tools).',
  },

  // Keyword Cannibalization
  INTERNAL_CANNIBALIZATION_SIGNAL: {
    code: 'INTERNAL_CANNIBALIZATION_SIGNAL',
    severity: 'warning',
    category: 'content',
    title: 'Duplicate H1 tags on page',
    description: 'Page has multiple H1 tags with duplicates, which can dilute keyword focus.',
    impact: 'Multiple similar H1s can confuse search engines about page topic.',
    howToFix: 'Use a single, unique H1 that clearly defines the page topic.',
  },
  TITLE_H1_KEYWORD_MISMATCH: {
    code: 'TITLE_H1_KEYWORD_MISMATCH',
    severity: 'warning',
    category: 'on-page',
    title: 'Title and H1 target different keywords',
    description: 'The title tag and H1 heading have no overlapping keywords.',
    impact: 'Search engines may be confused about the primary topic of the page.',
    howToFix: 'Align title and H1 to target the same primary keyword or topic.',
  },

  // ==================== ASSET MINIFICATION ====================
  CSS_NOT_MINIFIED: {
    code: 'CSS_NOT_MINIFIED',
    severity: 'warning',
    category: 'performance',
    title: 'CSS files not minified',
    description: 'CSS files contain unnecessary whitespace, comments, or unoptimized code.',
    impact: 'Unminified CSS increases file size and page load time.',
    howToFix: 'Use a CSS minifier (cssnano, clean-css) or ensure build tools minify CSS in production.',
  },
  JS_NOT_MINIFIED: {
    code: 'JS_NOT_MINIFIED',
    severity: 'warning',
    category: 'performance',
    title: 'JavaScript files not minified',
    description: 'JavaScript files contain unnecessary whitespace, comments, or long variable names.',
    impact: 'Unminified JavaScript increases file size, parse time, and page load time.',
    howToFix: 'Use a JS minifier (Terser, UglifyJS) or ensure build tools minify JS in production.',
  },

  // ==================== PAGE RESOURCES ====================
  PAGE_RESOURCES_EXCESSIVE: {
    code: 'PAGE_RESOURCES_EXCESSIVE',
    severity: 'error',
    category: 'performance',
    title: 'Excessive number of page resources',
    description: 'Page makes over 100 HTTP requests for resources.',
    impact: 'Too many HTTP requests cause slow page loads due to connection overhead and browser limits.',
    howToFix: 'Combine CSS/JS files, use image sprites, lazy-load resources, remove unused dependencies.',
  },
  PAGE_RESOURCES_HIGH: {
    code: 'PAGE_RESOURCES_HIGH',
    severity: 'warning',
    category: 'performance',
    title: 'High number of page resources',
    description: 'Page makes over 50 HTTP requests for resources.',
    impact: 'Many HTTP requests increase page load time, especially on mobile networks.',
    howToFix: 'Bundle CSS/JS files, lazy-load images below the fold, consider critical CSS inlining.',
  },
  PAGE_RESOURCES_THIRD_PARTY_HIGH: {
    code: 'PAGE_RESOURCES_THIRD_PARTY_HIGH',
    severity: 'warning',
    category: 'performance',
    title: 'Many third-party resources',
    description: 'Page loads many resources from third-party domains.',
    impact: 'Third-party resources add latency and are outside your control.',
    howToFix: 'Self-host critical third-party resources when possible. Use preconnect hints for remaining.',
  },
  PAGE_RESOURCES_MANY_IFRAMES: {
    code: 'PAGE_RESOURCES_MANY_IFRAMES',
    severity: 'warning',
    category: 'performance',
    title: 'Multiple iframes detected',
    description: 'Page contains multiple iframes, each loading its own document.',
    impact: 'Iframes significantly increase page weight and can block the main thread.',
    howToFix: 'Lazy-load iframes below the fold. Consider native embeds or facade patterns.',
  },

  // ==================== RESPONSIVE CSS ====================
  RESPONSIVE_NO_VIEWPORT: {
    code: 'RESPONSIVE_NO_VIEWPORT',
    severity: 'error',
    category: 'mobile',
    title: 'Missing viewport meta tag',
    description: 'No viewport meta tag found for responsive design.',
    impact: 'Without viewport meta, mobile browsers render at desktop width and scale down.',
    howToFix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.',
  },
  RESPONSIVE_NO_MEDIA_QUERIES: {
    code: 'RESPONSIVE_NO_MEDIA_QUERIES',
    severity: 'warning',
    category: 'mobile',
    title: 'No CSS media queries detected',
    description: 'No @media queries found in stylesheets.',
    impact: 'Without media queries, the site uses fixed layouts that do not adapt to screen sizes.',
    howToFix: 'Add CSS media queries for different screen sizes. Use mobile-first approach.',
  },
  RESPONSIVE_NO_MOBILE_BREAKPOINT: {
    code: 'RESPONSIVE_NO_MOBILE_BREAKPOINT',
    severity: 'warning',
    category: 'mobile',
    title: 'No mobile breakpoints detected',
    description: 'Media queries exist but none target mobile screen sizes.',
    impact: 'Site may not be optimized for mobile devices, hurting majority of traffic.',
    howToFix: 'Add media queries for mobile: @media (max-width: 768px) { ... }',
  },

  // ==================== LINKS RATIO ====================
  LINKS_NO_INTERNAL: {
    code: 'LINKS_NO_INTERNAL',
    severity: 'warning',
    category: 'links',
    title: 'No internal links found',
    description: 'Page has no internal links to other pages on the site.',
    impact: 'Internal links help search engines discover pages and distribute link equity.',
    howToFix: 'Add relevant internal links to related content or navigation.',
  },
  LINKS_NO_EXTERNAL: {
    code: 'LINKS_NO_EXTERNAL',
    severity: 'notice',
    category: 'links',
    title: 'No external links found',
    description: 'Page has no links to external websites.',
    impact: 'Linking to authoritative sources improves credibility and content context.',
    howToFix: 'Add links to high-quality external sources that support your content.',
  },
  LINKS_RATIO_POOR: {
    code: 'LINKS_RATIO_POOR',
    severity: 'warning',
    category: 'links',
    title: 'Poor internal-to-external link ratio',
    description: 'Page has more external links than internal links.',
    impact: 'Too many external links can dilute page authority and may look spammy.',
    howToFix: 'Add more internal links. Aim for at least 2 internal links per external link.',
  },

  // ==================== URL SAFETY (Local Hash Database) ====================
  URL_SAFETY_KNOWN_THREAT: {
    code: 'URL_SAFETY_KNOWN_THREAT',
    severity: 'error',
    category: 'security',
    title: 'Website URL matches known threat database',
    description: 'Your website URL matches entries in the local threat database.',
    impact: 'Browsers and security tools may block access to your site. Search engines may remove you from results.',
    howToFix: 'Scan your site for malware, remove any malicious content, and request removal from threat databases.',
  },
  URL_SAFETY_EXTERNAL_THREAT: {
    code: 'URL_SAFETY_EXTERNAL_THREAT',
    severity: 'error',
    category: 'security',
    title: 'External links to known malicious URLs',
    description: 'External links point to URLs flagged in threat databases.',
    impact: 'Linking to malicious sites harms visitors and damages your reputation and rankings.',
    howToFix: 'Remove all links to flagged URLs immediately.',
  },
  URL_SAFETY_SUSPICIOUS_DOMAIN: {
    code: 'URL_SAFETY_SUSPICIOUS_DOMAIN',
    severity: 'warning',
    category: 'security',
    title: 'Website URL has suspicious characteristics',
    description: 'Your URL shows patterns commonly associated with phishing or malicious sites.',
    impact: 'Users and security tools may distrust your site.',
    howToFix: 'Use a trustworthy domain structure. Avoid patterns that mimic other brands or use suspicious TLDs.',
  },
  URL_SAFETY_SUSPICIOUS_EXTERNAL: {
    code: 'URL_SAFETY_SUSPICIOUS_EXTERNAL',
    severity: 'warning',
    category: 'security',
    title: 'External links with suspicious characteristics',
    description: 'External links show patterns associated with phishing or malicious sites.',
    impact: 'Linking to suspicious sites can harm visitors and rankings.',
    howToFix: 'Review and remove or replace suspicious external links.',
  },
  URL_SAFETY_SHORTENERS: {
    code: 'URL_SAFETY_SHORTENERS',
    severity: 'notice',
    category: 'security',
    title: 'External links use URL shorteners',
    description: 'External links use URL shorteners, hiding the actual destination.',
    impact: 'URL shorteners reduce trust and SEO link value.',
    howToFix: 'Replace shortened URLs with direct links to the destination.',
  },

  // ==================== FRAMEWORK-SPECIFIC SEO ====================
  REACT_CSR_DETECTED: {
    code: 'REACT_CSR_DETECTED',
    severity: 'error',
    category: 'framework',
    title: 'Client-side rendered React app detected',
    description: 'React apps without SSR send empty HTML to crawlers. Search engines may not index your content.',
    impact: 'Critical - your content is likely invisible to Google.',
    howToFix: 'Migrate to Next.js for automatic SSR/SSG, add prerendering with react-snap, or use react-helmet-async with a prerender service.',
  },
  NEXTJS_NO_METADATA_API: {
    code: 'NEXTJS_NO_METADATA_API',
    severity: 'warning',
    category: 'framework',
    title: 'Not using Next.js Metadata API',
    description: 'Next.js 13+ has a built-in Metadata API that is more reliable than third-party solutions.',
    impact: 'Missing out on Next.js optimized SEO features.',
    howToFix: 'Use export const metadata or generateMetadata in your page/layout files.',
  },
  VUE_CSR_DETECTED: {
    code: 'VUE_CSR_DETECTED',
    severity: 'error',
    category: 'framework',
    title: 'Client-side rendered Vue app detected',
    description: 'Vue apps without SSR send empty HTML to crawlers.',
    impact: 'Your content may not be indexed by search engines.',
    howToFix: 'Migrate to Nuxt for automatic SSR/SSG, or add SSR with @vue/server-renderer.',
  },
  ANGULAR_NO_UNIVERSAL: {
    code: 'ANGULAR_NO_UNIVERSAL',
    severity: 'error',
    category: 'framework',
    title: 'Angular app without Universal (SSR)',
    description: 'Client-side Angular apps send empty HTML to crawlers.',
    impact: 'Your content may not be indexed by search engines.',
    howToFix: 'Add Angular Universal for SSR: ng add @angular/ssr',
  },
  WORDPRESS_NO_SEO_PLUGIN: {
    code: 'WORDPRESS_NO_SEO_PLUGIN',
    severity: 'warning',
    category: 'framework',
    title: 'No SEO plugin detected',
    description: 'WordPress benefits greatly from an SEO plugin like Yoast or Rank Math.',
    impact: 'Missing automated SEO features like sitemaps, schema, and meta tag management.',
    howToFix: 'Install Yoast SEO or Rank Math plugin.',
  },
  WORDPRESS_NO_CACHING: {
    code: 'WORDPRESS_NO_CACHING',
    severity: 'warning',
    category: 'framework',
    title: 'No caching plugin detected',
    description: 'WordPress without caching is slow, hurting Core Web Vitals.',
    impact: 'Poor performance affects user experience and rankings.',
    howToFix: 'Install WP Super Cache, W3 Total Cache, or LiteSpeed Cache.',
  },
  SPA_EMPTY_BODY: {
    code: 'SPA_EMPTY_BODY',
    severity: 'error',
    category: 'framework',
    title: 'Single Page App with empty body',
    description: 'Page body contains minimal content, suggesting client-side rendering without SSR.',
    impact: 'Search engines see an empty page and cannot index your content.',
    howToFix: 'Implement server-side rendering, static site generation, or prerendering.',
  },
  FRAMEWORK_OUTDATED: {
    code: 'FRAMEWORK_OUTDATED',
    severity: 'warning',
    category: 'framework',
    title: 'Outdated framework version detected',
    description: 'Running an outdated version of your framework may have security vulnerabilities and SEO bugs.',
    impact: 'Potential security issues and missing SEO improvements.',
    howToFix: 'Update to the latest stable version of your framework.',
  },
};
