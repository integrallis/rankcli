#!/usr/bin/env node
// Build the Claude Desktop extension bundle (.mcpb).
//
// Claude Desktop installs extensions from a zip containing a manifest and a self-contained
// server, rather than by hand-editing claude_desktop_config.json. We shipped no bundle, so
// Claude Desktop users - the audience this product is most aimed at - had the highest-friction
// install path of anyone.
//
// Two things here are not obvious:
//
//   1. The server is bundled with esbuild rather than shipped as node_modules. A .mcpb is
//      downloaded and double-clicked, so it has to run with nothing installed.
//   2. A package.json is written at the bundle root on purpose. server.ts resolves its version
//      with require('../package.json') relative to the module; from server/index.js that is the
//      bundle root. Without it the server reports itself to Claude as version 0.0.0 - it fails
//      silently, because the lookup is wrapped in a try/catch with a '0.0.0' fallback.
//
// Usage: node scripts/build-mcpb.mjs   (from packages/mcp-server)

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'mcpb-build');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'server'), { recursive: true });

// 1. One self-contained file. A downloaded bundle has no node_modules to fall back on.
const esbuild = join(ROOT, 'node_modules/.bin/esbuild');
execFileSync(
  esbuild,
  [
    join(ROOT, 'src/index.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node20',
    `--outfile=${join(OUT, 'server/index.js')}`,
    // ESM output that still needs require() for the package.json lookup below.
    `--banner:js=import{createRequire as __cr}from'module';const require=__cr(import.meta.url);`,
  ],
  { stdio: 'inherit' }
);

// 2. The version the server reports to Claude. See the header note.
writeFileSync(
  join(OUT, 'package.json'),
  JSON.stringify({ name: pkg.name, version: pkg.version, type: 'module' }, null, 2) + '\n'
);

// 3. Manifest. Field names and manifest_version follow modelcontextprotocol/mcpb.
const manifest = {
  manifest_version: '0.2',
  name: 'rankcli',
  display_name: 'RankCLI - SEO & AI search',
  version: pkg.version,
  description: 'Free, local SEO and AI-search (GEO) audits. No signup, no API key.',
  long_description:
    'Runs 280+ technical SEO checks and AI-search readiness (GEO) analysis against any URL, ' +
    'entirely on your machine. Checks whether GPTBot, ClaudeBot and PerplexityBot can reach ' +
    'your pages, validates structured data and security headers, estimates Core Web Vitals, ' +
    'and generates fixes. Nothing is sent to RankCLI servers and no account is required.',
  author: { name: 'Integrallis Software, LLC', url: 'https://rankcli.dev' },
  repository: { type: 'git', url: 'https://github.com/integrallis/rankcli-mcp-server' },
  homepage: 'https://rankcli.dev',
  documentation: 'https://rankcli.dev/docs',
  support: 'https://github.com/integrallis/rankcli-mcp-server/issues',
  icon: 'icon.png',
  keywords: ['seo', 'geo', 'ai-search', 'audit', 'web'],
  license: 'MIT',
  server: {
    type: 'node',
    entry_point: 'server/index.js',
    mcp_config: { command: 'node', args: ['${__dirname}/server/index.js'] },
  },
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=20' } },
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// 4. Icon, if the brand asset is reachable from here.
const icon = join(ROOT, '../saas/public/favicon-512x512.png');
if (existsSync(icon)) copyFileSync(icon, join(OUT, 'icon.png'));
else console.warn('no icon found at', icon);

// 5. Zip it. `zip` is present on macOS and on GitHub's runners.
const bundle = join(ROOT, `rankcli-${pkg.version}.mcpb`);
rmSync(bundle, { force: true });
execFileSync('zip', ['-qr', bundle, '.'], { cwd: OUT });

console.log(`built ${bundle}`);
