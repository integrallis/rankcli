#!/usr/bin/env node
/**
 * Framework detection, measured against real sites.
 *
 * This is how the signal table in src/frameworks/signals.ts was built and how any change to it
 * should be judged. It needs the network, so it is a script rather than a test; signals.test.ts
 * covers each rule offline.
 *
 *   node scripts/benchmark-detection.mjs            # both sets
 *   node scripts/benchmark-detection.mjs --holdout  # only sites the signals were not tuned on
 *
 * The number that matters is precision on claims, not accuracy. A wrong framework sends the
 * user framework-specific advice for a stack they do not use, which is worse than saying
 * nothing - so a miss costs far less than a wrong answer, and the floor in signals.ts is set
 * accordingly.
 *
 * Labels were adjudicated from each page's own evidence rather than from memory. Several of the
 * first labels were wrong and the detector was right: react.dev is a Next.js app, spring.io's
 * website is Gatsby, elixir-lang.org and getbootstrap.com have moved to Astro, and remix.run
 * shows no Remix runtime at all. Two sites stay labelled as frameworks we cannot detect -
 * djangoproject.com and python.org are Django and emit nothing that says so - because
 * relabelling them would hide a real limit.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { frameworks } = require('../dist/index.js');

// Tuned against these.
const TUNING = [
  ['https://vercel.com/', 'nextjs'], ['https://nextjs.org/', 'nextjs'], ['https://linear.app/', 'nextjs'],
  ['https://react.dev/', 'nextjs'], ['https://nuxt.com/', 'nuxt'], ['https://astro.build/', 'astro'],
  ['https://docs.astro.build/en/getting-started/', 'astro'], ['https://svelte.dev/', 'sveltekit'],
  ['https://kit.svelte.dev/', 'sveltekit'], ['https://angular.dev/', 'angular'],
  ['https://www.djangoproject.com/', 'django'], ['https://laravel.com/', 'laravel'],
  ['https://wordpress.org/', 'wordpress'], ['https://techcrunch.com/', 'wordpress'],
  ['https://www.gatsbyjs.com/', 'gatsby'], ['https://spring.io/', 'gatsby'],
  ['https://qwik.dev/', 'qwik'], ['https://gohugo.io/', 'hugo'], ['https://jekyllrb.com/', 'jekyll'],
  ['https://www.11ty.dev/', 'eleventy'], ['https://www.phoenixframework.org/', 'phoenix'],
  ['https://htmx.org/', 'htmx'], ['https://vuejs.org/', 'vue'], ['https://vitejs.dev/', 'vue'],
  ['https://rankcli.dev/', 'react'], ['https://animerm.ai/', 'react'],
  ['https://integrallis.com/', 'unknown'], ['https://rubyonrails.org/', 'unknown'],
  ['https://remix.run/', 'unknown'], ['https://www.solidjs.com/', 'solidjs'],
];

// Never used to build a signal.
const HOLDOUT = [
  ['https://www.notion.so/', 'nextjs'], ['https://supabase.com/', 'nextjs'],
  ['https://tailwindcss.com/', 'nextjs'], ['https://storybook.js.org/', 'nextjs'],
  ['https://stripe.com/', 'nextjs'], ['https://elixir-lang.org/', 'astro'],
  ['https://getbootstrap.com/', 'astro'], ['https://wpbeginner.com/', 'wordpress'],
  ['https://variety.com/', 'wordpress'], ['https://flask.palletsprojects.com/', 'sphinx'],
  ['https://www.python.org/', 'django'], ['https://www.chess.com/', 'unknown'],
  ['https://www.smashingmagazine.com/', 'unknown'], ['https://deno.com/', 'unknown'],
  ['https://bun.sh/', 'unknown'], ['https://docs.docker.com/', 'unknown'],
  ['https://docs.nestjs.com/', 'unknown'], ['https://hub.docker.com/', 'unknown'],
];

async function run(name, sites) {
  const rows = [];
  for (const [url, label] of sites) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RankCLI-detection-benchmark)' } });
      if (!res.ok) { rows.push({ url, label, framework: 'FETCH_' + res.status, ok: false, skip: true }); continue; }
      const html = await res.text();
      const headers = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const r = frameworks.detectFromEvidence({ html, headers });
      rows.push({ url, label, ...r, ok: r.framework === label });
    } catch (error) {
      rows.push({ url, label, framework: 'FETCH_ERR', ok: false, skip: true, note: error.message });
    }
  }

  const scored = rows.filter((r) => !r.skip);
  const claims = scored.filter((r) => r.framework !== 'unknown');
  const correct = scored.filter((r) => r.ok).length;
  const wrong = claims.filter((r) => !r.ok);

  console.log(`\n=== ${name} ===`);
  for (const r of scored.filter((r) => !r.ok)) {
    const tag = r.framework === 'unknown' ? 'MISS ' : 'WRONG';
    console.log(`  ${tag} ${r.label.padEnd(10)} -> ${String(r.framework).padEnd(10)} ${String(r.score ?? '').padStart(3)}  ${r.url}`);
  }
  for (const r of rows.filter((r) => r.skip)) console.log(`  SKIP  ${r.url} (${r.framework})`);
  console.log(`  n=${scored.length} correct=${correct} (${((100 * correct) / scored.length).toFixed(0)}%)  wrong=${wrong.length}  precision on claims=${claims.length ? ((100 * (claims.length - wrong.length)) / claims.length).toFixed(0) : 100}%`);
  return wrong.length;
}

const onlyHoldout = process.argv.includes('--holdout');
const wrong = (onlyHoldout ? 0 : await run('tuning set', TUNING)) + (await run('hold-out', HOLDOUT));
console.log(wrong === 0 ? '\nNo wrong answers.' : `\n${wrong} wrong answer(s) - a wrong claim is the failure that matters.`);
process.exit(wrong === 0 ? 0 : 1);
