import { describe, it, expect, afterEach } from 'vitest';
import type { AuditIssue } from '../types.js';
import { parseFailOn, parseBudgets, mergeGateSpecs, evaluateGate, isGated } from './gate.js';
import { diffIssues, readBaseline, pagePath } from './baseline.js';
import { applyIgnores, compileIgnoreRules, globToRegExp } from './ignore.js';
import { toSarif, artifactUri } from './sarif.js';
import { toJUnit } from './junit.js';
import { installRequestDefaults } from './request-defaults.js';

const issue = (code: string, severity: AuditIssue['severity'], urls: string[] = ['https://example.com/'], extra: Partial<AuditIssue> = {}): AuditIssue => ({
  code,
  severity,
  category: 'on-page',
  title: `Title for ${code}`,
  description: `Description for ${code}`,
  impact: 'impact',
  howToFix: `Fix ${code}`,
  affectedUrls: urls,
  ...extra,
});

const scores = { overall: 72, aiReadiness: 61, crawlability: 95 };

describe('gate rules', () => {
  it('parses severities, the overall score and category scores from one list', () => {
    const { spec, error } = parseFailOn('error, score<80, score:aiReadiness<70');
    expect(error).toBeUndefined();
    expect(spec.failOn).toBe('error');
    expect(spec.budgets).toEqual([{ category: 'overall', min: 80 }, { category: 'aiReadiness', min: 70 }]);
  });

  it('accepts the flag repeated and category aliases', () => {
    const { spec } = parseFailOn(['warning', 'score:ai-readiness<70', 'score:on_page<50']);
    expect(spec.failOn).toBe('warning');
    expect(spec.budgets.map(b => b.category)).toEqual(['aiReadiness', 'onPage']);
  });

  it('keeps the most inclusive severity and the highest minimum', () => {
    const { spec } = parseFailOn('error,warning,score<60,score<80');
    expect(spec.failOn).toBe('warning');
    expect(spec.budgets).toEqual([{ category: 'overall', min: 80 }]);
  });

  it('rejects what it cannot read, naming the rule', () => {
    expect(parseFailOn('fatal').error).toMatch(/"fatal"/);
    expect(parseFailOn('score:vibes<70').error).toMatch(/vibes/);
    expect(parseFailOn('score<101').error).toMatch(/0 to 100/);
    expect(parseFailOn(undefined)).toEqual({ spec: { budgets: [] } });
  });

  it('reads the config file budgets object', () => {
    expect(parseBudgets({ overall: 80, 'ai-readiness': 70 }).spec.budgets).toEqual([
      { category: 'overall', min: 80 }, { category: 'aiReadiness', min: 70 },
    ]);
    expect(parseBudgets({ nope: 1 }).error).toMatch(/nope/);
    expect(parseBudgets({ overall: '80' }).error).toMatch(/overall/);
    expect(parseBudgets([1]).error).toMatch(/object/);
  });

  it('fails on issues at or above the level and on scores below their minimums', () => {
    const spec = mergeGateSpecs(parseFailOn('error').spec, parseBudgets({ overall: 80, aiReadiness: 70 }).spec);
    expect(isGated(spec)).toBe(true);
    const result = evaluateGate(spec, [issue('A', 'error'), issue('B', 'warning'), issue('C', 'critical')], scores);
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([
      '2 issues at or above fail-on error (1 critical, 1 error)',
      'score 72 is below the minimum 80',
      'aiReadiness score 61 is below its minimum 70',
    ]);
    expect(result.minScore).toBe(80);
    expect(result.budgets.find(b => b.category === 'aiReadiness')?.actual).toBe(61);
  });

  it('passes at the threshold, and says "new" when a baseline was applied', () => {
    expect(evaluateGate(parseFailOn('score<72').spec, [], scores).passed).toBe(true);
    expect(evaluateGate(parseFailOn('warning').spec, [issue('A', 'notice')], scores).passed).toBe(true);
    const r = evaluateGate(parseFailOn('warning').spec, [issue('A', 'warning')], scores, { newOnly: true });
    expect(r.failures[0]).toBe('1 new issue at or above fail-on warning (1 warning)');
  });

  it('is not gated without rules', () => {
    expect(isGated(parseFailOn('').spec)).toBe(false);
    expect(evaluateGate(parseFailOn('').spec, [issue('A', 'critical')], { overall: 0 }).passed).toBe(true);
  });
});

