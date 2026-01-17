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
  type SiteProfile,
  type KeywordResearchOptions,
} from '@seo-autopilot/agent-runtime';

interface KeywordsOptions {
  url?: string;
  seed?: string;
  auto?: boolean;
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
