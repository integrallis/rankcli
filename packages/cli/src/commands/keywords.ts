// Keyword Research CLI Command

import * as readline from 'readline';
import {
  runKeywordResearch,
  formatKeywordReport,
  extractSeedKeywords,
  SITE_PROFILE_QUESTIONS,
  discoverCompetitorKeywords,
  formatCompetitorReport,
  groupKeywordsByTopic,
  formatTopicReport,
  runAIKeywordResearch,
  type SiteProfile,
  type KeywordResearchOptions,
  type PlanTier,
} from '@rankcli/agent-runtime';

interface KeywordsOptions {
  url?: string;
  seed?: string;
  auto?: boolean;
  ai?: boolean;
  local?: boolean;
}

export async function keywords(options: KeywordsOptions): Promise<void> {
  console.log('\n🔑 SEO Autopilot - Keyword Research\n');
  console.log('This tool helps you find keywords you can actually rank for,');
  console.log('based on your site\'s current authority and competition level.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  const askChoice = async (
    question: string,
    choices: Array<{ value: string; label: string; description: string }>
  ): Promise<string> => {
    console.log(`\n${question}`);
    choices.forEach((choice, i) => {
      console.log(`  ${i + 1}. ${choice.label}`);
      console.log(`     ${choice.description}`);
    });

    while (true) {
      const answer = await ask('\nEnter your choice (1-' + choices.length + '): ');
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= choices.length) {
        return choices[num - 1].value;
      }
      console.log('Please enter a valid number.');
    }
  };

  try {
    // Step 1: Get URL or domain
    let url = options.url;
    if (!url) {
      url = await ask('Enter your website URL: ');
    }

    // Validate URL
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      url = parsed.href;
    } catch {
      console.log('\n❌ Invalid URL format. Please provide a valid URL.\n');
      rl.close();
      return;
    }

    const domain = new URL(url).hostname;

    // Step 2: Get seed keywords
    let seedKeywords: string[] = [];

    if (options.seed) {
      seedKeywords = options.seed.split(',').map((s) => s.trim());
    } else if (options.auto) {
      console.log('\n🔍 Auto-extracting seed keywords from your page...');
      seedKeywords = await extractSeedKeywords(url);
      if (seedKeywords.length > 0) {
        console.log(`Found: ${seedKeywords.join(', ')}`);
      }
    }

    if (seedKeywords.length === 0) {
      console.log('\n📝 What is your website/product about?');
      console.log('   (Enter 1-3 main topics or keywords, comma-separated)');
      const seedInput = await ask('   > ');
      seedKeywords = seedInput.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

      if (seedKeywords.length === 0) {
        console.log('\n❌ Please provide at least one seed keyword.\n');
        rl.close();
        return;
      }
    }

    // Step 3: Gather site profile through questions
    console.log('\n📋 Let me ask a few questions to tailor recommendations to your site...\n');

    const siteProfile: SiteProfile = {
      domain,
      domainAge: 'new',
      backlinkCount: 'none',
      businessGoal: 'signups',
      contentCapacity: 'medium',
      targetGeo: 'us',
    };

    // Ask each question
    for (const q of SITE_PROFILE_QUESTIONS) {
      const answer = await askChoice(q.question, q.options as any);
      (siteProfile as any)[q.id] = answer;
    }

    rl.close();

    // Step 4: Run keyword research
    console.log('\n' + '─'.repeat(60));
    console.log('Starting keyword research with your profile:');
    console.log(`  Domain: ${domain}`);
    console.log(`  Seeds: ${seedKeywords.join(', ')}`);
    console.log(`  Age: ${siteProfile.domainAge}`);
    console.log(`  Backlinks: ${siteProfile.backlinkCount}`);
    console.log(`  Goal: ${siteProfile.businessGoal}`);
    console.log('─'.repeat(60));

    const researchOptions: KeywordResearchOptions = {
      seedKeywords,
      siteProfile,
      url,
      maxKeywords: 100,
    };

    const result = await runKeywordResearch(researchOptions);

    // Step 5: Display results
    console.log(formatKeywordReport(result));

    // Step 6: Group keywords by topic
    const allKeywords = [...result.quickWins, ...result.mediumTerm, ...result.longTerm];
    if (allKeywords.length > 5) {
      console.log('\n📚 Grouping keywords by topic...\n');
      const topicResult = groupKeywordsByTopic(allKeywords);
      console.log(formatTopicReport(topicResult));
    }

    // Step 7: Offer to apply changes
    if (result.quickWins.length > 0) {
      console.log('\n💡 TIP: Run "seo apply --url ' + url + '" to apply keyword optimizations');
      console.log('💡 TIP: Run "seo keywords --competitor <domain>" to find competitor keyword gaps');
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    rl.close();
  }
}

