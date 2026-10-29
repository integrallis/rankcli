# RankCLI

**The only SEO tool with GEO (AI Search Optimization) and MCP for AI assistants.**

Developer-first SEO. CLI-native. Optimizes for Google *and* ChatGPT, Perplexity, Claude.

## Why RankCLI?

| Feature | RankCLI | Competitors |
|---------|---------|-------------|
| **GEO (AI Search)** | ✅ Check if GPTBot/ClaudeBot can crawl | ❌ |
| **MCP Server** | ✅ AI assistants can run audits | ❌ |
| **Framework Fixes** | ✅ 32 frameworks detected, 11 with fix recipes | ❌ |
| **CLI/CI Native** | ✅ Built for developers | ❌ |
| **Price** | **CLI, MCP server and GitHub Action free; cloud plans from $9/mo** | $99-500/mo |

## Installation

Standalone binary, no Node required:

```bash
brew install integrallis/tap/rankcli
# or on Windows:
scoop bucket add integrallis https://github.com/integrallis/scoop-bucket
scoop install rankcli
```

Or via npm (requires Node 20.19+ or 22.12+ - see [Node versions](#node-versions)):

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
# Run the full 280+ check audit, free, no account
rankcli audit --url https://yoursite.com

# Crawl more pages (default 5)
rankcli audit --url https://yoursite.com --max-pages 10

# Optional: set the URL once, then omit --url
rankcli init
rankcli audit

# Optional: log in to keep the history in the dashboard and get weekly audits
rankcli login
```

The console report lists every issue found, grouped by severity, with its code. `-o json` adds the description, impact and fix for each.

## Core Features

### 🤖 GEO (Generative Engine Optimization)

Check if AI crawlers can access your site:

```bash
rankcli geo --url https://yoursite.com
```

Analyzes:
- **AI crawler access**: GPTBot, ClaudeBot, PerplexityBot, Google-Extended
- **JS rendering**: Can AI crawlers see your content?
- **LLM signals**: Content structure, citations, FAQ extraction
- **robots.txt**: Are you blocking AI search?

### 🔌 MCP Server (For AI Assistants)

Let Claude, Cursor, or any MCP-compatible AI run SEO audits for you. **Free, local, no signup**:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
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

Nothing is sent to RankCLI's servers — see [`@rankcli/mcp-server`](https://www.npmjs.com/package/@rankcli/mcp-server).
A hosted endpoint (with your [API key](https://rankcli.dev/dashboard)) is also available for teams that want dashboard sync.

**Available tools** (15, all local): `seo_analyze`, `seo_geo_check`, `seo_core_web_vitals`, `seo_structured_data`, `seo_security_headers`, `seo_images`, `seo_internal_links`, `seo_mobile`, `seo_ai_crawlers`, `seo_robots_ai`, the generators `seo_generate_robots`, `seo_generate_schema` and `seo_generate_security_headers`, and `rankcli_connect` / `rankcli_disconnect` for dashboard sync. The full list, with each tool's inputs, is in the [`@rankcli/mcp-server` README](https://www.npmjs.com/package/@rankcli/mcp-server).

Now just ask Claude: *"Run an SEO audit on example.com"* ✨

### 🔧 Framework-Specific Fixes

Run the audit against the live site and write the fixes into the project you are standing in:

```bash
rankcli fix --url https://mysite.com --dry-run   # preview
rankcli fix --url https://mysite.com --auto      # apply
```

`fix` and `apply` run the same audit as `rankcli audit`, so all three report the same score for a URL. RankCLI detects 32 frameworks and has fix recipes for 11 of them (React, Next.js, Vue, Nuxt, Angular, SvelteKit, Astro, Django, Rails, Laravel, WordPress); on the others the fixes are shown for you to apply by hand.

### 📊 Deep Analyzers

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
  --check-links             Check broken links
  --fail-on <level>         CI gate: exit 1 on any issue at/above error | warning | notice
  --min-score <n>           CI gate: exit 1 if the overall score is below n (0-100)
  --ai                      AI-powered analysis (your own key, or a local model)
  --ai-provider <p>         See "AI analysis" below (auto-detected if omitted)
  --ai-key <key>            Provider API key (or the provider's env var)
  --ai-model <model>        Override the provider's default model
  --ai-base-url <url>       Any OpenAI-compatible server (implies --ai-provider custom)
```

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Audit completed; no `--fail-on` / `--min-score` gate tripped |
| `1` | A `--fail-on` or `--min-score` gate tripped |
| `2` | Bad invocation: missing/invalid `--url`, invalid flag value |
| `3` | No real audit: the site was unreachable, the URL answered 4xx/5xx, no page could be analyzed, or an internal error |

The gates are opt-in: without them, a completed audit exits `0` however many issues it finds. An unreachable site or an error status always exits `3` - it scores 0, not a passing grade. With `-o json`, stdout is always one JSON document (on failure too) carrying `exitCode` and, when gates are set, a `gate` object with the reasons.

#### AI analysis (`--ai`)

AI analysis runs on your own provider - nothing goes through RankCLI.

**On a Mac with Apple Intelligence, it's the default.** On macOS 26 or later on Apple silicon with Apple Intelligence turned on, `--ai` uses Apple's on-device model: free, private, no key and no network round trip. The first run builds a small Swift helper with the Xcode command-line tools (a few seconds, cached in `~/Library/Caches/rankcli`). The on-device model has a small context window, so it sees the 25 most severe issues. To use another provider, pass `--ai-provider`, or set it once with `RANKCLI_AI_PROVIDER=openrouter` (any provider id below).

Otherwise, with no `--ai-provider`, the first key found wins, in this order (OpenRouter first):

| Provider | Env var | Base URL | Default model |
|----------|---------|----------|---------------|
| `openrouter` | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | `openrouter/free` |
| `groq` | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| `gemini` | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.7-flash` |
| `deepseek` | `DEEPSEEK_API_KEY` | `https://api.deepseek.com` | `deepseek-flash` |
| `cerebras` | `CEREBRAS_API_KEY` | `https://api.cerebras.ai/v1` | `gpt-oss-120b` |
| `mistral` | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | `mistral-small-latest` |
| `together` | `TOGETHER_API_KEY` | `https://api.together.xyz/v1` | `openai/gpt-oss-120b` |
| `fireworks` | `FIREWORKS_API_KEY` | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/gpt-oss-120b` |
| `anthropic` | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1` | `claude-haiku-4-5-20251001` |
| `openai` | `OPENAI_API_KEY` | `https://api.openai.com/v1` | `gpt-5.6-luna` |

**Local models, no key.** If no key is set at all and [Ollama](https://ollama.com) is running, `--ai` uses it automatically (with a one-line notice) and picks its first installed model:

```bash
ollama pull qwen3:8b
rankcli audit --url https://yoursite.com --ai                      # finds Ollama on :11434
rankcli audit --url https://yoursite.com --ai --ai-provider ollama --ai-model qwen3:8b
```

| Provider | Default base URL |
|----------|------------------|
| `ollama` | `http://localhost:11434/v1` (honours `OLLAMA_HOST`) |
| `lmstudio` | `http://localhost:1234/v1` |
| `llamacpp` | `http://localhost:8080/v1` (`llama-server`) |
| `vllm` | `http://localhost:8000/v1` |
| `custom` | whatever `--ai-base-url` says |

Local providers need no key and no model name: without `--ai-model` the CLI asks the server (`/api/tags` for Ollama, `/v1/models` otherwise) and uses the first loaded model. Any other OpenAI-compatible server works too:

```bash
rankcli audit --url https://yoursite.com --ai --ai-base-url http://gpu-box:8080/v1 --ai-model my-model
```

Local and small models often ignore "JSON only" instructions, so the reply is parsed defensively (code fences, `<think>` blocks and surrounding prose are stripped). `response_format: json_object` is only sent to providers known to support it. An AI failure is reported but never changes the exit code.

### `rankcli apply`

Generate and apply framework-specific fixes.

```bash
rankcli apply --url https://mysite.com --dry-run   # Preview
rankcli apply --url https://mysite.com --auto      # Auto-apply
```

### `rankcli keywords`

AI-powered keyword research. `--ai` runs on the same provider as `audit --ai` (Apple Intelligence on a Mac that has it, else your key, else a local Ollama) and takes the same `--ai-provider` / `--ai-key` / `--ai-model` / `--ai-base-url` flags. Keyword clustering uses embeddings on OpenAI and term vectors everywhere else; local models judge 5 tool ideas instead of 15.

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

# API key (for CI/CD) - validates the key and resolves your plan; exits 1 if rejected
rankcli login --token rankcli_your_api_key

# Or just the environment variable - every command resolves the key's plan itself
export RANKCLI_API_KEY=rankcli_your_api_key
rankcli login   # optional: validates it and shows the plan
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
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install -g @rankcli/cli
      # Fails the job on any error-severity issue or a score under 80.
      - run: rankcli audit --url "$SITE_URL" --fail-on error --min-score 80 -o json > "$RUNNER_TEMP/audit.json"
        env:
          SITE_URL: ${{ vars.SITE_URL }}
          RANKCLI_API_KEY: ${{ secrets.RANKCLI_API_KEY }}   # optional: dashboard sync + your plan's limits
```

`rankcli setup --github-action --url https://yoursite.com [--sync]` writes a scheduled workflow that files the report as an issue (and, with `--sync` and a RankCLI API key, opens auto-fix PRs - 3 a month on Free).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RANKCLI_API_KEY` | API key for authentication (plan resolved automatically) |
| `RANKCLI_CONFIG_DIR` | Store login/config here instead of the per-user config dir |

## Project config

`rankcli init` writes `rankcli.config.json` in the project (name, framework, `url`, GitHub repo). `audit`, `fix` and `apply` use its `url` when `--url` is omitted.
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `TOGETHER_API_KEY`, `FIREWORKS_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | AI analysis keys (see "AI analysis") |
| `OLLAMA_HOST` | Where a local Ollama listens (default `localhost:11434`) |

## Node versions

The npm package needs **Node 20.19+ or 22.12+** (any 23+ works). The CLI is a CommonJS bundle that `require()`s ESM-only dependencies (chalk, conf, inquirer, open), and those are the first releases that load ES modules through `require()` without a flag. Every Node line still in support (22, 24) qualifies. On an older Node, `rankcli` / `npx @rankcli/cli` stops with a message saying so instead of an `ERR_REQUIRE_ESM` stack trace. The Homebrew/Scoop binaries bundle their own Node and have no requirement.

## Pricing

| Feature | Free | Solo+ (from $9/mo) |
|---------|------|--------------|
| SEO + GEO checks | All 280+ | All 280+ |
| Local fixes (`rankcli fix`) | ✅ | ✅ |
| Auto-fix PRs (GitHub App) | 3 a month | ✅ |
| Hosted sites | 1, audited weekly | 3+, weekly or daily |
| Slack & Discord alerts | - | ✅ |

See [rankcli.dev/pricing](https://rankcli.dev/pricing).

## Links

- **Docs**: [rankcli.dev/docs](https://rankcli.dev/docs)
- **GitHub**: [github.com/integrallis/rankcli-cli](https://github.com/integrallis/rankcli-cli)
- **Support**: support@rankcli.dev

## License

MIT
