# RankCLI

**The only SEO tool with GEO (AI Search Optimization) and MCP for AI assistants.**

Developer-first SEO. CLI-native. Optimizes for Google *and* ChatGPT, Perplexity, Claude.

## Why RankCLI?

| Feature | RankCLI | Competitors |
|---------|---------|-------------|
| **GEO (AI Search)** | ✅ Check if GPTBot/ClaudeBot can crawl | ❌ |
| **MCP Server** | ✅ AI assistants can run audits | ❌ |
| **Framework Fixes** | ✅ 25+ frameworks | ❌ |
| **CLI/CI Native** | ✅ Built for developers | ❌ |
| **Price** | **$15/mo** | $99-500/mo |

## Installation

```bash
npm install -g @rankcli/cli
# or
pnpm add -g @rankcli/cli
```

Verify:

```bash
rankcli --version
```

## Quick Start

```bash
# Run an SEO audit
rankcli audit --url https://yoursite.com

# Login to unlock all features
rankcli login

# Full 280+ check audit
rankcli audit --url https://yoursite.com --max-pages 5
```

## Core Features

### 🤖 GEO (Generative Engine Optimization)

Check if AI crawlers can access your site:

```bash
rankcli audit --url https://yoursite.com --geo
```

Analyzes:
- **AI crawler access**: GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- **JS rendering**: Can AI crawlers see your content?
- **LLM signals**: Content structure, citations, FAQ extraction
- **robots.txt**: Are you blocking AI search?

### 🔌 MCP Server (For AI Assistants)

Let Claude, Cursor, or any MCP-compatible AI run SEO audits for you. **No installation required** — just add your API key:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "rankcli": {
      "url": "https://rankcli-audit-worker.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Get your API key at [rankcli.dev/dashboard](https://rankcli.dev/dashboard).

**Available tools:**
- `seo_audit` — Full 280+ check audit on any URL
- `seo_geo_check` — AI search visibility analysis
- `seo_robots_check` — AI crawler permissions in robots.txt
- `seo_compare` — Compare SEO metrics between two URLs

Now just ask Claude: *"Run an SEO audit on example.com"* ✨

### 🔧 Framework-Specific Fixes

Auto-generate fixes for 25+ frameworks:

```bash
rankcli apply --url https://mysite.com
```

**Supported frameworks:**
- **JS/TS**: React, Next.js (App/Pages), Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Remix, Gatsby, Solid.js, Qwik
- **Backend**: Rails, Django, Laravel, Spring Boot, ASP.NET Core, Phoenix, Go (Gin/Echo/Fiber)
- **SSG**: Hugo, Jekyll, Eleventy, Pelican
- **Hypermedia**: HTMX, Hotwire/Turbo

### 📊 7 Deep Analyzers

| Analyzer | What It Does |
|----------|--------------|
| **GEO** | AI crawler access, LLM signals, citation readiness |
| **Core Web Vitals** | LCP, CLS, INP, TTFB estimation |
| **Security Headers** | HTTPS, HSTS, CSP (A+ to F grading) |
| **Structured Data** | JSON-LD validation, rich results |
| **Images** | Alt text, dimensions, modern formats |
| **Internal Links** | Anchor text, orphan detection |
| **Mobile SEO** | Viewport, touch targets, PWA |

## Commands

### `rankcli audit`

Run comprehensive SEO audit (280+ checks).

```bash
rankcli audit [options]

Options:
  -u, --url <url>           URL to audit
  -o, --output <format>     Output: json, console (default: console)
  --max-pages <n>           Max pages to crawl (default: 5)
  --geo                     Include GEO analysis
  --check-links             Check broken links
  --ai                      AI-powered analysis
```

### `rankcli apply`

Generate and apply framework-specific fixes.

```bash
rankcli apply --url https://mysite.com --dry-run   # Preview
rankcli apply --url https://mysite.com --auto      # Auto-apply
```

### `rankcli keywords`

AI-powered keyword research.

```bash
rankcli keywords --url https://mysite.com --ai
rankcli keywords --competitor -c 'competitor.com' -s 'target keyword'
```

### `rankcli content`

Content analysis for readability and snippets.

```bash
rankcli content --url https://mysite.com/blog --keyword 'seo tips'
```

## Authentication

```bash
# Interactive login
rankcli login

# API key (for CI/CD)
rankcli login --token rankcli_your_api_key

# Or environment variable
export RANKCLI_API_KEY=rankcli_your_api_key
```

## CI/CD Integration

### GitHub Actions

```yaml
name: SEO Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @rankcli/cli
      - run: rankcli audit --url ${{ secrets.SITE_URL }} -o json > audit.json
        env:
          RANKCLI_API_KEY: ${{ secrets.RANKCLI_API_KEY }}
      - name: Fail on critical issues
        run: |
          errors=$(jq '.issues | map(select(.severity == "error")) | length' audit.json)
          [ "$errors" -eq 0 ] || exit 1
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RANKCLI_API_KEY` | API key for authentication |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative) |

## Pricing

| Feature | Free | Pro ($15/mo) |
|---------|------|--------------|
| SEO Checks | 100 | 280+ |
| GEO Analysis | Basic | Full |
| Framework Fixes | - | ✅ 25+ |
| Auto-Fix PRs | - | ✅ |
| Sites | 1 | 10 |

## Links

- **Docs**: [rankcli.dev/docs](https://rankcli.dev/docs)
- **GitHub**: [github.com/rankcli/rankcli](https://github.com/rankcli/rankcli)
- **Support**: support@rankcli.dev

## License

MIT
