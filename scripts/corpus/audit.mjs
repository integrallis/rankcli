#!/usr/bin/env node
/**
 * Audit the corpus, one page per site, and keep what the story needs.
 *
 *   node scripts/corpus/audit.mjs --sites corpus/sites.json --out corpus/results/2026-11-03.json [--limit 40] [--concurrency 4] [--cli packages/cli/dist/index.js]
 *
 * Each site gets `rankcli audit --url <origin> --max-pages 1 -o json`. The record kept per site
 * is small: the scores, the framework, the exit code, every finding code, and the facts the
 * headlines are made of: which crawler classes robots.txt disallows and which the edge refuses
 * (with the statuses), whether metadata is streamed only to Googlebot, whether the page is
 * client-rendered, whether llms.txt and the sitemap exist and whether the sitemap stamps one
 * date on every URL. Nothing about the site's content is kept.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const sitesFile = opt('--sites', 'corpus/sites.json');
const outFile = opt('--out', `corpus/results/${new Date().toISOString().slice(0, 10)}.json`);
const limit = Number(opt('--limit', 0));
const concurrency = Number(opt('--concurrency', 4));
const cli = opt('--cli', 'packages/cli/dist/index.js');
const timeoutMs = Number(opt('--timeout', 150000));

const { sites } = JSON.parse(readFileSync(sitesFile, 'utf8'));
const todo = limit > 0 ? sites.slice(0, limit) : sites;

function runAudit(origin) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'audit', '--url', origin, '--max-pages', '1', '-o', 'json'], {
      env: { ...process.env, CI: '1', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        resolve({ code, report: JSON.parse(out) });
      } catch {
        resolve({ code, report: null });
      }
    });
  });
}

const EDGE = {
  SEARCH_CRAWLER_BLOCKED_AT_EDGE: 'search',
  AI_SEARCH_CRAWLER_BLOCKED_AT_EDGE: 'ai-search',
  AI_USER_FETCH_BLOCKED_AT_EDGE: 'user',
  AI_TRAINING_CRAWLER_BLOCKED_AT_EDGE: 'training',
};
const ROBOTS = {
  AI_SEARCH_BOTS_DISALLOWED: 'ai-search',
  AI_USER_FETCH_DISALLOWED: 'user',
  AI_TRAINING_BOTS_DISALLOWED: 'training',
};

function summarize(origin, packages, code, report) {
  if (!report) return { origin, packages, exitCode: code, error: 'no report' };
  // No real audit (unreachable, an error status): no facts either, or every absent finding
  // would read as a pass.
  if (report.exitCode === 3) return { origin, packages, exitCode: 3, error: report.error ?? (report.issues ?? []).find((i) => i.code === 'FETCH_ERROR' || i.code === 'HTTP_ERROR_STATUS')?.title ?? 'no audit' };
  const issues = report.issues ?? [];
  const codes = [...new Set(issues.map((i) => i.code))].sort();
  const has = (c) => codes.includes(c);
  const edgeBlocked = {};
  const robotsDisallowed = {};
  for (const issue of issues) {
    if (EDGE[issue.code]) edgeBlocked[EDGE[issue.code]] = (issue.details?.blocked ?? []).map((b) => `${b.crawler}:${b.challenge ? 'challenge' : b.status}`);
    if (ROBOTS[issue.code]) robotsDisallowed[ROBOTS[issue.code]] = issue.details?.disallowed ?? [];
    if (issue.code === 'AI_BOT_BLOCKED_ALL') robotsDisallowed.all = true;
  }
  return {
    origin,
    packages,
    exitCode: report.exitCode ?? code,
    score: report.score,
    aiReadiness: report.healthScores?.aiReadiness ?? null,
    framework: report.framework ?? null,
    checksRun: report.checksRun,
    counts: {
      errors: issues.filter((i) => i.severity === 'error' || i.severity === 'critical').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
      notices: issues.filter((i) => i.severity === 'notice' || i.severity === 'info').length,
    },
    facts: {
      edgeBlocked,
      robotsDisallowed,
      metadataStreamedForBots: has('METADATA_STREAMED_FOR_BOTS'),
      metadataOutsideHead: has('METADATA_OUTSIDE_HEAD'),
      clientRendered: has('CLIENT_SIDE_RENDERING'),
      llmsTxt: !has('LLMS_TXT_MISSING'),
      sitemap: !has('SITEMAP_MISSING'),
      sitemapLastmodUniform: has('SITEMAP_LASTMOD_UNIFORM'),
      sitemapLastmodMissing: has('SITEMAP_LASTMOD_MISSING'),
      indexNow: !has('INDEXNOW_NOT_IMPLEMENTED'),
      cloudflareAmbiguous: has('CLOUDFLARE_AI_CRAWLER_GATE_AMBIGUOUS'),
      uncitedStatistics: has('AI_UNCITED_STATISTICS'),
    },
    codes,
  };
}

const results = [];
let cliVersion;
let next = 0;
const started = Date.now();
async function worker() {
  while (next < todo.length) {
    const i = next++;
    const { origin, packages } = todo[i];
    const t0 = Date.now();
    const { code, report } = await runAudit(origin);
    const record = summarize(origin, packages, code, report);
    record.ms = Date.now() - t0;
    if (report?.cliVersion) cliVersion ??= report.cliVersion;
    results[i] = record;
    console.error(`${String(i + 1).padStart(3)}/${todo.length} ${origin} score=${record.score ?? '-'} exit=${record.exitCode} ${record.ms}ms`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));

const audited = results.filter((r) => r.facts);
const pct = (n) => `${Math.round((100 * n) / Math.max(audited.length, 1))}%`;
const count = (f) => audited.filter(f).length;
const headlines = {
  sites: todo.length,
  audited: audited.length,
  unreachableOrErrorStatus: results.filter((r) => r.exitCode === 3 || r.error).length,
  edgeRefusesSearchCrawler: count((r) => r.facts.edgeBlocked.search),
  edgeRefusesAiSearchCrawler: count((r) => r.facts.edgeBlocked['ai-search']),
  edgeRefusesUserFetcher: count((r) => r.facts.edgeBlocked.user),
  edgeRefusesTrainingCrawler: count((r) => r.facts.edgeBlocked.training),
  robotsDisallowsAiSearch: count((r) => r.facts.robotsDisallowed['ai-search'] || r.facts.robotsDisallowed.all),
  robotsDisallowsTraining: count((r) => r.facts.robotsDisallowed.training || r.facts.robotsDisallowed.all),
  metadataStreamedForBots: count((r) => r.facts.metadataStreamedForBots),
  clientRendered: count((r) => r.facts.clientRendered),
  llmsTxt: count((r) => r.facts.llmsTxt),
  noSitemap: count((r) => !r.facts.sitemap),
  sitemapLastmodUniform: count((r) => r.facts.sitemapLastmodUniform),
  indexNow: count((r) => r.facts.indexNow),
  medianScore: audited.length ? [...audited].sort((a, b) => a.score - b.score)[Math.floor(audited.length / 2)].score : null,
  frameworks: Object.fromEntries(Object.entries(audited.reduce((m, r) => ((m[r.framework ?? 'unknown'] = (m[r.framework ?? 'unknown'] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1])),
  llmsTxtByFramework: Object.fromEntries(['Docusaurus', 'Astro', 'Vue.js', 'Next.js'].map((f) => [f, [audited.filter((r) => r.framework === f && r.facts.llmsTxt).length, audited.filter((r) => r.framework === f).length]])),
};
const doc = { auditedAt: new Date(started).toISOString(), cliVersion, durationMs: Date.now() - started, headlines, results };
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n');
console.error(`\n${audited.length} of ${todo.length} audited in ${Math.round((Date.now() - started) / 1000)}s -> ${outFile}`);
for (const [k, v] of Object.entries(headlines)) if (typeof v === 'number' && k !== 'sites' && k !== 'audited' && k !== 'medianScore') console.error(`  ${k}: ${v} (${pct(v)})`);
console.error(`  medianScore: ${headlines.medianScore}`);
