/**
 * PR Helper
 *
 * Creates pull requests for SEO fixes using GitHub CLI.
 * Generates formatted PR titles, bodies, and handles branch management.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SEOFixSummary {
  category: string;
  issues: string[];
  filesCount: number;
}

export interface PRConfig {
  scoreBefore?: number;
  scoreAfter?: number;
  reviewers?: string[];
  assignees?: string[];
  draft?: boolean;
}

export interface PRDescription {
  title: string;
  body: string;
  labels: string[];
  reviewers?: string[];
  assignees?: string[];
}

export interface CreatePROptions {
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  createBranch?: boolean;
  labels?: string[];
  reviewers?: string[];
  assignees?: string[];
  draft?: boolean;
  dryRun?: boolean;
}

export interface PRResult {
  success: boolean;
  url?: string;
  number?: number;
  error?: string;
  dryRun?: boolean;
}

export interface ExecOptions {
  execAsync?: typeof execAsync;
}

/**
 * Maps categories to commit types and scopes
 */
const CATEGORY_MAPPING: Record<string, { type: string; scope: string; displayName: string }> = {
  'crawlability': { type: 'fix', scope: 'seo', displayName: 'Crawlability' },
  'indexability': { type: 'fix', scope: 'seo', displayName: 'Indexability' },
  'on-page': { type: 'fix', scope: 'meta', displayName: 'On-Page' },
  'content': { type: 'fix', scope: 'content', displayName: 'Content' },
  'links': { type: 'fix', scope: 'links', displayName: 'Links' },
  'images': { type: 'fix', scope: 'images', displayName: 'Images' },
  'structured-data': { type: 'feat', scope: 'schema', displayName: 'Structured Data' },
  'performance': { type: 'perf', scope: 'web', displayName: 'Performance' },
  'security': { type: 'fix', scope: 'security', displayName: 'Security' },
  'mobile': { type: 'fix', scope: 'mobile', displayName: 'Mobile' },
  'international': { type: 'fix', scope: 'i18n', displayName: 'International' },
  'social-meta': { type: 'feat', scope: 'og', displayName: 'Social Meta' },
};

/**
 * Formats a PR title based on the fixes
 */
export function formatPRTitle(fixes: SEOFixSummary[]): string {
  if (fixes.length === 0) {
    return 'fix(seo): SEO audit fixes';
  }

  const totalIssues = fixes.reduce((sum, f) => sum + f.issues.length, 0);
  const categories = [...new Set(fixes.map(f => f.category))];

  // Determine type and scope
  let type = 'fix';
  let scope = 'seo';

  if (categories.length === 1) {
    const mapping = CATEGORY_MAPPING[categories[0]];
    if (mapping) {
      type = mapping.type;
      scope = mapping.scope;
    }
  }

  const issueText = totalIssues === 1 ? '1 issue fixed' : `${totalIssues} issues fixed`;
  return `${type}(${scope}): SEO improvements - ${issueText}`;
}

/**
 * Formats the PR body with detailed information
 */
export function formatPRBody(
  fixes: SEOFixSummary[],
  options?: { scoreBefore?: number; scoreAfter?: number }
): string {
  const totalIssues = fixes.reduce((sum, f) => sum + f.issues.length, 0);
  const totalFiles = fixes.reduce((sum, f) => sum + f.filesCount, 0);
  const uniqueFiles = new Set(fixes.flatMap(f => Array(f.filesCount).fill(0))).size || totalFiles;

  let body = '## Summary\n';
  body += `This PR fixes ${totalIssues} SEO issue${totalIssues === 1 ? '' : 's'} across ${totalFiles} file${totalFiles === 1 ? '' : 's'}.\n\n`;

  // Score improvement if provided
  if (options?.scoreBefore !== undefined && options?.scoreAfter !== undefined) {
    const improvement = options.scoreAfter - options.scoreBefore;
    const sign = improvement >= 0 ? '+' : '';
    body += `### Score Improvement\n`;
    body += `- Before: ${options.scoreBefore}/100\n`;
    body += `- After: ${options.scoreAfter}/100\n`;
    body += `- Change: **${sign}${improvement}** points\n\n`;
  }

  // Category breakdown
  if (fixes.length > 0) {
    body += '### Issues Fixed\n\n';

    for (const fix of fixes) {
      const mapping = CATEGORY_MAPPING[fix.category] || { displayName: fix.category };
      body += `**${mapping.displayName}**\n`;
      for (const issue of fix.issues) {
        body += `- \`${issue}\`\n`;
      }
      body += '\n';
    }
  }

  // Test plan
  body += '## Test plan\n';
  body += '- [ ] Run SEO audit to verify fixes\n';
  body += '- [ ] Check pages render correctly\n';
  body += '- [ ] Validate structured data (if applicable)\n';
  body += '- [ ] Test social share previews (if OG tags changed)\n';
  body += '\n';

  // Footer
  body += '---\n';
  body += '🤖 Generated with [RankCLI](https://rankcli.dev)\n';

  return body;
}

