/**
 * Git Commit Helper
 *
 * Creates conventional commits for SEO fixes with proper co-authoring.
 * Supports GitHub Pages and various static site generators.
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// System name is configurable (TBD - SEO Autopilot is temporary)
const SYSTEM_NAME = process.env.SEO_SYSTEM_NAME || 'SEO Autopilot';
const SYSTEM_EMAIL = process.env.SEO_SYSTEM_EMAIL || 'bot@seo-autopilot.dev';

export interface CommitConfig {
  systemName?: string;
  systemEmail?: string;
  dryRun?: boolean;
}

export interface ConventionalCommit {
  type: 'fix' | 'feat' | 'docs' | 'style' | 'refactor' | 'perf' | 'chore';
  scope?: string;
  description: string;
  body?: string;
  breaking?: boolean;
  issues?: string[]; // Issue codes like TITLE_MISSING
}

export interface SEOFixCommit {
  category: string;
  issues: string[];
  filesChanged: string[];
  description: string;
}

/**
 * Maps SEO issue categories to conventional commit types and scopes
 */
const CATEGORY_MAPPING: Record<string, { type: ConventionalCommit['type']; scope: string }> = {
  'crawlability': { type: 'fix', scope: 'seo' },
  'indexability': { type: 'fix', scope: 'seo' },
  'on-page': { type: 'fix', scope: 'meta' },
  'content': { type: 'fix', scope: 'content' },
  'links': { type: 'fix', scope: 'links' },
  'images': { type: 'fix', scope: 'images' },
  'structured-data': { type: 'feat', scope: 'schema' },
  'performance': { type: 'perf', scope: 'web' },
  'security': { type: 'fix', scope: 'security' },
  'mobile': { type: 'fix', scope: 'mobile' },
  'international': { type: 'fix', scope: 'i18n' },
  'social-meta': { type: 'feat', scope: 'og' },
};

/**
 * Formats a conventional commit message
 */
export function formatConventionalCommit(commit: ConventionalCommit): string {
  let message = commit.type;

  if (commit.scope) {
    message += `(${commit.scope})`;
  }

  if (commit.breaking) {
    message += '!';
  }

  message += `: ${commit.description}`;

  if (commit.body) {
    message += `\n\n${commit.body}`;
  }

  if (commit.issues && commit.issues.length > 0) {
    message += `\n\nIssue codes: ${commit.issues.join(', ')}`;
  }

  return message;
}

/**
 * Formats a commit message for SEO fixes
 */
export function formatSEOCommitMessage(fix: SEOFixCommit, config?: CommitConfig): string {
  const mapping = CATEGORY_MAPPING[fix.category] || { type: 'fix', scope: 'seo' };
  const systemName = config?.systemName || SYSTEM_NAME;
  const systemEmail = config?.systemEmail || SYSTEM_EMAIL;

  const commit: ConventionalCommit = {
    type: mapping.type,
    scope: mapping.scope,
    description: fix.description,
    body: `Files changed:\n${fix.filesChanged.map(f => `  - ${f}`).join('\n')}`,
    issues: fix.issues,
  };

  let message = formatConventionalCommit(commit);

  // Add co-author trailer
  message += `\n\nCo-Authored-By: ${systemName} <${systemEmail}>`;

  return message;
}

/**
 * Creates a git commit with the SEO fix
 */
