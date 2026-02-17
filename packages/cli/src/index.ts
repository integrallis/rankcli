#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { analyze } from './commands/analyze.js';
import { audit } from './commands/audit.js';
import { apply } from './commands/apply.js';
import { geo } from './commands/geo.js';
import { keywords, keywordsQuick, keywordsCompetitor, keywordsAI } from './commands/keywords.js';
import { analyzeContent, analyzeIntent } from './commands/content.js';
import { setup, showGSCInstructions } from './commands/setup.js';
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
  .description('Log in to your RankCLI account')
  .option('-e, --email <email>', 'Email address')
  .option('-b, --browser', 'Open browser for login')
  .option('-t, --token <apiKey>', 'API key for non-interactive authentication')
  .action(login);

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
  .description('Initialize SEO Autopilot in your project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(init);

program
  .command('analyze')
  .description('AI analyzes your codebase for SEO opportunities')
  .option('-v, --verbose', 'Show detailed output')
  .action(analyze);

program
  .command('audit')
  .description('Run a comprehensive SEO audit (170+ checks, Ahrefs-level)')
  .option('-u, --url <url>', 'URL to audit')
  .option('-o, --output <format>', 'Output format (json, console)', 'console')
  .option('--check-links', 'Check for broken internal/external links (slower)')
  .option('--max-pages <n>', 'Max pages to crawl (default: 5)')
  .option('--ai', 'Enable AI analysis')
  .option('--ai-provider <provider>', 'AI provider: openai or anthropic')
  .option('--ai-key <key>', 'API key (or set OPENAI_API_KEY/ANTHROPIC_API_KEY)')
  .action(audit);

program
  .command('apply')
  .description('Analyze a live URL and apply SEO fixes to your codebase')
  .option('-u, --url <url>', 'URL to analyze')
  .option('--auto', 'Auto-apply fixes without confirmation')
  .option('--dry-run', 'Preview changes without applying')
  .action(apply);

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

program
  .command('rank')
  .description('Check current keyword rankings')
  .action(() => {
    console.log('Rank tracking coming soon...');
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
  .action(setup);

program
  .command('gsc-setup')
  .description('Show Google Search Console API setup instructions')
  .action(showGSCInstructions);

program.parse();
