import {
  parseFailOn,
  parseBudgets,
  mergeGateSpecs,
  evaluateGate,
  isGated,
  readBaseline,
  diffIssues,
  issueKeys,
  applyIgnores,
  toSarif,
  toJUnit,
  type AuditReport,
  type AuditIssue,
  type GateSpec,
  type GateResult,
  type FailOnLevel,
  type BaselineReport,
  type IssueDiff,
  type IgnoredFinding,
} from '@rankcli/agent-runtime';
export { parseHeaderOptions } from '@rankcli/agent-runtime';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { isLoggedIn, WEB_APP_URL, isApiKeyAuth, getApiKey, getSession, getApiUrl, ensureApiKeyPlan } from '../lib/config.js';
import { showUpsell } from '../lib/upsell.js';
import { VERSION } from '../version.js';
import { runSiteAudit } from '../lib/site-audit.js';
import { resolveAuditSettings, loadBaselineFile, PROJECT_CONFIG_FILE, type AuditSettings } from '../lib/project-config.js';
import { resolveAIProvider, runAIAnalysis, AI_PROVIDERS, AI_PROVIDER_IDS, AI_ENV_KEYS, type AIAnalysis } from '../lib/ai.js';

export interface AuditOptions {
  url?: string;
  /** console (default), json, sarif or junit. */
  output?: string;
  checkLinks?: boolean;
  maxPages?: string;
  ai?: boolean;
  aiProvider?: string;
  aiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  geo?: boolean;
  /** CI gate rules: error | warning | notice, score<80, score:aiReadiness<70 (repeatable, comma-separated). */
  failOn?: string | string[];
  /** CI gate: exit 1 if the overall score is below this (the same as --fail-on score<n). */
  minScore?: string;
  /** A saved JSON report: the severity gate then counts only findings that are not in it. */
  baseline?: string;
  /** "Name: value" headers sent with every request to the site. */
  header?: string[];
  /** "name=value" cookies sent with every request to the site. */
  cookie?: string[];
  /** A build directory to audit, served locally, instead of the live site. */
  dir?: string;
  /** The config file (default: rankcli.config.json in the current directory). */
  config?: string;
}

/**
 * `rankcli audit` exit codes. Documented in `rankcli audit --help` and the
 * CLI README - CI scripts branch on these, so never renumber them.
 */
export const EXIT_CODES = {
  /** Audit completed and no gate tripped. */
  OK: 0,
  /** A gate (--fail-on, --min-score, a budget) tripped. */
  GATE_FAILED: 1,
  /** Bad invocation: missing/invalid --url or --dir, an invalid flag value, an invalid config or baseline file. */
  USAGE: 2,
  /** No real audit: the site was unreachable, the URL answered 4xx/5xx, no page could be analyzed, or an internal error. */
  AUDIT_FAILED: 3,
} as const;

export const OUTPUT_FORMATS = ['console', 'json', 'sarif', 'junit'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export type { GateResult, FailOnLevel };

/** Parse --fail-on / --min-score into a gate spec. Returns an error message for invalid values. */
export function parseGateOptions(options: Pick<AuditOptions, 'failOn' | 'minScore'>): { spec: GateSpec; failOn?: FailOnLevel; minScore?: number; error?: string } {
  const rules = parseFailOn(options.failOn);
  if (rules.error) return { spec: rules.spec, error: `Invalid --fail-on: ${rules.error}` };
  let minScore: number | undefined;
  if (options.minScore !== undefined) {
    const raw = String(options.minScore).trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0 || n > 100) {
      return { spec: rules.spec, error: `Invalid --min-score "${options.minScore}" (use a number from 0 to 100)` };
    }
    minScore = n;
  }
  const spec = mergeGateSpecs(rules.spec, minScore === undefined ? { budgets: [] } : { budgets: [{ category: 'overall', min: minScore }] });
  return { spec, failOn: spec.failOn, minScore: spec.budgets.find(b => b.category === 'overall')?.min };
}

