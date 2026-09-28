// Refusing to commit a change that breaks the site it was meant to improve.
//
// An auto-fix PR asks a language model for the full new contents of a file and commits the
// answer. The upside is real; so is the downside, and the downside lands on someone's live
// site. Two PRs opened against a real site during development produced, between them:
// mojibake across three title tags, static files written to a directory that site does not
// serve, and a sitemap whose lastmod dates were rewritten two years into the past. Only the
// last was the model's fault - which is the point. The checks here are cheap, they are all
// "did this lose something the original had", and they run before anything is committed.
//
// Everything is a pure function of (path, original, replacement), so it is all testable
// without a repository, a model, or a network.

export interface ReplacementConcern {
  /** Machine-readable, for logs and the PR body. */
  code:
    | 'shrunk'
    | 'lost_closing_tag'
    | 'lost_script'
    | 'lost_stylesheet'
    | 'lost_verification'
    | 'lost_import'
    | 'invalid_json'
    | 'invalid_xml'
    | 'invalid_json_ld'
    | 'fewer_sitemap_urls'
    | 'lastmod_moved_backwards'
    | 'placeholder_content'
    | 'canonical_in_shared_shell';
  detail: string;
}

const HTML_EXT = /\.html?$/i;
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro)$/i;

function attributeValues(html: string, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value) found.add(value);
  }
  return found;
}

/** `<script src>` URLs. Losing one can mean losing the app's entry point. */
function scriptSources(html: string): Set<string> {
  return attributeValues(html, /<script[^>]+src=["']([^"']+)["']/gi);
}

/** Stylesheet hrefs. Losing one means an unstyled page. */
function stylesheetHrefs(html: string): Set<string> {
  return attributeValues(html, /<link[^>]+href=["']([^"']+)["'][^>]*>/gi);
}

/**
 * Search-engine and platform verification tags. These are proof of ownership: dropping one
 * can un-verify a property in Search Console, and nothing about it is recoverable from the
 * page itself.
 */
function verificationTokens(html: string): Set<string> {
  const found = new Set<string>();
  for (const match of html.matchAll(/<meta[^>]+name=["']([^"']*(?:site-verification|verify|verification)[^"']*)["'][^>]*>/gi)) {
    found.add(match[1].toLowerCase());
  }
  return found;
}

/** Module specifiers, as a cheap proxy for "this file still builds". */
function importSpecifiers(source: string): Set<string> {
  const found = new Set<string>();
  for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) found.add(match[1]);
  for (const match of source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) found.add(match[1]);
  return found;
}

function missing(before: Set<string>, after: Set<string>): string[] {
  return [...before].filter((value) => !after.has(value));
}

