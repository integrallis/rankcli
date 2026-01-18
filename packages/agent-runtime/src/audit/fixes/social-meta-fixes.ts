/**
 * Social Meta Tag Fix Generator
 *
 * Generates code fixes for missing Twitter Cards, Open Graph tags, and other social meta.
 * Supports multiple frameworks: HTML, React, Next.js, Astro, Remix, SvelteKit.
 */

import type { SocialMetaData } from '../checks/social-meta.js';

export interface SocialMetaFix {
  issueCode: string;
  filePath: string;
  framework: string;
  before?: string;
  after: string;
  explanation: string;
}

export interface SocialMetaConfig {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName?: string;
  twitterSite?: string;
  twitterCreator?: string;
  type?: 'website' | 'article' | 'product';
  locale?: string;
}

type Framework = 'html' | 'react' | 'nextjs-app' | 'nextjs-pages' | 'astro' | 'remix' | 'sveltekit' | 'vite-react';

/**
 * Detects the framework based on project files
 */
export function detectFramework(files: string[]): Framework {
  const fileSet = new Set(files.map(f => f.toLowerCase()));

  if (fileSet.has('next.config.js') || fileSet.has('next.config.ts') || fileSet.has('next.config.mjs')) {
    // Check for app directory
    if (files.some(f => f.includes('/app/') || f.includes('\\app\\'))) {
      return 'nextjs-app';
    }
    return 'nextjs-pages';
  }
  if (fileSet.has('astro.config.mjs') || fileSet.has('astro.config.ts')) {
    return 'astro';
  }
  if (fileSet.has('remix.config.js') || fileSet.has('remix.config.ts')) {
    return 'remix';
  }
  if (fileSet.has('svelte.config.js') || fileSet.has('svelte.config.ts')) {
    return 'sveltekit';
  }
  if (fileSet.has('vite.config.ts') || fileSet.has('vite.config.js')) {
    if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
      return 'vite-react';
    }
  }
  if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
    return 'react';
  }
  return 'html';
}

/**
 * Generates complete social meta tags for HTML
 */
export function generateHTMLSocialMeta(config: SocialMetaConfig): string {
  const lines: string[] = [
    '<!-- Primary Meta Tags -->',
    `<title>${config.title}</title>`,
    `<meta name="title" content="${config.title}" />`,
    `<meta name="description" content="${config.description}" />`,
    '',
    '<!-- Open Graph / Facebook -->',
    `<meta property="og:type" content="${config.type || 'website'}" />`,
    `<meta property="og:url" content="${config.url}" />`,
    `<meta property="og:title" content="${config.title}" />`,
    `<meta property="og:description" content="${config.description}" />`,
    `<meta property="og:image" content="${config.image}" />`,
  ];

  if (config.siteName) {
    lines.push(`<meta property="og:site_name" content="${config.siteName}" />`);
  }
  if (config.locale) {
    lines.push(`<meta property="og:locale" content="${config.locale}" />`);
  }

  lines.push(
    '',
    '<!-- Twitter -->',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:url" content="${config.url}" />`,
    `<meta name="twitter:title" content="${config.title}" />`,
    `<meta name="twitter:description" content="${config.description}" />`,
    `<meta name="twitter:image" content="${config.image}" />`
  );

  if (config.twitterSite) {
    lines.push(`<meta name="twitter:site" content="${config.twitterSite}" />`);
  }
  if (config.twitterCreator) {
    lines.push(`<meta name="twitter:creator" content="${config.twitterCreator}" />`);
  }

  return lines.join('\n');
}

/**
 * Generates React Helmet / react-helmet-async component
 */
export function generateReactHelmetSocialMeta(config: SocialMetaConfig): string {
  return `import { Helmet } from 'react-helmet-async';

export function SEO({
  title = "${config.title}",
  description = "${config.description}",
  image = "${config.image}",
  url = "${config.url}",
}) {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="${config.type || 'website'}" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      ${config.siteName ? `<meta property="og:site_name" content="${config.siteName}" />` : ''}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      ${config.twitterSite ? `<meta name="twitter:site" content="${config.twitterSite}" />` : ''}
    </Helmet>
  );
}`;
}

/**
 * Generates Next.js App Router metadata export
 */
