#!/usr/bin/env node
/**
 * The corpus: the homepages of the most popular npm packages, by npm's own popularity score.
 *
 * A reproducible list that anyone can rebuild: npm's search API ranked by popularity, over a
 * handful of broad keywords, keeping each package's homepage when it is a site of its own
 * (not a GitHub, GitLab or npm page). The corpus is what the developer audience builds and
 * documents, so what it blocks, streams or forgets is the story.
 *
 *   node scripts/corpus/build-list.mjs [--size 400] > corpus/sites.json
 */
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const size = Number(args[args.indexOf('--size') + 1] || 400);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

const KEYWORDS = ['framework', 'cli', 'react', 'vue', 'build', 'testing', 'database', 'server', 'typescript', 'css', 'bundler', 'orm', 'api', 'auth', 'ui'];
const NOT_A_SITE = /^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com|bitbucket\.org|npmjs\.com|www\.npmjs\.com|npm\.im|codeberg\.org|sr\.ht|localhost)(\/|$)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function search(keyword) {
  const url = `https://registry.npmjs.org/-/v1/search?text=keywords:${keyword}&popularity=1.0&quality=0&maintenance=0&size=250`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'rankcli-corpus/1.0 (+https://rankcli.dev)' } });
    if (res.ok) return (await res.json()).objects;
    // The search API rate-limits a burst of queries; wait and ask again.
    console.error(`npm search ${keyword}: HTTP ${res.status}${attempt < 3 ? ', retrying' : ''}`);
    await sleep(10000 * (attempt + 1));
  }
  return [];
}

// npm's `popularity` detail comes back flat when the search is weighted on it alone, so the
// rank is the position in the results, which npm already orders by popularity.
const sites = new Map(); // origin -> { origin, packages: [], rank }
for (const keyword of KEYWORDS) {
  const objects = await search(keyword);
  await sleep(2000);
  objects.forEach(({ package: pkg }, rank) => {
    const homepage = pkg.links?.homepage;
    if (!homepage || NOT_A_SITE.test(homepage)) return;
    let origin;
    try {
      const u = new URL(homepage);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
      origin = u.origin;
    } catch {
      return;
    }
    const entry = sites.get(origin) ?? { origin, packages: [], rank: Infinity };
    if (!entry.packages.includes(pkg.name)) entry.packages.push(pkg.name);
    entry.rank = Math.min(entry.rank, rank);
    sites.set(origin, entry);
  });
}

const list = [...sites.values()].sort((a, b) => a.rank - b.rank || a.origin.localeCompare(b.origin)).slice(0, size);
const doc = {
  source: 'npm search API, keywords ' + KEYWORDS.join(', ') + ', ranked by npm popularity; package homepages that are sites of their own',
  builtAt: new Date().toISOString(),
  count: list.length,
  sites: list.map(({ origin, packages }) => ({ origin, packages: packages.slice(0, 5) })),
};
const text = JSON.stringify(doc, null, 2) + '\n';
if (out) writeFileSync(out, text);
else process.stdout.write(text);
console.error(`${list.length} sites from ${sites.size} distinct homepages`);
