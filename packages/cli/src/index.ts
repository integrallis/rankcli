#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { analyze } from './commands/analyze.js';
import { audit, AUDIT_HELP_TEXT } from './commands/audit.js';
import { apply } from './commands/apply.js';
import { fix } from './commands/fix.js';
import { trackAdd, trackStatus, trackHistory, trackExport, trackCheck } from './commands/track.js';
import { geo } from './commands/geo.js';
import { keywords, keywordsQuick, keywordsCompetitor, keywordsAI } from './commands/keywords.js';
import { analyzeContent, analyzeIntent } from './commands/content.js';
import { setup, showGSCInstructions } from './commands/setup.js';
import { alerts } from './commands/alerts.js';
import { login, logout, whoami } from './commands/auth.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('rankcli')
  .description('RankCLI - Ship code, get ranked. SEO meets CI/CD.')
  .version(VERSION);

// Auth commands
program
  .command('login')
  .description('Log in to your RankCLI account (opens your browser by default)')
  .option('-e, --email <email>', 'Log in with email/password instead of the browser')
  .option('--no-browser', 'Skip the browser and log in with email/password interactively')
  .option('-t, --token <apiKey>', 'API key for non-interactive authentication (validates it and resolves your plan)')
  .action(async (options) => {
    process.exitCode = await login(options);
  });

program
  .command('logout')
  .description('Log out of your RankCLI account')
  .action(logout);

program
  .command('whoami')
  .description('Show current logged in user')
  .action(whoami);

program
  .command('init')
  .description('Set up RankCLI in your project (detects framework, git/GitHub, AI keys)')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(init);

program
  .command('analyze')
  .description('AI analyzes your codebase for SEO opportunities')
  .option('-v, --verbose', 'Show detailed output')
  .action(analyze);

program
  .command('audit')
  .description('Run an SEO + GEO audit (280+ checks)')
  .option('-u, --url <url>', 'URL to audit')
  .option('-o, --output <format>', 'Output format (json, console)', 'console')
  .option('--check-links', 'Check for broken internal/external links (slower)')
  .option('--max-pages <n>', 'Max pages to crawl (default: 5)')
  .option('--fail-on <level>', 'CI gate: exit 1 if any issue is at or above this severity (error, warning, notice)')
  .option('--min-score <n>', 'CI gate: exit 1 if the overall score is below n (0-100)')
  .option('--ai', 'Enable AI analysis (your own key, or a local model)')
  .option('--ai-provider <provider>', 'AI provider (auto-detected if omitted; Apple Intelligence on a Mac that has it, or set RANKCLI_AI_PROVIDER): apple, openrouter, openai, anthropic, groq, gemini, deepseek, mistral, cerebras, together, fireworks, ollama, lmstudio, llamacpp, vllm, custom')
  .option('--ai-key <key>', 'AI provider API key (or set the provider\'s env var, e.g. OPENROUTER_API_KEY)')
  .option('--ai-model <model>', 'Model id (defaults to a cheap model per provider, or the local server\'s loaded model)')
  .option('--ai-base-url <url>', 'OpenAI-compatible base URL, e.g. http://localhost:8080/v1 (implies --ai-provider custom)')
  .addHelpText('after', AUDIT_HELP_TEXT)
  .action(async (options) => {
    process.exitCode = await audit(options);
  });

program
  .command('apply')
  .description('Analyze a live URL and apply SEO fixes to your codebase')
  .option('-u, --url <url>', 'URL to analyze')
  .option('--auto', 'Auto-apply fixes without confirmation')
  .option('--dry-run', 'Preview changes without applying')
  .action(apply);

program
  .command('fix')
  .description('Agentic SEO fixer - detect, fix, commit, and push')
  .option('-u, --url <url>', 'URL to analyze')
  .option('--auto', 'Auto-apply fixes without confirmation')
  .option('--commit', 'Commit changes with conventional commit message')
  .option('--push', 'Push changes after committing (requires --commit)')
  .option('--dry-run', 'Preview changes without applying')
  .option('--only <codes>', 'Fix only specific issue codes (comma-separated)', (val) => val.split(','))
  .option('-o, --output <format>', 'Output format (text, json)', 'text')
  .action(async (options) => {
    const result = await fix({
      url: options.url,
      auto: options.auto,
      commit: options.commit,
      push: options.push,
      dryRun: options.dryRun,
      only: options.only,
      output: options.output,
    });
    // fix() fills result.json on every path in JSON mode - including "no
    // fixes" and tier-blocked - so a CI step parsing it never gets ''.
    if (options.output === 'json' && result.json) {
      console.log(result.json);
    }
  });

program
  .command('geo')
  .description('GEO analysis - Check AI search visibility (ChatGPT, Perplexity, Claude)')
  .option('-u, --url <url>', 'URL to analyze')
  .option('-o, --output <format>', 'Output format (json, console)', 'console')
  .action(geo);

