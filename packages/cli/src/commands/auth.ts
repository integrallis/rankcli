import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import open from 'open';
import {
  getSupabaseClient,
  saveSession,
  saveSubscription,
  clearCredentials,
  isLoggedIn,
  isApiKeyAuth,
  getApiKey,
  saveApiKey,
  validateApiKey,
  getUserInfo,
  getAuthenticatedClient,
  getApiUrl,
  WEB_APP_URL,
} from '../lib/config.js';

export interface LoginOptions {
  email?: string;
  browser?: boolean; // commander --no-browser: true unless --no-browser is passed
  token?: string; // API key for non-interactive auth
}

interface ConnectStartResponse {
  connectId: string;
  url: string;
  expiresInSeconds: number;
}

interface ConnectStatusResponse {
  status: 'pending' | 'claimed' | 'expired' | 'not_found';
  email?: string;
  apiKey?: string;
  apiKeyName?: string;
}

// Device-flow login shared with the MCP server's rankcli_connect tool
// (same mcp-connect-start/mcp-connect-status backend, see
// packages/mcp-server/src/index.ts) - mint a connect id, open the approval
// page in the user's browser, poll until they approve it there, save the
// resulting API key. Replaces the old --browser flow, which opened a page
// that had nothing on it to copy - it prompted for a "CLI token" the site
// never actually displayed anywhere.
async function browserLogin(spinner: ReturnType<typeof ora>): Promise<void> {
  spinner.start('Starting login...');

  let start: ConnectStartResponse;
  try {
    const res = await fetch(`${getApiUrl()}/functions/v1/mcp-connect-start`, { method: 'POST' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    start = await res.json() as ConnectStartResponse;
  } catch (err) {
    spinner.fail('Could not start login');
    console.log(chalk.red(err instanceof Error ? err.message : 'Network error'));
    return;
  }

  spinner.text = 'Opening browser to approve...';
  try {
    await open(start.url);
  } catch {
    // Fall through - the link below still works if a browser couldn't
    // be launched (e.g. a headless/SSH session).
  }
  console.log(chalk.dim(`\nIf a browser didn't open, visit:\n${start.url}\n`));

  const deadline = Date.now() + start.expiresInSeconds * 1000;
  spinner.text = 'Waiting for approval in your browser...';

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let status: ConnectStatusResponse;
    try {
      const res = await fetch(`${getApiUrl()}/functions/v1/mcp-connect-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectId: start.connectId }),
      });
      status = await res.json() as ConnectStatusResponse;
    } catch {
      continue; // transient network error - keep polling until the deadline
    }

    if (status.status === 'claimed' && status.apiKey) {
      saveApiKey(status.apiKey, status.apiKeyName, status.email);
      await fetchAndSaveSubscription();
      spinner.succeed(`Logged in as ${chalk.green(status.email)}`);
      return;
    }
    if (status.status === 'expired' || status.status === 'not_found') {
      spinner.fail('Login link expired');
      console.log(chalk.dim('Run "rankcli login" again.'));
      return;
    }
  }

  spinner.fail('Timed out waiting for approval');
  console.log(chalk.dim('Run "rankcli login" again when you\'re ready.'));
}

export async function login(options: LoginOptions): Promise<void> {
  if (isLoggedIn()) {
    const { email } = getUserInfo();
    console.log(chalk.yellow(`Already logged in as ${email}`));
    console.log(chalk.dim('Run "rankcli logout" to sign out first.'));
    return;
  }

  const spinner = ora();

  try {
    // API key authentication (--token flag)
    if (options.token) {
      const apiKey = options.token;

      if (!apiKey.startsWith('rankcli_')) {
        console.log(chalk.red('Invalid API key format. Keys should start with "rankcli_"'));
        return;
      }

      spinner.start('Validating API key...');

      const result = await validateApiKey(apiKey);

      if (!result.valid) {
        spinner.fail('Invalid API key');
        console.log(chalk.red(`\n${result.error}`));
        return;
      }

      // Save API key and user info
      saveApiKey(apiKey);
      if (result.subscription) {
        saveSubscription({
          planId: result.subscription.planId,
          planName: result.subscription.planName,
          sitesLimit: result.subscription.sitesLimit,
        });
      }

      spinner.succeed(`Authenticated via API key`);
      console.log(chalk.dim(`\nEmail: ${result.user?.email}`));
      console.log(chalk.dim(`Plan: ${result.subscription?.planName || 'Free'}`));
      return;
    }

    if (options.browser !== false && !options.email) {
      // Browser-based login (the default - reduces this to zero typing for
      // anyone with a browser handy). Same device-flow backend as the MCP
      // server's rankcli_connect tool: mint a connect id, open the
      // approval page, poll until claimed, save the resulting API key.
      await browserLogin(spinner);
    } else {
      // Email/password login (opt-in via --email or --no-browser)
      let email = options.email;

      if (!email) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => {
              if (!input.includes('@')) return 'Please enter a valid email';
              return true;
            },
          },
        ]);
        email = answers.email;
      }

      const { password } = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*',
        },
      ]);

      spinner.start('Signing in...');

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email!,
        password,
      });

      if (error) {
        spinner.fail('Login failed');
        console.log(chalk.red(`\n${error.message}`));

        if (error.message.includes('Invalid login')) {
          console.log(chalk.dim('\nDon\'t have an account? Sign up at:'));
          console.log(chalk.cyan(`  ${WEB_APP_URL}/signup`));
        }
        return;
      }

      if (!data.session) {
        spinner.fail('No session returned');
        return;
      }

      // Save session
      saveSession(data.session);

      // Fetch subscription info
      await fetchAndSaveSubscription();

      spinner.succeed(`Logged in as ${chalk.green(data.user?.email)}`);

      const { planName, sitesLimit } = getUserInfo();
      console.log(chalk.dim(`\nPlan: ${planName} (${sitesLimit} site${sitesLimit !== 1 ? 's' : ''})`));
    }
  } catch (err) {
    spinner.fail('Login failed');
    console.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
  }
}

export async function logout(): Promise<void> {
  if (!isLoggedIn()) {
    console.log(chalk.yellow('Not logged in'));
    return;
  }

  const { email } = getUserInfo();
  const spinner = ora('Signing out...').start();

  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    clearCredentials();

    spinner.succeed(`Logged out from ${chalk.dim(email)}`);
  } catch (err) {
    spinner.fail('Logout failed');
    console.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
  }
}

export async function whoami(): Promise<void> {
  if (!isLoggedIn()) {
    console.log(chalk.yellow('Not logged in'));
    console.log(chalk.dim('\nRun "rankcli login" to sign in.'));
    console.log(chalk.dim(`Or sign up at: ${WEB_APP_URL}/signup`));
    return;
  }

  const spinner = ora('Checking account...').start();

  try {
    // If using API key, validate and get fresh info
    if (isApiKeyAuth()) {
      const apiKey = getApiKey();
      if (apiKey) {
        const result = await validateApiKey(apiKey);
        if (result.valid && result.subscription) {
          saveSubscription({
            planId: result.subscription.planId,
            planName: result.subscription.planName,
            sitesLimit: result.subscription.sitesLimit,
          });
        }
      }
    } else {
      // Refresh subscription info via session
      await fetchAndSaveSubscription();
    }

    const { email, planName, sitesLimit } = getUserInfo();
    const authMethod = isApiKeyAuth() ? 'API Key' : 'Session';

    spinner.stop();

    console.log(chalk.bold('\nRankCLI Account'));
    console.log('─'.repeat(40));
    console.log(`  Email:  ${chalk.cyan(email || 'N/A')}`);
    console.log(`  Plan:   ${chalk.green(planName)}`);
    console.log(`  Sites:  ${sitesLimit} allowed`);
    console.log(`  Auth:   ${chalk.dim(authMethod)}`);
    console.log('─'.repeat(40));
    console.log(chalk.dim(`\nManage at: ${WEB_APP_URL}/account`));
  } catch (err) {
    spinner.fail('Failed to fetch account info');
    console.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
  }
}

// Helper: Fetch and save subscription info
async function fetchAndSaveSubscription(): Promise<void> {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return;

  const { userId } = getUserInfo();
  if (!userId) return;

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select(`
      plan:subscription_plans (
        plan_id,
        name,
        sites_limit
      )
    `)
    .eq('user_id', userId)
    .single();

  if (subscription?.plan) {
    // Without generated Database types, supabase-js infers this many-to-one
    // embed (subscription_plans is the "one" side of the FK) as an array -
    // a known limitation, not the real shape; PostgREST returns a single
    // object here, same as the identical pattern in
    // supabase/functions/validate-api-key/index.ts. Cast through unknown
    // since the inferred array type doesn't structurally overlap enough
    // for a direct assertion.
    const plan = subscription.plan as unknown as { plan_id: string; name: string; sites_limit: number };
    saveSubscription({
      planId: plan.plan_id,
      planName: plan.name,
      sitesLimit: plan.sites_limit,
    });
  } else {
    // Free tier
    saveSubscription({
      planId: undefined,
      planName: 'Free',
      sitesLimit: 1,
    });
  }
}
