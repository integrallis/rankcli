import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeMetadataPlacement, metadataPlacement } from './metadata-placement.js';
import * as http from '../../utils/http.js';

const URL_ = 'https://example.com/post';
const full = '<!doctype html><html><head><title>Post</title><meta name="description" content="d"><link rel="canonical" href="https://example.com/post"></head><body><h1>Post</h1><p>Body</p></body></html>';
const streamed = '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Post</h1><p>Body</p><title>Post</title><meta name="description" content="d"><link rel="canonical" href="https://example.com/post"></body></html>';
const bare = '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Post</h1><p>Body</p></body></html>';

function mockByAgent(answer: (ua: string) => string) {
  return vi.spyOn(http, 'httpGet').mockImplementation(async (_url, config) => {
    const ua = (config?.headers?.['User-Agent'] as string) ?? '';
    return { data: answer(ua), status: 200, statusText: '', headers: {} } as never;
  });
}

describe('metadata placement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads which tags are in head and which ended up in body', () => {
    expect(metadataPlacement(full)).toEqual({ inHead: ['<title>', 'the meta description', 'the canonical link'], inBody: [] });
    expect(metadataPlacement(streamed).inBody).toEqual(['<title>', 'the meta description', 'the canonical link']);
  });

  it('costs no request and says nothing for a page with its metadata in head', async () => {
    const spy = mockByAgent(() => full);
    const { issues } = await analyzeMetadataPlacement(full, URL_);
    expect(issues).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  // The Next.js case: Googlebot gets a complete head, everyone else gets the tags streamed
  // into the body later.
  it('reports metadata streamed only for listed bots', async () => {
    mockByAgent((ua) => (ua.includes('Googlebot') ? full : streamed));
    const { issues, data } = await analyzeMetadataPlacement(streamed, URL_);
    expect(issues.map((i) => i.code)).toEqual(['METADATA_STREAMED_FOR_BOTS']);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].description).toMatch(/arrive later, inside <body>/);
    expect(issues[0].howToFix).toMatch(/htmlLimitedBots/);
    expect(data.streamed).toEqual(['<title>', 'the meta description', 'the canonical link']);
  });

  it('reports metadata in the body when Googlebot gets the same page', async () => {
    mockByAgent(() => streamed);
    const { issues } = await analyzeMetadataPlacement(streamed, URL_);
    expect(issues.map((i) => i.code)).toEqual(['METADATA_OUTSIDE_HEAD']);
    expect(issues[0].title).toMatch(/inside <body>/);
  });

  it('says nothing when the tags are missing for everyone (other checks report that)', async () => {
    mockByAgent(() => bare);
    const { issues } = await analyzeMetadataPlacement(bare, URL_);
    expect(issues).toEqual([]);
  });

  it('skips the Googlebot comparison for a static build and still reports body placement', async () => {
    const spy = mockByAgent(() => full);
    const { issues } = await analyzeMetadataPlacement(streamed, URL_, { compareAsGooglebot: false });
    expect(spy).not.toHaveBeenCalled();
    expect(issues.map((i) => i.code)).toEqual(['METADATA_OUTSIDE_HEAD']);
  });

  it('treats a failed Googlebot fetch as no evidence', async () => {
    vi.spyOn(http, 'httpGet').mockRejectedValue(new Error('network'));
    const { issues } = await analyzeMetadataPlacement(streamed, URL_);
    expect(issues.map((i) => i.code)).toEqual(['METADATA_OUTSIDE_HEAD']);
  });
});
