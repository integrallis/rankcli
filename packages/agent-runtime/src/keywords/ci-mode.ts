/**
 * CI Mode for Keyword Research
 *
 * Handles automated keyword research in CI/CD pipelines.
 * - If confidence is high enough, adds keywords to PR
 * - If uncertainty is high, skips and warns user
 * - Provides clear instructions for what to do next
 */

import {
  runAIKeywordResearch,
  type PaidKeywordResult,
  type FreeKeywordResult,
  type KeywordRecommendation,
  type PlanTier,
} from './ai-keyword-engine.js';
import type { SiteSummary } from './ai-summarizer.js';

export interface CIKeywordOptions {
  url: string;
  tier: PlanTier;
  openaiApiKey?: string;
  /** Minimum confidence to proceed (default: 0.7) */
  minConfidence?: number;
  /** Maximum keywords to include in PR */
  maxKeywords?: number;
  /** Branch name for context */
  branchName?: string;
  /** PR number if applicable */
  prNumber?: number;
  /** Site ID for dashboard link */
  siteId?: string;
}

export interface CIKeywordResult {
  /** Whether keywords can be added to the PR */
  canAddToPR: boolean;
  /** Keywords to add (if canAddToPR is true) */
  keywords: KeywordRecommendation[];
  /** Warning messages to display */
  warnings: string[];
  /** Error messages (if any) */
  errors: string[];
  /** Info messages */
  info: string[];
  /** Actions user needs to take */
  requiredActions: CIAction[];
  /** PR comment body */
  prCommentBody: string;
  /** Exit code (0 = success, 1 = needs action, 2 = error) */
  exitCode: 0 | 1 | 2;
  /** Detailed explanation */
  explanation: string;
  /** Raw result for debugging */
  rawResult?: PaidKeywordResult | FreeKeywordResult;
}

export interface CIAction {
  title: string;
  description: string;
  command?: string;
  webUrl?: string;
  priority: 'high' | 'medium' | 'low';
}

const CI_CONFIDENCE_THRESHOLD = 0.7;
const MAX_KEYWORDS_IN_PR = 10;

/**
 * Run keyword research in CI mode
 */
