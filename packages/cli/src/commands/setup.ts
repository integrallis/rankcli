// Setup Command - Configure tracking and automation
// Sets up Google Analytics, Search Console, and GitHub Actions

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import {
  injectGA4,
  injectGSCVerification,
  writeGitHubActionFiles,
  getGSCSetupInstructions,
  generateGA4EnvTemplate,
  type WorkflowConfig,
} from '@rankcli/agent-runtime';

interface SetupOptions {
  ga4?: string;           // GA4 Measurement ID
  gsc?: string;           // GSC verification code
  githubAction?: boolean; // Set up GitHub Action
  schedule?: 'daily' | 'weekly' | 'monthly';
  all?: boolean;          // Interactive setup for all
}

export async function setup(options: SetupOptions): Promise<void> {
  console.log('\n🔧 RankCLI - Setup\n');

  const projectPath = process.cwd();

  // Check if this is a valid project
  if (!fs.existsSync(path.join(projectPath, 'package.json')) &&
      !fs.existsSync(path.join(projectPath, 'index.html'))) {
    console.log('⚠️  No package.json or index.html found. Are you in a web project directory?\n');
  }

  // Interactive mode
  if (options.all || (!options.ga4 && !options.gsc && !options.githubAction)) {
    await interactiveSetup(projectPath);
    return;
  }

  // Individual options
  if (options.ga4) {
    await setupGA4(projectPath, options.ga4);
  }

  if (options.gsc) {
    await setupGSC(projectPath, options.gsc);
  }

  if (options.githubAction) {
    await setupGitHubAction(projectPath, options.schedule || 'weekly');
  }
}

async function interactiveSetup(projectPath: string): Promise<void> {
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

  try {
    console.log('This wizard will help you set up SEO tracking for your project.\n');

    // Step 1: Google Analytics 4
    console.log('─'.repeat(60));
    console.log('📊 STEP 1: Google Analytics 4\n');
    console.log('GA4 tracks visitor behavior on your site.');
    console.log('Get your Measurement ID from: https://analytics.google.com');
    console.log('Go to: Admin > Data Streams > Your Stream > Measurement ID\n');

    const ga4Id = await ask('Enter GA4 Measurement ID (G-XXXXXXXXXX) or press Enter to skip: ');
    if (ga4Id && ga4Id.startsWith('G-')) {
      await setupGA4(projectPath, ga4Id);
    } else if (ga4Id) {
      console.log('⚠️  Invalid format. GA4 IDs start with "G-". Skipping.\n');
    } else {
      console.log('Skipping GA4 setup.\n');
    }

    // Step 2: Google Search Console
    console.log('─'.repeat(60));
    console.log('🔍 STEP 2: Google Search Console\n');
    console.log('GSC shows how Google sees your site and what queries you rank for.');
    console.log('Get your verification code from: https://search.google.com/search-console');
    console.log('Go to: Settings > Ownership verification > HTML tag\n');

    const gscCode = await ask('Enter GSC verification code or press Enter to skip: ');
    if (gscCode && gscCode.length > 10) {
      await setupGSC(projectPath, gscCode);
    } else if (gscCode) {
      console.log('⚠️  Code seems too short. Skipping.\n');
    } else {
      console.log('Skipping GSC verification.\n');
    }

    // Step 3: GitHub Action
    console.log('─'.repeat(60));
    console.log('🤖 STEP 3: Automated SEO Monitoring\n');
    console.log('A GitHub Action can automatically check your site\'s SEO on a schedule.');
    console.log('It creates issues with reports and can auto-fix some problems.\n');

    const setupAction = await ask('Set up GitHub Action? (y/n): ');
    if (setupAction.toLowerCase() === 'y' || setupAction.toLowerCase() === 'yes') {
      console.log('\nHow often should the check run?');
      console.log('  1. Weekly (recommended for most sites)');
      console.log('  2. Daily (for high-traffic sites)');
      console.log('  3. Monthly (for low-traffic sites)\n');

      const scheduleChoice = await ask('Enter choice (1-3): ');
      const scheduleMap: Record<string, 'weekly' | 'daily' | 'monthly'> = {
        '1': 'weekly',
        '2': 'daily',
        '3': 'monthly',
      };
      const schedule = scheduleMap[scheduleChoice] || 'weekly';

      const siteUrl = await ask('Enter your site URL (https://example.com): ');
      if (siteUrl) {
        const syncChoice = await ask('Send scheduled audits to your RankCLI dashboard? (y/n): ');
        const syncToDashboard = syncChoice.toLowerCase() === 'y' || syncChoice.toLowerCase() === 'yes';
        await setupGitHubAction(projectPath, schedule, siteUrl, syncToDashboard);
      }
    } else {
      console.log('Skipping GitHub Action setup.\n');
    }

    // Summary
    console.log('─'.repeat(60));
    console.log('✅ Setup complete!\n');
    console.log('Next steps:');
    console.log('  1. Commit the changes to your repository');
    console.log('  2. If using GitHub Actions, add required secrets (see .github/SEO_SETUP.md)');
    console.log('  3. Deploy your site to apply tracking code changes');
    console.log('  4. Verify GSC ownership and GA4 data collection\n');

    rl.close();
  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    rl.close();
  }
}

async function setupGA4(projectPath: string, measurementId: string): Promise<void> {
  console.log(`Setting up Google Analytics 4 (${measurementId})...`);

  const result = await injectGA4(projectPath, { measurementId });

  if (result.success) {
    console.log(`✅ ${result.message}`);
    if (result.file) {
      console.log(`   Modified: ${result.file}`);
    }
  } else {
    console.log(`⚠️  ${result.message}`);
    if (result.code) {
      console.log('\nManually add this code to your HTML <head>:\n');
      console.log(result.code);
    }
  }

  // Create/update .env.example
  const envExamplePath = path.join(projectPath, '.env.example');
  const envContent = generateGA4EnvTemplate();
  if (fs.existsSync(envExamplePath)) {
    const existing = fs.readFileSync(envExamplePath, 'utf-8');
    if (!existing.includes('GA4_MEASUREMENT_ID')) {
      fs.appendFileSync(envExamplePath, '\n' + envContent);
      console.log('   Updated: .env.example');
    }
  } else {
    fs.writeFileSync(envExamplePath, envContent);
    console.log('   Created: .env.example');
  }

  console.log('');
}

async function setupGSC(projectPath: string, verificationCode: string): Promise<void> {
  console.log('Setting up Google Search Console verification...');

  const result = await injectGSCVerification(projectPath, verificationCode);

  if (result.success) {
    console.log(`✅ ${result.message}`);
    if (result.file) {
      console.log(`   Modified: ${result.file}`);
    }
  } else {
    console.log(`⚠️  ${result.message}`);
  }

  console.log('');
}

export async function setupGitHubAction(
  projectPath: string,
  schedule: 'daily' | 'weekly' | 'monthly',
  siteUrl?: string,
  syncToDashboard?: boolean
): Promise<void> {
  console.log(`Setting up GitHub Action (${schedule} schedule)...`);

  const config: WorkflowConfig = {
    schedule,
    siteUrl: siteUrl || 'https://example.com',
    features: {
      audit: true,
      autoFix: true,
      createIssues: true,
      createPRs: true,
    },
    syncToDashboard,
  };

  const { files, instructions } = writeGitHubActionFiles(projectPath, config);

  console.log('✅ GitHub Action files created:');
  for (const file of files) {
    console.log(`   - ${path.relative(projectPath, file)}`);
  }

  console.log(instructions);
}

// Show GSC API setup instructions
export function showGSCInstructions(): void {
  console.log(getGSCSetupInstructions());
}
