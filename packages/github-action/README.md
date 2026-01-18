# SEO Autopilot GitHub Action

Run 200+ SEO checks on your site. Get auto-fix PRs, Slack alerts, and detailed reports.

## Features

- **200+ SEO Checks** - Comprehensive audit covering on-page, technical, performance, and more
- **Auto-Fix PRs** - Automatically create pull requests with fixes for detected issues
- **PR Comments** - Post audit results directly on pull requests
- **Slack/Discord Alerts** - Get notified when critical issues are found
- **Score Thresholds** - Fail CI if SEO score drops below a threshold
- **GitHub Actions Summary** - See results in the workflow summary

## Usage

### Basic Usage

```yaml
name: SEO Audit
on:
  pull_request:
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: seo-autopilot/action@v1
        with:
          url: 'https://your-site.com'
```

### With Preview Deployments (Vercel, Netlify, etc.)

```yaml
name: SEO Audit
on:
  deployment_status:

jobs:
  audit:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: seo-autopilot/action@v1
        with:
          url: ${{ github.event.deployment_status.target_url }}
          comment-on-pr: true
          fail-on-error: true
```

### With Auto-Fix PRs

```yaml
- uses: seo-autopilot/action@v1
  with:
    url: 'https://your-site.com'
    create-pr: true
    pr-base-branch: main
```

### With Slack Notifications

```yaml
- uses: seo-autopilot/action@v1
  with:
    url: 'https://your-site.com'
    slack-webhook: ${{ secrets.SLACK_WEBHOOK }}
    alert-on: 'error,score_drop'
```

### With Score Threshold

```yaml
- uses: seo-autopilot/action@v1
  with:
    url: 'https://your-site.com'
    score-threshold: 70
    fail-on-error: true
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `url` | URL to audit | Yes | - |
| `github-token` | GitHub token for PRs and comments | No | `${{ github.token }}` |
| `create-pr` | Create a PR with SEO fixes | No | `false` |
| `pr-base-branch` | Base branch for fix PRs | No | `main` |
| `comment-on-pr` | Post results as PR comment | No | `true` |
| `fail-on-error` | Fail if critical errors found | No | `false` |
| `score-threshold` | Minimum score to pass (0-100) | No | `0` |
| `slack-webhook` | Slack webhook URL | No | - |
| `discord-webhook` | Discord webhook URL | No | - |
| `alert-on` | When to alert (comma-separated) | No | `error` |
| `checks` | Specific checks to run | No | `all` |

### Alert Types

- `error` - Critical SEO errors detected
- `score_drop` - Score dropped since last run
- `weekly_report` - Weekly summary
- `pr_created` - Auto-fix PR was created

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Overall SEO score (0-100) |
| `issues-count` | Total issues found |
| `errors-count` | Critical errors count |
| `warnings-count` | Warnings count |
| `pr-url` | URL of created fix PR |
| `report-json` | Full report as JSON |

## Examples

### Complete Workflow

```yaml
name: SEO Audit

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Wait for deployment
        uses: ahmadnassri/action-workflow-run-wait@v1
        if: github.event_name == 'pull_request'

      - name: Run SEO Audit
        uses: seo-autopilot/action@v1
        id: audit
        with:
          url: ${{ github.event_name == 'pull_request' && format('https://preview-{0}.vercel.app', github.event.pull_request.number) || 'https://your-site.com' }}
          comment-on-pr: true
          fail-on-error: true
          score-threshold: 60
          slack-webhook: ${{ secrets.SLACK_WEBHOOK }}
          alert-on: 'error,score_drop'

      - name: Check Score
        if: steps.audit.outputs.score < 70
        run: echo "::warning::SEO score is below 70"
```

### Use with Vercel

```yaml
name: SEO Audit on Preview

on:
  deployment_status:

jobs:
  audit:
    if: github.event.deployment_status.state == 'success' && github.event.deployment_status.environment == 'Preview'
    runs-on: ubuntu-latest
    steps:
      - uses: seo-autopilot/action@v1
        with:
          url: ${{ github.event.deployment_status.target_url }}
          comment-on-pr: true
```

## PR Comment Example

When `comment-on-pr` is enabled, the action posts a detailed comment:

```
## SEO Audit Report

![SEO Score](https://img.shields.io/badge/SEO%20Score-72%2F100-green)

**URL:** https://your-site.com

### Summary

| Metric | Value |
|--------|-------|
| Score | **72/100** |
| Total Issues | 5 issues |
| Errors | 2 errors |
| Warnings | 3 warnings |

### Category Breakdown

| Category | Score | Issues |
|----------|-------|--------|
| :warning: On-Page | 65/100 | 3 |
| :white_check_mark: Social Meta | 80/100 | 2 |

---
:robot: Powered by SEO Autopilot
```

## License

MIT
