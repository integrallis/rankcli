import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runFullAudit } from './engine.js';
import { analyzeOnPage, xRobotsTagHasNoindex } from './checks/on-page.js';

// A tiny local site whose routes each exercise one scoring rule. Every
// request (robots.txt, sitemap, the page itself, the checks' own probes)
// hits this server, so the tests never touch the network.
type Route = { status: number; body: string; headers?: Record<string, string> };

const GOOD_PAGE = `<!doctype html><html lang="en"><head>
<title>A perfectly reasonable page title for tests</title>
<meta name="description" content="A description that is long enough to satisfy the description length check in the audit engine.">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head><body><h1>Hello</h1><p>${'Some words here. '.repeat(40)}</p></body></html>`;

const ERROR_PAGE = `<!doctype html><html><head><title>Internal Server Error - Example Site</title></head>
<body><h1>Something broke</h1><p>Please try again later.</p></body></html>`;

function startSite(routes: Record<string, Route>): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = (req.url || '/').split('?')[0];
      const route = routes[path] ?? { status: 404, body: 'not found' };
      res.writeHead(route.status, { 'content-type': path.endsWith('.txt') ? 'text/plain' : 'text/html', ...route.headers });
      res.end(req.method === 'HEAD' ? undefined : route.body);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function stopSite(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// Free-tier limit keeps the run to the core checks - enough to exercise
// fetching, status handling and scoring without the slower extended probes.
const audit = (url: string, extra: Partial<Parameters<typeof runFullAudit>[0]> = {}) =>
  runFullAudit({ url, checksLimit: 50, ...extra });

describe('runFullAudit scoring truth', () => {
  let site: { server: Server; base: string };

  beforeAll(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    site = await startSite({
      '/': { status: 200, body: GOOD_PAGE },
      '/robots.txt': { status: 200, body: 'User-agent: *\nAllow: /\n' },
      '/broken': { status: 500, body: ERROR_PAGE },
      '/gone': { status: 404, body: ERROR_PAGE },
      '/meta-noindex': { status: 200, body: GOOD_PAGE.replace('<head>', '<head><meta name="robots" content="noindex, follow">') },
      '/header-noindex': { status: 200, body: GOOD_PAGE, headers: { 'X-Robots-Tag': 'noindex' } },
    });
  });

  afterAll(async () => {
    await stopSite(site.server);
    vi.restoreAllMocks();
  });

  it('records the real status code for a healthy page', async () => {
    const report = await audit(`${site.base}/`);
    expect(report.pages[0].statusCode).toBe(200);
    expect(report.issues.find(i => i.code === 'HTTP_ERROR_STATUS')).toBeUndefined();
    expect(report.issues.find(i => i.code === 'FETCH_ERROR')).toBeUndefined();
    expect(report.healthScore.overall).toBeGreaterThan(0);
  }, 60000);

  it('scores an unreachable site 0 with an error issue (it used to score 91)', async () => {
    // Bind then close a server to get a port nothing is listening on.
    const dead = await startSite({});
    const deadBase = dead.base;
    await stopSite(dead.server);

    const report = await audit(`${deadBase}/`);
    const fetchError = report.issues.find(i => i.code === 'FETCH_ERROR');
    expect(fetchError?.severity).toBe('error');
    expect(report.healthScore.overall).toBe(0);
    expect(report.summary.errors).toBeGreaterThan(0);
    expect(report.crawlStats.crawledUrls).toBe(0);
  }, 60000);

  it('reports a 5xx page as an error and does not grade the error page', async () => {
    const report = await audit(`${site.base}/broken`);
    const status = report.issues.find(i => i.code === 'HTTP_ERROR_STATUS');
    expect(status?.severity).toBe('error');
    expect(status?.details).toMatchObject({ statusCode: 500 });
    expect(report.pages[0].statusCode).toBe(500);
    expect(report.healthScore.overall).toBe(0);
    // Content checks skipped: the error page's title/H1 are not audited.
    expect(report.issues.find(i => i.category === 'on-page')).toBeUndefined();
  }, 60000);

  it('reports a 4xx page as an error', async () => {
    const report = await audit(`${site.base}/gone`);
    expect(report.issues.find(i => i.code === 'HTTP_ERROR_STATUS')?.details).toMatchObject({ statusCode: 404 });
    expect(report.healthScore.overall).toBe(0);
  }, 60000);

  it('treats a noindex meta tag on the audited root as an error', async () => {
    const report = await audit(`${site.base}/meta-noindex`);
    expect(report.issues.find(i => i.code === 'NOINDEX_TAG')?.severity).toBe('error');
  }, 60000);

  it('reads X-Robots-Tag from the response headers', async () => {
    const report = await audit(`${site.base}/header-noindex`);
    expect(report.issues.find(i => i.code === 'NOINDEX_HEADER')?.severity).toBe('error');
  }, 60000);

  it('downgrades noindex to a warning on a page that is not the audited root', async () => {
    const report = await audit(`${site.base}/header-noindex`, { auditRootUrl: `${site.base}/about` });
    expect(report.issues.find(i => i.code === 'NOINDEX_HEADER')?.severity).toBe('warning');
  }, 60000);
});

