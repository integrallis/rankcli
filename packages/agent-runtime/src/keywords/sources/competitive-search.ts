/**
 * Competitive Search Module
 *
 * Uses free APIs to find existing tools, competitors, and market intelligence.
 * Priority order: Brave Search > Serper.dev > GitHub > npm/PyPI
 */

export interface CompetitorTool {
  name: string;
  url: string;
  description: string;
  isPaid: boolean;
  pricing?: string;
  source: 'search' | 'github' | 'npm' | 'pypi' | 'hackernews';
  stars?: number;
  weeklyDownloads?: number;
}

export interface CompetitiveSearchResult {
  query: string;
  existingTools: CompetitorTool[];
  openSourceOptions: CompetitorTool[];
  marketInsights: {
    hasFreeSolutions: boolean;
    hasPaidSolutions: boolean;
    dominantPlayer?: string;
    marketGap?: string;
  };
  searchSource: string;
}

export interface CompetitiveSearchOptions {
  braveApiKey?: string;
  serperApiKey?: string;
  githubToken?: string;
  maxResults?: number;
}

/**
 * Search for existing tools and competitors
 */
export async function searchCompetitors(
  toolConcept: string,
  options: CompetitiveSearchOptions = {}
): Promise<CompetitiveSearchResult> {
  const { maxResults = 10 } = options;
  const existingTools: CompetitorTool[] = [];
  const openSourceOptions: CompetitorTool[] = [];
  let searchSource = 'none';

  // Try Brave Search first (2,000 free/month)
  if (options.braveApiKey) {
    try {
      const braveResults = await searchBrave(toolConcept, options.braveApiKey, maxResults);
      existingTools.push(...braveResults);
      searchSource = 'brave';
    } catch (e) {
      console.warn('Brave search failed:', e);
    }
  }

  // Fall back to Serper.dev (2,500 free/month)
  if (existingTools.length === 0 && options.serperApiKey) {
    try {
      const serperResults = await searchSerper(toolConcept, options.serperApiKey, maxResults);
      existingTools.push(...serperResults);
      searchSource = 'serper';
    } catch (e) {
      console.warn('Serper search failed:', e);
    }
  }

  // Always search GitHub for open source (unlimited free)
  try {
    const githubResults = await searchGitHub(toolConcept, options.githubToken, maxResults);
    openSourceOptions.push(...githubResults);
    if (!searchSource || searchSource === 'none') searchSource = 'github';
  } catch (e) {
    console.warn('GitHub search failed:', e);
  }

  // Search npm for JavaScript tools (unlimited free)
  try {
    const npmResults = await searchNpm(toolConcept, maxResults);
    openSourceOptions.push(...npmResults);
  } catch (e) {
    console.warn('npm search failed:', e);
  }

  // Analyze market
  const marketInsights = analyzeMarket(existingTools, openSourceOptions);

  return {
    query: toolConcept,
    existingTools,
    openSourceOptions,
    marketInsights,
    searchSource,
  };
}

/**
 * Brave Search API (2,000 free searches/month)
 */
async function searchBrave(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<CompetitorTool[]> {
  const searchQuery = `${query} tool OR ${query} free online`;

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=${maxResults}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status}`);
  }

  const data = await response.json();
  const results: CompetitorTool[] = [];

  for (const result of data.web?.results || []) {
    const isPaid = detectPaidTool(result.title, result.description, result.url);

    results.push({
      name: extractToolName(result.title),
      url: result.url,
      description: result.description || '',
      isPaid,
      pricing: isPaid ? extractPricing(result.description) : 'Free',
      source: 'search',
    });
  }

  return results;
}

/**
 * Serper.dev API (2,500 free searches/month)
 */
async function searchSerper(
  query: string,
  apiKey: string,
  maxResults: number
): Promise<CompetitorTool[]> {
  const searchQuery = `${query} tool OR ${query} free online`;

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: searchQuery,
      num: maxResults,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();
  const results: CompetitorTool[] = [];

  for (const result of data.organic || []) {
    const isPaid = detectPaidTool(result.title, result.snippet, result.link);

    results.push({
      name: extractToolName(result.title),
      url: result.link,
      description: result.snippet || '',
      isPaid,
      pricing: isPaid ? extractPricing(result.snippet) : 'Free',
      source: 'search',
    });
  }

  return results;
}

/**
 * GitHub Search API (60 req/hour unauthenticated, more with token)
 */
async function searchGitHub(
  query: string,
  token?: string,
  maxResults: number = 10
): Promise<CompetitorTool[]> {
  const searchQuery = `${query} in:name,description,readme`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'RankCLI-Keyword-Research',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${maxResults}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const results: CompetitorTool[] = [];

  for (const repo of data.items || []) {
    results.push({
      name: repo.name,
      url: repo.html_url,
      description: repo.description || '',
      isPaid: false,
      pricing: 'Open Source',
      source: 'github',
      stars: repo.stargazers_count,
    });
  }

  return results;
}

/**
 * npm Registry Search (unlimited, no auth required)
 */
async function searchNpm(
  query: string,
  maxResults: number = 10
): Promise<CompetitorTool[]> {
  const response = await fetch(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${maxResults}`,
    {
      headers: {
        'User-Agent': 'RankCLI-Keyword-Research',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`npm API error: ${response.status}`);
  }

  const data = await response.json();
  const results: CompetitorTool[] = [];

  for (const obj of data.objects || []) {
    const pkg = obj.package;
    results.push({
      name: pkg.name,
      url: `https://www.npmjs.com/package/${pkg.name}`,
      description: pkg.description || '',
      isPaid: false,
      pricing: 'Open Source (npm)',
      source: 'npm',
      weeklyDownloads: obj.downloads?.weekly,
    });
  }

  return results;
}

