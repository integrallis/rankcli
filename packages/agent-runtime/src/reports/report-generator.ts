/**
 * Report Generator
 *
 * Generates HTML and PDF reports for SEO audits with white-label branding support.
 */

export interface ReportBranding {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  whiteLabel?: boolean;
  contactEmail?: string;
  websiteUrl?: string;
}

export interface ReportConfig {
  branding?: ReportBranding;
  includeExecutiveSummary?: boolean;
  includeRecommendations?: boolean;
  includePageDetails?: boolean;
  maxIssues?: number;
}

export interface AuditIssueData {
  code: string;
  severity: 'error' | 'warning' | 'notice';
  category: string;
  title: string;
  affectedUrls: string[];
  description?: string;
  howToFix?: string;
}

export interface ReportPageData {
  url: string;
  score: number;
  issues: number;
}

export interface AuditReportData {
  url: string;
  domain: string;
  timestamp: string;
  score: number;
  healthScores: {
    overall: number;
    crawlability: number;
    indexability: number;
    onPage: number;
    content: number;
    links: number;
    performance: number;
    security: number;
    aiReadiness: number;
    social: number;
    localSeo: number;
  };
  summary: {
    errors: number;
    warnings: number;
    notices: number;
    passed: number;
  };
  issues: AuditIssueData[];
  pages: ReportPageData[];
}

const DEFAULT_BRANDING: ReportBranding = {
  companyName: 'RankCLI',
  primaryColor: '#2563eb',
  accentColor: '#10b981',
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#f59e0b'; // yellow/orange
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  return 'error';
}

