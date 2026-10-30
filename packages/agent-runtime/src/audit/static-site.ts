/**
 * A local server for a build directory (`rankcli audit --dir dist`, the Action's `dir` input): the build output, served the way a static
 * host serves it (a directory's index.html, clean URLs as page.html, 404 for the rest), so the
 * audit can run before anything is deployed. Listens on 127.0.0.1 on a free port.
 */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
};

/**
 * The file a URL path maps to inside `dir`: the file itself, a directory's index.html, or
 * `path.html`. Null when nothing matches or the path would leave the directory.
 */
export async function resolveFile(dir: string, urlPath: string): Promise<string | null> {
  const root = resolve(dir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  const target = resolve(root, `.${decoded.startsWith('/') ? decoded : `/${decoded}`}`);
  if (target !== root && !target.startsWith(root + sep)) return null;
  const candidates = decoded.endsWith('/') || target === root
    ? [join(target, 'index.html')]
    : [target, join(target, 'index.html'), `${target}.html`];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // next candidate
    }
  }
  return null;
}

export interface StaticSite {
  /** http://127.0.0.1:<port> */
  origin: string;
  dir: string;
  /** The repository-relative file behind a page URL, for SARIF locations. */
  fileFor(url: string): Promise<string | undefined>;
  close(): Promise<void>;
}

export async function serveDirectory(dir: string, options: { relativeTo?: string } = {}): Promise<StaticSite> {
  const root = resolve(dir);
  const relativeTo = options.relativeTo ?? process.cwd();
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const file = await resolveFile(root, req.url ?? '/');
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : 'Not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': String(body.length),
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => ok());
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    dir: root,
    async fileFor(url: string) {
      let path: string;
      try {
        path = new URL(url).pathname;
      } catch {
        return undefined;
      }
      const file = await resolveFile(root, path);
      return file ? relative(relativeTo, file) : undefined;
    },
    close: () => new Promise<void>(done => server.close(() => done())),
  };
}
