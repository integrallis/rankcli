// Google Search Console Integration
// Verification injection + API data fetching

import * as fs from 'fs';
import * as path from 'path';

export interface GSCConfig {
  verificationCode?: string; // For meta tag verification
  siteUrl: string; // https://example.com or sc-domain:example.com
  credentials?: GSCCredentials;
}

export interface GSCCredentials {
  type: 'service_account' | 'oauth';
  // Service account JSON or OAuth tokens
  clientEmail?: string;
  privateKey?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface GSCQueryResult {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page?: string;
}

export interface GSCPerformanceData {
  startDate: string;
  endDate: string;
  queries: GSCQueryResult[];
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
}

export interface QuickWin {
  query: string;
  currentPosition: number;
  impressions: number;
  clicks: number;
  ctr: number;
  opportunity: 'page-1-close' | 'low-ctr' | 'high-impression';
  suggestedAction: string;
  potentialGain: number; // Estimated additional clicks
}

/**
 * Generate Search Console verification meta tag
 */
export function generateGSCVerificationTag(verificationCode: string): string {
  return `<meta name="google-site-verification" content="${verificationCode}" />`;
}

/**
 * Inject GSC verification into project
 */
export async function injectGSCVerification(
  projectPath: string,
  verificationCode: string
): Promise<{ success: boolean; file?: string; message: string }> {
  // Find index.html or equivalent
  const indexPaths = [
    path.join(projectPath, 'index.html'),
    path.join(projectPath, 'public', 'index.html'),
    path.join(projectPath, 'app', 'layout.tsx'),
    path.join(projectPath, 'src', 'app', 'layout.tsx'),
  ];

  for (const indexPath of indexPaths) {
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf-8');

      // Check if already verified
      if (content.includes('google-site-verification')) {
        return { success: true, file: indexPath, message: 'GSC verification already present' };
      }

      const verificationTag = generateGSCVerificationTag(verificationCode);

      // For HTML files
      if (indexPath.endsWith('.html')) {
        content = content.replace('<head>', `<head>\n    ${verificationTag}`);
        fs.writeFileSync(indexPath, content);
        return { success: true, file: indexPath, message: 'GSC verification tag added' };
      }

      // For React/Next.js layout files
      if (indexPath.endsWith('.tsx') || indexPath.endsWith('.jsx')) {
        // Add to <head> section
        if (content.includes('<head>')) {
          content = content.replace(
            '<head>',
            `<head>\n        <meta name="google-site-verification" content="${verificationCode}" />`
          );
          fs.writeFileSync(indexPath, content);
          return { success: true, file: indexPath, message: 'GSC verification tag added to layout' };
        }
      }
    }
  }

  return {
    success: false,
    message: 'Could not find index.html or layout file. Add manually: ' + generateGSCVerificationTag(verificationCode),
  };
}

/**
 * Build GSC API request (for use with Google APIs client)
 * User needs to set up OAuth or service account credentials
 */
export function buildGSCApiRequest(
  siteUrl: string,
  startDate: string,
  endDate: string,
  options: {
    dimensions?: ('query' | 'page' | 'country' | 'device' | 'date')[];
    rowLimit?: number;
    startRow?: number;
  } = {}
): object {
  return {
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: options.dimensions || ['query'],
      rowLimit: options.rowLimit || 1000,
      startRow: options.startRow || 0,
    },
  };
}

/**
 * Parse GSC API response into our format
 */
