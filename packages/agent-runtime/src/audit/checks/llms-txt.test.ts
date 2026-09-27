import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { analyzeLlmsTxt, extractLlmsTxtLinks } from './llms-txt.js';

describe('extractLlmsTxtLinks', () => {
  const baseUrl = 'https://example.com';

  it('resolves relative links against the base URL', () => {
    const content = '- [About](/about): learn more\n- [Docs](/docs): documentation';
    expect(extractLlmsTxtLinks(content, baseUrl)).toEqual([
      'https://example.com/about',
      'https://example.com/docs',
    ]);
  });

  it('keeps absolute links as-is', () => {
    const content = '- [External](https://other.com/page): a link';
    expect(extractLlmsTxtLinks(content, baseUrl)).toEqual(['https://other.com/page']);
  });

  it('skips unresolvable links without throwing', () => {
    const content = '- [Email](mailto:hi@example.com): contact\n- [About](/about): learn more';
    expect(extractLlmsTxtLinks(content, baseUrl)).toEqual([
      'https://example.com/about',
    ]);
  });

  it('returns an empty array when there are no links', () => {
    expect(extractLlmsTxtLinks('# Title\n> description', baseUrl)).toEqual([]);
  });
});

// A single-page app answers every unknown path with its own HTML, so a 200 here used to be
// read as an llms.txt and analysed - reporting no title, no description and too few links
// for a file the site never had.
describe('analyzeLlmsTxt against an SPA catch-all', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html>\n<html lang="en"><head><title>App</title></head><body></body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('reports the file as missing, not as present and malformed', async () => {
    const { issues, data } = await analyzeLlmsTxt(baseUrl);
    expect(data.exists).toBe(false);
    expect(data.fullVersionExists).toBe(false);
    const codes = issues.map((i) => i.code);
    // This analyzer's own "no llms.txt" code; ai-readiness.ts reports LLMS_TXT_MISSING.
    expect(codes).toContain('AI_NO_LLMS_TXT');
    expect(codes).not.toContain('AI_LLMS_TXT_NO_TITLE');
    expect(codes).not.toContain('AI_LLMS_TXT_NO_DESCRIPTION');
    expect(codes).not.toContain('AI_LLMS_TXT_FEW_LINKS');
  });
});
