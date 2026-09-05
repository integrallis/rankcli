import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  runDirectAnalysis,
  runAuditWithFixes,
  generateFixes,
  applyFixes,
  detectFramework,
  type SEOAnalysisResult,
  type GeneratedFix,
  type FrameworkInfo,
  type AuditRunnerResult,
} from '@rankcli/agent-runtime';
import { isLoggedIn, isApiKeyAuth, getUserInfo } from '../lib/config.js';
import { showUpsell, hasFeature, type TierId } from '../lib/upsell.js';

interface ApplyOptions {
  url?: string;
  auto?: boolean;
  dryRun?: boolean;
}

interface ProjectConfig {
  name: string;
  framework: string | null;
  url: string | null;
}

const SEVERITY_ICON: Record<string, string> = {
  critical: '\u274C',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
};

function printFix(fix: GeneratedFix, index: number): void {
  const icon = SEVERITY_ICON[fix.issue.severity] || '\u2022';
  console.log(`\n${index + 1}. ${icon} ${fix.issue.message}`);
  console.log(`   File: ${fix.file}`);
  if (fix.skipped) {
    console.log(`   Status: SKIPPED - ${fix.skipReason}`);
  } else {
    console.log(`   Explanation: ${fix.explanation}`);
    if (fix.before) {
      console.log(`   Before: ${truncate(fix.before, 60)}`);
    }
    console.log(`   After: ${truncate(fix.after, 100)}`);
  }
}

function truncate(str: string, maxLen: number): string {
  const oneLine = str.replace(/\n/g, ' ').trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.substring(0, maxLen - 3) + '...';
}

