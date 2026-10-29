/**
 * The one audit pipeline behind `rankcli audit`, `rankcli fix` and `rankcli apply`.
 *
 * Each command used to run its own: `audit` ran the full engine with the premium checks,
 * `apply` ran the engine without them, and `fix` ran a small fixable-issues scan. The same
 * URL scored 85, 93 and 100 inside a minute, and `fix` told a user with 13 warnings that the
 * site looked great. Now there is one score, computed one way.
 */
import {
  runFullAudit,
  discoverPagesFromLinks,
  frameworks,
  metaRefreshTarget,
  type AuditReport,
  type AuditIssue,
} from '@rankcli/agent-runtime';
import ora from 'ora';
import chalk from 'chalk';
import { getUserInfo, isLoggedIn, getDecryptPassphrase } from './config.js';
import { TIER_LIMITS, tierFromPlanId, type TierId } from './upsell.js';
import { initEngine, getPremiumChecks, type PremiumChecks } from '../wasm-engine.js';

const { detectFramework, getFrameworkDisplayName } = frameworks;

export interface SiteAuditOptions {
  url: string;
  /** Pages to audit, counting the URL itself; 1 audits the URL alone. */
  maxPages: number;
  /** Verify link targets (broken links, hreflang reciprocity): real requests, so opt-in. */
  checkLinks?: boolean;
}

export interface SiteAuditResult {
  /** The report for the URL itself; the scores come from here. */
  primaryReport: AuditReport;
  /** Every audited page's issues, merged by code: what the CLI prints, gates on and fixes. */
  issues: AuditIssue[];
  score: number;
  pagesAudited: number;
  pagesDiscovered: number;
  framework: string | null;
  /** Set when the URL itself could not be audited (unreachable, or an error status). */
  pageFailure?: AuditIssue;
  checksRun: number;
  /** Wall time of the page audits. */
  auditMs: number;
}

// 'critical' and 'info' exist in the runtime's severity type as well.
const SEVERITY_RANK: Record<string, number> = { critical: 4, error: 3, warning: 2, notice: 1, info: 1 };

/**
 * Fetch a page's HTML, following an instant meta refresh the way the engine does, so page
 * discovery starts from the real page and not from an 80-byte redirect stub.
 */
export async function fetchHtml(url: string, timeout = 10000): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let html: string | null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(current, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RankCLI-Bot/1.0 (+https://rankcli.dev/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      html = await response.text();
    } catch {
      return null;
    }
    const target = metaRefreshTarget(html, current);
    if (!target) return html;
    current = target;
  }
  return null;
}

/**
 * Merge issues from several pages, aggregating affected URLs. When pages report the same
 * code at different severities (noindex is an error on the audited root, a warning elsewhere)
 * the most severe wins.
 */
