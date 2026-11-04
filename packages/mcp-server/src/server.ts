/**
 * Shared, stateless SEO/GEO analysis tools - the part of the RankCLI MCP
 * server that's safe to run anywhere, local stdio process or a shared
 * remote HTTP endpoint, since none of it touches per-user local state.
 * rankcli_connect/rankcli_disconnect (which read/write a local Conf file)
 * stay in index.ts, exclusive to the local stdio server - a shared remote
 * instance can't safely do per-user "connect this session to your account"
 * via local file storage.
 */
import { createRequire } from 'node:module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { analyzers } from '@rankcli/agent-runtime';
import { guardedFetch, type FetchGuardOptions } from './fetch-guard.js';

export { isPrivateAddress, type FetchGuardOptions } from './fetch-guard.js';

/** Options for the analysis tools. Everything defaults off, for local stdio use. */
export type AnalysisServerOptions = FetchGuardOptions;

export async function fetchHtml(url: string, options: AnalysisServerOptions = {}): Promise<string> {
  const res = await guardedFetch(url, options);
  if (!res.ok) {
    throw new Error(`Fetching ${url} returned ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export interface RobotsTxtResult {
  /** robots.txt body when the site served one (2xx). */
  content?: string;
  /** One line for the report: what was found, or why crawler access is unknown. */
  note: string;
  /** robots.txt couldn't be read (5xx, 429, network) - access is not known. */
  unknown?: boolean;
}

/**
 * The site's own robots.txt. seo_geo_check / seo_analyze used to skip this
 * unless the caller pasted robots.txt in, and then reported every AI
 * crawler as "allowed" - even on sites that block them all.
 */
export async function fetchRobotsTxt(pageUrl: string, options: AnalysisServerOptions = {}): Promise<RobotsTxtResult> {
  let robotsUrl: string;
  try {
    robotsUrl = new URL('/robots.txt', pageUrl).href;
  } catch {
    return { note: 'robots.txt not checked: invalid URL.' };
  }
  try {
    const res = await guardedFetch(robotsUrl, options);
    if (res.ok) {
      return { content: await res.text(), note: `robots.txt fetched from ${robotsUrl}.` };
    }
    if (res.status >= 500 || res.status === 429) {
      return {
        unknown: true,
        note: `robots.txt returned HTTP ${res.status}, so crawler access is unknown - Google treats a 5xx robots.txt as "disallow everything" until it answers.`,
      };
    }
    return { note: `No robots.txt (HTTP ${res.status}) - every crawler is allowed by default.` };
  } catch (error) {
    return { unknown: true, note: `robots.txt could not be fetched (${error instanceof Error ? error.message : String(error)}), so crawler access is unknown.` };
  }
}

/** robots.txt as given by the caller, or fetched from the site. */
async function resolveRobotsTxt(url: string, provided: string | undefined, options: AnalysisServerOptions): Promise<RobotsTxtResult> {
  if (provided !== undefined) return { content: provided, note: 'robots.txt as provided.' };
  return fetchRobotsTxt(url, options);
}

/**
 * Safety annotations (MCP spec, read by ChatGPT's plugin review and shown by clients): every
 * tool here reads and analyzes; none writes, deletes or acts for the user. The ones that take
 * a URL fetch it, so they are open-world; the ones that take text or nothing are closed.
 */
const FETCHES_THE_WEB = new Set([
  'seo_analyze', 'seo_geo_check', 'seo_core_web_vitals', 'seo_structured_data',
  'seo_security_headers', 'seo_images', 'seo_internal_links', 'seo_mobile',
]);
function annotated(tool: Tool): Tool {
  return {
    ...tool,
    annotations: {
      title: tool.name.replace(/^seo_/, '').replace(/_/g, ' '),
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: FETCHES_THE_WEB.has(tool.name),
    },
  };
}

const TOOL_DEFINITIONS: Tool[] = [
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
          description: 'robots.txt content (optional - fetched from the site when omitted)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'seo_geo_check',
    description: `Check if a website is optimized for AI search engines (GEO - Generative Engine Optimization).

Analyzes:
- AI crawler access by class (search, AI search, user-triggered, training crawlers)
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
          description: 'HTML content of the page (optional - fetched from the URL when omitted)',
        },
        robotsTxt: {
          type: 'string',
          description: 'robots.txt content (optional - fetched from the site when omitted)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'seo_robots_ai',
    description: `Analyze robots.txt for AI crawler access by class: search crawlers (Googlebot, bingbot), AI search crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot), user-triggered fetchers (ChatGPT-User, Claude-User, Perplexity-User) and training crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended), with what blocking each class costs.`,
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
    description: `Generate a robots.txt that allows every crawler class, with one group per class (AI search, user-triggered, training) so a site can disallow training alone without losing search or answer visibility.`,
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
    description: `List the known crawlers by what they are for (search, AI search, user-triggered, training), who runs each, and what blocking it costs.`,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export const ANALYSIS_TOOLS: Tool[] = TOOL_DEFINITIONS.map(annotated);

// Every real MCP call is a moment someone found genuine value from this
// free tool with zero signup - the one place that value can turn into an
// account. Kept to the two "full audit" tools (not the narrow generators/
// utilities) so it reads as a relevant next step, not an ad on every call.
// Transport-neutral wording deliberately - this file is shared between the
// local stdio server (where rankcli_connect exists) and the remote HTTP
// endpoint (where it doesn't).
const BRIDGE_FOOTER = `
---
*This ran with no signup. For GitHub auto-fix PRs, scheduled monitoring, and a dashboard with history across audits, connect via the RankCLI CLI (\`rankcli login\`) or create a free account at [rankcli.dev](https://rankcli.dev).*`;

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

function formatGEOResult(result: Awaited<ReturnType<typeof analyzers.analyzeGEO>>, robots: RobotsTxtResult): string {
  // Without robots.txt the analyzer defaults every crawler to "allowed";
  // when we couldn't read it, say unknown instead of claiming access.
  const access = robots.unknown
    ? `| ❔ Unknown | ${robots.note} |`
    : `| ✅ Allowed | ${result.aiCrawlerAccess.allowedCrawlers.join(', ') || 'None'} |
| ❌ Disallowed, AI answers draw from them | ${[...result.aiCrawlerAccess.byClass.search.blocked, ...result.aiCrawlerAccess.byClass['ai-search'].blocked].join(', ') || 'None'} |
| ⚠️ Disallowed, user-triggered fetchers | ${result.aiCrawlerAccess.byClass.user.blocked.join(', ') || 'None'} |
| ○ Disallowed, training only (no visibility cost) | ${result.aiCrawlerAccess.byClass.training.blocked.join(', ') || 'None'} |`;
  return `# GEO Analysis (AI Search Optimization)

**Score:** ${result.score}/100

## AI Crawler Access

| Status | Crawlers |
|--------|----------|
${access}

_${robots.note}_

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
  const classes: Array<[string, string, string]> = [
    ['search', 'Search crawlers', 'Blocking one costs the index that most AI answers draw from.'],
    ['ai-search', 'AI search crawlers', "Blocking one takes the site out of that assistant's answers."],
    ['user', 'User-triggered fetchers', 'Blocking one means the assistant cannot read a page a user pastes.'],
    ['training', 'Training crawlers', 'Blocking one costs nothing a user sees; a policy choice.'],
  ];
  const crawlers = Object.entries(analyzers.AI_CRAWLERS_INFO);
  return `# Known AI crawlers, by what they are for

${classes.map(([cls, label, consequence]) => `## ${label}

${consequence}

${crawlers.filter(([, info]) => info.class === cls).map(([name, info]) => `- **${name}** (${info.company}): blocking it costs ${info.loses}`).join('\n')}
`).join('\n')}
## robots.txt example

An Allow in a bot's own group wins over a wildcard Disallow. Keep the training crawlers disallowed if that is the policy and allow the rest explicitly:

\`\`\`
User-agent: OAI-SearchBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: ChatGPT-User
User-agent: Claude-User
User-agent: Perplexity-User
Allow: /
\`\`\`

robots.txt cannot lift a block at the CDN edge; \`rankcli audit\` fetches as each bot to find those.
`;
}

/**
 * Handles a single analysis tool call. Returns undefined if `name` isn't
 * one of ANALYSIS_TOOLS, so callers (index.ts's stdio server) can fall
 * through to their own additional tools.
 */
export async function handleAnalysisTool(
  name: string,
  args: Record<string, unknown> | undefined,
  options: AnalysisServerOptions = {},
): Promise<CallToolResult | undefined> {
  switch (name) {
    case 'seo_analyze': {
      const { url, html: providedHtml, robotsTxt } = args as { url: string; html?: string; robotsTxt?: string };
      const [html, robots] = await Promise.all([
        providedHtml ?? fetchHtml(url, options),
        resolveRobotsTxt(url, robotsTxt, options),
      ]);
      const result = await analyzers.analyzeComprehensive(html, url, { robotsTxt: robots.content });
      return { content: [{ type: 'text', text: `${formatComprehensiveResult(result)}\n_${robots.note}_\n` }] };
    }

    case 'seo_geo_check': {
      const { url, html: providedHtml, robotsTxt } = args as { url: string; html?: string; robotsTxt?: string };
      const [html, robots] = await Promise.all([
        providedHtml ?? fetchHtml(url, options),
        resolveRobotsTxt(url, robotsTxt, options),
      ]);
      const result = await analyzers.analyzeGEO(html, url, robots.content);
      return { content: [{ type: 'text', text: formatGEOResult(result, robots) }] };
    }

    case 'seo_robots_ai': {
      const { robotsTxt } = args as { robotsTxt: string };
      const result = analyzers.analyzeRobotsTxtForAI(robotsTxt);
      const row = (label: string, cls: keyof typeof result.byClass) =>
        `| ${label} | ${result.byClass[cls].allowed.join(', ') || '-'} | ${result.byClass[cls].blocked.join(', ') || '-'} |`;
      return {
        content: [
          {
            type: 'text',
            text: `## AI crawler access in robots.txt, by class

| Class | Allowed | Disallowed |
|---|---|---|
${row('Search crawlers (the index most AI answers draw from)', 'search')}
${row('AI search crawlers (each assistant\'s own index)', 'ai-search')}
${row('User-triggered fetchers (one page, because a user asked)', 'user')}
${row('Training crawlers (model training only)', 'training')}

${result.recommendations.map(r => `- ${r}`).join('\n')}

robots.txt is necessary and not sufficient: a CDN or WAF can refuse a crawler in front of the origin. \`rankcli audit --url …\` fetches the page as each bot and reports what it received.`,
          },
        ],
      };
    }

    case 'seo_generate_robots': {
      const { siteUrl } = args as { siteUrl: string };
      const robotsTxt = analyzers.generateAIFriendlyRobotsTxt(siteUrl);
      return {
        content: [{ type: 'text', text: `## AI-Friendly robots.txt\n\n\`\`\`\n${robotsTxt}\`\`\`` }],
      };
    }

    case 'seo_core_web_vitals': {
      const { url, html } = args as { url: string; html: string };
      const result = analyzers.analyzeCoreWebVitals(html, url);
      return { content: [{ type: 'text', text: formatCWVResult(result) }] };
    }

    case 'seo_structured_data': {
      const { url, html } = args as { url: string; html: string };
      const result = analyzers.analyzeStructuredData(html, url);
      return { content: [{ type: 'text', text: formatStructuredDataResult(result) }] };
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
      return { content: [{ type: 'text', text: formatSecurityResult(result) }] };
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
      return { content: [{ type: 'text', text: formatImagesResult(result) }] };
    }

    case 'seo_internal_links': {
      const { url, html } = args as { url: string; html: string };
      const result = analyzers.analyzeInternalLinking(html, url);
      return { content: [{ type: 'text', text: formatInternalLinksResult(result) }] };
    }

    case 'seo_mobile': {
      const { url, html } = args as { url: string; html: string };
      const result = analyzers.analyzeMobileSEO(html, url);
      return { content: [{ type: 'text', text: formatMobileResult(result) }] };
    }

    case 'seo_ai_crawlers': {
      return { content: [{ type: 'text', text: formatAICrawlersInfo() }] };
    }

    default:
      return undefined;
  }
}

/** The published package version, reported to MCP clients (it was hard-coded as 0.0.1). */
export const SERVER_VERSION: string = (() => {
  try {
    return createRequire(import.meta.url)('../package.json').version;
  } catch {
    return '0.0.0';
  }
})();

/**
 * A fresh Server exposing only the stateless analysis tools - used by the
 * remote HTTP endpoint, one instance per request (see packages/audit-worker),
 * matching the MCP SDK's own stateless-server example.
 *
 * A shared deployment should pass { blockPrivateNetworks: true } so callers
 * can't point the fetching tools at internal addresses. Off by default: the
 * local stdio server auditing http://localhost:3000 is a feature.
 */
export function createAnalysisServer(options: AnalysisServerOptions = {}): Server {
  const server = new Server(
    { name: 'rankcli', version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: ANALYSIS_TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleAnalysisTool(name, args, options);
      if (result) return result;
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  return server;
}
