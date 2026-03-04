import chalk from 'chalk';

export const WEB_APP_URL = 'https://rankcli.dev';

// Tier limits for client-side checks
export const TIER_LIMITS = {
  free_anon: {
    checks: 50,
    sites: 0,
    domains_per_month: 1,
    features: { geo: false, auto_fix: false, github: false, ai: false },
  },
  free: {
    checks: 100,
    sites: 1,
    domains_per_month: 2,
    features: { geo: 'basic', auto_fix: false, github: false, ai: false },
  },
  solo: {
    checks: 280,
    sites: 3,
    domains_per_month: 5,
    features: { geo: true, auto_fix: true, github: false, ai: true },
  },
  pro: {
    checks: 280,
    sites: 10,
    domains_per_month: 15,
    features: { geo: true, auto_fix: true, github: true, ai: true },
  },
  agency: {
    checks: 280,
    sites: 50,
    domains_per_month: null, // unlimited
    features: { geo: true, auto_fix: true, github: true, ai: true },
  },
} as const;

export type TierId = keyof typeof TIER_LIMITS;

interface UpsellContext {
  tier: TierId;
  feature?: string;
  limit?: string;
  current?: number;
  max?: number;
}

const UPSELL_MESSAGES: Record<string, (ctx: UpsellContext) => string[]> = {
  // After free audit completes
  free_audit_complete: () => [
    '',
    chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.yellow.bold('  🚀 Get 2x more checks + audit history'),
    chalk.dim('  Create a free account to unlock 100 checks and save your results.'),
    '',
    chalk.cyan(`  → rankcli login`),
    chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // When checks limit is reached
  checks_limit: (ctx) => [
    '',
    chalk.yellow(`⚠️  Running ${ctx.current || 50} of ${TIER_LIMITS.solo.checks} available checks`),
    chalk.dim(`   Unlock all ${TIER_LIMITS.solo.checks}+ checks with Solo ($9/mo)`),
    chalk.cyan(`   → ${WEB_APP_URL}/pricing?from=cli_checks`),
    '',
  ],

  // When domain limit is reached
  domain_limit: (ctx) => [
    '',
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.red.bold('  ✗ Domain limit reached'),
    chalk.dim(`  Your ${ctx.tier} plan allows ${ctx.max} domains per month.`),
    '',
    chalk.dim('  Upgrade to audit more sites:'),
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=cli_domain_limit`),
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // When GEO features are limited
  geo_limited: (ctx) => [
    '',
    chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.yellow.bold('  🤖 Full GEO analysis requires Solo'),
    chalk.dim('  You\'re seeing basic AI crawler access checks.'),
    chalk.dim('  Full analysis includes: LLM signals, citation readiness, content structure'),
    '',
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=cli_geo`),
    chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // When auto-fix is attempted without access
  auto_fix_blocked: () => [
    '',
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.red.bold('  ✗ Auto-fix requires Solo plan'),
    chalk.dim('  Apply framework-specific SEO fixes directly to your codebase.'),
    '',
    chalk.dim('  Solo ($9/mo) includes:'),
    chalk.dim('    • Local auto-fix via CLI'),
    chalk.dim('    • 25+ framework support'),
    chalk.dim('    • Full 280+ checks'),
    '',
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=cli_autofix`),
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // When GitHub integration is attempted without access
  github_blocked: () => [
    '',
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.red.bold('  ✗ GitHub auto-fix PRs require Pro'),
    chalk.dim('  Automatically create fix PRs when SEO issues are detected.'),
    '',
    chalk.dim('  Pro ($29/mo) includes:'),
    chalk.dim('    • GitHub App integration'),
    chalk.dim('    • Auto-fix PRs'),
    chalk.dim('    • Daily scheduled audits'),
    chalk.dim('    • Slack/Discord alerts'),
    '',
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=cli_github`),
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // Keyword tracking limit reached
  keyword_limit: (ctx) => [
    '',
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.red.bold('  ✗ Keyword tracking limit reached'),
    chalk.dim(`  Your ${ctx.tier} plan allows ${ctx.limit || ctx.max} tracked keywords.`),
    chalk.dim(`  Currently tracking: ${ctx.current}`),
    '',
    chalk.dim('  Upgrade for more keywords:'),
    chalk.dim('    • Solo ($9/mo): 100 keywords'),
    chalk.dim('    • Pro ($29/mo): 500 keywords'),
    chalk.dim('    • Agency ($99/mo): 2,000 keywords'),
    '',
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=cli_keyword_limit`),
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // Rate limit exceeded
  rate_limit: (ctx) => [
    '',
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.red.bold('  ✗ API rate limit exceeded'),
    chalk.dim(`  Your ${ctx.tier} plan allows ${ctx.max} requests/day.`),
    '',
    chalk.dim('  Need more? Upgrade for higher limits:'),
    chalk.dim('    • Solo: 100 req/day'),
    chalk.dim('    • Pro: 1,000 req/day'),
    chalk.dim('    • Agency: 10,000 req/day'),
    '',
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=cli_rate_limit`),
    chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // Schedule exceeded (for GitHub Action)
  schedule_exceeded: (ctx) => [
    '',
    chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    chalk.yellow.bold('  ⏰ Scheduled audit skipped'),
    chalk.dim(`  Your ${ctx.tier} plan allows ${ctx.limit} scheduled audits.`),
    '',
    chalk.dim('  Upgrade for more frequent audits:'),
    chalk.dim('    • Solo: Weekly'),
    chalk.dim('    • Pro: Daily'),
    chalk.dim('    • Agency: Hourly'),
    '',
    chalk.cyan(`  → ${WEB_APP_URL}/pricing?from=schedule_exceeded`),
    chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
    '',
  ],

  // Login prompt (soft)
  login_prompt: () => [
    '',
    chalk.dim('  💡 Tip: Log in to sync results and track progress over time:'),
    chalk.dim('     rankcli login'),
    '',
  ],
};

/**
 * Print an upsell message to the console
 */
export function showUpsell(messageKey: keyof typeof UPSELL_MESSAGES, context?: Partial<UpsellContext>): void {
  const messageFn = UPSELL_MESSAGES[messageKey];
  if (!messageFn) return;

  const ctx: UpsellContext = {
    tier: 'free',
    ...context,
  };

  const lines = messageFn(ctx);
  lines.forEach(line => console.log(line));
}

/**
 * Check if a feature is available for a tier
 */
export function hasFeature(tier: TierId, feature: keyof typeof TIER_LIMITS['free']['features']): boolean | string {
  const limits = TIER_LIMITS[tier];
  return limits?.features?.[feature] ?? false;
}

/**
 * Get the upgrade tier for a feature
 */
export function getUpgradeTierFor(feature: string): TierId | null {
  switch (feature) {
    case 'auto_fix':
    case 'geo_full':
    case 'ai':
      return 'solo';
    case 'github':
    case 'daily_schedule':
      return 'pro';
    case 'hourly_schedule':
    case 'white_label':
      return 'agency';
    default:
      return 'solo';
  }
}
