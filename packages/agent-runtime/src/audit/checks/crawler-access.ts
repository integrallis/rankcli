/**
 * Does the page actually answer a crawler?
 *
 * Every other crawler check we run reads robots.txt. That is necessary and not sufficient: a
 * block can also happen at the edge, before the origin or robots.txt has any say. Cloudflare's
 * 2026-09-15 default is the live example - AI Training and Agent crawlers are disallowed by
 * default on ad-supported pages, and because Googlebot is classed as *mixed-use* (it crawls for
 * Search and for AI training in one bot) the block applies to all of its functions. Sites that
 * meant to block AI training started returning 403 to Googlebot on pages and sitemaps, with
 * robots.txt still saying "Allow".
 *
 * So robots.txt reports a site is open while Googlebot is being turned away at the door. That
 * is precisely the failure this check exists to catch: we ask as each crawler and compare
 * against a browser request to the same URL.
 *
 * Deliberately conservative. A difference is only reported when the browser succeeds and the
 * crawler does not, so a site that is simply down produces nothing here, and the baseline is
 * fetched first so a transient failure fails safe. Real crawlers are also verified by IP, which
 * we cannot imitate - a site may treat our spoofed agent differently from the real Googlebot,
 * so the finding says what was observed rather than asserting what Google sees.
 */

import type { AuditIssue } from '../types.js';
import { httpGet } from '../../utils/http.js';

/** The crawlers worth asking about, and why a reader should care that one is blocked. */
const CRAWLERS = [
  {
    name: 'Googlebot',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    matters: 'Google Search indexing',
    critical: true,
  },
  {
    name: 'bingbot',
    userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    matters: 'Bing indexing, and Copilot answers',
    critical: true,
  },
  {
    name: 'GPTBot',
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)',
    matters: 'ChatGPT being able to read and cite the page',
    critical: false,
  },
  {
    name: 'ClaudeBot',
    userAgent: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    matters: 'Claude being able to read and cite the page',
    critical: false,
  },
  {
    name: 'PerplexityBot',
    userAgent:
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    matters: 'Perplexity being able to read and cite the page',
    critical: false,
  },
] as const;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Statuses that mean "refused", as opposed to "broken". */
function isRefusal(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status === 503;
}

async function statusFor(url: string, userAgent: string): Promise<number | null> {
  try {
    const response = await httpGet(url, {
      headers: { 'User-Agent': userAgent },
      timeout: 15000,
      // We want the status itself, not an exception on 4xx/5xx.
      validateStatus: () => true,
    });
    return response.status;
  } catch {
    return null;
  }
}

export interface CrawlerAccessResult {
  issues: AuditIssue[];
  data: {
    baselineStatus: number | null;
    crawlers: { name: string; status: number | null; blocked: boolean }[];
  };
}

export async function analyzeCrawlerAccess(url: string): Promise<CrawlerAccessResult> {
  const issues: AuditIssue[] = [];

  // Baseline first: if a browser cannot fetch it either, nothing here is about crawlers.
  const baselineStatus = await statusFor(url, BROWSER_UA);
  const data: CrawlerAccessResult['data'] = { baselineStatus, crawlers: [] };
  if (baselineStatus === null || baselineStatus >= 400) {
    return { issues, data };
  }

  const results = await Promise.all(
    CRAWLERS.map(async (crawler) => ({
      crawler,
      status: await statusFor(url, crawler.userAgent),
    }))
  );

  const blocked = results.filter(({ status }) => status !== null && isRefusal(status));
  data.crawlers = results.map(({ crawler, status }) => ({
    name: crawler.name,
    status,
    blocked: status !== null && isRefusal(status),
  }));

  if (blocked.length === 0) return { issues, data };

  // A search crawler being refused is a different severity from an AI crawler being refused:
  // one costs organic traffic now, the other costs citations.
  const search = blocked.filter(({ crawler }) => crawler.critical);
  const ai = blocked.filter(({ crawler }) => !crawler.critical);

  if (search.length > 0) {
    const names = search.map(({ crawler }) => crawler.name).join(', ');
    issues.push({
      code: 'SEARCH_CRAWLER_BLOCKED_AT_EDGE',
      severity: 'error',
      category: 'crawlability',
      title: `${names} refused at the edge, not by robots.txt`,
      description: `A browser request to this URL returned ${baselineStatus}, but ${names} received ${search
        .map(({ status }) => status)
        .join(', ')}. Something in front of the origin - a CDN, WAF or bot rule - is turning the crawler away, and robots.txt cannot show you this.`,
      impact:
        'Pages a search crawler cannot fetch fall out of the index. This is the failure mode behind Cloudflare’s 2026-09-15 default, where blocking AI training also blocked Googlebot because it is classed as a mixed-use crawler.',
      howToFix: `Check your CDN or WAF bot rules rather than robots.txt.

On Cloudflare: the zone's Security > Bots settings, and any "Block AI Bots" or AI Crawler Control toggle. Because Googlebot crawls for both Search and AI training, blocking Training applies to all of its functions on ad-supported pages - allow Search crawlers explicitly, or opt out of the default.

Confirm with Search Console's URL Inspection, which fetches as the verified Googlebot.`,
      affectedUrls: [url],
      details: {
        baselineStatus,
        blocked: search.map(({ crawler, status }) => ({ crawler: crawler.name, status })),
        note: 'Observed with the crawler’s user-agent. Real crawlers are also verified by IP, so a site may treat them differently.',
      },
    });
  }

  if (ai.length > 0) {
    const names = ai.map(({ crawler }) => crawler.name).join(', ');
    issues.push({
      code: 'AI_CRAWLER_BLOCKED_AT_EDGE',
      severity: 'warning',
      category: 'ai-readiness',
      title: `${names} refused at the edge, not by robots.txt`,
      description: `A browser request returned ${baselineStatus}, but ${names} received ${ai
        .map(({ status }) => status)
        .join(', ')}. The block is in front of the origin, so allowing these agents in robots.txt will not change it.`,
      impact:
        'An assistant that cannot fetch the page cannot quote it. This is invisible to a robots.txt check, which is where most AI-visibility tools stop.',
      howToFix: `If blocking them is deliberate, nothing to do. If not, the rule is in your CDN or WAF, not robots.txt - on Cloudflare see Security > Bots and any AI Crawler Control setting.`,
      affectedUrls: [url],
      details: {
        baselineStatus,
        blocked: ai.map(({ crawler, status }) => ({ crawler: crawler.name, status })),
      },
    });
  }

  return { issues, data };
}
