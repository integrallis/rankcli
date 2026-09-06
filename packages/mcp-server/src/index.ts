#!/usr/bin/env node
/**
 * RankCLI MCP Server
 * 
 * Model Context Protocol server for AI assistants to perform SEO analysis.
 * Exposes RankCLI's full analysis capabilities to Claude, GPT, and other AI tools.
 * 
 * Usage:
 *   npx @rankcli/mcp-server
 * 
 * Configuration in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "rankcli": {
 *         "command": "npx",
 *         "args": ["@rankcli/mcp-server"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import Conf from 'conf';

// Import analyzers from the main package namespace
import { analyzers } from '@rankcli/agent-runtime';

// Backend for the optional rankcli_connect bridge - the only thing in this
// server that ever contacts rankcli.dev, and only when explicitly invoked.
const SUPABASE_URL = process.env.RANKCLI_SUPABASE_URL || 'https://bspljbxwbjiqueeyzyat.supabase.co';

// Same projectName as packages/cli's Conf store, so connecting here also
// signs in the `rankcli` CLI on this machine, and vice versa - one account,
// shared across surfaces.
interface LocalConfigSchema {
  apiKey?: string;
  apiKeyName?: string;
  email?: string;
  // An in-flight connect attempt from a previous rankcli_connect call that
  // hasn't been approved yet, so a retry checks it instead of starting over.
  pendingConnectId?: string;
  pendingConnectUrl?: string;
  pendingConnectExpiresAt?: number;
}
// No `schema` option here deliberately - the CLI's Conf store on this same
// file declares a wider schema (accessToken, refreshToken, ...), and this
// server should never risk validating those fields away.
const localConfig = new Conf<LocalConfigSchema>({ projectName: 'rankcli' });

// seo_analyze and seo_geo_check both declare html as "optional if URL is
// provided" in their schema, but had no code path that ever fetched it -
// every call with just a url failed with "HTML content is required."
// Fetches happen from this local process (wherever the MCP client is
// running), never through a RankCLI server.
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RankCLI/1.0 (+https://rankcli.dev)' },
  });
  if (!res.ok) {
    throw new Error(`Fetching ${url} returned ${res.status} ${res.statusText}`);
  }
  return res.text();
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'seo_analyze',
    description: `Run comprehensive SEO analysis on a webpage. Returns scores and issues for:
- GEO (AI Search Optimization) - Is the site visible to ChatGPT, Perplexity, Claude?
- Core Web Vitals (LCP, CLS, INP) - Performance estimates
- Structured Data - Schema.org validation
- Security Headers - HTTPS, HSTS, CSP
- Mobile SEO - Responsive design, touch targets
- Images - Alt text, formats, dimensions
- Internal Linking - Anchor text, orphan detection

Use this for a complete SEO audit.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page to analyze',
        },
        html: {
          type: 'string',
          description: 'HTML content of the page (optional if URL is provided)',
        },
        robotsTxt: {
          type: 'string',
          description: 'robots.txt content for AI crawler analysis (optional)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'seo_geo_check',
    description: `Check if a website is optimized for AI search engines (GEO - Generative Engine Optimization).

Analyzes:
- AI crawler access (GPTBot, ClaudeBot, PerplexityBot, etc.)
- robots.txt rules for AI crawlers
- JS rendering requirements (can AI crawlers see content?)
- Content structure for LLM consumption
- Citation readiness (trust signals)
- FAQ/entity extraction capability

Critical for visibility in ChatGPT, Perplexity, Claude, and Gemini responses.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page to analyze',
        },
        html: {
          type: 'string',
          description: 'HTML content of the page',
        },
        robotsTxt: {
          type: 'string',
          description: 'robots.txt content',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'seo_robots_ai',
    description: `Analyze robots.txt for AI crawler permissions. Shows which AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) are allowed or blocked.`,
    inputSchema: {
      type: 'object',
      properties: {
        robotsTxt: {
          type: 'string',
          description: 'Content of robots.txt file',
        },
      },
      required: ['robotsTxt'],
    },
  },
  {
    name: 'seo_generate_robots',
    description: `Generate an AI-friendly robots.txt that allows all major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.)`,
    inputSchema: {
      type: 'object',
      properties: {
        siteUrl: {
          type: 'string',
          description: 'Base URL of the site (e.g., https://example.com)',
        },
      },
      required: ['siteUrl'],
    },
  },
  {
    name: 'seo_core_web_vitals',
    description: `Estimate Core Web Vitals (LCP, CLS, INP, TTFB) from HTML analysis. Identifies issues like:
- Render-blocking resources
- Images without dimensions
- Large JavaScript bundles
- Missing preload hints`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page',
        },
        html: {
          type: 'string',
          description: 'HTML content of the page',
        },
      },
      required: ['url', 'html'],
    },
  },
  {
    name: 'seo_structured_data',
    description: `Validate JSON-LD structured data (Schema.org). Checks for:
- Required properties per schema type
- Article, Product, FAQ, HowTo, LocalBusiness schemas
- Rich result eligibility
- Common mistakes`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page',
        },
        html: {
          type: 'string',
          description: 'HTML content with JSON-LD',
        },
      },
      required: ['url', 'html'],
    },
  },
  {
    name: 'seo_generate_schema',
    description: `Generate JSON-LD structured data template for a page type (article, product, faq, local-business, website).`,
    inputSchema: {
      type: 'object',
      properties: {
        pageType: {
          type: 'string',
          enum: ['article', 'product', 'faq', 'local-business', 'website'],
          description: 'Type of page',
        },
        siteName: {
          type: 'string',
          description: 'Name of the website',
        },
        siteUrl: {
          type: 'string',
          description: 'Base URL of the website',
        },
        authorName: {
          type: 'string',
          description: 'Default author name (for articles)',
        },
        organizationName: {
          type: 'string',
          description: 'Organization name',
        },
      },
      required: ['pageType', 'siteName', 'siteUrl'],
    },
  },
  {
    name: 'seo_security_headers',
    description: `Analyze security headers (HTTPS, HSTS, CSP, X-Frame-Options, etc.). Returns a security grade A+ through F.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page',
        },
        headers: {
          type: 'object',
          description: 'HTTP response headers',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['url', 'headers'],
    },
  },
  {
    name: 'seo_generate_security_headers',
    description: `Generate recommended security headers configuration for a site.`,
    inputSchema: {
      type: 'object',
      properties: {
        siteUrl: {
          type: 'string',
          description: 'Base URL of the site',
        },
      },
      required: ['siteUrl'],
    },
  },
  {
    name: 'seo_images',
    description: `Analyze images for SEO and performance. Checks alt text, dimensions, formats (WebP/AVIF), lazy loading, and responsive images.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page',
        },
        html: {
          type: 'string',
          description: 'HTML content of the page',
        },
      },
      required: ['url', 'html'],
    },
  },
  {
    name: 'seo_internal_links',
    description: `Analyze internal linking structure. Checks anchor text quality, orphan page risk, link distribution, and suggests linking opportunities.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page',
        },
        html: {
          type: 'string',
          description: 'HTML content of the page',
        },
      },
      required: ['url', 'html'],
    },
  },
  {
    name: 'seo_mobile',
    description: `Analyze mobile SEO. Checks viewport, touch targets, font sizes, content width, PWA readiness.`,
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the page',
        },
        html: {
          type: 'string',
          description: 'HTML content of the page',
        },
      },
      required: ['url', 'html'],
    },
  },
  {
    name: 'seo_ai_crawlers',
    description: `Get information about all known AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) including their user agents and purposes.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rankcli_connect',
    description: `Link this AI assistant to a RankCLI account (rankcli.dev). This is the only tool in this server that contacts rankcli.dev, and only when you call it - every other tool runs fully locally. Connecting unlocks GitHub auto-fix PRs, scheduled monitoring, and a dashboard with history across audits; it does not change how the other tools work. Opens a browser tab for the user to approve (or reuses an existing session if already logged in). Safe to call anytime - if already connected, it just reports who's connected.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rankcli_disconnect',
    description: `Unlink this AI assistant from its RankCLI account. Only affects this local connection - does not delete the RankCLI account or revoke other API keys.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create server
const server = new Server(
  {
    name: 'rankcli',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'seo_analyze': {
        const { url, html: providedHtml, robotsTxt } = args as { url: string; html?: string; robotsTxt?: string };
        const html = providedHtml ?? await fetchHtml(url);

        const result = await analyzers.analyzeComprehensive(html, url, { robotsTxt });
        return {
          content: [
            {
              type: 'text',
              text: formatComprehensiveResult(result),
            },
          ],
        };
      }
      
      case 'seo_geo_check': {
        const { url, html: providedHtml, robotsTxt } = args as { url: string; html?: string; robotsTxt?: string };
        const html = providedHtml ?? await fetchHtml(url);

        const result = await analyzers.analyzeGEO(html, url, robotsTxt);
        return {
          content: [{ type: 'text', text: formatGEOResult(result) }],
        };
      }
      
      case 'seo_robots_ai': {
        const { robotsTxt } = args as { robotsTxt: string };
        const result = analyzers.analyzeRobotsTxtForAI(robotsTxt);
        return {
          content: [
            {
              type: 'text',
              text: `## AI Crawler Analysis\n\n**Allowed:** ${result.allowed.join(', ') || 'None'}\n\n**Blocked:** ${result.blocked.join(', ') || 'None'}\n\n**Recommendations:**\n${result.recommendations.map(r => `- ${r}`).join('\n') || '- All good!'}`,
            },
          ],
        };
      }
      
      case 'seo_generate_robots': {
        const { siteUrl } = args as { siteUrl: string };
        const robotsTxt = analyzers.generateAIFriendlyRobotsTxt(siteUrl);
        return {
          content: [
            {
              type: 'text',
              text: `## AI-Friendly robots.txt\n\n\`\`\`\n${robotsTxt}\`\`\``,
            },
          ],
        };
      }
      
      case 'seo_core_web_vitals': {
        const { url, html } = args as { url: string; html: string };
        const result = analyzers.analyzeCoreWebVitals(html, url);
        return {
          content: [{ type: 'text', text: formatCWVResult(result) }],
        };
      }
      
      case 'seo_structured_data': {
        const { url, html } = args as { url: string; html: string };
        const result = analyzers.analyzeStructuredData(html, url);
        return {
          content: [{ type: 'text', text: formatStructuredDataResult(result) }],
        };
      }
      
      case 'seo_generate_schema': {
        const { pageType, siteName, siteUrl, authorName, organizationName } = args as {
          pageType: 'article' | 'product' | 'faq' | 'local-business' | 'website';
          siteName: string;
          siteUrl: string;
          authorName?: string;
          organizationName?: string;
        };
        const schema = analyzers.generateSchemaTemplate(pageType, { siteName, siteUrl, authorName, organizationName });
        return {
          content: [
            {
              type: 'text',
              text: `## ${pageType} Schema Template\n\n\`\`\`json\n${schema}\n\`\`\`\n\nReplace {{placeholders}} with actual values.`,
            },
          ],
        };
      }
      
      case 'seo_security_headers': {
        const { url, headers } = args as { url: string; headers: Record<string, string> };
        const result = analyzers.analyzeSecurityHeaders(headers, url);
        return {
          content: [{ type: 'text', text: formatSecurityResult(result) }],
        };
      }
      
      case 'seo_generate_security_headers': {
        const { siteUrl } = args as { siteUrl: string };
        const headers = analyzers.generateSecurityHeaders(siteUrl);
        return {
          content: [
            {
              type: 'text',
              text: `## Recommended Security Headers\n\n${Object.entries(headers).map(([k, v]) => `**${k}:**\n\`${v}\``).join('\n\n')}`,
            },
          ],
        };
      }
      
      case 'seo_images': {
        const { url, html } = args as { url: string; html: string };
        const result = analyzers.analyzeImages(html, url);
        return {
          content: [{ type: 'text', text: formatImagesResult(result) }],
        };
      }
      
      case 'seo_internal_links': {
        const { url, html } = args as { url: string; html: string };
        const result = analyzers.analyzeInternalLinking(html, url);
        return {
          content: [{ type: 'text', text: formatInternalLinksResult(result) }],
        };
      }
      
      case 'seo_mobile': {
        const { url, html } = args as { url: string; html: string };
        const result = analyzers.analyzeMobileSEO(html, url);
        return {
          content: [{ type: 'text', text: formatMobileResult(result) }],
        };
      }
      
      case 'seo_ai_crawlers': {
        return {
          content: [
            {
              type: 'text',
              text: formatAICrawlersInfo(),
            },
          ],
        };
      }

      case 'rankcli_connect': {
        const result = await connectToRankCLI();
        return {
          content: [{ type: 'text', text: result.text }],
          ...(result.isError ? { isError: true } : {}),
        };
      }

      case 'rankcli_disconnect': {
        const wasConnected = !!localConfig.get('apiKey');
        localConfig.delete('apiKey');
        localConfig.delete('apiKeyName');
        localConfig.delete('email');
        return {
          content: [
            {
              type: 'text',
              text: wasConnected
                ? 'Disconnected. This assistant no longer has access to your RankCLI dashboard.'
                : 'Not connected - nothing to do.',
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Formatting helpers
// Every real MCP call is a moment someone found genuine value from this
// free tool with zero signup - the one place that value can turn into an
// account. Kept to the two "full audit" tools (not the narrow generators/
// utilities) so it reads as a relevant next step, not an ad on every call.
const BRIDGE_FOOTER = `
---
*This ran locally with no signup. For GitHub auto-fix PRs, scheduled monitoring, and a dashboard with history across audits, call the rankcli_connect tool or create a free account at [rankcli.dev](https://rankcli.dev).*`;

// rankcli_connect / rankcli_disconnect support
//
// Device-flow-style bridge: mint a connect id, hand the user a rankcli.dev
// URL to approve it (via URL-mode elicitation when the client supports it,
// otherwise a plain link in the tool response), then poll for the resulting
// API key and store it in the same local Conf store the CLI reads - so
// connecting here also signs in `rankcli` on this machine.
async function pollConnectStatus(
  connectId: string,
  timeoutMs: number
): Promise<{ email: string; apiKey: string; apiKeyName: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mcp-connect-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectId }),
      });
      const data = await res.json();
      if (data.status === 'claimed') {
        return { email: data.email, apiKey: data.apiKey, apiKeyName: data.apiKeyName };
      }
      if (data.status === 'expired' || data.status === 'not_found') {
        return null;
      }
    } catch {
      // Transient network error - keep polling until the deadline.
    }
  }
  return null;
}

function clearPendingConnect(): void {
  localConfig.delete('pendingConnectId');
  localConfig.delete('pendingConnectUrl');
  localConfig.delete('pendingConnectExpiresAt');
}

async function connectToRankCLI(): Promise<{ text: string; isError?: boolean }> {
  // Purely local check, deliberately not validate-api-key: that endpoint
  // 403s any free-tier key by design (no REST API access on the free plan),
  // which would wrongly read as "revoked" for the exact audience this
  // feature targets. A stored key means connected, full stop - if it's
  // later actually revoked, whatever call relies on it will surface that.
  const existingKey = localConfig.get('apiKey');
  if (existingKey) {
    const email = localConfig.get('email') || 'your account';
    return { text: `Already connected as ${email}. Run rankcli_disconnect first to switch accounts.` };
  }

  // A previous call may already have a connect link waiting on approval -
  // check it instead of silently abandoning it and starting a new one.
  const pendingId = localConfig.get('pendingConnectId');
  const pendingUrl = localConfig.get('pendingConnectUrl');
  const pendingExpiresAt = localConfig.get('pendingConnectExpiresAt');
  if (pendingId && pendingUrl && pendingExpiresAt) {
    if (Date.now() >= pendingExpiresAt) {
      clearPendingConnect();
    } else {
      const claimed = await pollConnectStatus(pendingId, 3000);
      if (claimed) {
        localConfig.set('apiKey', claimed.apiKey);
        localConfig.set('apiKeyName', claimed.apiKeyName);
        localConfig.set('email', claimed.email);
        clearPendingConnect();
        return { text: `Connected as ${claimed.email}! Your dashboard, GitHub auto-fix PRs, and audit history are now linked to this AI assistant.` };
      }
      const minutesLeft = Math.max(1, Math.round((pendingExpiresAt - Date.now()) / 60_000));
      return {
        text: `Still waiting for approval. Open this link if you haven't yet, then run rankcli_connect again:\n\n${pendingUrl}\n\nExpires in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      };
    }
  }

  let startData: { connectId: string; url: string; expiresInSeconds: number };
  try {
    const startRes = await fetch(`${SUPABASE_URL}/functions/v1/mcp-connect-start`, { method: 'POST' });
    if (!startRes.ok) throw new Error(`status ${startRes.status}`);
    startData = await startRes.json();
  } catch (err) {
    return {
      text: `Could not reach rankcli.dev to start the connection (${err instanceof Error ? err.message : 'network error'}). Try again in a moment.`,
      isError: true,
    };
  }
  const { connectId, url, expiresInSeconds } = startData;
  const expiresMinutes = Math.round(expiresInSeconds / 60);
  localConfig.set('pendingConnectId', connectId);
  localConfig.set('pendingConnectUrl', url);
  localConfig.set('pendingConnectExpiresAt', Date.now() + expiresInSeconds * 1000);

  const supportsUrlElicitation = !!server.getClientCapabilities()?.elicitation?.url;

  if (supportsUrlElicitation) {
    try {
      const result = await server.elicitInput({
        mode: 'url',
        message: 'Connect your RankCLI account to enable GitHub auto-fix PRs, scheduled monitoring, and a dashboard with audit history.',
        url,
        elicitationId: connectId,
      });
      if (result.action === 'accept') {
        // A short synchronous wait, not a background timer outliving this
        // call - MCP has no guarantee this process (or even this specific
        // connection) is still around later to receive an out-of-band
        // notification, and nothing here needs one: the same pending-check
        // path a few lines above already makes a second rankcli_connect
        // call resume exactly where this leaves off.
        const claimed = await pollConnectStatus(connectId, 10_000);
        if (claimed) {
          localConfig.set('apiKey', claimed.apiKey);
          localConfig.set('apiKeyName', claimed.apiKeyName);
          localConfig.set('email', claimed.email);
          clearPendingConnect();
          return { text: `Connected as ${claimed.email}! Your dashboard, GitHub auto-fix PRs, and audit history are now linked to this AI assistant.` };
        }
        return { text: `Opened rankcli.dev in your browser. Still waiting for approval - run rankcli_connect again once you've approved it (expires in ${expiresMinutes} minutes).` };
      }
      clearPendingConnect();
      return { text: 'Connection cancelled.' };
    } catch (err) {
      console.error('rankcli_connect: elicitation failed, falling back to link:', err);
      // Fall through to the plain-link path below.
    }
  }

  return {
    text: `Open this link to connect your RankCLI account:\n\n${url}\n\nThen run rankcli_connect again to finish (link expires in ${expiresMinutes} minutes).`,
  };
}

function formatComprehensiveResult(result: Awaited<ReturnType<typeof analyzers.analyzeComprehensive>>): string {
  const criticalIssues = result.allIssues.filter(i => i.severity === 'critical');
  const warnings = result.allIssues.filter(i => i.severity === 'warning');
  
  return `# SEO Analysis Report

**URL:** ${result.url}
**Overall Score:** ${result.overallScore}/100
**Analyzed:** ${result.timestamp}

## Scores

| Category | Score |
|----------|-------|
| GEO (AI Search) | ${result.grades.geo}/100 |
| Core Web Vitals | ${result.grades.coreWebVitals}/100 |
| Security | ${result.grades.security} |
| Structured Data | ${result.grades.structuredData}/100 |
| Images | ${result.grades.images}/100 |
| Internal Links | ${result.grades.internalLinking}/100 |
| Mobile SEO | ${result.grades.mobile}/100 |

## Critical Issues (${criticalIssues.length})

${criticalIssues.map(i => `### ❌ ${i.title}\n${i.description}\n\n**Fix:** ${i.howToFix}`).join('\n\n') || 'None!'}

## Warnings (${warnings.length})

${warnings.slice(0, 5).map(i => `- **${i.title}:** ${i.description}`).join('\n') || 'None!'}

## Priority Recommendations

${result.prioritizedRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${BRIDGE_FOOTER}
`;
}

function formatGEOResult(result: Awaited<ReturnType<typeof analyzers.analyzeGEO>>): string {
  return `# GEO Analysis (AI Search Optimization)

**Score:** ${result.score}/100

## AI Crawler Access

| Status | Crawlers |
|--------|----------|
| ✅ Allowed | ${result.aiCrawlerAccess.allowedCrawlers.join(', ') || 'None'} |
| ❌ Blocked | ${result.aiCrawlerAccess.blockedCrawlers.join(', ') || 'None'} |

**Server-Side Rendered:** ${result.aiCrawlerAccess.serverSideRendered ? '✅ Yes' : '❌ No'}
**JS Rendering Required:** ${result.aiCrawlerAccess.jsRenderingRequired ? '⚠️ Yes (AI crawlers may not see content)' : '✅ No'}

## LLM Friendliness Scores

| Signal | Score |
|--------|-------|
| Content Clarity | ${result.llmSignals.contentClarity}/100 |
| Fact Density | ${result.llmSignals.factDensity}/100 |
| Structure Quality | ${result.llmSignals.structureQuality}/100 |
| Citation Quality | ${result.llmSignals.citationQuality}/100 |

## Content Structure

- Structured Data: ${result.contentStructure.hasStructuredData ? '✅' : '❌'}
- FAQ Schema: ${result.contentStructure.hasFAQSchema ? '✅' : '❌'}
- Article Schema: ${result.contentStructure.hasArticleSchema ? '✅' : '❌'}
- Heading Hierarchy: ${result.contentStructure.headingHierarchy}

## Citation Readiness

Trust Signals: ${result.citationReadiness.trustSignals.join(', ') || 'None detected'}

## Recommendations

${result.recommendations.map(r => `- ${r}`).join('\n')}
${BRIDGE_FOOTER}
`;
}

function formatCWVResult(result: ReturnType<typeof analyzers.analyzeCoreWebVitals>): string {
  const emoji = (est: string) => est === 'good' ? '🟢' : est === 'needs-improvement' ? '🟡' : '🔴';
  
  return `# Core Web Vitals Estimate

**Overall Score:** ${result.overallScore}/100

| Metric | Estimate | Issues |
|--------|----------|--------|
| LCP (Largest Contentful Paint) | ${emoji(result.lcp.estimate)} ${result.lcp.estimate} | ${result.lcp.issues.length} |
| CLS (Cumulative Layout Shift) | ${emoji(result.cls.estimate)} ${result.cls.estimate} | ${result.cls.issues.length} |
| INP (Interaction to Next Paint) | ${emoji(result.inp.estimate)} ${result.inp.estimate} | ${result.inp.issues.length} |
| TTFB (Time to First Byte) | ${emoji(result.ttfb.estimate)} ${result.ttfb.estimate} | ${result.ttfb.issues.length} |

## Issues

${result.issues.map(i => `- **${i.title}:** ${i.howToFix}`).join('\n') || 'No critical issues!'}
`;
}

function formatStructuredDataResult(result: ReturnType<typeof analyzers.analyzeStructuredData>): string {
  return `# Structured Data Analysis

**Score:** ${result.score}/100
**Schemas Found:** ${result.schemas.length}

## Schema Types

| Type | Valid | Errors |
|------|-------|--------|
${result.schemas.map(s => `| ${s.type} | ${s.isValid ? '✅' : '❌'} | ${s.errors.join('; ') || '-'} |`).join('\n') || '| None found | - | - |'}

## Rich Result Eligibility

- Organization: ${result.hasOrganization ? '✅' : '❌'}
- WebSite: ${result.hasWebSite ? '✅' : '❌'}
- Breadcrumb: ${result.hasBreadcrumb ? '✅' : '❌'}
- Article: ${result.hasArticle ? '✅' : '❌'}
- Product: ${result.hasProduct ? '✅' : '❌'}
- FAQ: ${result.hasFAQ ? '✅' : '❌'}
- HowTo: ${result.hasHowTo ? '✅' : '❌'}

## Recommendations

${result.recommendations.map(r => `- ${r}`).join('\n')}
`;
}

function formatSecurityResult(result: ReturnType<typeof analyzers.analyzeSecurityHeaders>): string {
  return `# Security Headers Analysis

**Grade:** ${result.grade}
**Score:** ${result.score}/100

## Headers

| Header | Status |
|--------|--------|
| HTTPS | ${result.https.enabled ? '✅' : '❌'} |
| HSTS | ${result.https.hasHSTS ? '✅' : '❌'} |
| CSP | ${result.contentSecurity.hasCSP ? '✅' : '❌'} |
| X-Frame-Options | ${result.frameOptions.hasXFrameOptions ? '✅' : '❌'} |
| X-Content-Type-Options | ${result.contentTypeOptions.hasXContentTypeOptions ? '✅' : '❌'} |
| Referrer-Policy | ${result.referrerPolicy.hasReferrerPolicy ? '✅' : '❌'} |
| Permissions-Policy | ${result.permissionsPolicy.hasPermissionsPolicy ? '✅' : '❌'} |

## Issues

${result.issues.map(i => `- **${i.title}:** ${i.howToFix}`).join('\n') || 'No issues!'}
`;
}

function formatImagesResult(result: ReturnType<typeof analyzers.analyzeImages>): string {
  return `# Image Analysis

**Score:** ${result.score}/100
**Total Images:** ${result.totalImages}

## Stats

| Metric | Count |
|--------|-------|
| With Alt Text | ${result.imagesWithAlt} |
| With Dimensions | ${result.imagesWithDimensions} |
| Lazy Loading | ${result.imagesWithLazyLoading} |
| Modern Formats | ${result.modernFormats} |
| Legacy Formats | ${result.legacyFormats} |

## Issues

${result.issues.map(i => `- **${i.title}:** ${i.howToFix}`).join('\n') || 'No issues!'}

## Recommendations

${result.recommendations.map(r => `- ${r}`).join('\n')}
`;
}

function formatInternalLinksResult(result: ReturnType<typeof analyzers.analyzeInternalLinking>): string {
  return `# Internal Linking Analysis

**Score:** ${result.score}/100

## Stats

| Metric | Count |
|--------|-------|
| Total Links | ${result.totalLinks} |
| Internal Links | ${result.internalLinks} |
| External Links | ${result.externalLinks} |
| Navigation Links | ${result.navigationLinks} |
| Content Links | ${result.contentLinks} |
| Unique Internal Targets | ${result.uniqueInternalTargets} |

## Anchor Text Quality

- Descriptive: ${result.anchorTextAnalysis.descriptive}
- Generic: ${result.anchorTextAnalysis.generic}
- Empty: ${result.anchorTextAnalysis.empty}

## Issues

${result.issues.map(i => `- **${i.title}:** ${i.howToFix}`).join('\n') || 'No issues!'}

## Recommendations

${result.recommendations.map(r => `- ${r}`).join('\n')}
`;
}

function formatMobileResult(result: ReturnType<typeof analyzers.analyzeMobileSEO>): string {
  return `# Mobile SEO Analysis

**Score:** ${result.score}/100

## Viewport

- Has Viewport: ${result.viewport.hasViewport ? '✅' : '❌'}
- Responsive: ${result.viewport.isResponsive ? '✅' : '❌'}
${result.viewport.viewportContent ? `- Content: \`${result.viewport.viewportContent}\`` : ''}

## Touch Targets

- Small Targets: ${result.touchTargets.smallTargets}
- Proper Targets: ${result.touchTargets.properTargets}

## Mobile Features

- Apple Touch Icon: ${result.mobileSpecific.hasAppleTouchIcon ? '✅' : '❌'}
- Theme Color: ${result.mobileSpecific.hasThemeColor ? '✅' : '❌'}
- Web App Manifest: ${result.mobileSpecific.hasManifest ? '✅' : '❌'}
- Responsive Images: ${result.mobileSpecific.hasMobileOptimizedImages ? '✅' : '❌'}

## Issues

${result.issues.map(i => `- **${i.title}:** ${i.howToFix}`).join('\n') || 'No issues!'}

## Recommendations

${result.recommendations.map(r => `- ${r}`).join('\n')}
`;
}

function formatAICrawlersInfo(): string {
  const crawlers = Object.entries(analyzers.AI_CRAWLERS_INFO);
  return `# Known AI Crawlers

${crawlers.map(([name, info]) => `## ${name}
- **User-Agent:** ${info.userAgent}
- **Company:** ${info.company}
- **Purpose:** ${info.purpose}
`).join('\n')}

## robots.txt Example

\`\`\`
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /
\`\`\`
`;
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RankCLI MCP Server running on stdio');
}

main().catch(console.error);
