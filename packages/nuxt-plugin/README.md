# nuxt-rankcli

The [RankCLI](https://rankcli.dev) audit of what `nuxi generate` produced: 280+ SEO and AI-search checks on the generated pages, logged in the build with every finding's code, and a gate that can fail the build.

## Installation

```bash
npm install -D nuxt-rankcli
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-rankcli'],
  rankcli: {
    siteUrl: 'https://example.com',      // or site.url, runtimeConfig.public.siteUrl, NUXT_PUBLIC_SITE_URL
    maxPages: 50,                        // default: every generated page, up to 50
    failOn: ['error', 'score<80'],       // the rules of `rankcli audit --fail-on`; omit for a report only
  },
})
```

Works with Nuxt 3 and 4. After `nuxi generate`, the module serves `.output/public` the way a static host would and runs the same checks as `rankcli audit --dir .output/public`: crawlability, structured data, metadata placement, AI crawler access as far as a directory can show it, answer-first content and the rest. Host-level checks (TLS, security headers, redirects, the live robots.txt) are skipped, since a directory has none. Nothing is sent anywhere; the audit runs in the build.

```
[nuxt-rankcli] Auditing the build with RankCLI (23 pages, 280+ checks)...
[nuxt-rankcli] RankCLI score 81/100 across 23 pages: 0 errors, 2 warnings, 19 notices
[nuxt-rankcli]   warn  [META_DESC_SHORT] Meta description too short (3 pages)
[nuxt-rankcli]   19 notices not listed; see them with: rankcli audit --dir .output/public --url https://example.com -o llm
```

`failOn` takes `error`, `warning` or `notice` (any finding at or above that severity), `score<80` (the overall score) and `score:aiReadiness<70` (a category score); the build fails with the reasons in the error. `audit: false` turns the module off.

## A server build

`nuxi build` leaves no static pages, so there is nothing for the module to audit; it says so once and names the command for the deployment:

```bash
npx @rankcli/cli audit --url https://your-preview-url --fail-on error,score<80
```

That is also where streaming metadata, the host's crawler rules and the live robots.txt can be observed at all. In CI, [`integrallis/rankcli-action`](https://github.com/marketplace/actions/rankcli-seo-audit) does the same with a PR comment.

## Links

- Every finding by code, with the fix: `rankcli audit --dir .output/public --url https://example.com -o json`
- The engine's source: [integrallis/rankcli](https://github.com/integrallis/rankcli)

## License

MIT. The engine it runs, `@rankcli/agent-runtime`, is FSL-1.1-MIT.
