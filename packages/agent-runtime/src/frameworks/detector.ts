/**
 * Framework Detection
 *
 * Detects web frameworks from:
 * 1. HTML signatures (data attributes, meta tags, scripts)
 * 2. package.json / Gemfile / requirements.txt / composer.json / etc.
 * 3. File structure patterns
 * 4. HTTP response headers
 *
 * Supports 25+ frameworks across JavaScript, Ruby, Python, PHP, Java, C#, Go, and Elixir.
 */

export type Framework =
  // JavaScript/TypeScript
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
  | 'solidjs'
  | 'qwik'
  | 'fresh'
  // Ruby
  | 'rails'
  // Python
  | 'django'
  | 'flask'
  | 'fastapi'
  // PHP
  | 'laravel'
  | 'symfony'
  | 'wordpress'
  // Java
  | 'spring'
  // C#
  | 'aspnet'
  // Go
  | 'go'
  // Elixir
  | 'phoenix'
  // Hypermedia
  | 'htmx'
  | 'hotwire'
  // Static Site Generators
  | 'hugo'
  | 'jekyll'
  | 'eleventy'
  | 'pelican'
  // Unknown
  | 'unknown';

export type Language = 'javascript' | 'typescript' | 'ruby' | 'python' | 'php' | 'java' | 'csharp' | 'go' | 'elixir' | 'rust' | 'unknown';

export interface FrameworkInfo {
  framework: Framework;
  version?: string;
  language: Language;
  confidence: 'high' | 'medium' | 'low';
  detected_from: 'html' | 'package.json' | 'files' | 'headers' | 'gemfile' | 'requirements' | 'composer' | 'pom' | 'csproj' | 'go.mod' | 'mix.exs';
  meta_framework?: Framework; // e.g., Next.js for React
}

interface HtmlSignature {
  framework: Framework;
  language: Language;
  patterns: RegExp[];
  confidence: 'high' | 'medium' | 'low';
}

