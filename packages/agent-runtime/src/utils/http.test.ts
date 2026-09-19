import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { httpGet } from './http.js';

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
});
