/**
 * The RankCLI audit of a built, static output directory, the way a build hook runs it: serve
 * the directory as a static host would, run the full audit (the same 280+ checks as
 * `rankcli audit --dir`), log the score and every error and warning with its code, count the
 * notices, and fail the build on `failOn` with the rules of `rankcli audit --fail-on`. The
 * engine is imported here, not at module load, so a dev server never pays for it.
 *
 * astro-rankcli's build hook does the same thing; this is the Nuxt side of it.
 */
import { relative } from 'node:path';

export interface AuditBuildOptions {
  /** The site the build is for; canonical and sitemap checks compare against it. */
  siteUrl: string;
  /** The output directory to serve and audit. */
  dir: string;
  /** Pages to audit (the sitemap seeds the list). Default: every built page, up to 50. */
  maxPages?: number;
  /** How many pages the build produced, for the default page budget. */
  pageCount?: number;
  /** Gate rules, the syntax of `rankcli audit --fail-on`. */
  failOn?: string | string[];
  log: (message: string) => void;
  warn: (message: string) => void;
  /** The name the gate error carries. */
  name?: string;
}

export interface AuditBuildOutcome {
  score: number;
  pagesAudited: number;
  errors: number;
  warnings: number;
  notices: number;
}

export async function auditBuildOutput(options: AuditBuildOptions): Promise<AuditBuildOutcome | null> {
  const { siteUrl, dir, log, warn, name = 'nuxt-rankcli' } = options;
  const engine = await import('@rankcli/agent-runtime');
  const maxPages = options.maxPages ?? Math.min(Math.max(options.pageCount ?? 1, 1), 50);
  log(`Auditing the build with RankCLI (${maxPages} page${maxPages === 1 ? '' : 's'}, 280+ checks)...`);
  const result = await engine.auditSite({ url: siteUrl, dir, maxPages, staticBuild: true });
  if (!result) {
    warn('The RankCLI audit could not run on the build output.');
    return null;
  }
  const count = (...severities: string[]) => result.issues.filter(i => severities.includes(i.severity)).length;
  const outcome: AuditBuildOutcome = {
    score: result.score,
    pagesAudited: result.pagesAudited,
    errors: count('error', 'critical'),
    warnings: count('warning'),
    notices: count('notice', 'info'),
  };
  log(`RankCLI score ${outcome.score}/100 across ${outcome.pagesAudited} page${outcome.pagesAudited === 1 ? '' : 's'}: ${outcome.errors} errors, ${outcome.warnings} warnings, ${outcome.notices} notices`);
  for (const issue of result.issues.filter(i => i.severity !== 'notice' && i.severity !== 'info')) {
    const pages = issue.affectedUrls?.length ? ` (${issue.affectedUrls.length === 1 ? issue.affectedUrls[0].replace(siteUrl, '') || '/' : `${issue.affectedUrls.length} pages`})` : '';
    warn(`  ${issue.severity === 'warning' ? 'warn ' : 'error'} [${issue.code}] ${issue.title}${pages}`);
  }
  if (outcome.notices > 0) {
    log(`  ${outcome.notices} notice${outcome.notices === 1 ? '' : 's'} not listed; see them with: rankcli audit --dir ${relative(process.cwd(), dir) || '.'} --url ${siteUrl} -o llm`);
  }
  if (options.failOn) {
    const { spec, error } = engine.parseFailOn(options.failOn);
    if (error) throw new Error(`${name}: invalid failOn: ${error}`);
    const gate = engine.evaluateGate(spec, result.issues, { ...result.primaryReport.healthScore, overall: result.score });
    if (!gate.passed) throw new Error(`RankCLI gate failed: ${gate.failures.join('; ')}`);
  }
  return outcome;
}
