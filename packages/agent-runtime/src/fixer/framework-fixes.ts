/**
 * Framework-Specific SEO Fix Generators
 * 
 * Generates proper code snippets for each framework's meta tag patterns.
 */

import type { FrameworkInfo } from '../types.js';

export interface MetaFixOptions {
  siteName: string;
  siteUrl: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface GeneratedCode {
  file: string;
  code: string;
  explanation: string;
  installCommands?: string[];
  imports?: string[];
}

// ============================================================================
// REACT (Vite/CRA) - Client-side with react-helmet-async
// ============================================================================

export function generateReactSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'src/components/SEOHead.tsx',
    code: `import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export function SEOHead({
  title = '${title || `${siteName} - Your tagline here`}',
  description = '${description || `${siteName} - A compelling description of your product or service.`}',
  image = '${image || `${siteUrl}/og-image.png`}',
  url = typeof window !== 'undefined' ? window.location.href : '${siteUrl}',
  type = 'website',
}: SEOHeadProps) {
  const fullTitle = title.includes('${siteName}') ? title : \`\${title} | ${siteName}\`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="${siteName}" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}`,
    explanation: 'React SEO component using react-helmet-async. Wrap your app in <HelmetProvider> and use <SEOHead /> on each page.',
    installCommands: ['npm install react-helmet-async'],
    imports: ["import { HelmetProvider } from 'react-helmet-async';"],
  };
}

export function generateReactAppWrapper(): GeneratedCode {
  return {
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
    explanation: 'Updated main.tsx with HelmetProvider wrapper for react-helmet-async.',
  };
}

// ============================================================================
// NEXT.JS (App Router) - Server-side metadata export
// ============================================================================

export function generateNextJsAppRouterMetadata(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'app/layout.tsx',
    code: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('${siteUrl}'),
  title: {
    default: '${title || siteName}',
    template: \`%s | ${siteName}\`,
  },
  description: '${description || `${siteName} - A compelling description of your product or service.`}',
  openGraph: {
    type: 'website',
    locale: 'en_US',
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
  twitter: {
    card: 'summary_large_image',
    title: '${title || siteName}',
    description: '${description || `${siteName} - A compelling description.`}',
    images: ['${image || '/og-image.png'}'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}`,
    explanation: 'Next.js App Router layout with built-in Metadata API. Each page can override with its own metadata export.',
  };
}

export function generateNextJsPageMetadata(options: MetaFixOptions & { pageName: string }): GeneratedCode {
  const { siteName, description, pageName } = options;
  
  return {
    file: `app/${pageName}/page.tsx`,
    code: `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${pageName.charAt(0).toUpperCase() + pageName.slice(1)}',
  description: '${description || `Learn more about ${pageName} on ${siteName}.`}',
};

export default function ${pageName.charAt(0).toUpperCase() + pageName.slice(1)}Page() {
  return (
    <main>
      <h1>${pageName.charAt(0).toUpperCase() + pageName.slice(1)}</h1>
      {/* Your content here */}
    </main>
  );
}`,
    explanation: `Next.js page with metadata export. The title will be "${pageName} | ${siteName}" using the template.`,
  };
}

export function generateNextJsDynamicMetadata(): GeneratedCode {
  return {
    file: 'app/[slug]/page.tsx',
    code: `import type { Metadata } from 'next';

interface PageProps {
  params: { slug: string };
}

// Generate metadata dynamically based on the slug
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Fetch data based on slug (replace with your data fetching logic)
  const data = await fetchPageData(params.slug);

  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      images: data.image ? [{ url: data.image }] : [],
    },
  };
}

// Pre-generate static pages for known slugs (improves SEO)
export async function generateStaticParams() {
  const pages = await fetchAllPageSlugs();
  return pages.map((slug) => ({ slug }));
}

async function fetchPageData(slug: string) {
  // Replace with your actual data fetching
  return {
    title: slug.replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()),
    description: \`Learn about \${slug}\`,
    image: null,
  };
}

async function fetchAllPageSlugs() {
  // Replace with your actual data source
  return ['about', 'contact', 'pricing'];
}

export default function DynamicPage({ params }: PageProps) {
  return (
    <main>
      <h1>{params.slug}</h1>
    </main>
  );
}`,
    explanation: 'Next.js dynamic route with generateMetadata and generateStaticParams for SEO-optimized dynamic pages.',
  };
}