export async function runCIKeywordResearch(
  options: CIKeywordOptions
): Promise<CIKeywordResult> {
  const {
    url,
    tier,
    openaiApiKey,
    minConfidence = CI_CONFIDENCE_THRESHOLD,
    maxKeywords = MAX_KEYWORDS_IN_PR,
    siteId,
  } = options;

  const warnings: string[] = [];
  const errors: string[] = [];
  const info: string[] = [];
  const actions: CIAction[] = [];

  console.log('🔬 Running keyword research in CI mode...');

  // Free tier gets limited results and upgrade prompt
  if (tier === 'free') {
    return handleFreeTierCI(url, siteId);
  }

  // Paid tier - require API key
  if (!openaiApiKey) {
    errors.push('OpenAI API key required for keyword research in CI mode');
    return {
      canAddToPR: false,
      keywords: [],
      warnings,
      errors,
      info,
      requiredActions: [
        {
          title: 'Add OpenAI API Key',
          description: 'Set OPENAI_API_KEY in your GitHub secrets',
          command: 'gh secret set OPENAI_API_KEY',
          priority: 'high',
        },
      ],
      prCommentBody: generateErrorPRComment(errors),
      exitCode: 2,
      explanation: 'Missing required OpenAI API key for AI-powered keyword research.',
    };
  }

  try {
    // Run the keyword research
    const result = await runAIKeywordResearch({
      url,
      tier,
      openaiApiKey,
      ciMode: true,
    });

    // Handle paid tier result
    if ('uncertainty' in result) {
      return handlePaidTierCI(result, {
        minConfidence,
        maxKeywords,
        siteId,
        warnings,
        info,
      });
    }

    // Shouldn't happen, but handle just in case
    return handleFreeTierCI(url, siteId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Keyword research failed: ${errorMessage}`);

    return {
      canAddToPR: false,
      keywords: [],
      warnings,
      errors,
      info,
      requiredActions: [
        {
          title: 'Check Configuration',
          description: 'Verify your API keys and site URL are correct',
          priority: 'high',
        },
      ],
      prCommentBody: generateErrorPRComment(errors),
      exitCode: 2,
      explanation: `Keyword research encountered an error: ${errorMessage}`,
    };
  }
}

/**
 * Handle free tier CI results
 */
function handleFreeTierCI(url: string, siteId?: string): CIKeywordResult {
  const dashboardUrl = siteId
    ? `https://rankcli.dev/dashboard/projects/${siteId}/keywords`
    : 'https://rankcli.dev/pricing';

  return {
    canAddToPR: false,
    keywords: [],
    warnings: [
      'Keyword research requires a paid plan for CI automation',
    ],
    errors: [],
    info: [
      `Found potential keyword opportunities for ${url}`,
      'Upgrade to Solo plan or higher for automated keyword research in CI',
    ],
    requiredActions: [
      {
        title: 'Upgrade to Solo Plan',
        description: 'Get AI-powered keyword research with CI/CD automation',
        webUrl: 'https://rankcli.dev/pricing',
        priority: 'medium',
      },
      {
        title: 'Run Manual Keyword Research',
        description: 'Use the CLI wizard to get keyword recommendations',
        command: 'rankcli keywords --wizard',
        priority: 'low',
      },
    ],
    prCommentBody: generateFreeTierPRComment(url, dashboardUrl),
    exitCode: 1,
    explanation: 'Free tier does not support automated keyword research in CI. Upgrade for this feature.',
  };
}

/**
 * Handle paid tier CI results
 */
function handlePaidTierCI(
  result: PaidKeywordResult,
  options: {
    minConfidence: number;
    maxKeywords: number;
    siteId?: string;
    warnings: string[];
    info: string[];
  }
): CIKeywordResult {
  const { minConfidence, maxKeywords, siteId, warnings, info } = options;
  const { uncertainty, recommendations, siteSummary, freeToolIdeas } = result;

  const dashboardUrl = siteId
    ? `https://rankcli.dev/dashboard/projects/${siteId}/keywords`
    : 'https://rankcli.dev/dashboard';

  const wizardUrl = siteId
    ? `https://rankcli.dev/dashboard/projects/${siteId}/keywords/wizard`
    : 'https://rankcli.dev/dashboard';

  // Check confidence level
  if (uncertainty.overallConfidence < minConfidence) {
    // High uncertainty - cannot automate
    const questionsNeeded = uncertainty.questionsToAsk.slice(0, 5);

    return {
      canAddToPR: false,
      keywords: [],
      warnings: [
        `Confidence level (${Math.round(uncertainty.overallConfidence * 100)}%) is below threshold (${Math.round(minConfidence * 100)}%)`,
        'Keyword recommendations skipped due to uncertainty',
      ],
      errors: [],
      info: [
        `Site analyzed: ${siteSummary.productName}`,
        `Industry detected: ${siteSummary.industry}`,
        `Found ${recommendations.length} potential keyword opportunities`,
      ],
      requiredActions: [
        {
          title: 'Run Keyword Wizard',
          description: `Answer ${questionsNeeded.length} questions to improve accuracy`,
          command: 'rankcli keywords --wizard',
          webUrl: wizardUrl,
          priority: 'high',
        },
        {
          title: 'Provide Product Context',
          description: 'Add product description to reduce uncertainty',
          command: 'rankcli keywords --context "Your product description"',
          priority: 'medium',
        },
      ],
      prCommentBody: generateUncertaintyPRComment(
        siteSummary,
        uncertainty,
        questionsNeeded,
        wizardUrl
      ),
      exitCode: 1,
      explanation: uncertainty.explanation,
      rawResult: result,
    };
  }

  // High enough confidence - include keywords
  const keywordsToAdd = recommendations
    .filter((r) => r.action !== 'needs-input' && r.action !== 'skip')
    .slice(0, maxKeywords);

  if (keywordsToAdd.length === 0) {
    warnings.push('No actionable keywords found meeting criteria');
    return {
      canAddToPR: false,
      keywords: [],
      warnings,
      errors: [],
      info: [
        `Site: ${siteSummary.productName}`,
        `Industry: ${siteSummary.industry}`,
        'Consider expanding search criteria or running wizard',
      ],
      requiredActions: [
        {
          title: 'Run Keyword Wizard',
          description: 'Get personalized keyword recommendations',
          command: 'rankcli keywords --wizard',
          webUrl: wizardUrl,
          priority: 'medium',
        },
      ],
      prCommentBody: generateNoKeywordsPRComment(siteSummary, dashboardUrl),
      exitCode: 0,
      explanation: 'Analysis complete but no keywords met the criteria for automation.',
      rawResult: result,
    };
  }

  // Success - keywords can be added
  info.push(`Confidence: ${Math.round(uncertainty.overallConfidence * 100)}%`);
  info.push(`Adding ${keywordsToAdd.length} keyword recommendations`);

  return {
    canAddToPR: true,
    keywords: keywordsToAdd,
    warnings,
    errors: [],
    info,
    requiredActions: [],
    prCommentBody: generateSuccessPRComment(
      siteSummary,
      keywordsToAdd,
      freeToolIdeas.slice(0, 5),
      uncertainty.overallConfidence,
      dashboardUrl
    ),
    exitCode: 0,
    explanation: `Successfully analyzed ${siteSummary.productName}. ${keywordsToAdd.length} keyword recommendations ready.`,
    rawResult: result,
  };
}

// PR Comment Generators

function generateErrorPRComment(errors: string[]): string {
  return `## 🔑 Keyword Research - Error

❌ **Keyword research could not complete**

${errors.map((e) => `- ${e}`).join('\n')}

### Next Steps
1. Check your configuration and API keys
2. Run \`rankcli keywords --debug\` locally to diagnose
3. See [documentation](https://rankcli.dev/docs/keywords) for help

---
*Generated by [RankCLI](https://rankcli.dev)*`;
}

function generateFreeTierPRComment(url: string, upgradeUrl: string): string {
  return `## 🔑 Keyword Research

📊 **Keyword opportunities detected for ${url}**

Automated keyword research in CI requires a paid plan.

### What You Get with Solo Plan ($9/mo):
- ✅ AI-powered keyword discovery
- ✅ Automated CI/CD integration
- ✅ Keyword clustering & prioritization
- ✅ Free tool ideas with CTAs
- ✅ Competitive analysis

### Run Manually
\`\`\`bash
rankcli keywords --wizard
\`\`\`

[Upgrade to unlock →](${upgradeUrl})

---
*Generated by [RankCLI](https://rankcli.dev)*`;
}

function generateUncertaintyPRComment(
  summary: SiteSummary,
  uncertainty: any,
  questions: any[],
  wizardUrl: string
): string {
  const questionsList = questions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join('\n');

  return `## 🔑 Keyword Research - Needs Input

⚠️ **Confidence: ${Math.round(uncertainty.overallConfidence * 100)}%** - Too low for automation

### What We Detected
- **Product:** ${summary.productName}
- **Industry:** ${summary.industry}
- **Audience:** ${summary.targetAudience}

### Questions to Answer
To improve accuracy, please answer these questions:

${questionsList}

### How to Proceed

**Option 1: Run the wizard (recommended)**
\`\`\`bash
rankcli keywords --wizard
\`\`\`

**Option 2: Use the web wizard**
[Open Keyword Wizard →](${wizardUrl})

**Option 3: Provide context directly**
\`\`\`bash
rankcli keywords --context "Your product description here"
\`\`\`

### Why This Matters
Low confidence means our recommendations might not be relevant to your business. Taking 2 minutes to answer questions will significantly improve results.

---
*Generated by [RankCLI](https://rankcli.dev)*`;
}

function generateNoKeywordsPRComment(summary: SiteSummary, dashboardUrl: string): string {
  return `## 🔑 Keyword Research - Complete

✅ **Analysis complete for ${summary.productName}**

No keywords currently meet the automation criteria (low difficulty + high volume + high relevance).

### What This Means
- Your niche may be competitive
- Consider longer-tail keywords
- Try the wizard for personalized recommendations

### Next Steps
1. Run \`rankcli keywords --wizard\` for guided research
2. View full analysis in [dashboard](${dashboardUrl})

---
*Generated by [RankCLI](https://rankcli.dev)*`;
}

function generateSuccessPRComment(
  summary: SiteSummary,
  keywords: KeywordRecommendation[],
  toolIdeas: any[],
  confidence: number,
  dashboardUrl: string
): string {
  const keywordTable = keywords
    .map((k, i) => `| ${i + 1} | ${k.keyword} | ${k.action} | ${k.impact} | ${k.effort} |`)
    .join('\n');

  const toolList = toolIdeas
    .map((t) => `- **${t.toolName}** (${t.volume} searches/mo, KD: ${t.difficulty})`)
    .join('\n');

  return `## 🔑 Keyword Research - Success

✅ **Confidence: ${Math.round(confidence * 100)}%**

### Site Analysis
- **Product:** ${summary.productName}
- **Industry:** ${summary.industry}
- **Target:** ${summary.targetAudience}

### Top Keyword Recommendations

| # | Keyword | Action | Impact | Effort |
|---|---------|--------|--------|--------|
${keywordTable}

### Free Tool Ideas (Engineering as Marketing)
${toolList || 'No tool ideas generated'}

### Next Steps
1. Review recommendations in [dashboard](${dashboardUrl})
2. Start with high-impact, low-effort keywords
3. Build free tools to capture search traffic

---
*Generated by [RankCLI](https://rankcli.dev) • [View Full Report](${dashboardUrl})*`;
}

/**
 * Format CI result for console output
 */
export function formatCIResult(result: CIKeywordResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(70));
  lines.push('  KEYWORD RESEARCH - CI MODE');
  lines.push('═'.repeat(70));
  lines.push('');

  // Status
  if (result.canAddToPR) {
    lines.push('✅ STATUS: Keywords ready to add to PR');
  } else if (result.exitCode === 2) {
    lines.push('❌ STATUS: Error occurred');
  } else {
    lines.push('⚠️  STATUS: Needs user input');
  }
  lines.push('');

  // Errors
  if (result.errors.length > 0) {
    lines.push('ERRORS:');
    result.errors.forEach((e) => lines.push(`  ❌ ${e}`));
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('WARNINGS:');
    result.warnings.forEach((w) => lines.push(`  ⚠️  ${w}`));
    lines.push('');
  }

  // Info
  if (result.info.length > 0) {
    lines.push('INFO:');
    result.info.forEach((i) => lines.push(`  ℹ️  ${i}`));
    lines.push('');
  }

  // Keywords
  if (result.keywords.length > 0) {
    lines.push('KEYWORDS:');
    result.keywords.forEach((k, i) => {
      lines.push(`  ${i + 1}. "${k.keyword}" - ${k.action} (${k.impact} impact, ${k.effort} effort)`);
    });
    lines.push('');
  }

  // Required Actions
  if (result.requiredActions.length > 0) {
    lines.push('REQUIRED ACTIONS:');
    result.requiredActions.forEach((a) => {
      lines.push(`  📌 ${a.title}`);
      lines.push(`     ${a.description}`);
      if (a.command) {
        lines.push(`     Command: ${a.command}`);
      }
      if (a.webUrl) {
        lines.push(`     URL: ${a.webUrl}`);
      }
      lines.push('');
    });
  }

  // Explanation
  lines.push('─'.repeat(70));
  lines.push(`  ${result.explanation}`);
  lines.push('═'.repeat(70));

  return lines.join('\n');
}