const HTML_SIGNATURES: HtmlSignature[] = [
  // ============ JavaScript/TypeScript Frameworks ============
  
  // Next.js
  {
    framework: 'nextjs',
    language: 'typescript',
    patterns: [/__next/, /_next\//, /data-nscript/, /__NEXT_DATA__/, /next\/script/],
    confidence: 'high',
  },
  // Nuxt
  {
    framework: 'nuxt',
    language: 'typescript',
    patterns: [/__nuxt/, /_nuxt\//, /data-n-head/, /nuxt-link/, /__NUXT__/],
    confidence: 'high',
  },
  // Gatsby
  {
    framework: 'gatsby',
    language: 'javascript',
    patterns: [/___gatsby/, /gatsby-/, /gatsby-image/, /data-gatsby/],
    confidence: 'high',
  },
  // Astro
  {
    framework: 'astro',
    language: 'typescript',
    patterns: [/astro-/, /data-astro/, /_astro\//],
    confidence: 'high',
  },
  // SvelteKit
  {
    framework: 'sveltekit',
    language: 'typescript',
    patterns: [/__sveltekit/, /_app\/immutable/, /svelte-kit/],
    confidence: 'high',
  },
  // Svelte (standalone)
  {
    framework: 'svelte',
    language: 'javascript',
    patterns: [/svelte-\w+/, /__svelte/],
    confidence: 'medium',
  },
  // Remix
  {
    framework: 'remix',
    language: 'typescript',
    patterns: [/__remix/, /remix-/, /data-remix/],
    confidence: 'high',
  },
  // Solid.js
  {
    framework: 'solidjs',
    language: 'typescript',
    patterns: [/solid-/, /data-solid/, /_solid/],
    confidence: 'high',
  },
  // Qwik
  {
    framework: 'qwik',
    language: 'typescript',
    patterns: [/q:/, /qwik/, /q-/],
    confidence: 'high',
  },
  // Fresh (Deno)
  {
    framework: 'fresh',
    language: 'typescript',
    patterns: [/fresh-/, /_frsh\//, /data-fresh/],
    confidence: 'high',
  },
  // React (generic - lower priority)
  {
    framework: 'react',
    language: 'javascript',
    // data-reactroot/data-react-helmet are React <=15 hydration markers -
    // React 18's createRoot() never adds them, so every modern CRA/Vite
    // React app (an empty <div id="root">) went undetected from HTML alone.
    patterns: [/data-reactroot/, /data-react-helmet/, /_react/, /react-app/, /<div id="root"><\/div>/],
    confidence: 'medium',
  },
  // Vue (generic - lower priority)
  {
    framework: 'vue',
    language: 'javascript',
    patterns: [/data-v-[a-f0-9]+/, /v-cloak/, /__vue/],
    confidence: 'medium',
  },
  // Angular
  {
    framework: 'angular',
    language: 'typescript',
    patterns: [/ng-version/, /_ngcontent/, /ng-\w+=/, /\[ng/],
    confidence: 'high',
  },
  
  // ============ Hypermedia Frameworks ============
  
  // HTMX
  {
    framework: 'htmx',
    language: 'unknown',
    patterns: [/hx-get/, /hx-post/, /hx-trigger/, /hx-swap/, /htmx\.org/],
    confidence: 'high',
  },
  // Hotwire/Turbo
  {
    framework: 'hotwire',
    language: 'ruby',
    patterns: [/turbo-frame/, /turbo-stream/, /data-turbo/, /stimulus/],
    confidence: 'high',
  },
  
  // ============ PHP Frameworks ============
  
  // WordPress
  {
    framework: 'wordpress',
    language: 'php',
    patterns: [/wp-content/, /wp-includes/, /wp-json/, /wordpress/i],
    confidence: 'high',
  },
  // Laravel
  {
    framework: 'laravel',
    language: 'php',
    patterns: [/laravel_session/, /XSRF-TOKEN/, /@csrf/, /laravel/i],
    confidence: 'medium',
  },
  // Symfony
  {
    framework: 'symfony',
    language: 'php',
    patterns: [/symfony/, /sf2/, /_sf_/, /profiler\.css/],
    confidence: 'medium',
  },
  
  // ============ Ruby Frameworks ============
  
  // Rails
  {
    framework: 'rails',
    language: 'ruby',
    patterns: [/csrf-token/, /turbolinks/, /data-turbo/, /rails-ujs/, /action-cable/],
    confidence: 'medium',
  },
  
  // ============ Python Frameworks ============
  
  // Django
  {
    framework: 'django',
    language: 'python',
    patterns: [/csrfmiddlewaretoken/, /django/, /__debug__\//],
    confidence: 'medium',
  },
  // Flask
  {
    framework: 'flask',
    language: 'python',
    patterns: [/flask/, /werkzeug/i],
    confidence: 'low',
  },
  // FastAPI
  {
    framework: 'fastapi',
    language: 'python',
    patterns: [/fastapi/, /openapi\.json/],
    confidence: 'low',
  },
  
  // ============ Java Frameworks ============
  
  // Spring Boot
  {
    framework: 'spring',
    language: 'java',
    patterns: [/spring/, /thymeleaf/, /th:/, /_csrf/],
    confidence: 'medium',
  },
  
  // ============ C# Frameworks ============
  
  // ASP.NET Core
  {
    framework: 'aspnet',
    language: 'csharp',
    patterns: [/aspnetcore/, /__RequestVerificationToken/, /blazor/, /_framework\/blazor/],
    confidence: 'medium',
  },
  
  // ============ Elixir Frameworks ============
  
  // Phoenix
  {
    framework: 'phoenix',
    language: 'elixir',
    patterns: [/phx-/, /phoenix/, /live-socket/, /data-phx/],
    confidence: 'high',
  },
  
  // ============ Static Site Generators ============
  
  // Hugo
  {
    framework: 'hugo',
    language: 'go',
    patterns: [/hugo/, /generator.*hugo/i],
    confidence: 'medium',
  },
  // Jekyll
  {
    framework: 'jekyll',
    language: 'ruby',
    patterns: [/jekyll/, /generator.*jekyll/i],
    confidence: 'medium',
  },
  // Eleventy
  {
    framework: 'eleventy',
    language: 'javascript',
    patterns: [/11ty/, /eleventy/, /generator.*eleventy/i],
    confidence: 'medium',
  },
  // Pelican
  {
    framework: 'pelican',
    language: 'python',
    patterns: [/pelican/, /generator.*pelican/i],
    confidence: 'medium',
  },
];

interface PackageDependency {
  framework: Framework;
  language: Language;
  packages: string[];
  meta_framework?: Framework;
}

// NPM package.json dependencies
const PACKAGE_DEPENDENCIES: PackageDependency[] = [
  // Meta-frameworks (check first - more specific)
  { framework: 'nextjs', language: 'typescript', packages: ['next'], meta_framework: 'react' },
  { framework: 'gatsby', language: 'javascript', packages: ['gatsby'], meta_framework: 'react' },
  { framework: 'remix', language: 'typescript', packages: ['@remix-run/react', '@remix-run/node'], meta_framework: 'react' },
  { framework: 'nuxt', language: 'typescript', packages: ['nuxt', 'nuxt3'], meta_framework: 'vue' },
  { framework: 'sveltekit', language: 'typescript', packages: ['@sveltejs/kit'], meta_framework: 'svelte' },
  { framework: 'astro', language: 'typescript', packages: ['astro'] },
  { framework: 'solidjs', language: 'typescript', packages: ['solid-js', 'solid-start'] },
  { framework: 'qwik', language: 'typescript', packages: ['@builder.io/qwik'] },
  { framework: 'eleventy', language: 'javascript', packages: ['@11ty/eleventy'] },
  
  // Base frameworks
  { framework: 'react', language: 'javascript', packages: ['react', 'react-dom'] },
  { framework: 'vue', language: 'javascript', packages: ['vue'] },
  { framework: 'angular', language: 'typescript', packages: ['@angular/core'] },
  { framework: 'svelte', language: 'javascript', packages: ['svelte'] },
  
  // HTMX (can be used with any backend)
  { framework: 'htmx', language: 'unknown', packages: ['htmx.org'] },
];

// Ruby Gemfile dependencies
const GEMFILE_DEPENDENCIES: PackageDependency[] = [
  { framework: 'rails', language: 'ruby', packages: ['rails'] },
  { framework: 'hotwire', language: 'ruby', packages: ['turbo-rails', 'stimulus-rails'], meta_framework: 'rails' },
  { framework: 'jekyll', language: 'ruby', packages: ['jekyll'] },
];

// Python requirements.txt / pyproject.toml dependencies
const PYTHON_DEPENDENCIES: PackageDependency[] = [
  { framework: 'django', language: 'python', packages: ['django', 'Django'] },
  { framework: 'flask', language: 'python', packages: ['flask', 'Flask'] },
  { framework: 'fastapi', language: 'python', packages: ['fastapi', 'FastAPI'] },
  { framework: 'pelican', language: 'python', packages: ['pelican', 'Pelican'] },
];

// PHP composer.json dependencies
const COMPOSER_DEPENDENCIES: PackageDependency[] = [
  { framework: 'laravel', language: 'php', packages: ['laravel/framework'] },
  { framework: 'symfony', language: 'php', packages: ['symfony/framework-bundle', 'symfony/symfony'] },
  { framework: 'wordpress', language: 'php', packages: ['johnpbloch/wordpress-core'] },
];

// Java pom.xml / build.gradle dependencies
const JAVA_DEPENDENCIES: PackageDependency[] = [
  { framework: 'spring', language: 'java', packages: ['spring-boot-starter-web', 'org.springframework.boot'] },
];

// C# .csproj dependencies
const DOTNET_DEPENDENCIES: PackageDependency[] = [
  { framework: 'aspnet', language: 'csharp', packages: ['Microsoft.AspNetCore', 'Microsoft.NET.Sdk.Web'] },
];

// Go go.mod dependencies
const GO_DEPENDENCIES: PackageDependency[] = [
  { framework: 'hugo', language: 'go', packages: ['github.com/gohugoio/hugo'] },
  { framework: 'go', language: 'go', packages: ['github.com/gin-gonic/gin', 'github.com/labstack/echo', 'github.com/gofiber/fiber'] },
];

// Elixir mix.exs dependencies
const ELIXIR_DEPENDENCIES: PackageDependency[] = [
  { framework: 'phoenix', language: 'elixir', packages: [':phoenix', 'phoenix'] },
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
          language: signature.language,
          confidence: signature.confidence,
          detected_from: 'html',
        };
      }
    }
  }
  return null;
}

/**
 * Detect framework from package.json content (JavaScript/TypeScript)
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
          language: dep.language,
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
 * Detect framework from Gemfile content (Ruby)
 */
export function detectFromGemfile(gemfileContent: string): FrameworkInfo | null {
  const gemPattern = /gem\s+['"]([^'"]+)['"]/g;
  const gems: string[] = [];
  let match;
  
  while ((match = gemPattern.exec(gemfileContent)) !== null) {
    gems.push(match[1]);
  }

  for (const dep of GEMFILE_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (gems.includes(pkg)) {
        return {
          framework: dep.framework,
          language: dep.language,
          confidence: 'high',
          detected_from: 'gemfile',
          meta_framework: dep.meta_framework,
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from requirements.txt or pyproject.toml (Python)
 */
export function detectFromPythonDeps(content: string): FrameworkInfo | null {
  for (const dep of PYTHON_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      // Match package name at start of line or after whitespace, ignoring version specs
      const pattern = new RegExp(`(^|\\s)${pkg.toLowerCase()}[\\s=<>~!]`, 'im');
      if (pattern.test(content.toLowerCase())) {
        return {
          framework: dep.framework,
          language: dep.language,
          confidence: 'high',
          detected_from: 'requirements',
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from composer.json (PHP)
 */
export function detectFromComposerJson(composerJson: {
  require?: Record<string, string>;
  'require-dev'?: Record<string, string>;
}): FrameworkInfo | null {
  const allDeps = {
    ...composerJson.require,
    ...composerJson['require-dev'],
  };

  for (const dep of COMPOSER_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (allDeps[pkg]) {
        return {
          framework: dep.framework,
          language: dep.language,
          version: allDeps[pkg],
          confidence: 'high',
          detected_from: 'composer',
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from pom.xml content (Java/Maven)
 */
export function detectFromPomXml(pomContent: string): FrameworkInfo | null {
  for (const dep of JAVA_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (pomContent.includes(pkg)) {
        return {
          framework: dep.framework,
          language: dep.language,
          confidence: 'high',
          detected_from: 'pom',
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from .csproj content (C#/.NET)
 */
export function detectFromCsproj(csprojContent: string): FrameworkInfo | null {
  for (const dep of DOTNET_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (csprojContent.includes(pkg)) {
        return {
          framework: dep.framework,
          language: dep.language,
          confidence: 'high',
          detected_from: 'csproj',
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from go.mod content (Go)
 */
export function detectFromGoMod(goModContent: string): FrameworkInfo | null {
  for (const dep of GO_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (goModContent.includes(pkg)) {
        return {
          framework: dep.framework,
          language: dep.language,
          confidence: 'high',
          detected_from: 'go.mod',
        };
      }
    }
  }

  return null;
}

/**
 * Detect framework from mix.exs content (Elixir)
 */
export function detectFromMixExs(mixContent: string): FrameworkInfo | null {
  for (const dep of ELIXIR_DEPENDENCIES) {
    for (const pkg of dep.packages) {
      if (mixContent.includes(pkg)) {
        return {
          framework: dep.framework,
          language: dep.language,
          confidence: 'high',
          detected_from: 'mix.exs',
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
  const generator = headers['x-generator']?.toLowerCase() || '';

  // JavaScript/TypeScript
  if (poweredBy.includes('next.js') || poweredBy.includes('next')) {
    return { framework: 'nextjs', language: 'typescript', confidence: 'high', detected_from: 'headers' };
  }
  if (poweredBy.includes('nuxt')) {
    return { framework: 'nuxt', language: 'typescript', confidence: 'high', detected_from: 'headers' };
  }
  if (poweredBy.includes('remix')) {
    return { framework: 'remix', language: 'typescript', confidence: 'high', detected_from: 'headers' };
  }
  
  // Ruby
  if (poweredBy.includes('phusion') || poweredBy.includes('passenger') || poweredBy.includes('puma') || poweredBy.includes('unicorn')) {
    return { framework: 'rails', language: 'ruby', confidence: 'medium', detected_from: 'headers' };
  }
  
  // Python
  if (poweredBy.includes('gunicorn') || poweredBy.includes('uvicorn') || poweredBy.includes('daphne')) {
    // Python but unclear which framework - needs HTML detection
    return null;
  }
  
  // PHP
  if (poweredBy.includes('php')) {
    // Could be WordPress, Laravel, or Symfony - needs HTML detection
    return null;
  }
  
  // Java
  if (server.includes('tomcat') || server.includes('jetty') || poweredBy.includes('spring')) {
    return { framework: 'spring', language: 'java', confidence: 'medium', detected_from: 'headers' };
  }
  
  // .NET
  if (poweredBy.includes('asp.net') || server.includes('kestrel')) {
    return { framework: 'aspnet', language: 'csharp', confidence: 'high', detected_from: 'headers' };
  }
  
  // Elixir
  if (poweredBy.includes('phoenix') || poweredBy.includes('cowboy')) {
    return { framework: 'phoenix', language: 'elixir', confidence: 'medium', detected_from: 'headers' };
  }
  
  // Go
  if (server.includes('gin') || server.includes('echo') || server.includes('fiber')) {
    return { framework: 'go', language: 'go', confidence: 'medium', detected_from: 'headers' };
  }
  
  // Static site generators (from generator meta/header)
  if (generator.includes('hugo')) {
    return { framework: 'hugo', language: 'go', confidence: 'high', detected_from: 'headers' };
  }
  if (generator.includes('jekyll')) {
    return { framework: 'jekyll', language: 'ruby', confidence: 'high', detected_from: 'headers' };
  }
  if (generator.includes('eleventy') || generator.includes('11ty')) {
    return { framework: 'eleventy', language: 'javascript', confidence: 'high', detected_from: 'headers' };
  }
  if (generator.includes('pelican')) {
    return { framework: 'pelican', language: 'python', confidence: 'high', detected_from: 'headers' };
  }

  return null;
}

/**
 * Combined detection using multiple sources
 */
export function detectFramework(options: {
  html?: string;
  packageJson?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  composerJson?: { require?: Record<string, string>; 'require-dev'?: Record<string, string> };
  gemfileContent?: string;
  requirementsContent?: string;
  pomXmlContent?: string;
  csprojContent?: string;
  goModContent?: string;
  mixExsContent?: string;
  headers?: Record<string, string>;
  files?: string[];
}): FrameworkInfo {
  // Try dependency files first (most reliable)
  
  // JavaScript/TypeScript
  if (options.packageJson) {
    const result = detectFromPackageJson(options.packageJson);
    if (result) return result;
  }

  // Ruby
  if (options.gemfileContent) {
    const result = detectFromGemfile(options.gemfileContent);
    if (result) return result;
  }

  // Python
  if (options.requirementsContent) {
    const result = detectFromPythonDeps(options.requirementsContent);
    if (result) return result;
  }

  // PHP
  if (options.composerJson) {
    const result = detectFromComposerJson(options.composerJson);
    if (result) return result;
  }

  // Java
  if (options.pomXmlContent) {
    const result = detectFromPomXml(options.pomXmlContent);
    if (result) return result;
  }

  // C#
  if (options.csprojContent) {
    const result = detectFromCsproj(options.csprojContent);
    if (result) return result;
  }

  // Go
  if (options.goModContent) {
    const result = detectFromGoMod(options.goModContent);
    if (result) return result;
  }

  // Elixir
  if (options.mixExsContent) {
    const result = detectFromMixExs(options.mixExsContent);
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
    // JavaScript/TypeScript
    if (options.files.some(f => f.includes('next.config'))) {
      return { framework: 'nextjs', language: 'typescript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('nuxt.config'))) {
      return { framework: 'nuxt', language: 'typescript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('astro.config'))) {
      return { framework: 'astro', language: 'typescript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('svelte.config'))) {
      return { framework: 'sveltekit', language: 'typescript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('angular.json'))) {
      return { framework: 'angular', language: 'typescript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('gatsby-config'))) {
      return { framework: 'gatsby', language: 'javascript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('remix.config'))) {
      return { framework: 'remix', language: 'typescript', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('.eleventy.js') || f.includes('eleventy.config'))) {
      return { framework: 'eleventy', language: 'javascript', confidence: 'high', detected_from: 'files' };
    }
    
    // PHP
    if (options.files.some(f => f === 'wp-config.php')) {
      return { framework: 'wordpress', language: 'php', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f === 'artisan')) {
      return { framework: 'laravel', language: 'php', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('symfony.lock') || f.includes('config/bundles.php'))) {
      return { framework: 'symfony', language: 'php', confidence: 'high', detected_from: 'files' };
    }
    
    // Python
    if (options.files.some(f => f === 'manage.py')) {
      return { framework: 'django', language: 'python', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f.includes('pelicanconf.py'))) {
      return { framework: 'pelican', language: 'python', confidence: 'high', detected_from: 'files' };
    }
    
    // Ruby
    if (options.files.some(f => f === 'Gemfile') && options.files.some(f => f.includes('config/routes.rb'))) {
      return { framework: 'rails', language: 'ruby', confidence: 'high', detected_from: 'files' };
    }
    if (options.files.some(f => f === '_config.yml') && options.files.some(f => f === 'Gemfile')) {
      return { framework: 'jekyll', language: 'ruby', confidence: 'high', detected_from: 'files' };
    }
    
    // Go
    if (options.files.some(f => f.includes('hugo.toml') || f.includes('hugo.yaml') || f.includes('config.toml'))) {
      return { framework: 'hugo', language: 'go', confidence: 'high', detected_from: 'files' };
    }
    
    // Java
    if (options.files.some(f => f.includes('pom.xml') || f.includes('build.gradle'))) {
      if (options.files.some(f => f.includes('src/main/resources/application'))) {
        return { framework: 'spring', language: 'java', confidence: 'high', detected_from: 'files' };
      }
    }
    
    // C#
    if (options.files.some(f => f.endsWith('.csproj'))) {
      return { framework: 'aspnet', language: 'csharp', confidence: 'medium', detected_from: 'files' };
    }
    
    // Elixir
    if (options.files.some(f => f === 'mix.exs') && options.files.some(f => f.includes('lib') && f.includes('_web'))) {
      return { framework: 'phoenix', language: 'elixir', confidence: 'high', detected_from: 'files' };
    }
  }

  return { framework: 'unknown', language: 'unknown', confidence: 'low', detected_from: 'html' };
}

/**
 * Get human-readable framework name
 */
export function getFrameworkDisplayName(framework: Framework): string {
  const names: Record<Framework, string> = {
    // JavaScript/TypeScript
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
    solidjs: 'Solid.js',
    qwik: 'Qwik',
    fresh: 'Fresh (Deno)',
    
    // Ruby
    rails: 'Ruby on Rails',
    
    // Python
    django: 'Django',
    flask: 'Flask',
    fastapi: 'FastAPI',
    
    // PHP
    laravel: 'Laravel',
    symfony: 'Symfony',
    wordpress: 'WordPress',
    
    // Java
    spring: 'Spring Boot',
    
    // C#
    aspnet: 'ASP.NET Core',
    
    // Go
    go: 'Go (Gin/Echo/Fiber)',
    
    // Elixir
    phoenix: 'Phoenix',
    
    // Hypermedia
    htmx: 'HTMX',
    hotwire: 'Hotwire/Turbo',
    
    // Static Site Generators
    hugo: 'Hugo',
    jekyll: 'Jekyll',
    eleventy: 'Eleventy (11ty)',
    pelican: 'Pelican',
    
    unknown: 'Unknown',
  };
  return names[framework];
}

/**
 * Get language display name
 */
export function getLanguageDisplayName(language: Language): string {
  const names: Record<Language, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    ruby: 'Ruby',
    python: 'Python',
    php: 'PHP',
    java: 'Java',
    csharp: 'C#',
    go: 'Go',
    elixir: 'Elixir',
    rust: 'Rust',
    unknown: 'Unknown',
  };
  return names[language];
}
