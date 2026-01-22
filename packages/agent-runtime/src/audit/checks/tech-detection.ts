// Technology Detection
// Detects CMS, frameworks, and JavaScript libraries

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

// Known vulnerable jQuery versions (simplified)
const VULNERABLE_JQUERY = ['1.', '2.0', '2.1', '2.2', '3.0', '3.1', '3.2', '3.3', '3.4'];

export interface TechnologyInfo {
  name: string;
  version?: string;
  category: 'cms' | 'framework' | 'library' | 'server' | 'analytics' | 'cdn' | 'other';
  confidence: 'high' | 'medium' | 'low';
}

export interface TechDetectionData {
  technologies: TechnologyInfo[];
  cms: string | null;
  framework: string | null;
  jsLibraries: string[];
  analytics: string[];
  cdn: string | null;
  serverHeaders: Record<string, string>;
}

/**
 * Detect technologies from HTML and headers
 */
export function detectTechnologies(
  html: string,
  url: string,
  headers?: Record<string, string>
): { issues: AuditIssue[]; data: TechDetectionData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const technologies: TechnologyInfo[] = [];

  // Detect CMS
  detectCMS($, technologies);

  // Detect JavaScript frameworks
  detectFrameworks($, html, technologies);

  // Detect JavaScript libraries
  detectLibraries($, html, technologies, issues, url);

  // Detect analytics
  detectAnalytics($, html, technologies);

  // Detect CDN from headers
  if (headers) {
    detectCDN(headers, technologies);
  }

  // Build summary
  const cms = technologies.find((t) => t.category === 'cms')?.name || null;
  const framework = technologies.find((t) => t.category === 'framework')?.name || null;
  const jsLibraries = technologies.filter((t) => t.category === 'library').map((t) => t.name);
  const analytics = technologies.filter((t) => t.category === 'analytics').map((t) => t.name);
  const cdn = technologies.find((t) => t.category === 'cdn')?.name || null;

  return {
    issues,
    data: {
      technologies,
      cms,
      framework,
      jsLibraries,
      analytics,
      cdn,
      serverHeaders: headers || {},
    },
  };
}

/**
 * Detect CMS
 */
function detectCMS($: cheerio.CheerioAPI, technologies: TechnologyInfo[]): void {
  // WordPress
  if (
    $('meta[name="generator"][content*="WordPress"]').length > 0 ||
    $('link[href*="wp-content"]').length > 0 ||
    $('script[src*="wp-content"]').length > 0
  ) {
    const version = $('meta[name="generator"]').attr('content')?.match(/WordPress\s+([\d.]+)/)?.[1];
    technologies.push({
      name: 'WordPress',
      version,
      category: 'cms',
      confidence: 'high',
    });
  }

  // Drupal
  if (
    $('meta[name="generator"][content*="Drupal"]').length > 0 ||
    $('script[src*="/drupal"]').length > 0 ||
    $('[data-drupal-selector]').length > 0
  ) {
    technologies.push({
      name: 'Drupal',
      category: 'cms',
      confidence: 'high',
    });
  }

  // Joomla
  if ($('meta[name="generator"][content*="Joomla"]').length > 0 || $('script[src*="/joomla"]').length > 0) {
    technologies.push({
      name: 'Joomla',
      category: 'cms',
      confidence: 'high',
    });
  }

  // Shopify
  if ($('meta[name="shopify-digital-wallet"]').length > 0 || $('link[href*="cdn.shopify.com"]').length > 0) {
    technologies.push({
      name: 'Shopify',
      category: 'cms',
      confidence: 'high',
    });
  }

  // Squarespace
  if ($('script[src*="squarespace"]').length > 0 || $('meta[content*="Squarespace"]').length > 0) {
    technologies.push({
      name: 'Squarespace',
      category: 'cms',
      confidence: 'high',
    });
  }

  // Wix
  if ($('meta[name="generator"][content*="Wix"]').length > 0 || $('script[src*="wix.com"]').length > 0) {
    technologies.push({
      name: 'Wix',
      category: 'cms',
      confidence: 'high',
    });
  }

  // Ghost
  if ($('meta[name="generator"][content*="Ghost"]').length > 0) {
    const version = $('meta[name="generator"]').attr('content')?.match(/Ghost\s+([\d.]+)/)?.[1];
    technologies.push({
      name: 'Ghost',
      version,
      category: 'cms',
      confidence: 'high',
    });
  }

  // Hugo
  if ($('meta[name="generator"][content*="Hugo"]').length > 0) {
    technologies.push({
      name: 'Hugo',
      category: 'cms',
      confidence: 'high',
    });
  }
}

