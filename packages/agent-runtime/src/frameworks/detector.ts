/**
 * Framework Detection
 *
 * Detects web frameworks from:
 * 1. HTML signatures (data attributes, meta tags, scripts)
 * 2. package.json dependencies
 * 3. File structure patterns
 */

export type Framework =
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'nuxt'
  | 'angular'
  | 'svelte'
  | 'sveltekit'
  | 'astro'
  | 'remix'
  | 'gatsby'
  | 'rails'
  | 'laravel'
  | 'django'
  | 'wordpress'
  | 'unknown';

export interface FrameworkInfo {
  framework: Framework;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  detected_from: 'html' | 'package.json' | 'files' | 'headers';
  meta_framework?: Framework; // e.g., Next.js for React
}

interface HtmlSignature {
  framework: Framework;
  patterns: RegExp[];
  confidence: 'high' | 'medium' | 'low';
}

const HTML_SIGNATURES: HtmlSignature[] = [
  // Next.js
  {
    framework: 'nextjs',
    patterns: [
      /__next/,
      /_next\//,
      /data-nscript/,
      /__NEXT_DATA__/,
      /next\/script/,
    ],
    confidence: 'high',
  },
  // Nuxt
  {
    framework: 'nuxt',
    patterns: [
      /__nuxt/,
      /_nuxt\//,
      /data-n-head/,
      /nuxt-link/,
      /__NUXT__/,
    ],
    confidence: 'high',
  },
  // Gatsby
  {
    framework: 'gatsby',
    patterns: [
      /___gatsby/,
      /gatsby-/,
      /gatsby-image/,
      /data-gatsby/,
    ],
    confidence: 'high',
  },
  // Astro
  {
    framework: 'astro',
    patterns: [
      /astro-/,
      /data-astro/,
      /_astro\//,
    ],
    confidence: 'high',
  },
  // SvelteKit
  {
    framework: 'sveltekit',
    patterns: [
      /__sveltekit/,
      /_app\/immutable/,
      /svelte-kit/,
    ],
    confidence: 'high',
  },
  // Svelte (standalone)
  {
    framework: 'svelte',
    patterns: [
      /svelte-\w+/,
      /__svelte/,
    ],
    confidence: 'medium',
  },
  // Remix
  {
    framework: 'remix',
    patterns: [
      /__remix/,
      /remix-/,
      /data-remix/,
    ],
    confidence: 'high',
  },
  // React (generic - lower priority than Next/Gatsby/Remix)
  {
    framework: 'react',
    patterns: [
      /data-reactroot/,
      /data-react-helmet/,
      /_react/,
      /react-app/,
    ],
    confidence: 'medium',
  },
  // Vue (generic - lower priority than Nuxt)
  {
    framework: 'vue',
    patterns: [
      /data-v-[a-f0-9]+/,
      /v-cloak/,
      /__vue/,
    ],
    confidence: 'medium',
  },
  // Angular
  {
    framework: 'angular',
    patterns: [
      /ng-version/,
      /_ngcontent/,
      /ng-\w+=/,
      /\[ng/,
    ],
    confidence: 'high',
  },
  // WordPress
  {
    framework: 'wordpress',
    patterns: [
      /wp-content/,
      /wp-includes/,
      /wp-json/,
      /wordpress/i,
    ],
    confidence: 'high',
  },
  // Laravel
  {
    framework: 'laravel',
    patterns: [
      /laravel_session/,
      /XSRF-TOKEN/,
      /@csrf/,
    ],
    confidence: 'medium',
  },
  // Rails
  {
    framework: 'rails',
    patterns: [
      /csrf-token/,
      /turbolinks/,
      /data-turbo/,
      /rails-ujs/,
    ],
    confidence: 'medium',
  },
  // Django
  {
    framework: 'django',
    patterns: [
      /csrfmiddlewaretoken/,
      /django/,
    ],
    confidence: 'medium',
  },
];

interface PackageDependency {
  framework: Framework;
  packages: string[];
  meta_framework?: Framework;
}

const PACKAGE_DEPENDENCIES: PackageDependency[] = [
  { framework: 'nextjs', packages: ['next'], meta_framework: 'react' },
  { framework: 'gatsby', packages: ['gatsby'], meta_framework: 'react' },
  { framework: 'remix', packages: ['@remix-run/react', '@remix-run/node'], meta_framework: 'react' },
  { framework: 'nuxt', packages: ['nuxt', 'nuxt3'], meta_framework: 'vue' },
  { framework: 'sveltekit', packages: ['@sveltejs/kit'], meta_framework: 'svelte' },
  { framework: 'astro', packages: ['astro'] },
  { framework: 'react', packages: ['react', 'react-dom'] },
  { framework: 'vue', packages: ['vue'] },
  { framework: 'angular', packages: ['@angular/core'] },
  { framework: 'svelte', packages: ['svelte'] },
];

/**
 * Detect framework from HTML content
 */
export function detectFromHtml(html: string): FrameworkInfo | null {
  for (const signature of HTML_SIGNATURES) {
    for (const pattern of signature.patterns) {
      if (pattern.test(html)) {
        return {
          framework: signature.framework,
          confidence: signature.confidence,
          detected_from: 'html',
        };
      }
    }
  }
  return null;
}

/**
 * Detect framework from package.json content
 */
export function detectFromPackageJson(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): FrameworkInfo | null {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const dep of PACKAGE_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (allDeps[pkg]) {
        return {
          framework: dep.framework,
          version: allDeps[pkg],
          confidence: 'high',
          detected_from: 'package.json',
          meta_framework: dep.meta_framework,
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from HTTP response headers
 */
export function detectFromHeaders(headers: Record<string, string>): FrameworkInfo | null {
  const poweredBy = headers['x-powered-by']?.toLowerCase() || '';
  const server = headers['server']?.toLowerCase() || '';

  if (poweredBy.includes('next.js') || poweredBy.includes('next')) {
    return { framework: 'nextjs', confidence: 'high', detected_from: 'headers' };
  }
  if (poweredBy.includes('nuxt')) {
    return { framework: 'nuxt', confidence: 'high', detected_from: 'headers' };
  }
  if (poweredBy.includes('express') || poweredBy.includes('koa')) {
    // Node.js but unclear which framework
    return null;
  }
  if (poweredBy.includes('php') || server.includes('php')) {
    // Could be WordPress or Laravel
    return null;
  }
  if (poweredBy.includes('phusion') || poweredBy.includes('passenger')) {
    return { framework: 'rails', confidence: 'medium', detected_from: 'headers' };
  }

  return null;
}

/**
 * Combined detection using multiple sources
 */
export function detectFramework(options: {
  html?: string;
  packageJson?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  headers?: Record<string, string>;
  files?: string[];
}): FrameworkInfo {
  // Try package.json first (most reliable)
  if (options.packageJson) {
    const result = detectFromPackageJson(options.packageJson);
    if (result) return result;
  }

  // Try headers
  if (options.headers) {
    const result = detectFromHeaders(options.headers);
    if (result) return result;
  }

  // Try HTML signatures
  if (options.html) {
    const result = detectFromHtml(options.html);
    if (result) return result;
  }

  // Check file patterns
  if (options.files) {
    if (options.files.some(f => f.includes('next.config'))) {
      return { framework: 'nextjs', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('nuxt.config'))) {
      return { framework: 'nuxt', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('astro.config'))) {
      return { framework: 'astro', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('svelte.config'))) {
      return { framework: 'sveltekit', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('angular.json'))) {
      return { framework: 'angular', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('gatsby-config'))) {
      return { framework: 'gatsby', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f === 'wp-config.php')) {
      return { framework: 'wordpress', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f === 'artisan')) {
      return { framework: 'laravel', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f === 'manage.py')) {
      return { framework: 'django', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f === 'Gemfile') && options.files.some(f => f.includes('config/routes.rb'))) {
      return { framework: 'rails', confidence: 'high', detected_from: 'files' };
    }
  }

  return { framework: 'unknown', confidence: 'low', detected_from: 'html' };
}

/**
 * Get human-readable framework name
 */
export function getFrameworkDisplayName(framework: Framework): string {
  const names: Record<Framework, string> = {
    react: 'React',
    nextjs: 'Next.js',
    vue: 'Vue.js',
    nuxt: 'Nuxt',
    angular: 'Angular',
    svelte: 'Svelte',
    sveltekit: 'SvelteKit',
    astro: 'Astro',
    remix: 'Remix',
    gatsby: 'Gatsby',
    rails: 'Ruby on Rails',
    laravel: 'Laravel',
    django: 'Django',
    wordpress: 'WordPress',
    unknown: 'Unknown',
  };
  return names[framework];
}
