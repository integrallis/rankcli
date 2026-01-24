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
  esbuildOptions(options) {
    // Set global RankCLI at the end
    options.footer = {
      js: `
        if (typeof globalThis !== 'undefined') {
          globalThis.RankCLI = __rankcli__.runSyncAudit ?
            { runAudit: __rankcli__.runSyncAudit, version: '0.1.0' } :
            __rankcli__;
        }
      `,
    };
  },
});
