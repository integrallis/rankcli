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
  -u, --url <url>           URL to audit (or the url in rankcli.config.json)
  --dir <path>              Audit a build directory (dist, out, build) served locally; --url names the site it is built for
  -o, --output <format>     Output: console (default), json, sarif, junit
  --max-pages <n>           Pages to audit, the sitemap first (default: 5)
  --check-links             Check broken links
  --fail-on <rules>         CI gate: error | warning | notice, score<80, score:aiReadiness<70 (comma-separated or repeated)
  --min-score <n>           CI gate: the same as --fail-on score<n
  --baseline <file>         A saved JSON report; --fail-on then counts only issues that are not in it
  --header <header>         "Name: value" sent with every request to the site (repeatable)
  --cookie <cookie>         "name=value" sent with every request to the site (repeatable)
  --config <file>           Config file (default: rankcli.config.json in the current directory)
  --ai                      AI-powered analysis (your own key, or a local model)
  --ai-provider <p>         See "AI analysis" below (auto-detected if omitted)
  --ai-key <key>            Provider API key (or the provider's env var)
  --ai-model <model>        Override the provider's default model
  --ai-base-url <url>       Any OpenAI-compatible server (implies --ai-provider custom)
```

#### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Audit completed; no gate tripped |
| `1` | A gate tripped (`--fail-on`, `--min-score`, a budget in `rankcli.config.json`) |
| `2` | Bad invocation: missing/invalid `--url` or `--dir`, invalid flag value, invalid config or baseline file |
| `3` | No real audit: the site was unreachable, the URL answered 4xx/5xx, no page could be analyzed, or an internal error |

The gates are opt-in: without them, a completed audit exits `0` however many issues it finds. An unreachable site or an error status always exits `3` - it scores 0, not a passing grade. Every machine format (`json`, `sarif`, `junit`) is one document on stdout, on failure too.

#### CI gates

One rule syntax, in `--fail-on`, in `rankcli.config.json` and in the GitHub Action:

| Rule | Fails the build when |
|------|----------------------|
| `error` | any error-severity issue is found (`warning` and `notice` include everything at or above them) |
| `score<80` | the overall score is below 80 (`--min-score 80` is the same rule) |
| `score:aiReadiness<70` | a category score is below 70: `overall`, `crawlability`, `indexability`, `onPage`, `content`, `links`, `performance`, `security`, `aiReadiness`, `social`, `localSeo`, `accessibility` |

Rules combine: `--fail-on error,score<80` or the flag repeated.

**Adopt the gate on an existing site with a baseline.** Save a report once, commit it, and the severity rule counts only findings that are not in it; old findings stay listed but do not fail the build until you choose to fix them. Score rules stay absolute.

```bash
rankcli audit -o json > .rankcli/baseline.json      # once; commit the file
rankcli audit --fail-on error --baseline .rankcli/baseline.json
```

A finding is identified by its code and the page's path, so save the baseline with the same `--max-pages` the gate runs with. The console and the JSON report list what is new since the baseline, what was fixed and what stayed; `rankcli diff` compares any two saved reports.

#### Output formats

| `-o` | What you get |
|------|--------------|
| `console` | The report, every finding grouped by severity with its code |
| `json` | One document: `url`, `timestamp`, `cliVersion`, `score`, `healthScores`, `pages` (one entry per audited page with its score and counts), `discovery` (where the pages came from), `checksRun`, `checksPassed`, `issues` (code, severity, category, title, description, impact, howToFix, affectedUrls), `ignored`, `baseline` (new, fixed, unchanged), `gate` and `exitCode` |
| `sarif` | SARIF 2.1.0 for GitHub Code Scanning (`github/codeql-action/upload-sarif`) and other SARIF readers: one rule per code, one result per page, `baselineState` when a baseline is given, file locations with `--dir` |
| `junit` | JUnit XML for test reporters: findings at or above the gate's severity are failures, the rest pass with the finding in their output |

#### Protected previews

Preview deployments behind a password, a bypass header or a cookie:

```bash
rankcli audit --url https://preview.example.com --header "x-vercel-protection-bypass: $BYPASS"
rankcli audit --url https://staging.example.com --cookie "session=abc" --header "Authorization: Bearer $TOKEN"
```

Headers go only to the audited site (and its `www.` twin), never to any other host the audit touches.

#### Audit the build before deploying

```bash
npm run build
rankcli audit --dir dist --url https://example.com --fail-on error
```

The directory is served locally for the length of the audit, the way a static host serves it (`about/index.html`, `pricing.html`, `robots.txt`, `sitemap.xml`), and audited as the site named by `--url`, so canonical and sitemap checks compare against your real origin. Checks of the host (TLS certificate, security and caching headers, redirects, crawler access, canonical domain) are skipped: a local file server has none of that. With `-o sarif`, findings point at the files in the directory.

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

### `rankcli diff`

Compare two saved JSON reports: new findings, fixed findings, score moves per category.

```bash
rankcli audit -o json > before.json
# ...deploy...
rankcli audit -o json > after.json
rankcli diff before.json after.json                   # exit 0
rankcli diff before.json after.json --fail-on error   # exit 1 on new error-severity findings
rankcli diff before.json after.json -o json
```

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

The [RankCLI Action](https://github.com/integrallis/rankcli-action) runs the same audit, fails the job on the gate, annotates the run and keeps one PR comment up to date (posted only on regressions):

```yaml
name: SEO
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write   # the PR comment

jobs:
  seo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: integrallis/rankcli-action@v1
        with:
          url: https://your-site.com          # or a preview URL from your deploy step
          fail-on: error,score<80
          baseline: .rankcli/baseline.json    # optional: only new findings fail the build
```

Audit the build output before it is deployed, and send the findings to Code Scanning:

```yaml
      - run: npm ci && npm run build
      - uses: integrallis/rankcli-action@v1
        with:
          dir: dist
          url: https://your-site.com
          fail-on: error
      - run: npx @rankcli/cli audit --dir dist --url https://your-site.com -o sarif > rankcli.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: rankcli.sarif
```

The CLI alone works in any CI:

```bash
npm install -g @rankcli/cli
rankcli audit --url "$SITE_URL" --fail-on error,score<80 --baseline .rankcli/baseline.json -o json > "$RUNNER_TEMP/audit.json"
```

`rankcli setup --github-action --url https://yoursite.com [--sync]` writes a scheduled workflow that uses the Action and files the report as an issue (and, with `--sync` and a RankCLI API key, opens auto-fix PRs - 3 a month on Free).

## Project config

`rankcli init` writes `rankcli.config.json` with the project's `url`; `audit`, `fix` and `apply` use it when `--url` is omitted. The same file holds the CI settings, which `audit` and the GitHub Action read the same way. Flags win over the file. Every field is optional.

```json
{
  "url": "https://example.com",
  "maxPages": 5,
  "checkLinks": false,
  "failOn": ["error", "score:aiReadiness<70"],
  "minScore": 80,
  "budgets": { "crawlability": 90 },
  "baseline": ".rankcli/baseline.json",
  "ignore": [
    "LLMS_TXT_MISSING",
    { "code": "IMG_ALT_MISSING", "url": "/blog/*", "reason": "legacy posts" },
    { "url": "/drafts/**" }
  ],
  "headers": { "x-vercel-protection-bypass": "${VERCEL_BYPASS}" },
  "dir": "dist"
}
```

- `failOn`, `minScore` and `budgets` are gate rules (see "CI gates"); `budgets` sets minimum category scores.
- `ignore` drops findings by code, by page, or both. Patterns are globs: `*` matches within one path segment, `**` across segments; a pattern starting with `http` matches the whole URL. Ignored findings are counted and listed in the JSON report, never silently dropped.
- `headers` values may use `${ENV_VAR}`, so tokens stay out of the file.
- An invalid file is an error (exit 2), never ignored: a gate that is not applied is a green build on a broken site. `--config <file>` names another file.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RANKCLI_API_KEY` | API key for authentication (plan resolved automatically) |
| `RANKCLI_CONFIG_DIR` | Store login/config here instead of the per-user config dir |

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
- **Source**: [github.com/integrallis/rankcli](https://github.com/integrallis/rankcli) (FSL-1.1-MIT; binaries on the releases page)
- **Support**: support@rankcli.dev

## License

[FSL-1.1-MIT](https://github.com/integrallis/rankcli/blob/main/LICENSE): free to use, read, change and redistribute, including inside your own tools and pipelines; not to build a competing product or service. Each version becomes MIT two years after its release.
