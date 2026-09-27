// Which directory in a repository is the web app.
//
// Every generated fix path is relative to this, so getting it wrong means either writing
// files nobody serves or - worse - telling a model "the app root is the repository root"
// and letting it rewrite whatever it finds there.
//
// The rule that used to decide it was "a package.json at the root means the root is the
// app", which is exactly backwards for a workspace: rankcli.dev's own repo has a root
// package.json and its site in packages/saas, so the app root resolved to '' and the fixer
// looked for index.html in a directory that has never had one.
//
// What actually marks a web app is an index.html next to a package.json. A repository can
// hold several (a site and a docs site); the shallowest wins, and among equals a
// conventional name does.

/** Directory names that mean "this is the web app" when there is a tie. */
const PREFERRED_NAMES = ['web', 'app', 'site', 'www', 'frontend', 'client', 'ui', 'saas', 'marketing', 'docs'];

function directoryOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

/**
 * @param files every path in the repository, as returned by the git tree API
 * @returns the app root with a trailing slash, or '' for the repository root
 */
export function findAppRoot(files: string[]): string {
  const real = files.filter((f) => !f.includes('node_modules/') && !f.startsWith('.'));

  const packageDirs = new Set(
    real.filter((f) => f === 'package.json' || f.endsWith('/package.json')).map(directoryOf)
  );

  // An index.html with a package.json beside it: that is a web app.
  const candidates = real
    .filter((f) => f === 'index.html' || f.endsWith('/index.html'))
    .map(directoryOf)
    // public/index.html (CRA) describes the app one level up.
    .map((dir) => (dir.endsWith('/public') ? dir.slice(0, -'/public'.length) : dir === 'public' ? '' : dir))
    .filter((dir) => packageDirs.has(dir));

  if (candidates.length > 0) {
    const depth = (dir: string) => (dir === '' ? 0 : dir.split('/').length);
    candidates.sort((a, b) => {
      if (depth(a) !== depth(b)) return depth(a) - depth(b);
      const rank = (dir: string) => {
        const name = dir.split('/').pop() ?? '';
        const index = PREFERRED_NAMES.indexOf(name);
        return index === -1 ? PREFERRED_NAMES.length : index;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    const best = candidates[0];
    return best === '' ? '' : `${best}/`;
  }

  // A static site with no build step and therefore no package.json: GitHub Pages serving
  // docs/, or a plain html directory. integrallis.com is exactly this - docs/index.html
  // beside docs/CNAME - and keying only on package.json put its app root at the repository
  // root, where nothing is served from.
  const PAGES_MARKERS = ['CNAME', '.nojekyll', '404.html', 'site.webmanifest'];
  const staticRoots = real
    .filter((f) => f === 'index.html' || f.endsWith('/index.html'))
    .map(directoryOf)
    .filter((dir) => PAGES_MARKERS.some((marker) => real.includes(dir ? `${dir}/${marker}` : marker)));
  if (staticRoots.length > 0) {
    staticRoots.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
    return staticRoots[0] === '' ? '' : `${staticRoots[0]}/`;
  }

  // No index.html anywhere (Next.js, Astro, Rails...). Fall back to the shallowest
  // package.json that isn't the workspace root, then the root itself.
  const nonRoot = [...packageDirs].filter((dir) => dir !== '');
  if (packageDirs.has('') || nonRoot.length === 0) return '';
  nonRoot.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  return `${nonRoot[0]}/`;
}
