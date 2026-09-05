// AUTO-GENERATED - do not edit manually.
// Regenerate with: tsx scripts/generate-embedded-recipes.ts
// (also runs automatically as part of 'pnpm build')
import { embedRecipe } from './suggestion-engine.js';

embedRecipe("angular", `# Angular SEO Recipe
# Angular has SSR support via Angular Universal

framework: angular
display_name: Angular
category: spa
ssr_default: false

seo_challenges:
  - "Client-side rendering by default"
  - "Heavy initial bundle size"
  - "Complex SSR setup (Angular Universal)"
  - "Zone.js can cause performance issues"

checks:
  - code: ANGULAR_NO_UNIVERSAL
    severity: error
    title: "Angular app without Universal (SSR)"
    description: "Client-side Angular apps send empty HTML to crawlers."
    impact: "Your content may not be indexed by search engines"
    howToFix: |
      Add Angular Universal for SSR:

      \`\`\`bash
      ng add @angular/ssr
      \`\`\`

      This adds server-side rendering to your Angular app.
    detection:
      html_patterns:
        - '<app-root></app-root>'
      missing_content: true

  - code: ANGULAR_NO_TITLE_SERVICE
    severity: error
    title: "Not using Title/Meta services"
    description: "Angular has built-in services for managing title and meta tags."
    howToFix: |
      Use Title and Meta services:

      \`\`\`ts
      import { Title, Meta } from '@angular/platform-browser';

      @Component({...})
      export class ProductComponent {
        constructor(
          private title: Title,
          private meta: Meta
        ) {}

        ngOnInit() {
          this.title.setTitle('Product Name | Your Site');
          this.meta.updateTag({ name: 'description', content: 'Product description' });
          this.meta.updateTag({ property: 'og:title', content: 'Product Name' });
        }
      }
      \`\`\`

  - code: ANGULAR_LAZY_LOAD_MISSING
    severity: warning
    title: "Routes not lazy loaded"
    description: "Loading all modules upfront increases initial bundle size."
    howToFix: |
      Use lazy loading for routes:

      \`\`\`ts
      const routes: Routes = [
        {
          path: 'products',
          loadChildren: () => import('./products/products.module')
            .then(m => m.ProductsModule)
        },
        // Or with standalone components
        {
          path: 'about',
          loadComponent: () => import('./about/about.component')
            .then(m => m.AboutComponent)
        }
      ];
      \`\`\`

  - code: ANGULAR_PRERENDER_MISSING
    severity: warning
    title: "Static routes not prerendered"
    description: "Static pages should be prerendered at build time."
    howToFix: |
      Configure prerendering in angular.json:

      \`\`\`json
      {
        "projects": {
          "your-app": {
            "architect": {
              "prerender": {
                "options": {
                  "routes": ["/", "/about", "/contact"]
                }
              }
            }
          }
        }
      }
      \`\`\`

      Run: \`ng run your-app:prerender\`

  - code: ANGULAR_CHANGE_DETECTION
    severity: notice
    title: "Using default change detection"
    description: "OnPush change detection improves performance significantly."
    howToFix: |
      Use OnPush for components:

      \`\`\`ts
      @Component({
        selector: 'app-product',
        changeDetection: ChangeDetectionStrategy.OnPush,
        template: \`...\`
      })
      export class ProductComponent {}
      \`\`\`

  - code: ANGULAR_LARGE_BUNDLE
    severity: warning
    title: "Large initial bundle detected"
    description: "Bundle over 500KB significantly hurts performance."
    howToFix: |
      1. Enable build optimizer:
      \`\`\`json
      // angular.json
      "optimization": true,
      "buildOptimizer": true
      \`\`\`

      2. Analyze bundle:
      \`\`\`bash
      ng build --stats-json
      npx webpack-bundle-analyzer dist/your-app/stats.json
      \`\`\`

      3. Remove unused dependencies

  - code: ANGULAR_NO_IMAGE_DIRECTIVE
    severity: notice
    title: "Not using NgOptimizedImage"
    description: "Angular 15+ has built-in image optimization."
    howToFix: |
      Use NgOptimizedImage directive:

      \`\`\`ts
      import { NgOptimizedImage } from '@angular/common';

      @Component({
        imports: [NgOptimizedImage],
        template: \`
          <img ngSrc="/hero.jpg" width="1200" height="630" priority />
        \`
      })
      \`\`\`

performance_tips:
  - "Use standalone components to reduce bundle"
  - "Enable OnPush change detection"
  - "Lazy load routes"
  - "Use trackBy with ngFor"
  - "Prerender static pages"

migration_paths:
  analog:
    effort: medium
    benefits:
      - "File-based routing"
      - "Full SSR support"
      - "Vite-powered builds"
    guide: "https://analogjs.org/docs/introduction"
`);
embedRecipe("astro", `# Astro SEO Recipe
# Astro is SEO-first by design - zero JS by default, excellent for content sites

framework: astro
display_name: Astro
category: static-first
ssr_default: false  # Static by default, SSR optional

seo_strengths:
  - "Zero JavaScript by default"
  - "Static HTML output"
  - "Excellent performance (100 Lighthouse)"
  - "Content Collections for organized content"
  - "Built-in sitemap and RSS integrations"
  - "Partial hydration (Islands Architecture)"

checks:
  - code: ASTRO_NO_SITEMAP
    severity: warning
    title: "Missing sitemap integration"
    description: "Astro has a built-in sitemap integration."
    howToFix: |
      Add the sitemap integration:

      \`\`\`bash
      npx astro add sitemap
      \`\`\`

      Configure in astro.config.mjs:
      \`\`\`js
      import sitemap from '@astrojs/sitemap';

      export default defineConfig({
        site: 'https://yoursite.com',
        integrations: [sitemap()],
      });
      \`\`\`

  - code: ASTRO_NO_SITE_CONFIG
    severity: error
    title: "Missing site URL configuration"
    description: "The site URL is required for sitemap and canonical URLs."
    howToFix: |
      Add site to astro.config.mjs:

      \`\`\`js
      export default defineConfig({
        site: 'https://yoursite.com',
      });
      \`\`\`

  - code: ASTRO_CLIENT_DIRECTIVE_OVERUSE
    severity: warning
    title: "Overusing client: directives"
    description: "Too many client-side components reduce Astro's performance benefits."
    howToFix: |
      Only hydrate components that need interactivity:

      \`\`\`astro
      <!-- Bad - unnecessary JS -->
      <StaticCard client:load />

      <!-- Good - no JS for static content -->
      <StaticCard />

      <!-- Good - only hydrate when needed -->
      <InteractiveWidget client:visible />
      \`\`\`

      Prefer client:visible over client:load for below-fold content.

  - code: ASTRO_NO_BASE_LAYOUT
    severity: notice
    title: "Pages missing base layout"
    description: "Using a shared layout ensures consistent SEO tags."
    howToFix: |
      Create a BaseLayout.astro:

      \`\`\`astro
      ---
      // src/layouts/BaseLayout.astro
      interface Props {
        title: string;
        description: string;
      }
      const { title, description } = Astro.props;
      ---
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width" />
          <title>{title}</title>
          <meta name="description" content={description} />
          <link rel="canonical" href={Astro.url} />
        </head>
        <body>
          <slot />
        </body>
      </html>
      \`\`\`

  - code: ASTRO_NO_ASTRO_SEO
    severity: notice
    title: "Not using @astrolib/seo"
    description: "The astro-seo package provides comprehensive SEO components."
    howToFix: |
      Install astro-seo:

      \`\`\`bash
      npm install astro-seo
      \`\`\`

      \`\`\`astro
      ---
      import { SEO } from 'astro-seo';
      ---
      <SEO
        title="Page Title"
        description="Description"
        openGraph={{
          basic: {
            title: "OG Title",
            type: "website",
            image: "/og-image.jpg",
          }
        }}
        twitter={{
          creator: "@handle"
        }}
      />
      \`\`\`
    detection:
      html_missing_patterns:
        - 'rel="canonical"'

  - code: ASTRO_IMAGE_NOT_OPTIMIZED
    severity: warning
    title: "Images not using Astro Image"
    description: "Use Astro's built-in Image component for optimization."
    howToFix: |
      Use the Image component:

      \`\`\`astro
      ---
      import { Image } from 'astro:assets';
      import heroImage from '../assets/hero.jpg';
      ---
      <Image
        src={heroImage}
        alt="Hero"
        width={1200}
        height={630}
        loading="eager"
      />
      \`\`\`

  - code: ASTRO_NO_CONTENT_COLLECTIONS
    severity: notice
    title: "Not using Content Collections"
    description: "Content Collections provide type-safe content with built-in frontmatter validation."
    howToFix: |
      Define a collection in src/content/config.ts:

      \`\`\`ts
      import { defineCollection, z } from 'astro:content';

      const blog = defineCollection({
        schema: z.object({
          title: z.string(),
          description: z.string(),
          pubDate: z.date(),
        }),
      });

      export const collections = { blog };
      \`\`\`

  - code: ASTRO_SSR_OVERUSE
    severity: notice
    title: "Using SSR when static would work"
    description: "Static pages are faster and cheaper to host."
    howToFix: |
      Use prerender for pages that don't need SSR:

      \`\`\`astro
      ---
      export const prerender = true; // Static generation
      ---
      \`\`\`

      Or set default to static in config:
      \`\`\`js
      export default defineConfig({
        output: 'hybrid', // Static by default, SSR opt-in
      });
      \`\`\`

performance_tips:
  - "Use client:visible instead of client:load for below-fold components"
  - "Leverage Content Collections for type-safe content"
  - "Use View Transitions for smooth navigation"
  - "Optimize images with astro:assets"
  - "Consider using Astro DB for dynamic content"

integrations:
  - "@astrojs/sitemap - Automatic sitemap generation"
  - "@astrojs/rss - RSS feed for blogs"
  - "astro-seo - Comprehensive SEO component"
  - "@astrojs/partytown - Move third-party scripts to web worker"
`);
embedRecipe("django", `# Django SEO Recipe
# Django is the most popular Python web framework

framework: django
display_name: Django
category: server-rendered
ssr_default: true

seo_strengths:
  - "Server-rendered HTML by default"
  - "Built-in sitemap framework"
  - "Admin interface for content management"
  - "Mature ecosystem"

checks:
  - code: DJANGO_NO_SITEMAP
    severity: warning
    title: "Django sitemap framework not configured"
    description: "Django has a built-in sitemap framework that should be used."
    howToFix: |
      Add sitemap to your project:

      \`\`\`python
      # settings.py
      INSTALLED_APPS = [
          'django.contrib.sitemaps',
      ]

      # sitemaps.py
      from django.contrib.sitemaps import Sitemap
      from .models import Post

      class PostSitemap(Sitemap):
          changefreq = "weekly"
          priority = 0.8

          def items(self):
              return Post.objects.filter(published=True)

          def lastmod(self, obj):
              return obj.updated_at

      # urls.py
      from django.contrib.sitemaps.views import sitemap
      from .sitemaps import PostSitemap

      sitemaps = {'posts': PostSitemap}

      urlpatterns = [
          path('sitemap.xml', sitemap, {'sitemaps': sitemaps}),
      ]
      \`\`\`

  - code: DJANGO_NO_META_FRAMEWORK
    severity: warning
    title: "No SEO meta framework detected"
    description: "Use django-meta for consistent meta tag management."
    howToFix: |
      Install django-meta:

      \`\`\`bash
      pip install django-meta
      \`\`\`

      \`\`\`python
      # settings.py
      INSTALLED_APPS = ['meta']

      META_SITE_PROTOCOL = 'https'
      META_USE_OG_PROPERTIES = True
      META_USE_TWITTER_PROPERTIES = True
      \`\`\`

      \`\`\`python
      # In views or models
      from meta.views import MetadataMixin

      class PostDetailView(MetadataMixin, DetailView):
          def get_meta_title(self):
              return self.object.title

          def get_meta_description(self):
              return self.object.excerpt
      \`\`\`
    detection:
      html_missing_patterns:
        - 'property="og:'
        - 'name="twitter:'

  - code: DJANGO_DEBUG_TRUE
    severity: error
    title: "DEBUG mode appears enabled"
    description: "DEBUG=True in production exposes sensitive information and hurts performance."
    howToFix: |
      Ensure DEBUG is False in production:

      \`\`\`python
      # settings.py
      DEBUG = os.environ.get('DEBUG', 'False') == 'True'
      \`\`\`

      Or use django-environ:
      \`\`\`python
      import environ
      env = environ.Env(DEBUG=(bool, False))
      DEBUG = env('DEBUG')
      \`\`\`

  - code: DJANGO_NO_CACHE
    severity: warning
    title: "Caching not configured"
    description: "Django without caching is slower than it should be."
    howToFix: |
      Configure caching in settings.py:

      \`\`\`python
      # Redis (recommended)
      CACHES = {
          'default': {
              'BACKEND': 'django.core.cache.backends.redis.RedisCache',
              'LOCATION': 'redis://127.0.0.1:6379',
          }
      }

      # Use cache in views
      from django.views.decorators.cache import cache_page

      @cache_page(60 * 15)  # 15 minutes
      def my_view(request):
          ...
      \`\`\`

  - code: DJANGO_NO_GZIP
    severity: notice
    title: "GZip middleware not enabled"
    description: "Enable GZip compression for faster page loads."
    howToFix: |
      Add GZip middleware:

      \`\`\`python
      # settings.py
      MIDDLEWARE = [
          'django.middleware.gzip.GZipMiddleware',
          # ... other middleware
      ]
      \`\`\`

  - code: DJANGO_NO_WHITENOISE
    severity: notice
    title: "Static files not optimized"
    description: "Use WhiteNoise for efficient static file serving."
    howToFix: |
      Install and configure WhiteNoise:

      \`\`\`bash
      pip install whitenoise
      \`\`\`

      \`\`\`python
      # settings.py
      MIDDLEWARE = [
          'django.middleware.security.SecurityMiddleware',
          'whitenoise.middleware.WhiteNoiseMiddleware',
          # ...
      ]

      STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
      \`\`\`

performance_tips:
  - "Use select_related/prefetch_related for queries"
  - "Enable template caching in production"
  - "Use django-debug-toolbar in development"
  - "Configure database connection pooling"
  - "Use async views for I/O-bound operations (Django 4.1+)"

recommended_packages:
  seo:
    - "django-meta - Meta tag management"
    - "django-robots - robots.txt management"
  performance:
    - "django-redis - Redis caching"
    - "whitenoise - Static file serving"
    - "django-debug-toolbar - Development profiling"
`);
embedRecipe("laravel", `# Laravel SEO Recipe
# Laravel is the most popular PHP framework

framework: laravel
display_name: Laravel
category: server-rendered
ssr_default: true

seo_strengths:
  - "Server-rendered HTML by default"
  - "Blade templates for clean SEO markup"
  - "Route caching for fast responses"
  - "Built-in CSRF and security"

checks:
  - code: LARAVEL_NO_META_PACKAGE
    severity: warning
    title: "No SEO package detected"
    description: "Laravel benefits from an SEO package like artesaos/seotools."
    howToFix: |
      Install artesaos/seotools:

      \`\`\`bash
      composer require artesaos/seotools
      \`\`\`

      \`\`\`php
      // In controller
      use Artesaos\\SEOTools\\Facades\\SEOMeta;

      SEOMeta::setTitle('Page Title');
      SEOMeta::setDescription('Description');

      // In Blade
      {!! SEOMeta::generate() !!}
      \`\`\`
    detection:
      html_missing_patterns:
        - 'property="og:'

  - code: LARAVEL_NO_SITEMAP
    severity: warning
    title: "No sitemap package detected"
    description: "Use spatie/laravel-sitemap for automatic sitemaps."
    howToFix: |
      \`\`\`bash
      composer require spatie/laravel-sitemap
      \`\`\`

      \`\`\`php
      // Generate sitemap
      use Spatie\\Sitemap\\SitemapGenerator;

      SitemapGenerator::create('https://yoursite.com')
          ->writeToFile(public_path('sitemap.xml'));

      // Or build manually
      use Spatie\\Sitemap\\Sitemap;
      use Spatie\\Sitemap\\Tags\\Url;

      Sitemap::create()
          ->add(Url::create('/')->setPriority(1.0))
          ->add(Url::create('/about'))
          ->writeToFile(public_path('sitemap.xml'));
      \`\`\`

  - code: LARAVEL_INERTIA_NO_SSR
    severity: error
    title: "Inertia.js without SSR"
    description: "Inertia apps are client-rendered by default, losing SEO benefits."
    howToFix: |
      Enable Inertia SSR:

      \`\`\`bash
      php artisan inertia:start-ssr
      \`\`\`

      Configure in config/inertia.php:
      \`\`\`php
      'ssr' => [
          'enabled' => true,
          'url' => 'http://127.0.0.1:13714',
      ],
      \`\`\`

  - code: LARAVEL_NO_RESPONSE_CACHE
    severity: notice
    title: "Response caching not configured"
    description: "Cache full responses for better performance."
    howToFix: |
      Install spatie/laravel-responsecache:

      \`\`\`bash
      composer require spatie/laravel-responsecache
      \`\`\`

      Add middleware:
      \`\`\`php
      // app/Http/Kernel.php
      protected $middlewareGroups = [
          'web' => [
              \\Spatie\\ResponseCache\\Middlewares\\CacheResponse::class,
          ],
      ];
      \`\`\`

  - code: LARAVEL_LIVEWIRE_SEO
    severity: warning
    title: "Livewire components may affect SEO"
    description: "Livewire content loads via JavaScript after initial page load."
    howToFix: |
      For SEO-critical content, use wire:init to load immediately:

      \`\`\`blade
      <div wire:init="loadData">
          @if($data)
              {{-- Content --}}
          @else
              {{-- Loading skeleton --}}
          @endif
      </div>
      \`\`\`

      Or use Alpine.js for client-only interactions.

performance_tips:
  - "Enable route caching: php artisan route:cache"
  - "Enable config caching: php artisan config:cache"
  - "Use query caching with remember()"
  - "Optimize autoloader: composer dump-autoload -o"
  - "Use Laravel Octane for high performance"

recommended_packages:
  seo:
    - "artesaos/seotools - Meta tag management"
    - "spatie/laravel-sitemap - Sitemap generation"
    - "spatie/schema-org - Structured data"
  performance:
    - "spatie/laravel-responsecache - Full page caching"
    - "barryvdh/laravel-debugbar - Development profiling"
`);
embedRecipe("nextjs", `# Next.js SEO Recipe
# Next.js has excellent SEO by default, but there are still common mistakes

framework: nextjs
display_name: Next.js
category: meta-framework
base_framework: react
ssr_default: true

seo_strengths:
  - "Server-side rendering by default"
  - "Static site generation support"
  - "Built-in Image component with optimization"
  - "Automatic code splitting"
  - "File-based routing"
  - "Built-in metadata API (App Router)"

checks:
  # App Router specific
  - code: NEXTJS_NO_METADATA_API
    severity: warning
    title: "Not using Next.js Metadata API"
    description: "Next.js 13+ has a built-in Metadata API that's better than react-helmet."
    howToFix: |
      Use the Metadata API in your layout or page:

      \`\`\`tsx
      // app/page.tsx
      import { Metadata } from 'next';

      export const metadata: Metadata = {
        title: 'Page Title',
        description: 'Page description',
        openGraph: {
          title: 'OG Title',
          description: 'OG Description',
          images: ['/og-image.jpg'],
        },
      };

      // For dynamic metadata
      export async function generateMetadata({ params }): Promise<Metadata> {
        const product = await getProduct(params.id);
        return {
          title: product.name,
          description: product.description,
        };
      }
      \`\`\`
    app_router_only: true
    detection:
      html_missing_patterns:
        - 'property="og:title"'
        - 'property="og:description"'

  - code: NEXTJS_GENERATESTATICPARAMS_MISSING
    severity: warning
    title: "Dynamic routes without generateStaticParams"
    description: "Dynamic routes like [id] should pre-generate static pages for SEO."
    howToFix: |
      Add generateStaticParams to pre-render dynamic pages:

      \`\`\`tsx
      // app/products/[id]/page.tsx
      export async function generateStaticParams() {
        const products = await getProducts();
        return products.map((product) => ({
          id: product.id.toString(),
        }));
      }
      \`\`\`
    app_router_only: true

  # Pages Router specific
  - code: NEXTJS_NO_GETSTATICPROPS
    severity: warning
    title: "Pages without getStaticProps/getServerSideProps"
    description: "Pages fetching data client-side miss SEO benefits of SSR/SSG."
    howToFix: |
      Move data fetching to getStaticProps (for static) or getServerSideProps (for dynamic):

      \`\`\`tsx
      // pages/products.tsx
      export async function getStaticProps() {
        const products = await fetchProducts();
        return {
          props: { products },
          revalidate: 3600, // ISR: regenerate every hour
        };
      }
      \`\`\`
    pages_router_only: true

  # Common issues
  - code: NEXTJS_IMAGE_NOT_USED
    severity: warning
    title: "Using <img> instead of next/image"
    description: "The next/image component provides automatic optimization, lazy loading, and prevents CLS."
    howToFix: |
      Replace <img> with next/image:

      \`\`\`tsx
      import Image from 'next/image';

      // Before
      <img src="/hero.jpg" alt="Hero" />

      // After
      <Image
        src="/hero.jpg"
        alt="Hero"
        width={1200}
        height={630}
        priority // for above-the-fold images
      />
      \`\`\`

  - code: NEXTJS_NO_PRIORITY_IMAGE
    severity: notice
    title: "LCP image missing priority prop"
    description: "The largest image above the fold should have priority={true} for faster LCP."
    howToFix: |
      Add priority to your hero/LCP image:

      \`\`\`tsx
      <Image
        src="/hero.jpg"
        alt="Hero"
        width={1200}
        height={630}
        priority
      />
      \`\`\`

  - code: NEXTJS_LINK_NO_PREFETCH
    severity: notice
    title: "Link without prefetch consideration"
    description: "Next.js prefetches all links by default, which can waste bandwidth."
    howToFix: |
      Disable prefetch for less important links:

      \`\`\`tsx
      <Link href="/terms" prefetch={false}>
        Terms of Service
      </Link>
      \`\`\`

  - code: NEXTJS_NO_ROBOTS_TXT
    severity: warning
    title: "Missing robots.txt configuration"
    description: "Next.js can generate robots.txt automatically."
    howToFix: |
      App Router - create app/robots.ts:
      \`\`\`tsx
      import { MetadataRoute } from 'next';

      export default function robots(): MetadataRoute.Robots {
        return {
          rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/api/',
          },
          sitemap: 'https://yoursite.com/sitemap.xml',
        };
      }
      \`\`\`

      Pages Router - create public/robots.txt or use next-sitemap package.

  - code: NEXTJS_NO_SITEMAP
    severity: warning
    title: "Missing sitemap configuration"
    description: "Next.js can generate sitemaps automatically."
    howToFix: |
      App Router - create app/sitemap.ts:
      \`\`\`tsx
      import { MetadataRoute } from 'next';

      export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
        const products = await getProducts();

        return [
          { url: 'https://yoursite.com', lastModified: new Date() },
          { url: 'https://yoursite.com/about', lastModified: new Date() },
          ...products.map((product) => ({
            url: \`https://yoursite.com/products/\${product.id}\`,
            lastModified: product.updatedAt,
          })),
        ];
      }
      \`\`\`

  - code: NEXTJS_USE_CLIENT_OVERUSE
    severity: warning
    title: "Overusing 'use client' directive"
    description: "Too many client components reduces SSR benefits."
    howToFix: |
      Keep 'use client' at the leaf level:

      \`\`\`tsx
      // Bad - entire page is client-rendered
      'use client';
      export default function Page() { ... }

      // Good - only interactive parts are client
      // page.tsx (Server Component)
      import ClientButton from './ClientButton';
      export default function Page() {
        return <div>
          <h1>Server rendered content</h1>
          <ClientButton /> {/* Only this is client */}
        </div>
      }
      \`\`\`

  - code: NEXTJS_FONT_NOT_OPTIMIZED
    severity: notice
    title: "Not using next/font for fonts"
    description: "next/font automatically optimizes fonts and prevents CLS."
    howToFix: |
      Use next/font for Google Fonts or local fonts:

      \`\`\`tsx
      import { Inter } from 'next/font/google';

      const inter = Inter({ subsets: ['latin'] });

      export default function RootLayout({ children }) {
        return (
          <html lang="en" className={inter.className}>
            <body>{children}</body>
          </html>
        );
      }
      \`\`\`

  - code: NEXTJS_NO_TRAILING_SLASH_CONFIG
    severity: notice
    title: "Inconsistent trailing slash handling"
    description: "Inconsistent URLs can cause duplicate content issues."
    howToFix: |
      Configure trailingSlash in next.config.js:

      \`\`\`js
      module.exports = {
        trailingSlash: true, // or false
      };
      \`\`\`

performance_tips:
  - "Use React Server Components for static content"
  - "Add priority to LCP images"
  - "Use next/font for fonts"
  - "Enable ISR for frequently updated pages"
  - "Use Route Handlers instead of API routes for server-only logic"

structured_data:
  - type: "JSON-LD in metadata"
    example: |
      \`\`\`tsx
      export const metadata: Metadata = {
        other: {
          'script:ld+json': JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Your Company',
            url: 'https://yoursite.com',
          }),
        },
      };
      \`\`\`
`);
embedRecipe("nuxt", `# Nuxt SEO Recipe
# Nuxt has excellent SEO capabilities, similar to Next.js for Vue

framework: nuxt
display_name: Nuxt
category: meta-framework
base_framework: vue
ssr_default: true

seo_strengths:
  - "Universal rendering (SSR) by default"
  - "Static site generation support"
  - "Built-in useSeoMeta composable"
  - "Automatic code splitting"
  - "File-based routing"
  - "NuxtImage for image optimization"

checks:
  - code: NUXT_NO_USESEOMETA
    severity: warning
    title: "Not using useSeoMeta composable"
    description: "Nuxt 3 has built-in SEO meta composables that are cleaner than useHead."
    howToFix: |
      Use useSeoMeta for SEO tags:

      \`\`\`vue
      <script setup>
      useSeoMeta({
        title: 'Page Title',
        description: 'Page description',
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: '/og-image.jpg',
        twitterCard: 'summary_large_image',
      });
      </script>
      \`\`\`

  - code: NUXT_USEFETCH_CLIENT_ONLY
    severity: warning
    title: "Data fetching only on client side"
    description: "Using onMounted for data fetching bypasses SSR benefits."
    howToFix: |
      Use useFetch or useAsyncData instead:

      \`\`\`vue
      <script setup>
      // Bad - client only
      const data = ref(null);
      onMounted(async () => {
        data.value = await $fetch('/api/data');
      });

      // Good - SSR friendly
      const { data } = await useFetch('/api/data');
      </script>
      \`\`\`

  - code: NUXT_NO_NUXT_IMAGE
    severity: warning
    title: "Not using NuxtImage for images"
    description: "@nuxt/image provides automatic optimization and responsive images."
    howToFix: |
      Install and use NuxtImage:

      \`\`\`bash
      npx nuxi module add image
      \`\`\`

      \`\`\`vue
      <template>
        <NuxtImg
          src="/hero.jpg"
          alt="Hero"
          width="1200"
          height="630"
          preload
        />
      </template>
      \`\`\`

  - code: NUXT_NO_ROBOTS
    severity: warning
    title: "Missing robots.txt configuration"
    description: "Use @nuxtjs/robots module for robots.txt."
    howToFix: |
      Install and configure robots module:

      \`\`\`bash
      npm install @nuxtjs/robots
      \`\`\`

      \`\`\`ts
      // nuxt.config.ts
      export default defineNuxtConfig({
        modules: ['@nuxtjs/robots'],
        robots: {
          rules: [
            { UserAgent: '*', Allow: '/' },
            { UserAgent: '*', Disallow: '/api/' },
          ],
          sitemap: 'https://yoursite.com/sitemap.xml',
        },
      });
      \`\`\`

  - code: NUXT_NO_SITEMAP
    severity: warning
    title: "Missing sitemap configuration"
    description: "Use @nuxtjs/sitemap module for automatic sitemap."
    howToFix: |
      Install sitemap module:

      \`\`\`bash
      npm install @nuxtjs/sitemap
      \`\`\`

      \`\`\`ts
      // nuxt.config.ts
      export default defineNuxtConfig({
        modules: ['@nuxtjs/sitemap'],
        sitemap: {
          hostname: 'https://yoursite.com',
        },
      });
      \`\`\`

  - code: NUXT_SPA_MODE
    severity: error
    title: "Nuxt running in SPA mode"
    description: "SPA mode disables SSR, losing SEO benefits."
    howToFix: |
      Remove ssr: false from nuxt.config.ts:

      \`\`\`ts
      export default defineNuxtConfig({
        // Remove this line
        // ssr: false,
      });
      \`\`\`

      If you need client-only components, use <ClientOnly>:
      \`\`\`vue
      <ClientOnly>
        <BrowserOnlyWidget />
      </ClientOnly>
      \`\`\`
    detection:
      html_patterns:
        - '<div id="__nuxt">'
      missing_content: true

  - code: NUXT_NO_PRERENDER
    severity: notice
    title: "Static pages not pre-rendered"
    description: "Static pages could be pre-rendered for better performance."
    howToFix: |
      Enable route prerendering in nuxt.config.ts:

      \`\`\`ts
      export default defineNuxtConfig({
        routeRules: {
          '/about': { prerender: true },
          '/blog/**': { prerender: true },
        },
      });
      \`\`\`

      Or generate a fully static site:
      \`\`\`bash
      nuxt generate
      \`\`\`

performance_tips:
  - "Use useLazyFetch for non-critical data"
  - "Add preload prop to NuxtImg for LCP images"
  - "Use Nuxt DevTools to identify performance issues"
  - "Configure image provider for CDN delivery"
  - "Use route rules for caching strategies"
`);
embedRecipe("rails", `# Ruby on Rails SEO Recipe
# Rails is server-rendered by default, excellent for SEO

framework: rails
display_name: Ruby on Rails
category: server-rendered
ssr_default: true

seo_strengths:
  - "Server-rendered HTML by default"
  - "Turbo for fast navigation without SPA"
  - "Strong conventions reduce mistakes"
  - "Mature gem ecosystem"

checks:
  - code: RAILS_NO_META_TAGS_GEM
    severity: warning
    title: "Not using meta-tags gem"
    description: "The meta-tags gem provides a clean API for SEO tags."
    howToFix: |
      Add meta-tags to Gemfile:

      \`\`\`ruby
      gem 'meta-tags'
      \`\`\`

      Run \`bundle install\`, then:

      \`\`\`ruby
      # app/views/layouts/application.html.erb
      <head>
        <%= display_meta_tags site: 'Your Site' %>
      </head>
      \`\`\`

      \`\`\`ruby
      # In controllers or views
      set_meta_tags title: 'Page Title',
                    description: 'Page description',
                    keywords: 'seo, rails'
      \`\`\`

  - code: RAILS_NO_SITEMAP_GEM
    severity: warning
    title: "Not using sitemap_generator gem"
    description: "sitemap_generator creates SEO-friendly sitemaps automatically."
    howToFix: |
      Add to Gemfile:

      \`\`\`ruby
      gem 'sitemap_generator'
      \`\`\`

      Generate config:
      \`\`\`bash
      rails sitemap:install
      \`\`\`

      Configure config/sitemap.rb:
      \`\`\`ruby
      SitemapGenerator::Sitemap.default_host = "https://yoursite.com"

      SitemapGenerator::Sitemap.create do
        add '/about', changefreq: 'monthly'
        Product.find_each do |product|
          add product_path(product), lastmod: product.updated_at
        end
      end
      \`\`\`

      Generate: \`rails sitemap:refresh\`

  - code: RAILS_NO_CANONICAL
    severity: warning
    title: "Missing canonical URLs"
    description: "Rails apps with multiple URLs for same content need canonicals."
    howToFix: |
      Add canonical tag in layout:

      \`\`\`erb
      <!-- Using meta-tags gem -->
      <%= display_meta_tags canonical: request.original_url %>

      <!-- Or manually -->
      <link rel="canonical" href="<%= request.original_url.split('?').first %>" />
      \`\`\`

  - code: RAILS_TURBO_BREAKS_CRAWLERS
    severity: notice
    title: "Turbo may affect JavaScript-dependent crawlers"
    description: "Turbo Drive updates pages via JavaScript, which some crawlers may miss."
    howToFix: |
      For SEO-critical pages, ensure content is in initial HTML.

      For dynamic content, add data-turbo="false":
      \`\`\`erb
      <%= link_to 'Critical Page', critical_path, data: { turbo: false } %>
      \`\`\`

      Or disable for specific pages:
      \`\`\`erb
      <meta name="turbo-visit-control" content="reload">
      \`\`\`

  - code: RAILS_NO_JSON_LD
    severity: notice
    title: "No structured data detected"
    description: "Add JSON-LD for rich snippets."
    howToFix: |
      Create a helper:

      \`\`\`ruby
      # app/helpers/seo_helper.rb
      module SeoHelper
        def json_ld(data)
          content_tag :script, data.to_json.html_safe,
                      type: 'application/ld+json'
        end
      end
      \`\`\`

      Use in views:
      \`\`\`erb
      <%= json_ld({
        "@context" => "https://schema.org",
        "@type" => "Product",
        "name" => @product.name,
        "description" => @product.description
      }) %>
      \`\`\`
    detection:
      html_missing_patterns:
        - 'application/ld+json'

  - code: RAILS_SLOW_QUERIES
    severity: warning
    title: "N+1 queries may slow pages"
    description: "Slow pages hurt SEO. Use includes/eager_load."
    howToFix: |
      Use bullet gem to detect N+1:

      \`\`\`ruby
      # Gemfile
      gem 'bullet', group: 'development'
      \`\`\`

      Fix with includes:
      \`\`\`ruby
      # Before (N+1)
      @posts = Post.all
      @posts.each { |p| p.author.name }

      # After (2 queries)
      @posts = Post.includes(:author).all
      \`\`\`

  - code: RAILS_NO_CACHING
    severity: notice
    title: "Page caching not configured"
    description: "Rails caching can dramatically improve response times."
    howToFix: |
      Enable caching in production:

      \`\`\`ruby
      # config/environments/production.rb
      config.action_controller.perform_caching = true
      config.cache_store = :redis_cache_store, { url: ENV['REDIS_URL'] }
      \`\`\`

      Use fragment caching:
      \`\`\`erb
      <% cache @product do %>
        <%= render @product %>
      <% end %>
      \`\`\`

performance_tips:
  - "Use Russian doll caching for nested views"
  - "Enable asset fingerprinting and CDN"
  - "Use Turbo for SPA-like experience"
  - "Profile with rack-mini-profiler"
  - "Use Postgres for full-text search instead of LIKE"

recommended_gems:
  seo:
    - "meta-tags - SEO tag management"
    - "sitemap_generator - XML sitemaps"
  performance:
    - "bullet - N+1 detection"
    - "rack-mini-profiler - Performance profiling"
    - "bootsnap - Faster boot times"
`);
embedRecipe("react", `# React SEO Recipe
# Client-side rendering frameworks are notoriously problematic for SEO

framework: react
display_name: React
category: spa
ssr_default: false

seo_challenges:
  - "Client-side rendering means empty HTML for crawlers"
  - "Dynamic content invisible to search engines"
  - "Slow First Contentful Paint"
  - "No server-side meta tag generation"
  - "JavaScript-dependent routing breaks crawlability"

checks:
  # Critical - these will severely hurt SEO
  - code: REACT_CSR_DETECTED
    severity: error
    title: "Client-side rendered React app detected"
    description: "React apps without SSR send empty HTML to crawlers. Search engines may not index your content."
    impact: "Critical - your content is likely invisible to Google"
    howToFix: |
      Option 1: Migrate to Next.js for automatic SSR/SSG
      Option 2: Add prerendering with react-snap or prerender.io
      Option 3: Use react-helmet-async with a prerender service
    detection:
      html_patterns:
        - '<div id="root"></div>'
        - '<div id="app"></div>'
      missing_content: true  # Body has minimal text content

  - code: REACT_NO_SSR_META
    severity: error
    title: "Meta tags not server-rendered"
    description: "Title and meta description are set client-side and won't be seen by crawlers."
    impact: "Search results will show wrong or missing title/description"
    howToFix: |
      For Vite/CRA: Use a prerender plugin or migrate to Next.js

      Quick fix with vite-plugin-ssr:
      \`\`\`tsx
      // pages/+Head.tsx
      export function Head() {
        return <>
          <title>Your Title</title>
          <meta name="description" content="Your description" />
        </>
      }
      \`\`\`
    detection:
      title_in_js: true
      title_not_in_html: true

  - code: REACT_HYDRATION_MISMATCH
    severity: warning
    title: "Hydration mismatch detected"
    description: "Server HTML differs from client render, causing flicker and potential SEO issues."
    impact: "Can cause content to briefly disappear, confusing crawlers"
    howToFix: |
      Common causes:
      1. Using Date.now() or Math.random() in render
      2. Browser-only APIs like window.localStorage
      3. Different data on server vs client

      Fix: Use useEffect for browser-only code:
      \`\`\`tsx
      const [mounted, setMounted] = useState(false);
      useEffect(() => setMounted(true), []);
      if (!mounted) return null; // or skeleton
      \`\`\`

  # Warnings - important but not critical
  - code: REACT_HELMET_NOT_ASYNC
    severity: warning
    title: "Using react-helmet instead of react-helmet-async"
    description: "react-helmet has memory leaks and doesn't work properly with SSR."
    howToFix: |
      Replace react-helmet with react-helmet-async:
      \`\`\`bash
      npm uninstall react-helmet
      npm install react-helmet-async
      \`\`\`

      Update imports:
      \`\`\`tsx
      // Before
      import { Helmet } from 'react-helmet';

      // After
      import { Helmet, HelmetProvider } from 'react-helmet-async';

      // Wrap app in provider
      <HelmetProvider>
        <App />
      </HelmetProvider>
      \`\`\`

  - code: REACT_ROUTER_NO_SSR
    severity: warning
    title: "React Router without server-side support"
    description: "Client-side routing breaks when crawlers access URLs directly."
    howToFix: |
      Ensure your server returns the same HTML for all routes.

      For static hosting (Netlify, Vercel):
      Add a redirect rule to serve index.html for all routes.

      netlify.toml:
      \`\`\`toml
      [[redirects]]
        from = "/*"
        to = "/index.html"
        status = 200
      \`\`\`

  - code: REACT_NO_PRERENDER
    severity: warning
    title: "No prerendering configured"
    description: "Static pages could be prerendered for better SEO and performance."
    howToFix: |
      Add react-snap for build-time prerendering:
      \`\`\`bash
      npm install react-snap
      \`\`\`

      package.json:
      \`\`\`json
      {
        "scripts": {
          "postbuild": "react-snap"
        },
        "reactSnap": {
          "source": "build"
        }
      }
      \`\`\`

  # Performance-related
  - code: REACT_BUNDLE_TOO_LARGE
    severity: warning
    title: "React bundle too large"
    description: "Large JavaScript bundles delay interactivity and hurt Core Web Vitals."
    howToFix: |
      1. Use React.lazy() for code splitting:
      \`\`\`tsx
      const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

      <Suspense fallback={<Loading />}>
        <HeavyComponent />
      </Suspense>
      \`\`\`

      2. Analyze bundle with source-map-explorer:
      \`\`\`bash
      npm install source-map-explorer
      npx source-map-explorer build/static/js/*.js
      \`\`\`

  - code: REACT_NO_SUSPENSE
    severity: notice
    title: "Not using Suspense for data fetching"
    description: "Without Suspense, content pops in causing layout shifts (CLS)."
    howToFix: |
      Use Suspense with a data fetching library:
      \`\`\`tsx
      <Suspense fallback={<Skeleton />}>
        <DataComponent />
      </Suspense>
      \`\`\`

performance_tips:
  - "Use React.memo() for expensive components"
  - "Lazy load routes with React.lazy()"
  - "Use useMemo/useCallback to prevent unnecessary rerenders"
  - "Consider using Preact for smaller bundle size"
  - "Use production builds (NODE_ENV=production)"

migration_paths:
  nextjs:
    effort: medium
    benefits:
      - "Automatic SSR/SSG"
      - "Built-in Image optimization"
      - "File-based routing"
      - "API routes"
    guide: "https://nextjs.org/docs/migrating/from-create-react-app"

  remix:
    effort: medium
    benefits:
      - "Nested routing with data loading"
      - "Progressive enhancement"
      - "Better error boundaries"
    guide: "https://remix.run/docs/en/main/guides/migrating-react-router-app"

  vite-ssr:
    effort: low
    benefits:
      - "Keep existing code"
      - "Add SSR incrementally"
    guide: "https://vite-plugin-ssr.com/"
`);
embedRecipe("sveltekit", `# SvelteKit SEO Recipe
# SvelteKit has excellent SSR and SSG support with minimal overhead

framework: sveltekit
display_name: SvelteKit
category: meta-framework
base_framework: svelte
ssr_default: true

seo_strengths:
  - "SSR by default"
  - "Excellent performance (small runtime)"
  - "Built-in prerendering"
  - "File-based routing"
  - "Form actions for progressive enhancement"

checks:
  - code: SVELTEKIT_NO_LOAD_FUNCTION
    severity: warning
    title: "Page without load function"
    description: "Data fetching in +page.svelte bypasses SSR. Use +page.server.ts or +page.ts."
    howToFix: |
      Move data fetching to a load function:

      \`\`\`ts
      // src/routes/products/+page.server.ts
      export async function load({ fetch }) {
        const products = await fetch('/api/products').then(r => r.json());
        return { products };
      }
      \`\`\`

      \`\`\`svelte
      <!-- src/routes/products/+page.svelte -->
      <script>
        export let data;
      </script>

      {#each data.products as product}
        <div>{product.name}</div>
      {/each}
      \`\`\`

  - code: SVELTEKIT_NO_LAYOUT_HEAD
    severity: warning
    title: "Missing svelte:head in layout"
    description: "Common meta tags should be in a layout for consistency."
    howToFix: |
      Add svelte:head to your layout:

      \`\`\`svelte
      <!-- src/routes/+layout.svelte -->
      <script>
        import { page } from '$app/stores';
      </script>

      <svelte:head>
        <title>{$page.data.title ?? 'Your Site'}</title>
        <meta name="description" content={$page.data.description ?? 'Default description'} />
        <link rel="canonical" href={$page.url.href} />
      </svelte:head>

      <slot />
      \`\`\`
    detection:
      html_missing_patterns:
        - '<title>'
        - 'name="description"'

  - code: SVELTEKIT_NO_PRERENDER
    severity: notice
    title: "Static pages not prerendered"
    description: "Static pages should be prerendered for best performance."
    howToFix: |
      Add prerender to static pages:

      \`\`\`ts
      // src/routes/about/+page.ts
      export const prerender = true;
      \`\`\`

      Or set default in svelte.config.js:
      \`\`\`js
      kit: {
        prerender: {
          default: true
        }
      }
      \`\`\`

  - code: SVELTEKIT_NO_TRAILING_SLASH
    severity: notice
    title: "Inconsistent trailing slash handling"
    description: "Configure trailing slash to avoid duplicate content."
    howToFix: |
      Set in svelte.config.js:

      \`\`\`js
      kit: {
        trailingSlash: 'never' // or 'always'
      }
      \`\`\`

  - code: SVELTEKIT_ENHANCED_IMAGE
    severity: notice
    title: "Not using enhanced images"
    description: "SvelteKit supports enhanced images with @sveltejs/enhanced-img."
    howToFix: |
      Install enhanced images:

      \`\`\`bash
      npm install @sveltejs/enhanced-img
      \`\`\`

      \`\`\`svelte
      <script>
        import { Image } from '@sveltejs/enhanced-img';
        import heroImage from '$lib/images/hero.jpg';
      </script>

      <Image src={heroImage} alt="Hero" />
      \`\`\`

  - code: SVELTEKIT_NO_SITEMAP
    severity: warning
    title: "Missing sitemap"
    description: "Use svelte-sitemap or generate manually."
    howToFix: |
      Option 1: Use svelte-sitemap
      \`\`\`bash
      npm install svelte-sitemap
      npx svelte-sitemap --domain https://yoursite.com
      \`\`\`

      Option 2: Create src/routes/sitemap.xml/+server.ts:
      \`\`\`ts
      export async function GET() {
        const pages = ['/', '/about', '/products'];
        const sitemap = \`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            \${pages.map(page => \`
              <url>
                <loc>https://yoursite.com\${page}</loc>
              </url>
            \`).join('')}
          </urlset>\`;
        return new Response(sitemap, {
          headers: { 'Content-Type': 'application/xml' }
        });
      }
      \`\`\`

performance_tips:
  - "Use load functions for SSR data"
  - "Prerender static pages"
  - "Use streaming for slow data sources"
  - "Leverage Svelte's small runtime"
  - "Use form actions for progressive enhancement"
`);
embedRecipe("vue", `# Vue.js SEO Recipe
# Similar challenges to React for client-side rendered apps

framework: vue
display_name: Vue.js
category: spa
ssr_default: false

seo_challenges:
  - "Client-side rendering sends empty HTML to crawlers"
  - "Vue Router requires proper server configuration"
  - "Async components delay content rendering"
  - "No built-in meta tag management"

checks:
  - code: VUE_CSR_DETECTED
    severity: error
    title: "Client-side rendered Vue app detected"
    description: "Vue apps without SSR send empty HTML to crawlers."
    impact: "Your content may not be indexed by search engines"
    howToFix: |
      Option 1: Migrate to Nuxt for automatic SSR/SSG
      Option 2: Add SSR with @vue/server-renderer
      Option 3: Use prerendering with prerender-spa-plugin

      For Nuxt migration, most Vue components work directly.
    detection:
      html_patterns:
        - '<div id="app"></div>'
      missing_content: true

  - code: VUE_NO_META_MANAGEMENT
    severity: error
    title: "No meta tag management library"
    description: "Title and meta description are not dynamically managed."
    howToFix: |
      Install @vueuse/head or vue-meta:

      \`\`\`bash
      npm install @vueuse/head
      \`\`\`

      \`\`\`ts
      // main.ts
      import { createHead } from '@vueuse/head';
      const head = createHead();
      app.use(head);
      \`\`\`

      \`\`\`vue
      <script setup>
      import { useHead } from '@vueuse/head';

      useHead({
        title: 'Page Title',
        meta: [
          { name: 'description', content: 'Page description' },
        ],
      });
      </script>
      \`\`\`

  - code: VUE_ROUTER_HISTORY_MODE
    severity: warning
    title: "Vue Router not in history mode"
    description: "Hash mode (#/) creates ugly URLs and SEO issues."
    howToFix: |
      Use createWebHistory instead of createWebHashHistory:

      \`\`\`ts
      import { createRouter, createWebHistory } from 'vue-router';

      const router = createRouter({
        history: createWebHistory(),
        routes: [...],
      });
      \`\`\`

      Then configure your server to return index.html for all routes.

  - code: VUE_ASYNC_COMPONENT_NO_LOADING
    severity: warning
    title: "Async components without loading state"
    description: "Async components can cause CLS when they pop in."
    howToFix: |
      Provide a loading component:

      \`\`\`ts
      import { defineAsyncComponent } from 'vue';

      const AsyncComp = defineAsyncComponent({
        loader: () => import('./HeavyComponent.vue'),
        loadingComponent: LoadingSpinner,
        delay: 200,
      });
      \`\`\`

  - code: VUE_NO_KEY_ON_LIST
    severity: notice
    title: "v-for without :key attribute"
    description: "Missing keys can cause rendering issues and affect SEO crawling."
    howToFix: |
      Always use :key with v-for:

      \`\`\`vue
      <div v-for="item in items" :key="item.id">
        {{ item.name }}
      </div>
      \`\`\`

  - code: VUE_TRANSITION_CLS
    severity: notice
    title: "Transitions may cause layout shifts"
    description: "CSS transitions that change element size cause CLS."
    howToFix: |
      Use transform instead of width/height changes:

      \`\`\`css
      /* Bad - causes CLS */
      .fade-enter-active { height: 0 to 100px; }

      /* Good - no CLS */
      .fade-enter-active { transform: scaleY(0) to scaleY(1); }
      \`\`\`

performance_tips:
  - "Use Vite for faster development and optimized builds"
  - "Lazy load routes with dynamic imports"
  - "Use v-once for static content"
  - "Use v-memo for expensive list items"
  - "Consider Nuxt for SSR/SSG"

migration_paths:
  nuxt:
    effort: low
    benefits:
      - "Automatic SSR/SSG"
      - "File-based routing"
      - "Auto-imports"
      - "Built-in SEO utilities"
    guide: "https://nuxt.com/docs/migration/overview"
`);
embedRecipe("wordpress", `# WordPress SEO Recipe
# WordPress powers 40%+ of the web - SEO is well-supported with plugins

framework: wordpress
display_name: WordPress
category: cms
ssr_default: true  # PHP renders on server

seo_strengths:
  - "Server-rendered HTML by default"
  - "Mature SEO plugin ecosystem"
  - "Built-in canonical URL support"
  - "Sitemap generation via plugins"
  - "Structured data plugins available"

seo_challenges:
  - "Plugin bloat can slow performance"
  - "Default themes often lack optimization"
  - "Image optimization requires plugins"
  - "Caching needed for performance"

checks:
  - code: WORDPRESS_NO_SEO_PLUGIN
    severity: warning
    title: "No SEO plugin detected"
    description: "WordPress benefits greatly from an SEO plugin like Yoast or Rank Math."
    howToFix: |
      Install an SEO plugin:

      **Yoast SEO** (most popular):
      1. Go to Plugins > Add New
      2. Search "Yoast SEO"
      3. Install and activate

      **Rank Math** (feature-rich free tier):
      1. Go to Plugins > Add New
      2. Search "Rank Math"
      3. Install and activate

      Both provide:
      - Meta title/description management
      - XML sitemap generation
      - Schema markup
      - Content analysis
    detection:
      html_missing_patterns:
        - 'Yoast SEO'
        - 'seo-by-rank-math'
        - 'The SEO Framework'
        - 'All in One SEO'

  - code: WORDPRESS_OUTDATED
    severity: error
    title: "WordPress core is outdated"
    description: "Running outdated WordPress is a security risk and may have SEO bugs."
    howToFix: |
      Update WordPress:
      1. Backup your site first
      2. Go to Dashboard > Updates
      3. Click "Update Now"

      Enable auto-updates in wp-config.php:
      \`\`\`php
      define('WP_AUTO_UPDATE_CORE', true);
      \`\`\`

  - code: WORDPRESS_NO_CACHING
    severity: warning
    title: "No caching plugin detected"
    description: "WordPress without caching is slow, hurting Core Web Vitals."
    howToFix: |
      Install a caching plugin:

      **WP Super Cache** (simple):
      - Easy setup, good for most sites

      **W3 Total Cache** (advanced):
      - More features, steeper learning curve

      **LiteSpeed Cache** (if on LiteSpeed server):
      - Best performance on compatible hosts

  - code: WORDPRESS_LARGE_IMAGES
    severity: warning
    title: "Images not optimized"
    description: "Large images slow down WordPress significantly."
    howToFix: |
      Install an image optimization plugin:

      **ShortPixel** or **Smush**:
      - Compresses existing images
      - Optimizes on upload
      - WebP conversion

      Or use Cloudflare Polish for automatic optimization.

  - code: WORDPRESS_TOO_MANY_PLUGINS
    severity: warning
    title: "Too many plugins installed"
    description: "Each plugin adds overhead. Many sites have 30+ plugins when 10-15 suffice."
    howToFix: |
      Audit your plugins:
      1. Go to Plugins > Installed Plugins
      2. Deactivate plugins not in use
      3. Delete deactivated plugins
      4. Consider consolidating (one SEO plugin, one security plugin)

      Aim for under 20 plugins.

  - code: WORDPRESS_NO_LAZY_LOAD
    severity: notice
    title: "Native lazy loading not enabled"
    description: "WordPress 5.5+ has native lazy loading, but themes may disable it."
    howToFix: |
      Check if lazy loading is enabled:
      \`\`\`php
      // In functions.php, remove if present:
      add_filter('wp_lazy_loading_enabled', '__return_false');
      \`\`\`

      For older WordPress, add:
      \`\`\`php
      add_filter('wp_lazy_loading_enabled', '__return_true');
      \`\`\`

  - code: WORDPRESS_NO_WEBP
    severity: notice
    title: "Not serving WebP images"
    description: "WebP images are 25-35% smaller than JPEG."
    howToFix: |
      Use a plugin that serves WebP:

      1. **ShortPixel**: Auto-converts and serves WebP
      2. **WebP Express**: Converts and configures server

      Or use Cloudflare with Polish enabled for automatic WebP.

  - code: WORDPRESS_NO_PRELOAD_HINTS
    severity: notice
    title: "Missing resource hints"
    description: "Preload hints can speed up critical resources."
    howToFix: |
      Add to your theme's functions.php:

      \`\`\`php
      function add_resource_hints() {
        // Preload critical font
        echo '<link rel="preload" href="/wp-content/themes/yourtheme/fonts/main.woff2" as="font" type="font/woff2" crossorigin>';

        // Preconnect to external domains
        echo '<link rel="preconnect" href="https://fonts.googleapis.com">';
      }
      add_action('wp_head', 'add_resource_hints', 1);
      \`\`\`

  - code: WORDPRESS_BLOCKING_SCRIPTS
    severity: warning
    title: "Render-blocking scripts detected"
    description: "JavaScript in <head> blocks rendering."
    howToFix: |
      Use a plugin like **Autoptimize** or **Asset CleanUp** to:
      - Defer JavaScript
      - Inline critical CSS
      - Combine files

      Or add defer manually in functions.php:
      \`\`\`php
      function defer_scripts($tag, $handle) {
        if (is_admin()) return $tag;
        return str_replace(' src', ' defer src', $tag);
      }
      add_filter('script_loader_tag', 'defer_scripts', 10, 2);
      \`\`\`

  - code: WORDPRESS_NO_SCHEMA
    severity: warning
    title: "No structured data detected"
    description: "Schema markup helps with rich snippets."
    howToFix: |
      **If using Yoast/Rank Math**: Schema is included.

      **Manual schema** in theme:
      \`\`\`php
      function add_organization_schema() {
        if (is_front_page()) {
          echo '<script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Your Company",
            "url": "' . home_url() . '"
          }
          </script>';
        }
      }
      add_action('wp_footer', 'add_organization_schema');
      \`\`\`

performance_tips:
  - "Use a quality managed WordPress host (WP Engine, Kinsta)"
  - "Enable object caching (Redis/Memcached)"
  - "Use a CDN (Cloudflare, Fastly)"
  - "Keep plugins under 20"
  - "Choose a lightweight theme (GeneratePress, Astra)"
  - "Disable unnecessary features (emojis, embeds)"

recommended_plugins:
  seo:
    - "Yoast SEO or Rank Math"
  performance:
    - "WP Super Cache or LiteSpeed Cache"
    - "ShortPixel or Smush (images)"
    - "Autoptimize (JS/CSS)"
  security:
    - "Wordfence or Sucuri"
`);
