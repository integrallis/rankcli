/**
 * Route Discovery Module
 *
 * Discovers routes from repository files based on framework-specific patterns.
 * Supports: Next.js (App/Pages), Astro, React Router, Vue Router, SvelteKit
 */

export interface RouteInfo {
  path: string;
  type: 'static' | 'dynamic';
  sourceFile: string;
}

type Framework = 'nextjs' | 'astro' | 'react' | 'react-vite' | 'vue' | 'sveltekit' | 'unknown';

/**
 * Detect framework from package.json and file structure
 */
export function detectFramework(
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null,
  files: string[]
): Framework {
  if (!packageJson) return 'unknown';

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // Check for Next.js
  if (deps['next']) {
    return 'nextjs';
  }

  // Check for Astro
  if (deps['astro']) {
    return 'astro';
  }

  // Check for SvelteKit
  if (deps['@sveltejs/kit']) {
    return 'sveltekit';
  }

  // Check for Vue with router
  if (deps['vue-router'] || deps['@vue/router']) {
    return 'vue';
  }

  // Check for React with Vite (our pattern)
  if (deps['react'] && deps['vite']) {
    return 'react-vite';
  }

  // Check for React
  if (deps['react'] || deps['react-dom']) {
    // Check if it has router files
    const hasRouterFile = files.some(f =>
      f.match(/routes?\.(tsx?|jsx?)$/) ||
      f.includes('router') ||
      f.endsWith('App.tsx') ||
      f.endsWith('App.jsx')
    );
    if (hasRouterFile) {
      return 'react';
    }
  }

  return 'unknown';
}

/**
 * Discover routes based on framework
 */
export async function discoverRoutesFromRepo(
  files: string[],
  framework: Framework,
  fetchFile: (path: string) => Promise<string | null>
): Promise<RouteInfo[]> {
  switch (framework) {
    case 'nextjs':
      return discoverNextRoutes(files);
    case 'astro':
      return discoverAstroRoutes(files);
    case 'react':
    case 'react-vite':
      return discoverReactRouterRoutes(files, fetchFile);
    case 'vue':
      return discoverVueRouterRoutes(files, fetchFile);
    case 'sveltekit':
      return discoverSvelteRoutes(files);
    default:
      return []; // Fall back to link crawling
  }
}

/**
 * Next.js: file-based routing (App Router and Pages Router)
 */
function discoverNextRoutes(files: string[]): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const file of files) {
    // App Router: app/**/page.tsx
    const appMatch = file.match(/^app\/(.*)\/page\.(tsx?|jsx?)$/);
    if (appMatch) {
      let path = '/' + appMatch[1];
      // Handle route groups (parentheses)
      path = path.replace(/\/\([^)]+\)/g, '');
      // Handle root page
      if (path === '/') path = '/';

      const isDynamic = path.includes('[');
      routes.push({
        path,
        type: isDynamic ? 'dynamic' : 'static',
        sourceFile: file
      });
      continue;
    }

    // App Router: app/page.tsx (root)
    if (file.match(/^app\/page\.(tsx?|jsx?)$/)) {
      routes.push({
        path: '/',
        type: 'static',
        sourceFile: file
      });
      continue;
    }

    // Pages Router: pages/**/*.tsx
    const pagesMatch = file.match(/^pages\/(.+)\.(tsx?|jsx?)$/);
    if (pagesMatch) {
      const pagePath = pagesMatch[1];

      // Skip special files
      if (pagePath.startsWith('_') || pagePath.startsWith('api/')) {
        continue;
      }

      let path = '/' + pagePath;
      // Handle index files
      path = path.replace(/\/index$/, '');
      if (path === '') path = '/';

      const isDynamic = path.includes('[');
      routes.push({
        path,
        type: isDynamic ? 'dynamic' : 'static',
        sourceFile: file
      });
    }
  }

  // Deduplicate by path (prefer App Router)
  const seen = new Map<string, RouteInfo>();
  for (const route of routes) {
    if (!seen.has(route.path)) {
      seen.set(route.path, route);
    }
  }

  return Array.from(seen.values());
}

