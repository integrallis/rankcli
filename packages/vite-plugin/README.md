# vite-plugin-seo-autopilot

Vite plugin for SEO validation, sitemap generation, and meta tag injection.

## Installation

```bash
npm install vite-plugin-seo-autopilot -D
```

## Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import seoAutopilot from 'vite-plugin-seo-autopilot';

export default defineConfig({
  plugins: [
    seoAutopilot({
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
seoAutopilot({
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
seoAutopilot({
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
seoAutopilot({
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
