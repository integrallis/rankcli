/**
 * Fix generators for SEO issues
 *
 * These modules generate framework-specific code to fix SEO issues
 * detected during audits.
 */

import type { AuditReport, SEOIssue } from '../types.js';

export * from './social-meta-fixes.js';

export interface FixFile {
  path: string;
  content: string;
}

export interface FixResult {
  category: string;
  issues: string[];
  files: FixFile[];
}

/**
 * Groups issues by category
 */
function groupIssuesByCategory(issues: SEOIssue[]): Map<string, SEOIssue[]> {
  const grouped = new Map<string, SEOIssue[]>();
  for (const issue of issues) {
    const existing = grouped.get(issue.category) || [];
    existing.push(issue);
    grouped.set(issue.category, existing);
  }
  return grouped;
}

/**
 * Generates fixes for on-page issues (titles, meta descriptions, headings)
 */
function generateOnPageFixes(issues: SEOIssue[]): FixResult | null {
  if (issues.length === 0) return null;

  const issueCodes = issues.map((i) => i.code);
  const files: FixFile[] = [];

  // Generate appropriate fixes based on detected issues
  if (issueCodes.includes('TITLE_MISSING') || issueCodes.includes('META_DESC_MISSING')) {
    files.push({
      path: 'index.html',
      content: `<head>
  <title>Site Title - Your tagline here</title>
  <meta name="description" content="A compelling description of your site in 150-160 characters." />
</head>`,
    });
  }

  if (files.length === 0) return null;

  return {
    category: 'on-page',
    issues: issueCodes,
    files,
  };
}

/**
 * Generates fixes for social meta issues (Open Graph, Twitter Cards)
 */
function generateSocialMetaFixes(issues: SEOIssue[]): FixResult | null {
  if (issues.length === 0) return null;

  const issueCodes = issues.map((i) => i.code);
  const files: FixFile[] = [];

  // Generate OG tags
  if (issueCodes.some((c) => c.startsWith('OG_'))) {
    files.push({
      path: 'index.html',
      content: `<meta property="og:title" content="Site Title" />
<meta property="og:description" content="Site description" />
<meta property="og:image" content="https://example.com/og-image.png" />
<meta property="og:url" content="https://example.com" />
<meta property="og:type" content="website" />`,
    });
  }

  // Generate Twitter Card tags
  if (issueCodes.some((c) => c.startsWith('TWITTER_'))) {
    files.push({
      path: 'index.html',
      content: `<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Site Title" />
<meta name="twitter:description" content="Site description" />
<meta name="twitter:image" content="https://example.com/twitter-image.png" />`,
    });
  }

  if (files.length === 0) return null;

  return {
    category: 'social-meta',
    issues: issueCodes,
    files,
  };
}

/**
 * Generates fixes for structured data issues (JSON-LD, Schema.org)
 */
function generateStructuredDataFixes(issues: SEOIssue[]): FixResult | null {
  if (issues.length === 0) return null;

  const issueCodes = issues.map((i) => i.code);
  const files: FixFile[] = [];

  if (issueCodes.includes('SCHEMA_MISSING')) {
    files.push({
      path: 'index.html',
      content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Site Name",
  "url": "https://example.com"
}
</script>`,
    });
  }

  if (files.length === 0) return null;

  return {
    category: 'structured-data',
    issues: issueCodes,
    files,
  };
}

/**
 * Generates fixes for crawlability issues (robots.txt, sitemap)
 */
function generateCrawlabilityFixes(issues: SEOIssue[]): FixResult | null {
  if (issues.length === 0) return null;

  const issueCodes = issues.map((i) => i.code);
  const files: FixFile[] = [];

  if (issueCodes.includes('ROBOTS_TXT_MISSING')) {
    files.push({
      path: 'robots.txt',
      content: `User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml`,
    });
  }

  if (issueCodes.includes('SITEMAP_MISSING')) {
    files.push({
      path: 'sitemap.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
    });
  }

  if (files.length === 0) return null;

  return {
    category: 'crawlability',
    issues: issueCodes,
    files,
  };
}

/**
 * Generates all fixes for issues found in an audit report
 */
export function generateAllFixes(report: AuditReport): FixResult[] {
  const fixes: FixResult[] = [];
  const groupedIssues = groupIssuesByCategory(report.issues);

  // Generate fixes for each category
  const onPageIssues = groupedIssues.get('on-page') || [];
  const onPageFix = generateOnPageFixes(onPageIssues);
  if (onPageFix) fixes.push(onPageFix);

  const socialMetaIssues = groupedIssues.get('social-meta') || [];
  const socialMetaFix = generateSocialMetaFixes(socialMetaIssues);
  if (socialMetaFix) fixes.push(socialMetaFix);

  const structuredDataIssues = groupedIssues.get('structured-data') || [];
  const structuredDataFix = generateStructuredDataFixes(structuredDataIssues);
  if (structuredDataFix) fixes.push(structuredDataFix);

  const crawlabilityIssues = groupedIssues.get('crawlability') || [];
  const crawlabilityFix = generateCrawlabilityFixes(crawlabilityIssues);
  if (crawlabilityFix) fixes.push(crawlabilityFix);

  return fixes;
}