/**
 * Detect JavaScript frameworks
 */
function detectFrameworks($: cheerio.CheerioAPI, html: string, technologies: TechnologyInfo[]): void {
  // React
  if ($('[data-reactroot]').length > 0 || $('[data-react-helmet]').length > 0 || html.includes('__REACT_DEVTOOLS')) {
    technologies.push({
      name: 'React',
      category: 'framework',
      confidence: 'high',
    });
  }

  // Next.js
  if ($('#__next').length > 0 || $('script[src*="/_next/"]').length > 0) {
    technologies.push({
      name: 'Next.js',
      category: 'framework',
      confidence: 'high',
    });
  }

  // Vue.js
  if ($('[data-v-]').length > 0 || html.includes('Vue.js') || $('script[src*="vue"]').length > 0) {
    technologies.push({
      name: 'Vue.js',
      category: 'framework',
      confidence: 'medium',
    });
  }

  // Nuxt.js
  if ($('#__nuxt').length > 0 || $('script[src*="/_nuxt/"]').length > 0) {
    technologies.push({
      name: 'Nuxt.js',
      category: 'framework',
      confidence: 'high',
    });
  }

  // Angular
  if ($('[ng-app]').length > 0 || $('[data-ng-app]').length > 0 || $('app-root').length > 0) {
    technologies.push({
      name: 'Angular',
      category: 'framework',
      confidence: 'high',
    });
  }

  // Svelte
  if ($('script[src*="svelte"]').length > 0 || html.includes('__svelte')) {
    technologies.push({
      name: 'Svelte',
      category: 'framework',
      confidence: 'medium',
    });
  }

  // Astro
  if ($('[data-astro-source-file]').length > 0 || $('script[src*="/_astro/"]').length > 0) {
    technologies.push({
      name: 'Astro',
      category: 'framework',
      confidence: 'high',
    });
  }

  // Gatsby
  if ($('#___gatsby').length > 0 || $('script[src*="/gatsby"]').length > 0) {
    technologies.push({
      name: 'Gatsby',
      category: 'framework',
      confidence: 'high',
    });
  }

  // Remix
  if (html.includes('__remixContext') || $('script[src*="remix"]').length > 0) {
    technologies.push({
      name: 'Remix',
      category: 'framework',
      confidence: 'medium',
    });
  }
}

/**
 * Detect JavaScript libraries
 */
function detectLibraries(
  $: cheerio.CheerioAPI,
  html: string,
  technologies: TechnologyInfo[],
  issues: AuditIssue[],
  url: string
): void {
  // jQuery
  const jqueryScript = $('script[src*="jquery"]').attr('src') || '';
  const jqueryVersionMatch = jqueryScript.match(/jquery[.-]?([\d.]+)/i) || html.match(/jQuery\s+v?([\d.]+)/);

  if (jqueryScript || html.includes('jQuery')) {
    const version = jqueryVersionMatch?.[1];
    technologies.push({
      name: 'jQuery',
      version,
      category: 'library',
      confidence: 'high',
    });

    // Check for vulnerable version
    if (version && VULNERABLE_JQUERY.some((v) => version.startsWith(v))) {
      issues.push({
        ...ISSUE_DEFINITIONS.OUTDATED_JQUERY,
        affectedUrls: [url],
        details: { version, recommendation: 'Update to jQuery 3.5.0 or later' },
      });
    }
  }

  // Bootstrap
  if ($('link[href*="bootstrap"]').length > 0 || $('script[src*="bootstrap"]').length > 0) {
    const version = ($('link[href*="bootstrap"]').attr('href') || '').match(/bootstrap[.-]?([\d.]+)/)?.[1];
    technologies.push({
      name: 'Bootstrap',
      version,
      category: 'library',
      confidence: 'high',
    });
  }

  // Tailwind CSS
  if (html.includes('tailwind') || $('[class*="tw-"]').length > 0 || $('style').text().includes('--tw-')) {
    technologies.push({
      name: 'Tailwind CSS',
      category: 'library',
      confidence: 'medium',
    });
  }

  // Lodash
  if ($('script[src*="lodash"]').length > 0 || html.includes('_.VERSION')) {
    technologies.push({
      name: 'Lodash',
      category: 'library',
      confidence: 'medium',
    });
  }

  // GSAP
  if ($('script[src*="gsap"]').length > 0 || html.includes('gsap')) {
    technologies.push({
      name: 'GSAP',
      category: 'library',
      confidence: 'medium',
    });
  }

  // Three.js
  if ($('script[src*="three"]').length > 0 || html.includes('THREE.')) {
    technologies.push({
      name: 'Three.js',
      category: 'library',
      confidence: 'medium',
    });
  }
}

