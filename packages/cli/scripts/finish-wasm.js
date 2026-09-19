#!/usr/bin/env node
/**
 * finish-wasm.js - copies wasm-pack's output (native/pkg) into wasm/, then runs
 * verify-wasm.js unless --no-verify. In Node rather than the npm script so it runs the same on
 * Windows, where pnpm scripts run under cmd.exe (no `mkdir -p`, no `cp`).
 */
const fs = require('fs');
const path = require('path');

const pkg = path.join(__dirname, '..', 'native', 'pkg');
const out = path.join(__dirname, '..', 'wasm');

if (!fs.existsSync(pkg)) {
  console.error(`finish-wasm: ${pkg} is missing - wasm-pack did not build`);
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(pkg)) {
  if (name.startsWith('.')) continue; // wasm-pack's .gitignore ("*") would hide wasm/ from npm pack
  fs.cpSync(path.join(pkg, name), path.join(out, name), { recursive: true });
}
console.log(`finish-wasm: copied ${pkg} -> ${out}`);

if (!process.argv.includes('--no-verify')) require('./verify-wasm.js');