export function generateNextJsRobots(siteUrl: string): GeneratedCode {
  return {
    file: 'app/robots.ts',
    code: `import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
    ],
    sitemap: '${siteUrl}/sitemap.xml',
  };
}`,
    explanation: 'Next.js App Router robots.txt generator. Automatically served at /robots.txt.',
  };
}

export function generateNextJsSitemap(siteUrl: string): GeneratedCode {
  return {
    file: 'app/sitemap.ts',
    code: `import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: '${siteUrl}',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: '${siteUrl}/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: '${siteUrl}/pricing',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Dynamic pages (fetch from your database/CMS)
  // const posts = await fetchAllPosts();
  // const dynamicPages = posts.map((post) => ({
  //   url: \`${siteUrl}/blog/\${post.slug}\`,
  //   lastModified: post.updatedAt,
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.7,
  // }));

  return [...staticPages];
}`,
    explanation: 'Next.js App Router sitemap generator. Automatically served at /sitemap.xml.',
  };
}

// ============================================================================
// NEXT.JS (Pages Router) - Head component
// ============================================================================

export function generateNextJsPagesRouterHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'components/SEOHead.tsx',
    code: `import Head from 'next/head';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export function SEOHead({
  title = '${title || siteName}',
  description = '${description || `${siteName} - A compelling description.`}',
  image = '${image || `${siteUrl}/og-image.png`}',
  url = '${siteUrl}',
  type = 'website',
}: SEOHeadProps) {
  const fullTitle = title.includes('${siteName}') ? title : \`\${title} | ${siteName}\`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="${siteName}" />
      
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Head>
  );
}`,
    explanation: 'Next.js Pages Router SEO component using next/head. Import and use on each page.',
  };
}

// ============================================================================
// VUE.JS / NUXT - useHead composable
// ============================================================================

export function generateNuxtSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'composables/useSEO.ts',
    code: `export function useSEO(options: {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
} = {}) {
  const route = useRoute();
  const config = useRuntimeConfig();
  
  const defaults = {
    title: '${title || siteName}',
    description: '${description || `${siteName} - A compelling description.`}',
    image: '${image || `${siteUrl}/og-image.png`}',
    url: \`${siteUrl}\${route.path}\`,
    type: 'website' as const,
  };

  const meta = { ...defaults, ...options };
  const fullTitle = meta.title.includes('${siteName}') 
    ? meta.title 
    : \`\${meta.title} | ${siteName}\`;

  useHead({
    title: fullTitle,
    meta: [
      { name: 'description', content: meta.description },
      // Open Graph
      { property: 'og:type', content: meta.type },
      { property: 'og:url', content: meta.url },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: meta.description },
      { property: 'og:image', content: meta.image },
      { property: 'og:site_name', content: '${siteName}' },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: meta.description },
      { name: 'twitter:image', content: meta.image },
    ],
    link: [
      { rel: 'canonical', href: meta.url },
    ],
  });
}`,
    explanation: 'Nuxt 3 SEO composable using useHead(). Call useSEO() in any page to set meta tags.',
  };
}

export function generateNuxtPageExample(): GeneratedCode {
  return {
    file: 'pages/about.vue',
    code: `<script setup lang="ts">
useSEO({
  title: 'About Us',
  description: 'Learn more about our company and mission.',
});
</script>

<template>
  <main>
    <h1>About Us</h1>
    <!-- Your content here -->
  </main>
</template>`,
    explanation: 'Example Nuxt page using the useSEO composable.',
  };
}

// ============================================================================
// VUE.JS (without Nuxt) - vue-meta or @unhead/vue
// ============================================================================

export function generateVueSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'src/composables/useSEO.ts',
    code: `import { useHead } from '@unhead/vue';
import { computed, ref } from 'vue';

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export function useSEO(options: SEOOptions = {}) {
  const defaults = {
    title: '${title || siteName}',
    description: '${description || `${siteName} - A compelling description.`}',
    image: '${image || `${siteUrl}/og-image.png`}',
    url: typeof window !== 'undefined' ? window.location.href : '${siteUrl}',
    type: 'website' as const,
  };

  const meta = { ...defaults, ...options };
  const fullTitle = computed(() => 
    meta.title.includes('${siteName}') ? meta.title : \`\${meta.title} | ${siteName}\`
  );

  useHead({
    title: fullTitle,
    meta: [
      { name: 'description', content: meta.description },
      { property: 'og:type', content: meta.type },
      { property: 'og:url', content: meta.url },
      { property: 'og:title', content: fullTitle.value },
      { property: 'og:description', content: meta.description },
      { property: 'og:image', content: meta.image },
      { property: 'og:site_name', content: '${siteName}' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle.value },
      { name: 'twitter:description', content: meta.description },
      { name: 'twitter:image', content: meta.image },
    ],
    link: [
      { rel: 'canonical', href: meta.url },
    ],
  });
}`,
    explanation: 'Vue 3 SEO composable using @unhead/vue. Install with: npm install @unhead/vue',
    installCommands: ['npm install @unhead/vue'],
  };
}

