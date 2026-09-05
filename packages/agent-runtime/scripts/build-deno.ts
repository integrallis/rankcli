#!/usr/bin/env tsx
/**
 * Build script to create a Deno-compatible bundle of the audit engine.
 * This bundle can be used by Supabase Edge Functions.
 *
 * Usage:
 *   pnpm build:deno        # One-time build
 *   pnpm build:deno --watch  # Watch mode for development
 */

import { build, context } from 'esbuild';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(__dirname, '../../saas/supabase/functions/_shared/audit');
const WATCH_MODE = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [join(__dirname, '../src/audit/deno-entry.ts')],
  bundle: true,
  format: 'esm' as const,
  platform: 'neutral' as const,
  target: 'es2022',
  outfile: join(OUTPUT_DIR, 'engine.bundle.js'),
  external: ['cheerio'], // Will be imported from esm.sh in Deno
  loader: { '.yaml': 'text' as const }, // embed-recipes.ts inlines recipe content this way
  minify: false,
  sourcemap: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: {
    js: `// Auto-generated Deno-compatible audit bundle
// Do not edit manually - regenerate with: pnpm build:deno
// Generated: ${new Date().toISOString()}

// Polyfill for Node's Buffer if needed
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = {
    from: (str, encoding) => new TextEncoder().encode(str),
    isBuffer: () => false
  };
}
`,
  },
};

function postProcessBundle() {
  // Replace bare cheerio imports with esm.sh URL
  const bundlePath = join(OUTPUT_DIR, 'engine.bundle.js');
  let content = readFileSync(bundlePath, 'utf-8');

  // Replace various import patterns for cheerio
  content = content
    .replace(/from\s*["']cheerio["']/g, 'from "https://esm.sh/cheerio@1.0.0"')
    .replace(/import\s*\*\s*as\s*cheerio\s*from\s*["']cheerio["']/g,
             'import * as cheerio from "https://esm.sh/cheerio@1.0.0"')
    .replace(/require\s*\(\s*["']cheerio["']\s*\)/g,
             'await import("https://esm.sh/cheerio@1.0.0")');

  writeFileSync(bundlePath, content);
}

function writeWrapper() {
  const wrapper = `// Deno wrapper for audit engine
// Re-export everything from the bundle
export * from './engine.bundle.js';
`;
  writeFileSync(join(OUTPUT_DIR, 'index.ts'), wrapper);
}

async function buildDenoBundle() {
  console.log('Building Deno-compatible audit bundle...');

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    if (WATCH_MODE) {
      // Watch mode using esbuild context
      const ctx = await context({
        ...buildOptions,
        plugins: [{
          name: 'rebuild-notify',
          setup(build) {
            build.onEnd(result => {
              if (result.errors.length > 0) {
                console.error(`[${new Date().toLocaleTimeString()}] Deno build failed:`, result.errors);
              } else {
                postProcessBundle();
                writeWrapper();
                console.log(`[${new Date().toLocaleTimeString()}] ✓ Deno bundle rebuilt`);
              }
            });
          },
        }],
      });

      await ctx.watch();
      console.log('Watching for changes in audit module...');
      console.log('Press Ctrl+C to stop.\n');

      // Keep the process running
      process.on('SIGINT', async () => {
        await ctx.dispose();
        console.log('\nStopped watching.');
        process.exit(0);
      });
    } else {
      // One-time build
      const result = await build(buildOptions);

      if (result.errors.length > 0) {
        console.error('Build errors:', result.errors);
        process.exit(1);
      }

      console.log(`✓ Bundle created at ${OUTPUT_DIR}/engine.bundle.js`);

      postProcessBundle();
      console.log(`✓ Cheerio imports replaced with esm.sh URLs`);

      writeWrapper();
      console.log(`✓ Wrapper created at ${OUTPUT_DIR}/index.ts`);

      console.log('\nDeno bundle ready for use in edge functions!');
      console.log('Import with: import { runFullAudit } from "../_shared/audit/index.ts"');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildDenoBundle();
