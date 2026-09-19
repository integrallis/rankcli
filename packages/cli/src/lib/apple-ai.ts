/**
 * Apple Intelligence: Apple's on-device model (the Foundation Models framework, macOS 26+ on
 * Apple silicon, with Apple Intelligence turned on). It costs nothing and never leaves the
 * machine, so `--ai` uses it by default on a Mac that has it.
 *
 * The framework is Swift-only. The helper in apple-ai-source.ts is compiled with the Xcode
 * command-line tools the first time it's needed (a few seconds) and cached under
 * ~/Library/Caches/rankcli, keyed by a hash of its source; later runs just exec it. That works
 * the same for npm, Homebrew and source installs. RANKCLI_APPLE_AI_HELPER points at a
 * prebuilt helper instead.
 */
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir, release } from 'node:os';
import { join } from 'node:path';
import { APPLE_AI_SWIFT_SOURCE } from './apple-ai-source.js';

export type AppleAIStatus = { available: true; helper: string } | { available: false; reason: string };

type Env = Record<string, string | undefined>;

/** Darwin 25 is macOS 26 (Tahoe), the first release with the Foundation Models framework. */
export function isAppleIntelligenceCapable(
  platform: string = process.platform,
  arch: string = process.arch,
  darwinRelease: string = release(),
): boolean {
  return platform === 'darwin' && arch === 'arm64' && Number(darwinRelease.split('.')[0]) >= 25;
}

const REASONS: Record<string, string> = {
  deviceNotEligible: "this Mac doesn't support Apple Intelligence",
  appleIntelligenceNotEnabled: 'Apple Intelligence is turned off (System Settings > Apple Intelligence & Siri)',
  modelNotReady: 'the on-device model is still downloading',
};

function run(
  file: string,
  args: string[],
  opts: { input?: string; timeoutMs: number },
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, opts.timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr || error.message, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin.on('error', () => {}); // the helper may exit before reading (e.g. --check)
    child.stdin.end(opts.input ?? '');
  });
}

function hasDeveloperTools(): Promise<boolean> {
  // `xcode-select -p` fails quietly when there are no tools; running xcrun/swiftc without
  // them would pop up macOS's "install developer tools" dialog in the middle of an audit.
  return new Promise((resolve) => execFile('xcode-select', ['-p'], (error) => resolve(!error)));
}

let helperPromise: Promise<{ helper: string } | { error: string }> | null = null;

/** The helper binary, compiling it on first use. */
function ensureHelper(env: Env): Promise<{ helper: string } | { error: string }> {
  if (env.RANKCLI_APPLE_AI_HELPER) return Promise.resolve({ helper: env.RANKCLI_APPLE_AI_HELPER });
  helperPromise ??= (async () => {
    const hash = createHash('sha256').update(APPLE_AI_SWIFT_SOURCE).digest('hex').slice(0, 12);
    const dir = join(homedir(), 'Library', 'Caches', 'rankcli', `apple-ai-${hash}`);
    const helper = join(dir, 'rankcli-apple-ai');
    if (existsSync(helper)) return { helper };
    // A build that failed (old SDK, say) isn't retried on every audit - only after a week, so
    // updating Xcode fixes it without anyone clearing a cache.
    const failed = join(dir, 'build-failed');
    if (existsSync(failed) && Date.now() - statSync(failed).mtimeMs < 7 * 24 * 60 * 60 * 1000) {
      return { error: readFileSync(failed, 'utf8') };
    }

    if (!(await hasDeveloperTools())) {
      return { error: 'using it needs the Xcode command-line tools (xcode-select --install)' };
    }
    mkdirSync(dir, { recursive: true });
    const source = join(dir, 'main.swift');
    writeFileSync(source, APPLE_AI_SWIFT_SOURCE);
    process.stderr.write('Preparing Apple Intelligence for RankCLI (one-time build of a small helper)...\n');
    const tmp = `${helper}.${process.pid}`;
    // FoundationModels is macOS 26+; the default target is the host's version.
    const build = await run('xcrun', ['swiftc', '-O', '-target', 'arm64-apple-macos26.0', source, '-o', tmp], { timeoutMs: 180_000 });
    if (build.code !== 0 || !existsSync(tmp)) {
      const firstError = build.stderr.split('\n').find((line) => /error:/.test(line))?.trim();
      const error = `the helper didn't build${firstError ? ` (${firstError})` : ''} - it needs the macOS 26 SDK (update Xcode or its command-line tools)`;
      writeFileSync(failed, error);
      return { error };
    }
    renameSync(tmp, helper);
    return { helper };
  })();
  return helperPromise;
}

/** Is Apple's on-device model usable here? Cheap on anything that isn't an Apple-silicon Mac. */
export async function checkAppleAI(env: Env = process.env): Promise<AppleAIStatus> {
  if (!env.RANKCLI_APPLE_AI_HELPER && !isAppleIntelligenceCapable()) {
    return { available: false, reason: 'it needs macOS 26 or later on Apple silicon' };
  }
  const ensured = await ensureHelper(env);
  if ('error' in ensured) return { available: false, reason: ensured.error };

  const check = await run(ensured.helper, ['--check'], { timeoutMs: 15_000 });
  try {
    const status = JSON.parse(check.stdout) as { available?: boolean; reason?: string };
    if (status.available) return { available: true, helper: ensured.helper };
    return { available: false, reason: REASONS[status.reason ?? ''] ?? 'Apple Intelligence is unavailable' };
  } catch {
    return { available: false, reason: `the helper failed (${(check.stderr || check.stdout).trim().slice(0, 120) || `exit ${check.code}`})` };
  }
}

/** One prompt through the on-device model. */
export async function generateWithAppleAI(
  helper: string,
  request: { system?: string; prompt: string; maxTokens?: number },
  timeoutMs = 120_000,
): Promise<{ text: string } | { error: string }> {
  const result = await run(helper, [], { input: JSON.stringify(request), timeoutMs });
  if (result.timedOut) return { error: `timed out after ${Math.round(timeoutMs / 1000)}s` };
  try {
    const reply = JSON.parse(result.stdout) as { text?: string; error?: string };
    if (typeof reply.text === 'string') return { text: reply.text };
    return { error: reply.error || 'no reply' };
  } catch {
    return { error: (result.stderr || result.stdout).trim().slice(0, 200) || `exit ${result.code}` };
  }
}
