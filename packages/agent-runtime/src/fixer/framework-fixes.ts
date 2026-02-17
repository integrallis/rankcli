/**
 * Framework-Specific SEO Fix Generators
 * 
 * Industry-leading SEO implementations for each framework including:
 * - Dynamic meta tags with full OG/Twitter support
 * - JSON-LD structured data
 * - Robots.txt and sitemap generation
 * - Performance optimizations (preconnect, preload)
 * - Canonical URL handling
 * - Internationalization support
 */

import type { FrameworkInfo } from '../types.js';

export interface MetaFixOptions {
  siteName: string;
  siteUrl: string;
  title?: string;
  description?: string;
  image?: string;
  twitterHandle?: string;
  locale?: string;
}

export interface GeneratedCode {
  file: string;
  code: string;
  explanation: string;
  installCommands?: string[];
  imports?: string[];
  additionalFiles?: { file: string; code: string; explanation: string }[];
}

// ============================================================================
// REACT (Vite/CRA) - Comprehensive SEO with react-helmet-async
// ============================================================================

export function generateReactSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image, twitterHandle, locale } = options;
  
  return {
    file: 'src/components/SEOHead.tsx',
    code: `import { Helmet } from 'react-helmet-async';

/**
 * SEO Head Component
 * 
 * Comprehensive SEO meta tags following best practices:
 * - Primary meta tags (title, description)
 * - Open Graph for Facebook/LinkedIn
 * - Twitter Card for X/Twitter
 * - JSON-LD structured data
 * - Canonical URLs
 * 
 * @example
 * <SEOHead 
 *   title="Product Name"
 *   description="Product description"
 *   type="product"
 *   schema={{
 *     "@type": "Product",
 *     name: "Product Name",
 *     price: "99.00"
 *   }}
 * />
 */

interface SEOHeadProps {
  // Required
  title?: string;
  description?: string;
  
  // URLs
  url?: string;
  canonical?: string;
  image?: string;
  
  // Page type
  type?: 'website' | 'article' | 'product' | 'profile';
  
  // Article-specific
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
  
  // Twitter
  twitterCard?: 'summary' | 'summary_large_image' | 'player';
  
  // Structured data
  schema?: Record<string, unknown> | Record<string, unknown>[];
  
  // Robots
  noindex?: boolean;
  nofollow?: boolean;
  
  // Alternate languages
  alternates?: { hrefLang: string; href: string }[];
}

const SITE_NAME = '${siteName}';
const SITE_URL = '${siteUrl}';
const DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}';
const TWITTER_HANDLE = '${twitterHandle || ''}';
const DEFAULT_LOCALE = '${locale || 'en_US'}';

export function SEOHead({
  title,
  description = '${description || `${siteName} - A compelling description of your product or service.`}',
  url,
  canonical,
  image = DEFAULT_IMAGE,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  section,
  tags,
  twitterCard = 'summary_large_image',
  schema,
  noindex = false,
  nofollow = false,
  alternates,
}: SEOHeadProps) {
  const pageUrl = url || (typeof window !== 'undefined' ? window.location.href : SITE_URL);
  const canonicalUrl = canonical || pageUrl;
  const fullTitle = title 
    ? (title.includes(SITE_NAME) ? title : \`\${title} | \${SITE_NAME}\`)
    : SITE_NAME;
  
  // Ensure image is absolute URL
  const imageUrl = image.startsWith('http') ? image : \`\${SITE_URL}\${image}\`;
  
  // Build robots directive
  const robotsContent = [
    noindex ? 'noindex' : 'index',
    nofollow ? 'nofollow' : 'follow',
  ].join(', ');

  // Default Organization schema
  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };

  // Merge with provided schema
  const jsonLd = schema 
    ? Array.isArray(schema) 
      ? [defaultSchema, ...schema]
      : [defaultSchema, schema]
    : [defaultSchema];

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={DEFAULT_LOCALE} />

      {/* Article-specific Open Graph */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {type === 'article' && tags?.map((tag, i) => (
        <meta key={i} property="article:tag" content={tag} />
      ))}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={pageUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={fullTitle} />
      {TWITTER_HANDLE && <meta name="twitter:site" content={TWITTER_HANDLE} />}
      {TWITTER_HANDLE && <meta name="twitter:creator" content={TWITTER_HANDLE} />}

      {/* Alternate Languages */}
      {alternates?.map((alt, i) => (
        <link key={i} rel="alternate" hrefLang={alt.hrefLang} href={alt.href} />
      ))}

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
    </Helmet>
  );
}

/**
 * Pre-built schema generators for common page types
 */
export const SchemaGenerators = {
  organization: (data: {
    name: string;
    url: string;
    logo?: string;
    sameAs?: string[];
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: data.logo,
    sameAs: data.sameAs,
  }),

  article: (data: {
    headline: string;
    description: string;
    image: string;
    datePublished: string;
    dateModified?: string;
    author: { name: string; url?: string };
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: {
      '@type': 'Person',
      name: data.author.name,
      url: data.author.url,
    },
  }),

  product: (data: {
    name: string;
    description: string;
    image: string;
    price: string;
    currency?: string;
    availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
    brand?: string;
    sku?: string;
    rating?: { value: number; count: number };
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    brand: data.brand ? { '@type': 'Brand', name: data.brand } : undefined,
    sku: data.sku,
    offers: {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.currency || 'USD',
      availability: \`https://schema.org/\${data.availability || 'InStock'}\`,
    },
    aggregateRating: data.rating ? {
      '@type': 'AggregateRating',
      ratingValue: data.rating.value,
      reviewCount: data.rating.count,
    } : undefined,
  }),

  faq: (items: { question: string; answer: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }),

  breadcrumb: (items: { name: string; url: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }),

  localBusiness: (data: {
    name: string;
    description: string;
    url: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    geo?: { lat: number; lng: number };
    hours?: string[];
    priceRange?: string;
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: data.name,
    description: data.description,
    url: data.url,
    telephone: data.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.address.street,
      addressLocality: data.address.city,
      addressRegion: data.address.state,
      postalCode: data.address.zip,
      addressCountry: data.address.country,
    },
    geo: data.geo ? {
      '@type': 'GeoCoordinates',
      latitude: data.geo.lat,
      longitude: data.geo.lng,
    } : undefined,
    openingHours: data.hours,
    priceRange: data.priceRange,
  }),
};`,
    explanation: `Comprehensive React SEO component with:
• Full Open Graph support (including article metadata)
• Twitter Cards with all variants
• JSON-LD structured data with pre-built schema generators
• Robots directives (noindex/nofollow)
• Hreflang for internationalization
• Canonical URL handling

Install: npm install react-helmet-async
Wrap app: <HelmetProvider><App /></HelmetProvider>`,
    installCommands: ['npm install react-helmet-async'],
    additionalFiles: [
      {
        file: 'src/main.tsx',
        code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
);`,
        explanation: 'Updated main.tsx with HelmetProvider wrapper.',
      },
    ],
  };
}

// ============================================================================
// NEXT.JS (App Router) - Server-side metadata with full features
// ============================================================================

export function generateNextJsAppRouterMetadata(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image, twitterHandle, locale } = options;
  
  return {
    file: 'app/layout.tsx',
    code: `import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

/**
 * Default metadata for all pages
 * Individual pages can override with their own metadata export
 */
export const metadata: Metadata = {
  metadataBase: new URL('${siteUrl}'),
  
  // Default title with template
  title: {
    default: '${title || siteName}',
    template: \`%s | ${siteName}\`,
  },
  
  description: '${description || `${siteName} - A compelling description of your product or service.`}',
  
  // Indexing
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Icons
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  
  // Manifest
  manifest: '/site.webmanifest',
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: '${locale || 'en_US'}',
    url: '${siteUrl}',
    siteName: '${siteName}',
    title: '${title || siteName}',
    description: '${description || `${siteName} - A compelling description.`}',
    images: [
      {
        url: '${image || '/og-image.png'}',
        width: 1200,
        height: 630,
        alt: '${siteName}',
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: '${title || siteName}',
    description: '${description || `${siteName} - A compelling description.`}',
    images: ['${image || '/og-image.png'}'],
    ${twitterHandle ? `site: '${twitterHandle}',
    creator: '${twitterHandle}',` : ''}
  },
  
  // Verification (add your IDs)
  verification: {
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  
  // Alternate languages (uncomment and customize)
  // alternates: {
  //   canonical: '${siteUrl}',
  //   languages: {
  //     'en-US': '${siteUrl}/en',
  //     'es-ES': '${siteUrl}/es',
  //   },
  // },
  
  // Category
  category: 'technology',
};

/**
 * Viewport configuration
 * Separated from metadata in Next.js 14+
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="${(locale || 'en_US').split('_')[0]}" className={inter.className}>
      <body>
        {children}
        
        {/* JSON-LD Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: '${siteName}',
              url: '${siteUrl}',
              logo: '${siteUrl}/logo.png',
              sameAs: [
                // Add your social profiles
                // 'https://twitter.com/yourhandle',
                // 'https://linkedin.com/company/yourcompany',
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}`,
    explanation: `Next.js App Router layout with comprehensive SEO:
• Metadata API with title templates
• Full Open Graph and Twitter Card support
• Viewport configuration (Next.js 14+)
• JSON-LD Organization schema
• Verification tags for search consoles
• Internationalization ready
• Web font optimization with next/font`,
    additionalFiles: [
      {
        file: 'app/robots.ts',
        code: `import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = '${siteUrl}';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/', '/private/'],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
      },
    ],
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  };
}`,
        explanation: 'Robots.txt with AI crawler support.',
      },
      {
        file: 'app/sitemap.ts',
        code: `import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = '${siteUrl}';
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: \`\${baseUrl}/about\`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: \`\${baseUrl}/pricing\`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: \`\${baseUrl}/blog\`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Dynamic pages - fetch from your database/CMS
  // const posts = await db.post.findMany({ select: { slug: true, updatedAt: true } });
  // const dynamicPages = posts.map((post) => ({
  //   url: \`\${baseUrl}/blog/\${post.slug}\`,
  //   lastModified: post.updatedAt,
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.7,
  // }));

  return [...staticPages];
}`,
        explanation: 'Dynamic sitemap generator.',
      },
      {
        file: 'lib/seo.ts',
        code: `import type { Metadata } from 'next';

const baseUrl = '${siteUrl}';
const siteName = '${siteName}';

interface PageSEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
  noIndex?: boolean;
}

/**
 * Generate metadata for a page
 * Use in page.tsx: export const metadata = generateMetadata({ ... })
 */
export function generatePageMetadata({
  title,
  description,
  path = '',
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  authors,
  tags,
  noIndex = false,
}: PageSEOProps): Metadata {
  const url = \`\${baseUrl}\${path}\`;
  const ogImage = image || '/og-image.png';

  return {
    title,
    description,
    
    robots: noIndex ? { index: false, follow: false } : undefined,
    
    alternates: {
      canonical: url,
    },
    
    openGraph: {
      title,
      description,
      url,
      siteName,
      type,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      ...(type === 'article' && {
        publishedTime,
        modifiedTime,
        authors,
        tags,
      }),
    },
    
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Generate JSON-LD for articles
 */
export function generateArticleJsonLd(article: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  author: { name: string; url?: string };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: article.url,
    image: article.image,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: {
        '@type': 'ImageObject',
        url: \`\${baseUrl}/logo.png\`,
      },
    },
  };
}

/**
 * Generate JSON-LD for products
 */
export function generateProductJsonLd(product: {
  name: string;
  description: string;
  image: string;
  price: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  rating?: { value: number; count: number };
  brand?: string;
  sku?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'USD',
      availability: \`https://schema.org/\${product.availability || 'InStock'}\`,
    },
    ...(product.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.value,
        reviewCount: product.rating.count,
      },
    }),
  };
}

/**
 * Generate JSON-LD for FAQ pages
 */
export function generateFAQJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}`,
        explanation: 'SEO utility functions for generating metadata and JSON-LD.',
      },
    ],
  };
}

// ============================================================================
// NUXT 3 - Comprehensive useHead composable
// ============================================================================

export function generateNuxtSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image, twitterHandle, locale } = options;
  
  return {
    file: 'composables/useSEO.ts',
    code: `/**
 * Comprehensive SEO composable for Nuxt 3
 * 
 * Features:
 * - Full Open Graph support
 * - Twitter Cards
 * - JSON-LD structured data
 * - Canonical URLs
 * - Robots directives
 * - Internationalization
 */

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  
  // Article-specific
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  
  // Robots
  noIndex?: boolean;
  noFollow?: boolean;
  
  // Structured data
  schema?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_NAME = '${siteName}';
const SITE_URL = '${siteUrl}';
const DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}';
const TWITTER_HANDLE = '${twitterHandle || ''}';
const DEFAULT_LOCALE = '${locale || 'en_US'}';
const DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}';

export function useSEO(options: SEOOptions = {}) {
  const route = useRoute();
  
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    image = DEFAULT_IMAGE,
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author,
    tags,
    noIndex = false,
    noFollow = false,
    schema,
  } = options;

  const pageUrl = url || \`\${SITE_URL}\${route.path}\`;
  const fullTitle = title 
    ? (title.includes(SITE_NAME) ? title : \`\${title} | \${SITE_NAME}\`)
    : SITE_NAME;
  const imageUrl = image.startsWith('http') ? image : \`\${SITE_URL}\${image}\`;
  
  const robotsContent = [
    noIndex ? 'noindex' : 'index',
    noFollow ? 'nofollow' : 'follow',
  ].join(', ');

  // Build meta array
  const meta = [
    { name: 'description', content: description },
    { name: 'robots', content: robotsContent },
    
    // Open Graph
    { property: 'og:type', content: type },
    { property: 'og:url', content: pageUrl },
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: DEFAULT_LOCALE },
    
    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: fullTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
  ];

  // Add Twitter handle if configured
  if (TWITTER_HANDLE) {
    meta.push(
      { name: 'twitter:site', content: TWITTER_HANDLE },
      { name: 'twitter:creator', content: TWITTER_HANDLE }
    );
  }

  // Add article-specific meta
  if (type === 'article') {
    if (publishedTime) meta.push({ property: 'article:published_time', content: publishedTime });
    if (modifiedTime) meta.push({ property: 'article:modified_time', content: modifiedTime });
    if (author) meta.push({ property: 'article:author', content: author });
    tags?.forEach(tag => meta.push({ property: 'article:tag', content: tag }));
  }

  // Build JSON-LD
  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };

  const jsonLd = schema 
    ? Array.isArray(schema) 
      ? [defaultSchema, ...schema]
      : [defaultSchema, schema]
    : [defaultSchema];

  useHead({
    title: fullTitle,
    meta,
    link: [
      { rel: 'canonical', href: pageUrl },
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(jsonLd),
      },
    ],
  });
}

/**
 * Schema generators for common types
 */
export const Schema = {
  article: (data: {
    headline: string;
    description: string;
    image: string;
    datePublished: string;
    dateModified?: string;
    author: { name: string; url?: string };
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: { '@type': 'Person', ...data.author },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }),

  product: (data: {
    name: string;
    description: string;
    image: string;
    price: number;
    currency?: string;
    availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  }) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    offers: {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.currency || 'USD',
      availability: \`https://schema.org/\${data.availability || 'InStock'}\`,
    },
  }),

  faq: (items: { question: string; answer: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }),

  breadcrumb: (items: { name: string; url: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }),
};`,
    explanation: `Nuxt 3 comprehensive SEO composable with:
• Full useHead integration
• Open Graph with article support
• Twitter Cards
• JSON-LD schema generators
• Robots directives
• Canonical URLs

Usage: useSEO({ title: 'Page', description: '...' })`,
    additionalFiles: [
      {
        file: 'server/routes/sitemap.xml.ts',
        code: `import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';

export default defineEventHandler(async () => {
  const baseUrl = '${siteUrl}';
  
  // Define your pages
  const pages = [
    { url: '/', changefreq: 'daily', priority: 1 },
    { url: '/about', changefreq: 'monthly', priority: 0.8 },
    { url: '/pricing', changefreq: 'weekly', priority: 0.9 },
    { url: '/blog', changefreq: 'daily', priority: 0.8 },
  ];

  // Add dynamic pages from your database
  // const posts = await $fetch('/api/posts');
  // posts.forEach(post => pages.push({
  //   url: \`/blog/\${post.slug}\`,
  //   changefreq: 'weekly',
  //   priority: 0.7,
  //   lastmod: post.updatedAt,
  // }));

  const stream = new SitemapStream({ hostname: baseUrl });
  
  return streamToPromise(Readable.from(pages).pipe(stream)).then((data) =>
    data.toString()
  );
});`,
        explanation: 'Dynamic sitemap generator for Nuxt.',
      },
      {
        file: 'public/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

User-agent: GPTBot
Allow: /

Sitemap: ${siteUrl}/sitemap.xml`,
        explanation: 'Robots.txt with AI crawler support.',
      },
    ],
  };
}

// ============================================================================
// VUE.JS (without Nuxt) - @unhead/vue
// ============================================================================

export function generateVueSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'src/composables/useSEO.ts',
    code: `import { useHead, useServerHead } from '@unhead/vue';
import { computed, unref, MaybeRef } from 'vue';
import { useRoute } from 'vue-router';

interface SEOOptions {
  title?: MaybeRef<string>;
  description?: MaybeRef<string>;
  image?: MaybeRef<string>;
  type?: 'website' | 'article';
  noIndex?: boolean;
  schema?: Record<string, unknown>;
}

const SITE_NAME = '${siteName}';
const SITE_URL = '${siteUrl}';
const DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}';
const DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}';
const TWITTER_HANDLE = '${twitterHandle || ''}';

export function useSEO(options: SEOOptions = {}) {
  const route = useRoute();
  
  const title = computed(() => {
    const t = unref(options.title);
    return t ? (t.includes(SITE_NAME) ? t : \`\${t} | \${SITE_NAME}\`) : SITE_NAME;
  });
  
  const description = computed(() => unref(options.description) || DEFAULT_DESCRIPTION);
  const image = computed(() => {
    const img = unref(options.image) || DEFAULT_IMAGE;
    return img.startsWith('http') ? img : \`\${SITE_URL}\${img}\`;
  });
  const url = computed(() => \`\${SITE_URL}\${route.path}\`);
  
  useHead({
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: options.noIndex ? 'noindex, nofollow' : 'index, follow' },
      
      // Open Graph
      { property: 'og:type', content: options.type || 'website' },
      { property: 'og:url', content: url },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:site_name', content: SITE_NAME },
      
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      ...(TWITTER_HANDLE ? [
        { name: 'twitter:site', content: TWITTER_HANDLE },
        { name: 'twitter:creator', content: TWITTER_HANDLE },
      ] : []),
    ],
    link: [
      { rel: 'canonical', href: url },
    ],
    script: options.schema ? [
      { type: 'application/ld+json', innerHTML: JSON.stringify(options.schema) },
    ] : [],
  });
}`,
    explanation: `Vue 3 SEO composable using @unhead/vue with:
• Reactive title/description
• Open Graph and Twitter Cards
• JSON-LD schema support
• Canonical URLs

Install: npm install @unhead/vue`,
    installCommands: ['npm install @unhead/vue'],
    additionalFiles: [
      {
        file: 'src/main.ts',
        code: `import { createApp } from 'vue';
import { createHead } from '@unhead/vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

const app = createApp(App);
const head = createHead();
const router = createRouter({
  history: createWebHistory(),
  routes: [/* your routes */],
});

app.use(head);
app.use(router);
app.mount('#app');`,
        explanation: 'Vue app setup with @unhead/vue.',
      },
    ],
  };
}

// ============================================================================
// ASTRO - Comprehensive BaseHead component
// ============================================================================

export function generateAstroBaseHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle, locale } = options;
  
  return {
    file: 'src/components/BaseHead.astro',
    code: `---
/**
 * Comprehensive SEO Head Component for Astro
 * 
 * Features:
 * - Full Open Graph support
 * - Twitter Cards
 * - JSON-LD structured data
 * - Canonical URLs
 * - Robots directives
 * - Performance optimizations
 */

interface Props {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  noIndex?: boolean;
  schema?: Record<string, unknown>;
}

const SITE_NAME = '${siteName}';
const SITE_URL = '${siteUrl}';
const DEFAULT_IMAGE = '${image || '/og-image.png'}';
const DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}';
const TWITTER_HANDLE = '${twitterHandle || ''}';
const DEFAULT_LOCALE = '${locale || 'en_US'}';

const {
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  tags,
  noIndex = false,
  schema,
} = Astro.props;

const canonicalURL = new URL(Astro.url.pathname, Astro.site || SITE_URL);
const fullTitle = title 
  ? (title.includes(SITE_NAME) ? title : \`\${title} | \${SITE_NAME}\`)
  : SITE_NAME;
const imageURL = new URL(image, Astro.site || SITE_URL);
const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';

// Default website schema
const defaultSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
};

const jsonLd = schema ? [defaultSchema, schema] : [defaultSchema];
---

<!-- Global Metadata -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="generator" content={Astro.generator} />

<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />

<!-- Canonical URL -->
<link rel="canonical" href={canonicalURL} />

<!-- Primary Meta Tags -->
<title>{fullTitle}</title>
<meta name="title" content={fullTitle} />
<meta name="description" content={description} />
<meta name="robots" content={robotsContent} />

<!-- Theme -->
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content={type} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:image" content={imageURL} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content={fullTitle} />
<meta property="og:site_name" content={SITE_NAME} />
<meta property="og:locale" content={DEFAULT_LOCALE} />

{type === 'article' && publishedTime && (
  <meta property="article:published_time" content={publishedTime} />
)}
{type === 'article' && modifiedTime && (
  <meta property="article:modified_time" content={modifiedTime} />
)}
{type === 'article' && author && (
  <meta property="article:author" content={author} />
)}
{type === 'article' && tags?.map((tag) => (
  <meta property="article:tag" content={tag} />
))}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content={canonicalURL} />
<meta name="twitter:title" content={fullTitle} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={imageURL} />
<meta name="twitter:image:alt" content={fullTitle} />
{TWITTER_HANDLE && <meta name="twitter:site" content={TWITTER_HANDLE} />}
{TWITTER_HANDLE && <meta name="twitter:creator" content={TWITTER_HANDLE} />}

<!-- Performance: Preconnect to external origins -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- JSON-LD Structured Data -->
<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />`,
    explanation: `Astro comprehensive SEO component with:
• Full Open Graph with article support
• Twitter Cards
• JSON-LD structured data
• Performance optimizations (preconnect)
• Theme color for PWA
• Favicon configuration

Usage: <BaseHead title="Page" description="..." />`,
    additionalFiles: [
      {
        file: 'src/layouts/BaseLayout.astro',
        code: `---
import BaseHead from '../components/BaseHead.astro';

interface Props {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  schema?: Record<string, unknown>;
}

const { title, description, image, type, schema } = Astro.props;
---

<!DOCTYPE html>
<html lang="${(locale || 'en_US').split('_')[0]}">
  <head>
    <BaseHead 
      title={title} 
      description={description} 
      image={image}
      type={type}
      schema={schema}
    />
  </head>
  <body>
    <slot />
  </body>
</html>`,
        explanation: 'Base layout using the SEO head component.',
      },
      {
        file: 'public/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /api/

User-agent: GPTBot
Allow: /

Sitemap: ${siteUrl}/sitemap-index.xml`,
        explanation: 'Robots.txt with AI crawler support.',
      },
    ],
  };
}

// ============================================================================
// SVELTEKIT - Comprehensive svelte:head
// ============================================================================

export function generateSvelteKitSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'src/lib/components/SEOHead.svelte',
    code: `<script lang="ts">
  import { page } from '$app/stores';

  export let title: string | undefined = undefined;
  export let description: string = '${description || `${siteName} - A compelling description.`}';
  export let image: string = '${image || `${siteUrl}/og-image.png`}';
  export let type: 'website' | 'article' = 'website';
  export let publishedTime: string | undefined = undefined;
  export let modifiedTime: string | undefined = undefined;
  export let author: string | undefined = undefined;
  export let tags: string[] = [];
  export let noIndex: boolean = false;
  export let schema: Record<string, unknown> | undefined = undefined;

  const SITE_NAME = '${siteName}';
  const SITE_URL = '${siteUrl}';
  const TWITTER_HANDLE = '${twitterHandle || ''}';

  $: fullTitle = title 
    ? (title.includes(SITE_NAME) ? title : \`\${title} | \${SITE_NAME}\`)
    : SITE_NAME;
  $: canonicalUrl = $page.url.href;
  $: imageUrl = image.startsWith('http') ? image : \`\${SITE_URL}\${image}\`;
  $: robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';

  $: defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };

  $: jsonLd = schema ? [defaultSchema, schema] : [defaultSchema];
</script>

<svelte:head>
  <!-- Primary Meta Tags -->
  <title>{fullTitle}</title>
  <meta name="title" content={fullTitle} />
  <meta name="description" content={description} />
  <meta name="robots" content={robotsContent} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content={SITE_NAME} />

  {#if type === 'article'}
    {#if publishedTime}
      <meta property="article:published_time" content={publishedTime} />
    {/if}
    {#if modifiedTime}
      <meta property="article:modified_time" content={modifiedTime} />
    {/if}
    {#if author}
      <meta property="article:author" content={author} />
    {/if}
    {#each tags as tag}
      <meta property="article:tag" content={tag} />
    {/each}
  {/if}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  {#if TWITTER_HANDLE}
    <meta name="twitter:site" content={TWITTER_HANDLE} />
    <meta name="twitter:creator" content={TWITTER_HANDLE} />
  {/if}

  <!-- JSON-LD Structured Data -->
  {@html \`<script type="application/ld+json">\${JSON.stringify(jsonLd)}</script>\`}
</svelte:head>`,
    explanation: `SvelteKit comprehensive SEO component with:
• Reactive props
• Full Open Graph with article support
• Twitter Cards
• JSON-LD structured data
• Robots directives

Usage: <SEOHead title="Page" description="..." />`,
    additionalFiles: [
      {
        file: 'src/routes/+layout.svelte',
        code: `<script lang="ts">
  import '../app.css';
</script>

<slot />`,
        explanation: 'Root layout.',
      },
      {
        file: 'static/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /api/

User-agent: GPTBot
Allow: /

Sitemap: ${siteUrl}/sitemap.xml`,
        explanation: 'Robots.txt with AI crawler support.',
      },
    ],
  };
}

// ============================================================================
// ANGULAR - Comprehensive SEO Service
// ============================================================================

export function generateAngularSEOService(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'src/app/core/services/seo.service.ts',
    code: `import { Injectable, Inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  noIndex?: boolean;
  schema?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class SEOService {
  private readonly siteName = '${siteName}';
  private readonly siteUrl = '${siteUrl}';
  private readonly defaultDescription = '${description || `${siteName} - A compelling description.`}';
  private readonly defaultImage = '${image || `${siteUrl}/og-image.png`}';
  private readonly twitterHandle = '${twitterHandle || ''}';

  constructor(
    private meta: Meta,
    private titleService: Title,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {
    // Update canonical URL on route change
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateCanonical();
    });
  }

  /**
   * Update all SEO meta tags
   */
  updateMeta(config: SEOConfig = {}): void {
    const {
      title,
      description = this.defaultDescription,
      image = this.defaultImage,
      type = 'website',
      publishedTime,
      modifiedTime,
      author,
      tags,
      noIndex = false,
      schema,
    } = config;

    const fullTitle = title 
      ? (title.includes(this.siteName) ? title : \`\${title} | \${this.siteName}\`)
      : this.siteName;
    const pageUrl = this.siteUrl + this.router.url;
    const imageUrl = image.startsWith('http') ? image : \`\${this.siteUrl}\${image}\`;
    const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';

    // Title
    this.titleService.setTitle(fullTitle);

    // Primary Meta Tags
    this.setMetaTag('description', description);
    this.setMetaTag('robots', robotsContent);

    // Open Graph
    this.setMetaProperty('og:type', type);
    this.setMetaProperty('og:url', pageUrl);
    this.setMetaProperty('og:title', fullTitle);
    this.setMetaProperty('og:description', description);
    this.setMetaProperty('og:image', imageUrl);
    this.setMetaProperty('og:image:width', '1200');
    this.setMetaProperty('og:image:height', '630');
    this.setMetaProperty('og:site_name', this.siteName);

    // Article-specific
    if (type === 'article') {
      if (publishedTime) this.setMetaProperty('article:published_time', publishedTime);
      if (modifiedTime) this.setMetaProperty('article:modified_time', modifiedTime);
      if (author) this.setMetaProperty('article:author', author);
      tags?.forEach(tag => this.setMetaProperty('article:tag', tag));
    }

    // Twitter
    this.setMetaTag('twitter:card', 'summary_large_image');
    this.setMetaTag('twitter:title', fullTitle);
    this.setMetaTag('twitter:description', description);
    this.setMetaTag('twitter:image', imageUrl);
    if (this.twitterHandle) {
      this.setMetaTag('twitter:site', this.twitterHandle);
      this.setMetaTag('twitter:creator', this.twitterHandle);
    }

    // Update canonical
    this.updateCanonical(pageUrl);

    // Update JSON-LD
    this.updateJsonLd(schema);
  }

  private setMetaTag(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setMetaProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private updateCanonical(url?: string): void {
    const canonicalUrl = url || this.siteUrl + this.router.url;
    let link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    
    link.setAttribute('href', canonicalUrl);
  }

  private updateJsonLd(schema?: Record<string, unknown>): void {
    // Remove existing JSON-LD
    const existing = this.document.querySelector('script[type="application/ld+json"]');
    if (existing) existing.remove();

    // Add new JSON-LD
    const defaultSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.siteName,
      url: this.siteUrl,
    };

    const jsonLd = schema ? [defaultSchema, schema] : [defaultSchema];

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(jsonLd);
    this.document.head.appendChild(script);
  }

  /**
   * Generate Article schema
   */
  articleSchema(data: {
    headline: string;
    description: string;
    image: string;
    datePublished: string;
    dateModified?: string;
    author: { name: string; url?: string };
  }): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.headline,
      description: data.description,
      image: data.image,
      datePublished: data.datePublished,
      dateModified: data.dateModified || data.datePublished,
      author: { '@type': 'Person', ...data.author },
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        url: this.siteUrl,
      },
    };
  }

  /**
   * Generate Product schema
   */
  productSchema(data: {
    name: string;
    description: string;
    image: string;
    price: number;
    currency?: string;
  }): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: data.name,
      description: data.description,
      image: data.image,
      offers: {
        '@type': 'Offer',
        price: data.price,
        priceCurrency: data.currency || 'USD',
        availability: 'https://schema.org/InStock',
      },
    };
  }

  /**
   * Generate FAQ schema
   */
  faqSchema(items: { question: string; answer: string }[]): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    };
  }
}`,
    explanation: `Angular comprehensive SEO service with:
• Meta and Title service integration
• Dynamic canonical URL updates
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schema generators
• Automatic route change handling

Usage: Inject SEOService and call updateMeta()`,
  };
}

// ============================================================================
// Helper: Get framework-specific fix based on detected framework
// ============================================================================

export function getFrameworkSpecificFix(
  framework: FrameworkInfo,
  options: MetaFixOptions
): GeneratedCode {
  const name = framework.name.toLowerCase();
  
  if (name.includes('next')) {
    if (framework.router === 'app') {
      return generateNextJsAppRouterMetadata(options);
    } else {
      return generateNextJsPagesRouterHead(options);
    }
  }
  
  if (name.includes('nuxt')) {
    return generateNuxtSEOHead(options);
  }
  
  if (name.includes('vue')) {
    return generateVueSEOHead(options);
  }
  
  if (name.includes('astro')) {
    return generateAstroBaseHead(options);
  }
  
  if (name.includes('svelte')) {
    return generateSvelteKitSEOHead(options);
  }
  
  if (name.includes('angular')) {
    return generateAngularSEOService(options);
  }
  
  // Default: React with react-helmet-async
  return generateReactSEOHead(options);
}

// ============================================================================
// Next.js Pages Router (for completeness)
// ============================================================================

export function generateNextJsPagesRouterHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'components/SEOHead.tsx',
    code: `import Head from 'next/head';
import { useRouter } from 'next/router';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  noIndex?: boolean;
  schema?: Record<string, unknown>;
}

const SITE_NAME = '${siteName}';
const SITE_URL = '${siteUrl}';
const DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}';
const DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}';
const TWITTER_HANDLE = '${twitterHandle || ''}';

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  type = 'website',
  publishedTime,
  modifiedTime,
  noIndex = false,
  schema,
}: SEOHeadProps) {
  const router = useRouter();
  
  const fullTitle = title 
    ? (title.includes(SITE_NAME) ? title : \`\${title} | \${SITE_NAME}\`)
    : SITE_NAME;
  const pageUrl = \`\${SITE_URL}\${router.asPath}\`;
  const imageUrl = image.startsWith('http') ? image : \`\${SITE_URL}\${image}\`;
  const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';

  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };

  const jsonLd = schema ? [defaultSchema, schema] : [defaultSchema];

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={pageUrl} />
      
      <meta property="og:type" content={type} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      {TWITTER_HANDLE && <meta name="twitter:site" content={TWITTER_HANDLE} />}
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  );
}`,
    explanation: `Next.js Pages Router SEO component with:
• Full Open Graph support
• Twitter Cards
• JSON-LD structured data
• Article metadata
• Canonical URLs

Usage: <SEOHead title="Page" description="..." />`,
  };
}
