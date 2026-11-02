// AI/LLM Readiness Checks
// Checks for llms.txt, AI bot blocking, and JS rendering ratio

import { httpGet, looksLikeHtmlFallback } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';
import { checkAgentExperience, type AgentExperienceData } from './agent-experience.js';
import { KNOWN_BOTS, type BotClass, type KnownBot } from './ai-bots.js';

export interface LlmsTxtResult {
  exists: boolean;
  content?: string;
  valid: boolean;
  errors: string[];
}

export interface AIBotBlockingResult {
  robotsExists: boolean;
  blockedBots: string[];
  allowedBots: string[];
  /** Every AI crawler (search, user-triggered and training) is disallowed. */
  allBlocked: boolean;
  /** The same verdicts grouped by what each bot is for (see ai-bots.ts). */
  classes: Record<BotClass, { allowed: string[]; disallowed: string[] }>;
  // The Content Signals robots.txt extension (Content-Signal: search=yes,
  // ai-train=no,use=reference) - the mechanism Cloudflare's Sep 2026 AI
  // Crawl Control update actually reads, distinct from and in addition to
  // per-bot User-agent/Disallow rules. Null if no such line is present.
  contentSignal: string | null;
}

export interface CloudflareAICrawlerGateResult {
  behindCloudflare: boolean;
  hasExplicitAIRules: boolean;
  ambiguous: boolean; // behind Cloudflare with no explicit AI crawler rules
}

export interface AIReadinessData {
  llmsTxt: LlmsTxtResult;
  botBlocking: AIBotBlockingResult;
  jsRenderingRatio: number; // 0-100%
  cloudflareAIGate: CloudflareAICrawlerGateResult;
  agentExperience: AgentExperienceData;
}

/**
 * Check for llms.txt file
 * See: https://llmstxt.org/
 */
