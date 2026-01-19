# next-seo-autopilot

Next.js plugin for SEO automation - metadata generation, sitemap, robots.txt.

## Installation

```bash
npm install next-seo-autopilot
```

## Usage

### Config Enhancement

```typescript
// next.config.js
import { withSEO } from 'next-seo-autopilot';

export default withSEO({
  siteUrl: 'https://example.com',
  defaultMetadata: {
    title: 'My Site',
    description: 'Welcome to my site',
  },
})({
  // Your existing Next.js config
});
```

### Metadata Generation

```typescript
// lib/metadata.ts
import { createMetadataGenerator } from 'next-seo-autopilot/metadata';

export const generateMetadata = createMetadataGenerator({
  siteUrl: 'https://example.com',
  siteName: 'My Site',
  titleTemplate: '%s | My Site',
  defaultDescription: 'Default description',
  twitterHandle: '@mysite',
});

// app/about/page.tsx
export const metadata = generateMetadata({
  title: 'About Us',
  description: 'Learn about our company',
  path: '/about',
});
```

### Sitemap Generation

```typescript
// app/sitemap.ts
import { generateSitemapEntries, generateSitemapXml } from 'next-seo-autopilot';

export default async function sitemap() {
  const routes = ['/', '/about', '/blog', '/contact'];

  return generateSitemapEntries(routes, {
    siteUrl: 'https://example.com',
    additionalSitemapUrls: [
      { url: 'https://example.com/blog/post-1', priority: 0.9 },
    ],
  });
}
```

### Robots.txt Generation

```typescript
// app/robots.ts
import { createRobotsHandler } from 'next-seo-autopilot';

export default createRobotsHandler({
  siteUrl: 'https://example.com',
  robotsConfig: {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin'] },
    ],
  },
});
```

### JSON-LD Structured Data

```typescript
import { createWebsiteJsonLd, createArticleJsonLd } from 'next-seo-autopilot/metadata';

// Website schema
const websiteSchema = createWebsiteJsonLd({
  name: 'My Site',
  url: 'https://example.com',
  searchUrl: 'https://example.com/search?q={search_term_string}',
});

// Article schema
const articleSchema = createArticleJsonLd({
  headline: 'Article Title',
  author: { name: 'John Doe' },
  datePublished: '2024-01-15',
});
```

## Features

- **Config Enhancement**: Security headers, trailing slash normalization
- **Metadata Generator**: Consistent metadata with templates
- **Sitemap Generation**: XML sitemap with custom routes
- **Robots.txt**: Configurable rules and crawl delays
- **JSON-LD**: WebSite, Article, SoftwareApplication schemas
- **Validation**: Check metadata completeness

## API

### withSEO(config)

Enhance Next.js config with SEO settings.

### createMetadataGenerator(config)

Create a reusable metadata generator function.

### generateSitemapEntries(routes, config)

Generate sitemap entries from routes.

### generateRobotsTxt(config)

Generate robots.txt content.

### validateMetadata(metadata)

Validate metadata for completeness.

## License

MIT