/** Well-formed enough: every tag that opens closes, and it parses as a tree. */
function xmlConcern(xml: string): string | null {
  const stack: string[] = [];
  for (const match of xml.matchAll(/<\/?([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [tag, name, selfClosing] = match;
    if (tag.startsWith('<?') || tag.startsWith('<!')) continue;
    if (tag.startsWith('</')) {
      if (stack.pop() !== name) return `unbalanced </${name}>`;
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  return stack.length ? `unclosed <${stack[stack.length - 1]}>` : null;
}

function sitemapUrlCount(xml: string): number {
  return [...xml.matchAll(/<loc>/gi)].length;
}

/** The newest lastmod in a sitemap, as a timestamp, or null when it has none. */
function newestLastmod(xml: string): number | null {
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)]
    .map((m) => Date.parse(m[1].trim()))
    .filter((t) => !Number.isNaN(t));
  return dates.length ? Math.max(...dates) : null;
}

/** JSON-LD blocks that don't parse are invalid structured data - worse than none. */
function jsonLdConcerns(html: string): string[] {
  const bad: string[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      bad.push((error as Error).message);
    }
  }
  return bad;
}

/**
 * Everything wrong with replacing `original` with `replacement` at `path`. Empty means safe
 * to commit. `original` is null for a file being created, where there is nothing to lose and
 * only the content's own validity matters.
 */
/**
 * Text a model invents when it has no real value to put somewhere.
 *
 * A generated PR for rankcli.dev proposed Organization JSON-LD carrying
 * "+1-800-555-0199", "123 Main Street, Anytown, CA 90210" and a sameAs entry of
 * "youtube.com/channel/your_youtube_channel". Published structured data asserting a business
 * address and phone number that do not exist is worse than having none: it is a false claim
 * about a real company, and search engines act on it.
 *
 * Kept narrow on purpose. These are strings that essentially never appear in real content -
 * 555 numbers are reserved for fiction, and "Anytown" and "your_" are what a template looks
 * like when nobody filled it in.
 */
const PLACEHOLDERS: { pattern: RegExp; what: string }[] = [
  { pattern: /\+?1[-\s.]?\(?800\)?[-\s.]?555[-\s.]?\d{4}/i, what: 'a reserved 555 phone number' },
  { pattern: /\b555[-\s.]?01\d{2}\b/, what: 'a reserved 555 phone number' },
  { pattern: /\bAnytown\b/i, what: '"Anytown"' },
  { pattern: /\b123 Main (Street|St)\b/i, what: '"123 Main Street"' },
  { pattern: /your_[a-z_]+/i, what: 'an unfilled "your_..." placeholder' },
  { pattern: /\b(yourdomain|your-domain|example)\.(com|org|net)\b/i, what: 'a placeholder domain' },
  { pattern: /\blorem ipsum\b/i, what: 'lorem ipsum' },
  { pattern: /\bXXX-XXX-XXXX\b/i, what: 'an unfilled phone template' },
];

/** An SPA shell: one file that serves many routes. */
function isSharedShell(html: string): boolean {
  return /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html);
}

export function assessReplacement(
  path: string,
  original: string | null,
  replacement: string
): ReplacementConcern[] {
  const concerns: ReplacementConcern[] = [];
  const add = (code: ReplacementConcern['code'], detail: string) => concerns.push({ code, detail });

  // --- Invented content: applies to new files too -------------------------------
  for (const { pattern, what } of PLACEHOLDERS) {
    const hit = replacement.match(pattern);
    // Only a concern if we are the ones introducing it.
    if (hit && !(original && pattern.test(original))) {
      add('placeholder_content', `contains ${what} (${hit[0]})`);
    }
  }

  // A canonical in a file that serves every route tells search engines every page is a
  // duplicate of one URL. A generated PR proposed exactly this for rankcli.dev's index.html,
  // whose own comment says not to, and merging it would have deindexed the site.
  if (/\.html?$/i.test(path) && isSharedShell(replacement)) {
    const addsCanonical =
      /<link[^>]+rel=["']canonical["']/i.test(replacement) &&
      !(original && /<link[^>]+rel=["']canonical["']/i.test(original));
    if (addsCanonical) {
      add(
        'canonical_in_shared_shell',
        `${path} mounts a single-page app, so a canonical here applies to every route`
      );
    }
  }

  // --- Content validity: applies to new files too -------------------------------
  if (/\.json$/i.test(path) || /\.webmanifest$/i.test(path)) {
    try {
      JSON.parse(replacement);
    } catch (error) {
      add('invalid_json', (error as Error).message);
    }
  }
  if (/\.xml$/i.test(path)) {
    const problem = xmlConcern(replacement);
    if (problem) add('invalid_xml', problem);
  }
  if (HTML_EXT.test(path)) {
    for (const problem of jsonLdConcerns(replacement)) add('invalid_json_ld', problem);
  }

  if (original === null) return concerns;

  // --- Loss: only checkable against what was there ------------------------------
  if (replacement.length < original.length * 0.6) {
    add('shrunk', `${Math.round((replacement.length / original.length) * 100)}% of the original length`);
  }

  if (HTML_EXT.test(path)) {
    for (const tag of ['</head>', '</body>', '</html>']) {
      if (original.includes(tag) && !replacement.includes(tag)) add('lost_closing_tag', tag);
    }
    const lostScripts = missing(scriptSources(original), scriptSources(replacement));
    if (lostScripts.length) add('lost_script', lostScripts.join(', '));

    const lostStyles = missing(stylesheetHrefs(original), stylesheetHrefs(replacement));
    if (lostStyles.length) add('lost_stylesheet', lostStyles.join(', '));

    const lostVerification = missing(verificationTokens(original), verificationTokens(replacement));
    if (lostVerification.length) add('lost_verification', lostVerification.join(', '));
  }

  if (SOURCE_EXT.test(path)) {
    const lostImports = missing(importSpecifiers(original), importSpecifiers(replacement));
    if (lostImports.length) add('lost_import', lostImports.join(', '));
  }

  if (/sitemap[^/]*\.xml$/i.test(path)) {
    const before = sitemapUrlCount(original);
    const after = sitemapUrlCount(replacement);
    if (after < before) add('fewer_sitemap_urls', `${before} -> ${after}`);

    // A model cannot know when a page last changed, and the wrong direction tells crawlers
    // the site is staler than it is.
    const newestBefore = newestLastmod(original);
    const newestAfter = newestLastmod(replacement);
    if (newestBefore !== null && newestAfter !== null && newestAfter < newestBefore) {
      add(
        'lastmod_moved_backwards',
        `${new Date(newestBefore).toISOString().slice(0, 10)} -> ${new Date(newestAfter).toISOString().slice(0, 10)}`
      );
    }
  }

  return concerns;
}

/** One line naming why a file was dropped, for a log line or a PR body. */
export function describeConcerns(concerns: ReplacementConcern[]): string {
  return concerns.map((c) => `${c.code} (${c.detail})`).join('; ');
}
