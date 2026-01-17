import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import type { ToolResult, FrameworkInfo } from '../types.js';

const FRAMEWORK_SIGNATURES = [
  { pattern: 'next.config', name: 'Next.js', metaPattern: 'metadata-export' as const },
  { pattern: 'astro.config', name: 'Astro', metaPattern: 'frontmatter' as const },
  { pattern: 'nuxt.config', name: 'Nuxt', metaPattern: 'meta-function' as const },
  { pattern: 'svelte.config', name: 'SvelteKit', metaPattern: 'head-component' as const },
  { pattern: 'gatsby-config', name: 'Gatsby', metaPattern: 'head-component' as const },
  { pattern: 'vite.config', name: 'Vite', metaPattern: 'html-head' as const },
  { pattern: 'angular.json', name: 'Angular', metaPattern: 'html-head' as const },
  { pattern: 'vue.config', name: 'Vue CLI', metaPattern: 'html-head' as const },
];

export async function readFile(params: { path: string; cwd?: string }): Promise<ToolResult> {
  const { path, cwd = process.cwd() } = params;
  const fullPath = path.startsWith('/') ? path : join(cwd, path);

  try {
    if (!existsSync(fullPath)) {
      return { success: false, error: `File not found: ${path}` };
    }

    const content = readFileSync(fullPath, 'utf-8');
    return { success: true, data: { path: fullPath, content } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error reading file'
    };
  }
}

export async function writeFile(params: { path: string; content: string; cwd?: string }): Promise<ToolResult> {
  const { path, content, cwd = process.cwd() } = params;
  const fullPath = path.startsWith('/') ? path : join(cwd, path);

  try {
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
    return { success: true, data: { path: fullPath, written: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error writing file'
    };
  }
}

export async function listFiles(params: {
  path: string;
  cwd?: string;
  pattern?: string;
  recursive?: boolean;
}): Promise<ToolResult> {
  const { path, cwd = process.cwd(), pattern, recursive = false } = params;
  const fullPath = path.startsWith('/') ? path : join(cwd, path);

  try {
    if (!existsSync(fullPath)) {
      return { success: false, error: `Directory not found: ${path}` };
    }

    const files: string[] = [];

    function scan(dir: string, relativeTo: string) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const entryPath = join(dir, entry);
        const relativePath = entryPath.replace(relativeTo + '/', '');
        const stat = statSync(entryPath);

        if (stat.isDirectory() && recursive) {
          scan(entryPath, relativeTo);
        } else if (stat.isFile()) {
          if (!pattern || entry.match(new RegExp(pattern))) {
            files.push(relativePath);
          }
        }
      }
    }

    scan(fullPath, fullPath);

    return { success: true, data: files };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error listing files'
    };
  }
}