export async function createSEOCommit(
  fix: SEOFixCommit,
  config?: CommitConfig
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const message = formatSEOCommitMessage(fix, config);

  if (config?.dryRun) {
    console.log('DRY RUN - Would create commit:');
    console.log('---');
    console.log(message);
    console.log('---');
    return { success: true, hash: 'dry-run' };
  }

  try {
    // Stage the files
    for (const file of fix.filesChanged) {
      await execAsync(`git add "${file}"`);
    }

    // Create the commit using heredoc for proper message formatting
    const { stdout } = await execAsync(`git commit -m "$(cat <<'EOF'
${message}
EOF
)"`);

    // Extract commit hash
    const hashMatch = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    const hash = hashMatch ? hashMatch[1] : undefined;

    return { success: true, hash };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Creates multiple commits, one per category
 */
export async function createSEOCommits(
  fixes: SEOFixCommit[],
  config?: CommitConfig
): Promise<{ commits: Array<{ fix: SEOFixCommit; result: Awaited<ReturnType<typeof createSEOCommit>> }> }> {
  const commits = [];

  for (const fix of fixes) {
    const result = await createSEOCommit(fix, config);
    commits.push({ fix, result });
  }

  return { commits };
}

/**
 * Checks if the current directory is a git repository
 */
export function isGitRepo(dir?: string): boolean {
  try {
    const cwd = dir ? { cwd: dir } : undefined;
    execSync('git rev-parse --is-inside-work-tree', { ...cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Initializes a git repository if not already initialized
 */
export async function ensureGitRepo(dir?: string): Promise<void> {
  if (!isGitRepo(dir)) {
    const cwd = dir ? { cwd: dir } : undefined;
    await execAsync('git init', cwd);
  }
}

/**
 * Gets the current git user config
 */
export function getGitUser(): { name?: string; email?: string } {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
    return { name, email };
  } catch {
    return {};
  }
}

/**
 * Detects if this is a GitHub Pages repository
 */
export function detectGitHubPages(dir: string): {
  isGitHubPages: boolean;
  type?: 'jekyll' | 'static' | 'docs' | 'custom';
  baseUrl?: string;
} {
  const fs = require('fs');
  const path = require('path');

  // Check for common GitHub Pages indicators
  const checks = [
    { file: '_config.yml', type: 'jekyll' as const },
    { file: 'docs/index.html', type: 'docs' as const },
    { file: 'CNAME', type: 'custom' as const },
    { file: '.nojekyll', type: 'static' as const },
    { file: 'index.html', type: 'static' as const },
  ];

  for (const check of checks) {
    const filePath = path.join(dir, check.file);
    if (fs.existsSync(filePath)) {
      // Try to extract base URL from _config.yml
      if (check.file === '_config.yml') {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const baseUrlMatch = content.match(/baseurl:\s*["']?([^"'\n]+)/);
          const urlMatch = content.match(/url:\s*["']?([^"'\n]+)/);
          return {
            isGitHubPages: true,
            type: check.type,
            baseUrl: urlMatch ? urlMatch[1] + (baseUrlMatch?.[1] || '') : undefined,
          };
        } catch {
          // Continue
        }
      }

      // Check for CNAME (custom domain)
      if (check.file === 'CNAME') {
        try {
          const cname = fs.readFileSync(path.join(dir, 'CNAME'), 'utf8').trim();
          return {
            isGitHubPages: true,
            type: check.type,
            baseUrl: `https://${cname}`,
          };
        } catch {
          // Continue
        }
      }

      return { isGitHubPages: true, type: check.type };
    }
  }

  // Check if remote is github.io
  try {
    const remote = execSync('git remote get-url origin', { cwd: dir, encoding: 'utf8' }).trim();
    if (remote.includes('github.io') || remote.includes('.github.')) {
      return { isGitHubPages: true, type: 'static' };
    }
  } catch {
    // Not a git repo or no remote
  }

  return { isGitHubPages: false };
}

/**
 * Generates a summary of commits made
 */
export function generateCommitSummary(
  commits: Array<{ fix: SEOFixCommit; result: { success: boolean; hash?: string; error?: string } }>
): string {
  const successful = commits.filter(c => c.result.success);
  const failed = commits.filter(c => !c.result.success);

  let summary = `## SEO Fix Commits Summary\n\n`;
  summary += `✅ ${successful.length} commits created\n`;
  if (failed.length > 0) {
    summary += `❌ ${failed.length} commits failed\n`;
  }
  summary += '\n';

  if (successful.length > 0) {
    summary += `### Commits Created\n\n`;
    for (const { fix, result } of successful) {
      const mapping = CATEGORY_MAPPING[fix.category] || { type: 'fix', scope: 'seo' };
      summary += `- \`${result.hash?.slice(0, 7) || 'N/A'}\` ${mapping.type}(${mapping.scope}): ${fix.description}\n`;
      summary += `  - Files: ${fix.filesChanged.join(', ')}\n`;
      summary += `  - Issues: ${fix.issues.join(', ')}\n`;
    }
  }

  if (failed.length > 0) {
    summary += `\n### Failed Commits\n\n`;
    for (const { fix, result } of failed) {
      summary += `- ❌ ${fix.description}: ${result.error}\n`;
    }
  }

  return summary;
}

// Export types for conventional commit categories
export const COMMIT_TYPES = [
  { type: 'fix', description: 'Bug fix (SEO issue correction)' },
  { type: 'feat', description: 'New feature (schema, OG tags, etc.)' },
  { type: 'docs', description: 'Documentation update' },
  { type: 'style', description: 'Code style changes (formatting)' },
  { type: 'refactor', description: 'Code restructuring' },
  { type: 'perf', description: 'Performance improvement' },
  { type: 'chore', description: 'Maintenance task' },
] as const;

export const SEO_SCOPES = [
  'seo',      // General SEO
  'meta',     // Meta tags (title, description)
  'og',       // Open Graph / Twitter Cards
  'schema',   // Structured data / JSON-LD
  'images',   // Image optimization
  'links',    // Link fixes
  'content',  // Content optimization
  'security', // Security headers
  'mobile',   // Mobile optimization
  'i18n',     // Internationalization
  'perf',     // Performance
] as const;
