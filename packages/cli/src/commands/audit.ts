import { runFullAudit, formatReport, discoverPagesFromLinks, frameworks, type AuditReport, type AuditIssue } from '@rankcli/agent-runtime';
import ora from 'ora';
import chalk from 'chalk';

const { detectFramework, getFrameworkDisplayName } = frameworks;
import { isLoggedIn, getUserInfo, getDecryptPassphrase, WEB_APP_URL, isApiKeyAuth, getApiKey, getSession, getApiUrl } from '../lib/config.js';
import { showUpsell, TIER_LIMITS, type TierId } from '../lib/upsell.js';
import { initEngine, getPremiumChecks, type PremiumChecks } from '../wasm-engine.js';
import { OPENAI_FAST, ANTHROPIC_FAST } from '../models.js';

interface AuditOptions {
  url?: string;
  output?: string;
  checkLinks?: boolean;
  maxPages?: string;
  ai?: boolean;
  aiProvider?: string;
  aiKey?: string;
  geo?: boolean;
}

interface AIAnalysis {
  contentScore: number;
  suggestions: string[];
  prioritizedFixes: Array<{ code: string; priority: number; rationale: string }>;
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

// OpenAI, OpenRouter, Groq, and Gemini (via its OpenAI-compatibility
// endpoint) all speak the same /chat/completions shape - only the base URL
// and model differ. Anthropic's Messages API is genuinely different (system
// is top-level, x-api-key auth, content comes back as typed blocks) and
// gets its own branch below, same split used throughout the saas backend.
const AI_PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: OPENAI_FAST },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-r1:free' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
};

/**
 * Run AI analysis on the audit results
 */
