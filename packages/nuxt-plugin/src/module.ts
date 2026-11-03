/**
 * nuxt-rankcli: the full RankCLI audit of what `nuxi generate` produced.
 *
 * A static build leaves the pages in `.output/public`; the module serves that directory the
 * way a static host would and runs the same 280+ checks as `rankcli audit --dir`, then logs
 * the score and every error and warning with its code, and fails the build when `failOn`
 * says so. A server build (`nuxi build`) leaves no pages to audit, so the module says that
 * once and names the command to run against the deployed or preview URL, where Nuxt's
 * rendering and the host's crawler rules can actually be observed.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineNuxtModule } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import { auditBuildOutput } from './audit.js';

export interface ModuleOptions {
  /**
   * The site's public URL, for canonical and sitemap checks. Falls back to `site.url`
   * (the nuxt-seo convention), `runtimeConfig.public.siteUrl` and NUXT_PUBLIC_SITE_URL.
   */
  siteUrl?: string;
  /** Run the audit after `nuxi generate`. Default: true. */
  audit?: boolean;
  /** Pages to audit. Default: every generated page, up to 50. */
  maxPages?: number;
  /**
   * Fail the build on these rules, the syntax of `rankcli audit --fail-on`: `error`,
   * `warning` or `notice` (any finding at or above), `score<80`, `score:aiReadiness<70`.
   */
  failOn?: string | string[];
}

interface NuxtLike {
  options: Record<string, unknown> & { dev?: boolean; rootDir?: string; _generate?: boolean; nitro?: { static?: boolean; output?: { publicDir?: string } } };
  hook: (name: string, handler: (...args: never[]) => void | Promise<void>) => void;
}

interface NitroLike {
  options: { output: { publicDir: string } };
  logger?: { info: (m: string) => void; warn: (m: string) => void };
}

/** The URL the build is for, from the module options or the places Nuxt sites keep it. */
export function resolveSiteUrl(options: ModuleOptions, nuxtOptions: NuxtLike['options']): string | undefined {
  const site = nuxtOptions.site as { url?: string } | undefined;
  const runtime = nuxtOptions.runtimeConfig as { public?: { siteUrl?: string } } | undefined;
  const url = options.siteUrl ?? site?.url ?? runtime?.public?.siteUrl ?? process.env.NUXT_PUBLIC_SITE_URL;
  return url ? url.replace(/\/$/, '') : undefined;
}

/** What the module does once the build is over; exported so it can be tested without Nuxt. */
export async function auditGeneratedOutput(
  options: ModuleOptions,
  nuxtOptions: NuxtLike['options'],
  publicDir: string | undefined,
  logger: { info: (m: string) => void; warn: (m: string) => void }
): Promise<void> {
  const log = (m: string) => logger.info(`[nuxt-rankcli] ${m}`);
  const warn = (m: string) => logger.warn(`[nuxt-rankcli] ${m}`);
  const siteUrl = resolveSiteUrl(options, nuxtOptions);
  const isStatic = !!(nuxtOptions.nitro?.static || nuxtOptions._generate);
  if (!isStatic || !publicDir || !existsSync(join(publicDir, 'index.html'))) {
    log(`Nothing static to audit after this build. Audit the deployment instead: npx @rankcli/cli audit --url ${siteUrl ?? 'https://your-site.com'} --fail-on error`);
    return;
  }
  if (!siteUrl) warn('No siteUrl: set rankcli.siteUrl (or site.url); canonical and sitemap checks compare against http://localhost until then.');
  const pageCount = countHtml(publicDir);
  await auditBuildOutput({ siteUrl: siteUrl ?? 'http://localhost', dir: publicDir, maxPages: options.maxPages, pageCount, failOn: options.failOn, log, warn, name: 'nuxt-rankcli' });
}

/** How many pages the build produced, for the default page budget. */
function countHtml(dir: string): number {
  let n = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop()!;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(join(d, entry.name));
      else if (entry.name.endsWith('.html')) n++;
    }
  }
  return n;
}

// Annotated so the emitted types name @nuxt/schema instead of a pnpm store path.
const nuxtRankcli: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-rankcli',
    configKey: 'rankcli',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    audit: true,
  },
  setup(options, nuxt) {
    if (options.audit === false || (nuxt as unknown as NuxtLike).options.dev) return;
    const n = nuxt as unknown as NuxtLike;
    let publicDir: string | undefined;
    let logger: NitroLike['logger'];
    // `nitro:init` tells us where the output goes; `close` fires once generate is done.
    n.hook('nitro:init', ((nitro: NitroLike) => {
      publicDir = nitro.options.output.publicDir;
      logger = nitro.logger;
    }) as never);
    n.hook('close', (async () => {
      await auditGeneratedOutput(options, n.options, publicDir, logger ?? { info: console.log, warn: console.warn });
    }) as never);
  },
});

export default nuxtRankcli;
