/**
 * The one audit pipeline behind `rankcli audit`, `rankcli fix` and `rankcli apply`: the
 * engine's site audit (packages/agent-runtime/src/audit/site-audit.ts) with the caller's plan
 * and progress spinners on stderr. Each command used to run its own and the same URL scored
 * 85, 93 and 100 inside a minute; now there is one score, computed one way.
 */
import { auditSite, type SiteAuditProgress, type SiteAuditResult } from '@rankcli/agent-runtime';
import ora from 'ora';
import { getUserInfo, isLoggedIn } from './config.js';
import { TIER_LIMITS, tierFromPlanId, type TierId } from './upsell.js';

export type { SiteAuditResult, PageSummary } from '@rankcli/agent-runtime';

export interface SiteAuditOptions {
  url: string;
  /** Pages to audit, counting the URL itself; 1 audits the URL alone. */
  maxPages: number;
  /** Verify link targets (broken links, hreflang reciprocity): real requests, so opt-in. */
  checkLinks?: boolean;
  /** A build directory to audit instead of the live site (served locally for the audit). */
  dir?: string;
  /** Sent with every request to the site. */
  headers?: Record<string, string>;
  discovery?: 'sitemap' | 'links';
}

/**
 * Audit a site with the caller's tier, reporting progress through spinners on stderr.
 * Returns null when no page could be analyzed. Nothing is written to stdout.
 */
export async function runSiteAudit(options: SiteAuditOptions): Promise<SiteAuditResult | null> {
  // Real entitlement: planId comes from validate-api-key (or the session's subscription row),
  // not anything a user chose. An unrecognized plan falls back to the registered/anonymous
  // free tiers, never to paid. Callers that accept RANKCLI_API_KEY run ensureApiKeyPlan() first.
  const { planId } = getUserInfo();
  const tierId: TierId = tierFromPlanId(planId) ?? (isLoggedIn() ? 'free' : 'free_anon');
  const checksLimit: number = TIER_LIMITS[tierId].checks;

  const plural = (n: number) => (n === 1 ? '' : 's');
  let spinner = ora();
  const onProgress = (event: SiteAuditProgress) => {
    if (event.phase === 'discovery' && event.status === 'start') {
      spinner = ora('Discovering pages...').start();
    } else if (event.phase === 'discovery' && event.status === 'done') {
      if (!event.homepageFetched) {
        spinner.warn('Could not fetch homepage, auditing URL only');
        return;
      }
      const via = event.source === 'sitemap' ? ' via the sitemap' : event.source === 'links' ? ' via homepage links' : '';
      const framework = event.framework ? ` (${event.framework})` : '';
      spinner.succeed(`Discovered ${event.pages} page${plural(event.pages)} to audit${via}${framework}`);
    } else if (event.phase === 'audit' && event.status === 'start') {
      spinner = ora(`Auditing ${event.pages} page${plural(event.pages)}...`).start();
    } else if (event.phase === 'audit' && event.status === 'progress') {
      spinner.text = `Auditing pages... (${event.done}/${event.total} complete)`;
    } else if (event.phase === 'audit' && event.status === 'done') {
      if (event.audited === 0) spinner.fail('Audit failed - could not analyze any pages');
      else if (event.pageFailure) spinner.fail(`Could not audit ${options.url}: ${event.pageFailure.title}`);
      else spinner.succeed(`Audited ${event.audited}/${event.total} page${plural(event.total)} in ${event.ms}ms`);
    }
  };

  return auditSite({ ...options, checksLimit, onProgress });
}