async function runAIAnalysis(
  url: string,
  issues: AuditIssue[],
  provider: string,
  apiKey: string
): Promise<AIAnalysis | null> {
  const isAnthropic = provider === 'anthropic';
  const providerConfig = AI_PROVIDER_DEFAULTS[provider] || AI_PROVIDER_DEFAULTS.openai;
  const apiUrl = isAnthropic
    ? 'https://api.anthropic.com/v1/messages'
    : `${providerConfig.baseUrl}/chat/completions`;

  const prompt = `Analyze these SEO audit results and provide prioritized recommendations:

URL: ${url}

Issues found:
${issues.map(i => `- [${i.severity.toUpperCase()}] ${i.code}: ${i.title}`).join('\n')}

Return JSON with:
{
  "contentScore": <0-100 overall content quality>,
  "suggestions": [<3-5 high-impact suggestions>],
  "prioritizedFixes": [
    {"code": "<issue code>", "priority": <1-5>, "rationale": "<why fix this first>"}
  ]
}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: string;

    if (isAnthropic) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = JSON.stringify({
        model: ANTHROPIC_FAST,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
      if (provider === 'openrouter') {
        // Attributes usage to RankCLI in OpenRouter's dashboard - harmless
        // to omit for other providers, so only set it for that one.
        headers['HTTP-Referer'] = 'https://rankcli.dev';
        headers['X-Title'] = 'RankCLI';
      }
      body = JSON.stringify({
        model: providerConfig.model,
        messages: [
          { role: 'system', content: 'You are an SEO expert. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        // OpenAI's GPT-5.6 rejects max_tokens; other OpenAI-compatible servers still expect it.
        ...(provider === 'openai' ? { max_completion_tokens: 1500 } : { max_tokens: 1500 }),
        // json_object mode is an OpenAI-specific extension - Groq supports
        // it too, but not every OpenAI-compatible server does, so only
        // request it for providers confirmed to support it.
        ...(provider === 'openai' || provider === 'groq' ? { response_format: { type: 'json_object' } } : {}),
      });
    }

    const response = await fetch(apiUrl, { method: 'POST', headers, body });

    if (!response.ok) {
      console.error(chalk.yellow(`AI analysis failed: ${response.status}`));
      return null;
    }

    const data = await response.json() as Record<string, unknown>;
    const content = isAnthropic
      ? (data.content as Array<{ text?: string }>)?.[0]?.text
      : (data.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content;

    if (!content) return null;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AIAnalysis;
  } catch (error) {
    console.error(chalk.yellow(`AI analysis error: ${error}`));
    return null;
  }
}

/**
 * Merge issues from multiple pages, aggregating affected URLs
 */
function mergeIssues(issueArrays: AuditIssue[][]): AuditIssue[] {
  const issueMap = new Map<string, AuditIssue>();

  for (const issues of issueArrays) {
    for (const issue of issues) {
      const existing = issueMap.get(issue.code);
      if (existing) {
        const urls = new Set([...(existing.affectedUrls || []), ...(issue.affectedUrls || [])]);
        existing.affectedUrls = Array.from(urls);
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
      if (data.error === 'project_limit_reached') {
        console.log(chalk.yellow(`\n⚠️  Project limit reached (${data.count}/${data.limit})`));
        console.log(chalk.dim(`   Upgrade at: ${WEB_APP_URL}/account`));
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

export async function audit(options: AuditOptions): Promise<void> {
  const url = options.url;
  const maxPages = parseInt(options.maxPages || '5', 10);
  const enableAI = options.ai || false;
  // Auto-detect provider from whichever key is actually set, when not
  // given explicitly - free/cheap providers first (OpenRouter, Groq,
  // Gemini all have genuinely free tiers), OpenAI/Anthropic as the
  // familiar fallback. `--ai-key` alone (no --ai-provider) still assumes
  // OpenAI, matching this flag's original meaning.
  const detectedProvider = options.aiProvider || (
    process.env.OPENROUTER_API_KEY ? 'openrouter' :
    process.env.GROQ_API_KEY ? 'groq' :
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'gemini' :
    process.env.ANTHROPIC_API_KEY ? 'anthropic' :
    'openai'
  );
  const aiProvider = detectedProvider;
  const providerEnvKey: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  };
  const aiKey = options.aiKey || providerEnvKey[aiProvider] || '';

  // Check login status
  const loggedIn = isLoggedIn();

  // Real entitlement: planId comes from validateApiKey() at login time,
  // a validated call to the backend - not anything checkable client-side.
  // Unrecognized/missing planId falls back to registered vs. anonymous
  // free tiers rather than paid, so a sync gap never grants extra checks.
  const { planId } = getUserInfo();
  const tierId: TierId = planId && planId in TIER_LIMITS ? (planId as TierId) : loggedIn ? 'free' : 'free_anon';
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

  if (!url) {
    console.log('\n⚠️  Please provide a URL to audit:');
    console.log('   rankcli audit --url https://your-site.com');
    console.log('\nOptions:');
    console.log('   --max-pages <n>     Max pages to crawl (default: 5)');
    console.log('   --ai                Enable AI analysis');
    console.log('   --ai-provider <p>   AI provider: openai, anthropic, openrouter, groq, or gemini (auto-detected from env if omitted)');
    console.log('   --ai-key <key>      API key (or set OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY)');
    console.log('   --output json       Output as JSON');
    if (!loggedIn) {
      console.log(chalk.dim('\nTip: Log in to sync results to the web dashboard:'));
      console.log(chalk.dim('   rankcli login'));
    }
    console.log('');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.log('\n❌ Invalid URL format. Please provide a valid URL.\n');
    return;
  }

  const startTime = Date.now();

  try {
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
      return;
    }

    auditSpinner.succeed(`Audited ${successCount}/${pagesToAudit.length} pages in ${parallelTime}ms`);

    // Merge issues from all pages. Framework-specific issues (React/Next.js/
    // WordPress/etc recipes) come from runFullAudit itself now - engine.ts
    // runs the same getFrameworkIssues() this used to call separately here,
    // so server-side audits (free-audit, run-audit) get them too.
    const mergedIssues = mergeIssues(allIssues);

    // ===== PHASE 3: AI Analysis (optional) =====
    let aiAnalysis: AIAnalysis | null = null;

    if (enableAI && aiKey) {
      const aiSpinner = ora(`Running AI analysis (${aiProvider})...`).start();
      aiAnalysis = await runAIAnalysis(url, mergedIssues, aiProvider, aiKey);
      if (aiAnalysis) {
        aiSpinner.succeed('AI analysis complete');
      } else {
        aiSpinner.warn('AI analysis failed or returned no results');
      }
    } else if (enableAI && !aiKey) {
      console.log(chalk.yellow('\n⚠️  AI analysis requested but no API key provided'));
      console.log(chalk.dim('   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY, or use --ai-key'));
    }

    // ===== PHASE 4: Output results =====
    const totalTime = Date.now() - startTime;

    // Determine framework info for output
    const frameworkName = detectedFramework.framework !== 'unknown'
      ? getFrameworkDisplayName(detectedFramework.framework)
      : null;

    // Calculate actual checks run from report summary (used for both output modes)
    const actualChecksRun = (primaryReport.summary?.passed || 0) + 
                            (primaryReport.summary?.errors || 0) + 
                            (primaryReport.summary?.warnings || 0) || 200;

    if (options.output === 'json') {
      // Sync to cloud for JSON output too (silent, no spinner)
      let syncResult: { projectId: string; auditId: string } | null = null;
      if (loggedIn) {
        syncResult = await syncToCloud(url, primaryReport, mergedIssues, successCount, aiAnalysis, totalTime, actualChecksRun);
      }

      const jsonOutput = {
        url,
        score: primaryReport.healthScore?.overall || 0,
        pagesAudited: successCount,
        totalTime,
        framework: frameworkName,
        issues: mergedIssues,
        healthScores: primaryReport.healthScore,
        aiAnalysis,
        // Include cloud sync info if synced
        ...(syncResult && {
          projectId: syncResult.projectId,
          auditId: syncResult.auditId,
          dashboardUrl: `${WEB_APP_URL}/dashboard/projects/${syncResult.projectId}`,
        }),
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      // Console output
      console.log('\n' + chalk.bold('═'.repeat(60)));
      console.log(chalk.bold.cyan(`  SEO AUDIT REPORT: ${url}`));
      console.log(chalk.bold('═'.repeat(60)));

      // Score
      const score = primaryReport.healthScore?.overall || 0;
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
      const errors = mergedIssues.filter(i => i.severity === 'error');
      const warnings = mergedIssues.filter(i => i.severity === 'warning');
      const notices = mergedIssues.filter(i => i.severity === 'notice');

      console.log('\n' + chalk.bold('  Issues by Severity:'));
      console.log(`    ${chalk.red('●')} Errors:   ${errors.length}`);
      console.log(`    ${chalk.yellow('●')} Warnings: ${warnings.length}`);
      console.log(`    ${chalk.blue('●')} Notices:  ${notices.length}`);

      // Top issues
      console.log('\n' + chalk.bold('  Top Issues:'));
      const topIssues = [...errors, ...warnings, ...notices].slice(0, 10);
      topIssues.forEach((issue, i) => {
        const icon = issue.severity === 'error' ? chalk.red('✗') :
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

      console.log('\n' + chalk.bold('═'.repeat(60)));

      // Get user tier for upsell logic
      const userInfo = getUserInfo();
      const tier = (userInfo.planName?.toLowerCase() || 'free') as TierId;
      const isFreeTier = !loggedIn || tier === 'free';
      const isSoloOrBelow = isFreeTier || tier === 'solo';

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
    }

  } catch (error) {
    console.log(`\n❌ Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}
