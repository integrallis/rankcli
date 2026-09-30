import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeCrawlerAccess } from './crawler-access.js';
import * as http from '../../utils/http.js';

const URL_ = 'https://example.com/';

/** Answer by user-agent, so a test can block one crawler and allow the rest. */
function mockByAgent(statusFor: (ua: string) => number | 'throw') {
  vi.spyOn(http, 'httpGet').mockImplementation(async (_url, config) => {
    const ua = (config?.headers?.['User-Agent'] as string) ?? '';
    const status = statusFor(ua);
    if (status === 'throw') throw new Error('network');
    return { data: '', status, statusText: '', headers: {} } as never;
  });
}

const isBot = (ua: string, name: string) => ua.includes(name);

describe('crawler access at the edge', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  // The Cloudflare 2026-09-15 case: robots.txt says nothing is blocked, and Googlebot gets a
  // 403 anyway because a CDN rule refuses it before the origin is reached.
  it('reports a search crawler refused while a browser succeeds', async () => {
    mockByAgent((ua) => (isBot(ua, 'Googlebot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('SEARCH_CRAWLER_BLOCKED_AT_EDGE');
    expect(issues.find((i) => i.code === 'SEARCH_CRAWLER_BLOCKED_AT_EDGE')?.severity).toBe('error');
  });

  it('separates AI crawlers from search crawlers', async () => {
    mockByAgent((ua) => (isBot(ua, 'GPTBot') || isBot(ua, 'ClaudeBot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('AI_CRAWLER_BLOCKED_AT_EDGE');
    expect(codes).not.toContain('SEARCH_CRAWLER_BLOCKED_AT_EDGE');
    // Losing citations is not the same as losing the index.
    expect(issues[0].severity).toBe('warning');
  });

  it('says nothing when every crawler is served', async () => {
    mockByAgent(() => 200);
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(issues).toEqual([]);
  });

  // A site that is simply down must not be reported as blocking crawlers - that would turn one
  // outage into six confident findings about bot rules that do not exist.
  it('stays silent when the baseline browser request also fails', async () => {
    mockByAgent(() => 503);
    const { issues, data } = await analyzeCrawlerAccess(URL_);
    expect(issues).toEqual([]);
    expect(data.baselineStatus).toBe(503);
  });

  it('stays silent when the baseline request throws', async () => {
    mockByAgent(() => 'throw');
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(issues).toEqual([]);
  });

  it('treats a crawler network error as unknown, not as a block', async () => {
    mockByAgent((ua) => (isBot(ua, 'GPTBot') ? 'throw' : 200));
    const { issues, data } = await analyzeCrawlerAccess(URL_);
    expect(issues).toEqual([]);
    expect(data.crawlers.find((c) => c.name === 'GPTBot')?.blocked).toBe(false);
  });

  it('reports 429 and 503 as refusals, not just 403', async () => {
    mockByAgent((ua) => (isBot(ua, 'Googlebot') ? 429 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(issues.map((i) => i.code)).toContain('SEARCH_CRAWLER_BLOCKED_AT_EDGE');
  });

  it('names Cloudflare and the mixed-use rule in the fix, since that is the live cause', async () => {
    mockByAgent((ua) => (isBot(ua, 'Googlebot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    const fix = issues.find((i) => i.code === 'SEARCH_CRAWLER_BLOCKED_AT_EDGE')?.howToFix ?? '';
    expect(fix).toMatch(/Cloudflare/);
    expect(fix).toMatch(/Search Console/);
  });
});
