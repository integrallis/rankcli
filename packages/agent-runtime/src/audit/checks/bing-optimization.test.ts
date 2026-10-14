import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeBingOptimization } from './bing-optimization.js';
import { lookupSiteVerification, type SiteVerification } from './site-verification.js';

// The DNS/BingSiteAuth.xml lookup is the helper's business (site-verification.test.ts). The
// check also asks for the IndexNow key and the sitemap; those get a 404 here.
vi.mock('./site-verification.js', () => ({ lookupSiteVerification: vi.fn() }));

const lookup = vi.mocked(lookupSiteVerification);
const nothing: SiteVerification = { dnsChecked: true, googleDns: false, bingDns: false, bingSiteAuthFile: false };
const URL = 'https://example.com/';
const bare = '<html><head></head><body></body></html>';

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue(nothing);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function verifiedIssue(html: string) {
  const { issues, data } = await analyzeBingOptimization(html, URL);
  return { issue: issues.find((i) => i.code === 'BING_NOT_VERIFIED'), data };
}

describe('BING_NOT_VERIFIED', () => {
  it('is satisfied by the msvalidate.01 meta tag', async () => {
    const { issue, data } = await verifiedIssue('<html><head><meta name="msvalidate.01" content="ABC123"></head></html>');
    expect(issue).toBeUndefined();
    expect(data.hasBingMetaTag).toBe(true);
  });

  it('is satisfied by an MS= TXT record', async () => {
    lookup.mockResolvedValue({ ...nothing, bingDns: true });
    const { issue, data } = await verifiedIssue(bare);
    expect(issue).toBeUndefined();
    expect(data.hasBingDnsRecord).toBe(true);
    expect(lookup).toHaveBeenCalledWith(URL);
  });

  it('is satisfied by /BingSiteAuth.xml', async () => {
    lookup.mockResolvedValue({ ...nothing, bingSiteAuthFile: true });
    const { issue, data } = await verifiedIssue(bare);
    expect(issue).toBeUndefined();
    expect(data.hasBingSiteAuth).toBe(true);
  });

  it('reports an unverified site, naming the DNS record it looked for', async () => {
    const { issue, data } = await verifiedIssue(bare);
    expect(issue).toBeDefined();
    expect(issue?.title).toBe('Site not verified with Bing Webmaster Tools');
    expect(issue?.description).toContain('no MS= TXT record');
    expect(issue?.details).toMatchObject({ hasBingMetaTag: false, hasBingSiteAuth: false, hasBingDnsRecord: false, dnsChecked: true });
    expect(data.dnsChecked).toBe(true);
  });

  // Deno and offline runs have no resolver: a DNS-verified site looks like this too.
  it('only says the tag is not in the HTML when DNS could not be checked', async () => {
    lookup.mockResolvedValue({ ...nothing, dnsChecked: false });
    const { issue, data } = await verifiedIssue(bare);
    expect(issue?.title).toBe('Bing Webmaster Tools verification not visible in the HTML');
    expect(issue?.description).toContain('could not check');
    expect(issue?.description).not.toContain('no MS= TXT record');
    expect(data.dnsChecked).toBe(false);
  });

  it('leaves BingSiteAuth.xml to the shared lookup instead of fetching it itself', async () => {
    await analyzeBingOptimization(bare, URL);
    const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes('BingSiteAuth.xml'))).toBe(false);
  });
});
