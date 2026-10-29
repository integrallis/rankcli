import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeSiteMaturity } from './site-maturity.js';

// Every network probe the check makes (Wayback, the certificate, the indexed-pages guess) is
// stubbed: these tests are about what the check concludes from the evidence it gets.
const html = '<html><head><title>Acme</title></head><body><h1>Acme</h1><p>A tool.</p></body></html>';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const codes = async () => (await analyzeSiteMaturity(html, 'https://acme.dev/')).issues.map((i) => i.code);

describe('analyzeSiteMaturity', () => {
  it('does not call a site new on the strength of a fresh certificate or no evidence at all', async () => {
    // No Wayback snapshot and no certificate: age unknown. rankcli.dev was reported as 35 days
    // old because its Let's Encrypt certificate had been renewed 35 days earlier.
    expect(await codes()).not.toContain('NEW_SITE_STRATEGY');
  });

  it('never reports a content-to-authority imbalance: there is no backlink data to back it', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('archive.org')) return new Response(JSON.stringify([['timestamp'], ['20240101000000']]), { status: 200 });
      return new Response('<html>' + '<a href="/p">x</a>'.repeat(400) + '</html>', { status: 200 });
    }));
    expect(await codes()).not.toContain('CONTENT_AUTHORITY_IMBALANCE');
  });
});
