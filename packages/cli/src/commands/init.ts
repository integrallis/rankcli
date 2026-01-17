import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface InitOptions {
  yes?: boolean;
}

interface ProjectConfig {
  name: string;
  framework: string | null;
  url: string | null;
  initialized: string;
}

const FRAMEWORKS = [
  { pattern: 'next.config', name: 'Next.js' },
  { pattern: 'astro.config', name: 'Astro' },
  { pattern: 'nuxt.config', name: 'Nuxt' },
  { pattern: 'svelte.config', name: 'SvelteKit' },
  { pattern: 'gatsby-config', name: 'Gatsby' },
  { pattern: 'vite.config', name: 'Vite' },
  { pattern: 'hugo.toml', name: 'Hugo' },
  { pattern: '_config.yml', name: 'Jekyll' },
  { pattern: 'angular.json', name: 'Angular' },
  { pattern: 'vue.config', name: 'Vue CLI' },
];

function detectFramework(): string | null {
  const cwd = process.cwd();

  for (const fw of FRAMEWORKS) {
    const patterns = [
      `${fw.pattern}.js`,
      `${fw.pattern}.ts`,
      `${fw.pattern}.mjs`,
      `${fw.pattern}.cjs`,
      fw.pattern,
    ];

    for (const p of patterns) {
      if (existsSync(join(cwd, p))) {
        return fw.name;
      }
    }
  }

  // Check package.json for clues
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return 'Next.js';
      if (deps['astro']) return 'Astro';
      if (deps['nuxt']) return 'Nuxt';
      if (deps['@sveltejs/kit']) return 'SvelteKit';
      if (deps['gatsby']) return 'Gatsby';
      if (deps['react']) return 'React';
      if (deps['vue']) return 'Vue';
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

function getProjectName(): string {
  const cwd = process.cwd();
  const pkgPath = join(cwd, 'package.json');

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch {
      // Ignore
    }
  }

  return cwd.split('/').pop() || 'unknown';
}

export async function init(options: InitOptions): Promise<void> {
  console.log('\n🚀 Initializing SEO Autopilot...\n');

  const configPath = join(process.cwd(), 'seo-autopilot.config.json');

  if (existsSync(configPath)) {
    console.log('⚠️  Configuration file already exists: seo-autopilot.config.json');
    console.log('   Run "seo analyze" to analyze your project.\n');
    return;
  }

  const framework = detectFramework();
  const projectName = getProjectName();

  console.log(`📦 Project: ${projectName}`);
  console.log(`🔧 Framework: ${framework || 'Unknown (static site?)'}`);

  const config: ProjectConfig = {
    name: projectName,
    framework,
    url: null,
    initialized: new Date().toISOString(),
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('\n✅ Created seo-autopilot.config.json');
  console.log('\n📋 Next steps:');
  console.log('   1. Run "seo analyze" to analyze your project');
  console.log('   2. Run "seo audit --url <your-site>" to run a technical audit');
  console.log('   3. Connect Google Search Console at https://seo-autopilot.dev/connect\n');
}
