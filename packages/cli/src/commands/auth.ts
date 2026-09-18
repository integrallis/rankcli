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
  getUserInfo,
  getAuthenticatedClient,
  getApiUrl,
  ensureApiKeyPlan,
  WEB_APP_URL,
} from '../lib/config.js';

export interface LoginOptions {
  email?: string;
  browser?: boolean; // commander --no-browser: true unless --no-browser is passed
  token?: string; // API key for non-interactive auth
}

interface ConnectStartResponse {
  connectId: string;
  userCode?: string; // absent from servers older than the approve step
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
async function browserLogin(spinner: ReturnType<typeof ora>): Promise<boolean> {
  spinner.start('Starting login...');

  let start: ConnectStartResponse;
  try {
    const res = await fetch(`${getApiUrl()}/functions/v1/mcp-connect-start`, { method: 'POST' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    start = await res.json() as ConnectStartResponse;
  } catch (err) {
    spinner.fail('Could not start login');
    console.log(chalk.red(err instanceof Error ? err.message : 'Network error'));
    return false;
  }

  spinner.text = 'Opening browser to approve...';
  try {
    await open(start.url);
  } catch {
    // Fall through - the link below still works if a browser couldn't
    // be launched (e.g. a headless/SSH session).
  }
  console.log(chalk.dim(`\nIf a browser didn't open, visit:\n${start.url}\n`));
  if (start.userCode) {
    // The page shows the same code before its Approve button, so the user can
    // tell this request apart from a link someone else sent them.
    console.log(`Approve in your browser only if it shows this code: ${chalk.bold(start.userCode)}\n`);
  }

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
      // A browser login only ever yields an API key - no session for
      // fetchAndSaveSubscription() to read the plan through - so resolve
      // the plan from the key itself, or every browser login stays Free.
      await ensureApiKeyPlan({ force: true });
      spinner.succeed(`Logged in as ${chalk.green(status.email)}`);
      return true;
    }
    if (status.status === 'expired' || status.status === 'not_found') {
      spinner.fail('Login link expired');
      console.log(chalk.dim('Run "rankcli login" again.'));
      return false;
    }
  }

  spinner.fail('Timed out waiting for approval');
  console.log(chalk.dim('Run "rankcli login" again when you\'re ready.'));
  return false;
}

/**
 * Validate the API key now in effect (a freshly saved --token, or
 * RANKCLI_API_KEY) and report the plan it resolves to. Returns the exit code.
 */
async function verifyApiKey(spinner: ReturnType<typeof ora>, source: string): Promise<number> {
  spinner.start('Validating API key...');
  const plan = await ensureApiKeyPlan({ force: true });

  if (!plan || plan.status === 'invalid') {
    spinner.fail('Invalid API key');
    console.log(chalk.red(`\n${plan?.error || 'The key was rejected'}`));
    return 1;
  }
  if (plan.status === 'unavailable') {
    spinner.fail('Could not validate API key');
    console.log(chalk.red(`\n${plan.error}`));
    return 1;
  }

  spinner.succeed(`Authenticated via ${source}`);
  const { email, planName } = getUserInfo();
  if (email) console.log(chalk.dim(`\nEmail: ${email}`));
  console.log(chalk.dim(`${email ? '' : '\n'}Plan: ${planName || 'Free'}`));
  if (plan.status === 'free') {
    console.log(chalk.dim('The key works for dashboard sync; the paid checks and API features need a paid plan.'));
  }
  return 0;
}

/** Returns the process exit code: 0 on success, 1 if login failed. */
export async function login(options: LoginOptions): Promise<number> {
  const spinner = ora();

  // An explicit --token always validates and replaces whatever login is
  // stored. It used to short-circuit on "Already logged in" - which is
  // always true in CI once RANKCLI_API_KEY is exported - so the key was
  // never validated and the plan never resolved (paid users audited as Free).
  if (options.token !== undefined) {
    const apiKey = options.token.trim();
    if (!apiKey.startsWith('rankcli_')) {
      console.log(chalk.red(apiKey
        ? 'Invalid API key format. Keys should start with "rankcli_"'
        : 'Empty API key - is the RANKCLI_API_KEY secret set?'));
      return 1;
    }
    if (process.env.RANKCLI_API_KEY && process.env.RANKCLI_API_KEY !== apiKey) {
      // getApiKey() prefers the env var, so that's the key every command
      // will actually send - refuse rather than validate the wrong one.
      console.log(chalk.red('RANKCLI_API_KEY is set to a different key and would take precedence over --token. Unset it or pass the same key.'));
      return 1;
    }
    clearCredentials();
    saveApiKey(apiKey);
    const code = await verifyApiKey(spinner, 'API key');
    if (code !== 0) clearCredentials();
    return code;
  }

  // RANKCLI_API_KEY in the environment is already a login; `rankcli login`
  // validates it and resolves its plan instead of claiming there's nothing to do.
  if (process.env.RANKCLI_API_KEY) {
    return verifyApiKey(spinner, 'RANKCLI_API_KEY');
  }

  if (isLoggedIn()) {
    const { email } = getUserInfo();
    console.log(chalk.yellow(`Already logged in as ${email}`));
    console.log(chalk.dim('Run "rankcli logout" to sign out first.'));
    return 0;
  }

  try {
    if (options.browser !== false && !options.email) {
      // Browser-based login (the default - reduces this to zero typing for
      // anyone with a browser handy). Same device-flow backend as the MCP
      // server's rankcli_connect tool: mint a connect id, open the
      // approval page, poll until claimed, save the resulting API key.
      return (await browserLogin(spinner)) ? 0 : 1;
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
        return 1;
      }

      if (!data.session) {
        spinner.fail('No session returned');
        return 1;
      }

      // Save session
      saveSession(data.session);

      // Fetch subscription info
      await fetchAndSaveSubscription();

      spinner.succeed(`Logged in as ${chalk.green(data.user?.email)}`);

      const { planName, sitesLimit } = getUserInfo();
      console.log(chalk.dim(`\nPlan: ${planName} (${sitesLimit} site${sitesLimit !== 1 ? 's' : ''})`));
      return 0;
    }
  } catch (err) {
    spinner.fail('Login failed');
    console.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
    return 1;
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
      const plan = await ensureApiKeyPlan({ force: true });
      if (plan?.status === 'invalid') {
        spinner.fail(`API key rejected: ${plan.error}`);
        return;
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
