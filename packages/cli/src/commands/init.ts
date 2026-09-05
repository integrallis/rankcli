import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { login } from './auth.js';
import { setupGitHubAction } from './setup.js';
import { isLoggedIn, getUserInfo } from '../lib/config.js';

interface InitOptions {
  yes?: boolean;
}

interface ProjectConfig {
  name: string;
  framework: string | null;
  url: string | null;
  githubRepo: string | null;
  initialized: string;
}

const FRAMEWORKS = [
  { pattern: 'next.config', name: 'Next.js' },
  { pattern: 'astro.config', name: 'Astro' },
  { pattern: 'nuxt.config', name: 'Nuxt' },
  { pattern: 'svelte.config', name: 'SvelteKit' },
  { pattern: 'gatsby-config', name: 'Gatsby' },
  { pattern: 'vite.config', name: 'Vite' },
  { pattern: 'hugo.toml', name: 'Hugo' },
  { pattern: '_config.yml', name: 'Jekyll' },
  { pattern: 'angular.json', name: 'Angular' },
  { pattern: 'vue.config', name: 'Vue CLI' },
];

// Provider env vars this CLI's --ai-key flags already recognize (audit.ts),
// plus the rest of the BYOK set the dashboard supports - detecting these
// lets `init` tell the user their existing key will just work, without
// them needing to know that in advance.
const AI_KEY_ENV_VARS = [
  { env: 'OPENAI_API_KEY', label: 'OpenAI' },
  { env: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
  { env: 'OPENROUTER_API_KEY', label: 'OpenRouter' },
  { env: 'GROQ_API_KEY', label: 'Groq' },
  { env: 'GEMINI_API_KEY', label: 'Gemini' },
  { env: 'GOOGLE_API_KEY', label: 'Gemini' },
];

function detectFramework(): string | null {
  const cwd = process.cwd();

  for (const fw of FRAMEWORKS) {
    const patterns = [
      `${fw.pattern}.js`,
      `${fw.pattern}.ts`,
      `${fw.pattern}.mjs`,
      `${fw.pattern}.cjs`,
      fw.pattern,
    ];

    for (const p of patterns) {
      if (existsSync(join(cwd, p))) {
        return fw.name;
      }
    }
  }

  // Check package.json for clues
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return 'Next.js';
      if (deps['astro']) return 'Astro';
      if (deps['nuxt']) return 'Nuxt';
      if (deps['@sveltejs/kit']) return 'SvelteKit';
      if (deps['gatsby']) return 'Gatsby';
      if (deps['react']) return 'React';
      if (deps['vue']) return 'Vue';
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

function getProjectName(): string {
  const cwd = process.cwd();
  const pkgPath = join(cwd, 'package.json');

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch {
      // Ignore
    }
  }

  return cwd.split('/').pop() || 'unknown';
}

function runGit(args: string): string | null {
  try {
    return execSync(`git ${args}`, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// Parses both SSH (git@github.com:owner/repo.git) and HTTPS
// (https://github.com/owner/repo.git) remote URL forms. The repo group is
// non-greedy so repo names that themselves contain a dot (like this very
// repo, rankcli.dev) don't get truncated at the first one - a naive
// [^/.]+ repo pattern silently mis-detects "rankcli" instead of
// "rankcli.dev" here.
export function parseGitHubRepo(remoteUrl: string): string | null {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function detectConnectedAiKeys(): string[] {
  const found = new Set<string>();
  for (const { env, label } of AI_KEY_ENV_VARS) {
    if (process.env[env]) found.add(label);
  }
  return Array.from(found);
}

export async function init(options: InitOptions): Promise<void> {
  console.log(chalk.bold('\n🚀 Initializing RankCLI...\n'));

  const configPath = join(process.cwd(), 'rankcli.config.json');

  if (existsSync(configPath)) {
    console.log(chalk.yellow('⚠️  Configuration file already exists: rankcli.config.json'));
    console.log(chalk.dim('   Run "rankcli audit" to analyze your project.\n'));
    return;
  }

  const framework = detectFramework();
  const projectName = getProjectName();
  const isGitRepo = runGit('rev-parse --is-inside-work-tree') === 'true';
  const remoteUrl = isGitRepo ? runGit('remote get-url origin') : null;
  const githubRepo = remoteUrl ? parseGitHubRepo(remoteUrl) : null;
  const connectedAiKeys = detectConnectedAiKeys();

  console.log(`📦 Project: ${chalk.cyan(projectName)}`);
  console.log(`🔧 Framework: ${chalk.cyan(framework || 'Unknown (static site?)')}`);
  if (githubRepo) {
    console.log(`🐙 GitHub repo: ${chalk.cyan(githubRepo)}`);
  } else if (isGitRepo) {
    console.log(chalk.dim('🐙 Git repo detected, but no GitHub remote found'));
  }
  if (connectedAiKeys.length > 0) {
    console.log(`🔑 AI key detected: ${chalk.cyan(connectedAiKeys.join(', '))} (will be used automatically for --ai audits)`);
  }

  const config: ProjectConfig = {
    name: projectName,
    framework,
    url: null,
    githubRepo,
    initialized: new Date().toISOString(),
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(chalk.green('\n✅ Created rankcli.config.json'));

  if (options.yes) {
    printNextSteps(githubRepo);
    return;
  }

  // Offer to connect an account - skip entirely if already logged in.
  if (!isLoggedIn()) {
    console.log('');
    const { shouldConnect } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldConnect',
        message: 'Connect a RankCLI account? Unlocks a dashboard, audit history, and GitHub auto-fix PRs (opens your browser).',
        default: true,
      },
    ]);
    if (shouldConnect) {
      await login({});
    }
  } else {
    const { email } = getUserInfo();
    console.log(chalk.dim(`\nAlready connected as ${email}.`));
  }

  // Offer GitHub Action setup - only makes sense with a real GitHub remote,
  // and only if one doesn't already exist.
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'seo.yml');
  if (githubRepo && !existsSync(workflowPath)) {
    console.log('');
    console.log(chalk.bold('🤖 Automate SEO/GEO checks in CI'));
    console.log(chalk.dim('   Privacy: by default nothing is sent to RankCLI - the audit runs'));
    console.log(chalk.dim('   entirely inside your own GitHub Actions runner. If you opt into'));
    console.log(chalk.dim('   dashboard sync below, audit results (the URL and issues found,'));
    console.log(chalk.dim('   not your source code) are sent to your RankCLI account.\n'));

    const { shouldSetupAction } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldSetupAction',
        message: `Set up a GitHub Action for ${githubRepo}?`,
        default: true,
      },
    ]);

    if (shouldSetupAction) {
      const { siteUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'siteUrl',
          message: 'Site URL to audit (https://example.com):',
          validate: (input: string) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          },
        },
      ]);

      const { schedule } = await inquirer.prompt([
        {
          type: 'list',
          name: 'schedule',
          message: 'How often should it run?',
          choices: [
            { name: 'Weekly (recommended)', value: 'weekly' },
            { name: 'Daily', value: 'daily' },
            { name: 'Monthly', value: 'monthly' },
          ],
          default: 'weekly',
        },
      ]);

      let syncToDashboard = false;
      if (isLoggedIn()) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'syncToDashboard',
            message: 'Also send scheduled audits to your RankCLI dashboard?',
            default: true,
          },
        ]);
        syncToDashboard = answer.syncToDashboard;
      }

      await setupGitHubAction(process.cwd(), schedule, siteUrl, syncToDashboard);

      // Keep rankcli.config.json's url in sync with what the Action audits.
      config.url = siteUrl;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  }

  printNextSteps(githubRepo);
}

function printNextSteps(githubRepo: string | null): void {
  console.log(chalk.bold('\n📋 Next steps:'));
  console.log('   1. Run "rankcli audit --url <your-site>" for a full technical audit');
  console.log('   2. Run "rankcli apply --auto" to apply fixes locally');
  if (!githubRepo) {
    console.log('   3. Push to GitHub, then re-run "rankcli init" to set up automated checks');
  }
  console.log('');
}
