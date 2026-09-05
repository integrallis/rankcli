#!/usr/bin/env tsx
/**
 * Generates src/frameworks/embedded-recipes.generated.ts from recipes/*.yaml.
 *
 * loadRecipe() falls back to fs.readFileSync(join(__dirname, 'recipes', ...))
 * - a path that only resolves when running directly against source (tsx).
 * Both real shipped forms of this code - the tsup-bundled dist/index.js
 * (what the published npm package and the CLI's SEA binary actually run)
 * and the Deno edge-function bundle - collapse everything into one file,
 * so that relative path never exists at runtime. This bakes every recipe's
 * YAML in as a string literal instead, registered via embedRecipe().
 *
 * Usage: tsx scripts/generate-embedded-recipes.ts
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const RECIPES_DIR = join(__dirname, '../src/frameworks/recipes');
const OUTPUT_FILE = join(__dirname, '../src/frameworks/embedded-recipes.generated.ts');

const files = readdirSync(RECIPES_DIR).filter(f => f.endsWith('.yaml')).sort();

const lines: string[] = [
  '// AUTO-GENERATED - do not edit manually.',
  '// Regenerate with: tsx scripts/generate-embedded-recipes.ts',
  "// (also runs automatically as part of 'pnpm build')",
  "import { embedRecipe } from './suggestion-engine.js';",
  '',
];

for (const file of files) {
  const framework = basename(file, '.yaml');
  const content = readFileSync(join(RECIPES_DIR, file), 'utf-8');
  // Backtick template literal - escape backtick/backslash/${ so the YAML's
  // own content (which may contain any of these in code samples) round-trips.
  const escaped = content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  lines.push(`embedRecipe(${JSON.stringify(framework)}, \`${escaped}\`);`);
}

writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
console.log(`✓ Generated ${OUTPUT_FILE} (${files.length} recipes embedded)`);
