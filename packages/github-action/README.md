# RankCLI SEO Audit - GitHub Action

Ship code, get ranked. Runs the [RankCLI](https://rankcli.dev) SEO/GEO audit on a URL inside your workflow, reports it on the pull request and in the job summary, and fails the step when SEO regresses.

The audit runs entirely in your runner. An API key is optional.

## Usage

```yaml
name: SEO
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write   # only needed for the PR comment

jobs:
  seo:
    runs-on: ubuntu-latest
    steps:
      - uses: integrallis/rankcli-action@v1
        with:
          url: https://your-site.com
          fail-on-errors: true
          score-threshold: 70
```

### Preview deployments (Vercel, Netlify, ...)

```yaml
on:
  deployment_status:

jobs:
  seo:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: integrallis/rankcli-action@v1
        with:
          url: ${{ github.event.deployment_status.target_url }}
          fail-on-errors: true
```

Preview hosts (`*.vercel.app`, `*.netlify.app`, `*.pages.dev`) add `X-Robots-Tag: noindex` to every preview. The audit reports that as a notice on those hosts, so it doesn't fail every preview run. A `noindex` meta tag in your HTML still counts, because it ships to production.

### Slack / Discord alerts

```yaml
- uses: integrallis/rankcli-action@v1
  with:
    url: https://your-site.com
    slack-webhook: ${{ secrets.SLACK_WEBHOOK }}
    alert-on: error,failure
```

## When the step fails

The step fails when:
- the URL can't be audited: unreachable, or it answers 4xx/5xx. This happens with or without any gate configured, because a site that's down shouldn't show a green check;
- `fail-on-errors` (or `fail-on-error`) is `true` and the audit finds any error-severity issue;
- `score-threshold` is above 0 and the overall score is below it;
- `api-key` is set but the key is invalid or revoked.

The step does **not** fail when:
- the PR comment can't be posted, for example on a fork PR, whose token is read-only. That's a warning, and the audit result still decides the step;
- an alert can't be sent;
- the API key is over its daily quota or on a plan without API access. That's a warning, and the audit still runs and still gates.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `url` | URL to audit (required) | - |
| `api-key` | RankCLI API key (or `RANKCLI_API_KEY` env) | - |
| `github-token` | Token for the PR comment | `${{ github.token }}` |
| `comment-on-pr` | Comment the results on `pull_request` runs | `true` |
| `fail-on-errors` / `fail-on-error` | Fail on any error-severity issue (either spelling) | `false` |
| `score-threshold` | Minimum overall score (0 disables) | `0` |
| `slack-webhook` | Slack incoming-webhook URL | - |
| `discord-webhook` | Discord webhook URL | - |
| `alert-on` | `error` (any error issue), `failure` (step failed), comma-separated | `error` |

**Removed:** `create-pr`, `pr-threshold-errors`, `pr-threshold-score`, `pr-base-branch` and `checks`. They never did anything; `create-pr` never opened a PR. Using them now logs a deprecation warning. For auto-fix PRs, run `rankcli setup --github-action --sync` in your repo. It writes a workflow that runs `rankcli fix` and opens the PR.

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Overall SEO score (0-100) |
| `passed` | Whether the gate passed (`true`/`false`) |
| `issues-count` | Total issues |
| `errors-count` | Error-severity issues |
| `warnings-count` | Warnings |
| `report-json` | Full report as JSON |
| `rate-limit-remaining` / `rate-limit-resets-at` | RankCLI API quota (when `api-key` is set) |

## Security

**What leaves your runner.** The audit runs in your runner and fetches only the URL you give it (plus its robots.txt, sitemap and linked assets). With `api-key` set, the key is sent once to RankCLI's key check (`validate-api-key`) to look up your plan. Alerts go only to the webhooks you configure, and the PR comment goes through the GitHub API with `github-token`. Nothing else is sent anywhere; there's no telemetry.

**Pin the action.** A tag like `@v1` can move. For supply-chain safety, pin to a full commit SHA and let Dependabot propose updates:

```yaml
- uses: integrallis/rankcli-action@<commit-sha> # v1.0.0
```

**Least privilege.** The action needs `contents: read`, plus `pull-requests: write` only if you want the PR comment. Set `permissions:` explicitly, as in the examples above.

**Secrets.** Pass the API key and webhook URLs through `secrets.*`. The action also masks them in its logs if they arrive as plain text.

**Fork pull requests.** Use the `pull_request` event. The action never needs your repository's code, so don't combine it with `pull_request_target` plus a checkout of the PR's code. On `deployment_status` runs (preview deployments), which have your repository's secrets, don't check out or run code from the PR either.

**What's in this repo.** `src/` is the action's source, and `dist/` is built from it with [ncc](https://github.com/vercel/ncc). The bundle includes [`@rankcli/agent-runtime`](https://www.npmjs.com/package/@rankcli/agent-runtime) (MIT, published on npm) and GitHub's `@actions/*` toolkit; their licenses are in `dist/licenses.txt`.

**Reporting a vulnerability.** Use "Report a vulnerability" on this repository's Security tab, or email support@rankcli.dev. Please don't open a public issue.

## License

MIT