program
  .command('keywords')
  .description('AI-powered keyword research with actionable suggestions')
  .option('-u, --url <url>', 'Your website URL')
  .option('-s, --seed <keywords>', 'Seed keywords (comma-separated)')
  .option('--auto', 'Auto-extract seed keywords from your page')
  .option('--quick', 'Quick mode - skip questions, use defaults')
  .option('--ai', 'Use GPT-4 for enhanced analysis with free tool ideas')
  .option('--local', 'Force local processing (skip cloud worker)')
  .option('--competitor', 'Competitor gap analysis mode (SpyFu Kombat-style)')
  .option('-c, --competitors <domains>', 'Competitor domains (comma-separated)')
  .action(async (options) => {
    if (options.ai && options.url) {
      // AI-powered keyword research with enhanced tool ideas
      // Auto-detect: use cloud worker if available, otherwise run locally
      await keywordsAI(options.url, {
        forceLocal: options.local,
        openaiApiKey: process.env.OPENAI_API_KEY,
      });
    } else if (options.competitor && options.url && options.seed) {
      // Competitor gap analysis mode
      const seeds = options.seed.split(',').map((s: string) => s.trim());
      const competitors = options.competitors
        ? options.competitors.split(',').map((s: string) => s.trim())
        : undefined;
      await keywordsCompetitor(options.url, seeds, competitors);
    } else if (options.quick && options.url) {
      await keywordsQuick(options.url, options.seed);
    } else {
      await keywords(options);
    }
  });

program
  .command('content')
  .description('Analyze content for readability, keyword density, and featured snippets')
  .option('-u, --url <url>', 'URL to analyze')
  .option('-k, --keyword <keyword>', 'Target keyword for analysis')
  .option('--headline <headline>', 'Analyze a headline')
  .option('--mode <mode>', 'Analysis mode (full, readability, headline, snippet, density)', 'full')
  .action(analyzeContent);

program
  .command('intent')
  .description('Classify search intent for a keyword')
  .argument('<keyword>', 'Keyword to analyze')
  .action(analyzeIntent);

program
  .command('competitors')
  .description('Analyze competitor SEO strategies')
  .option('-d, --domain <domain>', 'Competitor domain to analyze')
  .action(() => {
    console.log('Competitor analysis coming soon...');
  });

// Track command group
const trackCmd = program
  .command('track')
  .description('Keyword rank tracking');

trackCmd
  .command('add <keywords...>')
  .description('Add keywords to track')
  .option('-u, --url <url>', 'URL to track rankings for')
  .option('-e, --engine <engine>', 'Search engine (google, bing)', 'google')
  .option('-c, --country <country>', 'Country code (US, UK, DE, etc.)', 'US')
  .option('-l, --language <lang>', 'Language code (en, de, fr, etc.)', 'en')
  .action(async (keywords: string[], options) => {
    await trackAdd({
      keywords,
      url: options.url,
      searchEngine: options.engine,
      country: options.country,
      language: options.language,
    });
  });

trackCmd
  .command('status')
  .description('Show current keyword rankings')
  .option('-u, --url <url>', 'URL to show rankings for')
  .option('-o, --output <format>', 'Output format (text, json)', 'text')
  .action(async (options) => {
    await trackStatus({
      url: options.url,
      output: options.output,
    });
  });

trackCmd
  .command('history')
  .description('Show keyword position history')
  .option('-u, --url <url>', 'URL to show history for')
  .option('-k, --keyword <keyword>', 'Keyword to show history for')
  .option('-d, --days <days>', 'Number of days of history', '30')
  .option('-o, --output <format>', 'Output format (text, json)', 'text')
  .action(async (options) => {
    await trackHistory({
      url: options.url,
      keyword: options.keyword,
      days: parseInt(options.days, 10),
      output: options.output,
    });
  });

trackCmd
  .command('check')
  .description('Check current rankings (calls SERP API)')
  .option('-u, --url <url>', 'URL to check rankings for')
  .option('-f, --force', 'Force check even if rate limited')
  .action(async (options) => {
    await trackCheck({
      url: options.url,
      force: options.force,
    });
  });

trackCmd
  .command('export')
  .description('Export tracking data')
  .option('-u, --url <url>', 'URL to export data for')
  .option('-f, --format <format>', 'Export format (csv, json)', 'csv')
  .option('-d, --days <days>', 'Number of days of history', '30')
  .action(async (options) => {
    await trackExport({
      url: options.url,
      format: options.format,
      days: parseInt(options.days, 10),
    });
  });

program
  .command('report')
  .description('Generate SEO performance report')
  .option('-f, --format <format>', 'Report format (pdf, html, json)', 'html')
  .action(() => {
    console.log('Report generation coming soon...');
  });

program
  .command('watch')
  .description('Continuous monitoring mode')
  .action(() => {
    console.log('Watch mode coming soon...');
  });

program
  .command('setup')
  .description('Set up SEO tracking (GA4, Search Console, GitHub Actions)')
  .option('--ga4 <id>', 'Google Analytics 4 Measurement ID (G-XXXXXXXXXX)')
  .option('--gsc <code>', 'Google Search Console verification code')
  .option('--github-action', 'Set up automated GitHub Action')
  .option('--schedule <freq>', 'GitHub Action schedule (daily, weekly, monthly)', 'weekly')
  .option('--all', 'Interactive setup wizard')
  .option('--url <url>', 'Site URL the GitHub Action audits')
  .option('--sync', 'GitHub Action: sync audits to your dashboard and enable auto-fix PRs (needs a RANKCLI_API_KEY secret)')
  .action(setup);

program
  .command('gsc-setup')
  .description('Show Google Search Console API setup instructions')
  .action(showGSCInstructions);

program
  .command('alerts')
  .description('Configure Slack/Discord notifications for SEO events')
  .option('-c, --channel <channel>', 'Alert channel (slack, discord)')
  .option('-w, --webhook <url>', 'Webhook URL')
  .option('--test', 'Test the webhook')
  .option('--list', 'List current alert configurations')
  .option('--remove <id>', 'Remove an alert configuration')
  .action(alerts);

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
