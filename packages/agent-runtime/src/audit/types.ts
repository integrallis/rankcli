// Comprehensive SEO Audit Types - Matching Ahrefs 170+ checks

export type IssueSeverity = 'error' | 'warning' | 'notice';

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
  | 'international';

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
};