export function generateNextAppMetadata(config: SocialMetaConfig): string {
  return `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "${config.title}",
  description: "${config.description}",
  openGraph: {
    type: '${config.type || 'website'}',
    url: '${config.url}',
    title: '${config.title}',
    description: '${config.description}',
    images: [
      {
        url: '${config.image}',
        width: 1200,
        height: 630,
        alt: '${config.title}',
      },
    ],
    ${config.siteName ? `siteName: '${config.siteName}',` : ''}
    ${config.locale ? `locale: '${config.locale}',` : ''}
  },
  twitter: {
    card: 'summary_large_image',
    title: '${config.title}',
    description: '${config.description}',
    images: ['${config.image}'],
    ${config.twitterSite ? `site: '${config.twitterSite}',` : ''}
    ${config.twitterCreator ? `creator: '${config.twitterCreator}',` : ''}
  },
};`;
}

/**
 * Generates Next.js Pages Router Head component
 */
export function generateNextPagesHead(config: SocialMetaConfig): string {
  return `import Head from 'next/head';

export default function Page() {
  return (
    <>
      <Head>
        <title>${config.title}</title>
        <meta name="title" content="${config.title}" />
        <meta name="description" content="${config.description}" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="${config.type || 'website'}" />
        <meta property="og:url" content="${config.url}" />
        <meta property="og:title" content="${config.title}" />
        <meta property="og:description" content="${config.description}" />
        <meta property="og:image" content="${config.image}" />
        ${config.siteName ? `<meta property="og:site_name" content="${config.siteName}" />` : ''}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="${config.url}" />
        <meta name="twitter:title" content="${config.title}" />
        <meta name="twitter:description" content="${config.description}" />
        <meta name="twitter:image" content="${config.image}" />
        ${config.twitterSite ? `<meta name="twitter:site" content="${config.twitterSite}" />` : ''}
      </Head>
      {/* Page content */}
    </>
  );
}`;
}

/**
 * Generates Astro frontmatter and BaseHead usage
 */
export function generateAstroMeta(config: SocialMetaConfig): string {
  return `---
// src/components/BaseHead.astro
export interface Props {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

const {
  title = "${config.title}",
  description = "${config.description}",
  image = "${config.image}",
  url = Astro.url.href,
} = Astro.props;
---

<!-- Primary Meta Tags -->
<title>{title}</title>
<meta name="title" content={title} />
<meta name="description" content={description} />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="${config.type || 'website'}" />
<meta property="og:url" content={url} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={image} />
${config.siteName ? `<meta property="og:site_name" content="${config.siteName}" />` : ''}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content={url} />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={image} />
${config.twitterSite ? `<meta name="twitter:site" content="${config.twitterSite}" />` : ''}`;
}

/**
 * Generates Remix meta function
 */
export function generateRemixMeta(config: SocialMetaConfig): string {
  return `import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "${config.title}" },
    { name: "description", content: "${config.description}" },

    // Open Graph
    { property: "og:type", content: "${config.type || 'website'}" },
    { property: "og:url", content: "${config.url}" },
    { property: "og:title", content: "${config.title}" },
    { property: "og:description", content: "${config.description}" },
    { property: "og:image", content: "${config.image}" },
    ${config.siteName ? `{ property: "og:site_name", content: "${config.siteName}" },` : ''}

    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:url", content: "${config.url}" },
    { name: "twitter:title", content: "${config.title}" },
    { name: "twitter:description", content: "${config.description}" },
    { name: "twitter:image", content: "${config.image}" },
    ${config.twitterSite ? `{ name: "twitter:site", content: "${config.twitterSite}" },` : ''}
  ];
};`;
}

/**
 * Generates SvelteKit +page.ts and svelte:head usage
 */
export function generateSvelteKitMeta(config: SocialMetaConfig): string {
  return `<!-- +page.svelte -->
<script>
  export let data;
</script>

<svelte:head>
  <title>${config.title}</title>
  <meta name="title" content="${config.title}" />
  <meta name="description" content="${config.description}" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${config.type || 'website'}" />
  <meta property="og:url" content="${config.url}" />
  <meta property="og:title" content="${config.title}" />
  <meta property="og:description" content="${config.description}" />
  <meta property="og:image" content="${config.image}" />
  ${config.siteName ? `<meta property="og:site_name" content="${config.siteName}" />` : ''}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${config.url}" />
  <meta name="twitter:title" content="${config.title}" />
  <meta name="twitter:description" content="${config.description}" />
  <meta name="twitter:image" content="${config.image}" />
  ${config.twitterSite ? `<meta name="twitter:site" content="${config.twitterSite}" />` : ''}
</svelte:head>`;
}

/**
 * Generates fix for a specific missing social meta tag
 */
