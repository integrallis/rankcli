import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface SocialMetaData {
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
  };
  twitter: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    site?: string;
    creator?: string;
  };
  hasFavicon: boolean;
  langAttribute?: string;
}

export function analyzeSocialMeta(html: string, url: string): { issues: AuditIssue[]; data: SocialMetaData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Extract Open Graph data
  const openGraph = {
    title: $('meta[property="og:title"]').attr('content'),
    description: $('meta[property="og:description"]').attr('content'),
    image: $('meta[property="og:image"]').attr('content'),
    url: $('meta[property="og:url"]').attr('content'),
    type: $('meta[property="og:type"]').attr('content'),
    siteName: $('meta[property="og:site_name"]').attr('content'),
  };

  // Extract Twitter Card data
  const twitter = {
    card: $('meta[name="twitter:card"]').attr('content'),
    title: $('meta[name="twitter:title"]').attr('content'),
    description: $('meta[name="twitter:description"]').attr('content'),
    image: $('meta[name="twitter:image"]').attr('content'),
    site: $('meta[name="twitter:site"]').attr('content'),
    creator: $('meta[name="twitter:creator"]').attr('content'),
  };

  // Check favicon
  const hasFavicon = $('link[rel="icon"]').length > 0 ||
                     $('link[rel="shortcut icon"]').length > 0 ||
                     $('link[rel="apple-touch-icon"]').length > 0;

  // Check lang attribute
  const langAttribute = $('html').attr('lang');

  const data: SocialMetaData = {
    openGraph,
    twitter,
    hasFavicon,
    langAttribute,
  };

  // ==================== Open Graph Checks ====================
  if (!openGraph.title) {
    issues.push({
      ...ISSUE_DEFINITIONS.OG_TITLE_MISSING,
      affectedUrls: [url],
    });
  }

  if (!openGraph.description) {
    issues.push({
      ...ISSUE_DEFINITIONS.OG_DESCRIPTION_MISSING,
      affectedUrls: [url],
    });
  }

  if (!openGraph.image) {
    issues.push({
      ...ISSUE_DEFINITIONS.OG_IMAGE_MISSING,
      affectedUrls: [url],
    });
  }

  if (!openGraph.url) {
    issues.push({
      ...ISSUE_DEFINITIONS.OG_URL_MISSING,
      affectedUrls: [url],
    });
  }

  if (!openGraph.type) {
    issues.push({
      ...ISSUE_DEFINITIONS.OG_TYPE_MISSING,
      affectedUrls: [url],
    });
  }

  // ==================== Twitter Card Checks ====================
  if (!twitter.card) {
    issues.push({
      ...ISSUE_DEFINITIONS.TWITTER_CARD_MISSING,
      affectedUrls: [url],
    });
  }

  if (!twitter.image && !openGraph.image) {
    // Only flag if no OG image either (Twitter falls back to OG)
    issues.push({
      ...ISSUE_DEFINITIONS.TWITTER_IMAGE_MISSING,
      affectedUrls: [url],
    });
  }

  // ==================== Favicon Check ====================
  if (!hasFavicon) {
    issues.push({
      ...ISSUE_DEFINITIONS.FAVICON_MISSING,
      affectedUrls: [url],
    });
  }

  // ==================== Lang Attribute Check ====================
  if (!langAttribute) {
    issues.push({
      ...ISSUE_DEFINITIONS.LANG_ATTR_MISSING,
      affectedUrls: [url],
    });
  }

  return { issues, data };
}
