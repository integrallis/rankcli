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

// ============================================================================
// RUBY ON RAILS - Comprehensive meta-tags gem integration
// ============================================================================

export function generateRailsSEOHelper(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'app/helpers/seo_helper.rb',
    code: `# frozen_string_literal: true

# Comprehensive SEO Helper for Rails
#
# Features:
# - Full Open Graph support
# - Twitter Cards
# - JSON-LD structured data
# - Canonical URLs
# - Dynamic meta tags
#
# Installation: gem 'meta-tags'
# Include in ApplicationHelper or use directly
module SeoHelper
  SITE_NAME = '${siteName}'.freeze
  SITE_URL = '${siteUrl}'.freeze
  DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}'.freeze
  DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}'.freeze
  TWITTER_HANDLE = '${twitterHandle || ''}'.freeze

  # Set comprehensive page SEO
  #
  # @param title [String] Page title
  # @param description [String] Meta description
  # @param image [String] OG/Twitter image URL
  # @param type [Symbol] :website, :article, :product
  # @param options [Hash] Additional options
  #
  # @example
  #   set_page_seo(
  #     title: 'Product Name',
  #     description: 'Product description',
  #     type: :product,
  #     schema: product_schema(@product)
  #   )
  def set_page_seo(title: nil, description: nil, image: nil, type: :website, **options)
    page_title = title || SITE_NAME
    page_description = description || DEFAULT_DESCRIPTION
    page_image = image || DEFAULT_IMAGE
    page_url = request.original_url

    set_meta_tags(
      title: page_title,
      site: SITE_NAME,
      description: page_description,
      canonical: page_url,
      robots: options[:noindex] ? 'noindex, nofollow' : 'index, follow',

      # Open Graph
      og: {
        title: page_title,
        description: page_description,
        type: type.to_s,
        url: page_url,
        image: {
          _: page_image,
          width: 1200,
          height: 630,
          alt: page_title
        },
        site_name: SITE_NAME,
        locale: options[:locale] || 'en_US'
      },

      # Twitter Cards
      twitter: {
        card: 'summary_large_image',
        title: page_title,
        description: page_description,
        image: page_image,
        site: TWITTER_HANDLE.presence,
        creator: TWITTER_HANDLE.presence
      }.compact,

      # Article-specific
      article: if type == :article
        {
          published_time: options[:published_at]&.iso8601,
          modified_time: options[:updated_at]&.iso8601,
          author: options[:author],
          section: options[:section],
          tag: options[:tags]
        }.compact
      end
    )

    # Store schema for JSON-LD rendering
    @json_ld_schemas = [default_website_schema]
    @json_ld_schemas << options[:schema] if options[:schema]
  end

  # Render JSON-LD structured data
  def json_ld_tags
    return unless @json_ld_schemas&.any?

    safe_join(@json_ld_schemas.map do |schema|
      content_tag(:script, schema.to_json.html_safe, type: 'application/ld+json')
    end)
  end

  # Schema generators
  def default_website_schema
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL
    }
  end

  def organization_schema(name: SITE_NAME, url: SITE_URL, logo: nil, social: [])
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: name,
      url: url,
      logo: logo,
      sameAs: social
    }.compact
  end

  def article_schema(article)
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.excerpt || truncate(strip_tags(article.content), length: 160),
      image: article.image_url || DEFAULT_IMAGE,
      datePublished: article.published_at&.iso8601,
      dateModified: article.updated_at&.iso8601,
      author: {
        '@type': 'Person',
        name: article.author_name
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        logo: { '@type': 'ImageObject', url: "\#{SITE_URL}/logo.png" }
      }
    }
  end

  def product_schema(product)
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.image_url,
      brand: product.brand.present? ? { '@type': 'Brand', name: product.brand } : nil,
      sku: product.sku,
      offers: {
        '@type': 'Offer',
        price: product.price.to_s,
        priceCurrency: product.currency || 'USD',
        availability: "https://schema.org/\#{product.in_stock? ? 'InStock' : 'OutOfStock'}"
      },
      aggregateRating: product.reviews_count.positive? ? {
        '@type': 'AggregateRating',
        ratingValue: product.average_rating,
        reviewCount: product.reviews_count
      } : nil
    }.compact
  end

  def faq_schema(items)
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map do |item|
        {
          '@type': 'Question',
          name: item[:question],
          acceptedAnswer: { '@type': 'Answer', text: item[:answer] }
        }
      end
    }
  end

  def breadcrumb_schema(items)
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.each_with_index.map do |item, index|
        {
          '@type': 'ListItem',
          position: index + 1,
          name: item[:name],
          item: item[:url]
        }
      end
    }
  end

  def local_business_schema(business)
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: business[:name],
      description: business[:description],
      url: business[:url],
      telephone: business[:phone],
      address: {
        '@type': 'PostalAddress',
        streetAddress: business.dig(:address, :street),
        addressLocality: business.dig(:address, :city),
        addressRegion: business.dig(:address, :state),
        postalCode: business.dig(:address, :zip),
        addressCountry: business.dig(:address, :country)
      },
      geo: business[:coordinates].present? ? {
        '@type': 'GeoCoordinates',
        latitude: business.dig(:coordinates, :lat),
        longitude: business.dig(:coordinates, :lng)
      } : nil,
      openingHours: business[:hours],
      priceRange: business[:price_range]
    }.compact
  end
end`,
    explanation: `Ruby on Rails comprehensive SEO helper with:
• meta-tags gem integration
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schema generators for all common types
• Canonical URLs and robots directives

Setup:
1. Add to Gemfile: gem 'meta-tags'
2. Include helper in ApplicationHelper
3. Call set_page_seo in controllers
4. Add <%= display_meta_tags %> and <%= json_ld_tags %> to layout`,
    installCommands: ['bundle add meta-tags'],
    additionalFiles: [
      {
        file: 'app/views/layouts/application.html.erb',
        code: `<!DOCTYPE html>
<html lang="<%= I18n.locale %>">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <%= display_meta_tags %>
    <%= csrf_meta_tags %>
    <%= csp_meta_tag %>
    
    <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
    <%= javascript_importmap_tags %>
    
    <!-- Favicon -->
    <%= favicon_link_tag 'favicon.ico' %>
    <%= favicon_link_tag 'apple-touch-icon.png', rel: 'apple-touch-icon', type: 'image/png', sizes: '180x180' %>
    
    <!-- JSON-LD Structured Data -->
    <%= json_ld_tags %>
  </head>
  <body>
    <%= yield %>
  </body>
</html>`,
        explanation: 'Application layout with SEO meta tags and JSON-LD.',
      },
      {
        file: 'config/initializers/meta_tags.rb',
        code: `# frozen_string_literal: true

MetaTags.configure do |config|
  # Use title template
  config.title_limit = 70
  config.description_limit = 160
  config.keywords_limit = 255
  
  # Truncate long strings
  config.truncate_on_bytesize = true
  
  # Separate site name with |
  config.title_separator = ' | '
end`,
        explanation: 'meta-tags gem configuration.',
      },
      {
        file: 'public/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// DJANGO - Comprehensive SEO with django-meta
// ============================================================================

export function generateDjangoSEOHelper(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'core/seo.py',
    code: `"""
Comprehensive SEO utilities for Django

Features:
- Full Open Graph support
- Twitter Cards  
- JSON-LD structured data
- Canonical URLs
- Template tags and context processors

Installation: pip install django-meta
"""

from django.conf import settings
from django.utils.safestring import mark_safe
import json
from typing import Any, Optional
from dataclasses import dataclass, field


# Configuration
SITE_NAME = '${siteName}'
SITE_URL = '${siteUrl}'
DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}'
DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}'
TWITTER_HANDLE = '${twitterHandle || ''}'


@dataclass
class SEOMeta:
    """SEO metadata container"""
    title: Optional[str] = None
    description: str = DEFAULT_DESCRIPTION
    image: str = DEFAULT_IMAGE
    url: Optional[str] = None
    type: str = 'website'
    
    # Article specific
    published_time: Optional[str] = None
    modified_time: Optional[str] = None
    author: Optional[str] = None
    tags: list = field(default_factory=list)
    
    # Robots
    noindex: bool = False
    nofollow: bool = False
    
    # Structured data
    schema: Optional[dict] = None
    
    def get_full_title(self) -> str:
        if not self.title:
            return SITE_NAME
        if SITE_NAME in self.title:
            return self.title
        return f"{self.title} | {SITE_NAME}"
    
    def get_image_url(self) -> str:
        if self.image.startswith('http'):
            return self.image
        return f"{SITE_URL}{self.image}"
    
    def get_robots(self) -> str:
        index = 'noindex' if self.noindex else 'index'
        follow = 'nofollow' if self.nofollow else 'follow'
        return f"{index}, {follow}"


class SEOContextMixin:
    """
    Mixin for class-based views to add SEO context
    
    Usage:
        class ArticleDetailView(SEOContextMixin, DetailView):
            model = Article
            
            def get_seo_meta(self):
                return SEOMeta(
                    title=self.object.title,
                    description=self.object.excerpt,
                    image=self.object.image.url if self.object.image else None,
                    type='article',
                    published_time=self.object.published_at.isoformat(),
                    schema=article_schema(self.object)
                )
    """
    
    def get_seo_meta(self) -> SEOMeta:
        return SEOMeta()
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['seo'] = self.get_seo_meta()
        return context


def seo_context_processor(request):
    """
    Context processor to add default SEO values
    
    Add to settings.TEMPLATES[0]['OPTIONS']['context_processors']
    """
    return {
        'site_name': SITE_NAME,
        'site_url': SITE_URL,
        'default_og_image': DEFAULT_IMAGE,
    }


# JSON-LD Schema Generators

def website_schema() -> dict:
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': SITE_NAME,
        'url': SITE_URL,
    }


def organization_schema(
    name: str = SITE_NAME,
    url: str = SITE_URL,
    logo: Optional[str] = None,
    social_profiles: list = None
) -> dict:
    schema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': name,
        'url': url,
    }
    if logo:
        schema['logo'] = logo
    if social_profiles:
        schema['sameAs'] = social_profiles
    return schema


def article_schema(article) -> dict:
    """Generate Article schema from model instance"""
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': article.title,
        'description': getattr(article, 'excerpt', '') or article.content[:160],
        'image': article.image.url if hasattr(article, 'image') and article.image else DEFAULT_IMAGE,
        'datePublished': article.published_at.isoformat() if hasattr(article, 'published_at') else None,
        'dateModified': article.updated_at.isoformat() if hasattr(article, 'updated_at') else None,
        'author': {
            '@type': 'Person',
            'name': str(article.author) if hasattr(article, 'author') else 'Unknown',
        },
        'publisher': {
            '@type': 'Organization',
            'name': SITE_NAME,
            'logo': {'@type': 'ImageObject', 'url': f'{SITE_URL}/static/logo.png'},
        },
    }


def product_schema(product) -> dict:
    """Generate Product schema from model instance"""
    schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': product.name,
        'description': product.description,
        'image': product.image.url if hasattr(product, 'image') and product.image else DEFAULT_IMAGE,
        'offers': {
            '@type': 'Offer',
            'price': str(product.price),
            'priceCurrency': getattr(product, 'currency', 'USD'),
            'availability': f"https://schema.org/{'InStock' if product.in_stock else 'OutOfStock'}",
        },
    }
    
    if hasattr(product, 'brand') and product.brand:
        schema['brand'] = {'@type': 'Brand', 'name': product.brand}
    
    if hasattr(product, 'sku') and product.sku:
        schema['sku'] = product.sku
    
    if hasattr(product, 'average_rating') and hasattr(product, 'review_count'):
        if product.review_count > 0:
            schema['aggregateRating'] = {
                '@type': 'AggregateRating',
                'ratingValue': product.average_rating,
                'reviewCount': product.review_count,
            }
    
    return schema


def faq_schema(items: list[dict]) -> dict:
    """Generate FAQ schema from list of {question, answer} dicts"""
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
            {
                '@type': 'Question',
                'name': item['question'],
                'acceptedAnswer': {'@type': 'Answer', 'text': item['answer']},
            }
            for item in items
        ],
    }


def breadcrumb_schema(items: list[dict]) -> dict:
    """Generate Breadcrumb schema from list of {name, url} dicts"""
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {
                '@type': 'ListItem',
                'position': i + 1,
                'name': item['name'],
                'item': item['url'],
            }
            for i, item in enumerate(items)
        ],
    }


def local_business_schema(business: dict) -> dict:
    """Generate LocalBusiness schema"""
    schema = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        'name': business['name'],
        'description': business.get('description', ''),
        'url': business.get('url', SITE_URL),
        'telephone': business.get('phone'),
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': business.get('address', {}).get('street'),
            'addressLocality': business.get('address', {}).get('city'),
            'addressRegion': business.get('address', {}).get('state'),
            'postalCode': business.get('address', {}).get('zip'),
            'addressCountry': business.get('address', {}).get('country'),
        },
    }
    
    if business.get('coordinates'):
        schema['geo'] = {
            '@type': 'GeoCoordinates',
            'latitude': business['coordinates']['lat'],
            'longitude': business['coordinates']['lng'],
        }
    
    if business.get('hours'):
        schema['openingHours'] = business['hours']
    
    if business.get('price_range'):
        schema['priceRange'] = business['price_range']
    
    return schema


def render_json_ld(*schemas) -> str:
    """Render JSON-LD script tags for templates"""
    all_schemas = [website_schema()] + list(schemas)
    scripts = '\\n'.join(
        f'<script type="application/ld+json">{json.dumps(s)}</script>'
        for s in all_schemas if s
    )
    return mark_safe(scripts)`,
    explanation: `Django comprehensive SEO module with:
• SEOMeta dataclass for structured metadata
• SEOContextMixin for class-based views
• Context processor for global SEO values
• JSON-LD schema generators
• Template-ready helpers

Setup:
1. pip install django-meta
2. Add context processor to settings
3. Use SEOContextMixin in views
4. Include seo template tags in base.html`,
    installCommands: ['pip install django-meta'],
    additionalFiles: [
      {
        file: 'templates/base.html',
        code: `<!DOCTYPE html>
<html lang="{{ LANGUAGE_CODE }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    {% if seo %}
    <!-- Primary Meta Tags -->
    <title>{{ seo.get_full_title }}</title>
    <meta name="title" content="{{ seo.get_full_title }}">
    <meta name="description" content="{{ seo.description }}">
    <meta name="robots" content="{{ seo.get_robots }}">
    <link rel="canonical" href="{{ seo.url|default:request.build_absolute_uri }}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="{{ seo.type }}">
    <meta property="og:url" content="{{ seo.url|default:request.build_absolute_uri }}">
    <meta property="og:title" content="{{ seo.get_full_title }}">
    <meta property="og:description" content="{{ seo.description }}">
    <meta property="og:image" content="{{ seo.get_image_url }}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="{{ site_name }}">
    
    {% if seo.type == 'article' %}
    {% if seo.published_time %}<meta property="article:published_time" content="{{ seo.published_time }}">{% endif %}
    {% if seo.modified_time %}<meta property="article:modified_time" content="{{ seo.modified_time }}">{% endif %}
    {% if seo.author %}<meta property="article:author" content="{{ seo.author }}">{% endif %}
    {% for tag in seo.tags %}<meta property="article:tag" content="{{ tag }}">{% endfor %}
    {% endif %}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ seo.get_full_title }}">
    <meta name="twitter:description" content="{{ seo.description }}">
    <meta name="twitter:image" content="{{ seo.get_image_url }}">
    {% else %}
    <title>{{ site_name }}</title>
    {% endif %}
    
    {% load static %}
    <link rel="stylesheet" href="{% static 'css/styles.css' %}">
    
    <!-- JSON-LD Structured Data -->
    {% block json_ld %}{% endblock %}
</head>
<body>
    {% block content %}{% endblock %}
</body>
</html>`,
        explanation: 'Django base template with comprehensive SEO meta tags.',
      },
      {
        file: 'robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// LARAVEL - Comprehensive SEO with Blade components
// ============================================================================

export function generateLaravelSEOHelper(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'app/Services/SEOService.php',
    code: `<?php

namespace App\\Services;

use Illuminate\\Support\\Facades\\View;
use Illuminate\\Support\\HtmlString;

/**
 * Comprehensive SEO Service for Laravel
 *
 * Features:
 * - Full Open Graph support
 * - Twitter Cards
 * - JSON-LD structured data
 * - Canonical URLs
 * - Blade integration
 */
class SEOService
{
    public const SITE_NAME = '${siteName}';
    public const SITE_URL = '${siteUrl}';
    public const DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}';
    public const DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}';
    public const TWITTER_HANDLE = '${twitterHandle || ''}';

    protected array $meta = [];
    protected array $schemas = [];

    /**
     * Set page SEO metadata
     */
    public function setMeta(array $options): self
    {
        $this->meta = array_merge([
            'title' => null,
            'description' => self::DEFAULT_DESCRIPTION,
            'image' => self::DEFAULT_IMAGE,
            'url' => request()->url(),
            'type' => 'website',
            'published_time' => null,
            'modified_time' => null,
            'author' => null,
            'tags' => [],
            'noindex' => false,
            'nofollow' => false,
        ], $options);

        return $this;
    }

    /**
     * Add JSON-LD schema
     */
    public function addSchema(array $schema): self
    {
        $this->schemas[] = $schema;
        return $this;
    }

    /**
     * Get full page title
     */
    public function getFullTitle(): string
    {
        $title = $this->meta['title'] ?? null;

        if (!$title) {
            return self::SITE_NAME;
        }

        if (str_contains($title, self::SITE_NAME)) {
            return $title;
        }

        return "{$title} | " . self::SITE_NAME;
    }

    /**
     * Get absolute image URL
     */
    public function getImageUrl(): string
    {
        $image = $this->meta['image'] ?? self::DEFAULT_IMAGE;

        if (str_starts_with($image, 'http')) {
            return $image;
        }

        return self::SITE_URL . $image;
    }

    /**
     * Get robots directive
     */
    public function getRobots(): string
    {
        $index = ($this->meta['noindex'] ?? false) ? 'noindex' : 'index';
        $follow = ($this->meta['nofollow'] ?? false) ? 'nofollow' : 'follow';
        return "{$index}, {$follow}";
    }

    /**
     * Render all meta tags
     */
    public function render(): HtmlString
    {
        $html = view('components.seo-meta', [
            'seo' => $this,
            'meta' => $this->meta,
        ])->render();

        return new HtmlString($html);
    }

    /**
     * Render JSON-LD scripts
     */
    public function renderJsonLd(): HtmlString
    {
        $allSchemas = array_merge(
            [$this->websiteSchema()],
            $this->schemas
        );

        $scripts = collect($allSchemas)
            ->filter()
            ->map(fn($schema) => '<script type="application/ld+json">' . json_encode($schema) . '</script>')
            ->implode("\\n");

        return new HtmlString($scripts);
    }

    // Schema Generators

    public function websiteSchema(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => self::SITE_NAME,
            'url' => self::SITE_URL,
        ];
    }

    public function organizationSchema(
        ?string $name = null,
        ?string $url = null,
        ?string $logo = null,
        array $socialProfiles = []
    ): array {
        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Organization',
            'name' => $name ?? self::SITE_NAME,
            'url' => $url ?? self::SITE_URL,
            'logo' => $logo,
            'sameAs' => $socialProfiles ?: null,
        ]);
    }

    public function articleSchema($article): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'Article',
            'headline' => $article->title,
            'description' => $article->excerpt ?? substr(strip_tags($article->content), 0, 160),
            'image' => $article->image_url ?? self::DEFAULT_IMAGE,
            'datePublished' => optional($article->published_at)->toIso8601String(),
            'dateModified' => optional($article->updated_at)->toIso8601String(),
            'author' => [
                '@type' => 'Person',
                'name' => $article->author?->name ?? 'Unknown',
            ],
            'publisher' => [
                '@type' => 'Organization',
                'name' => self::SITE_NAME,
                'logo' => [
                    '@type' => 'ImageObject',
                    'url' => self::SITE_URL . '/logo.png',
                ],
            ],
        ];
    }

    public function productSchema($product): array
    {
        $schema = [
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            'name' => $product->name,
            'description' => $product->description,
            'image' => $product->image_url ?? self::DEFAULT_IMAGE,
            'offers' => [
                '@type' => 'Offer',
                'price' => (string) $product->price,
                'priceCurrency' => $product->currency ?? 'USD',
                'availability' => 'https://schema.org/' . ($product->in_stock ? 'InStock' : 'OutOfStock'),
            ],
        ];

        if ($product->brand) {
            $schema['brand'] = ['@type' => 'Brand', 'name' => $product->brand];
        }

        if ($product->sku) {
            $schema['sku'] = $product->sku;
        }

        if ($product->reviews_count > 0) {
            $schema['aggregateRating'] = [
                '@type' => 'AggregateRating',
                'ratingValue' => $product->average_rating,
                'reviewCount' => $product->reviews_count,
            ];
        }

        return $schema;
    }

    public function faqSchema(array $items): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => collect($items)->map(fn($item) => [
                '@type' => 'Question',
                'name' => $item['question'],
                'acceptedAnswer' => ['@type' => 'Answer', 'text' => $item['answer']],
            ])->all(),
        ];
    }

    public function breadcrumbSchema(array $items): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => collect($items)->map(fn($item, $index) => [
                '@type' => 'ListItem',
                'position' => $index + 1,
                'name' => $item['name'],
                'item' => $item['url'],
            ])->all(),
        ];
    }

    public function localBusinessSchema(array $business): array
    {
        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'LocalBusiness',
            'name' => $business['name'],
            'description' => $business['description'] ?? null,
            'url' => $business['url'] ?? self::SITE_URL,
            'telephone' => $business['phone'] ?? null,
            'address' => [
                '@type' => 'PostalAddress',
                'streetAddress' => $business['address']['street'] ?? null,
                'addressLocality' => $business['address']['city'] ?? null,
                'addressRegion' => $business['address']['state'] ?? null,
                'postalCode' => $business['address']['zip'] ?? null,
                'addressCountry' => $business['address']['country'] ?? null,
            ],
            'geo' => isset($business['coordinates']) ? [
                '@type' => 'GeoCoordinates',
                'latitude' => $business['coordinates']['lat'],
                'longitude' => $business['coordinates']['lng'],
            ] : null,
            'openingHours' => $business['hours'] ?? null,
            'priceRange' => $business['price_range'] ?? null,
        ]);
    }
}`,
    explanation: `Laravel comprehensive SEO service with:
• Fluent API for setting metadata
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schema generators
• Blade component integration

Setup:
1. Register SEOService in AppServiceProvider
2. Use @seo directive in Blade templates
3. Call SEO()->setMeta() in controllers`,
    additionalFiles: [
      {
        file: 'resources/views/components/seo-meta.blade.php',
        code: `{{-- Primary Meta Tags --}}
<title>{{ $seo->getFullTitle() }}</title>
<meta name="title" content="{{ $seo->getFullTitle() }}">
<meta name="description" content="{{ $meta['description'] }}">
<meta name="robots" content="{{ $seo->getRobots() }}">
<link rel="canonical" href="{{ $meta['url'] }}">

{{-- Open Graph / Facebook --}}
<meta property="og:type" content="{{ $meta['type'] }}">
<meta property="og:url" content="{{ $meta['url'] }}">
<meta property="og:title" content="{{ $seo->getFullTitle() }}">
<meta property="og:description" content="{{ $meta['description'] }}">
<meta property="og:image" content="{{ $seo->getImageUrl() }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="{{ $seo::SITE_NAME }}">

@if($meta['type'] === 'article')
    @if($meta['published_time'])
    <meta property="article:published_time" content="{{ $meta['published_time'] }}">
    @endif
    @if($meta['modified_time'])
    <meta property="article:modified_time" content="{{ $meta['modified_time'] }}">
    @endif
    @if($meta['author'])
    <meta property="article:author" content="{{ $meta['author'] }}">
    @endif
    @foreach($meta['tags'] as $tag)
    <meta property="article:tag" content="{{ $tag }}">
    @endforeach
@endif

{{-- Twitter --}}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ $seo->getFullTitle() }}">
<meta name="twitter:description" content="{{ $meta['description'] }}">
<meta name="twitter:image" content="{{ $seo->getImageUrl() }}">
@if($seo::TWITTER_HANDLE)
<meta name="twitter:site" content="{{ $seo::TWITTER_HANDLE }}">
<meta name="twitter:creator" content="{{ $seo::TWITTER_HANDLE }}">
@endif`,
        explanation: 'Blade component for rendering SEO meta tags.',
      },
      {
        file: 'resources/views/layouts/app.blade.php',
        code: `<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    
    {{-- SEO Meta Tags --}}
    {!! SEO()->render() !!}
    
    {{-- Favicon --}}
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    
    {{-- Styles --}}
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    
    {{-- JSON-LD --}}
    {!! SEO()->renderJsonLd() !!}
</head>
<body>
    @yield('content')
</body>
</html>`,
        explanation: 'Laravel layout with SEO integration.',
      },
      {
        file: 'app/Providers/AppServiceProvider.php',
        code: `<?php

namespace App\\Providers;

use App\\Services\\SEOService;
use Illuminate\\Support\\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SEOService::class);
    }

    public function boot(): void
    {
        // Global SEO helper
        if (!function_exists('SEO')) {
            function SEO(): SEOService {
                return app(SEOService::class);
            }
        }
    }
}`,
        explanation: 'Service provider registration.',
      },
      {
        file: 'public/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// SPRING BOOT (Java) - Thymeleaf SEO
// ============================================================================

export function generateSpringBootSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'src/main/java/com/example/seo/SEOService.java',
    code: `package com.example.seo;

import org.springframework.stereotype.Service;
import java.util.*;

/**
 * Comprehensive SEO Service for Spring Boot
 *
 * Features:
 * - Full Open Graph support
 * - Twitter Cards
 * - JSON-LD structured data
 * - Thymeleaf integration
 */
@Service
public class SEOService {

    public static final String SITE_NAME = "${siteName}";
    public static final String SITE_URL = "${siteUrl}";
    public static final String DEFAULT_IMAGE = "${image || `${siteUrl}/og-image.png`}";
    public static final String DEFAULT_DESCRIPTION = "${description || `${siteName} - A compelling description.`}";
    public static final String TWITTER_HANDLE = "${twitterHandle || ''}";

    /**
     * Build SEO metadata for a page
     */
    public SEOMeta buildMeta(String title, String description, String image, String type) {
        return SEOMeta.builder()
                .title(title)
                .description(description != null ? description : DEFAULT_DESCRIPTION)
                .image(image != null ? image : DEFAULT_IMAGE)
                .type(type != null ? type : "website")
                .build();
    }

    /**
     * Get full page title with site name
     */
    public String getFullTitle(String title) {
        if (title == null || title.isEmpty()) {
            return SITE_NAME;
        }
        if (title.contains(SITE_NAME)) {
            return title;
        }
        return title + " | " + SITE_NAME;
    }

    /**
     * Get absolute image URL
     */
    public String getAbsoluteImageUrl(String image) {
        if (image == null) {
            return DEFAULT_IMAGE;
        }
        if (image.startsWith("http")) {
            return image;
        }
        return SITE_URL + image;
    }

    // JSON-LD Schema Generators

    public Map<String, Object> websiteSchema() {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("@context", "https://schema.org");
        schema.put("@type", "WebSite");
        schema.put("name", SITE_NAME);
        schema.put("url", SITE_URL);
        return schema;
    }

    public Map<String, Object> organizationSchema(String name, String url, String logo, List<String> socialProfiles) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("@context", "https://schema.org");
        schema.put("@type", "Organization");
        schema.put("name", name != null ? name : SITE_NAME);
        schema.put("url", url != null ? url : SITE_URL);
        if (logo != null) schema.put("logo", logo);
        if (socialProfiles != null && !socialProfiles.isEmpty()) {
            schema.put("sameAs", socialProfiles);
        }
        return schema;
    }

    public Map<String, Object> articleSchema(
            String headline,
            String description,
            String image,
            String datePublished,
            String dateModified,
            String authorName
    ) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("@context", "https://schema.org");
        schema.put("@type", "Article");
        schema.put("headline", headline);
        schema.put("description", description);
        schema.put("image", image != null ? image : DEFAULT_IMAGE);
        schema.put("datePublished", datePublished);
        schema.put("dateModified", dateModified != null ? dateModified : datePublished);

        Map<String, Object> author = new LinkedHashMap<>();
        author.put("@type", "Person");
        author.put("name", authorName);
        schema.put("author", author);

        Map<String, Object> publisher = new LinkedHashMap<>();
        publisher.put("@type", "Organization");
        publisher.put("name", SITE_NAME);
        Map<String, Object> logo = new LinkedHashMap<>();
        logo.put("@type", "ImageObject");
        logo.put("url", SITE_URL + "/logo.png");
        publisher.put("logo", logo);
        schema.put("publisher", publisher);

        return schema;
    }

    public Map<String, Object> productSchema(
            String name,
            String description,
            String image,
            String price,
            String currency,
            boolean inStock
    ) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("@context", "https://schema.org");
        schema.put("@type", "Product");
        schema.put("name", name);
        schema.put("description", description);
        schema.put("image", image);

        Map<String, Object> offers = new LinkedHashMap<>();
        offers.put("@type", "Offer");
        offers.put("price", price);
        offers.put("priceCurrency", currency != null ? currency : "USD");
        offers.put("availability", "https://schema.org/" + (inStock ? "InStock" : "OutOfStock"));
        schema.put("offers", offers);

        return schema;
    }

    public Map<String, Object> faqSchema(List<Map<String, String>> items) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("@context", "https://schema.org");
        schema.put("@type", "FAQPage");

        List<Map<String, Object>> mainEntity = new ArrayList<>();
        for (Map<String, String> item : items) {
            Map<String, Object> question = new LinkedHashMap<>();
            question.put("@type", "Question");
            question.put("name", item.get("question"));

            Map<String, Object> answer = new LinkedHashMap<>();
            answer.put("@type", "Answer");
            answer.put("text", item.get("answer"));
            question.put("acceptedAnswer", answer);

            mainEntity.add(question);
        }
        schema.put("mainEntity", mainEntity);

        return schema;
    }

    public Map<String, Object> breadcrumbSchema(List<Map<String, String>> items) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("@context", "https://schema.org");
        schema.put("@type", "BreadcrumbList");

        List<Map<String, Object>> itemList = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            Map<String, String> item = items.get(i);
            Map<String, Object> listItem = new LinkedHashMap<>();
            listItem.put("@type", "ListItem");
            listItem.put("position", i + 1);
            listItem.put("name", item.get("name"));
            listItem.put("item", item.get("url"));
            itemList.add(listItem);
        }
        schema.put("itemListElement", itemList);

        return schema;
    }
}`,
    explanation: `Spring Boot comprehensive SEO service with:
• Full Open Graph support
• Twitter Cards
• JSON-LD schema generators
• Thymeleaf integration

Setup:
1. Add SEOService to your controllers
2. Pass SEOMeta to model
3. Use Thymeleaf fragments in templates`,
    additionalFiles: [
      {
        file: 'src/main/java/com/example/seo/SEOMeta.java',
        code: `package com.example.seo;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class SEOMeta {
    private String title;
    private String description;
    private String image;
    private String url;
    private String type;
    
    // Article specific
    private String publishedTime;
    private String modifiedTime;
    private String author;
    private List<String> tags;
    
    // Robots
    @Builder.Default
    private boolean noindex = false;
    @Builder.Default
    private boolean nofollow = false;
    
    public String getFullTitle() {
        if (title == null || title.isEmpty()) {
            return SEOService.SITE_NAME;
        }
        if (title.contains(SEOService.SITE_NAME)) {
            return title;
        }
        return title + " | " + SEOService.SITE_NAME;
    }
    
    public String getImageUrl() {
        if (image == null) {
            return SEOService.DEFAULT_IMAGE;
        }
        if (image.startsWith("http")) {
            return image;
        }
        return SEOService.SITE_URL + image;
    }
    
    public String getRobots() {
        String index = noindex ? "noindex" : "index";
        String follow = nofollow ? "nofollow" : "follow";
        return index + ", " + follow;
    }
}`,
        explanation: 'SEO metadata DTO with Lombok.',
      },
      {
        file: 'src/main/resources/templates/fragments/seo.html',
        code: `<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head th:fragment="meta(seo)">
    <!-- Primary Meta Tags -->
    <title th:text="\${seo.getFullTitle()}">Page Title</title>
    <meta name="title" th:content="\${seo.getFullTitle()}">
    <meta name="description" th:content="\${seo.description}">
    <meta name="robots" th:content="\${seo.getRobots()}">
    <link rel="canonical" th:href="\${seo.url}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" th:content="\${seo.type}">
    <meta property="og:url" th:content="\${seo.url}">
    <meta property="og:title" th:content="\${seo.getFullTitle()}">
    <meta property="og:description" th:content="\${seo.description}">
    <meta property="og:image" th:content="\${seo.getImageUrl()}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" th:content="@{${siteName}}">
    
    <th:block th:if="\${seo.type == 'article'}">
        <meta th:if="\${seo.publishedTime}" property="article:published_time" th:content="\${seo.publishedTime}">
        <meta th:if="\${seo.modifiedTime}" property="article:modified_time" th:content="\${seo.modifiedTime}">
        <meta th:if="\${seo.author}" property="article:author" th:content="\${seo.author}">
        <meta th:each="tag : \${seo.tags}" property="article:tag" th:content="\${tag}">
    </th:block>
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" th:content="\${seo.getFullTitle()}">
    <meta name="twitter:description" th:content="\${seo.description}">
    <meta name="twitter:image" th:content="\${seo.getImageUrl()}">
    <meta th:if="${twitterHandle}" name="twitter:site" content="${twitterHandle}">
</head>
</html>`,
        explanation: 'Thymeleaf fragment for SEO meta tags.',
      },
      {
        file: 'src/main/resources/templates/layout/base.html',
        code: `<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org" th:lang="\${#locale.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- SEO Meta Tags -->
    <th:block th:replace="~{fragments/seo :: meta(seo=\${seo})}"></th:block>
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    
    <!-- Styles -->
    <link rel="stylesheet" th:href="@{/css/styles.css}">
    
    <!-- JSON-LD -->
    <script th:if="\${jsonLd}" type="application/ld+json" th:utext="\${jsonLd}"></script>
</head>
<body>
    <div th:replace="~{:: content}"></div>
</body>
</html>`,
        explanation: 'Base layout with SEO integration.',
      },
      {
        file: 'src/main/resources/static/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// PHOENIX (Elixir) - HEEx SEO
// ============================================================================

export function generatePhoenixSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'lib/my_app_web/components/seo.ex',
    code: `defmodule MyAppWeb.Components.SEO do
  @moduledoc """
  Comprehensive SEO components for Phoenix

  Features:
  - Full Open Graph support
  - Twitter Cards
  - JSON-LD structured data
  - HEEx integration
  """

  use Phoenix.Component

  @site_name "${siteName}"
  @site_url "${siteUrl}"
  @default_image "${image || `${siteUrl}/og-image.png`}"
  @default_description "${description || `${siteName} - A compelling description.`}"
  @twitter_handle "${twitterHandle || ''}"

  def site_name, do: @site_name
  def site_url, do: @site_url

  @doc """
  SEO meta tags component

  ## Examples

      <.seo_meta
        title="Page Title"
        description="Page description"
        type="article"
        published_time={@article.published_at}
      />
  """
  attr :title, :string, default: nil
  attr :description, :string, default: @default_description
  attr :image, :string, default: @default_image
  attr :url, :string, default: nil
  attr :type, :string, default: "website"
  attr :published_time, :any, default: nil
  attr :modified_time, :any, default: nil
  attr :author, :string, default: nil
  attr :tags, :list, default: []
  attr :noindex, :boolean, default: false
  attr :nofollow, :boolean, default: false

  def seo_meta(assigns) do
    assigns =
      assigns
      |> assign(:full_title, get_full_title(assigns.title))
      |> assign(:image_url, get_absolute_url(assigns.image))
      |> assign(:canonical_url, assigns.url || @site_url)
      |> assign(:robots, get_robots(assigns.noindex, assigns.nofollow))

    ~H\"\"\"
    <!-- Primary Meta Tags -->
    <title><%= @full_title %></title>
    <meta name="title" content={@full_title}>
    <meta name="description" content={@description}>
    <meta name="robots" content={@robots}>
    <link rel="canonical" href={@canonical_url}>

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content={@type}>
    <meta property="og:url" content={@canonical_url}>
    <meta property="og:title" content={@full_title}>
    <meta property="og:description" content={@description}>
    <meta property="og:image" content={@image_url}>
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content={@site_name}>

    <%= if @type == "article" do %>
      <%= if @published_time do %>
        <meta property="article:published_time" content={format_datetime(@published_time)}>
      <% end %>
      <%= if @modified_time do %>
        <meta property="article:modified_time" content={format_datetime(@modified_time)}>
      <% end %>
      <%= if @author do %>
        <meta property="article:author" content={@author}>
      <% end %>
      <%= for tag <- @tags do %>
        <meta property="article:tag" content={tag}>
      <% end %>
    <% end %>

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content={@full_title}>
    <meta name="twitter:description" content={@description}>
    <meta name="twitter:image" content={@image_url}>
    <%= if @twitter_handle != "" do %>
      <meta name="twitter:site" content={@twitter_handle}>
      <meta name="twitter:creator" content={@twitter_handle}>
    <% end %>
    \"\"\"
  end

  @doc """
  JSON-LD structured data component
  """
  attr :schemas, :list, required: true

  def json_ld(assigns) do
    all_schemas = [website_schema() | assigns.schemas]

    ~H\"\"\"
    <%= for schema <- @all_schemas do %>
      <script type="application/ld+json">
        <%= raw(Jason.encode!(schema)) %>
      </script>
    <% end %>
    \"\"\"
  end

  # Schema generators

  def website_schema do
    %{
      "@context" => "https://schema.org",
      "@type" => "WebSite",
      "name" => @site_name,
      "url" => @site_url
    }
  end

  def organization_schema(opts \\\\ []) do
    %{
      "@context" => "https://schema.org",
      "@type" => "Organization",
      "name" => opts[:name] || @site_name,
      "url" => opts[:url] || @site_url
    }
    |> maybe_put("logo", opts[:logo])
    |> maybe_put("sameAs", opts[:social_profiles])
  end

  def article_schema(article) do
    %{
      "@context" => "https://schema.org",
      "@type" => "Article",
      "headline" => article.title,
      "description" => article.excerpt || String.slice(article.content, 0, 160),
      "image" => article.image_url || @default_image,
      "datePublished" => format_datetime(article.published_at),
      "dateModified" => format_datetime(article.updated_at || article.published_at),
      "author" => %{
        "@type" => "Person",
        "name" => article.author_name || "Unknown"
      },
      "publisher" => %{
        "@type" => "Organization",
        "name" => @site_name,
        "logo" => %{"@type" => "ImageObject", "url" => "\#{@site_url}/logo.png"}
      }
    }
  end

  def product_schema(product) do
    %{
      "@context" => "https://schema.org",
      "@type" => "Product",
      "name" => product.name,
      "description" => product.description,
      "image" => product.image_url || @default_image,
      "offers" => %{
        "@type" => "Offer",
        "price" => to_string(product.price),
        "priceCurrency" => product.currency || "USD",
        "availability" => "https://schema.org/\#{if product.in_stock, do: "InStock", else: "OutOfStock"}"
      }
    }
    |> maybe_put("brand", product.brand && %{"@type" => "Brand", "name" => product.brand})
    |> maybe_put("sku", product.sku)
  end

  def faq_schema(items) do
    %{
      "@context" => "https://schema.org",
      "@type" => "FAQPage",
      "mainEntity" =>
        Enum.map(items, fn item ->
          %{
            "@type" => "Question",
            "name" => item.question,
            "acceptedAnswer" => %{"@type" => "Answer", "text" => item.answer}
          }
        end)
    }
  end

  def breadcrumb_schema(items) do
    %{
      "@context" => "https://schema.org",
      "@type" => "BreadcrumbList",
      "itemListElement" =>
        items
        |> Enum.with_index(1)
        |> Enum.map(fn {item, position} ->
          %{
            "@type" => "ListItem",
            "position" => position,
            "name" => item.name,
            "item" => item.url
          }
        end)
    }
  end

  # Helpers

  defp get_full_title(nil), do: @site_name
  defp get_full_title(title) when is_binary(title) do
    if String.contains?(title, @site_name), do: title, else: "\#{title} | \#{@site_name}"
  end

  defp get_absolute_url(nil), do: @default_image
  defp get_absolute_url(url) when is_binary(url) do
    if String.starts_with?(url, "http"), do: url, else: @site_url <> url
  end

  defp get_robots(noindex, nofollow) do
    index = if noindex, do: "noindex", else: "index"
    follow = if nofollow, do: "nofollow", else: "follow"
    "\#{index}, \#{follow}"
  end

  defp format_datetime(nil), do: nil
  defp format_datetime(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp format_datetime(%NaiveDateTime{} = dt), do: NaiveDateTime.to_iso8601(dt)
  defp format_datetime(dt) when is_binary(dt), do: dt

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, _key, []), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end`,
    explanation: `Phoenix/Elixir comprehensive SEO module with:
• HEEx function components
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schema generators
• Elixir-idiomatic API

Setup:
1. Import in your components module
2. Use <.seo_meta> in layouts
3. Add <.json_ld schemas={[@article_schema]} />`,
    additionalFiles: [
      {
        file: 'lib/my_app_web/components/layouts/root.html.heex',
        code: `<!DOCTYPE html>
<html lang={@locale || "en"}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content={get_csrf_token()}>
    
    <.seo_meta
      title={assigns[:page_title]}
      description={assigns[:page_description]}
      image={assigns[:page_image]}
      type={assigns[:page_type] || "website"}
    />
    
    <link rel="icon" href="/favicon.ico">
    <link phx-track-static rel="stylesheet" href={~p"/assets/app.css"}>
    <script defer phx-track-static src={~p"/assets/app.js"}></script>
    
    <%= if assigns[:json_ld_schemas] do %>
      <.json_ld schemas={@json_ld_schemas} />
    <% end %>
  </head>
  <body>
    <%= @inner_content %>
  </body>
</html>`,
        explanation: 'Phoenix root layout with SEO components.',
      },
      {
        file: 'priv/static/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// GO (Gin/Echo/Fiber) - Template SEO
// ============================================================================

export function generateGoSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'internal/seo/seo.go',
    code: `package seo

import (
	"encoding/json"
	"html/template"
	"strings"
	"time"
)

// Configuration
const (
	SiteName           = "${siteName}"
	SiteURL            = "${siteUrl}"
	DefaultImage       = "${image || `${siteUrl}/og-image.png`}"
	DefaultDescription = "${description || `${siteName} - A compelling description.`}"
	TwitterHandle      = "${twitterHandle || ''}"
)

// Meta contains SEO metadata for a page
type Meta struct {
	Title         string
	Description   string
	Image         string
	URL           string
	Type          string // website, article, product
	PublishedTime *time.Time
	ModifiedTime  *time.Time
	Author        string
	Tags          []string
	NoIndex       bool
	NoFollow      bool
}

// NewMeta creates a Meta with defaults
func NewMeta() *Meta {
	return &Meta{
		Description: DefaultDescription,
		Image:       DefaultImage,
		Type:        "website",
	}
}

// FullTitle returns the title with site name
func (m *Meta) FullTitle() string {
	if m.Title == "" {
		return SiteName
	}
	if strings.Contains(m.Title, SiteName) {
		return m.Title
	}
	return m.Title + " | " + SiteName
}

// AbsoluteImageURL returns the absolute image URL
func (m *Meta) AbsoluteImageURL() string {
	if m.Image == "" {
		return DefaultImage
	}
	if strings.HasPrefix(m.Image, "http") {
		return m.Image
	}
	return SiteURL + m.Image
}

// Robots returns the robots meta content
func (m *Meta) Robots() string {
	index := "index"
	if m.NoIndex {
		index = "noindex"
	}
	follow := "follow"
	if m.NoFollow {
		follow = "nofollow"
	}
	return index + ", " + follow
}

// Schema types for JSON-LD

type Schema map[string]interface{}

// WebsiteSchema returns the default website schema
func WebsiteSchema() Schema {
	return Schema{
		"@context": "https://schema.org",
		"@type":    "WebSite",
		"name":     SiteName,
		"url":      SiteURL,
	}
}

// OrganizationSchema creates an organization schema
func OrganizationSchema(name, url, logo string, socialProfiles []string) Schema {
	schema := Schema{
		"@context": "https://schema.org",
		"@type":    "Organization",
		"name":     name,
		"url":      url,
	}
	if logo != "" {
		schema["logo"] = logo
	}
	if len(socialProfiles) > 0 {
		schema["sameAs"] = socialProfiles
	}
	return schema
}

// ArticleSchema creates an article schema
func ArticleSchema(headline, description, image string, datePublished, dateModified time.Time, authorName string) Schema {
	return Schema{
		"@context":      "https://schema.org",
		"@type":         "Article",
		"headline":      headline,
		"description":   description,
		"image":         image,
		"datePublished": datePublished.Format(time.RFC3339),
		"dateModified":  dateModified.Format(time.RFC3339),
		"author": Schema{
			"@type": "Person",
			"name":  authorName,
		},
		"publisher": Schema{
			"@type": "Organization",
			"name":  SiteName,
			"logo": Schema{
				"@type": "ImageObject",
				"url":   SiteURL + "/logo.png",
			},
		},
	}
}

// ProductSchema creates a product schema
func ProductSchema(name, description, image, price, currency string, inStock bool) Schema {
	availability := "https://schema.org/InStock"
	if !inStock {
		availability = "https://schema.org/OutOfStock"
	}

	return Schema{
		"@context":    "https://schema.org",
		"@type":       "Product",
		"name":        name,
		"description": description,
		"image":       image,
		"offers": Schema{
			"@type":         "Offer",
			"price":         price,
			"priceCurrency": currency,
			"availability":  availability,
		},
	}
}

// FAQItem represents a single FAQ entry
type FAQItem struct {
	Question string
	Answer   string
}

// FAQSchema creates a FAQ schema
func FAQSchema(items []FAQItem) Schema {
	mainEntity := make([]Schema, len(items))
	for i, item := range items {
		mainEntity[i] = Schema{
			"@type": "Question",
			"name":  item.Question,
			"acceptedAnswer": Schema{
				"@type": "Answer",
				"text":  item.Answer,
			},
		}
	}
	return Schema{
		"@context":   "https://schema.org",
		"@type":      "FAQPage",
		"mainEntity": mainEntity,
	}
}

// BreadcrumbItem represents a breadcrumb entry
type BreadcrumbItem struct {
	Name string
	URL  string
}

// BreadcrumbSchema creates a breadcrumb schema
func BreadcrumbSchema(items []BreadcrumbItem) Schema {
	itemList := make([]Schema, len(items))
	for i, item := range items {
		itemList[i] = Schema{
			"@type":    "ListItem",
			"position": i + 1,
			"name":     item.Name,
			"item":     item.URL,
		}
	}
	return Schema{
		"@context":        "https://schema.org",
		"@type":           "BreadcrumbList",
		"itemListElement": itemList,
	}
}

// ToJSON converts a schema to JSON string
func (s Schema) ToJSON() template.JS {
	b, err := json.Marshal(s)
	if err != nil {
		return ""
	}
	return template.JS(b)
}

// RenderJSONLD renders multiple schemas as script tags
func RenderJSONLD(schemas ...Schema) template.HTML {
	all := append([]Schema{WebsiteSchema()}, schemas...)
	var sb strings.Builder
	for _, schema := range all {
		b, err := json.Marshal(schema)
		if err != nil {
			continue
		}
		sb.WriteString(\`<script type="application/ld+json">\`)
		sb.Write(b)
		sb.WriteString(\`</script>\\n\`)
	}
	return template.HTML(sb.String())
}`,
    explanation: `Go comprehensive SEO package with:
• Meta struct for page metadata
• JSON-LD schema generators
• Template-friendly helpers
• Works with Gin, Echo, Fiber, or stdlib

Setup:
1. Import in your handlers
2. Pass Meta to templates
3. Use schema helpers for JSON-LD`,
    additionalFiles: [
      {
        file: 'templates/partials/seo.html',
        code: `{{define "seo"}}
<!-- Primary Meta Tags -->
<title>{{.SEO.FullTitle}}</title>
<meta name="title" content="{{.SEO.FullTitle}}">
<meta name="description" content="{{.SEO.Description}}">
<meta name="robots" content="{{.SEO.Robots}}">
<link rel="canonical" href="{{.SEO.URL}}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="{{.SEO.Type}}">
<meta property="og:url" content="{{.SEO.URL}}">
<meta property="og:title" content="{{.SEO.FullTitle}}">
<meta property="og:description" content="{{.SEO.Description}}">
<meta property="og:image" content="{{.SEO.AbsoluteImageURL}}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${siteName}">

{{if eq .SEO.Type "article"}}
    {{if .SEO.PublishedTime}}
    <meta property="article:published_time" content="{{.SEO.PublishedTime.Format "2006-01-02T15:04:05Z07:00"}}">
    {{end}}
    {{if .SEO.ModifiedTime}}
    <meta property="article:modified_time" content="{{.SEO.ModifiedTime.Format "2006-01-02T15:04:05Z07:00"}}">
    {{end}}
    {{if .SEO.Author}}
    <meta property="article:author" content="{{.SEO.Author}}">
    {{end}}
    {{range .SEO.Tags}}
    <meta property="article:tag" content="{{.}}">
    {{end}}
{{end}}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{.SEO.FullTitle}}">
<meta name="twitter:description" content="{{.SEO.Description}}">
<meta name="twitter:image" content="{{.SEO.AbsoluteImageURL}}">
{{if ne "${twitterHandle}" ""}}
<meta name="twitter:site" content="${twitterHandle}">
<meta name="twitter:creator" content="${twitterHandle}">
{{end}}
{{end}}`,
        explanation: 'Go html/template partial for SEO meta tags.',
      },
      {
        file: 'templates/layouts/base.html',
        code: `<!DOCTYPE html>
<html lang="{{.Lang}}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    {{template "seo" .}}
    
    <link rel="icon" href="/static/favicon.ico">
    <link rel="stylesheet" href="/static/css/styles.css">
    
    {{if .JSONLDSchemas}}
    {{.JSONLDSchemas}}
    {{end}}
</head>
<body>
    {{template "content" .}}
</body>
</html>`,
        explanation: 'Go base template layout.',
      },
      {
        file: 'static/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// ASP.NET CORE (C#) - Razor SEO
// ============================================================================

export function generateAspNetCoreSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'Services/SEOService.cs',
    code: `using System.Text.Json;

namespace MyApp.Services;

/// <summary>
/// Comprehensive SEO Service for ASP.NET Core
/// 
/// Features:
/// - Full Open Graph support
/// - Twitter Cards
/// - JSON-LD structured data
/// - Razor integration
/// </summary>
public class SEOService
{
    public const string SiteName = "${siteName}";
    public const string SiteUrl = "${siteUrl}";
    public const string DefaultImage = "${image || `${siteUrl}/og-image.png`}";
    public const string DefaultDescription = "${description || `${siteName} - A compelling description.`}";
    public const string TwitterHandle = "${twitterHandle || ''}";

    /// <summary>
    /// Create SEO metadata for a page
    /// </summary>
    public SEOMeta CreateMeta(
        string? title = null,
        string? description = null,
        string? image = null,
        string? type = "website")
    {
        return new SEOMeta
        {
            Title = title,
            Description = description ?? DefaultDescription,
            Image = image ?? DefaultImage,
            Type = type ?? "website"
        };
    }

    // JSON-LD Schema Generators

    public object WebsiteSchema() => new
    {
        @context = "https://schema.org",
        @type = "WebSite",
        name = SiteName,
        url = SiteUrl
    };

    public object OrganizationSchema(
        string? name = null,
        string? url = null,
        string? logo = null,
        string[]? socialProfiles = null) => new
    {
        @context = "https://schema.org",
        @type = "Organization",
        name = name ?? SiteName,
        url = url ?? SiteUrl,
        logo,
        sameAs = socialProfiles
    };

    public object ArticleSchema(
        string headline,
        string description,
        string? image,
        DateTime datePublished,
        DateTime? dateModified,
        string authorName) => new
    {
        @context = "https://schema.org",
        @type = "Article",
        headline,
        description,
        image = image ?? DefaultImage,
        datePublished = datePublished.ToString("O"),
        dateModified = (dateModified ?? datePublished).ToString("O"),
        author = new { @type = "Person", name = authorName },
        publisher = new
        {
            @type = "Organization",
            name = SiteName,
            logo = new { @type = "ImageObject", url = SiteUrl + "/logo.png" }
        }
    };

    public object ProductSchema(
        string name,
        string description,
        string? image,
        decimal price,
        string currency = "USD",
        bool inStock = true) => new
    {
        @context = "https://schema.org",
        @type = "Product",
        name,
        description,
        image = image ?? DefaultImage,
        offers = new
        {
            @type = "Offer",
            price = price.ToString("F2"),
            priceCurrency = currency,
            availability = $"https://schema.org/{(inStock ? "InStock" : "OutOfStock")}"
        }
    };

    public object FAQSchema(IEnumerable<(string Question, string Answer)> items) => new
    {
        @context = "https://schema.org",
        @type = "FAQPage",
        mainEntity = items.Select(item => new
        {
            @type = "Question",
            name = item.Question,
            acceptedAnswer = new { @type = "Answer", text = item.Answer }
        })
    };

    public object BreadcrumbSchema(IEnumerable<(string Name, string Url)> items) => new
    {
        @context = "https://schema.org",
        @type = "BreadcrumbList",
        itemListElement = items.Select((item, index) => new
        {
            @type = "ListItem",
            position = index + 1,
            name = item.Name,
            item = item.Url
        })
    };

    /// <summary>
    /// Serialize schema to JSON for embedding in HTML
    /// </summary>
    public string ToJson(object schema)
    {
        return JsonSerializer.Serialize(schema, new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
    }
}

public class SEOMeta
{
    public string? Title { get; set; }
    public string Description { get; set; } = SEOService.DefaultDescription;
    public string Image { get; set; } = SEOService.DefaultImage;
    public string? Url { get; set; }
    public string Type { get; set; } = "website";
    public DateTime? PublishedTime { get; set; }
    public DateTime? ModifiedTime { get; set; }
    public string? Author { get; set; }
    public List<string> Tags { get; set; } = new();
    public bool NoIndex { get; set; }
    public bool NoFollow { get; set; }

    public string FullTitle => string.IsNullOrEmpty(Title)
        ? SEOService.SiteName
        : Title.Contains(SEOService.SiteName)
            ? Title
            : $"{Title} | {SEOService.SiteName}";

    public string AbsoluteImageUrl => Image.StartsWith("http")
        ? Image
        : SEOService.SiteUrl + Image;

    public string Robots
    {
        get
        {
            var index = NoIndex ? "noindex" : "index";
            var follow = NoFollow ? "nofollow" : "follow";
            return $"{index}, {follow}";
        }
    }
}`,
    explanation: `ASP.NET Core comprehensive SEO service with:
• SEOMeta class for page metadata
• JSON-LD schema generators
• Razor integration
• Fluent API

Setup:
1. Register SEOService as singleton
2. Inject in controllers/pages
3. Use in Razor views`,
    additionalFiles: [
      {
        file: 'Pages/Shared/_SEOMeta.cshtml',
        code: `@model SEOMeta

<!-- Primary Meta Tags -->
<title>@Model.FullTitle</title>
<meta name="title" content="@Model.FullTitle">
<meta name="description" content="@Model.Description">
<meta name="robots" content="@Model.Robots">
<link rel="canonical" href="@Model.Url">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="@Model.Type">
<meta property="og:url" content="@Model.Url">
<meta property="og:title" content="@Model.FullTitle">
<meta property="og:description" content="@Model.Description">
<meta property="og:image" content="@Model.AbsoluteImageUrl">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${siteName}">

@if (Model.Type == "article")
{
    if (Model.PublishedTime.HasValue)
    {
        <meta property="article:published_time" content="@Model.PublishedTime.Value.ToString("O")">
    }
    if (Model.ModifiedTime.HasValue)
    {
        <meta property="article:modified_time" content="@Model.ModifiedTime.Value.ToString("O")">
    }
    if (!string.IsNullOrEmpty(Model.Author))
    {
        <meta property="article:author" content="@Model.Author">
    }
    foreach (var tag in Model.Tags)
    {
        <meta property="article:tag" content="@tag">
    }
}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="@Model.FullTitle">
<meta name="twitter:description" content="@Model.Description">
<meta name="twitter:image" content="@Model.AbsoluteImageUrl">
@if (!string.IsNullOrEmpty("${twitterHandle}"))
{
    <meta name="twitter:site" content="${twitterHandle}">
    <meta name="twitter:creator" content="${twitterHandle}">
}`,
        explanation: 'Razor partial view for SEO meta tags.',
      },
      {
        file: 'Pages/Shared/_Layout.cshtml',
        code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    @if (ViewData["SEO"] is SEOMeta seo)
    {
        <partial name="_SEOMeta" model="seo" />
    }
    else
    {
        <title>${siteName}</title>
    }
    
    <link rel="icon" type="image/x-icon" href="~/favicon.ico">
    <link rel="stylesheet" href="~/css/site.css" asp-append-version="true">
    
    @if (ViewData["JsonLd"] is string jsonLd)
    {
        <script type="application/ld+json">@Html.Raw(jsonLd)</script>
    }
</head>
<body>
    @RenderBody()
    
    <script src="~/js/site.js" asp-append-version="true"></script>
    @await RenderSectionAsync("Scripts", required: false)
</body>
</html>`,
        explanation: 'Razor layout with SEO integration.',
      },
      {
        file: 'wwwroot/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// HTMX - Server-rendered SEO (framework-agnostic)
// ============================================================================

export function generateHTMXSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'templates/seo_head.html',
    code: `<!--
HTMX SEO Template

This template provides comprehensive SEO for HTMX applications.
HTMX apps are server-rendered, so SEO is straightforward - just
include proper meta tags in your initial HTML response.

Features:
- Full Open Graph support
- Twitter Cards
- JSON-LD structured data
- Works with any backend (Python, Ruby, Go, PHP, etc.)

Usage:
Include this template in your base layout, passing the required variables.
-->

<!-- Primary Meta Tags -->
<title>{{ full_title or '${siteName}' }}</title>
<meta name="title" content="{{ full_title or '${siteName}' }}">
<meta name="description" content="{{ description or '${description || `${siteName} - A compelling description.`}' }}">
<meta name="robots" content="{{ 'noindex, nofollow' if noindex else 'index, follow' }}">
<link rel="canonical" href="{{ canonical_url }}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="{{ og_type or 'website' }}">
<meta property="og:url" content="{{ canonical_url }}">
<meta property="og:title" content="{{ full_title or '${siteName}' }}">
<meta property="og:description" content="{{ description or '${description || `${siteName} - A compelling description.`}' }}">
<meta property="og:image" content="{{ image_url or '${image || `${siteUrl}/og-image.png`}' }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="${siteName}">
<meta property="og:locale" content="{{ locale or 'en_US' }}">

{% if og_type == 'article' %}
{% if published_time %}
<meta property="article:published_time" content="{{ published_time }}">
{% endif %}
{% if modified_time %}
<meta property="article:modified_time" content="{{ modified_time }}">
{% endif %}
{% if author %}
<meta property="article:author" content="{{ author }}">
{% endif %}
{% for tag in tags or [] %}
<meta property="article:tag" content="{{ tag }}">
{% endfor %}
{% endif %}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ full_title or '${siteName}' }}">
<meta name="twitter:description" content="{{ description or '${description || `${siteName} - A compelling description.`}' }}">
<meta name="twitter:image" content="{{ image_url or '${image || `${siteUrl}/og-image.png`}' }}">
{% if '${twitterHandle}' %}
<meta name="twitter:site" content="${twitterHandle}">
<meta name="twitter:creator" content="${twitterHandle}">
{% endif %}

<!-- JSON-LD Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "${siteName}",
  "url": "${siteUrl}"
}
</script>
{% if schema_json %}
<script type="application/ld+json">
{{ schema_json | safe }}
</script>
{% endif %}`,
    explanation: `HTMX SEO template (framework-agnostic) with:
• Full Open Graph support
• Twitter Cards
• JSON-LD structured data
• Works with any template engine (Jinja2, Liquid, Go templates, etc.)

HTMX apps are server-rendered, so SEO is built-in!
Just include proper meta tags in your initial HTML response.

Usage:
1. Include in your base layout
2. Pass SEO variables from your backend
3. JSON-LD schemas can be generated server-side`,
    additionalFiles: [
      {
        file: 'templates/base.html',
        code: `<!DOCTYPE html>
<html lang="{{ lang or 'en' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    {% include 'seo_head.html' %}
    
    <!-- HTMX -->
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    
    <!-- Styles -->
    <link rel="stylesheet" href="/static/css/styles.css">
    
    <!-- Favicon -->
    <link rel="icon" href="/static/favicon.ico">
</head>
<body hx-boost="true">
    <main id="content">
        {% block content %}{% endblock %}
    </main>
</body>
</html>`,
        explanation: 'Base HTMX layout with SEO integration.',
      },
      {
        file: 'static/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// HUGO (Static Site Generator)
// ============================================================================

export function generateHugoSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'layouts/partials/seo.html',
    code: `{{- /* Comprehensive SEO partial for Hugo */ -}}
{{- $title := .Title | default site.Title -}}
{{- $description := .Description | default .Summary | default site.Params.description | default "${description || `${siteName} - A compelling description.`}" -}}
{{- $image := .Params.image | default site.Params.defaultImage | default "${image || '/og-image.png'}" -}}
{{- $imageURL := $image | absURL -}}
{{- $canonical := .Permalink -}}
{{- $type := cond (eq .Kind "page") "article" "website" -}}

{{- /* Full title with site name */ -}}
{{- $fullTitle := $title -}}
{{- if and (ne $title site.Title) (not (in $title site.Title)) -}}
  {{- $fullTitle = printf "%s | %s" $title site.Title -}}
{{- end -}}

<!-- Primary Meta Tags -->
<title>{{ $fullTitle }}</title>
<meta name="title" content="{{ $fullTitle }}">
<meta name="description" content="{{ $description | truncate 160 }}">
<meta name="robots" content="{{ if .Params.noindex }}noindex, nofollow{{ else }}index, follow{{ end }}">
<link rel="canonical" href="{{ $canonical }}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="{{ $type }}">
<meta property="og:url" content="{{ $canonical }}">
<meta property="og:title" content="{{ $fullTitle }}">
<meta property="og:description" content="{{ $description | truncate 160 }}">
<meta property="og:image" content="{{ $imageURL }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="{{ site.Title }}">
<meta property="og:locale" content="{{ site.Language.Lang | default "en" }}_{{ site.Language.Lang | default "US" | upper }}">

{{- if eq $type "article" }}
{{- with .PublishDate }}
<meta property="article:published_time" content="{{ .Format "2006-01-02T15:04:05Z07:00" }}">
{{- end }}
{{- with .Lastmod }}
<meta property="article:modified_time" content="{{ .Format "2006-01-02T15:04:05Z07:00" }}">
{{- end }}
{{- with .Params.author }}
<meta property="article:author" content="{{ . }}">
{{- end }}
{{- range .Params.tags }}
<meta property="article:tag" content="{{ . }}">
{{- end }}
{{- end }}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ $fullTitle }}">
<meta name="twitter:description" content="{{ $description | truncate 160 }}">
<meta name="twitter:image" content="{{ $imageURL }}">
{{- with site.Params.twitterHandle }}
<meta name="twitter:site" content="{{ . }}">
<meta name="twitter:creator" content="{{ . }}">
{{- end }}

<!-- JSON-LD: WebSite -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{{ site.Title }}",
  "url": "{{ site.BaseURL }}"
}
</script>

{{- /* Article Schema */ -}}
{{- if eq $type "article" }}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{ $title }}",
  "description": "{{ $description | truncate 160 }}",
  "image": "{{ $imageURL }}",
  "datePublished": "{{ .PublishDate.Format "2006-01-02T15:04:05Z07:00" }}",
  "dateModified": "{{ .Lastmod.Format "2006-01-02T15:04:05Z07:00" }}",
  "author": {
    "@type": "Person",
    "name": "{{ .Params.author | default site.Params.author | default "Author" }}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{{ site.Title }}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{ "logo.png" | absURL }}"
    }
  }
}
</script>
{{- end }}

{{- /* Breadcrumbs */ -}}
{{- if .Parent }}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{- $breadcrumbs := slice -}}
    {{- range .Ancestors.Reverse }}
    {{- $breadcrumbs = $breadcrumbs | append (dict "name" .Title "url" .Permalink) -}}
    {{- end }}
    {{- $breadcrumbs = $breadcrumbs | append (dict "name" .Title "url" .Permalink) -}}
    {{- range $i, $item := $breadcrumbs }}
    {{- if $i }},{{ end }}
    {
      "@type": "ListItem",
      "position": {{ add $i 1 }},
      "name": "{{ $item.name }}",
      "item": "{{ $item.url }}"
    }
    {{- end }}
  ]
}
</script>
{{- end }}`,
    explanation: `Hugo comprehensive SEO partial with:
• Automatic title handling
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schemas (WebSite, Article, Breadcrumbs)
• Content summaries for descriptions

Usage: {{ partial "seo.html" . }}`,
    additionalFiles: [
      {
        file: 'layouts/_default/baseof.html',
        code: `<!DOCTYPE html>
<html lang="{{ site.Language.Lang | default "en" }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    {{ partial "seo.html" . }}
    
    <!-- Favicon -->
    <link rel="icon" href="{{ "favicon.ico" | relURL }}">
    <link rel="apple-touch-icon" sizes="180x180" href="{{ "apple-touch-icon.png" | relURL }}">
    
    <!-- Styles -->
    {{ $styles := resources.Get "css/styles.css" | minify | fingerprint }}
    <link rel="stylesheet" href="{{ $styles.Permalink }}">
</head>
<body>
    {{ block "main" . }}{{ end }}
</body>
</html>`,
        explanation: 'Hugo base template with SEO partial.',
      },
      {
        file: 'config.toml',
        code: `baseURL = '${siteUrl}/'
languageCode = 'en-us'
title = '${siteName}'

[params]
  description = '${description || `${siteName} - A compelling description.`}'
  defaultImage = '${image || '/og-image.png'}'
  twitterHandle = '${twitterHandle || ''}'
  author = 'Your Name'

[sitemap]
  changefreq = 'weekly'
  filename = 'sitemap.xml'
  priority = 0.5

[outputs]
  home = ['HTML', 'RSS', 'JSON']

# Robots.txt
enableRobotsTXT = true`,
        explanation: 'Hugo configuration with SEO settings.',
      },
      {
        file: 'layouts/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/

User-agent: GPTBot
Allow: /

Sitemap: {{ .Site.BaseURL }}sitemap.xml`,
        explanation: 'Hugo robots.txt template.',
      },
    ],
  };
}

// ============================================================================
// JEKYLL (Ruby Static Site Generator)
// ============================================================================

export function generateJekyllSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: '_includes/seo.html',
    code: `{% comment %}
Comprehensive SEO include for Jekyll

Features:
- Full Open Graph support
- Twitter Cards
- JSON-LD structured data
- jekyll-seo-tag compatible

Usage: {% include seo.html %}
{% endcomment %}

{%- assign seo_title = page.title | default: site.title -%}
{%- if page.title and site.title and page.title != site.title -%}
  {%- assign seo_title = page.title | append: " | " | append: site.title -%}
{%- endif -%}

{%- assign seo_description = page.description | default: page.excerpt | default: site.description | default: "${description || `${siteName} - A compelling description.`}" | strip_html | truncate: 160 -%}

{%- assign seo_image = page.image | default: site.og_image | default: "${image || '/og-image.png'}" -%}
{%- unless seo_image contains "://" -%}
  {%- assign seo_image = seo_image | absolute_url -%}
{%- endunless -%}

{%- assign seo_type = "website" -%}
{%- if page.layout == "post" -%}
  {%- assign seo_type = "article" -%}
{%- endif -%}

<!-- Primary Meta Tags -->
<title>{{ seo_title }}</title>
<meta name="title" content="{{ seo_title }}">
<meta name="description" content="{{ seo_description }}">
<meta name="robots" content="{% if page.noindex %}noindex, nofollow{% else %}index, follow{% endif %}">
<link rel="canonical" href="{{ page.url | absolute_url }}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="{{ seo_type }}">
<meta property="og:url" content="{{ page.url | absolute_url }}">
<meta property="og:title" content="{{ seo_title }}">
<meta property="og:description" content="{{ seo_description }}">
<meta property="og:image" content="{{ seo_image }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="{{ site.title }}">
<meta property="og:locale" content="{{ site.locale | default: "en_US" }}">

{% if seo_type == "article" %}
{% if page.date %}
<meta property="article:published_time" content="{{ page.date | date_to_xmlschema }}">
{% endif %}
{% if page.last_modified_at %}
<meta property="article:modified_time" content="{{ page.last_modified_at | date_to_xmlschema }}">
{% endif %}
{% if page.author %}
<meta property="article:author" content="{{ page.author }}">
{% endif %}
{% for tag in page.tags %}
<meta property="article:tag" content="{{ tag }}">
{% endfor %}
{% endif %}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ seo_title }}">
<meta name="twitter:description" content="{{ seo_description }}">
<meta name="twitter:image" content="{{ seo_image }}">
{% if site.twitter_handle %}
<meta name="twitter:site" content="{{ site.twitter_handle }}">
<meta name="twitter:creator" content="{{ site.twitter_handle }}">
{% endif %}

<!-- JSON-LD: WebSite -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{{ site.title }}",
  "url": "{{ site.url }}"
}
</script>

{% if seo_type == "article" %}
<!-- JSON-LD: Article -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{ page.title | escape }}",
  "description": "{{ seo_description | escape }}",
  "image": "{{ seo_image }}",
  "datePublished": "{{ page.date | date_to_xmlschema }}",
  "dateModified": "{{ page.last_modified_at | default: page.date | date_to_xmlschema }}",
  "author": {
    "@type": "Person",
    "name": "{{ page.author | default: site.author | default: "Author" }}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{{ site.title }}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{ '/logo.png' | absolute_url }}"
    }
  }
}
</script>
{% endif %}`,
    explanation: `Jekyll comprehensive SEO include with:
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schemas
• Liquid template integration

Usage: {% include seo.html %}`,
    additionalFiles: [
      {
        file: '_layouts/default.html',
        code: `<!DOCTYPE html>
<html lang="{{ site.locale | default: "en" | slice: 0, 2 }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    {% include seo.html %}
    
    <link rel="icon" href="{{ '/favicon.ico' | relative_url }}">
    <link rel="apple-touch-icon" sizes="180x180" href="{{ '/apple-touch-icon.png' | relative_url }}">
    
    <link rel="stylesheet" href="{{ '/assets/css/styles.css' | relative_url }}">
</head>
<body>
    {{ content }}
</body>
</html>`,
        explanation: 'Jekyll default layout with SEO include.',
      },
      {
        file: '_config.yml',
        code: `title: ${siteName}
description: "${description || `${siteName} - A compelling description.`}"
url: "${siteUrl}"
baseurl: ""

# SEO
og_image: "${image || '/og-image.png'}"
twitter_handle: "${twitterHandle || ''}"
locale: "en_US"
author: "Your Name"

# Plugins
plugins:
  - jekyll-sitemap
  - jekyll-feed

# Defaults
defaults:
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
  - scope:
      path: ""
    values:
      layout: "default"`,
        explanation: 'Jekyll configuration with SEO settings.',
      },
      {
        file: 'robots.txt',
        code: `---
---
User-agent: *
Allow: /
Disallow: /admin/

User-agent: GPTBot
Allow: /

Sitemap: {{ site.url }}/sitemap.xml`,
        explanation: 'Jekyll robots.txt with front matter.',
      },
    ],
  };
}

