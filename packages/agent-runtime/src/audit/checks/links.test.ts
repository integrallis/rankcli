import { describe, it, expect, vi, beforeEach } from 'vitest';

const head = vi.fn();
const get = vi.fn();
vi.mock('../../utils/http.js', () => ({ httpHead: (...a: unknown[]) => head(...a), httpGet: (...a: unknown[]) => get(...a) }));

import { analyzeLinks } from './links.js';

const page = (hrefs: string[]) =>
  `<html><body>${hrefs.map((h) => `<a href="${h}">x</a>`).join('')}<a href="/in">in</a><a href="/in2">in2</a></body></html>`;
const status = (n: number) => ({ status: n, data: null, headers: {} });

describe('BROKEN_EXTERNAL_LINK (rankcli #21)', () => {
  beforeEach(() => { head.mockReset(); get.mockReset(); });

  it('does not call a host broken for refusing HEAD and GET with 403', async () => {
    head.mockResolvedValue(status(403));
    get.mockResolvedValue(status(403));
    const { issues } = await analyzeLinks(page(['https://medium.com/@someone/post']), 'https://example.com/', true);
    expect(issues.map((i) => i.code)).not.toContain('BROKEN_EXTERNAL_LINK');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0][1].headers['User-Agent']).toMatch(/Mozilla/);
  });

  it('accepts a host that refuses HEAD (405) but serves GET', async () => {
    head.mockResolvedValue(status(405));
    get.mockResolvedValue(status(200));
    const { issues } = await analyzeLinks(page(['https://host.example/page']), 'https://example.com/', true);
    expect(issues.map((i) => i.code)).not.toContain('BROKEN_EXTERNAL_LINK');
  });

  it('still reports a 404, with no GET retry needed', async () => {
    head.mockResolvedValue(status(404));
    const { issues } = await analyzeLinks(page(['https://host.example/gone']), 'https://example.com/', true);
    expect(issues.map((i) => i.code)).toContain('BROKEN_EXTERNAL_LINK');
    expect(get).not.toHaveBeenCalled();
  });

  it('reports a link whose GET retry answers 410', async () => {
    head.mockResolvedValue(status(403));
    get.mockResolvedValue(status(410));
    const { issues } = await analyzeLinks(page(['https://host.example/removed']), 'https://example.com/', true);
    expect(issues.map((i) => i.code)).toContain('BROKEN_EXTERNAL_LINK');
  });
});