function formatCategory(category: string): string {
  const names: Record<string, string> = {
    'on-page': 'On-Page',
    'onPage': 'On-Page',
    'social-meta': 'Social Meta',
    'socialMeta': 'Social Meta',
    'performance': 'Performance',
    'crawlability': 'Crawlability',
    'indexability': 'Indexability',
    'structured-data': 'Structured Data',
    'structuredData': 'Structured Data',
    'security': 'Security',
    'mobile': 'Mobile',
    'links': 'Links',
    'images': 'Images',
    'content': 'Content',
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function generateStyles(branding: ReportBranding): string {
  const primary = branding.primaryColor || DEFAULT_BRANDING.primaryColor;
  const accent = branding.accentColor || DEFAULT_BRANDING.accentColor;

  return `
    :root {
      --primary: ${primary};
      --accent: ${accent};
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
      --text: #1f2937;
      --text-light: #6b7280;
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --border: #e5e7eb;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: var(--text);
      line-height: 1.6;
      background: var(--bg);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--border);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo img {
      max-height: 40px;
    }

    .logo h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
    }

    .report-meta {
      text-align: right;
      color: var(--text-light);
      font-size: 14px;
    }

    .score-card {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      border-radius: 16px;
      padding: 40px;
      margin-bottom: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .score-main {
      text-align: center;
    }

    .score-value {
      font-size: 72px;
      font-weight: 800;
      line-height: 1;
    }

    .score-label {
      font-size: 18px;
      opacity: 0.9;
      margin-top: 8px;
    }

    .score-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    .stat-item {
      text-align: center;
      padding: 16px;
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
    }

    .stat-label {
      font-size: 12px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    section {
      margin-bottom: 40px;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--border);
    }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .category-card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid var(--border);
    }

    .category-name {
      font-weight: 600;
      margin-bottom: 8px;
    }

    .category-score {
      font-size: 24px;
      font-weight: 700;
    }

    .issues-list {
      background: var(--bg-secondary);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .issue-item {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .issue-item:last-child {
      border-bottom: none;
    }

    .severity-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .severity-error {
      background: #fef2f2;
      color: var(--error);
    }

    .severity-warning {
      background: #fffbeb;
      color: var(--warning);
    }

    .severity-notice {
      background: #eff6ff;
      color: var(--primary);
    }

    .issue-content {
      flex: 1;
    }

    .issue-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .issue-code {
      font-family: monospace;
      font-size: 12px;
      color: var(--text-light);
    }

    .issue-urls {
      margin-top: 8px;
      font-size: 13px;
      color: var(--text-light);
    }

    .pages-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-secondary);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .pages-table th,
    .pages-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    .pages-table th {
      background: var(--bg);
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-light);
    }

    .pages-table tr:last-child td {
      border-bottom: none;
    }

    .recommendations {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--border);
    }

    .recommendation-item {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .recommendation-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .recommendation-title {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .recommendation-text {
      color: var(--text-light);
      font-size: 14px;
    }

    footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid var(--border);
      text-align: center;
      color: var(--text-light);
      font-size: 13px;
    }

    footer a {
      color: var(--primary);
      text-decoration: none;
    }

    .executive-summary {
      background: linear-gradient(to right, #f0f9ff, #e0f2fe);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      border: 1px solid #bae6fd;
    }

    .executive-summary h2 {
      border-bottom: none;
      margin-bottom: 16px;
      padding-bottom: 0;
    }

    .executive-summary p {
      color: var(--text);
      line-height: 1.8;
    }

    .more-indicator {
      padding: 16px 20px;
      text-align: center;
      color: var(--text-light);
      font-style: italic;
    }

    @media (max-width: 768px) {
      .score-card {
        flex-direction: column;
        gap: 30px;
      }

      .score-stats {
        grid-template-columns: repeat(2, 1fr);
      }

      header {
        flex-direction: column;
        gap: 20px;
        text-align: center;
      }

      .report-meta {
        text-align: center;
      }
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .container {
        padding: 20px;
      }

      section {
        page-break-inside: avoid;
      }
    }
  `;
}

function generateExecutiveSummary(data: AuditReportData): string {
  const { score, summary, issues } = data;
  const topIssues = issues.filter(i => i.severity === 'error').slice(0, 3);

  let status = 'needs improvement';
  if (score >= 80) status = 'in good shape';
  else if (score >= 60) status = 'has room for improvement';

  return `
    <section class="executive-summary">
      <h2>Executive Summary</h2>
      <p>
        The SEO health of <strong>${data.domain}</strong> is ${status} with an overall score of
        <strong>${score}/100</strong>. The audit found <strong>${summary.errors} critical errors</strong>
        and <strong>${summary.warnings} warnings</strong> that should be addressed to improve search visibility.
        ${topIssues.length > 0 ? `The most critical issues are: ${topIssues.map(i => i.title).join(', ')}.` : ''}
        ${summary.passed} checks passed successfully.
      </p>
    </section>
  `;
}

function generateRecommendations(issues: AuditIssueData[]): string {
  const errorIssues = issues.filter(i => i.severity === 'error').slice(0, 5);

  if (errorIssues.length === 0) {
    return `
      <section>
        <h2>Recommendations</h2>
        <div class="recommendations">
          <p>Great job! No critical errors found. Continue monitoring your site regularly.</p>
        </div>
      </section>
    `;
  }

  const recommendations = errorIssues.map(issue => `
    <div class="recommendation-item">
      <div class="recommendation-title">
        <span class="severity-badge severity-error">Priority</span>
        ${issue.title}
      </div>
      <div class="recommendation-text">
        <strong>How to Fix:</strong> ${issue.howToFix || `Address the ${issue.code} issue to improve your SEO score.`}
      </div>
    </div>
  `).join('');

  return `
    <section>
      <h2>Recommendations</h2>
      <div class="recommendations">
        ${recommendations}
      </div>
    </section>
  `;
}

/**
 * Generates an HTML report from audit data
 */
export function generateHTMLReport(
  data: AuditReportData,
  config: ReportConfig = {}
): string {
  const branding = { ...DEFAULT_BRANDING, ...config.branding };
  const {
    includeExecutiveSummary = false,
    includeRecommendations = false,
    includePageDetails = true,
    maxIssues,
  } = config;

  const scoreColor = getScoreColor(data.score);
  const scoreLabel = getScoreLabel(data.score);
  const displayIssues = maxIssues ? data.issues.slice(0, maxIssues) : data.issues;
  const remainingIssues = maxIssues ? data.issues.length - maxIssues : 0;

  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.companyName}" />`
    : '';

  const footerHtml = branding.whiteLabel
    ? `<footer>
        <p>Generated on ${formatDate(data.timestamp)}</p>
        ${branding.contactEmail ? `<p>Contact: <a href="mailto:${branding.contactEmail}">${branding.contactEmail}</a></p>` : ''}
        ${branding.websiteUrl ? `<p><a href="${branding.websiteUrl}">${branding.websiteUrl}</a></p>` : ''}
      </footer>`
    : `<footer>
        <p>Generated by <a href="https://rankcli.dev">RankCLI</a> on ${formatDate(data.timestamp)}</p>
      </footer>`;

  const categoriesHtml = Object.entries(data.healthScores)
    .filter(([key]) => key !== 'overall')
    .map(([key, value]) => `
      <div class="category-card">
        <div class="category-name">${formatCategory(key)}</div>
        <div class="category-score" style="color: ${getScoreColor(value)}">${value}/100</div>
      </div>
    `).join('');

  const issuesHtml = displayIssues.map(issue => `
    <div class="issue-item">
      <span class="severity-badge severity-${issue.severity}">${issue.severity}</span>
      <div class="issue-content">
        <div class="issue-title">${issue.title}</div>
        <div class="issue-code">${issue.code}</div>
        ${issue.affectedUrls.length > 0 ? `
          <div class="issue-urls">
            Affected: ${issue.affectedUrls.slice(0, 3).join(', ')}
            ${issue.affectedUrls.length > 3 ? ` and ${issue.affectedUrls.length - 3} more` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  const moreIndicator = remainingIssues > 0
    ? `<div class="more-indicator">...and ${remainingIssues} more issues</div>`
    : '';

  const pagesHtml = includePageDetails && data.pages.length > 0 ? `
    <section>
      <h2>Page Details</h2>
      <table class="pages-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Score</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          ${data.pages.map(page => `
            <tr>
              <td>${page.url}</td>
              <td style="color: ${getScoreColor(page.score)}">${page.score}/100</td>
              <td>${page.issues}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report - ${data.domain}</title>
  <style>${generateStyles(branding)}</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        ${logoHtml}
        <h1>${branding.companyName}</h1>
      </div>
      <div class="report-meta">
        <div><strong>${data.domain}</strong></div>
        <div>${formatDate(data.timestamp)}</div>
      </div>
    </header>

    <div class="score-card">
      <div class="score-main">
        <div class="score-value">${data.score}</div>
        <div class="score-label">SEO Score /100</div>
      </div>
      <div class="score-stats">
        <div class="stat-item">
          <div class="stat-value">${data.summary.errors}</div>
          <div class="stat-label">Errors</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.summary.warnings}</div>
          <div class="stat-label">Warnings</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.summary.notices}</div>
          <div class="stat-label">Notices</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.summary.passed}</div>
          <div class="stat-label">Passed</div>
        </div>
      </div>
    </div>

    ${includeExecutiveSummary ? generateExecutiveSummary(data) : ''}

    <section>
      <h2>Category Scores</h2>
      <div class="categories-grid">
        ${categoriesHtml}
      </div>
    </section>

    <section>
      <h2>Issues Found</h2>
      <div class="issues-list">
        ${issuesHtml}
        ${moreIndicator}
      </div>
    </section>

    ${includeRecommendations ? generateRecommendations(data.issues) : ''}

    ${pagesHtml}

    ${footerHtml}
  </div>
</body>
</html>`;
}

/**
 * Generates a PDF report from audit data
 * Uses the HTML report as a base and converts to PDF
 */
export async function generatePDFReport(
  data: AuditReportData,
  config: ReportConfig = {}
): Promise<Buffer> {
  // Generate HTML first
  const html = generateHTMLReport(data, {
    ...config,
    includeExecutiveSummary: config.includeExecutiveSummary ?? true,
    includeRecommendations: config.includeRecommendations ?? true,
  });

  // For now, return the HTML as a buffer
  // In production, this would use puppeteer or similar to generate actual PDF
  // This is a placeholder that satisfies the interface
  return Buffer.from(html, 'utf-8');
}
