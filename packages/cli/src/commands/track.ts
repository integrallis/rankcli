import ora from 'ora';
import chalk from 'chalk';
import { table } from 'table';
import { RankTracker, TIER_LIMITS } from '@rankcli/agent-runtime';
import { isLoggedIn, getUserInfo, getAuthenticatedClient, WEB_APP_URL } from '../lib/config.js';
import { showUpsell, tierFromPlanId } from '../lib/upsell.js';

// ============================================================================
// Types
// ============================================================================

export interface TrackAddOptions {
  keywords?: string[];
  url?: string;
  searchEngine?: 'google' | 'bing';
  country?: string;
  language?: string;
}

export interface TrackStatusOptions {
  url?: string;
  output?: 'text' | 'json';
}

export interface TrackHistoryOptions {
  url?: string;
  keyword?: string;
  days?: number;
  output?: 'text' | 'json';
}

export interface TrackExportOptions {
  url?: string;
  format?: 'csv' | 'json';
  days?: number;
}

export interface TrackCheckOptions {
  url?: string;
  force?: boolean;
}

export interface TrackResult {
  success: boolean;
  error?: string;
  addedCount?: number;
  keywords?: Array<{
    keyword: string;
    currentPosition: number | null;
    previousPosition: number | null;
    bestPosition: number | null;
    change: number;
    lastChecked: Date | null;
  }>;
  history?: Array<{
    position: number | null;
    url: string | null;
    recordedAt: Date;
  }>;
  data?: string;
  rateLimited?: boolean;
  checkResults?: Array<{
    keyword: string;
    position: number | null;
    url: string | null;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getProjectForUrl(url: string): Promise<{ id: string; domain: string; lastRankCheckAt: Date | null } | null> {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return null;

  const { userId } = getUserInfo();
  if (!userId) return null;

  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace(/^www\./, '');

  const { data, error } = await supabase
    .from('projects')
    .select('id, domain, last_rank_check_at')
    .eq('user_id', userId)
    .eq('domain', domain)
    .single();

  if (error || !data) {
    // Create project if it doesn't exist
    const { data: newProject, error: createError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: domain,
        url: url,
        domain: domain,
      })
      .select('id, domain, last_rank_check_at')
      .single();

    if (createError || !newProject) return null;
    return {
      id: newProject.id,
      domain: newProject.domain,
      lastRankCheckAt: newProject.last_rank_check_at ? new Date(newProject.last_rank_check_at) : null,
    };
  }

  return {
    id: data.id,
    domain: data.domain,
    lastRankCheckAt: data.last_rank_check_at ? new Date(data.last_rank_check_at) : null,
  };
}

function getTierLimits(tier: string): { maxKeywords: number; checksPerDay: number } {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  return {
    maxKeywords: limits.maxKeywords,
    checksPerDay: limits.checksPerDay,
  };
}

function formatPosition(pos: number | null): string {
  if (pos === null) return chalk.dim('N/A');
  if (pos <= 3) return chalk.green.bold(`#${pos}`);
  if (pos <= 10) return chalk.green(`#${pos}`);
  if (pos <= 20) return chalk.yellow(`#${pos}`);
  if (pos <= 50) return chalk.red(`#${pos}`);
  return chalk.red.dim(`#${pos}`);
}

function formatChange(change: number): string {
  if (change === 0) return chalk.dim('→');
  if (change > 0) return chalk.green(`↑${change}`);
  return chalk.red(`↓${Math.abs(change)}`);
}

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * Add keywords to track
 */
export async function trackAdd(options: TrackAddOptions): Promise<TrackResult> {
  // Validate input
  if (!options.keywords || options.keywords.length === 0) {
    console.log(chalk.yellow('\n⚠️  Please provide keywords to track:'));
    console.log('   rankcli track add "seo tool" "cli seo" --url https://your-site.com\n');
    return { success: false, error: 'No keywords provided' };
  }

  if (!options.url) {
    console.log(chalk.yellow('\n⚠️  Please provide a URL to track:'));
    console.log('   rankcli track add "keyword" --url https://your-site.com\n');
    return { success: false, error: 'No URL provided' };
  }

  // Check authentication
  if (!isLoggedIn()) {
    console.log(chalk.yellow('\n⚠️  Please log in to track keywords:'));
    console.log('   rankcli login\n');
    return { success: false, error: 'Not logged in' };
  }

  const spinner = ora('Adding keywords to track...').start();

  try {
    // Get or create project
    const project = await getProjectForUrl(options.url);
    if (!project) {
      spinner.fail('Could not find or create project');
      return { success: false, error: 'Project not found' };
    }

    // Check tier limits
    // The plan id ('pro_annual', 'pro_founding', ...), not its display name: 'pro annual' matched
    // no tier and every annual or founding subscriber got Free's limits.
    const tier = tierFromPlanId(getUserInfo().planId) ?? 'free';
    const { maxKeywords } = getTierLimits(tier);

    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      spinner.fail('Could not connect to database');
      return { success: false, error: 'Database connection failed' };
    }

    // Count existing keywords
    const { count } = await supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('is_active', true);

    const existingCount = count || 0;
    const newCount = options.keywords.length;

    if (existingCount + newCount > maxKeywords) {
      spinner.fail(`Keyword limit reached (${existingCount}/${maxKeywords})`);
      showUpsell('keyword_limit', { tier, current: existingCount, max: maxKeywords });
      return { success: false, error: `Keyword limit reached. Upgrade to track more keywords.` };
    }

    // Add keywords
    const keywordRecords = options.keywords.map(keyword => ({
      project_id: project.id,
      keyword: keyword.toLowerCase().trim(),
      search_engine: options.searchEngine || 'google',
      country: options.country || 'US',
      language: options.language || 'en',
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('keywords')
      .upsert(keywordRecords, {
        onConflict: 'project_id,keyword',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      spinner.fail(`Failed to add keywords: ${error.message}`);
      return { success: false, error: error.message };
    }

    const addedCount = data?.length || 0;
    spinner.succeed(`Added ${addedCount} keyword(s) to track`);

    console.log(chalk.dim(`\nTracking: ${options.keywords.join(', ')}`));
    console.log(chalk.dim(`For: ${project.domain}`));
    console.log(chalk.cyan(`\nRun 'rankcli track check --url ${options.url}' to check current positions.\n`));

    return { success: true, addedCount };
  } catch (error) {
    spinner.fail('Failed to add keywords');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Show current keyword rankings
 */
export async function trackStatus(options: TrackStatusOptions): Promise<TrackResult> {
  if (!options.url) {
    console.log(chalk.yellow('\n⚠️  Please provide a URL:'));
    console.log('   rankcli track status --url https://your-site.com\n');
    return { success: false, error: 'No URL provided' };
  }

  if (!isLoggedIn()) {
    console.log(chalk.yellow('\n⚠️  Please log in to view tracking:'));
    console.log('   rankcli login\n');
    return { success: false, error: 'Not logged in' };
  }

  const spinner = ora('Loading keyword rankings...').start();

  try {
    const project = await getProjectForUrl(options.url);
    if (!project) {
      spinner.fail('Project not found');
      return { success: false, error: 'Project not found' };
    }

    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      spinner.fail('Could not connect to database');
      return { success: false, error: 'Database connection failed' };
    }

    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_active', true)
      .order('current_position', { ascending: true, nullsFirst: false });

    if (error) {
      spinner.fail(`Failed to load keywords: ${error.message}`);
      return { success: false, error: error.message };
    }

    spinner.succeed(`Loaded ${data?.length || 0} tracked keywords`);

    if (!data || data.length === 0) {
      console.log(chalk.dim('\nNo keywords tracked yet.'));
      console.log(chalk.cyan(`Run 'rankcli track add "keyword" --url ${options.url}' to start tracking.\n`));
      return { success: true, keywords: [] };
    }

    const keywords = data.map(row => ({
      keyword: row.keyword,
      currentPosition: row.current_position,
      previousPosition: row.previous_position,
      bestPosition: row.best_position,
      change: (row.previous_position || 0) - (row.current_position || 0),
      lastChecked: row.last_checked ? new Date(row.last_checked) : null,
    }));

    if (options.output === 'json') {
      console.log(JSON.stringify({ keywords }, null, 2));
    } else {
      console.log('\n' + chalk.bold('📊 Keyword Rankings'));
      console.log('═'.repeat(60));

      const tableData = [
        ['Keyword', 'Position', 'Best', 'Change', 'Last Checked'],
        ...keywords.map(kw => [
          kw.keyword,
          formatPosition(kw.currentPosition),
          formatPosition(kw.bestPosition),
          formatChange(kw.change),
          kw.lastChecked ? kw.lastChecked.toLocaleDateString() : 'Never',
        ]),
      ];

      console.log(table(tableData, {
        border: {
          topBody: '─',
          topJoin: '┬',
          topLeft: '┌',
          topRight: '┐',
          bottomBody: '─',
          bottomJoin: '┴',
          bottomLeft: '└',
          bottomRight: '┘',
          bodyLeft: '│',
          bodyRight: '│',
          bodyJoin: '│',
          joinBody: '─',
          joinLeft: '├',
          joinRight: '┤',
          joinJoin: '┼',
        },
      }));
    }

    return { success: true, keywords };
  } catch (error) {
    spinner.fail('Failed to load rankings');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Show keyword position history
 */
export async function trackHistory(options: TrackHistoryOptions): Promise<TrackResult> {
  if (!options.url) {
    return { success: false, error: 'No URL provided' };
  }

  if (!options.keyword) {
    console.log(chalk.yellow('\n⚠️  Please provide a keyword:'));
    console.log('   rankcli track history --keyword "seo tool" --url https://your-site.com\n');
    return { success: false, error: 'No keyword provided' };
  }

  if (!isLoggedIn()) {
    return { success: false, error: 'Not logged in' };
  }

  const spinner = ora(`Loading history for "${options.keyword}"...`).start();

  try {
    const project = await getProjectForUrl(options.url);
    if (!project) {
      spinner.fail('Project not found');
      return { success: false, error: 'Project not found' };
    }

    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      spinner.fail('Could not connect to database');
      return { success: false, error: 'Database connection failed' };
    }

    // Find keyword
    const { data: keywordData } = await supabase
      .from('keywords')
      .select('id, keyword')
      .eq('project_id', project.id)
      .eq('keyword', options.keyword.toLowerCase().trim())
      .single();

    if (!keywordData) {
      spinner.fail('Keyword not found');
      return { success: false, error: 'Keyword not found' };
    }

    // Get history
    const days = options.days || 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // One row per `rankcli track check` (keyword_position_history).
    const { data: historyData, error } = await supabase
      .from('keyword_position_history')
      .select('position, url, checked_at')
      .eq('keyword_id', keywordData.id)
      .gte('checked_at', cutoff.toISOString())
      .order('checked_at', { ascending: false });

    if (error) {
      spinner.fail(`Failed to load history: ${error.message}`);
      return { success: false, error: error.message };
    }

    spinner.succeed(`Loaded ${historyData?.length || 0} data points`);

    const history = (historyData || []).map(row => ({
      position: row.position,
      url: row.url,
      recordedAt: new Date(row.checked_at),
    }));

    if (options.output === 'json') {
      console.log(JSON.stringify({ keyword: options.keyword, history }, null, 2));
    } else {
      console.log('\n' + chalk.bold(`📈 History: "${options.keyword}"`));
      console.log('═'.repeat(50));

      if (history.length === 0) {
        console.log(chalk.dim(`\nNo checks recorded yet. Run 'rankcli track check --url <your site>' to record one.\n`));
      } else {
        // Show sparkline
        const positions = history.slice(0, 30).reverse().map(h => h.position || 101);
        const sparkline = positions.map(p => {
          if (p <= 10) return chalk.green('█');
          if (p <= 20) return chalk.yellow('▓');
          if (p <= 50) return chalk.red('▒');
          return chalk.dim('░');
        }).join('');

        console.log(`\n  ${sparkline}  (last ${positions.length} checks)`);
        console.log(chalk.dim('  ← older                    newer →\n'));

        // Show recent positions
        const recent = history.slice(0, 10);
        for (const entry of recent) {
          console.log(`  ${entry.recordedAt.toLocaleDateString()}  ${formatPosition(entry.position)}`);
        }
      }
    }

    return { success: true, history };
  } catch (error) {
    spinner.fail('Failed to load history');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Export tracking data
 */
export async function trackExport(options: TrackExportOptions): Promise<TrackResult> {
  if (!options.url) {
    return { success: false, error: 'No URL provided' };
  }

  if (!isLoggedIn()) {
    return { success: false, error: 'Not logged in' };
  }

  const spinner = ora('Exporting data...').start();

  try {
    const project = await getProjectForUrl(options.url);
    if (!project) {
      spinner.fail('Project not found');
      return { success: false, error: 'Project not found' };
    }

    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      spinner.fail('Could not connect to database');
      return { success: false, error: 'Database connection failed' };
    }

    const { data: keywords, error } = await supabase
      .from('keywords')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_active', true);

    if (error) {
      spinner.fail(`Failed to export: ${error.message}`);
      return { success: false, error: error.message };
    }

    const format = options.format || 'csv';

    if (format === 'json') {
      const data = JSON.stringify({
        domain: project.domain,
        exportedAt: new Date().toISOString(),
        keywords: keywords?.map(kw => ({
          keyword: kw.keyword,
          currentPosition: kw.current_position,
          bestPosition: kw.best_position,
          lastChecked: kw.last_checked,
        })),
      }, null, 2);

      spinner.succeed('Exported as JSON');
      console.log(data);
      return { success: true, data };
    } else {
      // CSV format
      const rows = ['Keyword,Current Position,Best Position,Last Checked,Trend'];
      
      for (const kw of keywords || []) {
        const trend = (kw.previous_position || 0) - (kw.current_position || 0);
        const trendStr = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
        
        rows.push([
          `"${kw.keyword}"`,
          kw.current_position?.toString() || 'N/A',
          kw.best_position?.toString() || 'N/A',
          kw.last_checked || 'Never',
          trendStr,
        ].join(','));
      }

      const data = rows.join('\n');
      spinner.succeed('Exported as CSV');
      console.log(data);
      return { success: true, data };
    }
  } catch (error) {
    spinner.fail('Failed to export');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check current rankings (calls SERP API)
 */
export async function trackCheck(options: TrackCheckOptions): Promise<TrackResult> {
  if (!options.url) {
    console.log(chalk.yellow('\n⚠️  Please provide a URL:'));
    console.log('   rankcli track check --url https://your-site.com\n');
    return { success: false, error: 'No URL provided' };
  }

  if (!isLoggedIn()) {
    console.log(chalk.yellow('\n⚠️  Please log in to check rankings:'));
    console.log('   rankcli login\n');
    return { success: false, error: 'Not logged in' };
  }

  try {
    const project = await getProjectForUrl(options.url);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Check rate limit
    // The plan id ('pro_annual', 'pro_founding', ...), not its display name: 'pro annual' matched
    // no tier and every annual or founding subscriber got Free's limits.
    const tier = tierFromPlanId(getUserInfo().planId) ?? 'free';
    const { checksPerDay } = getTierLimits(tier);

    if (!options.force && project.lastRankCheckAt) {
      const hoursSinceCheck = (Date.now() - project.lastRankCheckAt.getTime()) / (1000 * 60 * 60);
      const minHoursBetweenChecks = 24 / checksPerDay;

      if (hoursSinceCheck < minHoursBetweenChecks) {
        const nextCheck = new Date(project.lastRankCheckAt.getTime() + minHoursBetweenChecks * 60 * 60 * 1000);
        console.log(chalk.yellow(`\n⚠️  Rate limited. Next check available: ${nextCheck.toLocaleString()}`));
        console.log(chalk.dim(`   Your tier (${tier}) allows ${checksPerDay} check(s) per day.\n`));
        return { success: true, rateLimited: true };
      }
    }

    const spinner = ora('Checking current rankings...').start();

    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      spinner.fail('Could not connect to database');
      return { success: false, error: 'Database connection failed' };
    }

    // Get keywords
    const { data: keywords } = await supabase
      .from('keywords')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_active', true);

    if (!keywords || keywords.length === 0) {
      spinner.fail('No keywords to check');
      return { success: false, error: 'No keywords tracked' };
    }

    // Check SERP API key
    const serpApiKey = process.env.VALUESERP_API_KEY || process.env.SERPAPI_KEY;
    
    if (!serpApiKey) {
      spinner.warn('No SERP API key configured');
      console.log(chalk.yellow('\n⚠️  Set VALUESERP_API_KEY or SERPAPI_KEY to check live rankings.'));
      console.log(chalk.dim('   Get a key at https://www.valueserp.com or https://serpapi.com\n'));
      return { success: false, error: 'No SERP API key' };
    }

    // Create tracker
    const tracker = new RankTracker({
      supabase,
      serpConfig: {
        provider: process.env.VALUESERP_API_KEY ? 'valueserp' : 'serpapi',
        apiKey: serpApiKey,
      },
    });

    // Check rankings
    const results = await tracker.checkRankings(project.id, project.domain);

    spinner.succeed(`Checked ${results.length} keyword(s)`);

    // Display results
    console.log('\n' + chalk.bold('🔍 Rank Check Results'));
    console.log('═'.repeat(50));

    for (const result of results) {
      const posStr = formatPosition(result.position);
      console.log(`  ${result.keyword}: ${posStr}`);
      if (result.serpFeatures.length > 0) {
        console.log(chalk.dim(`    SERP features: ${result.serpFeatures.map(f => f.type).join(', ')}`));
      }
    }

    console.log('');

    return {
      success: true,
      checkResults: results.map(r => ({
        keyword: r.keyword,
        position: r.position,
        url: r.url,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
