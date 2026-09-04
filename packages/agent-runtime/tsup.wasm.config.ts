import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/wasm-adapter.ts'],
  outDir: 'dist/wasm',
  format: ['iife'],
  minify: true,
  bundle: true,
  // CRITICAL: Don't externalize anything - bundle everything inline
  noExternal: [/.*/],
  platform: 'browser',
  target: 'es2020',
  globalName: '__rankcli__',
  // wasm-adapter.ts sets globalThis.RankCLI itself (runAudit, version, and
  // each individual premium check function) - no footer needed here. A
  // previous version of this footer ran after that assignment and
  // clobbered it back down to just { runAudit, version }, silently
  // hiding every individually-callable premium check from the sandbox.
});