// ============================================================================
// ASTRO - Frontmatter and BaseHead component
// ============================================================================

export function generateAstroBaseHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'src/components/BaseHead.astro',
    code: `---
interface Props {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
}

const {
  title = '${title || siteName}',
  description = '${description || `${siteName} - A compelling description.`}',
  image = '${image || '/og-image.png'}',
  type = 'website',
} = Astro.props;

const canonicalURL = new URL(Astro.url.pathname, Astro.site);
const fullTitle = title.includes('${siteName}') ? title : \`\${title} | ${siteName}\`;
const imageURL = new URL(image, Astro.site);
---

<!-- Global Metadata -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="generator" content={Astro.generator} />

<!-- Canonical URL -->
<link rel="canonical" href={canonicalURL} />

<!-- Primary Meta Tags -->
<title>{fullTitle}</title>
<meta name="title" content={fullTitle} />
<meta name="description" content={description} />

<!-- Open Graph / Facebook -->
<meta property="og:type" content={type} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:image" content={imageURL} />
<meta property="og:site_name" content="${siteName}" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content={canonicalURL} />
<meta name="twitter:title" content={fullTitle} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={imageURL} />`,
    explanation: 'Astro BaseHead component. Import in your layout: <BaseHead title="Page Title" description="..." />',
  };
}

export function generateAstroLayout(siteName: string): GeneratedCode {
  return {
    file: 'src/layouts/BaseLayout.astro',
    code: `---
import BaseHead from '../components/BaseHead.astro';

interface Props {
  title?: string;
  description?: string;
  image?: string;
}

const { title, description, image } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <BaseHead title={title} description={description} image={image} />
  </head>
  <body>
    <main>
      <slot />
    </main>
  </body>
</html>`,
    explanation: 'Astro layout using BaseHead component. Use in pages with frontmatter.',
  };
}

// ============================================================================
// SVELTEKIT - svelte:head
// ============================================================================

export function generateSvelteKitSEOHead(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'src/lib/components/SEOHead.svelte',
    code: `<script lang="ts">
  import { page } from '$app/stores';

  export let title = '${title || siteName}';
  export let description = '${description || `${siteName} - A compelling description.`}';
  export let image = '${image || `${siteUrl}/og-image.png`}';
  export let type: 'website' | 'article' = 'website';

  $: fullTitle = title.includes('${siteName}') ? title : \`\${title} | ${siteName}\`;
  $: canonicalUrl = $page.url.href;
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />
  
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta property="og:site_name" content="${siteName}" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
</svelte:head>`,
    explanation: 'SvelteKit SEO component using svelte:head. Import and use in +page.svelte files.',
  };
}

// ============================================================================
// ANGULAR - Meta and Title services
// ============================================================================

export function generateAngularSEOService(options: MetaFixOptions): GeneratedCode {
  const { siteName, siteUrl, title, description, image } = options;
  
  return {
    file: 'src/app/services/seo.service.ts',
    code: `import { Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
}

@Injectable({
  providedIn: 'root'
})
export class SEOService {
  private siteName = '${siteName}';
  private siteUrl = '${siteUrl}';
  private defaultDescription = '${description || `${siteName} - A compelling description.`}';
  private defaultImage = '${image || `${siteUrl}/og-image.png`}';

  constructor(
    private meta: Meta,
    private titleService: Title,
    private router: Router
  ) {}

  updateMeta(config: SEOConfig = {}): void {
    const title = config.title || this.siteName;
    const fullTitle = title.includes(this.siteName) ? title : \`\${title} | \${this.siteName}\`;
    const description = config.description || this.defaultDescription;
    const image = config.image || this.defaultImage;
    const url = this.siteUrl + this.router.url;
    const type = config.type || 'website';

    // Title
    this.titleService.setTitle(fullTitle);

    // Primary Meta
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ rel: 'canonical', href: url });

    // Open Graph
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });

    // Twitter
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
  }
}`,
    explanation: 'Angular SEO service using Meta and Title services. Inject and call updateMeta() in components.',
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
