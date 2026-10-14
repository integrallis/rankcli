import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSiteVerificationCache, lookupSiteVerification } from './site-verification.js';

// node:dns is loaded through a dynamic import so the Deno bundle builds; the mock answers it.
const resolveTxt = vi.fn<[string], Promise<string[][]>>();
vi.mock('node:dns', () => {
  const promises = { resolveTxt: (name: string) => resolveTxt(name) };
  return { default: { promises }, promises };
});

function dnsError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/** TXT records by name; a name with no entry answers ENODATA, like a real resolver. */
function records(byName: Record<string, string[][]>) {
  resolveTxt.mockImplementation(async (name) => {
    const found = byName[name];
    if (!found) throw dnsError('ENODATA');
    return found;
  });
}

function bingSiteAuth(body: string | null, contentType = 'application/xml') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (body === null ? new Response('', { status: 404 }) : new Response(body, { status: 200, headers: { 'content-type': contentType } })))
  );
}

beforeEach(() => {
  clearSiteVerificationCache();
  resolveTxt.mockReset();
  records({});
  bingSiteAuth(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('lookupSiteVerification', () => {
  it('finds the Google TXT record on the registrable domain of a www host', async () => {
    records({ 'example.com': [['v=spf1 include:_spf.example.net ~all'], ['google-site-verification=', 'tdCNQoEk']] });

    const result = await lookupSiteVerification('https://www.example.com/pricing');

    expect(result).toEqual({ dnsChecked: true, googleDns: true, bingDns: false, bingSiteAuthFile: false });
    expect(resolveTxt.mock.calls.map((c) => c[0]).sort()).toEqual(['example.com', 'www.example.com']);
  });

  it('finds the Bing MS= TXT record', async () => {
    records({ 'example.com': [['MS=ms12345678']] });

    const result = await lookupSiteVerification('https://example.com/');

    expect(result.bingDns).toBe(true);
    expect(result.googleDns).toBe(false);
  });

  it('asks the deeper suffixes of a subdomain, so a .co.uk apex is reached', async () => {
    records({ 'example.co.uk': [['google-site-verification=abc']] });

    const result = await lookupSiteVerification('https://docs.example.co.uk/');

    expect(result.googleDns).toBe(true);
    expect(resolveTxt.mock.calls.map((c) => c[0]).sort()).toEqual(['co.uk', 'docs.example.co.uk', 'example.co.uk']);
  });

  it('reports a checked domain with no record as unverified', async () => {
    const result = await lookupSiteVerification('https://example.com/');

    expect(result).toEqual({ dnsChecked: true, googleDns: false, bingDns: false, bingSiteAuthFile: false });
  });

  it('treats a name that does not exist as checked', async () => {
    resolveTxt.mockRejectedValue(dnsError('ENOTFOUND'));

    expect((await lookupSiteVerification('https://example.com/')).dnsChecked).toBe(true);
  });

  it('reports DNS as unchecked when the resolver fails', async () => {
    resolveTxt.mockRejectedValue(dnsError('ESERVFAIL'));

    expect((await lookupSiteVerification('https://example.com/')).dnsChecked).toBe(false);
  });

  it('gives up on a lookup after two seconds', async () => {
    vi.useFakeTimers();
    resolveTxt.mockImplementation(() => new Promise(() => undefined));

    const pending = lookupSiteVerification('https://example.com/');
    await vi.advanceTimersByTimeAsync(2100);

    expect((await pending).dnsChecked).toBe(false);
  });

  it('does not look up an IP address', async () => {
    const result = await lookupSiteVerification('http://127.0.0.1:3005/');

    expect(resolveTxt).not.toHaveBeenCalled();
    expect(result.dnsChecked).toBe(true);
  });

  it('accepts a BingSiteAuth.xml with a users element', async () => {
    bingSiteAuth('<?xml version="1.0"?>\n<users>\n  <user>ABC123</user>\n</users>');

    expect((await lookupSiteVerification('https://example.com/')).bingSiteAuthFile).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://example.com/BingSiteAuth.xml');
  });

  // An SPA's catch-all answers 200 with index.html for any path.
  it('rejects an HTML page served in place of BingSiteAuth.xml', async () => {
    bingSiteAuth('<!doctype html><html><body><div id="users"></div></body></html>', 'text/html');

    expect((await lookupSiteVerification('https://example.com/')).bingSiteAuthFile).toBe(false);
  });

  it('rejects a missing BingSiteAuth.xml', async () => {
    expect((await lookupSiteVerification('https://example.com/')).bingSiteAuthFile).toBe(false);
  });

  // Two checks on each of eight pages would otherwise be sixteen rounds of lookups.
  it('looks a host up once and serves the rest from cache', async () => {
    records({ 'example.com': [['google-site-verification=abc']] });

    const first = await lookupSiteVerification('https://example.com/');
    const second = await lookupSiteVerification('https://example.com/docs');

    expect(second).toEqual(first);
    expect(resolveTxt).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('answers an unparsable URL as unchecked without looking anything up', async () => {
    const result = await lookupSiteVerification('not a url');

    expect(result.dnsChecked).toBe(false);
    expect(resolveTxt).not.toHaveBeenCalled();
  });
});
