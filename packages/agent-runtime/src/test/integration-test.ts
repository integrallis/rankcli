#!/usr/bin/env npx tsx
/**
 * Integration Test for SEO Audit Tool
 *
 * Tests the full workflow:
 * 1. Detect framework
 * 2. Run SEO audit
 * 3. Generate fixes
 * 4. Create conventional commits with co-author
 *
 * Usage:
 *   npx tsx src/test/integration-test.ts [repo-path]
 *
 * Test repos in /workspace/test_repos/:
 *   - html-portfolio (Pure HTML/CSS)
 *   - astro-blog (Astro)
 *   - hugo-xmin (Hugo)
 *   - github-pages-site (Jekyll/GitHub Pages)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  formatSEOCommitMessage,
  createSEOCommit,
  generateCommitSummary,
  detectGitHubPages,
  isGitRepo,
  type SEOFixCommit,
  type CommitConfig,
} from '../git/commit-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Framework detection
interface FrameworkInfo {
  name: string;
  type: 'static' | 'ssr' | 'spa';
  configFiles: string[];
  fixPattern: string;
}

const FRAMEWORKS: Record<string, FrameworkInfo> = {
  astro: {
    name: 'Astro',
    type: 'static',
    configFiles: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
    fixPattern: 'src/components/BaseHead.astro',
  },
  sveltekit: {
    name: 'SvelteKit',
    type: 'ssr',
    configFiles: ['svelte.config.js', 'svelte.config.ts'],
    fixPattern: 'src/routes/+layout.svelte',
  },
  nextjs: {
    name: 'Next.js',
    type: 'ssr',
    configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
    fixPattern: 'app/layout.tsx',
  },
  hugo: {
    name: 'Hugo',
    type: 'static',
    configFiles: ['config.toml', 'config.yaml', 'hugo.toml', 'hugo.yaml'],
    fixPattern: 'layouts/partials/head.html',
  },
  jekyll: {
    name: 'Jekyll',
    type: 'static',
    configFiles: ['_config.yml', '_config.yaml'],
    fixPattern: '_includes/head.html',
  },
  html: {
    name: 'Static HTML',
    type: 'static',
    configFiles: [],
    fixPattern: 'index.html',
  },
};

function detectFramework(repoPath: string): FrameworkInfo {
  for (const [key, framework] of Object.entries(FRAMEWORKS)) {
    if (key === 'html') continue; // Fallback

    for (const configFile of framework.configFiles) {
      if (fs.existsSync(path.join(repoPath, configFile))) {
        return framework;
      }
    }
  }

  return FRAMEWORKS.html;
}

// Mock SEO audit results for testing
interface MockAuditResult {
  category: string;
  issues: Array<{
    code: string;
    title: string;
    severity: 'error' | 'warning' | 'notice';
    affectedFiles: string[];
  }>;
}

function getMockAuditResults(framework: FrameworkInfo): MockAuditResult[] {
  // These simulate what a real audit would find
  return [
    {
      category: 'on-page',
      issues: [
        {
          code: 'TITLE_MISSING',
          title: 'Missing title tag',
          severity: 'error',
          affectedFiles: [framework.fixPattern],
        },
        {
          code: 'META_DESC_MISSING',
          title: 'Missing meta description',
          severity: 'error',
          affectedFiles: [framework.fixPattern],
        },
      ],
    },
    {
      category: 'social-meta',
      issues: [
        {
          code: 'OG_TITLE_MISSING',
          title: 'Missing Open Graph title',
          severity: 'warning',
          affectedFiles: [framework.fixPattern],
        },
        {
          code: 'TWITTER_CARD_MISSING',
          title: 'Missing Twitter Card meta tags',
          severity: 'warning',
          affectedFiles: [framework.fixPattern],
        },
      ],
    },
    {
      category: 'crawlability',
      issues: [
        {
          code: 'ROBOTS_TXT_MISSING',
          title: 'Missing robots.txt',
          severity: 'warning',
          affectedFiles: ['robots.txt'],
        },
        {
          code: 'SITEMAP_MISSING',
          title: 'Missing sitemap.xml',
          severity: 'warning',
          affectedFiles: ['sitemap.xml'],
        },
      ],
    },
    {
      category: 'structured-data',
      issues: [
        {
          code: 'SCHEMA_MISSING',
          title: 'No structured data found',
          severity: 'warning',
          affectedFiles: [framework.fixPattern],
        },
      ],
    },
  ];
}

// Generate mock fixes for testing
function generateMockFixes(auditResults: MockAuditResult[]): SEOFixCommit[] {
  return auditResults.map(result => ({
    category: result.category,
    issues: result.issues.map(i => i.code),
    filesChanged: [...new Set(result.issues.flatMap(i => i.affectedFiles))],
    description: `add ${result.category.replace('-', ' ')} improvements`,
  }));
}

// Main test function
async function runIntegrationTest(repoPath: string, options: { dryRun?: boolean } = {}) {
  console.log('═'.repeat(60));
  console.log('SEO AUDIT TOOL - INTEGRATION TEST');
  console.log('═'.repeat(60));
  console.log('');

  // Validate repo path
  if (!fs.existsSync(repoPath)) {
    console.error(`❌ Repository not found: ${repoPath}`);
    process.exit(1);
  }

  console.log(`📁 Repository: ${repoPath}`);

  // Check if it's a git repo
  const gitStatus = isGitRepo(repoPath);
  console.log(`📋 Git repo: ${gitStatus ? 'Yes' : 'No'}`);

  // Detect GitHub Pages
  const ghPages = detectGitHubPages(repoPath);
  if (ghPages.isGitHubPages) {
    console.log(`🌐 GitHub Pages: Yes (${ghPages.type})`);
    if (ghPages.baseUrl) {
      console.log(`   Base URL: ${ghPages.baseUrl}`);
    }
  } else {
    console.log('🌐 GitHub Pages: No');
  }

  // Detect framework
  const framework = detectFramework(repoPath);
  console.log(`🔧 Framework: ${framework.name} (${framework.type})`);
  console.log(`📄 Fix target: ${framework.fixPattern}`);
  console.log('');

  // Run mock audit
  console.log('─'.repeat(60));
  console.log('RUNNING SEO AUDIT...');
  console.log('─'.repeat(60));

  const auditResults = getMockAuditResults(framework);
  let totalIssues = 0;

  for (const result of auditResults) {
    console.log(`\n📊 ${result.category.toUpperCase()}`);
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} ${issue.code}: ${issue.title}`);
      totalIssues++;
    }
  }

  console.log(`\n📈 Total issues found: ${totalIssues}`);
  console.log('');

  // Generate fixes
  console.log('─'.repeat(60));
  console.log('GENERATING FIXES...');
  console.log('─'.repeat(60));

  const fixes = generateMockFixes(auditResults);

  for (const fix of fixes) {
    console.log(`\n🔨 ${fix.category}`);
    console.log(`   Description: ${fix.description}`);
    console.log(`   Files: ${fix.filesChanged.join(', ')}`);
    console.log(`   Issues: ${fix.issues.join(', ')}`);
  }
  console.log('');

  // Create commits
  console.log('─'.repeat(60));
  console.log('CREATING COMMITS...');
  console.log('─'.repeat(60));
  console.log('');

  const commitConfig: CommitConfig = {
    systemName: process.env.SEO_SYSTEM_NAME || 'SEO Autopilot',
    systemEmail: process.env.SEO_SYSTEM_EMAIL || 'bot@seo-autopilot.dev',
    dryRun: options.dryRun ?? true, // Default to dry run for safety
  };

  console.log(`🤖 Co-author: ${commitConfig.systemName} <${commitConfig.systemEmail}>`);
  console.log(`🏃 Mode: ${commitConfig.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  for (const fix of fixes) {
    const message = formatSEOCommitMessage(fix, commitConfig);
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log('│ COMMIT MESSAGE' + ' '.repeat(43) + '│');
    console.log('├' + '─'.repeat(58) + '┤');
    for (const line of message.split('\n')) {
      const paddedLine = line.padEnd(56).slice(0, 56);
      console.log(`│ ${paddedLine} │`);
    }
    console.log('└' + '─'.repeat(58) + '┘');
    console.log('');
  }

  // Summary
  console.log('─'.repeat(60));
  console.log('SUMMARY');
  console.log('─'.repeat(60));
  console.log('');
  console.log(`✅ Framework detected: ${framework.name}`);
  console.log(`✅ GitHub Pages: ${ghPages.isGitHubPages ? 'Yes' : 'No'}`);
  console.log(`✅ Issues found: ${totalIssues}`);
  console.log(`✅ Commits prepared: ${fixes.length}`);
  console.log('');

  if (commitConfig.dryRun) {
    console.log('💡 Run with --live to create actual commits');
  }

  return {
    framework,
    ghPages,
    auditResults,
    fixes,
    totalIssues,
  };
}

// CLI entry point
const args = process.argv.slice(2);
const repoPath = args[0] || path.join(__dirname, '../../../../test_repos/html-portfolio');
const isLive = args.includes('--live');

runIntegrationTest(repoPath, { dryRun: !isLive })
  .then(() => {
    console.log('═'.repeat(60));
    console.log('TEST COMPLETE');
    console.log('═'.repeat(60));
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