/**
 * Generates complete PR description including title, body, and labels
 */
export function generatePRDescription(
  fixes: SEOFixSummary[],
  config?: PRConfig
): PRDescription {
  const title = formatPRTitle(fixes);
  const body = formatPRBody(fixes, {
    scoreBefore: config?.scoreBefore,
    scoreAfter: config?.scoreAfter,
  });

  const labels = ['seo', 'automated'];

  // Add category-specific labels
  const categories = [...new Set(fixes.map(f => f.category))];
  for (const category of categories) {
    const mapping = CATEGORY_MAPPING[category];
    if (mapping && !labels.includes(mapping.scope)) {
      labels.push(mapping.scope);
    }
  }

  return {
    title,
    body,
    labels,
    reviewers: config?.reviewers,
    assignees: config?.assignees,
  };
}

/**
 * Creates a pull request using GitHub CLI
 */
export async function createPullRequest(
  options: CreatePROptions,
  deps?: ExecOptions
): Promise<PRResult> {
  const run = deps?.execAsync || execAsync;

  // Dry run mode
  if (options.dryRun) {
    console.log('DRY RUN - Would create PR:');
    console.log(`Title: ${options.title}`);
    console.log(`Base: ${options.baseBranch}`);
    console.log(`Head: ${options.headBranch}`);
    console.log(`Labels: ${options.labels?.join(', ') || 'none'}`);
    console.log('---');
    console.log(options.body);
    console.log('---');
    return { success: true, dryRun: true };
  }

  try {
    // Create branch if needed
    if (options.createBranch) {
      await run(`git checkout -b ${options.headBranch}`);
    }

    // Build gh pr create command
    let cmd = `gh pr create --title "${options.title.replace(/"/g, '\\"')}"`;
    cmd += ` --base "${options.baseBranch}"`;
    cmd += ` --head "${options.headBranch}"`;

    // Add labels
    if (options.labels && options.labels.length > 0) {
      cmd += ` --label "${options.labels.join(',')}"`;
    }

    // Add reviewers
    if (options.reviewers && options.reviewers.length > 0) {
      cmd += ` --reviewer "${options.reviewers.join(',')}"`;
    }

    // Add assignees
    if (options.assignees && options.assignees.length > 0) {
      cmd += ` --assignee "${options.assignees.join(',')}"`;
    }

    // Draft PR
    if (options.draft) {
      cmd += ' --draft';
    }

    // Add body using heredoc
    cmd += ` --body "$(cat <<'EOF'\n${options.body}\nEOF\n)"`;

    const { stdout } = await run(cmd);
    const url = stdout.trim();

    // Extract PR number from URL
    const numberMatch = url.match(/\/pull\/(\d+)/);
    const number = numberMatch ? parseInt(numberMatch[1], 10) : undefined;

    return {
      success: true,
      url,
      number,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Generates a branch name for SEO fixes
 */
export function generateBranchName(prefix = 'seo-fixes'): string {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Checks if gh CLI is available and authenticated
 */
export async function checkGitHubCLI(deps?: ExecOptions): Promise<{
  available: boolean;
  authenticated: boolean;
  error?: string;
}> {
  const run = deps?.execAsync || execAsync;

  try {
    // Check if gh is installed
    await run('gh --version');

    // Check if authenticated
    await run('gh auth status');

    return { available: true, authenticated: true };
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('command not found') || message.includes('not recognized')) {
      return { available: false, authenticated: false, error: 'GitHub CLI (gh) is not installed' };
    }

    if (message.includes('not logged') || message.includes('auth')) {
      return { available: true, authenticated: false, error: 'GitHub CLI is not authenticated' };
    }

    return { available: false, authenticated: false, error: message };
  }
}