/** The flags and the config file reconciled (flags win); see the engine's resolveAuditSettings. */
export function resolveSettings(options: AuditOptions, cwd: string = process.cwd()): { settings?: AuditSettings; error?: string } {
  return resolveAuditSettings({
    url: options.url,
    dir: options.dir,
    maxPages: options.maxPages,
    checkLinks: options.checkLinks,
    failOn: options.failOn,
    minScore: options.minScore,
    baseline: options.baseline,
    header: options.header,
    cookie: options.cookie,
    config: options.config,
  }, cwd);
}

// Sync results to database for logged in users
async function syncToCloud(
  url: string,
  report: AuditReport,
  mergedIssues: AuditIssue[],
  pagesAudited: number,
  aiAnalysis: AIAnalysis | null,
  durationMs: number,
  checksRun: number,
  /** The detected framework, so the dashboard can show what the CLI already printed. */
  framework?: string
): Promise<{ projectId: string; auditId: string; githubLinked: boolean } | null> {
  // Resolve the caller's own credential rather than requiring a Supabase
  // session specifically - the default login path (browser device-flow,
  // and MCP's rankcli_connect) only ever stores an API key, which
  // getAuthenticatedClient()/RLS can't see, so a direct client-side
  // .from(...) write here silently did nothing for most real users. The
  // sync-audit edge function resolves either credential type itself and
  // does the writes with the service role.
  let authHeader: Record<string, string> | null = null;
  if (isApiKeyAuth()) {
    const apiKey = getApiKey();
    if (apiKey) authHeader = { 'X-API-Key': apiKey };
  } else {
    const session = await getSession();
    if (session) authHeader = { Authorization: `Bearer ${session.access_token}` };
  }
  if (!authHeader) return null;

  const score = report.healthScore?.overall || 0;
  const healthScores = {
    overall: score,
    crawlability: report.healthScore?.crawlability || 0,
    onPage: report.healthScore?.onPage || 0,
    content: report.healthScore?.content || 0,
    performance: report.healthScore?.performance || 0,
    security: report.healthScore?.security || 0,
    localSeo: report.healthScore?.localSeo || 0,
    aiReadiness: report.healthScore?.aiReadiness || 0,
  };

  try {
    const res = await fetch(`${getApiUrl()}/functions/v1/sync-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        url,
        issues: mergedIssues,
        pagesAudited,
        checksRun,
        durationMs,
        healthScores,
        aiAnalysis,
        framework,
      }),
    });

    const data = await res.json() as {
      error?: string;
      count?: number;
      limit?: number;
      projectId?: string;
      auditId?: string;
      githubLinked?: boolean;
    };

    if (!res.ok) {
      // stderr, not stdout: this also runs in --output json mode, where
      // stdout must be exactly one JSON document.
      if (data.error === 'project_limit_reached') {
        console.error(chalk.yellow(`\n⚠️  Project limit reached (${data.count}/${data.limit})`));
        console.error(chalk.dim(`   Upgrade at: ${WEB_APP_URL}/account`));
      } else {
        console.error(chalk.dim(data.error || `Cloud sync failed (HTTP ${res.status})`));
      }
      return null;
    }

    if (!data.projectId || !data.auditId) {
      console.error(chalk.dim('Cloud sync returned an unexpected response'));
      return null;
    }

    return { projectId: data.projectId, auditId: data.auditId, githubLinked: !!data.githubLinked };
  } catch (error) {
    // Say why. This swallowed the reason, so a missing RANKCLI_SUPABASE_URL, an offline
    // machine and a server returning HTML instead of JSON were all the same three words.
    console.error(chalk.dim(`Cloud sync failed: ${error instanceof Error ? error.message : String(error)}`));
    return null;
  }
}

/**
 * The github.com repository this working directory points at, as an https URL, or null.
 * Handles both remote spellings (git@github.com:owner/repo.git and the https form).
 */
function githubRemoteUrl(): string | null {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = remote.match(/github\.com[:/]([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/);
    return match ? `https://github.com/${match[1]}/${match[2]}` : null;
  } catch {
    return null; // not a git repo, no origin, or no git
  }
}

/**
 * After a synced audit, offer to link the repository we are standing in. Asking is the
 * point: linking lets RankCLI open PRs against that repo, which is not something to do
 * to someone silently. Skipped when there is nothing to ask (no remote, already linked)
 * and when nobody can answer (JSON output, CI, no TTY).
 */
async function offerRepoLink(projectId: string): Promise<void> {
  const repoUrl = githubRemoteUrl();
  if (!repoUrl) return;

  console.error('');
  const { link } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'link',
      message: `Link ${repoUrl} to this project? RankCLI can then open SEO fix PRs against it.`,
      default: true,
    },
  ]);
  if (!link) {
    console.error(chalk.dim('  Skipped. Link it any time from the project page.'));
    return;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isApiKeyAuth()) {
    const apiKey = getApiKey();
    if (apiKey) headers['X-API-Key'] = apiKey;
  } else {
    const session = await getSession();
    if (session) headers.Authorization = `Bearer ${session.access_token}`;
  }

  const spinner = ora('Linking repository...').start();
  try {
    const response = await fetch(`${getApiUrl()}/functions/v1/connect-github-repo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId, repoUrl }),
    });
    const result = (await response.json()) as { linked?: boolean; reason?: string; error?: string };
    if (result.linked) {
      spinner.succeed('Repository linked - auto-fix PRs are available for this project.');
    } else {
      // Nothing was saved, so say what to fix rather than claiming success.
      spinner.warn(result.reason || result.error || 'Could not link this repository.');
    }
  } catch (error) {
    spinner.warn(`Could not link this repository: ${error instanceof Error ? error.message : error}`);
  }
}

function printUsage(loggedIn: boolean): void {
  console.error('\n⚠️  Please provide a URL to audit:');
  console.error('   rankcli audit --url https://your-site.com');
  console.error('   rankcli audit --dir dist --url https://your-site.com   (a build directory, before deploying)');
  console.error(`\n   Or run \`rankcli init\` once: the url in ${PROJECT_CONFIG_FILE} is used when --url is omitted.`);
  console.error('\nRun "rankcli audit --help" for every option, exit codes, and AI providers.');
  if (!loggedIn) {
    console.error(chalk.dim('\nTip: Log in to sync results to the web dashboard:'));
    console.error(chalk.dim('   rankcli login'));
  }
  console.error('');
}