describe('baseline diff', () => {
  it('identifies a finding by code and page path', () => {
    expect(pagePath('https://example.com/about/?utm=1')).toBe('/about?utm=1');
    expect(pagePath('https://example.com')).toBe('/');
    expect(pagePath('not a url')).toBe('not a url');
  });

  it('reports what is new, what is fixed and what stayed', () => {
    const before = [issue('A', 'error', ['https://example.com/']), issue('B', 'warning', ['https://example.com/about'])];
    const after = [
      issue('A', 'error', ['https://example.com/', 'https://example.com/pricing']),
      issue('C', 'warning', ['https://example.com/']),
    ];
    const diff = diffIssues(before, after);
    expect(diff.added.map(i => [i.code, i.affectedUrls])).toEqual([
      ['A', ['https://example.com/pricing']],
      ['C', ['https://example.com/']],
    ]);
    expect(diff.fixed.map(i => i.code)).toEqual(['B']);
    expect(diff.unchanged).toBe(1);
  });

  it('matches a page with and without its trailing slash, and a finding with no page by code', () => {
    const before = [issue('A', 'error', ['https://example.com/about/']), issue('SITE', 'notice', [])];
    const after = [issue('A', 'error', ['https://example.com/about']), issue('SITE', 'notice', [])];
    const diff = diffIssues(before, after);
    expect(diff.added).toEqual([]);
    expect(diff.fixed).toEqual([]);
    expect(diff.unchanged).toBe(2);
  });

  it('reads a CLI JSON report or an engine report as a baseline, and rejects anything else', () => {
    const cli = readBaseline({ url: 'https://example.com', score: 80, healthScores: { overall: 80 }, issues: [issue('A', 'error')] });
    expect('issues' in cli && cli.issues.length).toBe(1);
    expect('score' in cli && cli.score).toBe(80);
    const engine = readBaseline({ healthScore: { overall: 70 }, issues: [issue('A', 'error'), { nope: true }] });
    expect('issues' in engine && engine.issues.length).toBe(1);
    expect('score' in engine && engine.score).toBe(70);
    expect(readBaseline({ hello: 1 })).toHaveProperty('error');
    expect(readBaseline('x')).toHaveProperty('error');
  });
});

describe('ignore rules', () => {
  it('turns globs into anchored, case-insensitive patterns', () => {
    expect(globToRegExp('/blog/*').test('/blog/post')).toBe(true);
    expect(globToRegExp('/blog/*').test('/blog/2026/post')).toBe(false);
    expect(globToRegExp('/blog/**').test('/blog/2026/post')).toBe(true);
    expect(globToRegExp('AI_*').test('ai_uncited')).toBe(true);
    expect(globToRegExp('a.b').test('axb')).toBe(false);
  });

  it('ignores a code everywhere, a code on some pages, or every finding on a page', () => {
    const issues = [
      issue('LLMS_TXT_MISSING', 'warning', ['https://example.com/']),
      issue('IMG_ALT_MISSING', 'warning', ['https://example.com/', 'https://example.com/blog/post']),
      issue('TITLE_MISSING', 'error', ['https://example.com/drafts/x']),
      issue('SITE_WIDE', 'notice', []),
    ];
    const { issues: kept, ignored } = applyIgnores(issues, [
      'LLMS_TXT_MISSING',
      { code: 'IMG_ALT_MISSING', url: '/blog/*' },
      { url: '/drafts/**' },
      { code: 'SITE_*', url: '/never' },
    ]);
    expect(kept.map(i => [i.code, i.affectedUrls])).toEqual([
      ['IMG_ALT_MISSING', ['https://example.com/']],
      ['SITE_WIDE', []],
    ]);
    expect(ignored).toEqual([
      { code: 'LLMS_TXT_MISSING' },
      { code: 'IMG_ALT_MISSING', urls: ['https://example.com/blog/post'] },
      { code: 'TITLE_MISSING', urls: ['https://example.com/drafts/x'] },
    ]);
  });

  it('matches a whole URL when the pattern has a scheme', () => {
    const { issues: kept } = applyIgnores([issue('A', 'error', ['https://example.com/x', 'https://other.com/x'])], [{ url: 'https://other.com/**' }]);
    expect(kept[0].affectedUrls).toEqual(['https://example.com/x']);
  });

  it('names a rule that is not a rule', () => {
    expect(compileIgnoreRules([{ reason: 'why' }]).errors[0]).toMatch(/ignore\[0\]/);
    expect(compileIgnoreRules('X').errors[0]).toMatch(/array/);
    expect(applyIgnores([issue('A', 'error')], undefined).issues).toHaveLength(1);
  });
});

