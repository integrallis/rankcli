import { runFullAudit, discoverPagesFromLinks, frameworks, type AuditReport, type AuditIssue } from '@rankcli/agent-runtime';
import ora from 'ora';
import chalk from 'chalk';

const { detectFramework, getFrameworkDisplayName } = frameworks;
import { isLoggedIn, getUserInfo, getDecryptPassphrase, WEB_APP_URL, isApiKeyAuth, getApiKey, getSession, getApiUrl, ensureApiKeyPlan } from '../lib/config.js';
import { showUpsell, TIER_LIMITS, tierFromPlanId, type TierId } from '../lib/upsell.js';
import { initEngine, getPremiumChecks, type PremiumChecks } from '../wasm-engine.js';
import { resolveAIProvider, runAIAnalysis, AI_PROVIDERS, AI_PROVIDER_IDS, AI_ENV_KEYS, type AIAnalysis } from '../lib/ai.js';

export interface AuditOptions {
  url?: string;
  output?: string;
  checkLinks?: boolean;
  maxPages?: string;
  ai?: boolean;
  aiProvider?: string;
  aiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;
  geo?: boolean;
  /** CI gate: exit 1 if any issue is at or above this severity. */
  failOn?: string;
  /** CI gate: exit 1 if the overall score is below this. */
  minScore?: string;
}

/**
 * `rankcli audit` exit codes. Documented in `rankcli audit --help` and the
 * CLI README - CI scripts branch on these, so never renumber them.
 */
export const EXIT_CODES = {
  /** Audit completed and no --fail-on / --min-score gate tripped. */
  OK: 0,
  /** A --fail-on or --min-score gate tripped. */
  GATE_FAILED: 1,
  /** Bad invocation: missing/invalid --url or an invalid flag value. */
  USAGE: 2,
  /** No real audit: the site was unreachable, the URL answered 4xx/5xx, no page could be analyzed, or an internal error. */
  AUDIT_FAILED: 3,
} as const;

export const FAIL_ON_LEVELS = ['error', 'warning', 'notice'] as const;
export type FailOnLevel = (typeof FAIL_ON_LEVELS)[number];

// 'critical' and 'info' exist in the runtime's severity type as well.
const SEVERITY_RANK: Record<string, number> = { critical: 4, error: 3, warning: 2, notice: 1, info: 1 };

export interface GateResult {
  failOn?: FailOnLevel;
  minScore?: number;
  passed: boolean;
  failures: string[];
}

/** Evaluate the CI gates against the audit's merged issues and overall score. */
export function evaluateGate(issues: AuditIssue[], score: number, failOn?: FailOnLevel, minScore?: number): GateResult {
  const failures: string[] = [];
  if (failOn) {
    const threshold = SEVERITY_RANK[failOn];
    const hits = issues.filter(i => (SEVERITY_RANK[i.severity] ?? 0) >= threshold);
    if (hits.length > 0) {
      const counts = new Map<string, number>();
      for (const i of hits) counts.set(i.severity, (counts.get(i.severity) || 0) + 1);
      const breakdown = [...counts.entries()]
        .sort((a, b) => (SEVERITY_RANK[b[0]] ?? 0) - (SEVERITY_RANK[a[0]] ?? 0))
        .map(([severity, n]) => `${n} ${severity}`)
        .join(', ');
      failures.push(`${hits.length} issue${hits.length === 1 ? '' : 's'} at or above --fail-on ${failOn} (${breakdown})`);
    }
  }
  if (minScore !== undefined && score < minScore) {
    failures.push(`score ${score} is below --min-score ${minScore}`);
  }
  return { failOn, minScore, passed: failures.length === 0, failures };
}

/** Parse --fail-on / --min-score. Returns an error message for invalid values. */
export function parseGateOptions(options: Pick<AuditOptions, 'failOn' | 'minScore'>): { failOn?: FailOnLevel; minScore?: number; error?: string } {
  let failOn: FailOnLevel | undefined;
  let minScore: number | undefined;
  if (options.failOn !== undefined) {
    const level = String(options.failOn).trim().toLowerCase();
    if (!(FAIL_ON_LEVELS as readonly string[]).includes(level)) {
      return { error: `Invalid --fail-on "${options.failOn}" (use ${FAIL_ON_LEVELS.join(', ')})` };
    }
    failOn = level as FailOnLevel;
  }
  if (options.minScore !== undefined) {
    const raw = String(options.minScore).trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0 || n > 100) {
      return { error: `Invalid --min-score "${options.minScore}" (use a number from 0 to 100)` };
    }
    minScore = n;
  }
  return { failOn, minScore };
}