// ============================================================================
// ELEVENTY (11ty)
// ============================================================================

export function generateEleventySEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'src/_includes/seo.njk',
    code: `{#
  Comprehensive SEO partial for Eleventy (11ty)

  Features:
  - Full Open Graph support
  - Twitter Cards
  - JSON-LD structured data
  - Nunjucks template

  Usage: {% include "seo.njk" %}
#}

{%- set seoTitle = title or metadata.title -%}
{%- set fullTitle = seoTitle -%}
{%- if seoTitle and metadata.title and seoTitle != metadata.title -%}
  {%- set fullTitle = seoTitle + " | " + metadata.title -%}
{%- endif -%}

{%- set seoDescription = description or excerpt or metadata.description or "${description || `${siteName} - A compelling description.`}" -%}
{%- set seoImage = image or metadata.defaultImage or "${image || '/og-image.png'}" -%}
{%- if not seoImage.startsWith("http") -%}
  {%- set seoImage = metadata.url + seoImage -%}
{%- endif -%}

{%- set pageUrl = page.url | url | absoluteUrl(metadata.url) -%}
{%- set seoType = "article" if layout == "post" else "website" -%}

<!-- Primary Meta Tags -->
<title>{{ fullTitle }}</title>
<meta name="title" content="{{ fullTitle }}">
<meta name="description" content="{{ seoDescription | truncate(160) }}">
<meta name="robots" content="{{ 'noindex, nofollow' if noindex else 'index, follow' }}">
<link rel="canonical" href="{{ pageUrl }}">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="{{ seoType }}">
<meta property="og:url" content="{{ pageUrl }}">
<meta property="og:title" content="{{ fullTitle }}">
<meta property="og:description" content="{{ seoDescription | truncate(160) }}">
<meta property="og:image" content="{{ seoImage }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="{{ metadata.title }}">
<meta property="og:locale" content="{{ metadata.locale or 'en_US' }}">

{% if seoType == "article" %}
{% if date %}
<meta property="article:published_time" content="{{ date | dateToISO }}">
{% endif %}
{% if lastModified %}
<meta property="article:modified_time" content="{{ lastModified | dateToISO }}">
{% endif %}
{% if author %}
<meta property="article:author" content="{{ author }}">
{% endif %}
{% for tag in tags %}
{% if tag != "posts" and tag != "all" %}
<meta property="article:tag" content="{{ tag }}">
{% endif %}
{% endfor %}
{% endif %}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{ fullTitle }}">
<meta name="twitter:description" content="{{ seoDescription | truncate(160) }}">
<meta name="twitter:image" content="{{ seoImage }}">
{% if metadata.twitterHandle %}
<meta name="twitter:site" content="{{ metadata.twitterHandle }}">
<meta name="twitter:creator" content="{{ metadata.twitterHandle }}">
{% endif %}

<!-- JSON-LD: WebSite -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{{ metadata.title }}",
  "url": "{{ metadata.url }}"
}
</script>

{% if seoType == "article" %}
<!-- JSON-LD: Article -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{ title }}",
  "description": "{{ seoDescription | truncate(160) | escape }}",
  "image": "{{ seoImage }}",
  "datePublished": "{{ date | dateToISO }}",
  "dateModified": "{{ (lastModified or date) | dateToISO }}",
  "author": {
    "@type": "Person",
    "name": "{{ author or metadata.author or 'Author' }}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{{ metadata.title }}",
    "logo": {
      "@type": "ImageObject",
      "url": "{{ metadata.url }}/logo.png"
    }
  }
}
</script>
{% endif %}`,
    explanation: `Eleventy comprehensive SEO partial with:
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schemas
• Nunjucks templating

Usage: {% include "seo.njk" %}`,
    additionalFiles: [
      {
        file: 'src/_includes/base.njk',
        code: `<!DOCTYPE html>
<html lang="{{ metadata.locale | default('en') | truncate(2, true, '') }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    {% include "seo.njk" %}
    
    <link rel="icon" href="/favicon.ico">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    {{ content | safe }}
</body>
</html>`,
        explanation: 'Eleventy base layout with SEO include.',
      },
      {
        file: 'src/_data/metadata.json',
        code: `{
  "title": "${siteName}",
  "url": "${siteUrl}",
  "description": "${description || `${siteName} - A compelling description.`}",
  "defaultImage": "${image || '/og-image.png'}",
  "twitterHandle": "${twitterHandle || ''}",
  "locale": "en_US",
  "author": "Your Name"
}`,
        explanation: 'Eleventy global data file with SEO metadata.',
      },
      {
        file: 'src/robots.njk',
        code: `---
permalink: /robots.txt
eleventyExcludeFromCollections: true
---
User-agent: *
Allow: /
Disallow: /admin/

User-agent: GPTBot
Allow: /

Sitemap: {{ metadata.url }}/sitemap.xml`,
        explanation: 'Eleventy robots.txt template.',
      },
    ],
  };
}

