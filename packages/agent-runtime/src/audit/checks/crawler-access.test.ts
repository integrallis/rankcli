import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeCrawlerAccess, isChallengePage, resetCrawlerAccessMemo } from './crawler-access.js';
import * as http from '../../utils/http.js';

const URL_ = 'https://example.com/';

type Answer = number | 'throw' | { status: number; body?: string; headers?: Record<string, string> };

/** Answer by user-agent, so a test can block one crawler and allow the rest. */
function mockByAgent(answerFor: (ua: string) => Answer) {
  return vi.spyOn(http, 'httpGet').mockImplementation(async (_url, config) => {
    const ua = (config?.headers?.['User-Agent'] as string) ?? '';
    const answer = answerFor(ua);
    if (answer === 'throw') throw new Error('network');
    const full = typeof answer === 'number' ? { status: answer } : answer;
    return { data: full.body ?? '', status: full.status, statusText: '', headers: full.headers ?? {} } as never;
  });
}

const isBot = (ua: string, name: string) => ua.includes(name);
const codesOf = (issues: { code: string }[]) => issues.map((i) => i.code);

describe('crawler access at the edge', () => {
  // Block bodies, not concise ones: restoreAllMocks returns VitestUtils, and a concise arrow
  // returns it where the hook expects void.
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCrawlerAccessMemo();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The Cloudflare 2026-09-15 case: robots.txt says nothing is blocked, and Googlebot gets a
  // 403 anyway because a CDN rule refuses it before the origin is reached.
  it('reports a search crawler refused while a browser succeeds', async () => {
    mockByAgent((ua) => (isBot(ua, 'Googlebot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(codesOf(issues)).toContain('SEARCH_CRAWLER_BLOCKED_AT_EDGE');
    expect(issues.find((i) => i.code === 'SEARCH_CRAWLER_BLOCKED_AT_EDGE')?.severity).toBe('error');
  });

  // OpenAI: a site opted out of OAI-SearchBot is not shown in ChatGPT search answers. That is
  // a different loss from training, and it gets its own finding at warning.
  it('reports AI search crawlers as a loss of answers, at warning', async () => {
    mockByAgent((ua) => (isBot(ua, 'OAI-SearchBot') || isBot(ua, 'Claude-SearchBot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    const codes = codesOf(issues);
    expect(codes).toEqual(['AI_SEARCH_CRAWLER_BLOCKED_AT_EDGE']);
    const issue = issues[0];
    expect(issue.severity).toBe('warning');
    expect(issue.title).toMatch(/ChatGPT search answers/);
    expect(issue.title).toMatch(/Claude search results/);
  });

  it('reports user-triggered fetchers as the assistant failing on request, at warning', async () => {
    mockByAgent((ua) => (isBot(ua, 'ChatGPT-User') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(codesOf(issues)).toEqual(['AI_USER_FETCH_BLOCKED_AT_EDGE']);
    expect(issues[0].severity).toBe('warning');
  });

  // Refusing training is a choice 17 percent of Cloudflare zones make. It costs no visibility,
  // so it is a notice: visible, never a failed build.
  it('reports training crawlers at notice and says it costs no visibility', async () => {
    mockByAgent((ua) => (isBot(ua, 'GPTBot') || isBot(ua, 'ClaudeBot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(codesOf(issues)).toEqual(['AI_TRAINING_CRAWLER_BLOCKED_AT_EDGE']);
    expect(issues[0].severity).toBe('notice');
    expect(issues[0].impact).toMatch(/None on visibility/);
  });

  it('keeps the classes apart when several are refused', async () => {
    mockByAgent((ua) => (isBot(ua, 'GPTBot') || isBot(ua, 'PerplexityBot') || isBot(ua, 'bingbot') ? 403 : 200));
    const { issues, data } = await analyzeCrawlerAccess(URL_);
    expect(codesOf(issues).sort()).toEqual(
      ['AI_SEARCH_CRAWLER_BLOCKED_AT_EDGE', 'AI_TRAINING_CRAWLER_BLOCKED_AT_EDGE', 'SEARCH_CRAWLER_BLOCKED_AT_EDGE'].sort()
    );
    expect(data.crawlers.find((c) => c.name === 'PerplexityBot')).toMatchObject({ class: 'ai-search', blocked: true });
    expect(data.crawlers.find((c) => c.name === 'GPTBot')).toMatchObject({ class: 'training', blocked: true });
  });

  // A challenge interstitial answers 200 and is still a refusal: the crawler cannot solve it.
  it('treats a challenge page as a refusal even when it answers 200', async () => {
    const challenge = '<!doctype html><html><head><title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1"></script></head></html>';
    mockByAgent((ua) => (isBot(ua, 'Googlebot') ? { status: 200, body: challenge } : 200));
    const { issues, data } = await analyzeCrawlerAccess(URL_);
    expect(codesOf(issues)).toContain('SEARCH_CRAWLER_BLOCKED_AT_EDGE');
    expect(data.crawlers.find((c) => c.name === 'Googlebot')).toMatchObject({ challenge: true, blocked: true });
    expect(issues[0].description).toMatch(/challenge page/);
  });

  it('recognises the cf-mitigated header as a challenge', () => {
    expect(isChallengePage({ 'cf-mitigated': 'challenge' }, '')).toBe(true);
    expect(isChallengePage({}, '<html><body>Hello</body></html>')).toBe(false);
  });

  it('says nothing when every crawler is served', async () => {
    mockByAgent(() => 200);
    const { issues } = await analyzeCrawlerAccess(URL_);
    expect(issues).toEqual([]);
  });

  // A site that is simply down must not be reported as blocking crawlers - that would turn one
  // outage into a dozen confident findings about bot rules that do not exist.
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
    expect(codesOf(issues)).toContain('SEARCH_CRAWLER_BLOCKED_AT_EDGE');
  });

  // Every crawler getting 429 while the browser got 200 a moment earlier is our own burst.
  it('reads a 429 for every crawler as rate limiting, not as rules', async () => {
    mockByAgent((ua) => (ua.includes('Chrome/131') ? 200 : 429));
    const { issues, data } = await analyzeCrawlerAccess(URL_);
    expect(issues).toEqual([]);
    expect(data.rateLimited).toBe(true);
  });

  it('asks once per origin, however many pages are audited', async () => {
    const spy = mockByAgent(() => 200);
    await analyzeCrawlerAccess('https://example.com/a');
    const calls = spy.mock.calls.length;
    await analyzeCrawlerAccess('https://example.com/b');
    expect(spy.mock.calls.length).toBe(calls);
    await analyzeCrawlerAccess('https://other.example/');
    expect(spy.mock.calls.length).toBeGreaterThan(calls);
  });

  it('names Cloudflare and the mixed-use rule in the fix, since that is the live cause', async () => {
    mockByAgent((ua) => (isBot(ua, 'Googlebot') ? 403 : 200));
    const { issues } = await analyzeCrawlerAccess(URL_);
    const fix = issues.find((i) => i.code === 'SEARCH_CRAWLER_BLOCKED_AT_EDGE')?.howToFix ?? '';
    expect(fix).toMatch(/Cloudflare/);
    expect(fix).toMatch(/Search Console/);
  });
});
