# vite-plugin-rankcli

Vite plugin for SEO validation, sitemap generation, and meta tag injection.

## Installation

> **Not on npm yet.** `vite-plugin-rankcli` is the name it will publish under. Until then, build it from this repo (`pnpm --filter vite-plugin-rankcli build`) and install the folder.

```bash
npm install vite-plugin-rankcli -D
```

Works with Vite 4 through 8.

**Canonical URLs.** `siteUrl` becomes a canonical only in multi-page builds, where each HTML file gets its own (`/about/index.html` → `https://example.com/about/`). A single-page app serves one `index.html` for every route, so a static canonical there would point every route at the homepage. Set it per route at runtime instead, for example with react-helmet-async. `defaultMeta.canonical` is still written as given.

**robots.txt / sitemap.xml** are generated only when `public/` doesn't already ship them. Your own files always win.

## Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import rankcli from 'vite-plugin-rankcli';

export default defineConfig({
  plugins: [
    rankcli({
      siteUrl: 'https://example.com',
      defaultMeta: {
        description: 'My awesome site',
        ogTitle: 'My Site',
        ogDescription: 'Welcome to my site',
        ogImage: 'https://example.com/og-image.png',
        twitterCard: 'summary_large_image',
      },
      sitemap: {
        routes: ['/', '/about', '/blog', '/contact'],
      },
    }),
  ],
});
```

## Features

### SEO Validation

Automatically validates your HTML during build:

- Missing `<title>` tag
- Missing meta description
- Missing Open Graph tags
- Missing Twitter Card
- Missing canonical URL
- Missing or multiple H1 headings
- Images without alt text

### Sitemap Generation

Automatically generates `sitemap.xml`:

```typescript
rankcli({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: ['/', '/about', '/blog'],
    changefreq: 'weekly',
    priority: 0.8,
    customRoutes: [
      { path: '/blog', changefreq: 'daily', priority: 1.0 },
    ],
  },
});
```

### Robots.txt Generation

Automatically generates `robots.txt`:

```typescript
rankcli({
  siteUrl: 'https://example.com',
  robots: {
    rules: [
      { userAgent: '*', allow: ['/'], disallow: ['/admin'] },
    ],
  },
});
```

### Meta Tag Injection

Inject default meta tags into your HTML:

```typescript
rankcli({
  defaultMeta: {
    title: 'My Site',
    description: 'Site description',
    ogTitle: 'My Site',
    ogDescription: 'Site description',
    ogImage: 'https://example.com/image.png',
    twitterCard: 'summary_large_image',
    twitterSite: '@mysite',
    canonical: 'https://example.com',
  },
});
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `siteUrl` | `string` | Site URL for sitemap and canonical |
| `defaultMeta` | `MetaConfig` | Default meta tags to inject |
| `sitemap` | `boolean \| SitemapConfig` | Sitemap configuration |
| `robots` | `boolean \| RobotsConfig` | Robots.txt configuration |
| `validate` | `boolean \| ValidationConfig` | Validation configuration |
| `devWarnings` | `boolean` | Show warnings in dev server |

## License

MIT