export async function checkLlmsTxt(baseUrl: string): Promise<{ issues: AuditIssue[]; data: LlmsTxtResult }> {
  const issues: AuditIssue[] = [];
  const url = new URL('/llms.txt', baseUrl).href;

  try {
    const response = await httpGet<string>(url, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 404 || response.status >= 400) {
      issues.push({
        ...ISSUE_DEFINITIONS.LLMS_TXT_MISSING,
        affectedUrls: [url],
      });
      return {
        issues,
        data: { exists: false, valid: false, errors: ['File not found'] },
      };
    }

    const content = response.data as string;

    // A single-page app answers 200 with its own HTML for any unknown path, so a 2xx here
    // is not evidence the file exists. Without this the SPA shell was validated as an
    // llms.txt and reported as invalid - "no title", "no description" - for a file the site
    // never had, sending the user to fix something that wasn't there.
    if (looksLikeHtmlFallback(content, response.headers?.['content-type'])) {
      issues.push({
        ...ISSUE_DEFINITIONS.LLMS_TXT_MISSING,
        affectedUrls: [url],
      });
      return { issues, data: { exists: false, valid: false, errors: ['File not found (the site served HTML)'] } };
    }

    // Basic validation of llms.txt format
    // Expected format starts with # followed by site name, then markdown content
    const lines = content.split('\n').filter((line) => line.trim());
    const errors: string[] = [];
    let valid = true;

    // Check if it starts with a title (# Site Name)
    if (lines.length === 0) {
      errors.push('File is empty');
      valid = false;
    } else if (!lines[0].startsWith('#')) {
      errors.push('File should start with a markdown heading (# Site Name)');
      valid = false;
    }

    // Check for common sections
    const hasDescription = content.toLowerCase().includes('## ') || content.length > 50;
    if (!hasDescription) {
      errors.push('File should contain meaningful content describing your site for AI');
      valid = false;
    }

    if (!valid) {
      issues.push({
        ...ISSUE_DEFINITIONS.LLMS_TXT_INVALID,
        affectedUrls: [url],
        details: { errors },
      });
    }

    return {
      issues,
      data: { exists: true, content, valid, errors },
    };
  } catch (error) {
    issues.push({
      ...ISSUE_DEFINITIONS.LLMS_TXT_MISSING,
      affectedUrls: [url],
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return {
      issues,
      data: { exists: false, valid: false, errors: ['Failed to fetch'] },
    };
  }
}

/**
 * Extract a robots.txt Content-Signal line, if present.
 * https://contentsignals.org - "Content-Signal: search=yes,ai-train=no,use=reference"
 * Returns the raw value (original casing/spacing preserved) of the first
 * such line, or null if none is present. Matches on any line prefix, same
 * tolerance as the User-agent/Disallow parsing below - Content-Signal can
 * appear under a specific User-agent block or standalone.
 */
export function parseContentSignal(robotsTxtContent: string): string | null {
  for (const line of robotsTxtContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('content-signal:')) {
      return trimmed.substring(trimmed.indexOf(':') + 1).trim();
    }
  }
  return null;
}

interface RobotsGroup {
  disallowAll: boolean;
  allowRoot: boolean;
}

/** User-agent groups of a robots.txt, by lower-cased token; only root-level rules matter here. */
function parseRobotsGroups(content: string): Map<string, RobotsGroup> {
  const groups = new Map<string, RobotsGroup>();
  let current: string[] = [];
  let lastWasAgent = false;
  for (const raw of content.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (directive === 'user-agent') {
      // Consecutive User-agent lines share the rules that follow them.
      if (!lastWasAgent) current = [];
      current.push(value.toLowerCase());
      lastWasAgent = true;
      for (const token of current) if (!groups.has(token)) groups.set(token, { disallowAll: false, allowRoot: false });
      continue;
    }
    lastWasAgent = false;
    if (directive === 'disallow' && (value === '/' || value === '/*')) {
      for (const token of current) groups.get(token)!.disallowAll = true;
    } else if (directive === 'allow' && (value === '/' || value === '/*')) {
      for (const token of current) groups.get(token)!.allowRoot = true;
    }
  }
  return groups;
}

/** Is this bot kept out of the whole site? Its own group wins; otherwise the wildcard applies. */
export function isDisallowed(bot: KnownBot, groups: Map<string, RobotsGroup>): boolean {
  const own = bot.robotsTokens.map((token) => groups.get(token)).filter((g): g is RobotsGroup => !!g);
  if (own.length > 0) return own.some((g) => g.disallowAll) && !own.some((g) => g.allowRoot);
  const star = groups.get('*');
  return !!star?.disallowAll;
}

function emptyClasses(): AIBotBlockingResult['classes'] {
  return {
    search: { allowed: [], disallowed: [] },
    'ai-search': { allowed: [], disallowed: [] },
    user: { allowed: [], disallowed: [] },
    training: { allowed: [], disallowed: [] },
  };
}

function allAllowed(robotsExists: boolean): AIBotBlockingResult {
  const classes = emptyClasses();
  for (const bot of KNOWN_BOTS) classes[bot.class].allowed.push(bot.name);
  return { robotsExists, blockedBots: [], allowedBots: KNOWN_BOTS.map((b) => b.name), allBlocked: false, contentSignal: null, classes };
}

/**
 * Check robots.txt for AI bot blocking, by class.
 *
 * A disallowed training crawler is a choice with no visibility cost; a disallowed search
 * crawler takes the site out of that assistant's answers; a disallowed user-triggered fetcher
 * means the assistant cannot read a page a user pastes. Googlebot and bingbot are classified
 * here for the data but reported by the crawlability checks.
 */
export async function checkAIBotBlocking(baseUrl: string): Promise<{ issues: AuditIssue[]; data: AIBotBlockingResult }> {
  const issues: AuditIssue[] = [];
  const url = new URL('/robots.txt', baseUrl).href;

  let content: string;
  try {
    const response = await httpGet<string>(url, { timeout: 10000, validateStatus: () => true });
    // No robots.txt (or an SPA shell in its place) means every bot is allowed.
    if (response.status >= 400 || looksLikeHtmlFallback(response.data, response.headers?.['content-type'])) {
      return { issues, data: allAllowed(false) };
    }
    content = response.data as string;
  } catch {
    return { issues, data: allAllowed(false) };
  }

  const groups = parseRobotsGroups(content);
  const classes = emptyClasses();
  const blockedBots: string[] = [];
  const allowedBots: string[] = [];
  for (const bot of KNOWN_BOTS) {
    if (isDisallowed(bot, groups)) {
      classes[bot.class].disallowed.push(bot.name);
      blockedBots.push(bot.name);
    } else {
      classes[bot.class].allowed.push(bot.name);
      allowedBots.push(bot.name);
    }
  }

  const aiBots = KNOWN_BOTS.filter((bot) => bot.class !== 'search');
  const allBlocked = aiBots.every((bot) => blockedBots.includes(bot.name));
  const names = (cls: BotClass) => classes[cls].disallowed.join(', ');

  if (allBlocked) {
    issues.push({
      ...ISSUE_DEFINITIONS.AI_BOT_BLOCKED_ALL,
      affectedUrls: [url],
      details: { blockedBots, classes },
    });
  } else {
    if (classes['ai-search'].disallowed.length > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.AI_SEARCH_BOTS_DISALLOWED,
        description: `robots.txt disallows ${names('ai-search')}. ${ISSUE_DEFINITIONS.AI_SEARCH_BOTS_DISALLOWED.description}`,
        affectedUrls: [url],
        details: { disallowed: classes['ai-search'].disallowed },
      });
    }
    if (classes.user.disallowed.length > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.AI_USER_FETCH_DISALLOWED,
        description: `robots.txt disallows ${names('user')}. ${ISSUE_DEFINITIONS.AI_USER_FETCH_DISALLOWED.description}`,
        affectedUrls: [url],
        details: { disallowed: classes.user.disallowed },
      });
    }
    if (classes.training.disallowed.length > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.AI_TRAINING_BOTS_DISALLOWED,
        description: `robots.txt disallows ${names('training')}. ${ISSUE_DEFINITIONS.AI_TRAINING_BOTS_DISALLOWED.description}`,
        affectedUrls: [url],
        details: { disallowed: classes.training.disallowed },
      });
    }
  }

  return {
    issues,
    data: { robotsExists: true, blockedBots, allowedBots, allBlocked, contentSignal: parseContentSignal(content), classes },
  };
}

