/**
 * Next.js Metadata Helpers
 *
 * Utilities for generating and merging Next.js metadata objects.
 */

// Type-only definition - next is a peer dependency
interface Metadata {
  title?: string | null;
  description?: string | null;
  keywords?: string | string[] | null;
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
  openGraph?: {
    type?: string;
    url?: string;
    title?: string | null;
    description?: string | null;
    siteName?: string;
    locale?: string;
    images?: Array<{ url: string; width?: number; height?: number; alt?: string }>;
    article?: {
      publishedTime?: string;
      modifiedTime?: string;
      authors?: string[];
      tags?: string[];
    };
  };
  twitter?: {
    card?: string;
    title?: string | null;
    description?: string | null;
    site?: string;
    creator?: string;
    images?: string[];
  };
  robots?: {
    index?: boolean;
    follow?: boolean;
  } | string;
}

export interface MetadataConfig {
  siteUrl: string;
  siteName?: string;
  defaultTitle?: string;
  titleTemplate?: string;
  defaultDescription?: string;
  defaultImage?: string | { url: string; width?: number; height?: number; alt?: string };
  twitterHandle?: string;
  locale?: string;
  type?: 'website' | 'article';
}

export interface PageMetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string | { url: string; width?: number; height?: number; alt?: string };
  noIndex?: boolean;
  keywords?: string[];
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
    tags?: string[];
  };
}

/**
 * Create a metadata generator with site-wide defaults
 */
