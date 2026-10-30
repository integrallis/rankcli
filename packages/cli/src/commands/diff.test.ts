import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diff, scoreChanges } from './diff.js';
import { EXIT_CODES } from './audit.js';

let dir: string;
let log: MockInstance<any[], any>;
const issue = (code: string, severity: string, url = 'https://example.com/') => ({ code, severity, category: 'on-page', title: `T ${code}`, description: '', impact: '', howToFix: '', affectedUrls: [url] });
const write = (name: string, doc: unknown) => { const f = join(dir, name); writeFileSync(f, JSON.stringify(doc)); return f; };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rankcli-diff-'));
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('rankcli diff', () => {
  it('reports new, fixed and unchanged findings and the score moves', async () => {
    const before = write('a.json', { url: 'https://example.com', score: 80, healthScores: { overall: 80, aiReadiness: 60 }, issues: [issue('A', 'error'), issue('B', 'warning')] });
    const after = write('b.json', { url: 'https://example.com', score: 78, healthScores: { overall: 78, aiReadiness: 65 }, issues: [issue('A', 'error'), issue('C', 'error')] });
    expect(await diff(before, after, { output: 'json' })).toBe(EXIT_CODES.OK);
    const parsed = JSON.parse(log.mock.calls.at(-1)![0]);
    expect(parsed.added.map((i: { code: string }) => i.code)).toEqual(['C']);
    expect(parsed.fixed.map((i: { code: string }) => i.code)).toEqual(['B']);
    expect(parsed.unchanged).toBe(1);
    expect(parsed.scores.overall).toEqual({ before: 80, after: 78, delta: -2 });
    expect(parsed.scores.aiReadiness.delta).toBe(5);
    expect(parsed.gate).toBeUndefined();
  });

  it('gates on new findings and on the after score with --fail-on', async () => {
    const before = write('a.json', { score: 80, issues: [issue('A', 'error')] });
    const after = write('b.json', { score: 80, issues: [issue('A', 'error'), issue('C', 'warning')] });
    expect(await diff(before, after, { failOn: 'error' })).toBe(EXIT_CODES.OK);
    expect(await diff(before, after, { failOn: 'warning' })).toBe(EXIT_CODES.GATE_FAILED);
    expect(await diff(before, after, { failOn: 'score<90' })).toBe(EXIT_CODES.GATE_FAILED);
    expect(await diff(before, after, { failOn: 'nope' })).toBe(EXIT_CODES.USAGE);
  });

  it('exits 2 for a missing or unreadable file, with JSON when asked', async () => {
    const ok = write('a.json', { issues: [] });
    expect(await diff(ok, join(dir, 'missing.json'), { output: 'json' })).toBe(EXIT_CODES.USAGE);
    expect(JSON.parse(log.mock.calls.at(-1)![0]).error).toMatch(/not found/);
    const bad = write('bad.json', { hello: 1 });
    expect(await diff(ok, bad, {})).toBe(EXIT_CODES.USAGE);
  });

  it('prints a console summary', async () => {
    const before = write('a.json', { score: 80, timestamp: '2026-10-01T00:00:00.000Z', issues: [issue('A', 'error')] });
    const after = write('b.json', { score: 90, issues: [] });
    expect(await diff(before, after, {})).toBe(EXIT_CODES.OK);
    const out = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('80 → 90');
    expect(out).toContain('Fixed (1)');
    expect(out).toContain('T A');
    expect(scoreChanges({ overall: 1 }, undefined)).toEqual({ overall: { before: 1, after: undefined, delta: undefined } });
  });
});
