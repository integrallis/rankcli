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
  getUserInfo,
  getAuthenticatedClient,
  WEB_APP_URL,
} from '../lib/config.js';

export interface LoginOptions {
  email?: string;
  browser?: boolean;
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
    if (options.browser) {
      // Browser-based login
      console.log(chalk.cyan('\nOpening browser for login...'));
      console.log(chalk.dim('Complete the login in your browser, then return here.\n'));

      // Open login page with CLI callback
      const loginUrl = `${WEB_APP_URL}/login?cli=true`;
      await open(loginUrl);

      // Wait for user to complete login and paste token
      const { token } = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Paste your CLI token from the browser:',
          mask: '*',
        },
      ]);

      spinner.start('Verifying token...');

      // Verify and exchange token
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        spinner.fail('Invalid token');
        console.log(chalk.red('The token is invalid or expired. Please try again.'));
        return;
      }

      // Get full session
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: '', // Will need to handle this differently
      });

      if (sessionError || !sessionData.session) {
        spinner.fail('Failed to establish session');
        return;
      }

      saveSession(sessionData.session);
      await fetchAndSaveSubscription();

      spinner.succeed(`Logged in as ${chalk.green(data.user.email)}`);
    } else {
      // Email/password login
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
    // Refresh subscription info
    await fetchAndSaveSubscription();

    const { email, planName, sitesLimit } = getUserInfo();

    spinner.stop();

    console.log(chalk.bold('\nRankCLI Account'));
    console.log('─'.repeat(40));
    console.log(`  Email:  ${chalk.cyan(email)}`);
    console.log(`  Plan:   ${chalk.green(planName)}`);
    console.log(`  Sites:  ${sitesLimit} allowed`);
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
    const plan = subscription.plan as { plan_id: string; name: string; sites_limit: number };
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
