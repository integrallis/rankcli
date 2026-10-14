import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { httpGet, looksLikeHtmlFallback } from './http.js';

// A server that sends headers straight away and then stalls the body: the timeout used to be
// cleared once headers arrived, so reading the body hung with no limit.
describe('httpGet', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (req.url === '/stall') {
        res.write('<html>'); // ...and never end
        return;
      }
      if (req.url === '/big') {
        res.end(Buffer.alloc(3 * 1024 * 1024, 'a'));
        return;
      }
      res.end('<html>ok</html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it('times out a body that never finishes', async () => {
    const started = Date.now();
    await expect(httpGet(`${base}/stall`, { timeout: 300 })).rejects.toThrow(/timeout/i);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('returns a body that arrives in time', async () => {
    const response = await httpGet<string>(`${base}/ok`, { timeout: 2000 });
    expect(response.data).toBe('<html>ok</html>');
  });

  it('stops reading a body at maxBytes', async () => {
    const response = await httpGet<string>(`${base}/big`, { timeout: 2000, maxBytes: 16 * 1024 });
    expect(response.data.length).toBeGreaterThanOrEqual(16 * 1024);
    expect(response.data.length).toBeLessThan(1024 * 1024);
  });

  it('reads the whole body without maxBytes', async () => {
    const response = await httpGet<string>(`${base}/big`, { timeout: 5000 });
    expect(response.data.length).toBe(3 * 1024 * 1024);
  });
});

describe('looksLikeHtmlFallback', () => {
  it('recognises an SPA catch-all by content type', () => {
    expect(looksLikeHtmlFallback('User-agent: *', 'text/html; charset=utf-8')).toBe(true);
  });

  it('recognises one by its body when the content type is missing', () => {
    expect(looksLikeHtmlFallback('<!DOCTYPE html>\n<html lang="en">')).toBe(true);
    expect(looksLikeHtmlFallback('  <html><head></head></html>')).toBe(true);
  });

  it('accepts a real text file', () => {
    expect(looksLikeHtmlFallback('User-agent: *\nAllow: /', 'text/plain; charset=utf-8')).toBe(false);
    expect(looksLikeHtmlFallback('# Example\n\n> A site')).toBe(false);
  });

  // An XML sitemap opens with a declaration, not a doctype.
  it('accepts XML', () => {
    expect(looksLikeHtmlFallback('<?xml version="1.0"?><urlset/>', 'application/xml')).toBe(false);
  });

  it('is false for a non-string body', () => {
    expect(looksLikeHtmlFallback({ parsed: true })).toBe(false);
    expect(looksLikeHtmlFallback(undefined)).toBe(false);
  });
});
