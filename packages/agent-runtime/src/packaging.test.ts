/**
 * Regression tests for the premium-check leak fixed in 2026-09: the
 * published @rankcli/agent-runtime tarball shipped every paid-tier check's
 * .ts source in the clear (no `files` allowlist), and its public dist/
 * bundle exported `runSyncAudit` plus statically imported every paid-tier
 * check function directly - so `require('@rankcli/agent-runtime')` gave
 * anyone full paid-tier checks with no license, whether or not they ever
 * touched the CLI.
 *
 * Paid-tier check implementations now live in the private, never-published
 * @rankcli/agent-runtime-premium package, and only reach a real user via
 * the CLI's WASM-encrypted, license-gated path. These tests fail loudly if
 * that boundary is ever crossed again - by a careless re-export, a missing
 * `files` entry, or a new premium check added directly to this package.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Function names that must never be reachable from this package's public
// API - each one is a paid-tier check that now lives in
// @rankcli/agent-runtime-premium instead.
const PREMIUM_CHECK_NAMES = [
  'analyzeFeaturedSnippet',
  'analyzeInternalLinkGraph',
  'analyzeEEATSignals',
  'analyzeContentScience',
  'analyzeKeywordCannibalizationSinglePage',
  'analyzeConversionElements',
  'analyzeKeywordPlacement',
  'analyzeTopicalClusters',
  'analyzePlatformPresence',
  'analyzeInteractiveTools',
  'analyzeFunnelIntent',
  'analyzeNavBoostSignals',
  'analyzeEntitySEO',
  'analyzeFreshnessSignals',
  'analyzeAIContentStructure',
  'analyzeRAGChunkReadiness',
  'analyzeCitationQuality',
  'analyzeAnswerConciseness',
  'analyzeBrandMentionOptimization',
  'analyzeAICitationWorthiness',
  'analyzeReviewEcosystem',
];

describe('npm package boundary (no premium-check leak)', () => {
  it('does not export runSyncAudit or any premium check from the built public bundle', async () => {
    // dist/index.js must already exist (this repo's `pnpm build` step) -
    // this test intentionally does not rebuild it, so a stale/missing dist
    // fails loudly rather than silently skipping the check it exists to run.
    const mod = await import('../dist/index.js');
    expect(mod.runSyncAudit).toBeUndefined();
    for (const name of PREMIUM_CHECK_NAMES) {
      expect(mod[name], `${name} must not be exported from the public bundle`).toBeUndefined();
    }
  });

  it('excludes source and the WASM adapter bundle from the published npm tarball', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'rankcli-pack-test-'));
    const stdout = execFileSync('npm', ['pack', '--json', '--pack-destination', outDir], {
      cwd: join(__dirname, '..'),
      encoding: 'utf-8',
    });
    const [{ filename, files }] = JSON.parse(stdout) as {
      filename: string;
      files: { path: string }[];
    }[];
    void filename; // tarball itself is written to outDir; not needed here

    const paths = files.map((f) => f.path);

    // No TypeScript source at all - not just the premium checks. A `files`
    // allowlist that only excludes premium filenames is one refactor away
    // from silently going stale.
    const tsSourceFiles = paths.filter((p) => p.startsWith('src/'));
    expect(tsSourceFiles, `source files leaked into the tarball: ${tsSourceFiles.join(', ')}`).toEqual([]);

    // dist/wasm/wasm-adapter.global.js is the unencrypted bundle of every
    // premium check - it must only ever reach users via build.rs's
    // encryption step, never a plain npm install.
    const wasmFiles = paths.filter((p) => p.startsWith('dist/wasm/'));
    expect(wasmFiles, `dist/wasm/ leaked into the tarball: ${wasmFiles.join(', ')}`).toEqual([]);
  });

  it('declares a files allowlist rather than relying on defaults', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
    expect(pkg.files).toBeDefined();
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('!dist/wasm');
  });
});

describe('framework recipes reachable from the built dist (not just source)', () => {
  // Regression test for a real bug: loadRecipe()'s fs.readFileSync fallback
  // resolves recipes/*.yaml relative to the running module's own location,
  // which only exists when executing directly against source (tsx/vitest).
  // Once bundled into dist/index.js - what the published package and every
  // real caller actually runs - that relative path silently doesn't exist,
  // and every framework-specific check returned nothing. Source-only tests
  // never catch this because they never touch dist/.
  it('returns real framework issues for a known signature via the built dist', async () => {
    const mod = await import('../dist/index.js');
    const html = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
    const info = mod.frameworks.detectFramework({ html });
    expect(info.framework).toBe('react');
    const issues = await mod.frameworks.getFrameworkIssues(info, html, 'https://example.com/');
    expect(issues.map((i: { code: string }) => i.code)).toContain('REACT_CSR_DETECTED');
  });
});