/**
 * Detect if a tool is paid based on text signals
 */
function detectPaidTool(title: string, description: string, url: string): boolean {
  const text = `${title} ${description} ${url}`.toLowerCase();

  // Strong paid signals
  const paidSignals = [
    'pricing', 'subscribe', 'premium', 'pro plan', 'enterprise',
    'per month', '/mo', 'free trial', 'buy now', 'purchase',
    'starting at', 'plans start', 'paid', 'upgrade',
  ];

  // Strong free signals
  const freeSignals = [
    'free online', '100% free', 'completely free', 'no signup',
    'open source', 'github.com', 'github.io', 'codepen',
  ];

  const hasPaidSignal = paidSignals.some(signal => text.includes(signal));
  const hasFreeSignal = freeSignals.some(signal => text.includes(signal));

  // If has free signal and no paid signal, it's free
  if (hasFreeSignal && !hasPaidSignal) return false;

  // If has paid signal, it's paid
  if (hasPaidSignal) return true;

  // Default: assume it might be paid
  return false;
}

/**
 * Extract tool name from search result title
 */
function extractToolName(title: string): string {
  // Remove common suffixes like "| Website", "- Free Online Tool", etc.
  return title
    .split(/[|\-–—]/)[0]
    .replace(/free|online|tool|generator|maker/gi, '')
    .trim() || title.trim();
}

/**
 * Extract pricing info from description
 */
function extractPricing(text: string): string | undefined {
  const priceMatch = text.match(/\$[\d,.]+(?:\s*\/\s*(?:mo|month|year|yr))?/i);
  if (priceMatch) return priceMatch[0];

  if (text.toLowerCase().includes('free trial')) return 'Free trial available';
  if (text.toLowerCase().includes('freemium')) return 'Freemium';

  return undefined;
}

/**
 * Analyze market based on search results
 */
function analyzeMarket(
  existingTools: CompetitorTool[],
  openSourceOptions: CompetitorTool[]
): CompetitiveSearchResult['marketInsights'] {
  const hasFreeSolutions = existingTools.some(t => !t.isPaid) || openSourceOptions.length > 0;
  const hasPaidSolutions = existingTools.some(t => t.isPaid);

  // Find dominant player (most stars on GitHub or appears in multiple results)
  let dominantPlayer: string | undefined;
  if (openSourceOptions.length > 0) {
    const topByStars = openSourceOptions
      .filter(t => t.stars)
      .sort((a, b) => (b.stars || 0) - (a.stars || 0))[0];
    if (topByStars && (topByStars.stars || 0) > 1000) {
      dominantPlayer = topByStars.name;
    }
  }

  // Identify market gap
  let marketGap: string | undefined;
  if (!hasFreeSolutions && hasPaidSolutions) {
    marketGap = 'No free alternatives exist - opportunity to capture market with free tool';
  } else if (openSourceOptions.length > 0 && !existingTools.some(t => !t.isPaid)) {
    marketGap = 'Open source libraries exist but no easy-to-use web tool - wrap library in simple UI';
  }

  return {
    hasFreeSolutions,
    hasPaidSolutions,
    dominantPlayer,
    marketGap,
  };
}

/**
 * Search for specific format converters (e.g., "X to Mermaid converter")
 */
export async function searchFormatConverters(
  targetFormat: string,
  options: CompetitiveSearchOptions = {}
): Promise<{
  sourceFormats: string[];
  existingConverters: CompetitorTool[];
  opportunities: string[];
}> {
  // Common diagram/document formats to check
  const commonFormats = [
    'flowchart', 'uml', 'plantuml', 'draw.io', 'lucidchart',
    'visio', 'graphviz', 'dot', 'json', 'yaml', 'csv',
    'excel', 'markdown', 'text', 'ascii', 'png', 'svg',
  ];

  const existingConverters: CompetitorTool[] = [];
  const opportunities: string[] = [];

  for (const format of commonFormats) {
    const query = `${format} to ${targetFormat} converter`;

    try {
      const result = await searchCompetitors(query, options);

      if (result.existingTools.length > 0 || result.openSourceOptions.length > 0) {
        existingConverters.push(...result.existingTools.slice(0, 2));
        existingConverters.push(...result.openSourceOptions.slice(0, 2));
      } else {
        // No converter exists - opportunity!
        opportunities.push(`${format} to ${targetFormat}`);
      }
    } catch {
      // Skip on error
    }

    // Rate limit: wait 100ms between searches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    sourceFormats: commonFormats,
    existingConverters,
    opportunities,
  };
}

/**
 * Search Hacker News for tool discussions
 */
export async function searchHackerNews(
  query: string,
  maxResults: number = 10
): Promise<Array<{
  title: string;
  url: string;
  points: number;
  comments: number;
}>> {
  const response = await fetch(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${maxResults}`,
    {
      headers: {
        'User-Agent': 'RankCLI-Keyword-Research',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HN API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.hits || []).map((hit: any) => ({
    title: hit.title,
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    points: hit.points || 0,
    comments: hit.num_comments || 0,
  }));
}
