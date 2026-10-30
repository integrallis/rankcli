# RankCLI SEO Audit - GitHub Action

Ship code, get ranked. The [RankCLI](https://rankcli.dev) SEO and AI-search audit (280+ checks) as a CI gate: audit a URL or your build directory, fail the step on regressions, annotate the run, and keep one PR comment up to date.

The audit runs entirely in your runner, the same engine as `rankcli audit`. An API key is optional.

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
      - uses: actions/checkout@v4          # for rankcli.config.json and the baseline
      - uses: integrallis/rankcli-action@v1
        with:
          url: https://your-site.com
          fail-on: error,score<80
```

### Gate rules

`fail-on` takes the same rules as `rankcli audit --fail-on`, comma-separated:

| Rule | Fails the step when |
|------|---------------------|
| `error` | any error-severity issue is found (`warning`, `notice` include everything at or above them) |
| `score<80` | the overall score is below 80 |
| `score:aiReadiness<70` | a category score is below 70 (`overall`, `crawlability`, `indexability`, `onPage`, `content`, `links`, `performance`, `security`, `aiReadiness`, `social`, `localSeo`, `accessibility`) |

Without a rule, findings never fail the step; a site that cannot be audited always does.

### Adopt the gate on an existing site: a baseline

Save a report once, commit it, and the severity rule counts only findings that are not in it. Old findings stay listed; new ones fail the build.

```bash
npx @rankcli/cli audit --url https://your-site.com -o json > .rankcli/baseline.json
```

```yaml
      - uses: integrallis/rankcli-action@v1
        with:
          url: https://your-site.com
          fail-on: error
          baseline: .rankcli/baseline.json
```

A finding is identified by its code and the page's path, so save the baseline with the `max-pages` the gate runs with.

### Audit the build before it is deployed

```yaml
      - run: npm ci && npm run build
      - uses: integrallis/rankcli-action@v1
        with:
          dir: dist                      # served inside the runner
          url: https://your-site.com     # the site the build is for
          fail-on: error
```

Canonical and sitemap checks compare against `url`; checks of the host (TLS, security and caching headers, redirects, crawler access) are skipped. Annotations then point at the files in `dist`.

### rankcli.config.json

The action reads `rankcli.config.json` from the workspace (or the file named by `config`): `url`, `maxPages`, `failOn`, `minScore`, `budgets`, `baseline`, `ignore` rules, `headers` and `dir`, the same file the CLI reads. Inputs win over the file. See the [CLI README](https://github.com/integrallis/rankcli/tree/main/packages/cli#project-config) for the schema.

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
          fail-on: error
          headers: |
            x-vercel-protection-bypass: ${{ secrets.VERCEL_BYPASS }}
```

Preview hosts (`*.vercel.app`, `*.netlify.app`, `*.pages.dev`) add `X-Robots-Tag: noindex` to every preview. The audit reports that as a notice on those hosts, so it doesn't fail every preview run. A `noindex` meta tag in your HTML still counts, because it ships to production. `headers` (one `Name: value` per line) are sent only to the audited site.

### What you see

- **The step**: the findings as annotations (the new ones with a baseline, otherwise the errors), with file locations when `dir` is used. Ten per level.
- **The job summary**: score, counts, and what is new and fixed since the baseline.
- **The PR comment**: one comment, updated in place on later runs. By default it is posted only on regressions (the gate failed, or there are new findings against the baseline), so a clean deploy stays quiet. `comment-on-pr: always` posts every run; `never` turns it off.
- **`report-file`**: the full JSON report (the same document as `rankcli audit -o json`) for a later step or an artifact. For Code Scanning, run the CLI with `-o sarif` and upload the file with `github/codeql-action/upload-sarif`.

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
- a `fail-on` rule trips (with a `baseline`, only new findings count for the severity rule);
- `url`/`dir`, `fail-on`, `baseline` or `rankcli.config.json` is invalid: a gate that is not applied is a green build on a broken site;
- `api-key` is set but the key is invalid or revoked.

The step does **not** fail when:
- the PR comment can't be posted, for example on a fork PR, whose token is read-only. That's a warning, and the audit result still decides the step;
- an alert can't be sent;
- the API key is over its daily quota or on a plan without API access. That's a warning, and the audit still runs and still gates.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `url` | URL to audit; with `dir`, the site the build is for. One of `url`/`dir` is required | - |
| `dir` | A build directory to audit instead of a live URL (check out and build first) | - |
| `fail-on` | Gate rules: `error` / `warning` / `notice`, `score<80`, `score:aiReadiness<70`, comma-separated | - |
| `baseline` | A saved JSON report in the repository; only findings not in it count for the severity rule | - |
| `config` | Path to `rankcli.config.json` | the one in the workspace root, if any |
| `max-pages` | Pages to audit, the sitemap first | `5` |
| `headers` | `Name: value` lines sent with every request to the site | - |
| `report-file` | Write the full JSON report here | - |
| `api-key` | RankCLI API key (or `RANKCLI_API_KEY` env) | - |
| `github-token` | Token for the PR comment | `${{ github.token }}` |
| `comment-on-pr` | `regressions`, `always` or `never` (`true`/`false` still work) | `regressions` |
| `annotations` | Annotate the run with the findings | `true` |
| `fail-on-errors` / `fail-on-error` | The same as `fail-on: error` (kept for existing workflows) | `false` |
| `score-threshold` | The same as `fail-on: score<N` (kept for existing workflows) | `0` |
| `slack-webhook` | Slack incoming-webhook URL | - |
| `discord-webhook` | Discord webhook URL | - |
| `alert-on` | `error` (any error issue), `failure` (step failed), comma-separated | `error` |

**Removed:** `create-pr`, `pr-threshold-errors`, `pr-threshold-score`, `pr-base-branch` and `checks`. They never did anything; `create-pr` never opened a PR. Using them now logs a deprecation warning. For auto-fix PRs, run `rankcli setup --github-action --sync` in your repo. It writes a workflow that runs `rankcli fix` and opens the PR.

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Overall SEO score (0-100) |
| `passed` | Whether the gate passed (`true`/`false`) |
| `issues-count` | Total issues (after ignore rules) |
| `errors-count` | Error-severity issues |
| `warnings-count` | Warnings |
| `new-issues-count` | Issues not in the baseline (every issue without one) |
| `fixed-issues-count` | Baseline issues that are gone |
| `report-json` | Full report as JSON |
| `report-file` | Where the report was written, when `report-file` is set |
| `rate-limit-remaining` / `rate-limit-resets-at` | RankCLI API quota (when `api-key` is set) |

## Security

**What leaves your runner.** The audit runs in your runner and fetches only the URL you give it (plus its robots.txt, sitemap and linked assets); with `dir`, the build is served on 127.0.0.1 inside the runner. `headers` go only to the audited site, and their values are masked in the logs. With `api-key` set, the key is sent once to RankCLI's key check (`validate-api-key`) to look up your plan. Alerts go only to the webhooks you configure, and the PR comment goes through the GitHub API with `github-token`. Nothing else is sent anywhere; there's no telemetry.

**Pin the action.** A tag like `@v1` can move. For supply-chain safety, pin to a full commit SHA and let Dependabot propose updates:

```yaml
- uses: integrallis/rankcli-action@<commit-sha> # v1.0.0
```

**Least privilege.** The action needs `contents: read`, plus `pull-requests: write` only if you want the PR comment. Set `permissions:` explicitly, as in the examples above.

**Secrets.** Pass the API key and webhook URLs through `secrets.*`. The action also masks them in its logs if they arrive as plain text.

**Fork pull requests.** Use the `pull_request` event. The action never needs your repository's code, so don't combine it with `pull_request_target` plus a checkout of the PR's code. On `deployment_status` runs (preview deployments), which have your repository's secrets, don't check out or run code from the PR either.

**What's in this repo.** `src/` is the action's source, and `dist/` is built from it with [ncc](https://github.com/vercel/ncc). The bundle includes [`@rankcli/agent-runtime`](https://www.npmjs.com/package/@rankcli/agent-runtime) (FSL-1.1-MIT, published on npm) and GitHub's `@actions/*` toolkit; their licenses are in `dist/licenses.txt`.

**Reporting a vulnerability.** Use "Report a vulnerability" on this repository's Security tab, or email support@rankcli.dev. Please don't open a public issue.

## License

[FSL-1.1-MIT](https://github.com/integrallis/rankcli/blob/main/LICENSE): free to use, read, change and redistribute, including in your own workflows; not to build a competing product or service. Each version becomes MIT two years after its release.
