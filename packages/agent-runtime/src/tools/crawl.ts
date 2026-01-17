import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CrawlResult, MetaData, HeadingStructure, ImageInfo, LinkInfo, SchemaData, ToolResult } from '../types.js';

const USER_AGENT = 'SEO-Autopilot/0.1 (+https://seo-autopilot.dev)';

export async function crawlUrl(params: { url: string }): Promise<ToolResult> {
  const { url } = params;

  try {
    const start = Date.now();
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 30000,
      validateStatus: () => true,
    });
    const loadTime = Date.now() - start;

    const result: CrawlResult = {
      url,
      html: response.data,
      statusCode: response.status,
      headers: response.headers as Record<string, string>,
      loadTime,
    };

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error crawling URL'
    };
  }
}

export async function extractMeta(params: { html: string; url: string }): Promise<ToolResult> {
  const { html, url } = params;

  try {
    const $ = cheerio.load(html);

    const meta: MetaData = {
      title: $('title').text().trim() || undefined,
      description: $('meta[name="description"]').attr('content')?.trim(),
      canonical: $('link[rel="canonical"]').attr('href'),
      robots: $('meta[name="robots"]').attr('content'),
      viewport: $('meta[name="viewport"]').attr('content'),
      charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content'),
      openGraph: {
        title: $('meta[property="og:title"]').attr('content'),
        description: $('meta[property="og:description"]').attr('content'),
        image: $('meta[property="og:image"]').attr('content'),
        url: $('meta[property="og:url"]').attr('content'),
        type: $('meta[property="og:type"]').attr('content'),
        siteName: $('meta[property="og:site_name"]').attr('content'),
      },
      twitter: {
        card: $('meta[name="twitter:card"]').attr('content'),
        title: $('meta[name="twitter:title"]').attr('content'),
        description: $('meta[name="twitter:description"]').attr('content'),
        image: $('meta[name="twitter:image"]').attr('content'),
        site: $('meta[name="twitter:site"]').attr('content'),
      },
      other: {},
    };

    // Extract other meta tags
    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      if (name && content && !name.startsWith('og:') && !name.startsWith('twitter:')) {
        if (!['description', 'robots', 'viewport'].includes(name)) {
          meta.other[name] = content;
        }
      }
    });

    return { success: true, data: meta };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error extracting meta'
    };
  }
}

export async function analyzeHeadings(params: { html: string }): Promise<ToolResult> {
  const { html } = params;

  try {
    const $ = cheerio.load(html);
    const headings: HeadingStructure[] = [];

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      headings.push({
        tag,
        text: $(el).text().trim(),
        level: parseInt(tag.charAt(1), 10),
      });
    });

    return { success: true, data: headings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error analyzing headings'
    };
  }
}

export async function extractImages(params: { html: string }): Promise<ToolResult> {
  const { html } = params;

  try {
    const $ = cheerio.load(html);
    const images: ImageInfo[] = [];

    $('img').each((_, el) => {
      images.push({
        src: $(el).attr('src') || '',
        alt: $(el).attr('alt') || null,
        width: $(el).attr('width'),
        height: $(el).attr('height'),
        loading: $(el).attr('loading'),
      });
    });

    return { success: true, data: images };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error extracting images'
    };
  }
}

export async function extractLinks(params: { html: string; baseUrl: string }): Promise<ToolResult> {
  const { html, baseUrl } = params;

  try {
    const $ = cheerio.load(html);
    const links: LinkInfo[] = [];
    const baseHostname = new URL(baseUrl).hostname;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';

      let isInternal = false;
      try {
        if (href.startsWith('/') || href.startsWith('#')) {
          isInternal = true;
        } else {
          const linkHostname = new URL(href).hostname;
          isInternal = linkHostname === baseHostname;
        }
      } catch {
        isInternal = true; // Relative URLs are internal
      }

      links.push({
        href,
        text: $(el).text().trim(),
        isInternal,
        isNofollow: rel.includes('nofollow'),
      });
    });

    return { success: true, data: links };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error extracting links'
    };
  }
}

export async function extractSchema(params: { html: string }): Promise<ToolResult> {
  const { html } = params;

  try {
    const $ = cheerio.load(html);
    const schemas: SchemaData[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);
          schemas.push({
            type: data['@type'] || 'Unknown',
            data,
          });
        }
      } catch {
        // Skip invalid JSON-LD
      }
    });

    return { success: true, data: schemas };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error extracting schema'
    };
  }
}

export async function checkRobots(params: { url: string }): Promise<ToolResult> {
  try {
    const baseUrl = new URL(params.url);
    const robotsUrl = `${baseUrl.protocol}//${baseUrl.host}/robots.txt`;

    const response = await axios.get(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 200) {
      return {
        success: true,
        data: {
          exists: true,
          content: response.data,
          url: robotsUrl,
        }
      };
    }

    return {
      success: true,
      data: {
        exists: false,
        url: robotsUrl,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error checking robots.txt'
    };
  }
}

export async function checkSitemap(params: { url: string }): Promise<ToolResult> {
  try {
    const baseUrl = new URL(params.url);
    const sitemapUrls = [
      `${baseUrl.protocol}//${baseUrl.host}/sitemap.xml`,
      `${baseUrl.protocol}//${baseUrl.host}/sitemap_index.xml`,
      `${baseUrl.protocol}//${baseUrl.host}/sitemap/sitemap.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await axios.get(sitemapUrl, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 10000,
        });

        if (response.status === 200 && response.data.includes('<?xml')) {
          // Parse sitemap to get URL count
          const $ = cheerio.load(response.data, { xmlMode: true });
          const urlCount = $('url').length || $('sitemap').length;

          return {
            success: true,
            data: {
              exists: true,
              url: sitemapUrl,
              urlCount,
              content: response.data.substring(0, 2000), // First 2KB
            }
          };
        }
      } catch {
        // Try next URL
      }
    }

    return {
      success: true,
      data: {
        exists: false,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error checking sitemap'
    };
  }
}
