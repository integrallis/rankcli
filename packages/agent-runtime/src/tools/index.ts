import {
  crawlUrl,
  extractMeta,
  analyzeHeadings,
  extractImages,
  extractLinks,
  extractSchema,
  checkRobots,
  checkSitemap,
} from './crawl.js';

import {
  readFile,
  writeFile,
  listFiles,
  detectFramework,
  findHtmlEntry,
  findPageFiles,
} from './files.js';

import { analyzeUrl } from './analyzer.js';
import { scanForH1, generateH1Fix } from './h1-fixer.js';

import type { ToolFunction } from '../types.js';

export const tools: Record<string, ToolFunction> = {
  // Crawling tools
  crawl_url: (params) => crawlUrl(params as { url: string }),
  extract_meta: (params) => extractMeta(params as { html: string; url: string }),
  analyze_headings: (params) => analyzeHeadings(params as { html: string }),
  extract_images: (params) => extractImages(params as { html: string }),
  extract_links: (params) => extractLinks(params as { html: string; baseUrl: string }),
  extract_schema: (params) => extractSchema(params as { html: string }),
  check_robots: (params) => checkRobots(params as { url: string }),
  check_sitemap: (params) => checkSitemap(params as { url: string }),

  // File tools
  read_file: (params) => readFile(params as { path: string; cwd?: string }),
  write_file: (params) => writeFile(params as { path: string; content: string; cwd?: string }),
  list_files: (params) => listFiles(params as { path: string; cwd?: string; pattern?: string; recursive?: boolean }),
  detect_framework: (params) => detectFramework(params as { cwd?: string }),
  find_html_entry: (params) => findHtmlEntry(params as { cwd?: string }),
  find_page_files: (params) => findPageFiles(params as { cwd?: string; framework?: string }),

  // High-level analysis
  analyze_url: (params) => analyzeUrl(params as { url: string }),
};

export {
  crawlUrl,
  extractMeta,
  analyzeHeadings,
  extractImages,
  extractLinks,
  extractSchema,
  checkRobots,
  checkSitemap,
  readFile,
  writeFile,
  listFiles,
  detectFramework,
  findHtmlEntry,
  findPageFiles,
  analyzeUrl,
  scanForH1,
  generateH1Fix,
};