/**
 * Run an audit and return the process exit code (see EXIT_CODES). The
 * caller (index.ts) sets process.exitCode - this never calls process.exit,
 * so stdout is always flushed and the function stays testable.
 */
export async function audit(options: AuditOptions): Promise<number> {
  const cwd = process.cwd();
  const format = String(options.output ?? 'console').trim().toLowerCase() as OutputFormat;
  const json = format === 'json';
  const machine = format !== 'console';

  // In machine formats stdout carries exactly one document - including on failure, so
  // `rankcli audit -o json > report.json` never leaves a CI step parsing an empty file.
  let url: string | undefined;
  const fail = (code: number, message: string, extra: Record<string, unknown> = {}): number => {
    if (format === 'json') {
      console.log(JSON.stringify({ url: url ?? null, error: message, exitCode: code, ...extra }, null, 2));
    } else if (format === 'sarif') {
      console.log(JSON.stringify(toSarif({ url: url ?? '', issues: [], toolVersion: VERSION, exitCode: code, error: message }), null, 2));
    } else if (format === 'junit') {
      console.log(toJUnit({ url: url ?? '', issues: [], error: message }));
    } else {
      console.error(`\n❌ ${message}\n`);
    }
    return code;
  };

  // ===== Validate the invocation before doing any work =====
  if (!(OUTPUT_FORMATS as readonly string[]).includes(format)) {
    console.error(`\n❌ Invalid --output "${options.output}" (use ${OUTPUT_FORMATS.join(', ')})\n`);
    return EXIT_CODES.USAGE;
  }

  const resolved = resolveSettings(options, cwd);
  if (resolved.error || !resolved.settings) return fail(EXIT_CODES.USAGE, resolved.error ?? 'Invalid settings');
  const settings = resolved.settings;
  const { spec, maxPages } = settings;
  url = settings.url;
  const fromConfig = !options.url && !!settings.config?.url && url === settings.config.url.trim();

  if (settings.dir) {
    const dir = isAbsolute(settings.dir) ? settings.dir : join(cwd, settings.dir);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return fail(EXIT_CODES.USAGE, `--dir ${settings.dir} is not a directory`);
    if (!url) url = 'http://localhost';
  }

  if (!url) {
    if (machine) return fail(EXIT_CODES.USAGE, 'No URL given - use --url https://your-site.com');
    printUsage(isLoggedIn());
    return EXIT_CODES.USAGE;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('not http(s)');
  } catch {
    return fail(EXIT_CODES.USAGE, `Invalid URL "${url}" - use a full http(s) URL such as https://example.com`);
  }

  if (options.ai && options.aiProvider && !AI_PROVIDERS[options.aiProvider.trim().toLowerCase()]) {
    return fail(EXIT_CODES.USAGE, `Unknown --ai-provider "${options.aiProvider}" (use ${AI_PROVIDER_IDS.join(', ')})`);
  }

  let baseline: (BaselineReport & { file: string }) | undefined;
  if (settings.baselineFile) {
    const read = loadBaselineFile(settings.baselineFile, cwd);
    if (read.error) return fail(EXIT_CODES.USAGE, read.error);
    baseline = read.baseline;
  }

  if (fromConfig) console.error(chalk.dim(`Auditing ${url} (from ${PROJECT_CONFIG_FILE})`));
  if (settings.dir && !options.url && !settings.config?.url) {
    console.error(chalk.dim(`Auditing ${settings.dir} as ${url}. Pass --url https://your-site.com so canonical and sitemap checks compare against your real origin.`));
  }

  try {
    // Check login status
    const loggedIn = isLoggedIn();

    // An API key (RANKCLI_API_KEY in CI, or one saved by `rankcli login`)
    // resolves its own plan - previously only `login --token`/`whoami`
    // wrote the plan, so a CI job exporting RANKCLI_API_KEY audited on the
    // Free tier whatever the account paid for.
    const keyPlan = await ensureApiKeyPlan();
    if (keyPlan?.status === 'invalid') {
      console.error(chalk.yellow(`⚠️  RankCLI API key rejected (${keyPlan.error}) - auditing on the Free tier.`));
    } else if (keyPlan?.status === 'unavailable') {
      console.error(chalk.dim(`(could not verify your RankCLI plan: ${keyPlan.error})`));
    }

    const startTime = Date.now();

    // ===== PHASES 1-2: discover pages and audit them (shared with fix and apply) =====
    const siteResult = await runSiteAudit({
      url,
      maxPages,
      checkLinks: settings.checkLinks,
      dir: settings.dir ? (isAbsolute(settings.dir) ? settings.dir : join(cwd, settings.dir)) : undefined,
      headers: settings.headers,
    });
    if (!siteResult) {
      return fail(EXIT_CODES.AUDIT_FAILED, `Audit failed - could not analyze ${url}`);
    }
    // Exit 3 on an unreachable page or an error status, with or without gate flags, so no CI
    // job goes green on a site that is down.
    const { primaryReport, score, pagesAudited: successCount, pageFailure, framework: frameworkName, checksRun: actualChecksRun } = siteResult;

    // ===== Ignore rules, then the baseline =====
    const ignoreResult = applyIgnores(siteResult.issues, settings.ignore);
    const mergedIssues: AuditIssue[] = ignoreResult.issues;
    const ignored: IgnoredFinding[] = ignoreResult.ignored;
    const diff: IssueDiff | undefined = baseline ? diffIssues(baseline.issues, mergedIssues) : undefined;
    const baselineKeys = baseline ? new Set(baseline.issues.flatMap(issueKeys)) : undefined;
    const isNew = (issue: AuditIssue): boolean => !baselineKeys || issueKeys(issue).some(k => !baselineKeys.has(k));

    // ===== PHASE 3: AI Analysis (optional, never affects the exit code) =====
    let aiAnalysis: AIAnalysis | null = null;
    let aiError: string | undefined;

    if (options.ai && !pageFailure) {
      const resolution = await resolveAIProvider({
        aiProvider: options.aiProvider,
        aiKey: options.aiKey,
        aiModel: options.aiModel,
        aiBaseUrl: options.aiBaseUrl,
      });
      if (!resolution.ok) {
        aiError = resolution.error;
        console.error(chalk.yellow(`\n⚠️  ${resolution.error}`));
        for (const hint of resolution.hints) console.error(chalk.dim(`   ${hint}`));
      } else {
        const { ai } = resolution;
        if (ai.notice) console.error(chalk.dim(ai.notice));
        const aiSpinner = ora(`Running AI analysis (${ai.label}, ${ai.model})...`).start();
        const result = await runAIAnalysis(url, mergedIssues, ai);
        if ('analysis' in result) {
          aiAnalysis = result.analysis;
          aiSpinner.succeed('AI analysis complete');
        } else {
          aiError = result.error;
          aiSpinner.warn(`AI analysis failed: ${result.error}`);
        }
      }
    }

    // ===== PHASE 4: Gate =====
    const healthScores = primaryReport.healthScore ?? { overall: score };
    const gateResult = evaluateGate(spec, diff ? diff.added : mergedIssues, { ...healthScores, overall: score }, { newOnly: !!diff });
    const gated = isGated(spec);
    const exitCode = pageFailure
      ? EXIT_CODES.AUDIT_FAILED
      : gateResult.passed ? EXIT_CODES.OK : EXIT_CODES.GATE_FAILED;

    // ===== PHASE 5: Output results =====
    const totalTime = Date.now() - startTime;
    const baselineSummary = baseline && diff
      ? { file: baseline.file, scoreBefore: baseline.score, added: diff.added, fixed: diff.fixed, unchanged: diff.unchanged }
      : undefined;

    if (format === 'sarif') {
      const files = siteResult.files ?? {};
      console.log(JSON.stringify(toSarif({
        url,
        issues: mergedIssues,
        toolVersion: VERSION,
        score,
        healthScores,
        fileFor: pageUrl => files[pageUrl],
        exitCode,
        error: pageFailure?.title,
        baselineKeys,
      }), null, 2));
      for (const failure of gateResult.failures) console.error(`Gate failed: ${failure}`);
      return exitCode;
    }

    if (format === 'junit') {
      console.log(toJUnit({
        url,
        issues: mergedIssues,
        failOn: spec.failOn,
        isNew: diff ? isNew : undefined,
        checksPassed: primaryReport.summary?.passed ?? 0,
        score,
        durationMs: totalTime,
        timestamp: new Date(startTime).toISOString(),
        gateFailures: gateResult.failures,
        error: pageFailure?.title,
      }));
      for (const failure of gateResult.failures) console.error(`Gate failed: ${failure}`);
      return exitCode;
    }

    if (json) {
      // Sync to cloud for JSON output too (silent, no spinner)
      let syncResult: { projectId: string; auditId: string; githubLinked: boolean } | null = null;
      if (loggedIn) {
        syncResult = await syncToCloud(url, primaryReport, mergedIssues, successCount, aiAnalysis, totalTime, actualChecksRun, frameworkName ?? undefined);
      }

      const jsonOutput = {
        url,
        timestamp: new Date(startTime).toISOString(),
        cliVersion: VERSION,
        score,
        pagesAudited: successCount,
        pages: siteResult.pages,
        discovery: siteResult.discovery,
        checksRun: actualChecksRun,
        checksPassed: primaryReport.summary?.passed ?? 0,
        totalTime,
        framework: frameworkName,
        ...(settings.dir && { dir: settings.dir }),
        ...(settings.configPath && { config: settings.configPath }),
        issues: mergedIssues,
        ...(ignored.length > 0 && { ignored }),
        ...(baselineSummary && { baseline: baselineSummary }),
        healthScores: primaryReport.healthScore,
        aiAnalysis,
        ...(aiError && { aiError }),
        ...(pageFailure && { error: pageFailure.title }),
        ...(gated && { gate: gateResult }),
        exitCode,
        // Include cloud sync info if synced
        ...(syncResult && {
          projectId: syncResult.projectId,
          auditId: syncResult.auditId,
          dashboardUrl: `${WEB_APP_URL}/dashboard/projects/${syncResult.projectId}`,
        }),
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      if (!gateResult.passed) {
        for (const failure of gateResult.failures) console.error(`Gate failed: ${failure}`);
      }
    } else {
      // Console output
      console.log('\n' + chalk.bold('═'.repeat(60)));
      console.log(chalk.bold.cyan(`  SEO AUDIT REPORT: ${url}`));
      console.log(chalk.bold('═'.repeat(60)));

      // Score
      const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
      const delta = baseline?.score !== undefined ? ` ${chalk.dim(`(baseline ${baseline.score}, ${score - baseline.score >= 0 ? '+' : ''}${score - baseline.score})`)}` : '';
      console.log(`\n  ${chalk.bold('Score:')} ${scoreColor.bold(score + '/100')}${delta}`);

      // Stats
      console.log(`  ${chalk.bold('Pages audited:')} ${successCount}${siteResult.discovery.source === 'sitemap' ? chalk.dim(' (from the sitemap)') : ''}`);
      console.log(`  ${chalk.bold('Issues found:')} ${mergedIssues.length}${ignored.length ? chalk.dim(` (${ignored.length} ignored by ${PROJECT_CONFIG_FILE})`) : ''}`);
      console.log(`  ${chalk.bold('Time:')} ${totalTime}ms`);
      if (frameworkName) {
        console.log(`  ${chalk.bold('Framework:')} ${chalk.cyan(frameworkName)}`);
      }
      if (settings.dir) {
        console.log(`  ${chalk.bold('Source:')} ${settings.dir} ${chalk.dim('(build directory; host checks skipped)')}`);
      }

      // Health scores
      if (primaryReport.healthScore) {
        console.log('\n' + chalk.bold('  Health Scores:'));
        const hs = primaryReport.healthScore;
        const bar = (score: number) => {
          const filled = Math.round(score / 5);
          const empty = 20 - filled;
          const color = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
          return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
        };
        console.log(`    Crawlability:  ${bar(hs.crawlability || 0)} ${hs.crawlability || 0}%`);
        console.log(`    On-Page:       ${bar(hs.onPage || 0)} ${hs.onPage || 0}%`);
        console.log(`    Content:       ${bar(hs.content || 0)} ${hs.content || 0}%`);
        console.log(`    Performance:   ${bar(hs.performance || 0)} ${hs.performance || 0}%`);
        console.log(`    Security:      ${bar(hs.security || 0)} ${hs.security || 0}%`);
        console.log(`    Local SEO:     ${bar(hs.localSeo || 0)} ${hs.localSeo || 0}%`);
        console.log(`    AI Readiness:  ${bar(hs.aiReadiness || 0)} ${hs.aiReadiness || 0}%`);
      }

      // Issues by severity
      const errors = mergedIssues.filter(i => i.severity === 'error' || i.severity === 'critical');
      const warnings = mergedIssues.filter(i => i.severity === 'warning');
      const notices = mergedIssues.filter(i => i.severity === 'notice' || i.severity === 'info');

      console.log('\n' + chalk.bold('  Issues by Severity:'));
      console.log(`    ${chalk.red('●')} Errors:   ${errors.length}`);
      console.log(`    ${chalk.yellow('●')} Warnings: ${warnings.length}`);
      console.log(`    ${chalk.blue('●')} Notices:  ${notices.length}`);

      // Every issue, grouped by severity, each with its code. A "Top 10" used to hide the
      // other 40 to 80 findings with no flag to show them; the only way to see what was
      // counted was -o json.
      const icon = (issue: AuditIssue) => issue.severity === 'error' || issue.severity === 'critical' ? chalk.red('✗') : issue.severity === 'warning' ? chalk.yellow('!') : chalk.blue('i');
      const printGroup = (label: string, items: AuditIssue[], pages = true) => {
        if (items.length === 0) return;
        console.log('\n' + chalk.bold(`  ${label} (${items.length}):`));
        for (const issue of items) {
          console.log(`    ${icon(issue)} ${issue.title}  ${chalk.dim(issue.code)}`);
          if (pages && issue.affectedUrls && issue.affectedUrls.length > 1) {
            console.log(chalk.dim(`      affects ${issue.affectedUrls.length} pages`));
          }
        }
      };

      if (diff && baseline) {
        console.log('\n' + chalk.bold(`  Since baseline ${baseline.file}:`) + ` ${diff.added.length} new, ${diff.fixed.length} fixed, ${diff.unchanged} unchanged`);
        printGroup('New since baseline', diff.added);
        if (diff.fixed.length > 0) {
          console.log('\n' + chalk.bold(`  Fixed since baseline (${diff.fixed.length}):`));
          for (const issue of diff.fixed) console.log(`    ${chalk.green('✓')} ${issue.title}  ${chalk.dim(issue.code)}`);
        }
      }
      printGroup('Errors', errors);
      printGroup('Warnings', warnings);
      printGroup('Notices', notices);
      if (mergedIssues.length > 0) {
        console.log(chalk.dim(`\n  Description, impact and fix for each issue: rankcli audit -u ${url} -o json`));
      }

      // AI Analysis
      if (aiAnalysis) {
        console.log('\n' + chalk.bold('  AI Analysis:'));
        console.log(`    Content Score: ${aiAnalysis.contentScore}/100`);
        console.log('\n    ' + chalk.bold('Suggestions:'));
        aiAnalysis.suggestions.forEach((s, i) => {
          console.log(`    ${i + 1}. ${s}`);
        });

        if (aiAnalysis.prioritizedFixes?.length > 0) {
          console.log('\n    ' + chalk.bold('Priority Fixes:'));
          aiAnalysis.prioritizedFixes.slice(0, 5).forEach((fix, i) => {
            console.log(`    ${i + 1}. [P${fix.priority}] ${fix.code}`);
            console.log(chalk.dim(`       ${fix.rationale}`));
          });
        }
      }

      // Gate
      if (gated) {
        console.log('');
        if (gateResult.passed) {
          const rules = [
            ...(spec.failOn ? [`fail-on ${spec.failOn}${diff ? ', new issues only' : ''}`] : []),
            ...spec.budgets.map(b => `${b.category === 'overall' ? 'score' : `${b.category} score`} ≥ ${b.min}`),
          ].join('; ');
          console.log(chalk.green(`  ✓ CI gate passed (${rules})`));
        } else {
          for (const failure of gateResult.failures) console.log(chalk.red(`  ✗ CI gate failed: ${failure}`));
        }
      }

      console.log('\n' + chalk.bold('═'.repeat(60)));

      // Sync to cloud if logged in
      if (loggedIn) {
        const syncSpinner = ora('Syncing to cloud...').start();
        const syncResult = await syncToCloud(url, primaryReport, mergedIssues, successCount, aiAnalysis, totalTime, actualChecksRun, frameworkName ?? undefined);

        if (syncResult) {
          syncSpinner.succeed('Results synced to cloud');
          console.log(chalk.cyan(`\n  View and manage issues in the web dashboard:`));
          console.log(chalk.bold(`  ${WEB_APP_URL}/dashboard/projects/${syncResult.projectId}\n`));

          // Standing in the repository this site is built from is the one moment linking
          // it is obvious, so ask here - but only where a human can answer.
          const interactive = process.stdout.isTTY && !process.env.CI;
          if (!syncResult.githubLinked && interactive) {
            await offerRepoLink(syncResult.projectId);
          }
        } else {
          syncSpinner.warn('Could not sync to cloud');
        }
      } else if (!gated && !process.env.CI) {
        // The account box, for a person at a terminal: not under a CI gate, not in CI.
        showUpsell('free_audit_complete');
      }

      if (pageFailure) {
        console.error(chalk.red(`\n❌ ${pageFailure.title}: ${pageFailure.description}\n`));
      }
    }

    return exitCode;
  } catch (error) {
    return fail(EXIT_CODES.AUDIT_FAILED, `Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/** Help text appended to `rankcli audit --help`. Kept here beside EXIT_CODES. */
export const AUDIT_HELP_TEXT = `
Exit codes:
  0  audit completed; no gate tripped
  1  a gate tripped (--fail-on, --min-score, a budget in rankcli.config.json)
  2  bad invocation (missing/invalid --url or --dir, invalid flag value,
     invalid config or baseline file)
  3  no real audit: site unreachable, the URL answered 4xx/5xx, no page
     could be analyzed, or an internal error

CI gating (opt-in; without a rule any completed audit exits 0):
  --fail-on error               fail on any error
  --fail-on warning             fail on any warning or error
  --fail-on notice              fail on any issue at all
  --fail-on score<80            fail if the overall score is below 80 (= --min-score 80)
  --fail-on score:aiReadiness<70
                                fail if a category score is below 70 (overall, crawlability,
                                indexability, onPage, content, links, performance, security,
                                aiReadiness, social, localSeo, accessibility)
  Rules combine: --fail-on error,score<80 or the flag repeated.
  --baseline report.json        count only issues that are not in this saved report, so an
                                existing site adopts the gate without first fixing every
                                old finding (save one with: rankcli audit -o json > report.json)

Output (-o): console, json, sarif (GitHub Code Scanning), junit (test reporters).
  Every machine format is one document on stdout, on failure too.

Protected previews: --header "Authorization: Bearer ..." --cookie "session=..."
  Sent only to the audited site (and its www. twin), never anywhere else.

Build output: --dir dist --url https://your-site.com
  Serves the directory locally and audits it as the site, before anything is deployed.
  Host checks (TLS, security and caching headers, redirects, crawler access) are skipped.

Config: rankcli.config.json in the current directory (or --config <file>) sets url,
  maxPages, checkLinks, failOn, minScore, budgets, baseline, ignore, headers and dir.
  Flags win over the file. See the README for the ignore rules.

AI analysis (--ai) runs on your own provider. Hosted: ${Object.entries(AI_PROVIDERS)
  .filter(([, p]) => !p.local)
  .map(([id]) => id)
  .join(', ')}.
  Picked automatically from the first key found in:
    ${AI_ENV_KEYS.join(', ')}
  (OpenRouter first). No key at all? A running local Ollama is used.
  Local: --ai-provider ollama | lmstudio | llamacpp | vllm (no key needed;
  the loaded model is used unless you pass --ai-model), or any
  OpenAI-compatible server: --ai-base-url http://host:port/v1 --ai-model <name>

Examples:
  rankcli audit --url https://example.com
  rankcli audit --url https://example.com --fail-on error --min-score 80
  rankcli audit --url https://example.com --fail-on error --baseline .rankcli/baseline.json
  rankcli audit --url https://example.com -o json > report.json
  rankcli audit --url https://example.com -o sarif > rankcli.sarif
  rankcli audit --dir dist --url https://example.com --fail-on error
  rankcli audit --url https://preview.example.com --header "x-vercel-protection-bypass: $BYPASS"
  rankcli audit --url https://example.com --ai --ai-provider deepseek
  rankcli audit --url https://example.com --ai --ai-provider ollama --ai-model qwen3:8b
`;
