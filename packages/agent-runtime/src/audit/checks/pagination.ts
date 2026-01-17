import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface PaginationData {
  hasPagination: boolean;
  hasHtmlPaginationLinks: boolean;
  hasInfiniteScroll: boolean;
  hasLoadMoreButton: boolean;
  paginationLinks: string[];
  relNextPrev: {
    hasNext: boolean;
    hasPrev: boolean;
    nextUrl?: string;
    prevUrl?: string;
  };
  currentPage?: number;
  totalPages?: number;
}

export function analyzePagination(
  html: string,
  url: string,
  canonical?: string
): { issues: AuditIssue[]; data: PaginationData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Check for rel="next" and rel="prev"
  const nextLink = $('link[rel="next"]').attr('href');
  const prevLink = $('link[rel="prev"]').attr('href');

  // Detect pagination patterns in links
  const paginationLinks: string[] = [];
  const paginationPatterns = [
    /[?&]page=\d+/,
    /[?&]p=\d+/,
    /\/page\/\d+/,
    /\/p\/\d+/,
    /-page-\d+/,
    /\/\d+\/?$/,
  ];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    for (const pattern of paginationPatterns) {
      if (pattern.test(href)) {
        try {
          const fullUrl = new URL(href, url).href;
          if (!paginationLinks.includes(fullUrl)) {
            paginationLinks.push(fullUrl);
          }
        } catch {
          // Invalid URL, skip
        }
        break;
      }
    }
  });

  // Detect infinite scroll patterns
  const hasInfiniteScrollScript = html.includes('infinite-scroll') ||
    html.includes('infiniteScroll') ||
    html.includes('infinite_scroll') ||
    $('[data-infinite-scroll]').length > 0 ||
    $('[data-infinite]').length > 0 ||
    $('.infinite-scroll').length > 0;

  // Detect "load more" buttons
  const loadMoreSelectors = [
    'button:contains("Load More")',
    'button:contains("Load more")',
    'button:contains("Show More")',
    'button:contains("Show more")',
    'a:contains("Load More")',
    'a:contains("Load more")',
    '[class*="load-more"]',
    '[class*="loadmore"]',
    '[data-load-more]',
  ];

  let hasLoadMoreButton = false;
  for (const selector of loadMoreSelectors) {
    try {
      if ($(selector).length > 0) {
        hasLoadMoreButton = true;
        break;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  // Try to detect current page number
  let currentPage: number | undefined;
  let totalPages: number | undefined;

  // Check URL for page number
  const pageMatch = url.match(/[?&]page=(\d+)|\/page\/(\d+)|[?&]p=(\d+)/);
  if (pageMatch) {
    currentPage = parseInt(pageMatch[1] || pageMatch[2] || pageMatch[3], 10);
  }

  // Check for "Page X of Y" pattern
  const pageOfPattern = /page\s*(\d+)\s*of\s*(\d+)/i;
  const pageOfMatch = $('body').text().match(pageOfPattern);
  if (pageOfMatch) {
    currentPage = parseInt(pageOfMatch[1], 10);
    totalPages = parseInt(pageOfMatch[2], 10);
  }

  const hasPagination = paginationLinks.length > 0 ||
    nextLink !== undefined ||
    prevLink !== undefined ||
    currentPage !== undefined;

  const hasHtmlPaginationLinks = paginationLinks.length > 0;

  const data: PaginationData = {
    hasPagination,
    hasHtmlPaginationLinks,
    hasInfiniteScroll: hasInfiniteScrollScript,
    hasLoadMoreButton,
    paginationLinks,
    relNextPrev: {
      hasNext: !!nextLink,
      hasPrev: !!prevLink,
      nextUrl: nextLink,
      prevUrl: prevLink,
    },
    currentPage,
    totalPages,
  };

  // ==================== Issue Detection ====================

  // Infinite scroll without HTML fallback links
  if (hasInfiniteScrollScript && !hasHtmlPaginationLinks) {
    issues.push({
      ...ISSUE_DEFINITIONS.INFINITE_SCROLL_NO_FALLBACK,
      affectedUrls: [url],
      details: {
        hasLoadMore: hasLoadMoreButton,
        suggestion: 'Add <a href> pagination links alongside infinite scroll for SEO',
      },
    });
  }

  // Load more without HTML links
  if (hasLoadMoreButton && !hasHtmlPaginationLinks && !hasInfiniteScrollScript) {
    issues.push({
      ...ISSUE_DEFINITIONS.PAGINATION_NO_LINKS,
      affectedUrls: [url],
      details: {
        suggestion: 'Ensure "Load More" button also has underlying <a> links',
      },
    });
  }

  // Check for improper canonical on paginated pages
  if (hasPagination && currentPage && currentPage > 1 && canonical) {
    // Check if canonical points to page 1
    const isCanonicalToPage1 = !paginationPatterns.some(p => p.test(canonical));
    const urlHasPageNumber = paginationPatterns.some(p => p.test(url));

    if (isCanonicalToPage1 && urlHasPageNumber) {
      issues.push({
        ...ISSUE_DEFINITIONS.PAGINATION_CANONICAL_ISSUE,
        affectedUrls: [url],
        details: {
          currentPage,
          canonical,
          suggestion: 'Paginated pages should self-reference or point to a View All page',
        },
      });
    }
  }

  return { issues, data };
}
