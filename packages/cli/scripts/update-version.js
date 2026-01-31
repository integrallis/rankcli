#!/usr/bin/env node
// Syncs version.ts with package.json version

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');
const versionPath = join(__dirname, '..', 'src', 'version.ts');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const content = `// This file is auto-generated. Do not edit manually.
// Update by running: npm run update-version
export const VERSION = '${pkg.version}';
`;

writeFileSync(versionPath, content);
console.log(`✓ Updated version.ts to ${pkg.version}`);