/**
 * Fetch HTML content from a URL
 */
async function fetchHtml(url: string, timeout = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RankCLI-Bot/1.0 (+https://rankcli.dev/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Merge issues from multiple pages, aggregating affected URLs. When pages
 * report the same code at different severities (noindex is an error on the
 * audited root, a warning elsewhere) the most severe wins.
 */
function mergeIssues(issueArrays: AuditIssue[][]): AuditIssue[] {
  const issueMap = new Map<string, AuditIssue>();

  for (const issues of issueArrays) {
    for (const issue of issues) {
      const existing = issueMap.get(issue.code);
      if (existing) {
        const urls = new Set([...(existing.affectedUrls || []), ...(issue.affectedUrls || [])]);
        existing.affectedUrls = Array.from(urls);
        if ((SEVERITY_RANK[issue.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) {
          existing.severity = issue.severity;
        }
      } else {
        issueMap.set(issue.code, { ...issue });
      }
    }
  }

  return Array.from(issueMap.values());
}

// Sync results to database for logged in users
async function syncToCloud(
  url: string,
  report: AuditReport,
  mergedIssues: AuditIssue[],
  pagesAudited: number,
  aiAnalysis: AIAnalysis | null,
  durationMs: number,
  checksRun: number
): Promise<{ projectId: string; auditId: string } | null> {
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
      }),
    });

    const data = await res.json() as {
      error?: string;
      count?: number;
      limit?: number;
      projectId?: string;
      auditId?: string;
    };

    if (!res.ok) {
      // stderr, not stdout: this also runs in --output json mode, where
      // stdout must be exactly one JSON document.
      if (data.error === 'project_limit_reached') {
        console.error(chalk.yellow(`\n⚠️  Project limit reached (${data.count}/${data.limit})`));
        console.error(chalk.dim(`   Upgrade at: ${WEB_APP_URL}/account`));
      } else {
        console.error(chalk.dim(data.error || 'Cloud sync failed'));
      }
      return null;
    }

    if (!data.projectId || !data.auditId) {
      console.error(chalk.dim('Cloud sync returned an unexpected response'));
      return null;
    }

    return { projectId: data.projectId, auditId: data.auditId };
  } catch (error) {
    console.error(chalk.dim('Cloud sync failed'));
    return null;
  }
}