describe('robots.txt server errors', () => {
  let site: { server: Server; base: string };

  beforeAll(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    site = await startSite({
      '/': { status: 200, body: GOOD_PAGE },
      '/robots.txt': { status: 503, body: '<html><body>Service Unavailable</body></html>' },
    });
  });

  afterAll(async () => {
    await stopSite(site.server);
    vi.restoreAllMocks();
  });

  it('warns that Google treats a 5xx robots.txt as disallow-all, without parsing the error page', async () => {
    const report = await audit(`${site.base}/`);
    const robots = report.issues.find(i => i.code === 'ROBOTS_TXT_SERVER_ERROR');
    expect(robots?.severity).toBe('warning');
    expect(robots?.impact).toMatch(/disallow/i);
    expect(report.issues.find(i => i.code === 'ROBOTS_TXT_MISSING')).toBeUndefined();
    expect(report.issues.find(i => i.code === 'ROBOTS_TXT_BLOCKS_ALL')).toBeUndefined();
  }, 60000);
});

describe('noindex detection', () => {
  const page = (head = '') => `<html><head><title>t</title>${head}</head><body><h1>x</h1></body></html>`;

  it('parses X-Robots-Tag directives, including crawler-scoped ones', () => {
    expect(xRobotsTagHasNoindex('noindex')).toBe(true);
    expect(xRobotsTagHasNoindex('noindex, nofollow')).toBe(true);
    expect(xRobotsTagHasNoindex('none')).toBe(true);
    expect(xRobotsTagHasNoindex('googlebot: noindex')).toBe(true);
    expect(xRobotsTagHasNoindex('otherbot: noindex, nofollow')).toBe(false);
    expect(xRobotsTagHasNoindex('unavailable_after: 25 Jun 2030 15:00:00 PST')).toBe(false);
    expect(xRobotsTagHasNoindex('max-snippet: 20, nofollow')).toBe(false);
    expect(xRobotsTagHasNoindex(undefined)).toBe(false);
  });

  it('detects googlebot meta and any-case robots meta', () => {
    const r1 = analyzeOnPage(page('<meta name="GoogleBot" content="noindex">'), 'https://example.com/');
    expect(r1.data.hasNoindex).toBe(true);
    const r2 = analyzeOnPage(page('<meta name="robots" content="index, follow">'), 'https://example.com/');
    expect(r2.data.hasNoindex).toBe(false);
  });

  it('is an error on the homepage and a warning elsewhere by default', () => {
    const meta = '<meta name="robots" content="noindex">';
    expect(analyzeOnPage(page(meta), 'https://example.com/').issues.find(i => i.code === 'NOINDEX_TAG')?.severity).toBe('error');
    expect(analyzeOnPage(page(meta), 'https://example.com/thanks').issues.find(i => i.code === 'NOINDEX_TAG')?.severity).toBe('warning');
  });

  it('treats a header-only noindex on a preview-deployment host as a notice', () => {
    const headers = { 'x-robots-tag': 'noindex' };
    const vercel = analyzeOnPage(page(), 'https://my-app-git-feature-team.vercel.app/', headers);
    expect(vercel.issues.find(i => i.code === 'NOINDEX_HEADER')?.severity).toBe('notice');
    // ...but a noindex meta tag ships to production, so it stays an error.
    const meta = analyzeOnPage(page('<meta name="robots" content="noindex">'), 'https://my-app.vercel.app/', headers);
    expect(meta.issues.find(i => i.code === 'NOINDEX_TAG')?.severity).toBe('error');
  });
});