export async function apply(options: ApplyOptions): Promise<void> {
  const cwd = process.cwd();

  // Check for config file
  const configPath = join(cwd, 'rankcli.config.json');
  let config: ProjectConfig | null = null;

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Ignore config parse errors
    }
  }

  // Determine URL to analyze
  let url = options.url;
  if (!url && config?.url) {
    url = config.url;
  }

  if (!url) {
    console.log('\n\u26A0\uFE0F  Please provide a URL to analyze:');
    console.log('   rankcli apply --url https://your-site.com');
    console.log('\n   Or set a URL in your rankcli.config.json\n');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.log('\n\u274C Invalid URL format. Please provide a valid URL.\n');
    return;
  }

  console.log('\n\u{1F680} RankCLI - Apply Fixes');
  console.log('═'.repeat(50));

  // Check if user has access to auto-fix feature
  const loggedIn = isLoggedIn();
  const userInfo = getUserInfo();
  const tier = (userInfo.planName?.toLowerCase() || 'free') as TierId;
  
  // Auto-fix requires Solo tier or higher
  const hasAutoFix = loggedIn && hasFeature(tier, 'auto_fix');
  
  if (!hasAutoFix) {
    showUpsell('auto_fix_blocked');
    return;
  }

  // Detect framework
  console.log('\n\u{1F50D} Detecting framework...');
  const frameworkResult = await detectFramework({ cwd });
  const framework = frameworkResult.success
    ? (frameworkResult.data as FrameworkInfo)
    : { name: 'Unknown', metaPattern: 'html-head' as const };
  console.log(`   Framework: ${framework.name}`);

  // Analyze URL - full audit since we already verified access
  console.log(`\n\u{1F50D} Analyzing ${url}...`);
  console.log('   Running full audit (200+ checks)...');

  let issues: SEOAnalysisResult['issues'];
  let score: number;
  let auditResult: AuditRunnerResult | null = null;

  try {
    // Full audit since we already verified access
    auditResult = await runAuditWithFixes({
      url,
      generateFixes: true,
    });
    issues = auditResult.report.issues.map(issue => ({
      // Squash the audit engine's 5-level severity into generateFixes's
      // 3-level SEOIssue scheme - matches how audit.ts already treats
      // 'error' as critical-weight (red ✗) and 'notice' as info-weight.
      severity: issue.severity === 'error' ? 'critical' as const
        : issue.severity === 'notice' ? 'info' as const
        : issue.severity,
      category: issue.category,
      code: issue.code,
      message: issue.title,
      impact: issue.description || undefined,
      // Cast covers `category`: the audit engine's categories (17 values,
      // e.g. 'crawlability', 'links') don't map cleanly onto SEOIssue's
      // narrower set - generateFixes never reads category off its input
      // (each fixer hardcodes its own), so this is safe, not just silenced.
    })) as SEOAnalysisResult['issues'];
    score = auditResult.score;
  } catch (error) {
    console.log(`\n\u274C Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    return;
  }

  console.log(`   Score: ${score}/100`);
  console.log(`   Issues found: ${issues.length}`);

  if (issues.length === 0) {
    console.log('\n\u2705 No issues found! Your site looks great.\n');
    return;
  }

  // Generate fixes
  console.log('\n\u{1F527} Generating fixes...');

  const fixes = await generateFixes(issues, {
    cwd,
    url,
    framework,
  });

  const actionableFixes = fixes.filter(f => !f.skipped);
  const skippedFixes = fixes.filter(f => f.skipped);

  console.log(`   Generated ${actionableFixes.length} actionable fix(es)`);
  if (skippedFixes.length > 0) {
    console.log(`   ${skippedFixes.length} issue(s) require manual attention`);
  }

  // Show fixes
  console.log('\n' + '─'.repeat(50));
  console.log('PROPOSED FIXES:');
  console.log('─'.repeat(50));

  for (let i = 0; i < fixes.length; i++) {
    printFix(fixes[i], i);
  }

  // Dry run mode
  if (options.dryRun) {
    console.log('\n' + '─'.repeat(50));
    console.log('\u{1F4CB} DRY RUN - No changes were made.');
    console.log('   Remove --dry-run to apply these fixes.\n');
    return;
  }

  // Apply fixes
  if (actionableFixes.length === 0) {
    console.log('\n\u26A0\uFE0F  No automatic fixes available. Please address issues manually.\n');
    return;
  }

  if (!options.auto) {
    console.log('\n' + '─'.repeat(50));
    console.log(`Ready to apply ${actionableFixes.length} fix(es).`);
    console.log('Run with --auto to apply without confirmation.');
    console.log('Run with --dry-run to preview changes.\n');

    // Simple confirmation via environment variable or proceed automatically
    const proceed = process.env.SEO_AUTO_APPLY === 'true';
    if (!proceed) {
      console.log('Set SEO_AUTO_APPLY=true or use --auto flag to apply fixes.\n');
      return;
    }
  }

  console.log('\n\u{1F527} Applying fixes...');

  const { applied, skipped } = await applyFixes(fixes, { cwd, dryRun: false });

  // Print results
  console.log('\n' + '═'.repeat(50));
  console.log('RESULTS');
  console.log('═'.repeat(50));

  if (applied.length > 0) {
    console.log(`\n\u2705 Applied ${applied.length} fix(es):`);
    for (const fix of applied) {
      console.log(`   - ${fix.file}: ${fix.issue.message}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\n\u26A0\uFE0F  Skipped ${skipped.length} fix(es):`);
    for (const fix of skipped) {
      console.log(`   - ${fix.file}: ${fix.skipReason || 'Manual fix required'}`);
    }
  }

  // Update config with URL if needed
  if (config && !config.url) {
    config.url = url;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('\n\u{1F4BE} Updated config with URL.');
  }

  // Git instructions
  console.log('\n' + '─'.repeat(50));
  console.log('NEXT STEPS:');
  console.log('─'.repeat(50));
  console.log('1. Review the changes:');
  console.log('   git diff');
  console.log('\n2. Commit the SEO improvements:');
  console.log('   git add -A && git commit -m "feat(seo): add meta tags and structured data"');
  console.log('\n3. Re-run the audit to verify:');
  console.log(`   rankcli audit --url ${url}`);
  console.log('');
}
