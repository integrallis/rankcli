// Framework detection by weighed evidence.
//
// The previous detector walked an ordered list of regexes and returned the first framework
// whose pattern matched anywhere in the page. Measured against 30 real sites it got 57%: it
// called every nginx-served site a Go app (`server.includes('gin')` matches "nginx"), called
// laravel.com Rails (a `csrf-token` meta, which four frameworks emit), called
// phoenixframework.org Symfony (`sf2` appearing inside an asset hash, and Symfony sat earlier
// in the list than Phoenix), and called vuejs.org React (`_react` somewhere in its docs prose).
//
// Three structural problems, not eleven pattern bugs:
//
//   1. First match wins, so ordering decided the answer. A generic PHP pattern beat a precise
//      Elixir one because PHP came first.
//   2. Every signal counted the same. "The page mentions react" outranked nothing, because
//      there was nothing to outrank it with.
//   3. Substring tests on short tokens ("gin", "sf2", "go") match inside unrelated words.
//
// So: every signal carries a weight, all of them are collected, and the framework with the
// most evidence wins - provided it clears a floor. A framework that only has weak evidence
// loses to one with a decisive signal no matter what order they are declared in, and a page
// with nothing but weak evidence honestly answers `unknown`.

import type { Framework, Language } from './detector.js';

/**
 * DECISIVE: only this framework's build output or runtime emits it. A single one settles it.
 * STRONG: this framework's own attribute or cookie conventions; two make a confident answer.
 * WEAK: consistent with the framework, also consistent with others. Never decides alone.
 */
export const WEIGHT = { DECISIVE: 100, STRONG: 45, WEAK: 15 } as const;

/**
 * Below this, the evidence is not worth a claim.
 *
 * Set to one STRONG signal: a framework's own convention (a Thymeleaf attribute, a
 * laravel_session cookie, a Vite entry bundle mounting into #root) is a real answer, reported
 * at medium confidence. Two WEAK signals total 30 and still fall short, which is what stops
 * solidjs.com's `<div id="app">` from being called Vue.
 */
export const SCORE_FLOOR = 45;

export interface Signal {
  framework: Framework;
  language: Language;
  weight: number;
  /** Named so a wrong answer can be traced to the rule that caused it. */
  name: string;
  html?: RegExp;
  /** Matched against `${name}: ${value}` for every response header, lowercased. */
  header?: RegExp;
  /**
   * Every pattern must match the HTML. For evidence that only means something in
   * combination: a Vite entry bundle says "built with Vite", and an empty `#root` says "some
   * library mounts here" - together they say React, and neither says it alone.
   */
  allHtml?: RegExp[];
}

