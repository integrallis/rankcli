// Alerts Command - Configure Slack/Discord notifications
// Sets up webhook notifications for SEO events

import * as readline from 'readline';

interface AlertsOptions {
  channel?: 'slack' | 'discord';
  webhook?: string;
  test?: boolean;
  list?: boolean;
  remove?: string;
}

const ALERT_TYPES = [
  { id: 'error', label: 'Critical errors detected', default: true },
  { id: 'score_drop', label: 'Score drops (configurable threshold)', default: true },
  { id: 'weekly_report', label: 'Weekly summary reports', default: false },
  { id: 'pr_created', label: 'Fix PRs created', default: true },
];

async function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function askYesNo(rl: readline.Interface, question: string, defaultYes = true): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(rl, `${question} ${suffix}: `);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function alerts(options: AlertsOptions): Promise<void> {
  console.log('\n🔔 RankCLI - Alert Configuration\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // List existing configs
    if (options.list) {
      console.log('📋 Current alert configurations:\n');
      console.log('   (Alert configs are stored in your RankCLI account)');
      console.log('   Run `rankcli login` first, then manage alerts at https://rankcli.dev/account?tab=notifications\n');
      rl.close();
      return;
    }

    // Test existing webhook
    if (options.test && options.webhook) {
      await testWebhook(options.channel || 'slack', options.webhook);
      rl.close();
      return;
    }

    // Interactive setup
    console.log('Configure notifications for SEO audit events.\n');
    console.log('Supported channels:');
    console.log('  • Slack  - Use an Incoming Webhook URL');
    console.log('  • Discord - Use a Channel Webhook URL\n');

    // Choose channel
    const channelChoice = await ask(rl, 'Which channel? (slack/discord): ');
    const channel = channelChoice.toLowerCase() as 'slack' | 'discord';
    
    if (channel !== 'slack' && channel !== 'discord') {
      console.log('\n❌ Invalid channel. Please choose "slack" or "discord".\n');
      rl.close();
      return;
    }

    // Get webhook URL
    console.log('');
    if (channel === 'slack') {
      console.log('To create a Slack webhook:');
      console.log('1. Go to https://api.slack.com/apps');
      console.log('2. Create an app (or use existing)');
      console.log('3. Enable "Incoming Webhooks"');
      console.log('4. Add a new webhook to your workspace');
      console.log('5. Copy the webhook URL\n');
    } else {
      console.log('To create a Discord webhook:');
      console.log('1. Open Discord channel settings');
      console.log('2. Go to Integrations → Webhooks');
      console.log('3. Create a new webhook');
      console.log('4. Copy the webhook URL\n');
    }

    const webhookUrl = await ask(rl, 'Webhook URL: ');
    
    if (!webhookUrl.startsWith('https://')) {
      console.log('\n❌ Invalid webhook URL. Must start with https://\n');
      rl.close();
      return;
    }

    // Configure alert types
    console.log('\nWhich events should trigger alerts?\n');
    const selectedTypes: string[] = [];
    
    for (const alertType of ALERT_TYPES) {
      const enabled = await askYesNo(rl, `  ${alertType.label}`, alertType.default);
      if (enabled) {
        selectedTypes.push(alertType.id);
      }
    }

    // Score drop threshold
    let scoreDropThreshold = 10;
    if (selectedTypes.includes('score_drop')) {
      const thresholdStr = await ask(rl, '\nMinimum score drop to alert (default: 10): ');
      if (thresholdStr) {
        const parsed = parseInt(thresholdStr, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
          scoreDropThreshold = parsed;
        }
      }
    }

    // Test the webhook
    console.log('\n📤 Testing webhook...');
    const testResult = await testWebhook(channel, webhookUrl);
    
    if (!testResult) {
      console.log('❌ Webhook test failed. Please check the URL and try again.\n');
      rl.close();
      return;
    }

    console.log('✅ Webhook test successful!\n');

    // Save config
    console.log('📝 Alert configuration:');
    console.log(`   Channel: ${channel}`);
    console.log(`   Events: ${selectedTypes.join(', ')}`);
    if (selectedTypes.includes('score_drop')) {
      console.log(`   Score drop threshold: ${scoreDropThreshold} points`);
    }
    console.log('');
    
    console.log('To save this configuration:');
    console.log('1. Log in with `rankcli login`');
    console.log('2. Add alert config at https://rankcli.dev/account?tab=notifications');
    console.log('');
    console.log('Or use the API:');
    console.log(`   POST /api/alerts with webhook_url and settings`);
    console.log('');

    rl.close();
  } catch (error) {
    console.error('Error:', error);
    rl.close();
    process.exit(1);
  }
}

async function testWebhook(channel: 'slack' | 'discord', webhookUrl: string): Promise<boolean> {
  const testPayload = channel === 'slack' 
    ? {
        text: '🔔 RankCLI Alert Test',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔔 RankCLI Alert Test',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'This is a test message from RankCLI. If you see this, your webhook is working correctly!',
            },
          },
        ],
      }
    : {
        embeds: [
          {
            title: '🔔 RankCLI Alert Test',
            description: 'This is a test message from RankCLI. If you see this, your webhook is working correctly!',
            color: 0x2563eb,
            footer: {
              text: '🤖 Sent by RankCLI',
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook test error:', error);
    return false;
  }
}