export function mergeIssues(issueArrays: AuditIssue[][]): AuditIssue[] {
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

/**
 * Audit a site: discover pages from the URL, audit them in parallel with the caller's tier
 * and the premium checks, and merge the result. Returns null when no page could be analyzed.
 * Progress goes to stderr through spinners; nothing is written to stdout.
 */
export async function runSiteAudit(options: SiteAuditOptions): Promise<SiteAuditResult | null> {
  const { url } = options;
  const maxPages = Math.max(1, options.maxPages);

  // Real entitlement: planId comes from validate-api-key (or the session's subscription row),
  // not anything a user chose. An unrecognized plan falls back to the registered/anonymous
  // free tiers, never to paid. Callers that accept RANKCLI_API_KEY run ensureApiKeyPlan() first.
  const { planId } = getUserInfo();
  const tierId: TierId = tierFromPlanId(planId) ?? (isLoggedIn() ? 'free' : 'free_anon');
  const checksLimit: number = TIER_LIMITS[tierId].checks;

  // Every plan runs the premium checks (they're part of the 280), if this build actually has a
  // decrypt passphrase embedded (local/dev builds may not). A decrypt failure falls back to
  // running without them rather than failing the whole audit.
  let premiumChecks: PremiumChecks | undefined;
  const passphrase = getDecryptPassphrase();
  if (passphrase) {
    try {
      await initEngine(passphrase);
      premiumChecks = await getPremiumChecks();
    } catch (error) {
      console.error(chalk.dim(`(premium checks unavailable: ${error instanceof Error ? error.message : error})`));
    }
  }

  // ===== Discover pages =====
  const discoverySpinner = ora('Discovering pages...').start();
  let pagesToAudit: string[] = [url];
  const homepageHtml = await fetchHtml(url, 10000);
  let detectedFramework = detectFramework({});

  if (homepageHtml) {
    detectedFramework = detectFramework({ html: homepageHtml });
    const discovered = discoverPagesFromLinks(url, homepageHtml, maxPages - 1);
    const additionalPages = discovered.map(p => p.url).filter(u => u !== url);
    pagesToAudit = [url, ...additionalPages];
    const frameworkLabel = detectedFramework.framework !== 'unknown'
      ? ` (${getFrameworkDisplayName(detectedFramework.framework)})`
      : '';
    discoverySpinner.succeed(`Discovered ${pagesToAudit.length} page${pagesToAudit.length === 1 ? '' : 's'} to audit${frameworkLabel}`);
  } else {
    discoverySpinner.warn('Could not fetch homepage, auditing URL only');
  }

  // ===== Audit pages in parallel =====
  const auditSpinner = ora(`Auditing ${pagesToAudit.length} page${pagesToAudit.length === 1 ? '' : 's'}...`).start();

  const auditPage = async (pageUrl: string, index: number): Promise<AuditReport | null> => {
    try {
      const report = await runFullAudit({
        url: pageUrl,
        auditRootUrl: url,
        maxPages: 1,
        checkBrokenLinks: options.checkLinks || false,
        // Bundled with --check-links: both mean "verify actual link targets, which costs real
        // requests".
        checkHreflangUrls: options.checkLinks || false,
        checksLimit,
        premiumChecks,
      });
      auditSpinner.text = `Auditing pages... (${index + 1}/${pagesToAudit.length} complete)`;
      return report;
    } catch {
      return null;
    }
  };

  const started = Date.now();
  const results = await Promise.allSettled(pagesToAudit.map((pageUrl, index) => auditPage(pageUrl, index)));
  const auditMs = Date.now() - started;

  const allIssues: AuditIssue[][] = [];
  let primaryReport: AuditReport | null = null;
  let pagesAudited = 0;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      allIssues.push(result.value.issues);
      if (i === 0) primaryReport = result.value;
      pagesAudited++;
    }
  });

  if (!primaryReport) {
    auditSpinner.fail('Audit failed - could not analyze any pages');
    return null;
  }
  const primary: AuditReport = primaryReport;

  // The engine reports an unreachable page (FETCH_ERROR) or an error status (HTTP_ERROR_STATUS)
  // as an issue and zeroes the score. That's a result worth printing, but not a completed audit.
  const pageFailure = primary.issues.find(i => i.code === 'FETCH_ERROR' || i.code === 'HTTP_ERROR_STATUS');
  if (pageFailure) {
    auditSpinner.fail(`Could not audit ${url}: ${pageFailure.title}`);
  } else {
    auditSpinner.succeed(`Audited ${pagesAudited}/${pagesToAudit.length} page${pagesToAudit.length === 1 ? '' : 's'} in ${auditMs}ms`);
  }

  const framework = detectedFramework.framework !== 'unknown'
    ? getFrameworkDisplayName(detectedFramework.framework)
    : null;

  const checksRun = (primary.summary?.passed || 0) + (primary.summary?.errors || 0) + (primary.summary?.warnings || 0) || 200;

  return {
    primaryReport: primary,
    issues: mergeIssues(allIssues),
    score: primary.healthScore?.overall || 0,
    pagesAudited,
    pagesDiscovered: pagesToAudit.length,
    framework,
    pageFailure,
    checksRun,
    auditMs,
  };
}