/**
 * Detect analytics
 */
function detectAnalytics($: cheerio.CheerioAPI, html: string, technologies: TechnologyInfo[]): void {
  // Google Analytics (GA4 and UA)
  if (
    html.includes('gtag') ||
    html.includes('googletagmanager') ||
    $('script[src*="google-analytics"]').length > 0 ||
    $('script[src*="gtag"]').length > 0
  ) {
    technologies.push({
      name: 'Google Analytics',
      category: 'analytics',
      confidence: 'high',
    });
  }

  // Google Tag Manager
  if (html.includes('GTM-') || $('script[src*="googletagmanager.com/gtm"]').length > 0) {
    technologies.push({
      name: 'Google Tag Manager',
      category: 'analytics',
      confidence: 'high',
    });
  }

  // Facebook Pixel
  if (html.includes('fbq(') || $('script[src*="connect.facebook"]').length > 0) {
    technologies.push({
      name: 'Facebook Pixel',
      category: 'analytics',
      confidence: 'high',
    });
  }

  // Hotjar
  if (html.includes('hotjar') || $('script[src*="hotjar"]').length > 0) {
    technologies.push({
      name: 'Hotjar',
      category: 'analytics',
      confidence: 'high',
    });
  }

  // Mixpanel
  if (html.includes('mixpanel') || $('script[src*="mixpanel"]').length > 0) {
    technologies.push({
      name: 'Mixpanel',
      category: 'analytics',
      confidence: 'high',
    });
  }

  // Segment
  if (html.includes('analytics.js') || $('script[src*="segment"]').length > 0) {
    technologies.push({
      name: 'Segment',
      category: 'analytics',
      confidence: 'medium',
    });
  }

  // Plausible
  if ($('script[src*="plausible"]').length > 0) {
    technologies.push({
      name: 'Plausible',
      category: 'analytics',
      confidence: 'high',
    });
  }

  // Fathom
  if ($('script[src*="usefathom"]').length > 0) {
    technologies.push({
      name: 'Fathom Analytics',
      category: 'analytics',
      confidence: 'high',
    });
  }
}

/**
 * Detect CDN from headers
 */
function detectCDN(headers: Record<string, string>, technologies: TechnologyInfo[]): void {
  const serverHeader = headers['server']?.toLowerCase() || '';
  const viaHeader = headers['via']?.toLowerCase() || '';
  const cdnHeaders = [
    headers['x-cdn'],
    headers['x-cache'],
    headers['cf-ray'],
    headers['x-amz-cf-id'],
    headers['x-vercel-cache'],
    headers['x-served-by'],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Cloudflare
  if (headers['cf-ray'] || serverHeader.includes('cloudflare')) {
    technologies.push({
      name: 'Cloudflare',
      category: 'cdn',
      confidence: 'high',
    });
  }

  // AWS CloudFront
  if (headers['x-amz-cf-id'] || viaHeader.includes('cloudfront')) {
    technologies.push({
      name: 'AWS CloudFront',
      category: 'cdn',
      confidence: 'high',
    });
  }

  // Vercel
  if (headers['x-vercel-cache'] || serverHeader.includes('vercel')) {
    technologies.push({
      name: 'Vercel',
      category: 'cdn',
      confidence: 'high',
    });
  }

  // Fastly
  if (cdnHeaders.includes('fastly') || viaHeader.includes('fastly')) {
    technologies.push({
      name: 'Fastly',
      category: 'cdn',
      confidence: 'high',
    });
  }

  // Akamai
  if (serverHeader.includes('akamai') || headers['x-akamai-request-id']) {
    technologies.push({
      name: 'Akamai',
      category: 'cdn',
      confidence: 'high',
    });
  }

  // Netlify
  if (serverHeader.includes('netlify') || headers['x-nf-request-id']) {
    technologies.push({
      name: 'Netlify',
      category: 'cdn',
      confidence: 'high',
    });
  }

  // GitHub Pages
  if (serverHeader.includes('github')) {
    technologies.push({
      name: 'GitHub Pages',
      category: 'cdn',
      confidence: 'high',
    });
  }
}