/**
 * Check JavaScript rendering ratio
 * Compares static HTML content size vs rendered content
 */
export function checkJSRenderingRatio(
  html: string,
  url: string
): { issues: AuditIssue[]; data: { ratio: number; staticWordCount: number } } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Get static text content (what AI crawlers would see without JS)
  // Remove script and style tags
  $('script, style, noscript').remove();

  const staticText = $('body').text().replace(/\s+/g, ' ').trim();
  const staticWordCount = staticText.split(/\s+/).filter((word) => word.length > 0).length;

  // Check for signs of heavy JS rendering
  const hasReactRoot = $('#root, #app, #__next, [data-reactroot]').length > 0;
  const hasVueApp = $('#app[data-v-app], [data-v-]').length > 0;
  const hasAngularApp = $('[ng-app], [data-ng-app]').length > 0;
  const hasEmptyBody = staticWordCount < 50;

  // Estimate JS rendering ratio based on signals
  let ratio = 0;
  if (hasEmptyBody && (hasReactRoot || hasVueApp || hasAngularApp)) {
    ratio = 90; // Likely SPA with most content rendered by JS
  } else if (hasReactRoot || hasVueApp || hasAngularApp) {
    ratio = 50; // Has JS framework but some static content
  } else if (staticWordCount < 100) {
    ratio = 60; // Very little static content
  } else {
    ratio = 10; // Mostly static content
  }

  // Check for noscript fallback
  const hasNoScript = $('noscript').length > 0;
  if (hasNoScript && ratio > 50) {
    ratio -= 20; // Has fallback content
  }

  if (ratio > 50) {
    issues.push({
      ...ISSUE_DEFINITIONS.HIGH_JS_RENDERING_RATIO,
      affectedUrls: [url],
      details: { ratio: `${ratio}%`, staticWordCount },
    });
  }

  return {
    issues,
    data: { ratio, staticWordCount },
  };
}

