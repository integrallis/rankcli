/**
 * Does the page actually answer each crawler?
 *
 * Every other crawler check reads robots.txt. That is necessary and not sufficient: a block
 * can also happen at the edge, before the origin or robots.txt has any say. Cloudflare's
 * defaults are the live example: known AI crawlers blocked on new zones since 2025-07-01, and
 * training and agent crawlers blocked on ad-bearing pages since 2026-09-15, where Googlebot,
 * classed as mixed-use, was turned away too while robots.txt still said "Allow". One law firm
 * found every AI crawler locked out for seven months by a default it never chose; its advice,
 * "assume you're blocked until you prove otherwise", is the reason this check fetches instead
 * of parsing.
 *
 * So we ask as each crawler and compare against a browser request to the same URL, and report
 * by class (see ai-bots.ts): a refused search crawler costs the index, a refused AI search
 * crawler costs that assistant's answers, a refused user-triggered fetcher costs the page a
 * user just asked about, and a refused training crawler costs nothing a user sees.
 *
 * Deliberately conservative. A difference is only reported when the browser succeeds and the
 * crawler does not, so a site that is simply down produces nothing here; the baseline is
 * fetched first so a transient failure fails safe; crawlers are asked a few at a time so the
 * burst does not earn a 429 of its own; and a 429 for every crawler is read as rate limiting,
 * not as a rule. Real crawlers are also verified by IP, which we cannot imitate, so a finding
 * says what was observed with the crawler's user-agent rather than asserting what Google sees.
 */

import type { AuditIssue } from '../types.js';
import { httpGet } from '../../utils/http.js';
import { KNOWN_BOTS, type BotClass, type KnownBot } from './ai-bots.js';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Statuses that mean "refused", as opposed to "broken". */
function isRefusal(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status === 503;
}

/**
 * A challenge page is a refusal that can answer 200: an interstitial the crawler cannot solve.
 * Cloudflare marks its own with cf-mitigated: challenge and the challenge-platform script.
 */
export function isChallengePage(headers: Record<string, string>, body: unknown): boolean {
  const mitigated = headers['cf-mitigated'] ?? headers['CF-Mitigated'];
  if (mitigated && /challenge/i.test(mitigated)) return true;
  if (typeof body !== 'string') return false;
  const head = body.slice(0, 4000);
  return /cdn-cgi\/challenge-platform|<title>Just a moment\.\.\.<\/title>|_cf_chl_opt/.test(head);
}

interface Probe {
  status: number | null;
  challenge: boolean;
}

async function probe(url: string, userAgent: string): Promise<Probe> {
  try {
    const response = await httpGet(url, {
      headers: { 'User-Agent': userAgent },
      timeout: 15000,
      // We want the status itself, not an exception on 4xx/5xx.
      validateStatus: () => true,
    });
    return { status: response.status, challenge: isChallengePage(response.headers ?? {}, response.data) };
  } catch {
    return { status: null, challenge: false };
  }
}

const refused = (p: Probe): boolean => p.challenge || (p.status !== null && isRefusal(p.status));

/** Run a few at a time: a dozen simultaneous requests is the burst that earns a 429. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export interface CrawlerAccessResult {
  issues: AuditIssue[];
  data: {
    baselineStatus: number | null;
    /** True when every crawler got 429: the audit's own burst, not a rule, so nothing is reported. */
    rateLimited: boolean;
    crawlers: { name: string; class: BotClass; status: number | null; challenge: boolean; blocked: boolean }[];
  };
}

// One answer per origin per run. The block lives in front of the origin, and asking a dozen
// crawlers on each of five pages would be sixty requests for one fact.
const MEMO_TTL_MS = 10 * 60 * 1000;
const memo = new Map<string, { at: number; result: Promise<CrawlerAccessResult> }>();

/** Forget cached answers (tests, and long-lived processes that audit the same origin again). */
export function resetCrawlerAccessMemo(): void {
  memo.clear();
}

export async function analyzeCrawlerAccess(url: string): Promise<CrawlerAccessResult> {
  const origin = new URL(url).origin;
  const hit = memo.get(origin);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.result;
  const result = run(url);
  memo.set(origin, { at: Date.now(), result });
  return result;
}

type Outcome = { bot: KnownBot; probe: Probe };

function statusText(p: Probe): string {
  if (p.challenge) return p.status === null ? 'a challenge page' : `a challenge page (${p.status})`;
  return String(p.status);
}

function describe(outcomes: Outcome[]): { names: string; statuses: string; loses: string } {
  return {
    names: outcomes.map(({ bot }) => bot.name).join(', '),
    statuses: outcomes.map(({ probe }) => statusText(probe)).join(', '),
    loses: outcomes.map(({ bot }) => bot.loses).join(', '),
  };
}

