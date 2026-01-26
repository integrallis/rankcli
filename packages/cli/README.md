# RankCLI

**Ship code, get ranked. SEO meets CI/CD.**

A developer-first SEO automation tool. CLI-based, AI-powered, event-driven.

## Installation

```bash
npm install -g rankcli
# or
yarn global add rankcli
# or
pnpm add -g rankcli
```

Verify installation:

```bash
rankcli --version
```

## Quick Start

```bash
# Run an SEO audit
rankcli audit --url https://yoursite.com

# Login to unlock all features
rankcli login

# Run a full 280+ check audit
rankcli audit --url https://yoursite.com --max-pages 5
```

## Authentication

### Interactive Login

```bash
# Email/password login
rankcli login

# Browser-based OAuth
rankcli login --browser

# Provide email directly
rankcli login --email you@example.com
```

### API Key (CI/CD)

For non-interactive environments like CI/CD pipelines:

```bash
# Login with API key
rankcli login --token rankcli_your_api_key_here

# Or set environment variable (recommended for CI)
export RANKCLI_API_KEY=rankcli_your_api_key_here
```

Generate API keys from [Account Settings](https://rankcli.dev/account) → API Keys.

### Check Status

```bash
rankcli whoami
```

### Logout

```bash
rankcli logout
```

## Commands

### `rankcli audit`

Run a comprehensive SEO audit (280+ checks).

```bash
rankcli audit [options]

Options:
  -u, --url <url>           URL to audit
  -o, --output <format>     Output format: json, console (default: console)
  --max-pages <n>           Max pages to crawl (default: 5)
  --check-links             Check for broken internal/external links
  --ai                      Enable AI-powered analysis
  --ai-provider <provider>  AI provider: openai or anthropic
  --ai-key <key>            API key (or set OPENAI_API_KEY/ANTHROPIC_API_KEY)
```

**Examples:**

```bash
# Basic audit
rankcli audit --url https://example.com

# Multi-page audit with JSON output
rankcli audit --url https://example.com --max-pages 10 -o json > report.json

# AI-enhanced audit
rankcli audit --url https://example.com --ai
```

### `rankcli apply`

Generate and apply SEO fixes to your local codebase.

```bash
rankcli apply [options]

Options:
  -u, --url <url>   URL to analyze for fixes
  --dry-run         Preview changes without applying
  --auto            Apply all fixes without confirmation
```

**Examples:**

```bash
# Preview fixes
rankcli apply --url https://mysite.com --dry-run

# Apply fixes with confirmation
rankcli apply --url https://mysite.com

# Auto-apply all fixes (CI mode)
rankcli apply --url https://mysite.com --auto
```

### `rankcli keywords`

AI-powered keyword research and analysis.

```bash
rankcli keywords [options]

Options:
  -u, --url <url>              Your website URL
  -s, --seed <keywords>        Seed keywords (comma-separated)
  --auto                       Auto-extract seed keywords from your page
  --quick                      Quick mode - skip questions, use defaults
  --ai                         Use GPT-4 for enhanced analysis
  --local                      Force local processing (skip cloud worker)
  --competitor                 Competitor gap analysis mode
  -c, --competitors <domains>  Competitor domains (comma-separated)
```

**Examples:**

```bash
# AI-powered keyword research
rankcli keywords --url https://mysite.com --ai

# Quick analysis with seed keywords
rankcli keywords --url https://mysite.com --quick -s 'seo tools,seo audit'

# Competitor gap analysis
rankcli keywords --url https://mysite.com --competitor -c 'competitor1.com,competitor2.com' -s 'target keyword'
```

### `rankcli content`

Analyze content for readability, keyword density, and featured snippets.

```bash
rankcli content [options]

Options:
  -u, --url <url>          URL to analyze
  -k, --keyword <keyword>  Target keyword for analysis
  --headline <headline>    Analyze a headline
  --mode <mode>            Analysis mode (full, readability, headline, snippet, density)
```

**Examples:**

```bash
# Full content analysis
rankcli content --url https://mysite.com/blog-post --keyword 'seo tips'

# Analyze headline
rankcli content --headline 'The Ultimate Guide to SEO'
```

### `rankcli intent`

Classify search intent for a keyword.

```bash
rankcli intent <keyword>
```

**Examples:**

```bash
rankcli intent 'buy running shoes'
rankcli intent 'how to optimize images for seo'
```

### `rankcli setup`

Configure tracking and CI/CD integrations.

```bash
rankcli setup [options]

Options:
  --ga4 <id>        Google Analytics 4 Measurement ID (G-XXXXXXXXXX)
  --gsc <code>      Google Search Console verification code
  --github-action   Set up automated GitHub Action
  --schedule <freq> GitHub Action schedule (daily, weekly, monthly)
  --all             Interactive setup wizard
```

**Examples:**

```bash
# Add GA4 tracking
rankcli setup --ga4 G-XXXXXXXXXX

# Create GitHub Actions workflow
rankcli setup --github-action

# Interactive setup wizard
rankcli setup --all
```

### `rankcli init`

Initialize RankCLI in your project.

```bash
rankcli init [options]

Options:
  -y, --yes   Skip prompts and use defaults
```

### `rankcli analyze`

AI-powered codebase analysis for SEO opportunities.

```bash
rankcli analyze [options]

Options:
  -v, --verbose   Show detailed output
```

## CI/CD Integration

### GitHub Actions

```yaml
name: SEO Audit
on:
  push:
    branches: [main]
  pull_request:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install RankCLI
        run: npm install -g rankcli

      - name: Run SEO Audit
        run: rankcli audit --url ${{ secrets.SITE_URL }} -o json > audit.json
        env:
          RANKCLI_API_KEY: ${{ secrets.RANKCLI_API_KEY }}

      - name: Check for critical issues
        run: |
          errors=$(jq '.issues | map(select(.severity == "error")) | length' audit.json)
          if [ "$errors" -gt 0 ]; then
            echo "::error::Found $errors critical SEO issues"
            exit 1
          fi
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RANKCLI_API_KEY` | API key for authentication (recommended for CI/CD) |
| `OPENAI_API_KEY` | OpenAI API key for AI-powered features |
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative AI provider) |

## Pricing Tiers

| Feature | Anonymous | Free | Solo ($9/mo) | Pro ($29/mo) |
|---------|-----------|------|--------------|--------------|
| SEO Checks | 50 | 100 | 280+ | 280+ |
| Cloud Sync | - | ✓ | ✓ | ✓ |
| GitHub Connect | - | - | ✓ | ✓ |
| Auto-Fix PRs | - | - | - | ✓ |
| Sites | 0 | 1 | 3 | 10 |

## Documentation

Full documentation available at [rankcli.dev/docs](https://rankcli.dev/docs)

## Support

- Documentation: [rankcli.dev/docs](https://rankcli.dev/docs)
- GitHub Issues: [github.com/rankcli/rankcli/issues](https://github.com/rankcli/rankcli/issues)
- Email: support@rankcli.dev

## License

MIT
