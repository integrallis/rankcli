/**
 * HTML Compliance Checks
 *
 * Validates basic HTML requirements that all major SEO tools check:
 * - Doctype declaration (HTML5)
 * - Character encoding (UTF-8)
 * - Favicon presence
 * - Language attribute
 * - Viewport meta tag
 */

import * as cheerio from 'cheerio';
import { httpGet } from '../../utils/http.js';
import type { AuditIssue } from '../types.js';

export interface HtmlComplianceData {
  doctype: {
    present: boolean;
    isHtml5: boolean;
    value?: string;
  };
  charset: {
    present: boolean;
    isUtf8: boolean;
    value?: string;
    source: 'meta' | 'header' | 'none';
  };
  favicon: {
    present: boolean;
    locations: string[];
    hasAppleTouchIcon: boolean;
    formats: string[];
  };
  language: {
    present: boolean;
    value?: string;
  };
  viewport: {
    present: boolean;
    value?: string;
    isResponsive: boolean;
  };
}

export async function analyzeHtmlCompliance(
  html: string,
  url: string,
  headers?: Record<string, string>
): Promise<{ issues: AuditIssue[]; data: HtmlComplianceData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);
  const parsedUrl = new URL(url);

  // === DOCTYPE CHECK ===
  const doctypeMatch = html.match(/<!DOCTYPE\s+([^>]+)>/i);
  const hasDoctype = doctypeMatch !== null;
  const doctypeValue = doctypeMatch ? doctypeMatch[0] : undefined;
  const isHtml5 = hasDoctype && /<!DOCTYPE\s+html\s*>/i.test(html);

  if (!hasDoctype) {
    issues.push({
      code: 'HTML_NO_DOCTYPE',
      severity: 'warning',
      category: 'on-page',
      title: 'Missing DOCTYPE declaration',
      description: 'Page is missing a DOCTYPE declaration. This puts browsers in quirks mode and may cause rendering issues.',
      impact: 'Browsers may render the page inconsistently. Search engines expect valid HTML.',
      howToFix: 'Add <!DOCTYPE html> as the very first line of your HTML document.',
      affectedUrls: [url],
    });
  } else if (!isHtml5) {
    issues.push({
      code: 'HTML_OLD_DOCTYPE',
      severity: 'notice',
      category: 'on-page',
      title: 'Using older DOCTYPE',
      description: `Page uses "${doctypeValue}" instead of HTML5 DOCTYPE. HTML5 is the current standard.`,
      impact: 'Older doctypes may limit modern HTML features.',
      howToFix: 'Change your DOCTYPE to the HTML5 declaration: <!DOCTYPE html>',
      affectedUrls: [url],
    });
  }

  // === CHARSET CHECK ===
  let charsetPresent = false;
  let charsetValue: string | undefined;
  let charsetSource: 'meta' | 'header' | 'none' = 'none';

  // Check meta charset
  const metaCharset = $('meta[charset]').attr('charset');
  const metaContentType = $('meta[http-equiv="Content-Type"]').attr('content');

  if (metaCharset) {
    charsetPresent = true;
    charsetValue = metaCharset;
    charsetSource = 'meta';
  } else if (metaContentType) {
    const charsetMatch = metaContentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch) {
      charsetPresent = true;
      charsetValue = charsetMatch[1];
      charsetSource = 'meta';
    }
  }

  // Check Content-Type header
  if (!charsetPresent && headers) {
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (contentType) {
      const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
      if (charsetMatch) {
        charsetPresent = true;
        charsetValue = charsetMatch[1];
        charsetSource = 'header';
      }
    }
  }

  const isUtf8 = charsetValue?.toLowerCase().replace('-', '') === 'utf8';

  if (!charsetPresent) {
    issues.push({
      code: 'HTML_NO_CHARSET',
      severity: 'warning',
      category: 'on-page',
      title: 'Missing character encoding declaration',
      description: 'Page does not specify character encoding. This can cause text display issues.',
      impact: 'Characters may display incorrectly. Search engines may misinterpret content.',
      howToFix: 'Add <meta charset="UTF-8"> in the <head> section, before any other elements.',
      affectedUrls: [url],
    });
  } else if (!isUtf8) {
    issues.push({
      code: 'HTML_NOT_UTF8',
      severity: 'notice',
      category: 'on-page',
      title: 'Not using UTF-8 encoding',
      description: `Page uses "${charsetValue}" encoding. UTF-8 is recommended for universal character support.`,
      impact: 'Some characters may not display correctly. UTF-8 is the web standard.',
      howToFix: 'Change your charset to UTF-8: <meta charset="UTF-8">',
      affectedUrls: [url],
    });
  }

  // === FAVICON CHECK ===
  const faviconLocations: string[] = [];
  const faviconFormats: string[] = [];
  let hasAppleTouchIcon = false;

  // Check link tags for favicon
  $('link[rel*="icon"]').each((_, el) => {
    const href = $(el).attr('href');
    const rel = $(el).attr('rel') || '';
    const type = $(el).attr('type') || '';

    if (href) {
      faviconLocations.push(href);

      // Detect format
      if (href.endsWith('.ico')) faviconFormats.push('ico');
      else if (href.endsWith('.png')) faviconFormats.push('png');
      else if (href.endsWith('.svg')) faviconFormats.push('svg');
      else if (type) faviconFormats.push(type);
    }

    if (rel.includes('apple-touch-icon')) {
      hasAppleTouchIcon = true;
    }
  });

  // Check for Apple Touch Icon separately
  if ($('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').length > 0) {
    hasAppleTouchIcon = true;
  }

  const hasFavicon = faviconLocations.length > 0;

  if (!hasFavicon) {
    // Check if /favicon.ico exists
    try {
      const faviconUrl = new URL('/favicon.ico', parsedUrl.origin).href;
      const response = await httpGet<string>(faviconUrl, {
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        faviconLocations.push('/favicon.ico');
        faviconFormats.push('ico');
      }
    } catch {
      // Favicon check failed
    }
  }

  if (faviconLocations.length === 0) {
    issues.push({
      code: 'HTML_NO_FAVICON',
      severity: 'notice',
      category: 'on-page',
      title: 'No favicon found',
      description: 'Page does not have a favicon defined. Favicons help with brand recognition and browser tab identification.',
      impact: 'Missing favicon affects brand visibility in browser tabs, bookmarks, and search results.',
      howToFix: 'Add a favicon link in <head>: <link rel="icon" href="/favicon.ico"> and consider adding multiple sizes.',
      affectedUrls: [url],
      details: {
        recommendation: 'Include multiple formats: ICO for legacy browsers, PNG for modern browsers, and SVG for scalability.',
      },
    });
  }

  if (!hasAppleTouchIcon && faviconLocations.length > 0) {
    issues.push({
      code: 'HTML_NO_APPLE_TOUCH_ICON',
      severity: 'notice',
      category: 'mobile',
      title: 'No Apple Touch Icon',
      description: 'Page does not define an Apple Touch Icon. This icon is used when users add your site to their iOS home screen.',
      impact: 'iOS users who bookmark your site won\'t see a proper app icon.',
      howToFix: 'Add: <link rel="apple-touch-icon" href="/apple-touch-icon.png"> with a 180x180 PNG image.',
      affectedUrls: [url],
    });
  }

  // === LANGUAGE CHECK ===
  const htmlLang = $('html').attr('lang');
  const langPresent = Boolean(htmlLang);

  if (!langPresent) {
    issues.push({
      code: 'HTML_NO_LANG',
      severity: 'warning',
      category: 'on-page',
      title: 'Missing language attribute',
      description: 'The <html> element does not have a lang attribute. This helps search engines and screen readers.',
      impact: 'Search engines may not properly identify the page language. Accessibility is reduced.',
      howToFix: 'Add lang attribute to <html>: <html lang="en"> (use appropriate language code).',
      affectedUrls: [url],
    });
  }

  // === VIEWPORT CHECK ===
  const viewportMeta = $('meta[name="viewport"]').attr('content');
  const hasViewport = Boolean(viewportMeta);
  const isResponsive = viewportMeta?.includes('width=device-width') || false;

  if (!hasViewport) {
    issues.push({
      code: 'HTML_NO_VIEWPORT',
      severity: 'warning',
      category: 'mobile',
      title: 'Missing viewport meta tag',
      description: 'Page does not have a viewport meta tag. This is required for proper mobile rendering.',
      impact: 'Page will not render correctly on mobile devices. Fails mobile-friendliness test.',
      howToFix: 'Add: <meta name="viewport" content="width=device-width, initial-scale=1">',
      affectedUrls: [url],
    });
  } else if (!isResponsive) {
    issues.push({
      code: 'HTML_FIXED_VIEWPORT',
      severity: 'notice',
      category: 'mobile',
      title: 'Viewport not responsive',
      description: `Viewport is set to "${viewportMeta}" but doesn't include width=device-width for responsive design.`,
      impact: 'Page may not scale properly on different screen sizes.',
      howToFix: 'Update viewport to: <meta name="viewport" content="width=device-width, initial-scale=1">',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      doctype: {
        present: hasDoctype,
        isHtml5,
        value: doctypeValue,
      },
      charset: {
        present: charsetPresent,
        isUtf8,
        value: charsetValue,
        source: charsetSource,
      },
      favicon: {
        present: faviconLocations.length > 0,
        locations: faviconLocations,
        hasAppleTouchIcon,
        formats: [...new Set(faviconFormats)],
      },
      language: {
        present: langPresent,
        value: htmlLang,
      },
      viewport: {
        present: hasViewport,
        value: viewportMeta,
        isResponsive,
      },
    },
  };
}