// ============================================================================
// REMIX
// ============================================================================

export function generateRemixSEO(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, description, image, twitterHandle } = options;
  
  return {
    file: 'app/utils/seo.ts',
    code: `import type { V2_MetaFunction, V2_MetaDescriptor } from '@remix-run/node';

/**
 * Comprehensive SEO utilities for Remix
 *
 * Features:
 * - Full Open Graph support
 * - Twitter Cards
 * - JSON-LD structured data
 * - Type-safe meta function helpers
 */

const SITE_NAME = '${siteName}';
const SITE_URL = '${siteUrl}';
const DEFAULT_IMAGE = '${image || `${siteUrl}/og-image.png`}';
const DEFAULT_DESCRIPTION = '${description || `${siteName} - A compelling description.`}';
const TWITTER_HANDLE = '${twitterHandle || ''}';

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  noIndex?: boolean;
}

/**
 * Generate meta tags for a page
 */
export function generateMeta(config: SEOConfig = {}): V2_MetaDescriptor[] {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    image = DEFAULT_IMAGE,
    url = SITE_URL,
    type = 'website',
    publishedTime,
    modifiedTime,
    author,
    tags = [],
    noIndex = false,
  } = config;

  const fullTitle = title
    ? title.includes(SITE_NAME)
      ? title
      : \`\${title} | \${SITE_NAME}\`
    : SITE_NAME;

  const imageUrl = image.startsWith('http') ? image : \`\${SITE_URL}\${image}\`;
  const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow';

  const meta: V2_MetaDescriptor[] = [
    { title: fullTitle },
    { name: 'description', content: description },
    { name: 'robots', content: robotsContent },

    // Open Graph
    { property: 'og:type', content: type },
    { property: 'og:url', content: url },
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:site_name', content: SITE_NAME },

    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: fullTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
  ];

  if (TWITTER_HANDLE) {
    meta.push(
      { name: 'twitter:site', content: TWITTER_HANDLE },
      { name: 'twitter:creator', content: TWITTER_HANDLE }
    );
  }

  // Article-specific meta
  if (type === 'article') {
    if (publishedTime) {
      meta.push({ property: 'article:published_time', content: publishedTime });
    }
    if (modifiedTime) {
      meta.push({ property: 'article:modified_time', content: modifiedTime });
    }
    if (author) {
      meta.push({ property: 'article:author', content: author });
    }
    tags.forEach((tag) => {
      meta.push({ property: 'article:tag', content: tag });
    });
  }

  return meta;
}

/**
 * Generate canonical link
 */
export function generateLinks(url: string) {
  return [{ rel: 'canonical', href: url }];
}

// JSON-LD Schema Generators

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };
}

export function articleSchema(data: {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: { name: string; url?: string };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    image: data.image || DEFAULT_IMAGE,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: { '@type': 'Person', ...data.author },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: \`\${SITE_URL}/logo.png\` },
    },
  };
}

export function productSchema(data: {
  name: string;
  description: string;
  image?: string;
  price: number;
  currency?: string;
  inStock?: boolean;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image || DEFAULT_IMAGE,
    offers: {
      '@type': 'Offer',
      price: data.price.toString(),
      priceCurrency: data.currency || 'USD',
      availability: \`https://schema.org/\${data.inStock !== false ? 'InStock' : 'OutOfStock'}\`,
    },
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * JSON-LD Script component helper
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}`,
    explanation: `Remix comprehensive SEO utilities with:
• Type-safe meta function helpers
• Full Open Graph with article support
• Twitter Cards
• JSON-LD schema generators
• Remix V2 meta conventions

Usage in route:
export const meta: V2_MetaFunction = () => generateMeta({ title: "Page" });`,
    additionalFiles: [
      {
        file: 'app/root.tsx',
        code: `import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import { JsonLd, websiteSchema } from '~/utils/seo';

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <JsonLd schema={websiteSchema()} />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}`,
        explanation: 'Remix root with SEO integration.',
      },
      {
        file: 'public/robots.txt',
        code: `User-agent: *
Allow: /
Disallow: /admin/
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
// Updated getFrameworkSpecificFix to include all new frameworks
// ============================================================================

export function getFrameworkSpecificFixExtended(
  framework: FrameworkInfo,
  options: MetaFixOptions
): GeneratedCode {
  const name = framework.name.toLowerCase();
  
  // JavaScript frameworks (existing)
  if (name.includes('next')) {
    return framework.router === 'app'
      ? generateNextJsAppRouterMetadata(options)
      : generateNextJsPagesRouterHead(options);
  }
  if (name.includes('nuxt')) return generateNuxtSEOHead(options);
  if (name.includes('vue')) return generateVueSEOHead(options);
  if (name.includes('astro')) return generateAstroBaseHead(options);
  if (name.includes('svelte')) return generateSvelteKitSEOHead(options);
  if (name.includes('angular')) return generateAngularSEOService(options);
  if (name.includes('remix')) return generateRemixSEO(options);
  
  // Backend frameworks (new)
  if (name.includes('rails') || name.includes('ruby')) return generateRailsSEOHelper(options);
  if (name.includes('django')) return generateDjangoSEOHelper(options);
  if (name.includes('laravel') || name.includes('php')) return generateLaravelSEOHelper(options);
  if (name.includes('spring') || name.includes('java')) return generateSpringBootSEO(options);
  if (name.includes('phoenix') || name.includes('elixir')) return generatePhoenixSEO(options);
  if (name.includes('asp') || name.includes('.net') || name.includes('csharp') || name.includes('c#')) {
    return generateAspNetCoreSEO(options);
  }
  if (name.includes('go') || name.includes('gin') || name.includes('echo') || name.includes('fiber')) {
    return generateGoSEO(options);
  }
  
  // HTMX and hypermedia
  if (name.includes('htmx') || name.includes('hotwire') || name.includes('turbo')) {
    return generateHTMXSEO(options);
  }
  
  // Static site generators
  if (name.includes('hugo')) return generateHugoSEO(options);
  if (name.includes('jekyll')) return generateJekyllSEO(options);
  if (name.includes('eleventy') || name.includes('11ty')) return generateEleventySEO(options);
  
  // Default: React with react-helmet-async
  return generateReactSEOHead(options);
}