async function run(url: string): Promise<CrawlerAccessResult> {
  const issues: AuditIssue[] = [];
  const data: CrawlerAccessResult['data'] = { baselineStatus: null, rateLimited: false, crawlers: [] };

  // Baseline first: if a browser cannot fetch it either, nothing here is about crawlers.
  const baseline = await probe(url, BROWSER_UA);
  data.baselineStatus = baseline.status;
  if (baseline.status === null || baseline.status >= 400 || baseline.challenge) {
    return { issues, data };
  }

  const live = KNOWN_BOTS.filter((bot): bot is KnownBot & { userAgent: string } => bot.userAgent !== null);
  const outcomes = await mapLimit(live, 3, async (bot) => ({ bot, probe: await probe(url, bot.userAgent) }));

  data.crawlers = outcomes.map(({ bot, probe }) => ({
    name: bot.name,
    class: bot.class,
    status: probe.status,
    challenge: probe.challenge,
    blocked: refused(probe),
  }));

  const blocked = outcomes.filter(({ probe }) => refused(probe));
  if (blocked.length === 0) return { issues, data };

  if (blocked.length === live.length && blocked.every(({ probe }) => probe.status === 429 && !probe.challenge)) {
    data.rateLimited = true;
    return { issues, data };
  }

  const ofClass = (cls: BotClass) => blocked.filter(({ bot }) => bot.class === cls);
  const observed = 'Observed with the crawler’s user-agent. Real crawlers are also verified by IP, so a site may treat them differently.';
  const blockedDetail = (outcomes: Outcome[]) =>
    outcomes.map(({ bot, probe }) => ({ crawler: bot.name, status: probe.status, challenge: probe.challenge }));

  const search = ofClass('search');
  if (search.length > 0) {
    const { names, statuses } = describe(search);
    issues.push({
      code: 'SEARCH_CRAWLER_BLOCKED_AT_EDGE',
      severity: 'error',
      category: 'crawlability',
      title: `${names} refused at the edge, not by robots.txt`,
      description: `A browser request to this URL returned ${baseline.status}, but ${names} received ${statuses}. Something in front of the origin - a CDN, WAF or bot rule - is turning the crawler away, and robots.txt cannot show you this.`,
      impact:
        'Pages a search crawler cannot fetch fall out of the index, and 88 percent of ChatGPT citations come from that index. This is the failure mode behind Cloudflare’s 2026-09-15 default, where blocking AI training also blocked Googlebot because it is classed as a mixed-use crawler.',
      howToFix: `Check your CDN or WAF bot rules rather than robots.txt.

On Cloudflare: the zone's Security > Bots settings, and any "Block AI Bots" or AI Crawler Control toggle. Because Googlebot crawls for both Search and AI training, blocking Training applies to all of its functions on ad-supported pages - allow Search crawlers explicitly, or opt out of the default.

Confirm with Search Console's URL Inspection, which fetches as the verified Googlebot.`,
      affectedUrls: [url],
      details: { baselineStatus: baseline.status, blocked: blockedDetail(search), note: observed },
    });
  }

  const aiSearch = ofClass('ai-search');
  if (aiSearch.length > 0) {
    const { names, statuses, loses } = describe(aiSearch);
    issues.push({
      code: 'AI_SEARCH_CRAWLER_BLOCKED_AT_EDGE',
      severity: 'warning',
      category: 'ai-readiness',
      title: `${names} refused at the edge: the site is out of ${loses}`,
      description: `A browser request returned ${baseline.status}, but ${names} received ${statuses}. These crawlers build the index each assistant answers from: OpenAI documents that a site opted out of OAI-SearchBot is not shown in ChatGPT search answers, and Anthropic says the same of Claude-SearchBot. The block is in front of the origin, so robots.txt cannot show it and allowing the bot there will not lift it.`,
      impact:
        'The site is absent from those assistants’ answers whatever robots.txt says. Refusing the training crawlers (GPTBot, ClaudeBot) does not have this effect; refusing the search crawlers does.',
      howToFix: `If the refusal is deliberate, nothing to do. Otherwise the rule is in the CDN or WAF, not robots.txt: on Cloudflare, Security > Bots (AI Crawl Control) lists Search crawlers separately from Training crawlers - allow the Search class and keep Training blocked if that is the policy. Then fetch the page as the bot again; assume you are blocked until that says otherwise.`,
      affectedUrls: [url],
      details: { baselineStatus: baseline.status, blocked: blockedDetail(aiSearch), note: observed },
    });
  }

  const user = ofClass('user');
  if (user.length > 0) {
    const { names, statuses } = describe(user);
    issues.push({
      code: 'AI_USER_FETCH_BLOCKED_AT_EDGE',
      severity: 'warning',
      category: 'ai-readiness',
      title: `${names} refused at the edge: assistants cannot read this page when a user asks`,
      description: `A browser request returned ${baseline.status}, but ${names} received ${statuses}. These agents fetch one page because a user pasted its link or asked about it; they are not crawlers and visit nothing on their own.`,
      impact:
        'A user who asks ChatGPT, Claude or Perplexity about this page gets an error instead of its content.',
      howToFix:
        'Allow the user-triggered agents (ChatGPT-User, Claude-User, Perplexity-User) in the CDN or WAF rule, even where the training crawlers stay blocked; Cloudflare’s AI Crawl Control lists them as their own category.',
      affectedUrls: [url],
      details: { baselineStatus: baseline.status, blocked: blockedDetail(user), note: observed },
    });
  }

  const training = ofClass('training');
  if (training.length > 0) {
    const { names, statuses } = describe(training);
    issues.push({
      code: 'AI_TRAINING_CRAWLER_BLOCKED_AT_EDGE',
      severity: 'notice',
      category: 'ai-readiness',
      title: `${names} refused at the edge (training crawlers)`,
      description: `A browser request returned ${baseline.status}, but ${names} received ${statuses}. These crawlers collect model-training data only; OpenAI and Anthropic both document that refusing them has no effect on search answers.`,
      impact:
        'None on visibility. Listed so the block is a decision rather than a default you did not know about: Cloudflare has blocked known AI crawlers on new zones since 2025-07-01 and on ad-bearing pages since 2026-09-15.',
      howToFix:
        'Nothing, if that is the intent. To let these crawlers in, change the CDN or WAF rule; robots.txt cannot override an edge block.',
      affectedUrls: [url],
      details: { baselineStatus: baseline.status, blocked: blockedDetail(training), note: observed },
    });
  }

  return { issues, data };
}