function printUsage(loggedIn: boolean): void {
  console.error('\n⚠️  Please provide a URL to audit:');
  console.error('   rankcli audit --url https://your-site.com');
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
  const url = options.url;
  const json = options.output === 'json';
  // In JSON mode stdout carries exactly one JSON document - including on
  // failure, so `rankcli audit -o json > report.json` never leaves a CI
  // step parsing an empty file.
  const fail = (code: number, message: string, extra: Record<string, unknown> = {}): number => {
    if (json) {
      console.log(JSON.stringify({ url: url ?? null, error: message, exitCode: code, ...extra }, null, 2));
    } else {
      console.error(`\n❌ ${message}\n`);
    }
    return code;
  };

  // ===== Validate the invocation before doing any work =====
  const gate = parseGateOptions(options);
  if (gate.error) return fail(EXIT_CODES.USAGE, gate.error);

  if (!url) {
    if (json) return fail(EXIT_CODES.USAGE, 'No URL given - use --url https://your-site.com');
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

  const maxPages = Math.max(1, parseInt(options.maxPages || '5', 10) || 5);

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

    // Real entitlement: planId comes from validate-api-key (or the session's
    // subscription row) - not anything a user chose. An unrecognized plan
    // falls back to the registered/anonymous free tiers, never to paid.
    const { planId } = getUserInfo();
    const tierId: TierId = tierFromPlanId(planId) ?? (loggedIn ? 'free' : 'free_anon');
    const checksLimit: number = TIER_LIMITS[tierId].checks;

    // Only paid tiers get premium checks, and only if this build actually
    // has a decrypt passphrase embedded (local/dev builds may not). A
    // decrypt failure here falls back to running without premium checks
    // rather than failing the whole audit.
    let premiumChecks: PremiumChecks | undefined;
    if (checksLimit > TIER_LIMITS.free.checks) {
      const passphrase = getDecryptPassphrase();
      if (passphrase) {
        try {
          await initEngine(passphrase);
          premiumChecks = await getPremiumChecks();
        } catch (error) {
          console.error(chalk.dim(`(premium checks unavailable: ${error instanceof Error ? error.message : error})`));
        }
      }
    }

    const startTime = Date.now();

    // ===== PHASE 1: Discover pages =====
    const discoverySpinner = ora('Discovering pages...').start();
    let pagesToAudit: string[] = [url];

    const homepageHtml = await fetchHtml(url, 10000);
    let detectedFramework = detectFramework({});

    if (homepageHtml) {
      // Detect framework from HTML
      detectedFramework = detectFramework({ html: homepageHtml });

      const discovered = discoverPagesFromLinks(url, homepageHtml, maxPages - 1);
      const additionalPages = discovered.map(p => p.url).filter(u => u !== url);
      pagesToAudit = [url, ...additionalPages];

      const frameworkLabel = detectedFramework.framework !== 'unknown'
        ? ` (${getFrameworkDisplayName(detectedFramework.framework)})`
        : '';
      discoverySpinner.succeed(`Discovered ${pagesToAudit.length} pages to audit${frameworkLabel}`);
    } else {
      discoverySpinner.warn('Could not fetch homepage, auditing URL only');
    }

    // ===== PHASE 2: Audit pages in parallel =====
    const auditSpinner = ora(`Auditing ${pagesToAudit.length} pages in parallel...`).start();

    const auditPage = async (pageUrl: string, index: number): Promise<{
      report: AuditReport | null;
      url: string;
    }> => {
      try {
        const report = await runFullAudit({
          url: pageUrl,
          auditRootUrl: url,
          maxPages: 1,
          checkBrokenLinks: options.checkLinks || false,
          // Bundled with --check-links: both mean "verify actual link
          // targets, which costs real requests" - hreflang reciprocity and
          // broken-target checks were previously unreachable from any real
          // caller since nothing ever set this true.
          checkHreflangUrls: options.checkLinks || false,
          checksLimit,
          premiumChecks,
        });
        auditSpinner.text = `Auditing pages... (${index + 1}/${pagesToAudit.length} complete)`;
        return { report, url: pageUrl };
      } catch (error) {
        return { report: null, url: pageUrl };
      }
    };

    const parallelStart = Date.now();
    const auditResults = await Promise.allSettled(
      pagesToAudit.map((pageUrl, index) => auditPage(pageUrl, index))
    );
    const parallelTime = Date.now() - parallelStart;

    // Collect results
    const allIssues: AuditIssue[][] = [];
    let primaryReport: AuditReport | null = null;
    let successCount = 0;

    for (let i = 0; i < auditResults.length; i++) {
      const result = auditResults[i];
      if (result.status === 'fulfilled' && result.value.report) {
        allIssues.push(result.value.report.issues);
        if (i === 0) {
          primaryReport = result.value.report;
        }
        successCount++;
      }
    }

    if (!primaryReport) {
      auditSpinner.fail('Audit failed - could not analyze any pages');
      return fail(EXIT_CODES.AUDIT_FAILED, `Audit failed - could not analyze ${url}`);
    }

    // The engine reports an unreachable page (FETCH_ERROR) or an error
    // status (HTTP_ERROR_STATUS) as an issue and zeroes the score. That's
    // a result worth printing, but not a completed audit: exit 3 so no CI
    // job goes green on a site that is down - with or without gate flags.
    const pageFailure = primaryReport.issues.find(i => i.code === 'FETCH_ERROR' || i.code === 'HTTP_ERROR_STATUS');

    if (pageFailure) {
      auditSpinner.fail(`Could not audit ${url}: ${pageFailure.title}`);
    } else {
      auditSpinner.succeed(`Audited ${successCount}/${pagesToAudit.length} pages in ${parallelTime}ms`);
    }

    // Merge issues from all pages. Framework-specific issues (React/Next.js/
    // WordPress/etc recipes) come from runFullAudit itself now - engine.ts
    // runs the same getFrameworkIssues() this used to call separately here,
    // so server-side audits (free-audit, run-audit) get them too.
    const mergedIssues = mergeIssues(allIssues);
    const score = primaryReport.healthScore?.overall || 0;

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
    const gateResult = evaluateGate(mergedIssues, score, gate.failOn, gate.minScore);
    const gated = gate.failOn !== undefined || gate.minScore !== undefined;
    const exitCode = pageFailure
      ? EXIT_CODES.AUDIT_FAILED
      : gateResult.passed ? EXIT_CODES.OK : EXIT_CODES.GATE_FAILED;

    // ===== PHASE 5: Output results =====
    const totalTime = Date.now() - startTime;

    // Determine framework info for output
    const frameworkName = detectedFramework.framework !== 'unknown'
      ? getFrameworkDisplayName(detectedFramework.framework)
      : null;

    // Calculate actual checks run from report summary (used for both output modes)
    const actualChecksRun = (primaryReport.summary?.passed || 0) +
                            (primaryReport.summary?.errors || 0) +
                            (primaryReport.summary?.warnings || 0) || 200;

    if (json) {
      // Sync to cloud for JSON output too (silent, no spinner)
      let syncResult: { projectId: string; auditId: string } | null = null;
      if (loggedIn) {
        syncResult = await syncToCloud(url, primaryReport, mergedIssues, successCount, aiAnalysis, totalTime, actualChecksRun);
      }

      const jsonOutput = {
        url,
        score,
        pagesAudited: successCount,
        totalTime,
        framework: frameworkName,
        issues: mergedIssues,
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
      console.log(`\n  ${chalk.bold('Score:')} ${scoreColor.bold(score + '/100')}`);

      // Stats
      console.log(`  ${chalk.bold('Pages audited:')} ${successCount}`);
      console.log(`  ${chalk.bold('Issues found:')} ${mergedIssues.length}`);
      console.log(`  ${chalk.bold('Time:')} ${totalTime}ms`);
      if (frameworkName) {
        console.log(`  ${chalk.bold('Framework:')} ${chalk.cyan(frameworkName)}`);
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

      // Top issues
      console.log('\n' + chalk.bold('  Top Issues:'));
      const topIssues = [...errors, ...warnings, ...notices].slice(0, 10);
      topIssues.forEach((issue, i) => {
        const icon = issue.severity === 'error' || issue.severity === 'critical' ? chalk.red('✗') :
                     issue.severity === 'warning' ? chalk.yellow('!') : chalk.blue('i');
        console.log(`    ${i + 1}. ${icon} ${issue.title}`);
        if (issue.affectedUrls && issue.affectedUrls.length > 1) {
          console.log(chalk.dim(`       Affects ${issue.affectedUrls.length} pages`));
        }
      });

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
          console.log(chalk.green(`  ✓ CI gate passed${gate.failOn ? ` (--fail-on ${gate.failOn})` : ''}${gate.minScore !== undefined ? ` (--min-score ${gate.minScore})` : ''}`));
        } else {
          for (const failure of gateResult.failures) console.log(chalk.red(`  ✗ CI gate failed: ${failure}`));
        }
      }

      console.log('\n' + chalk.bold('═'.repeat(60)));

      const isFreeTier = tierId === 'free' || tierId === 'free_anon';

      // Show checks limit message for free users
      if (isFreeTier) {
        const checksRun = mergedIssues.length > 0 ? (loggedIn ? 100 : 50) : 0;
        showUpsell('checks_limit', {
          tier: loggedIn ? 'free' : 'free_anon',
          current: checksRun
        });
      }

      // Show GEO limited message if --geo was used on free tier
      if (options.geo && isFreeTier) {
        showUpsell('geo_limited', { tier: loggedIn ? 'free' : 'free_anon' });
      }

      // Sync to cloud if logged in
      if (loggedIn) {
        const syncSpinner = ora('Syncing to cloud...').start();
        const syncResult = await syncToCloud(url, primaryReport, mergedIssues, successCount, aiAnalysis, totalTime, actualChecksRun);

        if (syncResult) {
          syncSpinner.succeed('Results synced to cloud');
          console.log(chalk.cyan(`\n  View and manage issues in the web dashboard:`));
          console.log(chalk.bold(`  ${WEB_APP_URL}/dashboard/projects/${syncResult.projectId}\n`));
        } else {
          syncSpinner.warn('Could not sync to cloud');
        }
      } else {
        // Show upsell for non-authenticated users
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
  0  audit completed; no --fail-on / --min-score gate tripped
  1  a --fail-on or --min-score gate tripped
  2  bad invocation (missing/invalid --url, invalid flag value)
  3  no real audit: site unreachable, the URL answered 4xx/5xx, no page
     could be analyzed, or an internal error

CI gating (both opt-in; without them any completed audit exits 0):
  --fail-on error     fail on any error
  --fail-on warning   fail on any warning or error
  --fail-on notice    fail on any issue at all
  --min-score 80      fail if the overall score is below 80

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
  rankcli audit --url https://example.com -o json > report.json
  rankcli audit --url https://example.com --ai --ai-provider deepseek
  rankcli audit --url https://example.com --ai --ai-provider ollama --ai-model qwen3:8b
`;