describe('SARIF', () => {
  it('writes one rule per code and one result per page, in the 2.1.0 shape', () => {
    const sarif = toSarif({
      url: 'https://example.com',
      toolVersion: '0.0.53',
      score: 80,
      issues: [issue('A', 'error', ['https://example.com/', 'https://example.com/about']), issue('B', 'notice', [])],
    }) as { version: string; runs: Array<{ tool: { driver: { rules: Array<{ id: string }>; version: string } }; results: Array<Record<string, any>>; invocations: Array<Record<string, unknown>> }> };
    expect(sarif.version).toBe('2.1.0');
    const run = sarif.runs[0];
    expect(run.tool.driver.version).toBe('0.0.53');
    expect(run.tool.driver.rules.map(r => r.id)).toEqual(['A', 'B']);
    expect(run.results).toHaveLength(3);
    expect(run.results[0].level).toBe('error');
    expect(run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('index.html');
    expect(run.results[1].locations[0].physicalLocation.artifactLocation.uri).toBe('about');
    expect(run.results[2].level).toBe('note');
    expect(run.results[2].partialFingerprints.rankcli).toBe('B /');
    expect(run.invocations[0].executionSuccessful).toBe(true);
  });

  it('maps pages to files when told how, and records a failed run', () => {
    const sarif = toSarif({
      url: 'https://example.com',
      issues: [issue('A', 'warning', ['https://example.com/about'])],
      fileFor: () => 'dist/about/index.html',
      exitCode: 3,
      error: 'Page returns HTTP 503',
    }) as { runs: Array<{ results: Array<Record<string, any>>; invocations: Array<Record<string, any>> }> };
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('dist/about/index.html');
    expect(sarif.runs[0].invocations[0].executionSuccessful).toBe(false);
    expect(sarif.runs[0].invocations[0].toolExecutionNotifications[0].message.text).toBe('Page returns HTTP 503');
    expect(artifactUri('https://example.com/docs/intro/')).toBe('docs/intro');
  });

  it('marks results new or unchanged against a baseline', () => {
    const sarif = toSarif({
      url: 'https://example.com',
      issues: [issue('A', 'error', ['https://example.com/', 'https://example.com/new'])],
      baselineKeys: new Set(['A /']),
    }) as { runs: Array<{ results: Array<Record<string, any>> }> };
    expect(sarif.runs[0].results.map(r => r.baselineState)).toEqual(['unchanged', 'new']);
  });
});

describe('JUnit', () => {
  it('makes findings at or above the level failures and the rest passing cases with output', () => {
    const xml = toJUnit({
      url: 'https://example.com',
      issues: [issue('A', 'error'), issue('B', 'warning')],
      checksPassed: 250,
      score: 80,
      durationMs: 1500,
      gateFailures: ['score 80 is below the minimum 90'],
    });
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<testsuites name="rankcli" tests="4" failures="2" errors="0" time="1.500">');
    expect(xml).toContain('<testcase name="A: Title for A" classname="rankcli.on-page"');
    expect(xml).toContain('<failure message="Title for A" type="error">');
    expect(xml).toContain('<system-out>warning: Title for B');
    expect(xml).toContain('name="gate: score 80 is below the minimum 90"');
    expect(xml).toContain('<testcase name="250 checks passed"');
  });

  it('escapes markup and reports a failed audit as an error', () => {
    const xml = toJUnit({ url: 'https://example.com/?a=1&b=<2>', issues: [], error: 'Page returns HTTP 503 <down>' });
    expect(xml).toContain('errors="1"');
    expect(xml).toContain('https://example.com/?a=1&amp;b=&lt;2&gt;');
    expect(xml).toContain('<error message="Page returns HTTP 503 &lt;down&gt;">');
    expect(toJUnit({ url: 'https://example.com', issues: [issue('W', 'warning')], failOn: 'warning' })).toContain('failures="1"');
  });

  it('with a baseline, only new findings fail', () => {
    const xml = toJUnit({ url: 'https://example.com', issues: [issue('OLD', 'error'), issue('NEW', 'error')], isNew: i => i.code === 'NEW' });
    expect(xml).toContain('failures="1"');
    expect(xml).toMatch(/name="NEW: Title for NEW"[^>]*>\n\s*<failure/);
    expect(xml).toMatch(/name="OLD: Title for OLD"[^>]*>\n\s*<system-out/);
  });
});

describe('request defaults', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it('adds the headers to the site and its www twin only, and rewrites the origin when asked', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      new Headers(input instanceof Request ? input.headers : init?.headers).forEach((v, k) => { headers[k] = v; });
      calls.push({ url: input instanceof Request ? input.url : String(input), headers });
      return new Response('ok');
    }) as typeof fetch;

    const uninstall = installRequestDefaults({ origin: 'https://example.com', headers: { Cookie: 'session=abc' }, rewriteTo: 'http://127.0.0.1:4321' });
    await fetch('https://example.com/about', { headers: { 'User-Agent': 'Googlebot' } });
    await fetch('https://www.example.com/');
    await fetch(new Request('https://example.com/robots.txt'));
    await fetch('https://other.example.net/');
    uninstall();
    await fetch('https://example.com/after');

    expect(calls.map(c => c.url)).toEqual([
      'http://127.0.0.1:4321/about',
      'http://127.0.0.1:4321/',
      'http://127.0.0.1:4321/robots.txt',
      'https://other.example.net/',
      'https://example.com/after',
    ]);
    expect(calls[0].headers).toMatchObject({ cookie: 'session=abc', 'user-agent': 'Googlebot' });
    expect(calls[3].headers.cookie).toBeUndefined();
    expect(calls[4].headers.cookie).toBeUndefined();
  });
});