// Asset directories, hydration payloads and runtime globals. These exist because the framework
// put them there; nothing else does.
export const SIGNALS: Signal[] = [
  // ---- Meta-frameworks: JavaScript ------------------------------------------------
  { framework: 'nextjs', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'next-build-dir', html: /\/_next\/(static|image|data)\// },
  { framework: 'nextjs', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'next-data', html: /__NEXT_DATA__|self\.__next_f/ },
  { framework: 'nextjs', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'next-mount', html: /<div id=["']__next["']/ },
  { framework: 'nextjs', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'next-powered-by', header: /^x-powered-by: next\.js/ },

  { framework: 'nuxt', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'nuxt-build-dir', html: /\/_nuxt\// },
  { framework: 'nuxt', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'nuxt-payload', html: /__NUXT__|__NUXT_DATA__|<div id="__nuxt"/ },
  { framework: 'nuxt', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'nuxt-powered-by', header: /^x-powered-by: nuxt/ },

  { framework: 'astro', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'astro-build-dir', html: /\/_astro\// },
  { framework: 'astro', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'astro-island', html: /<astro-island|astro-slot|data-astro-(cid|source-file|transition)/ },
  { framework: 'astro', language: 'typescript', weight: WEIGHT.STRONG, name: 'astro-generator', html: /name=["']?generator["']?[^>]*content=["']?Astro/i },

  { framework: 'sveltekit', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'sveltekit-immutable', html: /\/_app\/immutable\// },
  { framework: 'sveltekit', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'sveltekit-runtime', html: /__sveltekit|kit\.start\(/ },

  { framework: 'remix', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'remix-context', html: /__remixContext|__remixManifest|__remixRouteModules/ },
  { framework: 'remix', language: 'typescript', weight: WEIGHT.STRONG, name: 'remix-build-dir', html: /\/build\/_shared\/|\/build\/entry\.client-/ },

  { framework: 'gatsby', language: 'javascript', weight: WEIGHT.DECISIVE, name: 'gatsby-runtime', html: /___gatsby|window\.___chunkMapping/ },
  { framework: 'gatsby', language: 'javascript', weight: WEIGHT.STRONG, name: 'gatsby-page-data', html: /\/page-data\/(app-data\.json|sq\/)/ },

  { framework: 'qwik', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'qwik-container', html: /q:container|q:base|q:version|qwikloader/ },

  { framework: 'fresh', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'fresh-build-dir', html: /\/_frsh\// },

  { framework: 'solidjs', language: 'typescript', weight: WEIGHT.STRONG, name: 'solid-hydration', html: /_\$HY\b|data-hk=["']/ },

  // ---- Base UI libraries: weaker by nature, and that is the point -----------------
  { framework: 'angular', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'angular-version', html: /ng-version=["']/ },
  { framework: 'angular', language: 'typescript', weight: WEIGHT.DECISIVE, name: 'angular-content-attr', html: /_ngcontent-|_nghost-/ },

  { framework: 'react', language: 'javascript', weight: WEIGHT.STRONG, name: 'react-root-marker', html: /data-reactroot|__reactContainer\$|__REACT_DEVTOOLS/ },
  // A Vite-built SPA: an empty mount point plus Vite's hashed entry bundle. Two weak facts
  // that together mean something; either one alone does not.
  { framework: 'react', language: 'javascript', weight: WEIGHT.WEAK, name: 'react-empty-root', html: /<div id="root"><\/div>/ },
  { framework: 'react', language: 'javascript', weight: WEIGHT.WEAK, name: 'react-refresh', html: /RefreshRuntime|react-refresh/ },
  {
    framework: 'react',
    language: 'javascript',
    weight: WEIGHT.STRONG,
    name: 'react-vite-spa',
    // Vite's entry chunk plus React's conventional mount point. Medium confidence by
    // construction: #app instead of #root stays unknown, because Vue, Solid and others use it.
    // Not `<div id="root"></div>`: a prerendered SPA has content inside its mount point, which
    // is what RankCLI's own site does and what the first version of this signal missed.
    allHtml: [/<script[^>]+src=["'][^"']+\.js["']/, /<div id="root"[\s>]/],
  },

  { framework: 'vue', language: 'javascript', weight: WEIGHT.DECISIVE, name: 'vitepress-runtime', html: /__VP_HASH_MAP__|__VP_SITE_DATA__/ },
  { framework: 'vue', language: 'javascript', weight: WEIGHT.DECISIVE, name: 'vue-scoped-style', html: /data-v-[0-9a-f]{6,10}\b/ },
  { framework: 'vue', language: 'javascript', weight: WEIGHT.WEAK, name: 'vue-cloak', html: /v-cloak|<div id="app"><\/div>/ },

  { framework: 'svelte', language: 'javascript', weight: WEIGHT.WEAK, name: 'svelte-class', html: /class=["'][^"']*svelte-[0-9a-z]{6}/ },

  // ---- Ruby -----------------------------------------------------------------------
  // csrf-token alone is emitted by Rails, Laravel, Phoenix and Django. csrf-param is Rails.
  { framework: 'rails', language: 'ruby', weight: WEIGHT.DECISIVE, name: 'rails-csrf-param', html: /name=["']csrf-param["']/ },
  { framework: 'rails', language: 'ruby', weight: WEIGHT.STRONG, name: 'rails-ujs', html: /rails-ujs|turbolinks|data-remote=["']true["']|action_cable|actioncable/ },
  { framework: 'rails', language: 'ruby', weight: WEIGHT.STRONG, name: 'rails-session-cookie', header: /^set-cookie: [^;]*_session=/ },
  { framework: 'rails', language: 'ruby', weight: WEIGHT.STRONG, name: 'rails-app-server', header: /^(server|x-powered-by): (puma|passenger|unicorn|phusion)/ },
  { framework: 'hotwire', language: 'ruby', weight: WEIGHT.STRONG, name: 'turbo-elements', html: /<turbo-frame|<turbo-stream|data-turbo-track/ },

  // ---- Python ---------------------------------------------------------------------
  { framework: 'django', language: 'python', weight: WEIGHT.DECISIVE, name: 'django-csrf-input', html: /name=["']csrfmiddlewaretoken["']/ },
  { framework: 'django', language: 'python', weight: WEIGHT.DECISIVE, name: 'django-csrf-cookie', header: /^set-cookie: csrftoken=/ },
  { framework: 'django', language: 'python', weight: WEIGHT.STRONG, name: 'django-admin-static', html: /\/static\/admin\/(css|js)\// },
  { framework: 'django', language: 'python', weight: WEIGHT.WEAK, name: 'django-wsgi-server', header: /^(server|x-powered-by): (gunicorn|uvicorn|daphne)/ },
  { framework: 'flask', language: 'python', weight: WEIGHT.STRONG, name: 'flask-server', header: /^server: werkzeug/ },
  { framework: 'fastapi', language: 'python', weight: WEIGHT.STRONG, name: 'fastapi-docs', html: /swagger-ui-bundle\.js[\s\S]{0,200}openapi\.json/ },

  // ---- PHP ------------------------------------------------------------------------
  { framework: 'wordpress', language: 'php', weight: WEIGHT.DECISIVE, name: 'wp-paths', html: /\/wp-content\/|\/wp-includes\/|\/wp-json\// },
  { framework: 'wordpress', language: 'php', weight: WEIGHT.DECISIVE, name: 'wp-generator', html: /name=["']?generator["']?[^>]*content=["']?WordPress/i },
  { framework: 'wordpress', language: 'php', weight: WEIGHT.STRONG, name: 'wp-powered-by', header: /^x-powered-by: wordpress/ },

  { framework: 'laravel', language: 'php', weight: WEIGHT.DECISIVE, name: 'laravel-session-cookie', header: /^set-cookie: laravel_session=/ },
  { framework: 'laravel', language: 'php', weight: WEIGHT.STRONG, name: 'laravel-xsrf-cookie', header: /^set-cookie: XSRF-TOKEN=/i },
  { framework: 'laravel', language: 'php', weight: WEIGHT.STRONG, name: 'laravel-livewire', html: /livewire|wire:(click|model|submit)/i },
  { framework: 'laravel', language: 'php', weight: WEIGHT.WEAK, name: 'laravel-vite-build', html: /\/build\/assets\/app-[A-Za-z0-9_-]{8}\.js/ },

  { framework: 'symfony', language: 'php', weight: WEIGHT.DECISIVE, name: 'symfony-profiler', html: /\/_profiler\/|sf-toolbar|sf-dump/ },
  { framework: 'symfony', language: 'php', weight: WEIGHT.STRONG, name: 'symfony-cookie', header: /^set-cookie: (sfsession|symfony)/i },

  // ---- Elixir ---------------------------------------------------------------------
  { framework: 'phoenix', language: 'elixir', weight: WEIGHT.DECISIVE, name: 'phoenix-liveview', html: /phx-(click|submit|change|value|hook|socket|main|track-static)/ },
  { framework: 'phoenix', language: 'elixir', weight: WEIGHT.STRONG, name: 'phoenix-cowboy', header: /^server: cowboy/ },

  // ---- Java / C# / Go -------------------------------------------------------------
  { framework: 'spring', language: 'java', weight: WEIGHT.STRONG, name: 'thymeleaf-attr', html: /\sth:[a-z-]+=/ },
  { framework: 'spring', language: 'java', weight: WEIGHT.STRONG, name: 'spring-server', header: /^server: (apache-coyote|tomcat|jetty)/ },
  { framework: 'aspnet', language: 'csharp', weight: WEIGHT.DECISIVE, name: 'aspnet-verification-token', html: /__RequestVerificationToken|__VIEWSTATE/ },
  { framework: 'aspnet', language: 'csharp', weight: WEIGHT.STRONG, name: 'aspnet-server', header: /^(server: kestrel|x-powered-by: asp\.net|x-aspnet-version:)/ },
  // "gin" used to be tested as a substring of the Server header, which matches nginx - the
  // single most common web server there is. Anchored to the whole value now.
  { framework: 'go', language: 'go', weight: WEIGHT.STRONG, name: 'go-server', header: /^server: (gin|echo|fiber|gorilla)(\/|$| )/ },

  // ---- Hypermedia -----------------------------------------------------------------
  { framework: 'htmx', language: 'unknown', weight: WEIGHT.STRONG, name: 'htmx-attrs', html: /\shx-(get|post|put|delete|trigger|swap|target)=/ },
  { framework: 'htmx', language: 'unknown', weight: WEIGHT.DECISIVE, name: 'htmx-script', html: /htmx(\.min)?\.js|unpkg\.com\/htmx/ },

  // ---- Static site generators: they announce themselves -----------------------------
  { framework: 'hugo', language: 'go', weight: WEIGHT.DECISIVE, name: 'hugo-generator', html: /name=["']?generator["']?[^>]*content=["']?Hugo/i },
  { framework: 'hugo', language: 'go', weight: WEIGHT.STRONG, name: 'hugo-generator-header', header: /^x-generator: hugo/ },
  { framework: 'jekyll', language: 'ruby', weight: WEIGHT.DECISIVE, name: 'jekyll-generator', html: /name=["']?generator["']?[^>]*content=["']?Jekyll/i },
  { framework: 'eleventy', language: 'javascript', weight: WEIGHT.DECISIVE, name: 'eleventy-generator', html: /name=["']?generator["']?[^>]*content=["']?Eleventy/i },
  { framework: 'pelican', language: 'python', weight: WEIGHT.DECISIVE, name: 'pelican-generator', html: /name=["']?generator["']?[^>]*content=["']?Pelican/i },

  // Sphinx: what nearly every Python project's documentation is built with, and the shape
  // flask.palletsprojects.com turned out to be. Structural markers only - not the word
  // "sphinx", which appears in plenty of prose.
  { framework: 'sphinx', language: 'python', weight: WEIGHT.DECISIVE, name: 'sphinx-doc-options', html: /_static\/documentation_options\.js/ },
  { framework: 'sphinx', language: 'python', weight: WEIGHT.STRONG, name: 'sphinx-theme-markup', html: /class=["'][^"']*sphinxsidebar|sphinx-highlight|_static\/searchtools\.js/ },
  { framework: 'sphinx', language: 'python', weight: WEIGHT.STRONG, name: 'docutils-generator', html: /name=["']?generator["']?[^>]*content=["']?Docutils/i },
];

export interface Evidence {
  framework: Framework;
  language: Language;
  score: number;
  /** Signal names that fired, so any answer can be explained. */
  matched: string[];
}

export interface DetectionResult {
  framework: Framework;
  language: Language;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  matched: string[];
  /** Runners-up, for debugging a wrong answer. */
  alternatives: Evidence[];
}

/** `name: value` per header, lowercased, one per line - what header signals match against. */
function headerLines(headers: Record<string, string> | undefined): string {
  if (!headers) return '';
  return Object.entries(headers)
    .map(([k, v]) => `${k.toLowerCase()}: ${String(v).toLowerCase()}`)
    .join('\n');
}

/**
 * The framework a response is built with, from all the evidence at once.
 *
 * Meta-frameworks beat the libraries they are built on without needing a rule to say so: a
 * Next.js page carries a decisive `/_next/static/` and at most weak React markers, so Next.js
 * wins on score. That is why nothing here encodes "nextjs outranks react".
 */
export function detectFromEvidence(input: { html?: string; headers?: Record<string, string> }): DetectionResult {
  const html = input.html ?? '';
  const headers = headerLines(input.headers);

  const byFramework = new Map<Framework, Evidence>();
  for (const signal of SIGNALS) {
    const headerHit =
      signal.header &&
      headers &&
      new RegExp(
        signal.header.source,
        signal.header.flags.includes('m') ? signal.header.flags : `${signal.header.flags}m`
      ).test(headers);
    const allHit = signal.allHtml && html && signal.allHtml.every((re) => re.test(html));
    const hit = (signal.html && html && signal.html.test(html)) || headerHit || allHit;
    if (!hit) continue;

    const existing = byFramework.get(signal.framework);
    if (existing) {
      existing.score += signal.weight;
      existing.matched.push(signal.name);
    } else {
      byFramework.set(signal.framework, {
        framework: signal.framework,
        language: signal.language,
        score: signal.weight,
        matched: [signal.name],
      });
    }
  }

  const ranked = [...byFramework.values()].sort((a, b) => b.score - a.score || a.framework.localeCompare(b.framework));
  const best = ranked[0];

  if (!best || best.score < SCORE_FLOOR) {
    return {
      framework: 'unknown',
      language: 'unknown',
      confidence: 'low',
      score: best?.score ?? 0,
      matched: best?.matched ?? [],
      alternatives: ranked,
    };
  }

  return {
    framework: best.framework,
    language: best.language,
    confidence: best.score >= WEIGHT.DECISIVE ? 'high' : 'medium',
    score: best.score,
    matched: best.matched,
    alternatives: ranked.slice(1),
  };
}