export function parseGSCResponse(response: any): GSCPerformanceData {
  const rows = response.rows || [];

  const queries: GSCQueryResult[] = rows.map((row: any) => ({
    query: row.keys?.[0] || '',
    page: row.keys?.[1],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));

  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition = queries.length > 0
    ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length
    : 0;

  return {
    startDate: response.startDate || '',
    endDate: response.endDate || '',
    queries,
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
  };
}

/**
 * Identify quick wins from GSC data
 */
export function identifyQuickWins(data: GSCPerformanceData): QuickWin[] {
  const quickWins: QuickWin[] = [];

  for (const query of data.queries) {
    // Skip very low impression queries
    if (query.impressions < 10) continue;

    // Quick Win 1: Position 11-20 (almost page 1)
    if (query.position >= 11 && query.position <= 20) {
      const potentialGain = Math.round(query.impressions * 0.1); // ~10% CTR if on page 1
      quickWins.push({
        ...query,
        currentPosition: query.position,
        opportunity: 'page-1-close',
        suggestedAction: `Improve content for "${query.query}" - you're at position ${Math.round(query.position)}, just off page 1!`,
        potentialGain,
      });
    }

    // Quick Win 2: High impressions but low CTR (position 1-10)
    if (query.position <= 10 && query.impressions > 100 && query.ctr < 0.02) {
      const expectedCtr = getExpectedCtr(query.position);
      const potentialGain = Math.round(query.impressions * (expectedCtr - query.ctr));
      if (potentialGain > 5) {
        quickWins.push({
          ...query,
          currentPosition: query.position,
          opportunity: 'low-ctr',
          suggestedAction: `Improve title/description for "${query.query}" - CTR is ${(query.ctr * 100).toFixed(1)}% vs expected ${(expectedCtr * 100).toFixed(1)}%`,
          potentialGain,
        });
      }
    }

    // Quick Win 3: High impressions, position 4-10 (could be #1)
    if (query.position >= 4 && query.position <= 10 && query.impressions > 500) {
      const potentialGain = Math.round(query.impressions * 0.15); // Gain from reaching #1
      quickWins.push({
        ...query,
        currentPosition: query.position,
        opportunity: 'high-impression',
        suggestedAction: `Push "${query.query}" to top 3 - high traffic potential at ${query.impressions} impressions/month`,
        potentialGain,
      });
    }
  }

  // Sort by potential gain
  quickWins.sort((a, b) => b.potentialGain - a.potentialGain);

  return quickWins.slice(0, 20); // Top 20 quick wins
}

/**
 * Expected CTR by position (industry average)
 */
function getExpectedCtr(position: number): number {
  const ctrByPosition: Record<number, number> = {
    1: 0.28,
    2: 0.15,
    3: 0.11,
    4: 0.08,
    5: 0.06,
    6: 0.05,
    7: 0.04,
    8: 0.03,
    9: 0.03,
    10: 0.02,
  };
  return ctrByPosition[Math.round(position)] || 0.01;
}

/**
 * Compare two periods to identify trends
 */
export function comparePeriods(
  current: GSCPerformanceData,
  previous: GSCPerformanceData
): {
  improved: GSCQueryResult[];
  declined: GSCQueryResult[];
  newKeywords: GSCQueryResult[];
  lostKeywords: GSCQueryResult[];
  summary: {
    clicksChange: number;
    impressionsChange: number;
    avgPositionChange: number;
  };
} {
  const previousMap = new Map(previous.queries.map(q => [q.query, q]));
  const currentMap = new Map(current.queries.map(q => [q.query, q]));

  const improved: GSCQueryResult[] = [];
  const declined: GSCQueryResult[] = [];
  const newKeywords: GSCQueryResult[] = [];
  const lostKeywords: GSCQueryResult[] = [];

  // Check current queries
  for (const query of current.queries) {
    const prev = previousMap.get(query.query);
    if (!prev) {
      newKeywords.push(query);
    } else if (query.position < prev.position - 2) {
      improved.push(query);
    } else if (query.position > prev.position + 2) {
      declined.push(query);
    }
  }

  // Check for lost keywords
  for (const query of previous.queries) {
    if (!currentMap.has(query.query) && query.impressions > 50) {
      lostKeywords.push(query);
    }
  }

  return {
    improved: improved.slice(0, 10),
    declined: declined.slice(0, 10),
    newKeywords: newKeywords.slice(0, 10),
    lostKeywords: lostKeywords.slice(0, 10),
    summary: {
      clicksChange: current.totalClicks - previous.totalClicks,
      impressionsChange: current.totalImpressions - previous.totalImpressions,
      avgPositionChange: current.avgPosition - previous.avgPosition,
    },
  };
}

/**
 * Generate credentials setup instructions
 */
export function getGSCSetupInstructions(): string {
  return `
# Google Search Console API Setup

## Option 1: Service Account (Recommended for GitHub Actions)

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create a new project or select existing
3. Enable "Search Console API"
4. Go to "IAM & Admin" > "Service Accounts"
5. Create a service account
6. Create a JSON key and download it
7. In Search Console, add the service account email as a user

Add to GitHub Secrets:
  - GSC_SERVICE_ACCOUNT_EMAIL: your-service-account@project.iam.gserviceaccount.com
  - GSC_PRIVATE_KEY: (the private_key from JSON, including -----BEGIN/END-----)

## Option 2: OAuth (For user-specific access)

1. Go to Google Cloud Console
2. Enable "Search Console API"
3. Create OAuth 2.0 credentials
4. Download client_secret.json
5. Run: seo auth --google

This will open a browser for OAuth consent and save tokens locally.
`;
}