export function generateSocialMetaFix(
  issueCode: string,
  framework: Framework,
  existingData: SocialMetaData,
  pageData: { title?: string; description?: string; url: string }
): SocialMetaFix {
  // Use existing data or defaults
  const config: SocialMetaConfig = {
    title: existingData.openGraph.title || pageData.title || 'Page Title',
    description: existingData.openGraph.description || pageData.description || 'Page description goes here.',
    image: existingData.openGraph.image || existingData.twitter.image || 'https://example.com/og-image.png',
    url: existingData.openGraph.url || pageData.url,
    siteName: existingData.openGraph.siteName,
    twitterSite: existingData.twitter.site,
    twitterCreator: existingData.twitter.creator,
    type: (existingData.openGraph.type as 'website' | 'article' | 'product') || 'website',
  };

  const fixes: Record<string, { explanation: string; tag: string }> = {
    OG_TITLE_MISSING: {
      explanation: 'Add Open Graph title for better social media previews',
      tag: `<meta property="og:title" content="${config.title}" />`,
    },
    OG_DESCRIPTION_MISSING: {
      explanation: 'Add Open Graph description for social media previews',
      tag: `<meta property="og:description" content="${config.description}" />`,
    },
    OG_IMAGE_MISSING: {
      explanation: 'Add Open Graph image (1200x630px recommended) for social previews',
      tag: `<meta property="og:image" content="${config.image}" />`,
    },
    OG_URL_MISSING: {
      explanation: 'Add Open Graph URL to specify the canonical URL for sharing',
      tag: `<meta property="og:url" content="${config.url}" />`,
    },
    OG_TYPE_MISSING: {
      explanation: 'Add Open Graph type to specify the content type',
      tag: `<meta property="og:type" content="${config.type}" />`,
    },
    TWITTER_CARD_MISSING: {
      explanation: 'Add Twitter Card meta tag for better Twitter previews',
      tag: '<meta name="twitter:card" content="summary_large_image" />',
    },
    TWITTER_IMAGE_MISSING: {
      explanation: 'Add Twitter image for Twitter Card previews',
      tag: `<meta name="twitter:image" content="${config.image}" />`,
    },
  };

  const fix = fixes[issueCode];
  if (!fix) {
    throw new Error(`Unknown issue code: ${issueCode}`);
  }

  // Determine file path based on framework
  const filePaths: Record<Framework, string> = {
    'html': 'index.html',
    'react': 'src/components/SEO.tsx',
    'vite-react': 'index.html',
    'nextjs-app': 'app/layout.tsx',
    'nextjs-pages': 'pages/_app.tsx',
    'astro': 'src/components/BaseHead.astro',
    'remix': 'app/root.tsx',
    'sveltekit': 'src/routes/+layout.svelte',
  };

  return {
    issueCode,
    filePath: filePaths[framework],
    framework,
    after: fix.tag,
    explanation: fix.explanation,
  };
}

/**
 * Generates complete social meta setup for a project
 */
export function generateCompleteSocialMetaSetup(
  framework: Framework,
  config: SocialMetaConfig
): { filePath: string; content: string; explanation: string } {
  const generators: Record<Framework, () => string> = {
    'html': () => generateHTMLSocialMeta(config),
    'react': () => generateReactHelmetSocialMeta(config),
    'vite-react': () => generateReactHelmetSocialMeta(config),
    'nextjs-app': () => generateNextAppMetadata(config),
    'nextjs-pages': () => generateNextPagesHead(config),
    'astro': () => generateAstroMeta(config),
    'remix': () => generateRemixMeta(config),
    'sveltekit': () => generateSvelteKitMeta(config),
  };

  const filePaths: Record<Framework, string> = {
    'html': 'index.html (inside <head>)',
    'react': 'src/components/SEO.tsx',
    'vite-react': 'src/components/SEO.tsx',
    'nextjs-app': 'app/layout.tsx',
    'nextjs-pages': 'pages/_document.tsx or pages/_app.tsx',
    'astro': 'src/components/BaseHead.astro',
    'remix': 'app/root.tsx',
    'sveltekit': 'src/routes/+layout.svelte',
  };

  return {
    filePath: filePaths[framework],
    content: generators[framework](),
    explanation: `Complete social meta tags setup for ${framework}. This includes Open Graph tags for Facebook/LinkedIn, Twitter Card tags, and primary meta tags for SEO.`,
  };
}

/**
 * OG Image recommendations based on platform requirements
 */
export const OG_IMAGE_SPECS = {
  recommended: {
    width: 1200,
    height: 630,
    aspectRatio: '1.91:1',
    format: ['PNG', 'JPG', 'WebP'],
    maxSize: '8MB',
  },
  twitter: {
    summary: { width: 120, height: 120 },
    summary_large_image: { width: 1200, height: 600 },
  },
  facebook: {
    minimum: { width: 200, height: 200 },
    recommended: { width: 1200, height: 630 },
  },
  linkedin: {
    recommended: { width: 1200, height: 627 },
  },
};
