import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseContentSignal, checkAIBotBlocking } from './ai-readiness.js';
import * as http from '../../utils/http.js';

describe('parseContentSignal', () => {
  it('returns null when no Content-Signal line is present', () => {
    const robots = 'User-agent: *\nDisallow: /admin\n';
    expect(parseContentSignal(robots)).toBeNull();
  });

  it('extracts a standalone Content-Signal line', () => {
    const robots = 'User-agent: *\nContent-Signal: search=yes,ai-train=no,use=reference\nDisallow:\n';
    expect(parseContentSignal(robots)).toBe('search=yes,ai-train=no,use=reference');
  });

  it('is case-insensitive on the directive name', () => {
    const robots = 'content-SIGNAL: ai-train=no\n';
    expect(parseContentSignal(robots)).toBe('ai-train=no');
  });

  it('trims surrounding whitespace but preserves the value casing', () => {
    const robots = '  Content-Signal:   Search=Yes,AI-Train=No  \n';
    expect(parseContentSignal(robots)).toBe('Search=Yes,AI-Train=No');
  });

  it('returns the first Content-Signal line when multiple are present', () => {
    const robots = 'Content-Signal: search=yes\nContent-Signal: ai-train=no\n';
    expect(parseContentSignal(robots)).toBe('search=yes');
  });

  it('returns null for an empty robots.txt', () => {
    expect(parseContentSignal('')).toBeNull();
  });
});

// robots.txt verdicts by bot class. The consequence differs per class, so the finding does:
// a disallowed training crawler is a choice (notice), a disallowed search crawler takes the
// site out of that assistant's answers (warning), a disallowed user-triggered fetcher means
// the assistant cannot read a page a user pastes (warning).
describe('checkAIBotBlocking by class', () => {
  function mockRobots(body: string | null, status = 200) {
    vi.spyOn(http, 'httpGet').mockImplementation(async () => {
      if (body === null) return { data: 'Not found', status: 404, statusText: '', headers: {} } as never;
      return { data: body, status, statusText: '', headers: { 'content-type': 'text/plain' } } as never;
    });
  }
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports training crawlers disallowed as a notice that costs no visibility', async () => {
    mockRobots('User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n');
    const { issues, data } = await checkAIBotBlocking('https://example.com');
    expect(issues.map((i) => i.code)).toEqual(['AI_TRAINING_BOTS_DISALLOWED']);
    expect(issues[0].severity).toBe('notice');
    expect(issues[0].description).toMatch(/GPTBot, ClaudeBot/);
    expect(data.classes.training.disallowed).toEqual(['GPTBot', 'ClaudeBot']);
    expect(data.classes['ai-search'].disallowed).toEqual([]);
  });

  it('reports the search crawlers disallowed as a warning about answers', async () => {
    mockRobots('User-agent: OAI-SearchBot\nDisallow: /\n');
    const { issues } = await checkAIBotBlocking('https://example.com');
    expect(issues.map((i) => i.code)).toEqual(['AI_SEARCH_BOTS_DISALLOWED']);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].description).toMatch(/OAI-SearchBot/);
    expect(issues[0].description).toMatch(/ChatGPT search answers/);
  });

  it('reports user-triggered fetchers disallowed as a warning', async () => {
    mockRobots('User-agent: ChatGPT-User\nUser-agent: Claude-User\nDisallow: /\n');
    const { issues, data } = await checkAIBotBlocking('https://example.com');
    expect(issues.map((i) => i.code)).toEqual(['AI_USER_FETCH_DISALLOWED']);
    expect(data.classes.user.disallowed).toEqual(['ChatGPT-User', 'Claude-User']);
  });

  it('reads the older Anthropic tokens as ClaudeBot', async () => {
    mockRobots('User-agent: anthropic-ai\nDisallow: /\n');
    const { data } = await checkAIBotBlocking('https://example.com');
    expect(data.classes.training.disallowed).toContain('ClaudeBot');
  });

  it('applies a wildcard Disallow to every bot without its own group, and lets an own Allow win', async () => {
    mockRobots('User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n');
    const { issues, data } = await checkAIBotBlocking('https://example.com');
    expect(data.classes['ai-search'].allowed).toEqual(['OAI-SearchBot']);
    expect(data.classes['ai-search'].disallowed).toEqual(['Claude-SearchBot', 'PerplexityBot', 'YouBot']);
    expect(data.allBlocked).toBe(false);
    expect(issues.map((i) => i.code).sort()).toEqual(
      ['AI_SEARCH_BOTS_DISALLOWED', 'AI_TRAINING_BOTS_DISALLOWED', 'AI_USER_FETCH_DISALLOWED'].sort()
    );
  });

  it('collapses to one finding when every AI crawler is disallowed', async () => {
    mockRobots('User-agent: *\nDisallow: /\n');
    const { issues, data } = await checkAIBotBlocking('https://example.com');
    expect(data.allBlocked).toBe(true);
    expect(issues.map((i) => i.code)).toEqual(['AI_BOT_BLOCKED_ALL']);
    expect(issues[0].severity).toBe('warning');
  });

  it('says nothing without a robots.txt, or when the site serves HTML in its place', async () => {
    mockRobots(null);
    expect((await checkAIBotBlocking('https://example.com')).issues).toEqual([]);
    vi.restoreAllMocks();
    vi.spyOn(http, 'httpGet').mockImplementation(async () => ({ data: '<!doctype html><html></html>', status: 200, statusText: '', headers: { 'content-type': 'text/html' } }) as never);
    const { issues, data } = await checkAIBotBlocking('https://example.com');
    expect(issues).toEqual([]);
    expect(data.robotsExists).toBe(false);
  });

  it('ignores comments and path-scoped rules', async () => {
    mockRobots('# block the training bot\nUser-agent: GPTBot\nDisallow: /private/\n');
    const { issues } = await checkAIBotBlocking('https://example.com');
    expect(issues).toEqual([]);
  });
});
