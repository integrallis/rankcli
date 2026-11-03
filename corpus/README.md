# The corpus

The homepages of the 400 most popular npm packages, audited weekly, one page each, with the
CLI built from this repository's main. The data is published on the
[`corpus-data`](https://github.com/integrallis/rankcli/tree/corpus-data) branch:
`latest.json`, `results/<date>.json` and the `sites.json` that was audited.

**Why.** The sites developers build and document are the sites that show what the ecosystem
actually does: how many refuse Claude's search crawler at the edge while robots.txt says
nothing, how many serve their metadata to Googlebot and to nobody else, how many stamp one
date on every sitemap URL, how many publish an llms.txt. Every number in a write-up that cites
this corpus can be rebuilt by anyone with the two scripts below.

**How the list is built.** `scripts/corpus/build-list.mjs` asks npm's search API for the
most popular packages under fifteen broad keywords (framework, cli, react, vue, build,
testing, database, server, typescript, css, bundler, orm, api, auth, ui), keeps each package's
homepage when it is a site of its own (not a GitHub, GitLab, Codeberg or npm page), ranks
sites by their best position in npm's popularity order, and keeps the first 400. The list is
rebuilt on demand, not every week, so runs compare like with like.

**What is audited and kept.** `scripts/corpus/audit.mjs` runs
`rankcli audit --url <origin> --max-pages 1 -o json` on each site, a few at a time, and keeps
a small record: the scores, the detected framework, the exit code, every finding code, and
the facts the headlines are made of (which crawler classes robots.txt disallows and which the
edge refuses, with the statuses observed; metadata streamed only to Googlebot; a
client-rendered homepage; llms.txt and sitemap presence; a sitemap with one lastmod for every
URL; an IndexNow key). No page content is kept. One page per site per week is less than a
single reader costs the site.

**Reading the data.** `headlines` in each results file counts the sites per fact, and
`results[]` has one record per site; `audited` excludes sites that were unreachable or
answered an error status (`exitCode` 3), which are counted separately. A finding that is
absent from a site's `codes` means the check passed or did not apply.

**To be left out.** Open an issue naming the origin; it is removed from `sites.json` at the
next rebuild. The audit's user agent is `RankCLI/1.0 (+https://rankcli.dev)`, and the
crawler-access check fetches the homepage once as each of eleven crawlers' user agents to
see what they receive.

```bash
node scripts/corpus/build-list.mjs --size 400 --out corpus/sites.json
node scripts/corpus/audit.mjs --sites corpus/sites.json --out corpus/results/$(date -u +%F).json --concurrency 6
```