/**
 * Astro: file-based routing
 */
function discoverAstroRoutes(files: string[]): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const file of files) {
    // Match src/pages/**/*.astro or src/pages/**/*.md(x)
    const match = file.match(/^src\/pages\/(.+)\.(astro|md|mdx)$/);
    if (match) {
      let path = '/' + match[1];

      // Handle index files
      path = path.replace(/\/index$/, '');
      if (path === '') path = '/';

      const isDynamic = path.includes('[');
      routes.push({
        path,
        type: isDynamic ? 'dynamic' : 'static',
        sourceFile: file
      });
    }
  }

  return routes;
}

/**
 * SvelteKit: file-based routing
 */
function discoverSvelteRoutes(files: string[]): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const file of files) {
    // Match src/routes/**/+page.svelte
    const match = file.match(/^src\/routes\/(.*)\/?\+page\.svelte$/);
    if (match) {
      let path = '/' + (match[1] || '');

      // Handle route groups (parentheses)
      path = path.replace(/\/\([^)]+\)/g, '');

      // Clean up double slashes
      path = path.replace(/\/+/g, '/');
      if (path === '') path = '/';

      const isDynamic = path.includes('[');
      routes.push({
        path,
        type: isDynamic ? 'dynamic' : 'static',
        sourceFile: file
      });
    }
  }

  return routes;
}

/**
 * React Router: parse JSX/TSX for Route definitions
 */
async function discoverReactRouterRoutes(
  files: string[],
  fetchFile: (path: string) => Promise<string | null>
): Promise<RouteInfo[]> {
  // Find likely router files
  const routerFiles = files.filter(f =>
    f.match(/routes?\.(tsx?|jsx?)$/) ||
    f.includes('router') ||
    f.endsWith('App.tsx') ||
    f.endsWith('App.jsx') ||
    f.includes('Router')
  );

  const routes: RouteInfo[] = [];

  for (const file of routerFiles) {
    const content = await fetchFile(file);
    if (!content) continue;

    // Match various route definition patterns:
    // <Route path="/about" ...
    // <Route path='/about' ...
    // { path: "/about" ...
    // { path: '/about' ...
    // path="/about"
    const patterns = [
      /<Route[^>]*\spath=["']([^"']+)["']/g,
      /{\s*path:\s*["']([^"']+)["']/g,
      /createBrowserRouter\([^)]*path:\s*["']([^"']+)["']/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[1];

        // Skip catch-all and layout routes
        if (path === '*' || path.includes('*')) continue;

        routes.push({
          path,
          type: path.includes(':') ? 'dynamic' : 'static',
          sourceFile: file
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return routes.filter(r => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}

/**
 * Vue Router: parse router configuration
 */
async function discoverVueRouterRoutes(
  files: string[],
  fetchFile: (path: string) => Promise<string | null>
): Promise<RouteInfo[]> {
  // Find router configuration files
  const routerFiles = files.filter(f =>
    f.match(/router\/index\.(ts|js)$/) ||
    f.match(/router\.(ts|js)$/) ||
    f.includes('routes')
  );

  const routes: RouteInfo[] = [];

  for (const file of routerFiles) {
    const content = await fetchFile(file);
    if (!content) continue;

    // Match route definitions: { path: '/about' ...
    const pathRegex = /path:\s*["']([^"']+)["']/g;
    let match;

    while ((match = pathRegex.exec(content)) !== null) {
      const path = match[1];

      // Skip catch-all routes
      if (path.includes('*') || path === '/:pathMatch(.*)') continue;

      routes.push({
        path,
        type: path.includes(':') ? 'dynamic' : 'static',
        sourceFile: file
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return routes.filter(r => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}

/**
 * Convert static routes to full URLs
 */
export function routesToUrls(
  routes: RouteInfo[],
  baseUrl: string,
  maxUrls: number = 5
): string[] {
  const base = new URL(baseUrl);

  return routes
    .filter(r => r.type === 'static')
    .slice(0, maxUrls)
    .map(r => {
      const url = new URL(r.path, base);
      return url.href;
    });
}
