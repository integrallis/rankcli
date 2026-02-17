import { analyzers } from '@rankcli/agent-runtime';
import ora from 'ora';
import chalk from 'chalk';

interface GeoOptions {
  url?: string;
  output?: string;
}

/**
 * Fetch HTML and robots.txt from a URL
 */
async function fetchResources(url: string): Promise<{ html: string | null; robotsTxt: string | null; headers: Record<string, string> }> {
  const headers: Record<string, string> = {};
  let html: string | null = null;
  let robotsTxt: string | null = null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RankCLI-Bot/1.0 (+https://rankcli.dev/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (response.ok) {
      html = await response.text();
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    }
  } catch {
    // Ignore fetch errors
  }

  // Fetch robots.txt
  try {
    const robotsUrl = new URL('/robots.txt', url).href;
    const robotsResponse = await fetch(robotsUrl);
    if (robotsResponse.ok) {
      robotsTxt = await robotsResponse.text();
    }
  } catch {
    // Ignore fetch errors
  }

  return { html, robotsTxt, headers };
}

export async function geo(options: GeoOptions): Promise<void> {
  const url = options.url;

  if (!url) {
    console.log('\n⚠️  Please provide a URL to analyze:');
    console.log('   rankcli geo --url https://your-site.com');
    console.log('\nOptions:');
    console.log('   --output json       Output as JSON');
    console.log('');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.log('\n❌ Invalid URL format. Please provide a valid URL.\n');
    return;
  }

  const spinner = ora('Fetching page and robots.txt...').start();

  const { html, robotsTxt, headers } = await fetchResources(url);

  if (!html) {
    spinner.fail('Could not fetch page content');
    return;
  }

  spinner.text = 'Running GEO analysis...';

  try {
    const geoResult = await analyzers.analyzeGEO(html, url, robotsTxt || undefined);
    const cwvResult = analyzers.analyzeCoreWebVitals(html, url, headers);
    const securityResult = analyzers.analyzeSecurityHeaders(headers, url);
    const schemaResult = analyzers.analyzeStructuredData(html, url);
    const mobileResult = analyzers.analyzeMobileSEO(html, url);

    spinner.succeed('GEO analysis complete');

    if (options.output === 'json') {
      const jsonOutput = {
        url,
        geo: geoResult,
        coreWebVitals: cwvResult,
        security: securityResult,
        structuredData: schemaResult,
        mobile: mobileResult,
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // Console output
    console.log('\n' + chalk.bold('═'.repeat(60)));
    console.log(chalk.bold.cyan('  GEO ANALYSIS: AI Search Optimization'));
    console.log(chalk.bold('═'.repeat(60)));

    // GEO Score
    const geoScore = geoResult.score;
    const scoreColor = geoScore >= 80 ? chalk.green : geoScore >= 60 ? chalk.yellow : chalk.red;
    console.log(`\n  ${chalk.bold('GEO Score:')} ${scoreColor.bold(geoScore + '/100')}`);

    // AI Crawler Access
    console.log('\n' + chalk.bold('  AI Crawler Access:'));
    const { aiCrawlerAccess } = geoResult;
    
    if (aiCrawlerAccess.blockedCrawlers.length > 0) {
      console.log(chalk.red(`    ❌ Blocked: ${aiCrawlerAccess.blockedCrawlers.join(', ')}`));
    }
    if (aiCrawlerAccess.allowedCrawlers.length > 0) {
      const topAllowed = aiCrawlerAccess.allowedCrawlers.slice(0, 5);
      console.log(chalk.green(`    ✅ Allowed: ${topAllowed.join(', ')}${aiCrawlerAccess.allowedCrawlers.length > 5 ? '...' : ''}`));
    }

    // Rendering
    console.log('\n' + chalk.bold('  Rendering:'));
    if (aiCrawlerAccess.serverSideRendered) {
      console.log(chalk.green('    ✅ Server-side rendered (AI crawlers can see content)'));
    } else if (aiCrawlerAccess.jsRenderingRequired) {
      console.log(chalk.red('    ❌ JavaScript required (AI crawlers may see blank page)'));
    }

    // LLM Signals
    console.log('\n' + chalk.bold('  LLM Friendliness:'));
    const { llmSignals } = geoResult;
    const bar = (score: number) => {
      const filled = Math.round(score / 5);
      const empty = 20 - filled;
      const color = score >= 70 ? chalk.green : score >= 40 ? chalk.yellow : chalk.red;
      return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    };
    console.log(`    Content Clarity:  ${bar(llmSignals.contentClarity)} ${llmSignals.contentClarity}%`);
    console.log(`    Fact Density:     ${bar(llmSignals.factDensity)} ${llmSignals.factDensity}%`);
    console.log(`    Structure:        ${bar(llmSignals.structureQuality)} ${llmSignals.structureQuality}%`);
    console.log(`    Citations:        ${bar(llmSignals.citationQuality)} ${llmSignals.citationQuality}%`);

    // Content Structure
    console.log('\n' + chalk.bold('  Content Structure:'));
    const { contentStructure } = geoResult;
    console.log(`    ${contentStructure.hasStructuredData ? chalk.green('✅') : chalk.red('❌')} JSON-LD Structured Data`);
    console.log(`    ${contentStructure.hasFAQSchema ? chalk.green('✅') : chalk.yellow('○')} FAQ Schema`);
    console.log(`    ${contentStructure.hasArticleSchema ? chalk.green('✅') : chalk.yellow('○')} Article Schema`);
    console.log(`    ${contentStructure.hasBreadcrumbs ? chalk.green('✅') : chalk.yellow('○')} Breadcrumbs`);
    console.log(`    Heading Hierarchy: ${contentStructure.headingHierarchy === 'good' ? chalk.green('Good') : contentStructure.headingHierarchy === 'needs-work' ? chalk.yellow('Needs Work') : chalk.red('Poor')}`);

    // Citation Readiness
    console.log('\n' + chalk.bold('  Citation Readiness:'));
    const { citationReadiness } = geoResult;
    if (citationReadiness.trustSignals.length > 0) {
      console.log(chalk.green(`    ✅ ${citationReadiness.trustSignals.join(', ')}`));
    } else {
      console.log(chalk.yellow('    ○ No trust signals detected'));
    }

    // Other Scores
    console.log('\n' + chalk.bold('  Other Scores:'));
    console.log(`    Core Web Vitals:  ${bar(cwvResult.overallScore)} ${cwvResult.overallScore}%`);
    console.log(`    Security Headers: ${securityResult.grade} (${securityResult.score}%)`);
    console.log(`    Structured Data:  ${bar(schemaResult.score)} ${schemaResult.score}%`);
    console.log(`    Mobile SEO:       ${bar(mobileResult.score)} ${mobileResult.score}%`);

    // Critical Issues
    const allIssues = [
      ...geoResult.issues,
      ...cwvResult.issues,
      ...securityResult.issues,
      ...schemaResult.issues,
      ...mobileResult.issues,
    ];
    const criticalIssues = allIssues.filter(i => i.severity === 'critical' || i.severity === 'error');
    
    if (criticalIssues.length > 0) {
      console.log('\n' + chalk.bold.red('  Critical Issues:'));
      criticalIssues.slice(0, 5).forEach((issue, i) => {
        console.log(chalk.red(`    ${i + 1}. ${issue.title}`));
      });
    }

    // Recommendations
    if (geoResult.recommendations.length > 0) {
      console.log('\n' + chalk.bold('  Recommendations:'));
      geoResult.recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`    ${i + 1}. ${rec}`);
      });
    }

    console.log('\n' + chalk.bold('═'.repeat(60)));
    console.log('');

  } catch (error) {
    spinner.fail(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
