# astro-rankcli

Astro integration for SEO automation - sitemap, robots.txt, meta validation.

## Installation

```bash
npm install astro-rankcli
```

Works with Astro 3 through 7. On `astro build` it writes `sitemap.xml` and `robots.txt` into the output, unless `public/` already provides them. It then checks every built page (except 404/500) and, with `validate: { failOnError: true }`, fails the build on error-level issues.

## Usage

### Astro Config

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import rankcli from 'astro-rankcli';

export default defineConfig({
  integrations: [
    rankcli({
      siteUrl: 'https://example.com',
      sitemap: {
        exclude: ['/admin'],
        customRoutes: [
          { path: '/blog/featured', priority: 1.0 },
        ],
      },
      robots: {
        rules: [
          { userAgent: '*', allow: ['/'], disallow: ['/admin'] },
        ],
      },
      validate: {
        failOnError: false,
        checks: {
          title: true,
          description: true,
          ogTags: true,
          canonical: true,
          headings: true,
          images: true,
        },
      },
    }),
  ],
});
```

### Head Content Helper

```astro
---
// src/pages/index.astro
import { createHeadContent } from 'astro-rankcli';

const headContent = createHeadContent({
  title: 'My Site',
  description: 'Welcome to my site',
  canonical: 'https://example.com',
  ogImage: 'https://example.com/og.png',
  twitterCard: 'summary_large_image',
});
---

<html>
<head>
  <Fragment set:html={headContent} />
</head>
<body>
  <!-- content -->
</body>
</html>
```

### Page Validation

```typescript
import { validatePage } from 'astro-rankcli';

const html = await fetch('https://example.com').then(r => r.text());
const issues = validatePage(html, {
  checks: {
    title: true,
    description: true,
    ogTags: true,
    headings: true,
    images: true,
  },
}, '/');

console.log(issues);
// [
//   { code: 'MISSING_TITLE', message: 'Missing <title> tag', severity: 'error', page: '/' },
//   ...
// ]
```

### Manual Sitemap Generation

```typescript
import { generateSitemap } from 'astro-rankcli';

const sitemap = generateSitemap(
  'https://example.com',
  ['/', '/about', '/blog'],
  {
    exclude: ['/admin'],
    changefreq: 'weekly',
    priority: 0.8,
    customRoutes: [
      { path: '/blog/featured', priority: 1.0, lastmod: '2024-01-15' },
    ],
  }
);
```

### Manual Robots.txt Generation

```typescript
import { generateRobots } from 'astro-rankcli';

const robots = generateRobots('https://example.com', {
  rules: [
    { userAgent: '*', allow: ['/'], disallow: ['/admin', '/api'] },
    { userAgent: 'Googlebot', allow: ['/'], crawlDelay: 5 },
  ],
  host: 'https://example.com',
});
```

## Features

- **Sitemap Generation**: Automatic XML sitemap with custom routes, exclusions
- **Robots.txt**: Configurable rules, crawl delays, host directives
- **Page Validation**: Check for SEO issues during build
- **Head Content Helper**: Generate SEO meta tags with proper escaping
- **Open Graph & Twitter Cards**: Full social metadata support

## Validation Checks

| Check | Code | Severity |
|-------|------|----------|
| Missing title | `MISSING_TITLE` | error |
| Missing meta description | `MISSING_META_DESCRIPTION` | error |
| Missing Open Graph tags | `MISSING_OG_TAGS` | warning |
| Missing canonical URL | `MISSING_CANONICAL` | warning |
| Missing H1 heading | `MISSING_H1` | warning |
| Multiple H1 headings | `MULTIPLE_H1` | warning |
| Images without alt text | `IMG_MISSING_ALT` | warning |

## API

### rankcli(config)

Create an Astro integration with the given configuration.

### generateSitemap(siteUrl, routes, config)

Generate sitemap XML from routes.

### generateRobots(siteUrl, config)

Generate robots.txt content.

### validatePage(html, config?, pagePath?)

Validate HTML for SEO issues.

### createHeadContent(options)

Generate SEO head content (title, meta, OG tags).

## License

MIT