export function createMetadataGenerator(config: MetadataConfig) {
  const {
    siteUrl,
    siteName,
    defaultTitle,
    titleTemplate = '%s',
    defaultDescription,
    defaultImage,
    twitterHandle,
    locale = 'en_US',
    type = 'website',
  } = config;

  const baseUrl = siteUrl.replace(/\/$/, '');

  /**
   * Generate metadata for a page
   */
  return function generateMetadata(options: PageMetadataOptions = {}): Metadata {
    const {
      title = defaultTitle,
      description = defaultDescription,
      path = '/',
      image = defaultImage,
      noIndex = false,
      keywords,
      article,
    } = options;

    const url = `${baseUrl}${path}`;
    const formattedTitle = title
      ? titleTemplate.replace('%s', title)
      : defaultTitle;

    // Process image
    const imageConfig = typeof image === 'string'
      ? { url: image.startsWith('http') ? image : `${baseUrl}${image}` }
      : image
        ? { ...image, url: image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}` }
        : undefined;

    const metadata: Metadata = {
      title: formattedTitle,
      description,
      keywords: keywords?.join(', '),

      // Canonical URL
      alternates: {
        canonical: url,
      },

      // Open Graph
      openGraph: {
        type: article ? 'article' : type,
        url,
        title: formattedTitle || undefined,
        description,
        siteName,
        locale,
        images: imageConfig ? [imageConfig] : undefined,
        ...(article && {
          article: {
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
            authors: article.authors,
            tags: article.tags,
          },
        }),
      },

      // Twitter Card
      twitter: {
        card: imageConfig ? 'summary_large_image' : 'summary',
        title: formattedTitle || undefined,
        description,
        site: twitterHandle,
        creator: twitterHandle,
        images: imageConfig ? [imageConfig.url] : undefined,
      },

      // Robots
      robots: noIndex
        ? { index: false, follow: false }
        : { index: true, follow: true },
    };

    return metadata;
  };
}

/**
 * Merge metadata objects with proper precedence
 */
export function mergeMetadata(...metadataObjects: (Metadata | undefined)[]): Metadata {
  const result: Metadata = {};

  for (const metadata of metadataObjects) {
    if (!metadata) continue;

    // Simple properties
    if (metadata.title) result.title = metadata.title;
    if (metadata.description) result.description = metadata.description;
    if (metadata.keywords) result.keywords = metadata.keywords;

    // Merge alternates
    if (metadata.alternates) {
      result.alternates = {
        ...result.alternates,
        ...metadata.alternates,
      };
    }

    // Merge openGraph
    if (metadata.openGraph) {
      result.openGraph = {
        ...result.openGraph,
        ...metadata.openGraph,
      };
    }

    // Merge twitter
    if (metadata.twitter) {
      result.twitter = {
        ...result.twitter,
        ...metadata.twitter,
      };
    }

    // Merge robots
    if (metadata.robots) {
      if (typeof metadata.robots === 'string') {
        result.robots = metadata.robots;
      } else if (typeof result.robots === 'object') {
        result.robots = {
          ...result.robots,
          ...metadata.robots,
        };
      } else {
        result.robots = metadata.robots;
      }
    }
  }

  return result;
}

/**
 * JSON.stringify, made safe to place inside <script type="application/ld+json">
 * via dangerouslySetInnerHTML. Plain JSON.stringify leaves "</script>" in
 * string values intact, so a title like `</script><script>alert(1)</script>`
 * (from a CMS, a user profile, a query param) closes the tag and runs. `<`,
 * `>` and `&` become JSON unicode escapes (backslash-u003c etc.) - identical JSON to any parser -
 * and U+2028/U+2029 are escaped for old JS engines.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Create JSON-LD structured data for a page. The result is safe to render
 * with <script type="application/ld+json" dangerouslySetInnerHTML={{ __html }} />.
 */
export function createJsonLd(
  type: 'WebSite' | 'WebPage' | 'Article' | 'Organization' | 'Product' | 'SoftwareApplication',
  data: Record<string, any>
): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  return serializeJsonLd(jsonLd);
}

/**
 * Create WebSite JSON-LD
 */
export function createWebsiteJsonLd(config: {
  name: string;
  url: string;
  description?: string;
  searchUrl?: string;
}): string {
  const data: Record<string, any> = {
    name: config.name,
    url: config.url,
  };

  if (config.description) {
    data.description = config.description;
  }

  if (config.searchUrl) {
    data.potentialAction = {
      '@type': 'SearchAction',
      target: config.searchUrl,
      'query-input': 'required name=search_term_string',
    };
  }

  return createJsonLd('WebSite', data);
}

/**
 * Create Article JSON-LD
 */
export function createArticleJsonLd(config: {
  headline: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: { name: string; url?: string };
  publisher?: { name: string; logo?: string };
}): string {
  const data: Record<string, any> = {
    headline: config.headline,
  };

  if (config.description) data.description = config.description;
  if (config.image) data.image = config.image;
  if (config.datePublished) data.datePublished = config.datePublished;
  if (config.dateModified) data.dateModified = config.dateModified;

  if (config.author) {
    data.author = {
      '@type': 'Person',
      name: config.author.name,
      url: config.author.url,
    };
  }

  if (config.publisher) {
    data.publisher = {
      '@type': 'Organization',
      name: config.publisher.name,
      logo: config.publisher.logo
        ? { '@type': 'ImageObject', url: config.publisher.logo }
        : undefined,
    };
  }

  return createJsonLd('Article', data);
}

/**
 * Create SoftwareApplication JSON-LD (for SaaS products)
 */
export function createSoftwareJsonLd(config: {
  name: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: { price: string; priceCurrency: string };
  aggregateRating?: { ratingValue: number; reviewCount: number };
}): string {
  const data: Record<string, any> = {
    name: config.name,
  };

  if (config.description) data.description = config.description;
  if (config.applicationCategory) data.applicationCategory = config.applicationCategory;
  if (config.operatingSystem) data.operatingSystem = config.operatingSystem;

  if (config.offers) {
    data.offers = {
      '@type': 'Offer',
      price: config.offers.price,
      priceCurrency: config.offers.priceCurrency,
    };
  }

  if (config.aggregateRating) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: config.aggregateRating.ratingValue,
      reviewCount: config.aggregateRating.reviewCount,
    };
  }

  return createJsonLd('SoftwareApplication', data);
}