// Quick mode - skip questions, use auto-detection
export async function keywordsQuick(url: string, providedSeeds?: string): Promise<void> {
  console.log('\n🚀 Quick Keyword Research Mode\n');

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    url = parsed.href;

    let seedKeywords: string[] = [];

    // Use provided seeds if available
    if (providedSeeds) {
      seedKeywords = providedSeeds.split(',').map(s => s.trim()).filter(s => s.length > 0);
      console.log(`Using provided seeds: ${seedKeywords.join(', ')}\n`);
    } else {
      // Extract seeds automatically
      console.log('🔍 Extracting keywords from your page...');
      seedKeywords = await extractSeedKeywords(url);

      if (seedKeywords.length === 0) {
        console.log('❌ Could not extract keywords. Please use interactive mode.\n');
        return;
      }

      console.log(`Found seeds: ${seedKeywords.join(', ')}\n`);
    }

    // Default profile for quick mode (conservative - new site)
    const siteProfile: SiteProfile = {
      domain: parsed.hostname,
      domainAge: 'new',
      backlinkCount: 'few',
      businessGoal: 'signups',
      contentCapacity: 'medium',
      targetGeo: 'us',
    };

    const result = await runKeywordResearch({
      seedKeywords,
      siteProfile,
      url,
      maxKeywords: 50,
    });

    console.log(formatKeywordReport(result));

    // Also show topic grouping in quick mode
    const allKeywords = [...result.quickWins, ...result.mediumTerm, ...result.longTerm];
    if (allKeywords.length > 5) {
      console.log('\n📚 Grouping keywords by topic...\n');
      const topicResult = groupKeywordsByTopic(allKeywords);
      console.log(formatTopicReport(topicResult));
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}

// RankCLI cloud endpoint
const SUPABASE_URL = 'https://eqzlmjbvrtrglknphdai.supabase.co';

// AI-powered keyword research mode
export async function keywordsAI(
  url: string,
  options: {
    forceLocal?: boolean;
    openaiApiKey?: string;
  } = {}
): Promise<void> {
  console.log('\n🤖 AI-Powered Keyword Research\n');
  console.log('This uses GPT-4 to analyze your site and generate keyword recommendations');
  console.log('with competitive analysis and free tool ideas.\n');

  const openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    url = parsed.href;

    console.log(`📍 Analyzing: ${url}`);
    console.log('');

    // Try cloud first (unless --local flag)
    if (!options.forceLocal) {
      console.log('🔗 Connecting to RankCLI cloud...');

      try {
        // TODO: Get auth token from stored credentials (rankcli login)
        const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-keywords`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Auth header would go here if user is logged in
          },
          body: JSON.stringify({
            url,
            mode: 'analyze',
          }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result.tier === 'free' && result.teaser) {
            // Show teaser for free tier
            console.log('\n' + '─'.repeat(60));
            console.log('🔒 FREE TIER - Limited Preview');
            console.log('─'.repeat(60));
            console.log(`Found ${result.teaser.totalKeywordsFound} keywords`);
            console.log(`Top keywords: ${result.teaser.topKeywords.join(', ')}`);
            console.log(`\n${result.teaser.upgradeMessage}`);
            console.log('\n💡 Run "rankcli login" to access your paid plan features.\n');
            return;
          }

          displayAIKeywordResults(result);
          return;
        } else {
          const errorText = await response.text();
          console.log(`⚠️  Cloud request failed, running locally...\n`);
        }
      } catch (err) {
        console.log('⚠️  Cloud unavailable, running locally...\n');
      }
    }

    // Run locally using agent-runtime
    if (!openaiApiKey) {
      console.log('❌ OpenAI API key required for local processing.');
      console.log('   Set OPENAI_API_KEY environment variable, or use "rankcli login" for cloud processing.\n');
      return;
    }

    console.log('🔬 Running local AI analysis (this may take a minute)...\n');

    const result = await runAIKeywordResearch({
      url,
      tier: 'solo',
      openaiApiKey,
      enableEnhancedToolIdeas: true,
      competitiveSearchKeys: {
        braveApiKey: process.env.BRAVE_API_KEY,
        serperApiKey: process.env.SERPER_API_KEY,
        githubToken: process.env.GITHUB_TOKEN,
      },
    });

    displayAIKeywordResults(result);

  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}

function displayAIKeywordResults(result: any): void {
  // Display site summary
  if (result.siteSummary) {
    console.log('─'.repeat(60));
    console.log('📋 SITE ANALYSIS');
    console.log('─'.repeat(60));
    console.log(`Product: ${result.siteSummary.productName || 'Unknown'}`);
    console.log(`Industry: ${result.siteSummary.industry || 'Unknown'}`);
    console.log(`Target: ${result.siteSummary.targetAudience || 'Unknown'}`);
    if (result.siteSummary.tagline) {
      console.log(`Tagline: ${result.siteSummary.tagline}`);
    }
    console.log('');
  }

  // Display confidence
  if (result.uncertainty) {
    const confidence = Math.round(result.uncertainty.overallConfidence * 100);
    const emoji = confidence >= 70 ? '✅' : confidence >= 50 ? '⚠️' : '❌';
    console.log(`${emoji} Confidence: ${confidence}%`);
    if (result.uncertainty.explanation) {
      console.log(`   ${result.uncertainty.explanation}`);
    }
    console.log('');
  }

  // Display keyword recommendations
  if (result.recommendations && result.recommendations.length > 0) {
    console.log('─'.repeat(60));
    console.log('🎯 KEYWORD RECOMMENDATIONS');
    console.log('─'.repeat(60));

    for (const rec of result.recommendations.slice(0, 15)) {
      const actionEmoji = {
        'create-page': '📄',
        'build-tool': '🛠️',
        'optimize-existing': '📈',
        'needs-input': '❓',
        'skip': '⏭️',
      }[rec.action] || '•';

      console.log(`\n${actionEmoji} ${rec.keyword}`);
      console.log(`   Action: ${rec.action.replace('-', ' ')}`);
      console.log(`   Volume: ${rec.searchVolume || 'unknown'} | Difficulty: ${rec.difficulty || 'unknown'}`);
      console.log(`   Impact: ${rec.impact || 'unknown'} | Effort: ${rec.effort || 'unknown'}`);
      if (rec.rationale) {
        console.log(`   ${rec.rationale}`);
      }
    }
    console.log('');
  }

  // Display free tool ideas
  if (result.freeToolIdeas && result.freeToolIdeas.length > 0) {
    console.log('─'.repeat(60));
    console.log('🛠️  FREE TOOL IDEAS (Engineering as Marketing)');
    console.log('─'.repeat(60));

    for (const tool of result.freeToolIdeas.slice(0, 5)) {
      console.log(`\n💡 ${tool.toolName || tool.toolName}`);
      console.log(`   ${tool.description || tool.toolDescription || ''}`);

      if (tool.inputFormat && tool.outputFormat) {
        console.log(`   📥 Input: ${tool.inputFormat}`);
        console.log(`   📤 Output: ${tool.outputFormat}`);
      }

      if (tool.productTieIn) {
        console.log(`   🔗 Tie-in: ${tool.productTieIn}`);
      }

      if (tool.competitorAnalysis) {
        console.log(`   🏆 Existing: ${tool.competitorAnalysis.existingTools?.join(', ') || 'None found'}`);
        console.log(`   ✨ Advantage: ${tool.competitorAnalysis.ourAdvantage || 'N/A'}`);
      }

      if (tool.implementationHints) {
        console.log(`   ⏱️  Est. time: ${tool.implementationHints.estimatedHours || 'Unknown'} hours`);
        if (tool.implementationHints.suggestedLibraries?.length > 0) {
          console.log(`   📦 Libraries: ${tool.implementationHints.suggestedLibraries.join(', ')}`);
        }
      }

      if (tool.feasibilityScore) {
        const score = typeof tool.feasibilityScore === 'object'
          ? tool.feasibilityScore.overallScore
          : tool.feasibilityScore;
        console.log(`   📊 Feasibility: ${score}/5`);
      }

      console.log(`   🎯 Keyword: ${tool.targetKeyword || tool.keyword}`);
      console.log(`   📈 Volume: ${tool.searchVolume || 'unknown'} | Difficulty: ${tool.difficulty || 'unknown'}`);
    }
    console.log('');
  }

  // Suggestions
  console.log('─'.repeat(60));
  console.log('💡 NEXT STEPS');
  console.log('─'.repeat(60));
  console.log('1. Start with quick wins (low difficulty, high impact keywords)');
  console.log('2. Build 1-2 free tools to capture search traffic');
  console.log('3. Create content pages targeting "Create Page" keywords');
  console.log('4. Re-run with --wizard to improve accuracy if needed\n');
}

// Competitor analysis mode - SpyFu Kombat-style gap analysis
export async function keywordsCompetitor(
  yourUrl: string,
  seedKeywords: string[],
  competitors?: string[]
): Promise<void> {
  console.log('\n🔍 Competitor Keyword Gap Analysis (SpyFu Kombat-style)\n');

  try {
    const parsed = new URL(yourUrl.startsWith('http') ? yourUrl : `https://${yourUrl}`);
    const yourDomain = parsed.hostname.replace(/^www\./, '');

    console.log(`Your domain: ${yourDomain}`);
    console.log(`Seed keywords: ${seedKeywords.join(', ')}`);
    if (competitors && competitors.length > 0) {
      console.log(`Competitors: ${competitors.join(', ')}`);
    } else {
      console.log('Competitors: Auto-discovering from SERP...');
    }
    console.log('');

    console.log('Analyzing competitor keywords (this may take a moment)...\n');

    const result = await discoverCompetitorKeywords(
      yourDomain,
      seedKeywords,
      competitors
    );

    console.log(formatCompetitorReport(result));

    // Actionable summary
    if (result.missingKeywords.length > 0) {
      console.log('\n🎯 ACTION ITEMS:');
      console.log('─'.repeat(60));
      console.log(`1. Create content targeting these ${Math.min(5, result.missingKeywords.length)} high-priority gaps:`);
      for (const kw of result.missingKeywords.slice(0, 5)) {
        console.log(`   • "${kw.keyword}"`);
      }
      console.log('\n2. Optimize existing pages for core keywords your competitors all rank for');
      console.log('3. Protect your unique keyword advantages with quality content\n');
    }

  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}
