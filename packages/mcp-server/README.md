# @rankcli/mcp-server

**MCP Server for AI Assistants to perform SEO analysis.**

The industry's first SEO tool accessible via Model Context Protocol. Let Claude, GPT, and other AI assistants run comprehensive SEO audits directly.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) is Anthropic's standard for connecting AI assistants to external tools. This server exposes RankCLI's full SEO analysis capabilities to AI.

## Installation

```bash
npm install -g @rankcli/mcp-server
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "rankcli": {
      "command": "npx",
      "args": ["@rankcli/mcp-server"]
    }
  }
}
```

Restart Claude Desktop. You'll now have SEO tools available.

### Other MCP Clients

Run the server directly:

```bash
npx @rankcli/mcp-server
```

The server communicates via stdio using JSON-RPC.

## Available Tools

### `seo_analyze`
**Full comprehensive SEO audit.** Returns scores for GEO, Core Web Vitals, Security, Structured Data, Images, Links, and Mobile.

### `seo_geo_check`
**GEO (Generative Engine Optimization).** Check AI crawler access, JS rendering, LLM signals, citation readiness.

### `seo_robots_ai`
**Analyze robots.txt for AI crawlers.** Shows which AI crawlers (GPTBot, ClaudeBot, PerplexityBot) are allowed/blocked.

### `seo_generate_robots`
**Generate AI-friendly robots.txt.** Creates rules allowing all major AI crawlers.

### `seo_core_web_vitals`
**Estimate Core Web Vitals.** LCP, CLS, INP, TTFB from HTML analysis.

### `seo_structured_data`
**Validate JSON-LD schemas.** Check Article, Product, FAQ, HowTo, LocalBusiness, BreadcrumbList.

### `seo_generate_schema`
**Generate schema templates.** For article, product, faq, local-business, website.

### `seo_security_headers`
**Analyze security headers.** HTTPS, HSTS, CSP with A+ to F grading.

### `seo_generate_security_headers`
**Generate recommended security headers.**

### `seo_images`
**Image optimization analysis.** Alt text, dimensions, formats, lazy loading.

### `seo_internal_links`
**Internal linking analysis.** Anchor text quality, orphan detection.

### `seo_mobile`
**Mobile SEO analysis.** Viewport, touch targets, PWA readiness.

### `seo_ai_crawlers`
**AI crawler reference.** Information about all known AI crawlers.

## Example Usage

Once configured, ask Claude:

> "Run a comprehensive SEO audit on https://example.com"

> "Check if my site is visible to ChatGPT and other AI search engines"

> "Generate an AI-friendly robots.txt for my domain"

> "What structured data should I add to my blog posts?"

Claude will use the appropriate tools to analyze and respond.

## Why This Matters

1. **AI doing SEO**: Your AI assistant can now audit sites, generate fixes, and monitor SEO.
2. **Meta-optimization**: Make sure YOUR site is visible to AI crawlers—checked by AI.
3. **Developer workflow**: Ask Claude to audit during code review or deployment.

## Requirements

- Node.js 18+
- An MCP-compatible AI assistant (Claude Desktop, etc.)

## Related

- [RankCLI CLI](https://www.npmjs.com/package/@rankcli/cli) - Command-line SEO tool
- [RankCLI Website](https://rankcli.dev) - Full documentation
- [MCP Protocol](https://modelcontextprotocol.io) - Model Context Protocol

## License

MIT
