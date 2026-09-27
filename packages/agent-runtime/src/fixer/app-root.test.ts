import { describe, it, expect } from 'vitest';
import { findAppRoot } from './app-root.js';

describe('findAppRoot', () => {
  it('finds a plain Vite app at the root', () => {
    expect(findAppRoot(['package.json', 'index.html', 'src/main.tsx'])).toBe('');
  });

  // The case that made rankcli.dev's own fix PR a no-op: a workspace root package.json
  // used to win outright, so the app root resolved to '' and index.html was never found.
  it('finds the app in a pnpm workspace package', () => {
    const files = [
      'package.json',
      'pnpm-workspace.yaml',
      'packages/cli/package.json',
      'packages/cli/src/index.ts',
      'packages/saas/package.json',
      'packages/saas/index.html',
      'packages/saas/src/main.tsx',
    ];
    expect(findAppRoot(files)).toBe('packages/saas/');
  });

  it('prefers the shallowest app', () => {
    expect(
      findAppRoot(['package.json', 'index.html', 'packages/site/package.json', 'packages/site/index.html'])
    ).toBe('');
  });

  it('breaks a tie on a conventional directory name', () => {
    const files = [
      'apps/zebra/package.json',
      'apps/zebra/index.html',
      'apps/web/package.json',
      'apps/web/index.html',
    ];
    expect(findAppRoot(files)).toBe('apps/web/');
  });

  it("reads CRA's public/index.html as the package above it", () => {
    expect(findAppRoot(['frontend/package.json', 'frontend/public/index.html'])).toBe('frontend/');
    expect(findAppRoot(['package.json', 'public/index.html'])).toBe('');
  });

  it('ignores index.html with no package.json beside it', () => {
    const files = ['package.json', 'index.html', 'docs/index.html'];
    expect(findAppRoot(files)).toBe('');
  });

  it('ignores node_modules', () => {
    const files = [
      'package.json',
      'node_modules/some-dep/package.json',
      'node_modules/some-dep/index.html',
      'packages/web/package.json',
      'packages/web/index.html',
    ];
    expect(findAppRoot(files)).toBe('packages/web/');
  });

  it('falls back to the root for a framework with no index.html', () => {
    expect(findAppRoot(['package.json', 'next.config.js', 'pages/index.tsx'])).toBe('');
  });

  it('falls back to the shallowest package when the root has none', () => {
    expect(findAppRoot(['apps/site/package.json', 'apps/site/next.config.js'])).toBe('apps/site/');
  });

  it('returns the root for an empty repository', () => {
    expect(findAppRoot([])).toBe('');
  });
});
