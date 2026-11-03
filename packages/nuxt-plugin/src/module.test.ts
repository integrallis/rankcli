import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@nuxt/kit', () => ({ defineNuxtModule: (definition: unknown) => definition }));
const auditBuildOutput = vi.fn(async () => ({ score: 90, pagesAudited: 1, errors: 0, warnings: 0, notices: 0 }));
vi.mock('./audit.js', () => ({ auditBuildOutput: (...args: unknown[]) => auditBuildOutput(...args) }));
import nuxtRankcli, { auditGeneratedOutput, resolveSiteUrl } from './module.js';

type Definition = { meta: { name: string; configKey: string }; defaults: Record<string, unknown>; setup: (options: Record<string, unknown>, nuxt: unknown) => void };
const definition = nuxtRankcli as unknown as Definition;

function fakeNuxt(options: Record<string, unknown>) {
  const hooks = new Map<string, (...args: unknown[]) => unknown>();
  return { options, hook: (name: string, fn: (...args: unknown[]) => unknown) => hooks.set(name, fn), hooks };
}
const logger = { info: vi.fn(), warn: vi.fn() };

describe('nuxt-rankcli', () => {
  let out: string;
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'nuxt-rankcli-out-'));
    auditBuildOutput.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
  });
  afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it('is a Nuxt module under the rankcli config key, auditing by default', () => {
    expect(definition.meta).toMatchObject({ name: 'nuxt-rankcli', configKey: 'rankcli' });
    expect(definition.defaults).toEqual({ audit: true });
  });

  it('finds the site URL where Nuxt sites keep it', () => {
    expect(resolveSiteUrl({ siteUrl: 'https://a.dev/' }, {})).toBe('https://a.dev');
    expect(resolveSiteUrl({}, { site: { url: 'https://b.dev' } })).toBe('https://b.dev');
    expect(resolveSiteUrl({}, { runtimeConfig: { public: { siteUrl: 'https://c.dev' } } })).toBe('https://c.dev');
    expect(resolveSiteUrl({}, {})).toBeUndefined();
  });

  it('audits the generated output after a static build, with every page counted', async () => {
    writeFileSync(join(out, 'index.html'), '<html></html>');
    mkdirSync(join(out, 'about'));
    writeFileSync(join(out, 'about', 'index.html'), '<html></html>');
    await auditGeneratedOutput({ siteUrl: 'https://example.com', failOn: 'error' }, { nitro: { static: true } }, out, logger);
    expect(auditBuildOutput).toHaveBeenCalledWith(expect.objectContaining({ siteUrl: 'https://example.com', dir: out, pageCount: 2, failOn: 'error' }));
  });

  it('says what to do instead after a server build, and audits nothing', async () => {
    await auditGeneratedOutput({ siteUrl: 'https://example.com' }, { nitro: { static: false } }, out, logger);
    expect(auditBuildOutput).not.toHaveBeenCalled();
    expect(logger.info.mock.calls[0][0]).toMatch(/Nothing static to audit.*npx @rankcli\/cli audit --url https:\/\/example.com/);
  });

  it('wires nitro:init and close in a production build, and nothing in dev or with audit: false', () => {
    const prod = fakeNuxt({ dev: false, nitro: { static: true } });
    definition.setup({ audit: true }, prod);
    expect([...prod.hooks.keys()]).toEqual(['nitro:init', 'close']);
    const dev = fakeNuxt({ dev: true });
    definition.setup({ audit: true }, dev);
    expect(dev.hooks.size).toBe(0);
    const off = fakeNuxt({ dev: false });
    definition.setup({ audit: false }, off);
    expect(off.hooks.size).toBe(0);
  });

  it('runs the audit on close with the directory nitro reported', async () => {
    writeFileSync(join(out, 'index.html'), '<html></html>');
    const nuxt = fakeNuxt({ dev: false, nitro: { static: true }, site: { url: 'https://example.com' } });
    definition.setup({ audit: true }, nuxt);
    nuxt.hooks.get('nitro:init')!({ options: { output: { publicDir: out } }, logger });
    await nuxt.hooks.get('close')!();
    expect(auditBuildOutput).toHaveBeenCalledWith(expect.objectContaining({ siteUrl: 'https://example.com', dir: out }));
  });
});
