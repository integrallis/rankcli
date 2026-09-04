// AI/LLM Readiness Checks
// Checks for llms.txt, AI bot blocking, and JS rendering ratio

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';
import { checkAgentExperience, type AgentExperienceData } from './agent-experience.js';

// Known AI bot user agents
const AI_BOTS = {
  GPTBot: 'GPTBot',
  'ChatGPT-User': 'ChatGPT-User',
  'OAI-SearchBot': 'OAI-SearchBot',
  ClaudeBot: 'ClaudeBot',
  'Claude-Web': 'Claude-Web',
  'anthropic-ai': 'anthropic-ai',
  PerplexityBot: 'PerplexityBot',
  'Google-Extended': 'Google-Extended',
  Bytespider: 'Bytespider',
  CCBot: 'CCBot',
};

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
  allBlocked: boolean;
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
 * Check robots.txt for AI bot blocking
 */
export async function checkAIBotBlocking(baseUrl: string): Promise<{ issues: AuditIssue[]; data: AIBotBlockingResult }> {
  const issues: AuditIssue[] = [];
  const url = new URL('/robots.txt', baseUrl).href;

  const blockedBots: string[] = [];
  const allowedBots: string[] = [];

  try {
    const response = await httpGet<string>(url, {
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 404 || response.status >= 400) {
      // No robots.txt means all bots are allowed
      return {
        issues,
        data: {
          robotsExists: false,
          blockedBots: [],
          allowedBots: Object.keys(AI_BOTS),
          allBlocked: false,
        },
      };
    }

    const content = response.data as string;
    const lines = content.split('\n');

    // Parse robots.txt for AI bot rules
    let currentUserAgent = '';
    const botRules: Record<string, { allowed: boolean; disallowAll: boolean }> = {};

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        currentUserAgent = trimmed.split(':')[1].trim();
      } else if (trimmed.startsWith('disallow:')) {
        const path = trimmed.split(':')[1]?.trim() || '';

        // Check if this user agent matches any AI bot
        for (const [botKey, botName] of Object.entries(AI_BOTS)) {
          if (currentUserAgent === '*' || currentUserAgent === botKey.toLowerCase() || currentUserAgent === botName.toLowerCase()) {
            if (path === '/' || path === '/*') {
              if (!botRules[botKey]) {
                botRules[botKey] = { allowed: false, disallowAll: false };
              }
              if (currentUserAgent !== '*' || (currentUserAgent === '*' && !botRules[botKey].allowed)) {
                botRules[botKey].disallowAll = true;
              }
            }
          }
        }
      } else if (trimmed.startsWith('allow:')) {
        // Explicit allow for a bot
        for (const [botKey] of Object.entries(AI_BOTS)) {
          if (currentUserAgent === botKey.toLowerCase()) {
            if (!botRules[botKey]) {
              botRules[botKey] = { allowed: true, disallowAll: false };
            }
            botRules[botKey].allowed = true;
          }
        }
      }
    }

    // Determine blocked/allowed bots
    for (const [botKey] of Object.entries(AI_BOTS)) {
      const rules = botRules[botKey];
      if (rules?.disallowAll && !rules?.allowed) {
        blockedBots.push(botKey);
      } else {
        allowedBots.push(botKey);
      }
    }

    // Generate issues for blocked bots
    if (blockedBots.length === Object.keys(AI_BOTS).length) {
      issues.push({
        ...ISSUE_DEFINITIONS.AI_BOT_BLOCKED_ALL,
        affectedUrls: [url],
        details: { blockedBots },
      });
    } else {
      // Individual bot blocking notices
      if (blockedBots.includes('GPTBot') || blockedBots.includes('ChatGPT-User')) {
        issues.push({
          ...ISSUE_DEFINITIONS.AI_BOT_GPTBOT_BLOCKED,
          affectedUrls: [url],
        });
      }
      if (blockedBots.includes('ClaudeBot') || blockedBots.includes('Claude-Web') || blockedBots.includes('anthropic-ai')) {
        issues.push({
          ...ISSUE_DEFINITIONS.AI_BOT_CLAUDEBOT_BLOCKED,
          affectedUrls: [url],
        });
      }
      if (blockedBots.includes('PerplexityBot')) {
        issues.push({
          ...ISSUE_DEFINITIONS.AI_BOT_PERPLEXITY_BLOCKED,
          affectedUrls: [url],
        });
      }
      if (blockedBots.includes('Google-Extended')) {
        issues.push({
          ...ISSUE_DEFINITIONS.AI_BOT_GOOGLE_EXTENDED_BLOCKED,
          affectedUrls: [url],
        });
      }
    }

    return {
      issues,
      data: {
        robotsExists: true,
        blockedBots,
        allowedBots,
        allBlocked: blockedBots.length === Object.keys(AI_BOTS).length,
      },
    };
  } catch (error) {
    return {
      issues,
      data: {
        robotsExists: false,
        blockedBots: [],
        allowedBots: Object.keys(AI_BOTS),
        allBlocked: false,
      },
    };
  }
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

  // "Explicit" means robots.txt exists and names at least one AI crawler
  // specifically, rather than relying purely on a bare wildcard rule or
  // the absence of a file.
  const hasExplicitAIRules = botBlocking.robotsExists && botBlocking.blockedBots.length > 0;

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
