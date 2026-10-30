# RankCLI

**Ship code, get ranked.** The SEO and AI-search audit that runs where your code runs: in the
terminal, in CI, and inside your AI assistant. 280+ technical SEO and AI-readiness checks, a
non-zero exit code when something regresses, and fixes that land as code.

```bash
npx @rankcli/cli audit --url https://your-site.dev
```

No account. Nothing leaves your machine except the requests to your own site.

## What is in this repository

| Package | What it is | Install |
|---|---|---|
| [`packages/cli`](packages/cli) | The `rankcli` command: audit, gate, fix, apply | `npm i -g @rankcli/cli`, `brew install integrallis/tap/rankcli`, `scoop install rankcli` |
| [`packages/agent-runtime`](packages/agent-runtime) | The audit engine every surface runs: the checks, the scoring, framework detection, fix recipes | `npm i @rankcli/agent-runtime` |
| [`packages/mcp-server`](packages/mcp-server) | A local MCP server with 15 tools for Claude, Cursor, Codex and any MCP client | `npx @rankcli/mcp-server` |
| [`packages/github-action`](packages/github-action) | The GitHub Action that fails the build on SEO regressions and comments on the PR | `uses: integrallis/rankcli-action@v1` |
| [`packages/astro-plugin`](packages/astro-plugin), [`next-plugin`](packages/next-plugin), [`vite-plugin`](packages/vite-plugin) | Build-time SEO lint for Astro, Next.js and Vite | `astro-rankcli`, `next-rankcli`, `vite-plugin-rankcli` |

Everything here is MIT. The hosted product at [rankcli.dev](https://rankcli.dev) (scheduled
audits, history, auto-fix pull requests, team reports) is optional and lives elsewhere; the CLI,
the engine, the MCP server and the Action are complete without it.

## Thirty seconds

```bash
# Audit one page and print every finding, grouped by severity
rankcli audit --url https://your-site.dev --max-pages 1

# Gate a deploy: exit 1 on any error, or when the score is under 80
rankcli audit --url https://preview.your-site.dev --fail-on error --min-score 80

# Machine-readable, with the fix for each finding
rankcli audit --url https://your-site.dev -o json > audit.json

# Preview the code-level fixes for the current project
rankcli fix --url https://your-site.dev --dry-run
```

What an audit covers: crawlability and indexing, on-page and structured data, Core Web Vitals
signals, mobile, images, security headers, internal linking, content quality, framework-specific
rendering problems (32 frameworks detected, 11 with fix recipes), and AI readiness: whether
GPTBot, ClaudeBot and the search crawlers can reach the page, llms.txt, answer-first structure,
freshness and citation signals. The AI Readiness score measures hygiene on evidence-backed
levers; it does not predict citations, and no published score does.

## Build from source

Node 20.19+ (or 22.12+) and pnpm 8.

```bash
pnpm install
pnpm build          # every package, in dependency order
pnpm test
node packages/cli/dist/index.js audit --url https://example.com
```

The CLI bundle externalizes the engine, so after changing `packages/agent-runtime` rebuild it
before the CLI sees the change. `CONTRIBUTING.md` has the layout, the test conventions and how
a check is added.

## Releases

A GitHub release tagged `vX.Y.Z` publishes `@rankcli/agent-runtime`, `@rankcli/mcp-server` and
`@rankcli/cli` to npm, builds standalone binaries for macOS, Linux and Windows, updates the
Homebrew tap and the Scoop bucket, and attaches a Claude Desktop extension (`.mcpb`).
The changelog is at [rankcli.dev/changelog](https://rankcli.dev/changelog).

## License

MIT, Copyright (c) 2026 Integrallis Software, LLC.
