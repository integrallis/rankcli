import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProjectConfig, validateProjectConfig, expandEnv } from './project-config.js';

const dirs: string[] = [];
const dirWith = (content: string, name = 'rankcli.config.json'): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rankcli-config-'));
  dirs.push(dir);
  writeFileSync(join(dir, name), content);
  return dir;
};
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('rankcli.config.json', () => {
  it('loads every setting and keeps what init wrote', () => {
    const dir = dirWith(JSON.stringify({
      name: 'site', url: 'https://example.com', maxPages: 3, checkLinks: true,
      failOn: ['error', 'score:aiReadiness<70'], minScore: 80, budgets: { crawlability: 90 },
      baseline: '.rankcli/baseline.json', ignore: ['LLMS_TXT_MISSING', { code: 'IMG_*', url: '/blog/*' }],
      headers: { 'x-token': '${RANKCLI_TEST_TOKEN}' }, dir: 'dist',
    }));
    const { loaded, error } = loadProjectConfig(dir);
    expect(error).toBeUndefined();
    expect(loaded?.path).toBe(join(dir, 'rankcli.config.json'));
    expect(loaded?.config.maxPages).toBe(3);
    expect(loaded?.config.budgets).toEqual({ crawlability: 90 });
    expect(loaded?.config.url).toBe('https://example.com');
  });

  it('is absent, not an error, when the default file is missing; a named file must exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rankcli-config-'));
    dirs.push(dir);
    expect(loadProjectConfig(dir)).toEqual({ loaded: null });
    expect(loadProjectConfig(dir, 'ci.json').error).toMatch(/not found/);
  });

  it('refuses a file that does not parse or does not validate', () => {
    expect(loadProjectConfig(dirWith('{ not json')).error).toMatch(/not valid JSON/);
    expect(loadProjectConfig(dirWith(JSON.stringify({ failOn: 'fatal', maxPages: 0, budgets: { vibes: 1 } }))).error).toMatch(/failOn.*fatal/);
    expect(validateProjectConfig({ maxPages: 0 })).toEqual(['maxPages must be a whole number of 1 or more']);
    expect(validateProjectConfig({ ignore: [{ reason: 'x' }] })[0]).toMatch(/ignore\[0\]/);
    expect(validateProjectConfig({ headers: { a: 1 } })[0]).toMatch(/headers/);
    expect(validateProjectConfig([])).toEqual(['the file must contain a JSON object']);
    expect(validateProjectConfig({ url: 'https://x', minScore: 50, checkLinks: false })).toEqual([]);
  });

  it('expands ${VAR} from the environment and nothing else', () => {
    process.env.RANKCLI_TEST_TOKEN = 'secret';
    expect(expandEnv('Bearer ${RANKCLI_TEST_TOKEN}')).toBe('Bearer secret');
    expect(expandEnv('${RANKCLI_TEST_MISSING_VAR}')).toBe('');
    expect(expandEnv('$HOME and {x}')).toBe('$HOME and {x}');
    delete process.env.RANKCLI_TEST_TOKEN;
  });
});

describe('resolveAuditSettings', () => {
  it('reconciles input with the file, input winning, and merges every gate rule', async () => {
    const { resolveAuditSettings, loadBaselineFile } = await import('./project-config.js');
    const dir = dirWith(JSON.stringify({ url: 'https://file.example', maxPages: 3, failOn: 'warning', minScore: 70, budgets: { aiReadiness: 60 }, headers: { 'x-a': '1' }, ignore: ['X'] }));
    const { settings, error } = resolveAuditSettings({ url: 'https://flag.example', failOn: ['error'], header: ['x-b: 2'], cookie: ['s=1'] }, dir);
    expect(error).toBeUndefined();
    expect(settings).toMatchObject({ url: 'https://flag.example', maxPages: 3, checkLinks: false, ignore: ['X'] });
    expect(settings?.spec.failOn).toBe('error');
    expect(settings?.spec.budgets).toEqual([{ category: 'overall', min: 70 }, { category: 'aiReadiness', min: 60 }]);
    expect(settings?.headers).toEqual({ 'x-a': '1', 'x-b': '2', Cookie: 's=1' });
    expect(resolveAuditSettings({ failOn: 'nope' }, dir).error).toMatch(/fail-on/);
    expect(resolveAuditSettings({ minScore: '101' }, dir).error).toMatch(/min-score/);
    expect(resolveAuditSettings({ header: ['nocolon'] }, dir).error).toMatch(/header/);
    expect(resolveAuditSettings({ config: 'missing.json' }, dir).error).toMatch(/not found/);
    expect(loadBaselineFile('nope.json', dir).error).toMatch(/not found/);
    writeFileSync(join(dir, 'b.json'), '{ "issues": [] }');
    expect(loadBaselineFile('b.json', dir).baseline?.issues).toEqual([]);
  });
});
