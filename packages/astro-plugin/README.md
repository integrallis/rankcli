# astro-rankcli

The [RankCLI](https://rankcli.dev) audit on every `astro build`: 280+ SEO and AI-search checks on the pages you just built, with a gate that can fail the build, plus `sitemap.xml`, `robots.txt` and a quick validation of each page's basics.

## Installation

```bash
npm install astro-rankcli
```

Works with Astro 3 through 7. On `astro build` it writes `sitemap.xml` and `robots.txt` into the output (unless `public/` already provides them), checks every built page's basics (title, description, canonical, headings, image alt text), then serves the output directory the way a static host would and runs the full RankCLI audit on it: the same 280+ checks as `rankcli audit --dir dist`, from crawlability and structured data to AI crawler access and answer-first content. Host-level checks (TLS, security headers, redirects) are skipped, since a build directory has none. Nothing is sent anywhere; the audit runs in the build.

```
[astro-rankcli] Auditing the build with RankCLI (14 pages, 280+ checks)...
[astro-rankcli] RankCLI score 84/100 across 14 pages: 0 errors, 3 warnings, 21 notices
[astro-rankcli]   warn  [META_DESC_SHORT] Meta description too short (2 pages)
[astro-rankcli]   warn  [IMAGES_MISSING_DIMENSIONS] 4 images without width/height (/blog/launch/)
[astro-rankcli]   21 notices not listed; see them with: rankcli audit --dir dist --url https://example.com -o llm
```

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

### The full audit of the build

On by default. Bound it or make it a gate:

```typescript
rankcli({
  siteUrl: 'https://example.com',
  audit: {
    maxPages: 20,                       // default: every built page, up to 50
    failOn: ['error', 'score<80'],      // the rules of `rankcli audit --fail-on`
  },
})
```

`failOn` takes `error`, `warning` or `notice` (any finding at or above that severity), `score<80` (the overall score) and `score:aiReadiness<70` (a category score); the build fails with the reasons in the error. `audit: false` turns the audit off and leaves the sitemap, robots.txt and validation. Everything the audit finds is listed with its code, so `rankcli audit --dir dist --url https://example.com -o json` gives the fix for any of them.

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
- **The RankCLI audit**: 280+ SEO and AI-search checks on the built output, with a CI gate
- **Page Validation**: a quick check of each page's basics during the build
- **Head Content Helper**: Generate SEO meta tags with proper escaping
- **Open Graph & Twitter Cards**: Full social metadata support

## Validation Checks

The quick per-page validation (the full audit's findings carry the engine's own codes):

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