export async function detectFramework(params: { cwd?: string }): Promise<ToolResult> {
  const { cwd = process.cwd() } = params;

  try {
    // Check for config files
    for (const fw of FRAMEWORK_SIGNATURES) {
      const patterns = [
        `${fw.pattern}.js`,
        `${fw.pattern}.ts`,
        `${fw.pattern}.mjs`,
        `${fw.pattern}.cjs`,
        fw.pattern,
      ];

      for (const p of patterns) {
        if (existsSync(join(cwd, p))) {
          const info: FrameworkInfo = {
            name: fw.name,
            metaPattern: fw.metaPattern,
          };

          // Check for Next.js app router vs pages router
          if (fw.name === 'Next.js') {
            if (existsSync(join(cwd, 'app'))) {
              info.router = 'app';
              info.metaPattern = 'metadata-export';
            } else if (existsSync(join(cwd, 'pages')) || existsSync(join(cwd, 'src/pages'))) {
              info.router = 'pages';
              info.metaPattern = 'head-component';
            }
          }

          return { success: true, data: info };
        }
      }
    }

    // Check package.json for dependencies
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) {
        const hasAppDir = existsSync(join(cwd, 'app')) || existsSync(join(cwd, 'src/app'));
        return {
          success: true,
          data: {
            name: 'Next.js',
            router: hasAppDir ? 'app' : 'pages',
            metaPattern: hasAppDir ? 'metadata-export' : 'head-component',
          } as FrameworkInfo
        };
      }
      if (deps['astro']) {
        return { success: true, data: { name: 'Astro', metaPattern: 'frontmatter' } as FrameworkInfo };
      }
      if (deps['nuxt']) {
        return { success: true, data: { name: 'Nuxt', metaPattern: 'meta-function' } as FrameworkInfo };
      }
      if (deps['@sveltejs/kit']) {
        return { success: true, data: { name: 'SvelteKit', metaPattern: 'head-component' } as FrameworkInfo };
      }
      if (deps['gatsby']) {
        return { success: true, data: { name: 'Gatsby', metaPattern: 'head-component' } as FrameworkInfo };
      }

      // Check for Vite with React
      if (deps['vite'] && deps['react']) {
        return {
          success: true,
          data: {
            name: 'Vite',
            metaPattern: 'html-head',
          } as FrameworkInfo
        };
      }

      // Just Vite
      if (deps['vite']) {
        return { success: true, data: { name: 'Vite', metaPattern: 'html-head' } as FrameworkInfo };
      }

      // Plain React
      if (deps['react']) {
        return { success: true, data: { name: 'React', metaPattern: 'html-head' } as FrameworkInfo };
      }

      // Vue
      if (deps['vue']) {
        return { success: true, data: { name: 'Vue', metaPattern: 'html-head' } as FrameworkInfo };
      }
    }

    return {
      success: true,
      data: { name: 'Unknown', metaPattern: 'html-head' } as FrameworkInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error detecting framework'
    };
  }
}

export async function findHtmlEntry(params: { cwd?: string }): Promise<ToolResult> {
  const { cwd = process.cwd() } = params;

  const possiblePaths = [
    'index.html',
    'public/index.html',
    'src/index.html',
  ];

  for (const p of possiblePaths) {
    const fullPath = join(cwd, p);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8');
      return { success: true, data: { path: p, fullPath, content } };
    }
  }

  return { success: false, error: 'No HTML entry point found' };
}

export async function findPageFiles(params: { cwd?: string; framework?: string }): Promise<ToolResult> {
  const { cwd = process.cwd(), framework } = params;

  const pageExtensions = ['.tsx', '.jsx', '.ts', '.js', '.astro', '.svelte', '.vue'];
  const pages: { path: string; route: string }[] = [];

  // Determine where to look based on framework
  const searchDirs: string[] = [];

  if (framework === 'Next.js') {
    if (existsSync(join(cwd, 'app'))) {
      searchDirs.push('app');
    }
    if (existsSync(join(cwd, 'src/app'))) {
      searchDirs.push('src/app');
    }
    if (existsSync(join(cwd, 'pages'))) {
      searchDirs.push('pages');
    }
    if (existsSync(join(cwd, 'src/pages'))) {
      searchDirs.push('src/pages');
    }
  } else if (framework === 'Astro') {
    searchDirs.push('src/pages');
  } else if (framework === 'SvelteKit') {
    searchDirs.push('src/routes');
  } else if (framework === 'Nuxt') {
    searchDirs.push('pages');
  } else {
    // Generic - check common locations
    searchDirs.push('src', 'pages', 'app');
  }

  function isPageFile(filename: string): boolean {
    const base = basename(filename, extname(filename));
    // Common page file patterns
    return pageExtensions.includes(extname(filename)) &&
      (base === 'page' || base === 'index' || base.startsWith('+page') ||
       !base.startsWith('_') && !base.startsWith('['));
  }

  function scanDir(dir: string, basePath: string) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'components') continue;

      const entryPath = join(dir, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        scanDir(entryPath, join(basePath, entry));
      } else if (isPageFile(entry)) {
        const relativePath = join(basePath, entry);
        let route = '/' + basePath.replace(/\\/g, '/');
        if (route === '/') route = '/';

        pages.push({
          path: relativePath,
          route: route === '/.' ? '/' : route,
        });
      }
    }
  }

  for (const searchDir of searchDirs) {
    const fullSearchDir = join(cwd, searchDir);
    if (existsSync(fullSearchDir)) {
      scanDir(fullSearchDir, '');
    }
  }

  return { success: true, data: pages };
}
