import { describe, expect, it } from 'vitest';
import { metaRefreshTarget } from './meta-refresh.js';

const base = 'https://docs.example.com/';

describe('metaRefreshTarget', () => {
  it('resolves a relative instant refresh against the page URL (the docs.astro.build stub)', () => {
    const stub = '<!DOCTYPE html><meta http-equiv="refresh" content="0;url=/en/getting-started/">';
    expect(metaRefreshTarget(stub, base)).toBe('https://docs.example.com/en/getting-started/');
  });

  it('accepts the quoted, spaced and upper-case spellings browsers accept', () => {
    expect(metaRefreshTarget('<meta http-equiv="Refresh" content="0; URL=\'https://other.example/x\'">', base))
      .toBe('https://other.example/x');
    expect(metaRefreshTarget('<meta content="2,https://other.example/y" http-equiv="refresh">', base))
      .toBe('https://other.example/y');
  });

  it('ignores slow refreshes, self refreshes and non-http targets', () => {
    expect(metaRefreshTarget('<meta http-equiv="refresh" content="60">', base)).toBeNull();
    expect(metaRefreshTarget('<meta http-equiv="refresh" content="30;url=/live/">', base)).toBeNull();
    expect(metaRefreshTarget('<meta http-equiv="refresh" content="0;url=https://docs.example.com">', base)).toBeNull();
    expect(metaRefreshTarget('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">', base)).toBeNull();
  });

  it('returns null for an ordinary page', () => {
    expect(metaRefreshTarget('<html><head><title>Hi</title></head><body><p>Hello</p></body></html>', base)).toBeNull();
    expect(metaRefreshTarget('<meta http-equiv="content-type" content="text/html">', base)).toBeNull();
  });
});
