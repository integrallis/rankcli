# @rankcli/agent-runtime

Core SEO engine for RankCLI. 280+ checks, 7 deep analyzers, framework-specific fix generation.

## Features

### 🤖 GEO (Generative Engine Optimization)
First SEO engine with AI search optimization:
- AI crawler detection (GPTBot, ClaudeBot, PerplexityBot, etc.)
- JS rendering analysis for AI crawlers
- LLM-friendliness scoring
- Citation readiness analysis

### 📊 7 Deep Analyzers
```typescript
import { analyzers } from '@rankcli/agent-runtime';

// Comprehensive analysis
const result = await analyzers.analyzeComprehensive(html, url);

// Individual analyzers
const geo = await analyzers.analyzeGEO(html, url, robotsTxt);
const cwv = analyzers.analyzeCoreWebVitals(html, url);
const security = analyzers.analyzeSecurityHeaders(headers, url);
const schema = analyzers.analyzeStructuredData(html, url);
const images = analyzers.analyzeImages(html, url);
const links = analyzers.analyzeInternalLinking(html, url);
const mobile = analyzers.analyzeMobileSEO(html, url);
```

| Analyzer | Checks |
|----------|--------|
| **GEO** | AI crawler access, robots.txt, SSR detection, LLM signals |
| **Core Web Vitals** | LCP, CLS, INP, TTFB estimation |
| **Security** | HTTPS, HSTS, CSP, grades A+ to F |
| **Structured Data** | JSON-LD validation, rich results |
| **Images** | Alt text, dimensions, formats, lazy loading |
| **Internal Links** | Anchor text, orphan detection |
| **Mobile** | Viewport, touch targets, PWA |

### 🔧 Framework-Specific Fixes

Auto-generate SEO fixes for 25+ frameworks:

```typescript
import { generateFrameworkFix } from '@rankcli/agent-runtime';

const fix = generateFrameworkFix({
  framework: 'nextjs-app',
  issue: { code: 'MISSING_TITLE', ... },
  siteMeta: { title: 'My Site', description: '...' }
});
```

**Supported:**
- React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Remix, Gatsby, Solid.js, Qwik
- Rails, Django, Laravel, Spring Boot, ASP.NET Core, Phoenix, Go
- Hugo, Jekyll, Eleventy, Pelican
- HTMX, Hotwire/Turbo

## Architecture

Isomorphic engine - works in Node.js and Deno:

```
src/
├── analyzers/          # 7 deep analyzers (GEO, CWV, etc.)
├── audit/              # 280+ individual checks
├── fixer/              # Framework-specific fix generation
├── frameworks/         # Framework detection
├── content/            # Content analysis
├── geo/                # GEO tracking
├── git/                # PR/commit helpers
└── index.ts
```

## Installation

```bash
pnpm add @rankcli/agent-runtime
```

## Usage

### Full Audit

```typescript
import { runFullAudit, generateFixes } from '@rankcli/agent-runtime';

const audit = await runFullAudit({
  url: 'https://example.com',
  maxPages: 5,
});

const fixes = await generateFixes(audit.issues, { cwd: process.cwd(), url: 'https://example.com' });
```

GEO/AI-readiness checks (crawler access, LLM content signals, citation readiness) run as part of every full audit — no separate flag needed.

### Generate AI-Friendly robots.txt

```typescript
import { analyzers } from '@rankcli/agent-runtime';

const robotsTxt = analyzers.generateAIFriendlyRobotsTxt('https://example.com');
```

### Generate Schema Templates

```typescript
import { analyzers } from '@rankcli/agent-runtime';

const schema = analyzers.generateSchemaTemplate('article', {
  siteName: 'My Blog',
  siteUrl: 'https://myblog.com',
  authorName: 'John Doe'
});
```

## Development

```bash
pnpm install
pnpm dev        # Watch mode
pnpm test       # Run tests
pnpm build      # Build Node.js + Deno
```

## Related

- [@rankcli/cli](../cli) - Command-line interface
- [@rankcli/mcp-server](../mcp-server) - MCP server for AI assistants
- [rankcli.dev](https://rankcli.dev) - Documentation

## License

MIT