/**
 * Check whether a Cloudflare-fronted site has explicit AI crawler rules.
 *
 * Cloudflare blocks "mixed-use" AI crawlers by default on ad-hosting zones
 * starting September 15, 2026, and is expanding Pay Per Crawl into a
 * broader Pay Per Use gating model. A site with no explicit robots.txt
 * stance on AI crawlers is now relying on whatever Cloudflare's
 * account-level bot-management default happens to be — invisible from
 * the codebase, and liable to change without a corresponding commit.
 */
export async function checkCloudflareAICrawlerGate(
  baseUrl: string,
  botBlocking: AIBotBlockingResult
): Promise<{ issues: AuditIssue[]; data: CloudflareAICrawlerGateResult }> {
  const issues: AuditIssue[] = [];

  let behindCloudflare = false;
  try {
    const response = await httpGet<string>(baseUrl, {
      timeout: 10000,
      validateStatus: () => true,
    });
    const server = response.headers['server'] || '';
    behindCloudflare = server.toLowerCase().includes('cloudflare') || 'cf-ray' in response.headers;
  } catch {
    behindCloudflare = false;
  }

  // "Explicit" means robots.txt exists and either names at least one AI
  // crawler specifically via User-agent/Disallow, or declares a
  // Content-Signal line - the newer, Cloudflare-recognized mechanism for
  // stating AI-training/search/reference intent without per-bot rules.
  // Bare wildcard rules or a missing file don't count either way.
  const hasExplicitAIRules =
    botBlocking.robotsExists && (botBlocking.blockedBots.length > 0 || !!botBlocking.contentSignal);

  const ambiguous = behindCloudflare && !hasExplicitAIRules;

  if (ambiguous) {
    issues.push({
      ...ISSUE_DEFINITIONS.CLOUDFLARE_AI_CRAWLER_GATE_AMBIGUOUS,
      affectedUrls: [baseUrl],
    });
  }

  return {
    issues,
    data: { behindCloudflare, hasExplicitAIRules, ambiguous },
  };
}

/**
 * Run all AI readiness checks
 */
export async function runAIReadinessChecks(
  baseUrl: string,
  html: string
): Promise<{ issues: AuditIssue[]; data: AIReadinessData }> {
  const allIssues: AuditIssue[] = [];

  // Check llms.txt
  const llmsResult = await checkLlmsTxt(baseUrl);
  allIssues.push(...llmsResult.issues);

  // Check AI bot blocking
  const botResult = await checkAIBotBlocking(baseUrl);
  allIssues.push(...botResult.issues);

  // Check JS rendering ratio
  const jsResult = checkJSRenderingRatio(html, baseUrl);
  allIssues.push(...jsResult.issues);

  // Check Cloudflare AI-crawler-access gating posture
  const cfGateResult = await checkCloudflareAICrawlerGate(baseUrl, botResult.data);
  allIssues.push(...cfGateResult.issues);

  // Check agent-facing discovery surface (llms-full.txt, SKILL.md, MCP, OpenAPI)
  const agentExperienceResult = await checkAgentExperience(baseUrl);
  allIssues.push(...agentExperienceResult.issues);

  return {
    issues: allIssues,
    data: {
      llmsTxt: llmsResult.data,
      botBlocking: botResult.data,
      jsRenderingRatio: jsResult.data.ratio,
      cloudflareAIGate: cfGateResult.data,
      agentExperience: agentExperienceResult.data,
    },
  };
}
