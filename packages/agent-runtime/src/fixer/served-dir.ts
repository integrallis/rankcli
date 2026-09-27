// Where a file has to live to be served at the site root.
//
// Getting this wrong means committing a robots.txt that nobody can fetch, which is worse than
// not committing one: the audit stops reporting it missing while search engines still never see
// it. Two ways of being wrong have already happened.
//
// First, the path was hardcoded to `${appRoot}public/`. On integrallis.com - a GitHub Pages site
// serving docs/ as-is - that wrote docs/public/robots.txt, a path that site will never serve.
//
// Then the fix looked for an existing public/ directory in the repository tree. That is right for
// a project that has one and wrong for every project that does not yet: measured against the
// real starter layouts, a fresh Next.js app, a fresh Nuxt app and a Docusaurus site all resolved
// to the repository root, because the directory they serve from had not been created yet.
//
// So the framework decides, and the tree only breaks ties when the framework is unknown. A
// framework's static directory is a property of the framework, not of whether the developer has
// put a file in it.

import type { Framework } from './../frameworks/detector.js';

/**
 * The directory each framework serves at the site root, relative to the app root.
 *
 * '' means the app root itself: Jekyll copies its source directory as-is, and a hand-built
 * static site has no build step to copy anything.
 */
const SERVED_DIR: Partial<Record<Framework, string>> = {
  // Bundlers and meta-frameworks that copy a public/ directory verbatim.
  react: 'public/',
  vue: 'public/',
  svelte: 'public/',
  angular: 'public/',
  solidjs: 'public/',
  qwik: 'public/',
  nextjs: 'public/',
  nuxt: 'public/',
  astro: 'public/',
  sveltekit: 'static/', // SvelteKit's is static/, not public/
  remix: 'public/',
  fresh: 'static/',
  // Gatsby, Hugo, Eleventy and Docusaurus all name theirs static/.
  gatsby: 'static/',
  hugo: 'static/',
  eleventy: 'public/',
  docusaurus: 'static/',
  // Server frameworks with a public document root.
  rails: 'public/',
  laravel: 'public/',
  symfony: 'public/',
  phoenix: 'priv/static/',
  spring: 'src/main/resources/static/',
  aspnet: 'wwwroot/',
  // Jekyll and Pelican copy their source tree, so the app root is the served root.
  jekyll: '',
  pelican: '',
  // Python web frameworks have no single convention; the tree decides below.
};

/**
 * Where to write a file that must be served at the site root.
 *
 * @param framework what detection identified, or 'unknown'
 * @param files every path in the repository
 * @param appRoot the app's directory, with a trailing slash, or ''
 * @returns a path prefix relative to appRoot: 'public/', 'static/', or '' for the app root
 */
export function servedDir(framework: Framework | undefined, files: string[], appRoot = ''): string {
  const known = framework ? SERVED_DIR[framework] : undefined;
  if (known !== undefined) return known;

  // Unknown framework: believe the repository. A directory that exists and is conventionally
  // served is better evidence than a guess.
  for (const candidate of ['public/', 'static/', 'assets/']) {
    if (files.some((f) => f.startsWith(`${appRoot}${candidate}`))) return candidate;
  }

  // Nothing to go on: beside index.html, which is where a site served as-is wants it.
  return '';
}
