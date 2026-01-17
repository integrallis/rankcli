#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './commands/init.js';
import { analyze } from './commands/analyze.js';
import { audit } from './commands/audit.js';
import { apply } from './commands/apply.js';
import { keywords, keywordsQuick } from './commands/keywords.js';

const program = new Command();

program
  .name('seo')
  .description('SEO Autopilot - Developer-centric SEO automation')
  .version('0.0.1');

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
  .action(audit);

program
  .command('apply')
  .description('Analyze a live URL and apply SEO fixes to your codebase')
  .option('-u, --url <url>', 'URL to analyze')
  .option('--auto', 'Auto-apply fixes without confirmation')
  .option('--dry-run', 'Preview changes without applying')
  .action(apply);

program
  .command('keywords')
  .description('AI-powered keyword research with actionable suggestions')
  .option('-u, --url <url>', 'Your website URL')
  .option('-s, --seed <keywords>', 'Seed keywords (comma-separated)')
  .option('--auto', 'Auto-extract seed keywords from your page')
  .option('--quick', 'Quick mode - skip questions, use defaults')
  .action(async (options) => {
    if (options.quick && options.url) {
      await keywordsQuick(options.url, options.seed);
    } else {
      await keywords(options);
    }
  });

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

program.parse();
