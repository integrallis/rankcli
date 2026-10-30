/**
 * What the published @rankcli/agent-runtime tarball contains.
 *
 * Until 2026-10 the 21 checks in premium-checks.ts lived in a private package, were encrypted
 * into the CLI's WASM binary, and this file asserted they never reached the public bundle.
 * The passphrase that decrypted them shipped in the same tarball, every plan runs every check,
 * and the source is public now, so the boundary is gone: the built bundle must export them.
 * The tarball itself still ships compiled output only.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

describe('npm package contents', () => {
  it('exports every check, including the 21 that used to be encrypted, from the built bundle', async () => {
    // dist/index.js must already exist (this repo's `pnpm build` step) - this test
    // intentionally does not rebuild it, so a stale or missing dist fails loudly.
    const mod = (await import('../dist/index.js')) as unknown as Record<string, unknown>;
    for (const name of PREMIUM_CHECK_NAMES) {
      expect(typeof mod[name], `${name} must be exported from the bundle`).toBe('function');
    }
    const registry = mod.premiumChecks as Record<string, unknown>;
    expect(Object.keys(registry).sort()).toEqual([...PREMIUM_CHECK_NAMES].sort());
  });

  it('ships compiled output only, no TypeScript source', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'rankcli-pack-test-'));
    const stdout = execFileSync('npm', ['pack', '--json', '--pack-destination', outDir], {
      cwd: join(__dirname, '..'),
      encoding: 'utf-8',
    });
    const [{ files }] = JSON.parse(stdout) as { files: { path: string }[] }[];
    const paths = files.map((f) => f.path);
    const tsSourceFiles = paths.filter((p) => p.startsWith('src/'));
    expect(tsSourceFiles, `source files leaked into the tarball: ${tsSourceFiles.join(', ')}`).toEqual([]);
    expect(paths).toContain('dist/index.js');
  });

  it('declares a files allowlist rather than relying on defaults', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
    expect(pkg.files).toEqual(['dist']);
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
