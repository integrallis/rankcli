/**
 * Discovery Module
 *
 * Discovers pages to audit from various sources:
 * - Internal links from homepage
 * - Sitemap
 * - Route files (with repo access)
 */

export { discoverPagesFromLinks, parseSitemap, mergePages } from './link-crawler.js';
export type { DiscoveredPage } from './link-crawler.js';

// Route discovery is exported separately
export { discoverRoutesFromRepo } from './repo-routes.js';
export type { RouteInfo } from './repo-routes.js';
